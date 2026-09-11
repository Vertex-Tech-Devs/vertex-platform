# Changelog — vertex-platform

## [Unreleased]

### Fixed
- **Aislamiento Total del Estado de Despliegue por StoreId**: Banderas reactivas (`deployingStoreIds`, `localDeployErrors`, `userInitiatedDeployStoreIds`, `deploySessionTimestamps`, `dismissedDeployStoreIds`) e índices completamente aislados por `storeId` en `StoreDetailOrchestrationService` y `StoreDetail`. Mutar o iniciar un deploy en una tienda no altera botones, spinners ni barras de progreso en otras tiendas.
- **Gestión Segura de Suscripciones en Tiempo Real**: Cancelación y desuscripción activa (`deployHistorySub`) y limpieza estricta de snapshots al desmontar o alternar entre tiendas para prevenir filtración de eventos cruzados y fugas de memoria.

### Added
- **Refresco Manual y en Vivo de Releases de Storefront en Orquestación**:
  - Parámetro `{ forceRefresh?: boolean }` y TTL en memoria de 60s en Cloud Function `listTemplateVersions` para invalidar cachés y detectar tags recién creados (ej. `v0.9.1`) al instante.
  - Botón interactivo "🔄 Refrescar versiones" junto al selector de versiones de template en `store-detail` con animación reactiva de spinner y feedback durante la sincronización.

## [0.9.0] - 2026-09-09

### Added
- **UI del Monitor de Logs**: Selector de ventana temporal con presets (1h, 6h, 24h, 48h default, 7 días, Todo el historial y Rango personalizado con selectores de fecha Desde/Hasta), selector de origen y badges visuales específicos para `[ÓRDENES]`, `[SISTEMA]` y `[CLOUD]`.
- **Aislamiento Reactivo de Actualizaciones**: Estado `updatingStores = signal<Set<string>>(new Set())` aislado por `storeId` en `StoreDetailOrchestrationService`, eliminando banderas globales compartidas y evitando fugas de estado entre pestañas o tiendas.
- **Subdominios en Creación de Tienda (`store-create`)**: Autocompletado sugerido `vtx-[nombre]` con edición libre, prefijo visual `https://` y sufijo `.web.app`, comprobación en vivo con debounce (400ms), badges de disponibilidad y bloqueo de envío ante colisiones o palabras reservadas.
- **Motor SaaS Super Admin & Catálogo Global**: Consulta y edición de tarifas base en `system_config/billing` desde la plataforma sin redeploy (`getGlobalPlansPricing`, `updateGlobalPlansPricing`).
- **Prepaid Bridge (Pagos Manuales / Transferencias)**: Callable `setStorePrepaidCoverage` que fija cobertura con fecha de fin y notas de comprobante; transición fluida a débito automático en Mercado Pago vía `start_date` eliminando doble cobro.
- **Beneficios Especiales y Descuentos por Tienda (`PricingOverride`)**: Configuración Super Admin de precios fijos, % OFF o $ OFF con duración (lifetime, N ciclos, 1 ciclo) y previsualización de cálculo en vivo aplicada directamente a preferencias y cobros recurrentes de Mercado Pago.
- **Máquina de Estados de Suscripción**: Soporte robusto de estados (`trialing` 14 días, `legacy_prepaid`, `grace_period` de 5 días, `suspended`), con exención total para tiendas corporativas (`isExempt === true` / plan: 'internal').
- **Entregabilidad y Blindaje Antispam de Emails**: Correo transaccional de bienvenida al `ownerEmail` con remitente corporativo verificado (`Vertex Platform <notificaciones@vertex.tech>`), formato multipart (`html` + `text/plain`), cabeceras `List-Unsubscribe`, `Message-ID` y `X-Entity-Ref-ID`.
- **Ergonomía Responsive en Store Detail**: Pestañas touch con scroll horizontal `scroll-snap-type: x mandatory`, pills con `min-height: 44px`, `white-space: nowrap` y sticky navigation bar con blur glassmorphism.
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

