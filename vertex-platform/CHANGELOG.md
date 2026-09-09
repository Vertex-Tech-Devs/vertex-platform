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
- Badge de Equipo en detalle de tienda: ahora cuenta estrictamente usuarios activos confirmados (`staff().length`) en lugar de incluir invitaciones pendientes.
- CORS e IAM en `checkSubdomainAvailability`: exportación explícita en `index.ts` y whitelist `ALLOWED_ORIGINS` para solicitudes seguras sin 403.
- Monitor de logs: compatibilidad de consultas Cloud Logging con Cloud Run Gen 2 (`resource.type=("cloud_run_revision" OR "cloud_function")`), ventana por defecto de 48 horas (2880m) con selector ampliado a 7 días y fallback automático a `audit_logs` en Firestore ante cuotas o falta de eventos.
- Manejo defensivo en frontend para chequeo de subdominios: mensaje claro y amigable ante errores internos o de conectividad.

### Changed
- Aplicación de reglas de contenido "B" y lenguaje de negocio en la plataforma (menos densidad, una pregunta por tarjeta).
- Matriz de actualización segura (Dev vs Prod & Auto vs Manual): las tiendas de desarrollo en `develop` solo se despliegan automáticamente si `autoUpdate === true` y `environment === 'development'`; las tiendas de producción quedan blindadas contra ramas inestables.
- Flujo de actualización manual en cabecera de tienda y pestaña de Orquestación: detección proactiva de actualizaciones disponibles contra el último release de plantilla con badge informativo `Actualización disponible (v...)` y acción directa de actualización.

