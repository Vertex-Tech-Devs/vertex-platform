# Scalability Roadmap

## Modelo actual (desarrollo)

- **Shards compartidos**: proyectos `vtx-sd-*` con hasta **35 tiendas** cada uno
  (`DEFAULT_MAX_STORES_PER_SHARD = 35`). Cada shard se pre-aprovisiona en caliente
  (`ensureWarmShardAvailable`): proyecto GCP, facturación, Firebase, Firestore native,
  Storage + CORS, Identity Platform + Google IdP, rules + índices, API keys sin
  restricciones → estado `WARMUP_READY`.
- **Rotación**: cuando un shard llega a `FULL` (35 tiendas), el siguiente shard warm
  absorbe tiendas nuevas automáticamente.
- **Auth**: cada shard usa el clientId OAuth del master (configurado en `initAdmin`);
  el único paso manual es registrar el redirect URI del shard en la consola (una vez por
  shard, Google no expone API).

## Crecimiento

| Etapa | Capacidad | Notas |
|---|---|---|
| Shards compartidos | 35 tiendas × N shards | Automático (warm-up + rotación) |
| Tiendas dedicadas | 1 tienda = 1 proyecto | Flujo ya soportado (`runtimeMode: 'dedicated'` → authDomain del propio proyecto) — no desarrollado aún en la UI |

## Mejoras planificadas

1. **Automatizar el redirect URI** cuando Google exponga API (hoy: banner + script guiado).
2. **Tiendas dedicadas** desde la UI del panel (selección de modo por tienda).
3. **Observabilidad**: métricas de uso por shard (costo, cuota, latencia) en el panel.
4. **Política de datos**: export/backup por shard y retención de auditLog.
5. **Multi-región**: evaluar `europe-west1`/`southamerica-east1` para shards según la
   ubicación de las tiendas (hoy todo en `us-central1`).

## Límites conocidos

- Google no expone API para redirect URIs de client OAuth (limitación externa).
- 35 tiendas por shard es un tope conservador de operación; puede ajustarse en
  `DEFAULT_MAX_STORES_PER_SHARD` mientras el shard no supere las cuotas de Firestore/Auth.
