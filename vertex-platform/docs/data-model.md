# Modelo de Datos y Reglas de Seguridad — Vertex

## 1. Modelo Flat Multi-Tenant (V1.0)

Desde V1.0, **todos los datos de tienda son colecciones planas en la raíz** etiquetadas con un campo `storeId`. Se eliminó el esquema anidado legacy `tenants/{tenantId}/{collection}/{docId}` (migración ejecutada con `scripts/migrate-legacy-tenants.ts`).

### Colecciones de Catálogo (Públicas)

| Colección | Doc ID | Campos clave |
|---|---|---|
| `products` | `{storeId}-<id>` | `storeId`, `categoryId`, `price`, `finalPrice`, `totalStock`, `variantAttributes`, `image`, `images[]` |
| `products/{id}/variants` | `{storeId}-<id>` | `storeId`, `productId`, `attributes`, `stock`, `sku` |
| `categories` | `{storeId}-<id>` | `storeId`, `name`, `slug`, `parentId`, `filterableAttributes`, `imageUrl` |
| `attributes` | `{storeId}-<id>` | `storeId`, `name`, `values[]` |
| `configuracion` | `store_{storeId}`, `footer_{storeId}`, `hero_{storeId}` | `storeId`, `storeName`, `colors`, `contact`, `payments`, `seo` |
| `banners` | `home_{storeId}` | `storeId`, `heroImages[]`, `carouselSettings`, `featuredCategories` |
| `pages` | `aboutUs_{storeId}` | `storeId`, `bannerTitle`, `centralDescription`, `featureCards[]` |

### Colecciones Transaccionales / Admin

| Colección | Doc ID | Notas |
|---|---|---|
| `orders` | `{storeId}-<id>` | público get/create (guest checkout), admin list/update/delete |
| `clients` | `{storeId}_<email>` | clave compuesta para evitar colisiones entre tiendas |
| `reviews` | auto | creación con `userId == auth.uid` |
| `settings` | `emailTemplates_{storeId}` | plantillas de email por tienda |
| `mail` | auto | cola de emails con TTL |
| `admin_roles` | `{storeId}_{email}` | clave compuesta; escritura solo vía Admin SDK |

### Plano de Control (Siempre Privado)

`stores`, `infrastructure_shards`, `billing_accounts`, `provisioning_queue`, `provisioning_logs`, `users`, `admin_roles` → solo `isPlatformAdmin()`.

### Shards (`infrastructure_shards`)

| Campo | Tipo | Notas |
|---|---|---|
| `status` | string | `ACTIVE` \| `FULL` \| `DRAINING` \| `MAINTENANCE` \| `WARMUP_READY` \| `WARMUP_PROVISIONING` (mayúsculas) |
| `maxCapacity` | number | máx. tiendas (35 por proyecto GCP) |
| `currentStores` | number | tiendas activas asignadas |
| `reservedStores` | number | reservas |
| `projectId` | string | proyecto GCP compartido |
| `firebaseConfig` | map (opcional) | caché de config para reutilizar web app |

## 2. Reglas de Firestore

### Storefront (`storefront/firestore.rules`)

- **Lectura pública** (`allow read: if true;`) para: `configuracion`, `products` (+ `variants`), `categories`, `attributes`, `banners`, `pages`.
- **Escrituras** (`create/update/delete`) → `isStoreAdmin(request.resource.data.storeId)`:
  ```js
  function isStoreAdmin(storeId) {
    return isAuthenticated() && (
      isSuperAdmin() ||
      (request.auth.token.get('admin', false) == true && request.auth.token.get('tenantId', '') == storeId) ||
      exists(/databases/$(database)/documents/admin_roles/$(storeId + '_' + request.auth.token.email)) && role in ['owner','admin']
    );
  }
  ```
- `orders`: público `get`/`create`; `list` requiere `request.query.get('storeId') == token.tenantId`; `update`/`delete` admin.
- `clients`, `settings`, `mail`: solo admin (get/list con filtro `storeId` en query).
- `admin_roles`: lectura solo si `compositeId.matches(tenantId + '_.*')`; escritura `false` (solo Admin SDK).
- Catch-all: `allow read, write: if false;`.

### Platform (`platform/vertex-platform/firestore.rules`)

- Catch-all `match /{document=**} { allow read, write: if isPlatformAdmin(); }` protege todas las colecciones del plano de control.
- Excepción pública: `configuracion/store` (config pública para storefronts dedicados).

### Validación en CI (`scripts/validate-firestore-rules.ts`)

- Detecta `CI=true` / `GITHUB_ACTIONS=true` / `FORCE_STANDALONE=true` → **modo standalone**: valida solo las reglas locales de `vertex-platform` (catch-all `isPlatformAdmin()` + sin matchers públicos en colecciones de control) y sale `exit 0`.
- En local (storefront presente) → **full sync**: verifica que las 6 colecciones de catálogo tengan `allow read: if true` (match flexible: `match /<col>/`, `match /<col>`, o regex `match\s+/<col>`).

## 3. Reglas de Storage (`storefront/storage.rules`)

- `allow read: if true;` — imágenes de catálogo públicas.
- `allow create, update: if isStoreAdmin() && request.resource.size < 5 * 1024 * 1024 && request.resource.contentType.matches('image/(jpeg|png|webp)')` — solo administradores, MIME restringido, ≤5MB.
- `allow delete: if isStoreAdmin();`

## 4. Migración de Datos (referencia)

El script temporal `scripts/migrate-legacy-tenants.ts` (creado, ejecutado y eliminado tras su uso) realizó:

1. `shards` → `infrastructure_shards`: `maxStores → maxCapacity`, `activeStores → currentStores`, `status` a mayúsculas.
2. `tenants/{tenantId}/{collection}/{docId}` → colección plana `{collection}/{tenantId}-{docId}` con campo `storeId`, incluyendo subcolecciones `variants`.
3. Batches de máx. 450 escrituras y soporte `--dry-run`.

Ejecución en `vertex-platform-dev`: 2 shards migrados, 0 namespaces legacy.
