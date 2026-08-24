# Vertex Platform — Notas de Agente (v0.6.x)

- **Fleet Deploy (lógica de negocio)**: el workflow `deploy-all-stores-dev.yml` (ecommerce-vertex)
  separa **Hosting** (solo tiendas `autoUpdate=true` = "latest", canary + rest) de **Infra de
  shard** (`firestore.rules`, índices, Cloud Functions — SIEMPRE a todos los shards activos vía
  el job `deploy-infra`). Disparo por `workflow_dispatch` (sin `on: push` para evitar carreras).
- **Shards & auto-healing**: capacidad estándar ~35 tiendas/shard; `ensureWarmShardAvailable`
  pre-aprovisiona shards (WARM_SHARD_TARGET); ante shards inactivos se crean nuevos y se
  aprovisionan secretos SMTP. La alerta de pool bajo (≤2) notifica por email + banner in-app.
- **Motor de rubros**: módulos en `verticals/presets/` con registro lazy `verticals.registry.ts`
  y modos de aprovisionamiento `EMPTY` / `CATALOG_ONLY` / `FULL_DEMO` (selector de 21+ rubros).
- **Convención web app**: `vtx-${slug}-${uniqueSuffix}` para prevenir bloqueos de 30 días de GCP.
- **Seed de emails**: SIEMPRE usar el `ownerEmail` real (nunca placeholders `admin@<slug>`).
- **Deuda técnica**: ver `docs/tech-debt.md` (store-detail.ts NO refactorizar antes de v0.7.0).
