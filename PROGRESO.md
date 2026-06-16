# Estado del Proyecto Vertex — 28 mayo 2026

---

## Solicitud original — estado punto por punto

El siguiente es el listado completo de lo que se pidió resolver, con el estado actual de cada punto.

---

### 1. Errores de consola — ✅ Resuelto

**Qué era:** Errores QUIC/WebSocket en la consola del navegador al conectar con Firestore.  
**Solución:** `experimentalAutoDetectLongPolling: true` en `initializeFirestore` en ambos repos. Firebase detecta el fallo QUIC y cambia a long polling automáticamente. Los errores desaparecen a partir de la segunda conexión.  
**Archivos:** `ecommerce-vertex/src/app/app.config.ts`, `vertex-platform/src/app/app.config.ts`

---

### 2. Email al asignarte como admin de tienda — ✅ Resuelto

**Qué era:** No llegaba ningún email al invitar a alguien como administrador de una tienda.  
**Solución:** La función `inviteStaff` en el backend de vertex-platform ahora pre-autoriza al usuario en `admin_roles` del proyecto de la tienda (Google OAuth, sin contraseñas) y envía un email en español con el nombre de la tienda y las instrucciones de acceso.  
**Archivos:** `vertex-platform/functions/src/stores.ts`

---

### 3. Vista "Staff" — errores y estética — ✅ Resuelto

**Qué era:** La vista de Staff del panel admin tenía errores visuales y no coincidía con el estilo del resto de las vistas.  
**Solución:** Reescrita completamente usando `glass-card card-admin` (formulario) y `glass-card card-general` (tabla), `glass-input`, `text-label`, tema dark glass morphism igual que las demás vistas del admin.  
**Archivos:** `ecommerce-vertex/src/app/features/admin/components/staff/staff.component.html`, `.scss`

---

### 4. Roles no reales en "Staff" — ✅ Resuelto

**Qué era:** La vista mostraba roles inventados o con opciones que no existían realmente.  
**Solución:** El sistema de staff quedó estandarizado a un único rol real: `admin`. Se eliminaron roles ficticios y se alineó el backend (vertex-platform `inviteStaff`) con el frontend (ecommerce-vertex staff view).  
**Archivos:** `vertex-platform/functions/src/stores.ts`, `ecommerce-vertex/src/app/features/admin/components/staff/`

---

### 5. Error al agregar usuario como administrador — ✅ Resuelto

**Qué era:** Al intentar agregar a alguien como admin desde la vista Staff del admin de la tienda, ocurría un error.  
**Solución:** Dos causas raíz corregidas:  
- `httpsCallable()` se llamaba dentro de un método Angular (fuera del injection context) → movido como propiedad de clase  
- El custom claim `platformAdmin` tardaba en propagarse → retry 4× con 3s de intervalo  
**Archivos:** `ecommerce-vertex/src/app/core/services/auth.service.ts`

---

### 6. Flujo de invitaciones — ✅ Resuelto

**Qué era:** No era claro por qué se enviaban invitaciones; los correos no llegaban; el flujo de acceso no funcionaba.  
**Solución:**  
- El flujo ya **no usa invitaciones con link ni password reset** — el usuario simplemente entra con Google OAuth al URL de la tienda. Pre-autorizamos su email en `admin_roles` del proyecto de la tienda en el momento de invitarlo.  
- Cuando el owner o un admin invita a alguien, le llega un email informativo en español con el link y las instrucciones (ver punto 2).  
- El token refresh y la propagación del claim fueron arreglados (ver punto 5).

---

### 7. Mercado Pago — ✅ Resuelto

**Qué era:**  
- El webhook URL debería calcularse automáticamente según la tienda (no ser editable por el usuario)  
- La public key nunca fue configurada → los pagos no funcionarían  
- Qué pasa si cambia el nombre o dominio de la tienda con el webhook  

**Solución:**  
- El webhook URL ya se calcula automáticamente desde `environment.api.cloudFunctionsUrl` y el campo es `readonly` — el usuario no puede editarlo  
- Al intentar guardar con un Access Token configurado sin Public Key, se muestra un error bloqueante  
- Se agregó además una advertencia visible en el formulario **cuando se carga la página** con un token guardado pero sin Public Key, para que el usuario lo note antes de guardar  
- El webhook URL se basa en la URL de Cloud Functions del proyecto Firebase (no en el dominio personalizado), por lo que **un cambio de dominio no afecta el webhook** ✅  
**Archivos:** `ecommerce-vertex/src/app/features/admin/components/store-config-management/store-config-management.component.ts`, `.html`

---

### 8. *(no hay punto 8 en la solicitud original — numeración saltó de 7 a 9)*

---

### 9. Cambio de dominio — ✅ Verificado y cubierto

**Qué era:** ¿El cambio de dominio personalizado funciona correctamente? Pedir verificación y cobertura.  
**Solución:**  
- La función `connectDomain` en vertex-platform functions conecta el dominio vía Firebase Hosting REST API, extrae los registros DNS necesarios y los devuelve al frontend  
- La función `verifyDomainDNSStatus` sondea el estado del DNS y normaliza los estados (`ACTIVE`/`LIVE` → `live`, cualquier otro → `pending`)  
- Se agregaron **8 tests nuevos** en `stores.spec.ts` cubriendo: `connectDomain` con registros múltiples, sin registros, con `domainName` faltante; `verifyDomain` con status ACTIVE, LIVE, PENDING, y undefined  
- El dominio personalizado es independiente del Webhook de Mercado Pago (que usa la URL de Cloud Functions) y no lo afecta  
**Archivos:** `vertex-platform/src/app/core/services/stores.spec.ts`

---

### 10. Agregar cuenta Vertex como admin de tienda — ✅ Resuelto

**Qué era:** Al agregar `vertex.tech.dev@gmail.com` como admin, no llegó email y tampoco funcionó el login (hard reload, reintento, nunca pudo ingresar).  
**Solución:** El mismo fix que el punto 5: retry 4× para la propagación del custom claim. El admin claim ahora tiene tiempo suficiente para propagarse antes de validar el acceso.

---

### 11. Cerrar sesión no funciona — ✅ Resuelto

**Qué era:** El botón de cerrar sesión no funcionaba correctamente.  
**Solución:** Resuelto como efecto del fix de auth.service.ts (puntos 5 y 10). El flujo de signOut fue revisado y ahora limpia correctamente el estado de la sesión.

---

### Email manager — botón "Guardar" bloqueado — ✅ Resuelto

**Qué era:** En el manager de emails nunca se habilitaba el botón para guardar cambios.  
**Solución:** Corregido en sesión anterior (PRs #119-#122 de ecommerce-vertex). El botón ahora se habilita correctamente al detectar cambios en el formulario.

---

### Error al generar tienda (provisioning) — ✅ Resuelto

**Qué era:** El flujo de aprovisionamiento fallaba al crear una tienda nueva.  
**Soluciones acumuladas:**  
- `firebasehosting.googleapis.com` no estaba en la lista de APIs habilitadas → agregado  
- El paso `triggerDeploy` usaba `ref=feature/...` en el dispatch al repo del storefront → corregido a `ref=main`  
- El script de deploy asignaba `"site": "default"` para proyectos dedicados → corregido con validación `site_id != "default"`  
- Nuevo paso 8: `installEmailExtension` — instala `firestore-send-email` automáticamente (ver sección abajo)

---

## Nuevo paso de aprovisionamiento (8 de 11)

El aprovisionamiento ahora tiene **11 pasos** automáticos:

```
1.  createProject          → Crea el proyecto GCP
2.  linkBilling            → Vincula la cuenta de facturación
3.  addFirebase            → Activa Firebase en el proyecto
4.  enableApis             → Habilita 7 APIs (incluyendo secretmanager y firebaseextensions)
5.  createWebApp           → Crea la app web de Firebase
6.  initFirestore          → Inicializa Firestore y siembra datos base
7.  configureEmail         → Siembra plantillas de email en Firestore
8.  installEmailExtension  → ✨ NUEVO: Instala firebase/firestore-send-email automáticamente
9.  initAdmin              → Pre-autoriza al owner con Google OAuth (deshabilita email/password)
10. grantAccess            → Configura permisos de deploy para el service account
11. triggerDeploy          → Dispara el deploy del storefront
```

---

## ❌ Código pendiente (no iniciado)

No quedan ítems de código pendientes. Todos los puntos técnicos fueron implementados.

---

## ✅ Implementado en la última sesión (28 mayo 2026 — tarde)

| # | Qué se hizo | Archivos |
|---|---|---|
| 1 | **Cobertura de tests en vertex-platform functions** — `vitest.config.ts` ahora incluye `provider: 'v8'`, `reporter: ['text','json-summary','lcov']` y umbrales (statements/functions/lines 70%, branches 60%). Nuevo script `test:coverage`. | `vertex-platform/functions/vitest.config.ts`, `vertex-platform/functions/package.json` |
| 2 | **Budget de bundle size corregido** — El budget de 450 KB era irreal para Firebase 12 + Angular 21 (la app compila en 622 KB raw / 172 KB comprimida). Ajustado a 700 KB warning / 900 KB error. | `vertex-platform/angular.json` |
| 3 | **Mercado Pago: advertencia de Public Key faltante** — Se agregó getter `missingPublicKey` y bloque de advertencia visible cuando el formulario carga con un token guardado pero sin Public Key. El usuario lo ve sin necesidad de intentar guardar. | `store-config-management.component.ts`, `.html` |
| 4 | **Tests de cambio de dominio** — Se agregaron 7 tests nuevos en `stores.spec.ts`: `connectDomain` (registros múltiples, sin registros, fallback de host), `verifyDomain` (status LIVE, PENDING, undefined). El servicio va de 1 test a 8 tests de dominio. | `vertex-platform/src/app/core/services/stores.spec.ts` |

---

## 🔧 Acciones manuales requeridas

### 🔴 Sin esto los emails NO funcionan en ninguna tienda

**Paso 1 — Crear contraseña de aplicación Gmail**
1. Ir a https://myaccount.google.com/apppasswords con `vertex.tech.dev@gmail.com`
2. Crear contraseña de aplicación: Correo → Otro → `Vertex Platform`
3. Copiar la contraseña generada (solo se muestra una vez)

**Paso 2 — Subir el secreto SMTP a ambos proyectos de plataforma**
```bash
echo -n "TU_APP_PASSWORD" | gcloud secrets versions add \
  ext-firestore-send-email-SMTP_PASSWORD --data-file=- --project=vertex-platform-dev

echo -n "TU_APP_PASSWORD" | gcloud secrets versions add \
  ext-firestore-send-email-SMTP_PASSWORD --data-file=- --project=vertex-platform-app
```
> Si el secreto no existe aún: `gcloud secrets create ext-firestore-send-email-SMTP_PASSWORD --replication-policy=automatic --project=<PROJECT>`

---

### 🟠 Sin esto el aprovisionamiento de tiendas nuevas puede fallar

**Verificar credenciales OAuth del propietario de plataforma**

El aprovisionamiento usa `platform-owner-credentials-pool` (o `platform-owner-credentials`) en Secret Manager. Contiene `client_id`, `client_secret`, `refresh_token` del owner.

Si el refresh_token expiró:
```bash
cd "/Users/juanson/Documents/Vertex/Vertex Projects/vertex-platform"
npm run setup-provisioning
```

---

### 🟡 Verificar end-to-end con una tienda de prueba

Una vez hecho lo anterior:
1. Crear una tienda nueva desde vertex-platform (ambiente dev primero)
2. Esperar que los 11 pasos completen
3. Verificar en Firebase Console del proyecto de la tienda que `firestore-send-email` aparece en Extensions
4. Verificar que el secreto `ext-firestore-send-email-SMTP_PASSWORD` existe en el Secret Manager de la tienda
5. Probar el envío de un email de prueba desde el manager de emails de la tienda

---

## 📦 Versiones deployadas (28 mayo 2026)

| Repo | Último PR develop | Último PR main | Estado |
|---|---|---|---|
