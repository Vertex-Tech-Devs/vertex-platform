# Shards Pool — Operación y Runbook

## Modelo

- **Shard** = proyecto GCP/Firebase `vtx-sd-*` que aloja hasta **35 tiendas**
  (`DEFAULT_MAX_STORES_PER_SHARD`). Es la unidad de capacidad compartida.
- **Pool** = conjunto de shards disponibles (`WARMUP_READY` o `ACTIVE` con cupo).
- Al crear una tienda, el aprovisionamiento la asigna a un shard del pool sin configuración.
- **Los shards nunca se eliminan del pool** al vaciarse (opt-in `DELETE_EMPTY_SHARDS='true'`).

## Mantenimiento automático (scheduler)

`checkWarmShardBuffer` (pubsub, cada 6h, UTC):
1. Purgua registros stale (`FULL` con 0 tiendas y >24h).
2. Provisiona shards hasta mantener **`WARM_SHARD_TARGET`** (default **8**) calientes
   (`WARMUP_READY`), máx 3 por run — así el pool total supera 10 (8 calientes + ACTIVE).
3. Dispara la **alerta de pool bajo** (`checkPoolLowAndAlert`) cuando quedan ≤2 disponibles:
   email al admin + banner in-app (`system_alerts/pool_low_{env}`), dedupe 24h.

## Script de expansión guiada

```bash
# Desde vertex-platform/functions (resuelve google-auth-library):
npx tsx ../scripts/provision-shards.ts --count 10 --env dev
npx tsx ../scripts/provision-shards.ts --count 10 --env prod
```

Crea N proyectos `vtx-sd-*` completos: proyecto + facturación (auto desde un shard
existente) + Firebase + APIs + Firestore NATIVO + Storage/CORS + web app + Identity
Platform + Google IdP (clientId del master) + authorizedDomains + rules + registro en
`infrastructure_shards` (`WARMUP_READY`).

### Único paso manual (Google no expone API)

Al final el script imprime los **redirect URIs** a registrar en Google Cloud Console
(client OAuth del master `988454979046-jnb1sj6boknturojkohr8peha3lgevtr.apps.googleusercontent.com`):

```
https://<shard>.firebaseapp.com/__/auth/handler
```

(una vez por shard — por eso el script lo lista; el login de la primera tienda del shard
lo requiere).

### Credenciales

El script necesita un ADC con permisos de **owner/editor** y **billing** sobre el entorno
destino (el ADC personal no puede vincular billing en proyectos nuevos — los shards se
crean normalmente con las credenciales owner del platform vía el scheduler).

## Verificación del pool

```bash
# Estado de los shards del entorno
firestore .../infrastructure_shards  # status, currentStores/maxCapacity
```

## Eliminación de tiendas y cupo

`deleteStore` borra **todo** (datos del shard por storeId, hosting, docs de la plataforma),
libera el cupo (`currentStores--`) y voltea `FULL → ACTIVE` si baja del máximo. El shard
queda disponible para nuevas tiendas.

## Dormir tiendas (pagos)

`suspendStore`/`activateStore` — ver "Ciclo de vida de una tienda" en `docs/development.md`.
