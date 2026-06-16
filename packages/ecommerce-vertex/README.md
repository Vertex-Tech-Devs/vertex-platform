# 🛒 Vertex Ecommerce

Plantilla de comercio electrónico para la tienda (storefront) y panel de administración (backoffice) de cada cliente en el ecosistema multi-tenant de Vertex.

Cada tienda cliente recibe un proyecto de Firebase aislado y dedicado con esta aplicación desplegada de forma automática. La aplicación lee dinámicamente la configuración específica del comercio desde la colección de Firestore (`settings/storeConfig`).

---

## 🚀 Inicio Rápido (10 minutos)

Sigue estos pasos para configurar e iniciar la aplicación localmente en tu entorno de desarrollo:

1. **Instalar dependencias:**
   Instala los paquetes tanto para la aplicación frontend de Angular como para el backend de Cloud Functions:
   ```bash
   npm install
   cd functions && npm ci && cd ..
   ```

2. **Iniciar el servidor local:**
   Levanta la aplicación Angular en modo de desarrollo:
   ```bash
   npm start
   ```

3. **Ejecutar validaciones de calidad (Quality Gates):**
   Asegúrate de que el formateo, los tipos y las pruebas unitarias pasan sin errores:
   ```bash
   npm run lint && npm run typecheck && npm run test:ci && npm run build
   ```

---

## 📁 Estructura del Proyecto

* **`src/app`**: Componentes Angular de la tienda (`shop/`) y del panel de administración (`admin/`), servicios del core y utilidades compartidas.
* **`functions/src`**: Funciones backend de Firebase (TypeScript), tales como la integración con pasarelas de pago y webhooks.
* **`cypress`**: Suite de pruebas de integración de punta a punta (E2E).
* **`integration-tests`**: Pruebas que validan la continuidad del ciclo de vida en conjunto con la plataforma principal.

---

## 🛠️ Tecnologías Principales

* **Frontend**: Angular 20+, señales (Signals), componentes independientes (Standalone) y SCSS.
* **Backend**: Firebase Cloud Functions v2 (TypeScript).
* **Base de datos e Integraciones**: Cloud Firestore y Firebase Authentication.
* **Pruebas y QA**: Vitest (pruebas unitarias), Cypress y Playwright (pruebas de integración).
* **CI/CD**: GitHub Actions.

---

## 💻 Comandos Útiles de Desarrollo

| Comando | Descripción |
|---------|-------------|
| `npm start` | Inicia el servidor de desarrollo en Angular (por defecto en `http://localhost:4200`) |
| `npm run lint` | Ejecuta el análisis estático de código (ESLint) |
| `npm run typecheck` | Ejecuta la verificación estricta de tipos de TypeScript |
| `npm run test:ci` | Corre las pruebas unitarias usando Chrome en modo headless |
| `npm run build` | Genera la compilación optimizada para producción |
| `npm run quality` | Ejecuta de manera consolidada linting, typecheck y pruebas unitarias |
| `npm run e2e` | Ejecuta las pruebas Cypress de punta a punta en modo headless |
| `npm run e2e:open` | Abre la interfaz interactiva de Cypress |

---

## 🔐 Acceso Admin de Tienda (Google OAuth-Only)

Desde mayo de 2026, el panel administrativo de tienda (`/admin/login`) acepta exclusivamente autenticación con Google OAuth.

Reglas operativas:

1. El correo debe estar preautorizado en Firestore (`admin_roles/{email}`).
2. El único rol operativo admitido para acceso al panel es `admin`.
3. Los custom claims se sincronizan automáticamente mediante Cloud Functions en alta de usuario y cambios de rol.
4. La vista Staff usa funciones callable (`getAdminStaff`, `upsertAdminStaff`, `revokeAdminStaff`) para evitar fallas de permisos por reglas cliente.

Errores comunes:

- `permission-denied`: el correo no está autorizado.
- `auth/unauthorized-domain`: el dominio usado para login no está en Firebase Auth > Authorized domains.
- `auth/popup-blocked`: el navegador bloqueó la ventana emergente de Google.

---

## 💳 Mercado Pago (Credenciales y Webhook)

Desde mayo de 2026, la URL de webhook en configuración de tienda se calcula automáticamente y no es editable en UI.

Reglas operativas:

1. `webhookUrl` se deriva de la URL base de Cloud Functions (`.../mercadoPagoWebhookHandler`).
2. Si existe token configurado (o se rota), la `Public Key` es obligatoria.
3. El `accessToken` se persiste en Secret Manager; en Firestore solo se guarda referencia y valor enmascarado.

---

## 🔒 Despliegue y Gobernanza de Ramas

Este repositorio opera bajo políticas estrictas de flujo de trabajo y protección de ramas.

### Entornos y Ramas Principales

| Rama | Entorno / Propósito | Proyecto Firebase | Comando de Despliegue |
|------|--------------------|-------------------|-----------------------|
| `develop` | Integración / Pruebas | `ecommerce-vertex-dev` | `npm run deploy:dev` |
| `main` | Producción / Versión Estable | `ecommerce-vertex` | `npm run deploy:prod` |

### Políticas Obligatorias

1. **Promoción exclusiva vía PR:** Todo cambio hacia la rama `main` debe promoverse únicamente mediante un Pull Request desde `develop` hacia `main`.
2. **Sincronización Inversa Inmediata (Back-Sync):** Tras fusionar una PR en `main`, es obligatorio realizar una Pull Request de fusión inversa de `main` a `develop` para evitar divergencias en el historial de Git.
3. **Protecciones de Rama Activas:** Las ramas `develop` y `main` están protegidas del lado del servidor. Las eliminaciones y empujes directos están bloqueados.
4. **Persistencia Histórica:** Bajo ninguna circunstancia se deben eliminar las ramas permanentes `develop` y `main`. La opción de borrar rama al fusionar una PR (`delete branch`) jamás debe aplicarse sobre estas ramas.

---

## 🚨 Guías de Resolución de Incidentes (Runbooks)

### 1) PR Bloqueada por Verificaciones Pendientes o Canceladas
1. Inspecciona los resultados de las comprobaciones requeridas en GitHub.
2. Si un job falló o se canceló por motivos ajenos al código, vuelve a ejecutar el workflow en GitHub Actions.
3. Espera a que todas las verificaciones del **Quality Gate** pasen a estado verde antes de proceder con la fusión.

### 2) Deriva de Ramas (Drift) entre `develop` y `main`
1. Abre un PR de sincronización inversa (`main` -> `develop`).
2. Valida que pasen las comprobaciones de CI requeridas.
3. Realiza la fusión de forma segura sin eliminar las cabezas de rama permanentes.

### 3) Lista de Cierre de Lanzamiento (Release Close Checklist)
- [ ] Validaciones de CI en `develop` completadas con éxito (verde ✅).
- [ ] Despliegue automático de `develop` completado sin errores.
- [ ] PR de `develop` -> `main` revisado y fusionado de manera lineal (Squash/Rebase).
- [ ] Validaciones de CI en `main` completadas con éxito.
- [ ] Despliegue automático de producción (`main`) verificado operacionalmente.

---

📖 **Nota para Desarrolladores:** Mantén este documento `README.md` actualizado como la referencia operativa principal para el desarrollo diario y los flujos de lanzamiento.
