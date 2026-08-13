# Testing — Unified Guide

Cómo validar el producto completo antes de cada release.

## Repositorios

| Repo | Comando | Suite |
|---|---|---|
| `ecommerce-vertex` (storefront) | `npm run lint && npm run typecheck && npm test` | **210 tests** (Karma/ChromeHeadless, coverage ≥85%) |
| `ecommerce-vertex/functions` | `npm run build && npm test` | **9 tests** (Vitest) |
| `vertex-platform/vertex-platform` (panel) | `npm run lint && npm run typecheck && npm run build` | — |
| `vertex-platform/vertex-platform/functions` | `npm run build && npm test` | **43 tests** (Vitest) |

## Validación de reglas Firestore

```bash
cd vertex-platform && npx tsx scripts/validate-firestore-rules.ts
```

Verifica que las rules del platform conserven el catch-all `isPlatformAdmin()` y que las
del storefront mantengan la lectura pública + writes aislados. Corre en CI.

## Validación de OAuth redirect URIs

```bash
cd vertex-platform && npx tsx scripts/check-oauth-redirects.ts
```

Lista los shards con redirect URI faltante y la URL de la consola.

## Smoke tests de índices (Firestore)

Consulta compuestas en un shard (ej. `vtx-sd-w5f87ci9`) con `runQuery` contra
`products storeId+createdAt`, `orders storeId+orderDate`, `clients storeId+lastOrderDate`:
deben responder sin error de índice ni de permisos.

## Gates CI

- Ambos repos: CI en GitHub Actions ejecuta lint + typecheck + tests + build + security audit.
- `Deploy All Stores (Development)` re-despliega todas las tiendas (hosting + rules +
  índices + functions) a los shards y hace health check HTTP 200.
- CodeQL Security Analysis activo en ambos repos.
