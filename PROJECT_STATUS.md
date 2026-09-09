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
- Purga masiva por tienda (pedidos/clientes/catálogo/contenido) filtrada por tenant, sin tocar configuración/credenciales.
- Borrado puntual de cliente (email) y pedido (orderId) con auditoría en `admin_audit` y restock automático.
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

## 🔲 Pendiente / deuda técnica conocida (no tocar sin plan)
1. **Refactor estructural de `store-detail`**: descomponer en `store-detail-domains` y `store-detail-payments` (hoy `max-lines` está mitigado con directiva ESLint local; no se hizo para no romper nada).
2. **Alerts**: entregado in-app + email críticos; falta (opcional) UI “ver todas las tiendas” global del Monitor.
3. **HEIC**: soportado en subida central; falta validar galerías/logos/banners heredadas con UI propia que llame a `prepareUploadFile` explícitamente si no pasan por `StorageService`.
4. Pulido fino continuo de vistas (por naturaleza iterativo; sin tickets abiertos críticos).

## Reglas operativas vigentes
- Prohibido tocar `"version"` en `package.json` salvo indicación explícita del dueño.
- Sincronización: `develop` = `main` con 0 divergencia al cerrar cualquier entrega.
- Gates: typecheck/lint/build + suites (platform app+functions; storefront app+functions) con cobertura ≥95%.
- Ramas de deploy monitoreadas hasta `success`.

## Tiendas entregadas (producción real)
- `kasakalle` (KasaKalle) y `vidrios-emilia` (Vidrios Emilia). El resto son entornos de prueba/dev y están pendientes de eliminación por el dueño.
## 🎨 Refinamiento de contenido (paquete A+B+11+12) — en curso
- ✅ Header minimal (consola solo en Diagnóstico) · Info general minimal (slug/canal a Diagnóstico) · Acciones de Orquestación agrupadas (Mantenimiento / Riesgo) · Textos de Pagos/Suscripción en 1 línea · Placeholders con ejemplos claros.
- ✅ Monitor: logs completos (jsonPayload, crash stacks, errores sin tenant), fuente platform incluida y badge de origen por fila.
- ✅ Centro de Alertas agrupado por tienda y tipo.
- 🔲 Continuar reglas B por vista (menos densidad, “una pregunta por tarjeta”) como iteración continua.
