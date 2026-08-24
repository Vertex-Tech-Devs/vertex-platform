# Registro de Deuda Técnica Controlada

> Actualizado: release v0.6.1 — estable para producción. Las entradas listadas aquí están
> deliberadamente **no refactorizadas** para garantizar **cero regresiones** en este release.

## 1. `store-detail.ts` (~887 líneas) — componente monolítico

- **Estado**: mantenido como componente monolítico probado para el release v0.6.1.
- **Justificación de estabilidad**: es el componente más crítico del panel (orquestación GCP,
  versiones, dominios, staff, historial). Una refactorización en esta corrida expone riesgo de
  regresión en producción sin beneficio funcional.
- **Plan**: refactorización modular en subcomponentes en el **sprint v0.7.0**:
  - `store-detail-header`
  - `store-detail-domains-tab`
  - `store-detail-staff-tab`
  - `store-detail-orchestration.service` (ya extraído parcialmente en `services/`)
- **Criterio de aceptación del refactor**: los 137+ tests del platform deben pasar sin cambios
  de comportamiento y el build de producción debe quedar idéntico en funcionalidad.

## 2. Coverage de tests

- **Storefront**: Statements Coverage ~78.4% (objetivo hook ≥85%). Los módulos
  `@angular/fire/firestore` no son mockeables con jasmine/Karma (exports ESM no-writable), por
  lo que los specs se enfocan en servicios delegados (FirestoreService), pipes y componentes
  con servicios mockeados. Meta: subir a ≥85% con infraestructura de test adicional (jest + mocks
  de firebase) en v0.7.0.
- **Platform**: Statements ~90% / Branches ~77-81% — cumple los umbrales del CI
  (85/80/80/85).

## 3. Otras deudas menores

- `getActiveStores` no expone `templateVersion` (el filtro "latest" se basa en `autoUpdate`).
- El deploy de rules a shards nuevos depende del job `deploy-infra` (ya automatizado).
- La cuota de proyectos GCP es un límite externo: documentado en `docs/shards-pool.md`.
