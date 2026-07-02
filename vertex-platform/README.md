# 🛡️ Vertex Platform

Plano de control (Control Plane) centralizado para el aprovisionamiento, operaciones y gobernanza del ecosistema multi-tenant de Vertex.

La plataforma coordina todo el ciclo de vida de las tiendas independientes de los clientes, gestiona los recursos de Google Cloud y Firebase, administra las cuentas de facturación y orquesta los despliegues automáticos cruzados (cross-repo) con la plantilla de e-commerce.

---

## 🚀 Inicio Rápido (10 minutos)

Sigue estos pasos para configurar e iniciar la plataforma localmente en tu entorno de desarrollo:

1. **Instalar dependencias:**
   Asegúrate de instalar los paquetes tanto del frontend de Angular como de las Cloud Functions:
   ```bash
   npm ci --legacy-peer-deps
   cd functions && npm ci && cd ..
   ```
   *(Nota: Se requiere `--legacy-peer-deps` debido a compatibilidad de paquetes en la versión de Angular).*

2. **Autenticar herramientas CLI:**
   Autentica tanto Firebase como el SDK de Google Cloud para que la aplicación local pueda interactuar con los servicios correspondientes:
   ```bash
   firebase login
   gcloud auth application-default login
   gcloud auth application-default set-quota-project vertex-platform-dev
   ```

3. **Iniciar la aplicación:**
   Ejecuta el servidor de desarrollo de Angular:
   ```bash
   npm run start
   ```

4. **Ejecutar validaciones base:**
   Valida que el código cumpla con los estándares de tipos y estilo estricto antes de realizar cambios:
   ```bash
   npm run lint && npm run typecheck
   ```

5. **Arranque con Docker (opcional):**
   Si tenés Docker Desktop disponible, podés levantar el stack completo desde la raíz de `platform/` con:
   ```bash
   bash docker/start.sh
   ```
   En el primer arranque el contenedor instala dependencias del root, `vertex-platform` y el storefront montado; después reutiliza los volúmenes de `node_modules`.

---

## 📁 Contenidos y Arquitectura

* **`src/app`**: Capa frontend construida sobre **Angular 21+**, utilizando arquitectura de componentes independientes (Standalone Components) y gestión de estado mediante **Señales (Signals)** para garantizar un rendimiento óptimo.
* **`functions/src`**: Capa backend que corre sobre **Firebase Functions v2**. Contiene la lógica core de negocio:
  * `admin.ts`: Gestión de administradores de la plataforma y asignación de roles.
  * `provisioning.ts`: Flujo y automatización secuencial de pasos para la creación de proyectos dedicados de GCP por tienda cliente.
  * `stores.ts`: Operaciones de redimensionamiento, suspensión, eliminación y mapeo de dominios de las tiendas.
  * `billing.ts`: Gestión y asignación de cuentas de facturación.
  * `helpers.ts`: Utilidades del sistema, clientes OAuth y reintentos automáticos.

---

## 🌐 Entornos de Operación

La plataforma cuenta con dos entornos principales administrados de forma aislada:

| Entorno | ID de Proyecto Firebase | URL de Acceso | Comando de Despliegue |
|---------|-------------------------|---------------|-----------------------|
| **Desarrollo (Dev)** | `vertex-platform-dev` | [vertex-platform-dev.web.app](https://vertex-platform-dev.web.app) | `npm run deploy:dev` |
| **Producción (Prod)** | `vertex-platform-app` | [vertex-platform-app.web.app](https://vertex-platform-app.web.app) | `npm run deploy:prod` |

*Operadores Recomendados:*
- Operaciones en Dev: `juan.l.espeche@gmail.com`
- Operaciones en Prod: `vertex.tech.dev@gmail.com`

---

## 💻 Comandos Útiles de Desarrollo

| Comando | Descripción |
|---------|-------------|
| `npm run start` | Inicia el servidor de desarrollo de Angular en `http://localhost:4200` |
| `npm run build:dev` | Compila el frontend configurado para el entorno de desarrollo |
| `npm run build:prod` | Compila el frontend optimizado para producción |
| `npm run lint` | Analiza el código con ESLint en búsqueda de errores de formato y estilo |
| `npm run typecheck` | Ejecuta la verificación estricta de tipos de TypeScript |
| `npm run validate:rules` | Valida que las reglas de seguridad de Firestore estén sincronizadas entre storefront y platform |
| `npm test` | Corre las pruebas unitarias de la aplicación frontend |
| `npm run e2e:ci` | Corre las pruebas integrales de punta a punta en Cypress (modo headless) |
| `npm run qa` | Ejecuta de forma integrada el análisis estático y pruebas unitarias básicas |
| `npm run qa:full` | Ejecuta la validación exhaustiva de QA, incluyendo pruebas E2E e integración |

---

## 🔑 Control de Acceso y Roles (RBAC)

La plataforma implementa un modelo estricto de autorización basado en reclamos personalizados (**Custom Claims**):

* **`platformAdmin`**: Permiso necesario para realizar cualquier operación general sobre la plataforma y tiendas de los clientes.
* **`superAdmin`**: Permiso de máximo nivel para delegar y administrar roles de usuario.

### Cuentas Protegidas de Fábrica (Hardcoded Protection)
Las siguientes cuentas de correo están blindadas de forma nativa por el sistema:
1. `juan.l.espeche@gmail.com`
2. `vertex.tech.dev@gmail.com`

El sistema automáticamente eleva estas cuentas al rol de `superAdmin`, corrigiendo de forma proactiva cualquier intento de alteración o desactualización de permisos sobre ellas.

### Script de Recuperación Manual de Roles
Si necesitas asignar manualmente permisos de administrador en caso de emergencia, ejecuta:
```bash
# Para el entorno de Desarrollo
npm run add-admin juan.l.espeche@gmail.com -- --dev

# Para el entorno de Producción
npm run add-admin vertex.tech.dev@gmail.com
```
*Nota: Después de aplicar este script, el usuario afectado debe cerrar sesión y volver a iniciarla para refrescar sus tokens.*

---

## 🧭 Orquestación de Acceso de Tiendas

La plataforma administra el acceso admin de cada tienda de forma centralizada y sin contraseñas locales:

1. `provisioning.ts` preautoriza el correo del owner en `admin_roles` del proyecto de la tienda.
2. `inviteStaff` escribe correos con rol `admin` en `admin_roles` del runtime project.
3. `inviteStaff` envía un email de invitación HTML profesional con CTA directo al login admin de la tienda.
4. El frontend de tienda permite solo login con Google OAuth y valida claims de acceso.

### Política de Login de Tienda

- Método único permitido: Google OAuth.
- Flujo de password reset para acceso admin: deshabilitado para operación estándar.
- Dominio OAuth: la provisión sincroniza `authorizedDomains` con `*.web.app`, `*.firebaseapp.com` y dominio custom si existe.

---

## 📈 Observabilidad de Provisioning

El estado de alta de tienda se expone de manera continua en `stores/{id}`:

- `status`: `provisioning`, `active`, `suspended`, `error`.
- `provisioningSteps`: estado por paso (`pending`, `running`, `done`, `error`) con detalle de error cuando aplica.
- `updatedAt`: timestamp operativo para seguimiento en vivo.

En UI de plataforma:

1. Lista de tiendas: muestra paso actual, porcentaje y barra de progreso.
2. Detalle de tienda: muestra paso actual, completados/total y última actualización.
3. Reintentos: disponibles cuando la tienda queda en `error`.

---

## 🛡️ Gobernanza de Despliegues y Ramas

El repositorio sigue un esquema estricto de flujo continuo para asegurar la estabilidad operacional.

### Políticas de Ramas
* **`develop`**: Rama de integración diaria. Todo desarrollo de características (`feature/*`) nace y muere aquí.
* **`main`**: Rama estable de lanzamiento en producción.

### Reglas de Negocio en Git
1. **Promoción vía Pull Request:** La única vía permitida para incorporar código a `main` es mediante un Pull Request desde `develop` hacia `main` que complete exitosamente todos los Quality Gates automáticos.
2. **Sincronización Inversa Obligatoria:** Tras cada fusión hacia `main`, se debe realizar un back-merge inmediato (`main` -> `develop`) para resolver divergencias en archivos de control como `package.json`.
3. **No Eliminación de Ramas:** Las ramas `develop` y `main` son **ramas permanentes** bajo protección del servidor y **JAMÁS se deben eliminar** bajo ninguna circunstancia.

---

## 🚨 Guías de Resolución de Incidentes (Runbooks)

### 1) Rama `main` en Estado Rojo (Fallas de Compilación o CI)
1. Inspecciona los logs del workflow fallido en GitHub Actions.
2. Si se debe a fallas de consistencia o dependencias desalineadas, abre un Pull Request de sincronización reversa (`main` -> `develop`) o una PR de corrección rápida sobre `develop`.
3. Valida localmente y en el pipeline que el job `Quality Gate` pase a verde completo antes de reintentar integraciones.

### 2) Fallas de Permisos en Cloud Scheduler durante el Despliegue
1. Asegúrate de que la API de Cloud Scheduler (`cloudscheduler.googleapis.com`) esté activa en el proyecto de Firebase.
2. Verifica que el principal de IAM que ejecuta la acción tenga asignado el rol para crear/modificar schedulers.
3. Reinicia el workflow en GitHub Actions.

---

## 📚 Índice de Documentación Técnica

Para un análisis a profundidad sobre componentes y arquitectura técnica, consulta los siguientes archivos:
* [agent.md](../agent.md): Guía universal de estándares, pruebas y comandos para agentes de IA y desarrolladores.
* [docs/scalability-roadmap.md](docs/scalability-roadmap.md): Hoja de ruta para la migración del modelo legacy de GCP a Shard Compartido.
* [docs/github-rulesets.md](docs/github-rulesets.md): Detalle de Branch Rulesets programáticos activos para la seguridad en Git.
* [.github/CONTRIBUTING.md](.github/CONTRIBUTING.md): Guía de contribución y convenciones de Git.
