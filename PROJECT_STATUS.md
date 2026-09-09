# Vertex Platform — Estado del proyecto (corte 0.9.0)

> Documento vivo para futuros chats. Ante dudas, revisar este archivo antes de tocar código.

## ✅ Definitivo y funcional (probado / deployado en `main`)

### Flujo de pagos y órdenes (ecommerce-vertex)
- Stock se descuenta SOLO en webhook `approved` (transacción idempotente, no-negativo).
- Estados de orden: `PENDING_PAYMENT` (sin venta) → `processing`+`approved` (pagada) → `shipped/delivered`; rechazadas/canceladas/expiradas → `CANCELLED_UNPAID` (sin stock ni métricas).
- Preferencias vencidas se regeneran (sin links muertos).
- Webhook tolera `PERMISSION_DENIED` de secretos; usa el token REAL del shard; `notification_url` incluye `tenant` + `projectId`.
- Mails transaccionales salen con remitente SMTP autenticado (deliverabilidad; NO caen en spam por dominio no alineado).
- Clientes se registran/actualizan en el shard desde el webhook aprobado (sección Clientes del dashboard funcional).
- Ventas reales liquidadas de referencia: KasaKalle `4J26XEF7` (Juan) y `NHDTZM2M` (Lihue).

### Administración de datos (super admin / admins de tienda)
- **Borrado de datos se hace desde el ADMIN DE LA TIENDA** (clientes/pedidos con auditoría `admin_audit` y restock). La UI de limpieza/borrado en Platform se retiró en `a4c1768` (backends `purgeStoreData`/`deleteStoreDataItem` quedan por compatibilidad, sin UI).
- Admins de tienda (claim `admin` del tenant) y super admins (Juan/Lihue/Vertex) tienen estos permisos.

### Infraestructura / confiabilidad (vertex-platform)
- `sweepStoresOrdersReconcile` cada 60 min: cancela abandonadas (>25 h sin pago), restaura fantasmas legacy, backfill de clientes; resumen en `ops/reconcileRuns`.
- `triggerHealShards` (7 APIs + IAM) y watchdog de alertas cada 60 min (errores del flujo de pagos + tiendas en riesgo) → `alerts/{key}`.
- Alertas críticas → email institucional a admins (SMTP; no bloqueante si falta).
- Centro de Alertas global + campana con badge + alertas por tienda en Monitor.
- Monitor → logs por tienda (`getStoreLogs`, Cloud Logging, IAM `logging.viewer` otorgado).
- Reconciliador verificado en producción (ronda con 6 tiendas, 0 errores).

### Subdominios `.web.app`
- Sanitizador determinista + sugerencias (`hosting-subdomain.utils.ts`, spec 5/5).
- `checkSubdomainAvailability` (sites.get) y `updateStoreSubdomain` (crear sitio → clonar release → doc Firestore → borrar sitio viejo).
- UI en Dominios: editor con debounce 400 ms, disponibilidad, sugerencias y modal de cambio.

### Imágenes
- HEIC/HEIF → WebP (calidad 0.85) en `StorageService` (punto único de subida, import lazy `heic2any`); rutas no-HEIC intactas.

### UI / UX (platform)
- Tema dual Material 3 (claro/oscuro, toggle persistente) y tokens `--platform-*`.
- Rediseño M3 por vista: Tiendas, store-create, Suscripciones, Infraestructura, Equipo (store + plataforma), Shell/Navbar, Centro de Alertas, Monitor y store-detail (todas sus tabs: Orquestación, Equipo, Dominios + subdominio, Historial, Pagos/Suscripción, Monitor).
- Contraste del tema claro corregido (textos/bordes más fuertes y overrides por vista).

### Equipos / invitaciones
- Invitación nueva = PENDIENTE; pasa a Aceptada solo si el invitado inicia sesión post-invitación (`lastLoginAt >= createdAt`).
- Badge “Ya miembro” cuando el email ya es staff.

## 🔲 Pendiente / deuda técnica conocida
1. Reglas de contenido B (menos densidad/una pregunta por tarjeta) como iteración continua por vista.
2. Auditoría de textos “que no se entienden” por pantalla (se entrega lista antes de aplicar).

## ✅ Cierre refactor store-detail (836de41)
- `store-detail.ts`: 1264 → 634 líneas; `/* eslint max-lines: off */` eliminado.
- Subcomponentes standalone `store-detail-domains` y `store-detail-payments`; `StoreDetailPaymentsService` (`providedIn: 'root'`) compartido con el badge MP de la tab bar.

## 🔲 Deuda técnica residual (no bloqueante)
- Deduplicación de estilos SCSS entre `store-detail` y sus componentes hijos (hoy comparten `store-detail.scss` por referencia).
- Backends `purgeStoreData`/`deleteStoreDataItem` conservados **exclusivamente** para mantenimiento administrativo vía CLI/script (sin UI).


## 📦 Release: 0.9.0 (Producción)
- Versión cerrada y taggeada **v0.9.0**.