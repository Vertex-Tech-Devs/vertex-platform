# 🚀 Pull Request

## 📝 Descripción
Por favor, proporciona un resumen claro y conciso de los cambios introducidos por esta Pull Request, su justificación y el problema que resuelven.

* **Foco del cambio**: (e.g. Orquestación, Base de datos, Interfaz de Ajustes, Gestión de Equipo, CI/CD)
* **Tickets/Issues relacionados**: (e.g. Closes #123)

---

## 🛠️ Tipo de Cambio
Marca el tipo de cambio introducido por esta PR utilizando una `[x]`:

- [ ] `feat`: Nueva característica para el usuario.
- [ ] `fix`: Resolución de un bug o comportamiento incorrecto.
- [ ] `docs`: Cambios únicamente en la documentación.
- [ ] `style`: Cambios cosméticos o de formato que no afectan la lógica del código.
- [ ] `refactor`: Reorganización de código que no añade características ni corrige bugs.
- [ ] `perf`: Mejora de rendimiento o eficiencia de recursos.
- [ ] `test`: Adición o corrección de pruebas automatizadas.
- [ ] `ci` / `chore`: Cambios en la infraestructura de compilación, workflows o mantenimiento interno.

---

## 🔒 Lista de Verificación de Seguridad y Robustez
Confirma que se han auditado y cumplido los siguientes puntos antes de solicitar revisión:

- [ ] **Principio de Menor Privilegio (Firestore/GCP)**: ¿Las reglas de seguridad de Firestore impiden escrituras no autorizadas y limitan las lecturas de forma granular?
- [ ] **Validación de Identidad y Roles (RBAC)**: ¿Las llamadas sensibles en backend/functions validan correctamente el rol y pertenencia del usuario (e.g., `isAdmin()`, pertenencia a la tienda)?
- [ ] **Seguridad contra Borrado Accidental**: ¿La "Danger Zone" de eliminación de tiendas exige la confirmación exacta por slug y valida la entrada en el controlador backend para evitar catástrofes?
- [ ] **Saneamiento e Integridad de Semillas (`/dev/seed`)**: ¿El motor de seeding contiene compuertas que aborten ante productos/pedidos activos, y limpia las colecciones previas para evitar duplicidades?
- [ ] **Protección de Datos Sensibles**: ¿Los secretos sensibles (e.g., tokens de Mercado Pago, claves API) se manejan exclusivamente a través de Secret Manager y no se exponen en logs o variables de entorno estáticas?

---

## 🧪 Pruebas y Validación Local
Describe las pruebas locales realizadas para validar estos cambios:

### Validación Obligatoria (Marcar las completadas)
- [ ] **Compilación y Typecheck sin Errores**:
  - `npm run typecheck` en el frontend (`vertex-platform`) finalizó con `0 errores`.
  - `npm run build` en la carpeta `functions/` finalizó con éxito y sin advertencias de tipos.
- [ ] **Validación del Workflow**:
  - Se probó la generación y recuperación del link de restablecimiento manual de contraseñas de Staff y funciona correctamente en local.
- [ ] **Pruebas Unitarias**:
  - `npm run test` (Frontend) y `npm run test` (Backend/Functions) pasan exitosamente.

---

## 🔄 Sincronización Inversa (Back-Merge) — Obligatorio al mergear a `main`

> **Aplica únicamente cuando esta PR apunta a `main`.**
> Si esta PR es `develop` → `main` o un `hotfix/*` → `main`, ejecutar **inmediatamente después del merge**:

```bash
# Flujo Obligatorio de Sincronización Inversa (Back-Merge)
git checkout develop
git pull origin develop
git merge origin/main
# Resolver conflictos manteniendo la estabilidad si los hubiera
git push origin develop
```

- [ ] **Back-Merge ejecutado** *(solo si esta PR apunta a `main`)* — `git diff develop..main` no devuelve salida de código fuente.

---

## 🤝 Flujo de Revisión y Quality Gate
* Al abrir esta PR, se iniciará el flujo de **GitHub Actions** (`CI`).
* Se desplegará automáticamente un canal de previsualización temporal de Firebase Hosting (**Hosting Preview Channel**). El enlace se comentará automáticamente en este hilo.
* Para fusionar la PR en `develop` o `main`, **todos los checks críticos** del `Quality Gate` deben estar en verde y contar con al menos una aprobación formal de revisión.
