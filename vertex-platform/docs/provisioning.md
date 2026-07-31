# Flujo de Aprovisionamiento — Vertex Platform

Este documento describe el ciclo de vida de creación de una tienda desde la solicitud hasta el despliegue.

## Entradas (`provisionStore`)

```ts
interface CreateStorePayload {
  name: string;
  slug: string;
  ownerEmail: string;
  logoUrl?: string;
  customDomain?: string;
  verticalId?: string;        // indumentaria | gastronomia | retail | ...
  includeMockData?: boolean;  // siembra pedidos/clientes de demostración
  dedicatedProject?: boolean; // true = Tienda Dedicada, false/undefined = Estándar
}
```

## Paso 0 — Validaciones

- Solo `platformAdmin` puede invocar (token claim).
- Rate limit: 5 llamadas / 15 min por usuario (`checkRateLimit`).
- `slug` debe cumplir `^[a-z0-9][a-z0-9-]{1,18}[a-z0-9]$`.
- **Existencia**: se consulta `stores` por `slug` y por `name`; si existe → `HttpsError('already-exists', 'El ... ya se encuentra registrado en la plataforma')`.

## Paso 1 — Selección de Shard (Auto-Healing)

1. Consulta `infrastructure_shards` con `environment == env` y `status == 'ACTIVE'`.
2. **Si no hay ninguno** → crea automáticamente el shard por defecto:
   ```ts
   { id: 'shared-dev-01', status: 'ACTIVE', maxCapacity: 35, currentStores: 0,
     reservedStores: 0, projectId: 'ecommerce-vertex-dev' /* o el master de prod */ }
   ```
   y re-consulta.
3. Selecciona el shard con más cupo disponible (`maxCapacity - currentStores - reservedStores`, respetando el límite físico de 35 sites por proyecto GCP).
4. Si no hay shard `ACTIVE` con cupo, se busca un shard `WARMUP_READY` (se promueve a `ACTIVE` y se dispara la creación del siguiente warm shard).

## Paso 2 — Runtime Mode

- **Estándar** (`dedicatedProject !== true`): `runtimeMode = 'shared-shard'`, `shardId` del shard seleccionado, `projectId` = proyecto del shard, `runtimeSiteId = vtx-<slug>`.
- **Dedicada** (`dedicatedProject === true`): `runtimeMode = 'dedicated-project'`, `projectId = vtx-<slug>` (≤30 chars), `runtimeSiteId = 'default'`.

## Paso 3 — Billing (Selección Inteligente + Fallback)

- Solo se necesita billing si `runtimeMode === 'dedicated-project' || isNewShard` (crear proyecto GCP nuevo).
- `pickBillingAccount(db)`:
  1. Consulta `billing_accounts` con `status == 'ACTIVE'`; si está vacía, fallback a `billingAccounts` con `active == true`.
  2. Para cada cuenta calcula `remaining = (maxProjects ?? ∞) - (currentProjects ?? uso desde stores)`.
  3. Devuelve la cuenta con mayor cupo; si todas están llenas lanza `'All billing accounts are at capacity...'`.
- **Fallback automático**: si la selección de billing falla (cuota):
  1. `console.warn` con el motivo.
  2. Auditoría en Firestore: `logAuditAction(..., 'provisionStore-billing-fallback', slug, 'failure', { reason })`.
  3. La solicitud se **convierte transparentemente a Tienda Estándar** sobre el shard activo (`shared-dev-01` con auto-heal si hace falta): `runtimeMode = 'shared-shard'`, `isNewShard = false`, `billingAccountId = null`.
  4. `skipGcpSteps` marca `createProject`, `linkBilling`, `addFirebase`, `enableApis`, `installEmailExtension` como `done` — la tienda se crea al 100% sin consumir proyectos GCP ni billing.

## Paso 4 — Creación del Documento de Tienda

```ts
stores/{storeId} // storeId = crypto.randomUUID()
{ id, name, slug, ownerEmail, tenantId: slug, runtimeMode, shardId,
  runtimeProjectId: projectId, runtimeSiteId, firebaseProjectId: projectId,
  defaultUrl, billingAccountId, isNewShard, includeMockData,
  status: 'provisioning', provisioningSteps, createdAt, updatedAt }
```

Si `isNewShard`, se pre-registra el shard en `infrastructure_shards`.

## Paso 5 — Ejecución de Pasos (`runProvisioning`, 10 pasos)

| # | Paso | Estándar (shared) | Dedicada |
|---|---|---|---|
| 1 | `createProject` (GCP) | `done` (skip) | crear proyecto |
| 2 | `linkBilling` | `done` (skip) | vincular cuenta |
| 3 | `addFirebase` | `done` (skip) | activar Firebase |
| 4 | `enableApis` | `done` (skip) | habilitar APIs |
| 5 | `createWebApp` | reutilizar/cachear config del shard o crear web app | crear web app |
| 6 | `initFirestore` | sembrar datos base flat | idem |
| 7 | `configureEmail` | plantillas `settings/emailTemplates_{storeId}` | idem |
| 8 | `installEmailExtension` | `done` (skip) | instalar extensión |
| 9 | `initAdmin` | preautorizar owner (Google OAuth) | idem |
| 10 | `triggerDeploy` | disparar GitHub Actions deploy | idem |

### Paso 5 — Creación de WebApp (404 fix)

- El identificador enviado a Firebase Management API es **siempre el `gcpProjectId` real** (`projectId` del shard o `vtx-<slug>`), nunca el `storeId`.
- `webAppDisplayName = vtx-${slug}-${uniqueSuffix}` con `uniqueSuffix = storeId.replace(/[^a-zA-Z0-9]/g,'').slice(-6)` → evita el error GCP 400 por reserva de 30 días.
- `createWebAppWithRetry`: **delay preventivo de 3000ms** (propagación de `FirebaseProject`) + **hasta 3 intentos** con pausas de 3s ante `404 / NOT_FOUND / fetch failed`.

### Paso 6 — Seeding Flat (`seedStoreData`)

Escribe en colecciones planas con `storeId` y IDs prefijados `{storeId}-`:
- `configuracion/footer_{storeId}`, `configuracion/hero_{storeId}`, `configuracion/store_{storeId}`
- `banners/home_{storeId}`, `pages/aboutUs_{storeId}`
- `attributes`, `categories`, `products` (+ `variants` subcolección), `clients`, `orders`
- Limpieza previa **solo de documentos del store** (por prefijo de ID), nunca de otras tiendas.
- `checkStoreSafety` usa `runQuery` filtrando `storeId`.

### Pasos 9-10 — OAuth / Identity Toolkit y Deploy

- `ensureStoreAuthDomains` sincroniza `authorizedDomains`: `${projectId}.firebaseapp.com`, `${projectId}.web.app`, `localhost`, `127.0.0.1`, master storefront, custom domain.
- `buildRequiredOAuthRedirectUris` incluye `https://<host>/__/auth/handler` para cada dominio autorizado.
- `triggerDeploy` invoca GitHub Actions (deploy del template storefront) e incrementa `currentStores` del shard dentro de una transacción.

## Finalización (`completeStoreDeployment`)

- Callable invocado por GitHub Actions con `deployToken` + `commitSha`.
- Marca `status: 'active'`, `lastDeployedAt`, `templateVersion`, `schemaVersion`.
- Incrementa `currentStores` del shard y lo marca `FULL` si alcanza `maxCapacity`.

## Auditoría

Cada acción relevante registra en `auditLog`: `userId`, `email`, `action`, `targetId`, `result`, `details` (`provisionStore`, `provisionStore-billing-fallback`, etc.).
