# Shards Pool — Operación y Runbook

## Modelo

- **Shard** = proyecto GCP/Firebase `vtx-sd-*` que aloja hasta **35 tiendas**
  (`DEFAULT_MAX_STORES_PER_SHARD`). Es la unidad de capacidad compartida.
- **Pool** = conjunto de shards disponibles (`WARMUP_READY` o `ACTIVE` con cupo).
- Al crear una tienda, el aprovisionamiento la asigna a un shard del pool sin configuración.
- **Los shards nunca se eliminan del pool** al vaciarse (opt-in `DELETE_EMPTY_SHARDS='true'`).

## Billing accounts vs shards (no son lo mismo)

Son dos límites **distintos y complementarios**:

| Concepto            | Qué es                                                                                                                      | Dónde se configura                                          | Relación con las tiendas                                                                                                                                                                    |
| ------------------- | --------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Billing account** | Cuenta de facturación GCP (`billingAccounts/{id}`, ej. `016AC2-…`). Paga los servicios de los proyectos que se le vinculan. | Panel → Settings → Facturación (`billing.ts`)               | Campo `maxProjects` = **tope autoimpuesto de proyectos GCP** que la plataforma le asigna (default 15). `pickBillingAccount()` elige la cuenta con más cupo restante (`maxProjects − used`). |
| **Shard**           | Proyecto GCP/Firebase `vtx-sd-*` del pool, con cupo para **35 tiendas** (`maxCapacity`).                                    | `infrastructure_shards` / scheduler / `provision-shards.ts` | El límite de un shard es por **tiendas** (35), no por proyectos.                                                                                                                            |

**La conexión:** cada shard es un **proyecto GCP** y, como tal, debe estar vinculado a una
billing account. Entonces:

- `maxProjects` de una billing account limita **cuántos proyectos (shards) pueden pagarse con esa cuenta**.
- El límite de un shard limita **cuántas tiendas aloja ese proyecto** (35, tope físico de Firebase Hosting).

Ejemplo real (dev): `Vertex Dev Billing 1` y `2` con `maxProjects=10` c/u ⇒ capacidad de
**20 proyectos/shards** de facturación. El pool de shards puede crecer hasta ese tope antes de
necesitar una billing account nueva o subir el `maxProjects` de una existente.

**En corto:** “máximo de proyectos por cuenta” = cuántos shards puede **pagar** esa cuenta;
“límite de shards” = cuántos proyectos `vtx-sd-*` dejamos **pre-configurados en standby** para
no crearlos a mano (hoy `WARM_SHARD_TARGET=10`). No hay que confundirlos: uno es financiero,
el otro es de capacidad operativa. El GCP además tiene su propia cuota global de creación de
proyectos (ver “Cuota de proyectos GCP” abajo), que es el tope físico que termina mandando.

## Mantenimiento automático (scheduler)

`checkWarmShardBuffer` (pubsub, cada 6h, UTC):

1. Purgua registros stale (`FULL` con 0 tiendas y >24h; `WARMUP_PROVISIONING` colgado
   > 12h con 0 tiendas).
2. Provisiona shards hasta mantener **`WARM_SHARD_TARGET`** (default **10**, configurable
   por entorno) calientes (`WARMUP_READY`), abortando el ciclo tras 2 fallos seguidos
   (cuota) para no contaminar el pool.
3. Dispara la **alerta de pool bajo** (`checkPoolLowAndAlert`, umbral `POOL_LOW_THRESHOLD`,
   default **2**) cuando quedan ≤2 disponibles: email al admin + banner in-app
   (`system_alerts/pool_low_{env}`), dedupe 24h. El email incluye el comando exacto
   para reponer **10 de un tirón**.

## Scripts de expansión y auditoría

```bash
# Desde vertex-platform/scripts (o raíz del repo):
npx tsx scripts/provision-shards.ts --count 10 --env dev      # crea 10 shards nuevos
npx tsx scripts/provision-shards.ts --target 10 --env dev     # crea los que falten hasta 10 totales en el pool
npx tsx scripts/provision-shards.ts --count 10 --env prod --verify   # crea + verifica redirect URIs

# Auditoría del pool (huérfanos GCP + redirect URIs de TODOS los shards):
npx tsx scripts/audit-shards.ts --env dev
npx tsx scripts/audit-shards.ts --env prod
```

`--target N` es la forma recomendada (la usa la alerta): consulta el pool y crea solo el
delta. El script crea proyectos `vtx-sd-*` completos: proyecto + facturación (auto desde
una cuenta abierta) + Firebase + APIs + Firestore NATIVO + Storage/CORS + web app +
Identity Platform + Google IdP (clientId del master) + authorizedDomains + **rules del
storefront (firestore + storage, las reales de la plataforma)** + registro en
`infrastructure_shards` (`WARMUP_READY`). Detecta cuota agotada y aborta limpio.

### Único paso manual (Google no expone API)

Al final el script imprime los **redirect URIs** a registrar en Google Cloud Console
(client OAuth del master `988454979046-jnb1sj6boknturojkohr8peha3lgevtr.apps.googleusercontent.com`):

```
https://<shard>.firebaseapp.com/__/auth/handler
```

(una vez por shard — por eso el script lo lista; el login de la primera tienda del shard
lo requiere). Verificable en cualquier momento con `audit-shards.ts` (marca ✅/❌ por
shard del pool, incluidos los que aún no tienen tiendas).

### Credenciales

El script necesita un ADC con permisos de **owner/editor** y **billing** sobre el entorno
destino (el ADC personal no puede vincular billing en proyectos nuevos — los shards se
crean normalmente con las credenciales owner del platform vía el scheduler). Si la
creación de proyectos falla con `exceeded your allotted project quota`, ver la sección
siguiente y `docs/multitenant-audit.md` (O1/O2: huérfanos + cuota).

## Verificación del pool

```bash
# Estado completo: pool registrado + huérfanos GCP + redirect URIs pendientes
npx tsx scripts/audit-shards.ts --env dev
npx tsx scripts/audit-shards.ts --env prod
```

## Eliminación de tiendas y cupo

`deleteStore` borra **todo** (datos del shard por storeId, hosting, docs de la plataforma),
libera el cupo (`currentStores--`) y voltea `FULL → ACTIVE` si baja del máximo. El shard
queda disponible para nuevas tiendas.

## Dormir tiendas (pagos)

`suspendStore`/`activateStore` — ver "Ciclo de vida de una tienda" en `docs/development.md`.

> ⚠️ Los shards del pool deben registrarse con `environment` = **`development`** (dev)
> o **`production`** (prod) — el monitor y el scheduler filtran por
> `resolvePlatformEnvironment()`. El script `provision-shards.ts` ya lo hace.

## Requisito previo: cuota de proyectos GCP

Cada shard es un **proyecto GCP**. Google limita cuántos proyectos podés crear
(cuota por organización/usuario — default típico ~12). Al alcanzarla, la creación de
shards falla con `The project cannot be created because you have exceeded your allotted
project quota` (el scheduler lo detecta y aborta el ciclo para no contaminar el pool).

**Cómo aumentarla (una vez, en Google Cloud Console):**
`IAM y administración → Cuotas → buscar "Project quota" (o "Quota of 'Project Count'")
→ Editar → Solicitar aumento` (ej. 50). Aplica en minutos.

Con cuota disponible, el scheduler (cada 6h, `WARM_SHARD_TARGET=10`) y el script
`provision-shards.ts --target 10` crean los shards restantes hasta el objetivo.

## Estado actual (dev, 2026-08-14)

- Pool registrado: **5** shards (2 `WARMUP_READY`, 1 `WARMUP_PROVISIONING`, 2 `ACTIVE`).
- **17 proyectos GCP huérfanos** (12 `ACTIVE`) sin doc en el pool → consumen la cuota y
  la tienen **agotada** hoy. Ver `docs/multitenant-audit.md` (O1/O2) antes de expandir.
- **2 redirect URIs pendientes** en el pool actual: `vtx-sd-3am2uj4h`, `vtx-sd-h8hhzl94`.
  Registrarlos en la consola (paso manual) para que el pool quede login-ready.
