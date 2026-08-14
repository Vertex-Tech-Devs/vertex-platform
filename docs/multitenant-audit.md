# Auditoría Multi-Tenant — Seguridad, Operación y Optimización

Fecha: 2026-08-14 · Alcance: plataforma (`platform/vertex-platform`), template
(`storefront`), pool de shards, billing y reglas de seguridad.

## Resumen ejecutivo

La arquitectura multi-tenant (shards = proyectos GCP `vtx-sd-*` con hasta 35 tiendas,
aislamiento por `storeId` + custom claims) es **sólida en su diseño**: los writes de
catálogo exigen `storeId` del admin (previene cross-tenant overwrite), los claims se
emiten solo server-side, y los callables validan `platformAdmin`. Los hallazgos
importantes son de **operación y saneamiento** (huérfanos GCP + cuota agotada), no de
aislamiento entre tenants.

## Hallazgos

### 🔴 O1 — Proyectos GCP huérfanos consumen la cuota (Alto)

17 proyectos `vtx-sd-*` existen en GCP sin documento en `infrastructure_shards`
(12 `ACTIVE`, 5 `DELETE_REQUESTED`; verificados con `audit-shards.ts`). Consumen la
cuota de proyectos — que hoy está **agotada** (la creación de shards falla con
`exceeded your allotted project quota`).

Causas raíz:

- El purge del scheduler elimina el **doc** `FULL` (>24h) pero **nunca el proyecto GCP**.
- `poll()` del script traga errores de LRO (`done:true` con `error`) → imprime
  "✅ creado" para proyectos que fallaron (fix aplicado).
- Provisionings fallidos dejan el proyecto creado sin doc.

Acción:

1. Verificar en consola si los 12 `ACTIVE` son de prod (el ADC personal no ve
   `vertex-platform-app`). Borrar los confirmados como huérfanos:
   `gcloud projects delete <projectId>` (o consola).
2. Futuro: al purgar/eliminar un shard con 0 tiendas, evaluar borrar también el
   proyecto GCP (con confirmación explícita, nunca si tiene tiendas).

### 🔴 O2 — Cuota de proyectos GCP agotada (Alto, bloqueante)

La meta de 10 shards no se puede completar hasta aumentar la cuota:
`IAM y administración → Cuotas → "Project Count" → Editar → Solicitar aumento` (ej. 50).
Aplica en minutos. Con cuota + limpieza de huérfanos (O1), el scheduler
(`WARM_SHARD_TARGET=10`) rellena el pool solo, o `provision-shards.ts --target 10 --env dev`.

### 🟠 S1 — Lectura pública de pedidos con PII (Medio)

`orders/{orderId}` tiene `allow get: if true`, y los pedidos contienen `clientName`,
`clientEmail`, `clientPhone` y `shippingAddress` completo. Cualquiera con el ID
(visible en URLs de confirmación y emails) lee la PII del comprador.

Fix recomendado (requiere trabajo en `storefront` + bump de template):

- Quitar el `get` público; la confirmación de compra debe recibir el pedido por
  route state (ya lo tiene en memoria) en vez de re-fetch por ID, y el admin lee por
  su claim. Alternativa intermedia: `get` solo para `isStoreAdmin(storeId)` +
  endpoint callable para el comprador.

### 🟠 S2 — Bypass de tenant en claims sin tenantId (Medio/Bajo)

En `isStoreAdmin`, `request.auth.token.get('tenantId','') == ''` permite que un claim
`admin:true` sin `tenantId` escriba en cualquier tienda. Hoy los claims siempre se
emiten con `tenantId` (role.functions.ts), pero es un bypass latente: eliminar la
cláusula para que un admin sin tenant no tenga acceso por defecto.

### 🟡 S3 — Emails de super-admin hardcodeados (Bajo)

`isSuperAdmin()` y el default de `role.functions.ts` incluyen los 3 emails de
desarrollador. Funcional hoy; migrar a configuración de entorno
(`PROTECTED_SUPER_ADMINS` ya existe como override) cuando haya más admins.

### 🟡 S4 — API keys de shards sin restricciones (Bajo)

El provisioning limpia las restricciones de las API keys (necesario para hosting
multi-dominio). Riesgo: uso abusivo de endpoints de Auth con la key pública. Mitigación
recomendada: Firebase App Check en el template.

### 🟡 S5 — Detalles menores de hardening (Bajo)

- `github-oidc.ts`: JWKS cacheadas para siempre (rotación de keys de GitHub) y sin
  check de `nbf` — refrescar JWKS con TTL (p. ej. 1h).
- `logClientError`: endpoint público con rate limit en memoria (OK a esta escala).

### 🟠 O3 — Billing: atribución incompleta (Medio)

- Los shards no registran qué billing account los paga.
- Las tiendas de dev no tienen `billingAccountId` → `pickBillingAccount`/`listBillingAccounts`
  estiman uso con datos incompletos.

Fix: guardar `billingAccountId` en el doc del shard al provisionar y backfillear tiendas;
usar el contador `currentProjects` de la billing account (ya preferido por
`pickBillingAccount`) en vez de escanear `stores`.

### 🟡 O4 — Esquema dual de billing (Bajo)

Conviven `billing_accounts` (status ACTIVE) y `billingAccounts` (active bool). El UI
escribe en `billingAccounts`; `pickBillingAccount` prefiere `billing_accounts`.
Consolidar en un solo esquema.

### 🟢 O5 — Optimización de lecturas (Info)

`listBillingAccounts` y el resumen de capacidad cargan todas las tiendas por llamada.
A escala, mover a contadores agregados en el doc de la billing account/shard
(transaccional al provisionar/eliminar).

### ✅ Corregido en esta auditoría

- **O7** Drift de reglas: `STOREFRONT_FIRESTORE_RULES` ahora es idéntica a
  `storefront/firestore.rules` (faltaban las lecturas de rutas anidadas).
- **O8** `provision-shards.ts` no desplegaba rules (ruta inválida) — ahora despliega
  firestore + storage con las reglas reales de la plataforma.
- **O9** `poll()` traga errores de LRO → lanza el error real (cuota, permisos).
- **O10** Purge de `WARMUP_PROVISIONING` colgados (>12h, 0 tiendas).
- **O11** Alerta de pool bajo con comando accionable (`--target 10`) y
  `POOL_LOW_THRESHOLD` configurable; `WARM_SHARD_TARGET=10`.
- **O12** Scripts nuevos: `provision-shards.ts --target|--count|--verify` y
  `audit-shards.ts` (huérfanos + redirect URIs del pool completo).

## Pendientes de consola (usuario)

1. Aumentar cuota de proyectos GCP (O2).
2. Verificar/borrar huérfanos (O1) — sobre todo los 12 `ACTIVE`.
3. Registrar redirect URIs pendientes en el client OAuth master (hoy: 2 —
   `vtx-sd-3am2uj4h`, `vtx-sd-h8hhzl94`):
   `https://console.cloud.google.com/apis/credentials?project=ecommerce-vertex-dev`
   → client `988454979046-jnb1sj6boknturojkohr8peha3lgevtr.apps.googleusercontent.com`
   → Authorized redirect URIs → `https://<shard>.firebaseapp.com/__/auth/handler`.
4. Correr `audit-shards.ts` en prod con credenciales prod para cruzar huérfanos.
