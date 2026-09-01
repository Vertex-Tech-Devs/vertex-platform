# CHANGELOG — Vertex Platform (`vertex-platform`)

Registro de cambios del plano de control SaaS y panel administrativo central.

---

## [0.8.0] - 2026-09-01

### ✨ Características Principales
- **Sincronización de Versión de Plantilla (`v0.8.0`)**: Actualización de `CURRENT_TEMPLATE_VERSION` para aprovisionar automáticamente tiendas con el nuevo esquema de administración y pagos reales.
- **Automatización CI/CD de Dependencias**: Inclusión de workflows de auto-merge para Dependabot con validación rigurosa de Quality Gate.
- **Resiliencia en Despliegue de Cloud Functions**: Mecanismo de fallback a procesamiento secuencial en batches ante saturación de cuota de despliegue en Google Cloud Functions.

---

## [0.7.0] - 2026-08-30
- Auditoría y aprovisionamiento automático de credenciales SMTP en Secret Manager para shards de tiendas.
- Optimización de suscripciones reactivas eliminando sondeos redundantes de estado a GitHub.
