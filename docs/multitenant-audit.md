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

### 🔴 O13 — Cuota de billing de GCP por billing account (Alto, bloqueante)

Al completar shards huérfanos, el vínculo de billing falla con
`Cloud billing quota exceeded` a partir de **~2 proyectos por billing account**
(verificado: 016AC2 tiene 4, 01D2F4 tiene 3, y los intentos nuevos fallan). Es el
límite REAL — distinto del `maxProjects` autoimpuesto de la plataforma (10). Requiere
solicitar aumento en: https://support.google.com/code/contact/billing_quota_increase.

Impacto: con la cuota actual solo se pudieron completar **4 de 12** huérfanos
(3z5twz4j, 5792sth2, aia7f0ao, qncajqrx) + 1 ya facturable (3am2uj4h) + **1 liberado por
desvincular un proyecto de prueba** (j9db0rkj, vía `audit-billing.ts` + unlink). Los otros
(8 proyectos ACTIVE) quedan como huérfanos y se completan con `complete-shards.ts`
cuando haya cuota. Límite real verificado: **5 proyectos por billing account**
(no 4 como se estimó; ambas cuentas de dev están a 5/5). La creación de billing accounts
por API está bloqueada por Google (400 en `create`/`subAccounts.create`).

### 🔴 O14 — Storage rules inválidas (`svg\+xml`) en todos los shards (Alto, corregido)

`STOREFRONT_STORAGE_RULES` usaba `svg\+xml` (escape con backslash) que **el parser de
Firebase Rules API rechaza** (400 "Request contains an invalid argument") — el paso de
deploy fallaba silenciosamente y **ningún shard provisionado por la plataforma tenía
storage rules** (uploads rotos o comportamiento por defecto). Corregido con
`svg[+]xml` (clase de caracteres, válida) en la plataforma y en `storefront/storage.rules`,
y **redesplegado a los 8 shards de dev** con `complete-shards.ts --fix-rules`.

### ✅ Corregido en esta auditoría (2ª pasada)

- **O15** `complete-shards.ts` (nuevo): recicla huérfanos con las credenciales owner
  (Secret Manager), con GATE de registro (solo si billing+Firestore+webApp+rules OK),
  `--fix-rules`, `--backfill-billing` (atribución real de billing por shard — cierra O3).
- **O16** Atribución de billing: 7 de 8 shards dev tienen `billingAccountId` real
  (backfill verificado contra GCP); `c3732d17` genuinamente sin billing.
- **O17** Hardening S2 aplicado en ambos repos (platform + storefront): un claim
  `admin` sin `tenantId` ya no tiene acceso por defecto en `isStoreAdmin` (firestore y
  storage); paridad verificada con `validate:rules`.
- **O18** S5 aplicado: JWKS de GitHub OIDC con TTL de 1h (antes cacheadas para siempre).
- **O19** Verificación de redirect URIs refinada: distingue `redirect_uri_mismatch`
  real de las páginas de consentimiento sin sesión (los checks anteriores daban
  falsos positivos/negativos headless).

## Pendientes de consola (usuario)

1. Aumentar cuota de proyectos GCP (O2).
2. **Aumentar cuota de billing por cuenta** (O13) — pedido a Google.
3. Verificar/borrar huérfanos (O1) — los 9 `ACTIVE` restantes y los 5 `DELETE_REQUESTED`.
4. **Registrar 5 redirect URIs pendientes** (dev): `vtx-sd-3am2uj4h`, `vtx-sd-3z5twz4j`,
   `vtx-sd-5792sth2`, `vtx-sd-aia7f0ao`, `vtx-sd-qncajqrx`:
   `https://console.cloud.google.com/apis/credentials?project=ecommerce-vertex-dev`
   → client `988454979046-jnb1sj6boknturojkohr8peha3lgevtr.apps.googleusercontent.com`
   → Authorized redirect URIs → `https://<shard>.firebaseapp.com/__/auth/handler`.
5. Correr `audit-shards.ts` en prod con credenciales prod para cruzar huérfanos.
