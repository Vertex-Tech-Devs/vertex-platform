# Changelog — vertex-platform

## [0.9.0] - 2026-09-09

### Added
- Gestión dinámica de subdominios `.web.app` con disponibilidad en tiempo real y sugerencias.
- Monitor de logs con orígenes (`tienda`/`platform`), severidades completas (incl. `jsonPayload` y crash stacks).
- Centro de Alertas agrupado por tienda y tipo; alertas SMTP críticas; reconciliador automático de órdenes (60 min).
- Soporte HEIC/HEIF → WebP (storefront) y borrado de clientes/pedidos con auditoría desde el admin de la tienda.

### Refactored
- Desacople modular de `store-detail`: contenedor de 1264 → 634 líneas.
  - `store-detail-domains` (tab Dominios + modales).
  - `StoreDetailPaymentsService` (estado compartido para el badge MP de la tab bar) + `store-detail-payments`.

### Fixed
- Modales de dominios desanidados de `showEditModal` (se mostraban de forma incorrecta).
- Deliverabilidad SMTP (From autenticado, SPF/DKIM).
- Deducción atómica de inventario y estados finales de orden (`CANCELLED_UNPAID`).

### Changed
- Aplicación de reglas de contenido "B" y lenguaje de negocio en la plataforma (menos densidad, una pregunta por tarjeta).
