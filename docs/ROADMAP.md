# ROADMAP — Vertex Platform (`vertex-platform`)

Hoja de ruta y objetivos para el plano de control central SaaS.

---

## 🎯 Próximos Hitos (v0.9.0 - v1.0.0)

### 1. Gestión de Shards & Multi-Cloud
- [ ] **Migración Dinámica entre Shards**: Mover tiendas activas entre proyectos de Google Cloud sin tiempo de inactividad.
- [ ] **Métricas Centralizadas de Uso**: Dashboard global de consumo de Firestore, Storage y ancho de banda por tienda y por shard.

### 2. Facturación & Suscripciones (SaaS Billing)
- [ ] **Planes y Suscripciones Recurrentes**: Cobro automatizado a dueños de tiendas vía Mercado Pago Suscripciones / Stripe Billing.
- [ ] **Límites por Plan**: Cuotas máximas de productos, almacenamiento y staff según el nivel de suscripción contratado.

### 3. Automatización de Operaciones
- [ ] **Rollback con 1 Clic**: Reversión instantánea a la versión previa de una tienda ante incidencias.
- [ ] **Auditoría Avanzada de Seguridad**: Detección de anomalías en inicios de sesión y exportación de logs de cumplimiento.
