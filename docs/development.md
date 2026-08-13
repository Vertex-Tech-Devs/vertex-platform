# Development Guide — Vertex Platform

Guía técnica de desarrollo y operación del control plane multi-tenant.

## Arquitectura

- **vertex-platform** (este repo): SaaS control plane. Functions de aprovisionamiento
  (`provisionStore`, `redeployStore`, `completeStoreDeployment`, `repairStoreAuthDomains`,
  `checkStoreOAuthRedirect`), panel Angular (`/stores`).
- **ecommerce-vertex** (repo hermano): storefront master template + admin de tienda.
  Se despliega a cada tienda (hosting + functions + rules + índices) vía CI.
- **Shards**: proyectos Firebase `vtx-sd-*` que alojan ~35 tiendas cada uno
  (`DEFAULT_MAX_STORES_PER_SHARD`). Las tiendas se asignan al shard warm disponible.
  Cuando un shard alcanza su capacidad pasa a `FULL` y se rota a otro warm.

## Flujo de aprovisionamiento (por tienda)

1. `provisionStore` → pasos: createProject → linkBilling → addFirebase → enableApis →
   createWebApp → initFirestore → configureEmail → initAdmin → grantAccess → triggerDeploy.
2. `initAdmin`: inicializa Identity Platform del shard, configura el Google IdP con el
   **clientId del master** (`988454979046-jnb1sj6boknturojkohr8peha3lgevtr.apps.googleusercontent.com`),
   registra `authorizedDomains` (shard + sitio de la tienda) y verifica el redirect URI.
3. `completeStoreDeployment` (llamada por el CI del storefront vía OIDC) persiste
   `status: 'active'`, `lastDeployedAt`, `templateVersion`, `appVersion`, `targetChannel`.
4. `ensureCompositeIndexes` crea los índices compuestos del storefront en el shard.

## OAuth por shard — el único paso manual

El login del admin usa `https://{shard}.firebaseapp.com/__/auth/handler`. Google **no
expone API** para registrar redirect URIs en el client OAuth del master → se registra una
vez por shard (~35 tiendas) en:

- Consola: `https://console.cloud.google.com/apis/credentials?project=<master>`
- URI a registrar: `https://vtx-sd-<shard>.firebaseapp.com/__/auth/handler`

Verificación automatizada:

```bash
npx tsx scripts/check-oauth-redirects.ts
```

El panel muestra un banner con botón "Copiar URI" cuando falta.

## Versionado semántico

- La versión actual del template es **v0.2.0** (desarrollo): `CURRENT_TEMPLATE_VERSION`
  en `functions/src/provisioning.ts` y `version` en los `package.json`.
- El panel permite seleccionar la versión a desplegar por tienda (selector en store-detail).

## Rules y seguridad

- `firestore.rules` (platform): catálogo público (read) + writes aislados por tienda
  (`isStoreAdmin` con `tenantId == storeId`) + **catch-all `isPlatformAdmin()`**.
- `firestore.rules` (storefront, se despliega a shards): lectura pública universal +
  writes aislados. Nunca abrir `allow write: if isAuthenticated()` genérico.
- `storage.rules`: escritura solo con claims de admin/plataforma.
- Validación de input con zod (`provisionStoreAdminSchema`, etc.).
- Rate-limit (`checkRateLimit`) + auditoría (`logAuditAction`) en funciones mutadoras.

## Tests y gates

Ver `docs/testing-unified.md`. Resumen: storefront 210 tests, platform 43 tests,
`lint && typecheck && test` en ambos repos.

## Índices compuestos

`firestore.indexes.json` en ambos repos define los índices multi-tenant (clients, orders,
products, categories, banners). Se despliegan a cada shard en el CI de deploy y en el
warm-up (`ensureCompositeIndexes`).

## Refactorización (SRP)

- Ya extraídos: `seed-products.constants.ts`, `seed-orders.constants.ts` (storefront).
- Pendiente deliberado: `store-detail.ts` (platform, ~887 líneas) y
  `product-create.component.ts` (storefront, ~546 líneas) — son componentes activos con
  cambios recientes (UX, versionado, OAuth); la extracción se hará cuando haya cobertura
  de tests dedicada para evitar regresiones.

## Flujo de versiones del template (v0.2.0)

Hay **dos acciones distintas** en la tarjeta "Versión de Plantilla" del panel:

1. **Aplicar versión** (selector + botón "Aplicar versión"): cambia la versión de la tienda.
   - `updateStoreVersion` valida que el tag `v<versión>` exista en `ecommerce-vertex`,
     dispara el evento `update-store-version` (checkout `refs/tags/v<versión>`) y persiste
     `versionUpdateStatus: 'updating'` + `versionUpdateTarget`.
   - Al terminar, el workflow llama `completeVersionUpdate` que persiste
     `templateVersion`, `appVersion` (v...), `targetChannel: 'stable'`, `lastDeployedAt`
     y `versionUpdateStatus: 'idle'`.
2. **Re-desplegar versión activa** (antes "Gatillar Redeploy Manual"): **NO cambia la
   versión** — re-despliega el código de la versión actualmente activa (ej. v0.1.0) tal
   cual está. Útil para reintentar un deploy sin tocar la versión.

> ⚠️ Confusión común: si una tienda sigue mostrando v0.1.0 tras "actualizar", se usó
> "Re-desplegar versión activa" en vez de "Aplicar versión". Verificar `appVersion`/
> `templateVersion` en el panel o en `stores/{storeId}` (Firestore).

### Listado de versiones
`listTemplateVersions` fusiona **releases** (fuente primaria: notas + fecha real) y
**tags** (fecha del commit del tag), ordena por semver descendente y marca `isLatest`.
El selector muestra todas las versiones compatibles, no solo la latest.

## Runbook: shard en Datastore Mode (tienda en error en "Inicializar Firestore")

Si una tienda queda en `status: error` en el paso `initFirestore`, su shard puede tener la
DB `(default)` en **DATASTORE_MODE** (shards viejos). El aprovisionamiento auto-rota a un
shard warm, pero si la tienda quedó huérfana el fix manual es:

```bash
# 1. Eliminar la DB (default) en Datastore mode (SOLO si la tienda no tiene datos)
curl -X DELETE .../v1/projects/<shard>/databases/(default)
# 2. Esperar ~5 min (cooldown de Google) y crear en modo nativo
curl -X POST .../v1/projects/<shard>/databases?databaseId=(default) \
  -d '{"type":"FIRESTORE_NATIVE","locationId":"nam5"}'
# 3. Verificar: databases → [(default), FIRESTORE_NATIVE]
```

Luego "Reintentar aprovisionamiento" en el panel completa el paso.

## Runbook: upload de imagen colgado en "Subiendo (0%)"

El admin de producto quedaba colgado si el upload a Storage fallaba (permisos/red):
`uploadProgress` solo se limpiaba en éxito. Fix: el `subscribe` de
`product-create.component.ts` ahora limpia `uploadProgress`/`galleryUploadProgress` en
`error` → el spinner desaparece y el guardado vuelve a estar disponible. El SweetAlert de
error ya informaba la causa (revisar storage.rules si el fallo es de permisos).
