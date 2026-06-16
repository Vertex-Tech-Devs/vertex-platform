# 🛡️ Vertex Platform (Control Plane)

El plano de control centralizado para la administración y aprovisionamiento del ecosistema multi-tenant de **Vertex Solutions**. Esta aplicación Angular coordina el ciclo de vida de los inquilinos, recursos en la nube y operaciones de facturación.

---

## 🚀 Inicio Rápido (Entorno Local)

Para iniciar el Control Plane localmente:

1. **Asegurar dependencias**:
   Instala desde la raíz del monorepo mediante `npm install` para resolver dependencias a través de workspaces.

2. **Autenticación CLI**:
   ```bash
   firebase login
   gcloud auth application-default login
   gcloud auth application-default set-quota-project vertex-platform-dev
   ```

3. **Ejecutar frontend**:
   ```bash
   npm run start
   ```
   *Disponible en `http://localhost:4200`.*

---

## 📁 Arquitectura Técnica

- **`src/app`**: Frontend estructurado sobre **Angular 21+**, utilizando **Standalone Components** y control de estado reactivo mediante **Angular Signals**.
- **`functions/src`**: Backend serverless que corre bajo **Cloud Functions v2**:
  - `provisioning.ts`: Aprovisionamiento secuencial de proyectos y bases de datos dedicadas por tienda.
  - `billing.ts`: Vinculación automática con cuentas de facturación GCP.
  - `stores.ts`: Suspensión, activación y gobernanza de dominios.

---

## 🌐 Entornos de Despliegue

| Entorno | ID del Proyecto GCP/Firebase | URL Pública | Comando de Despliegue |
|---------|-------------------------|-------------|-----------------------|
| **Desarrollo (Dev)** | `vertex-platform-dev` | [vertex-platform-dev.web.app](https://vertex-platform-dev.web.app) | `npm run deploy:dev` |
| **Producción (Prod)** | `vertex-platform-app` | [vertex-platform-app.web.app](https://vertex-platform-app.web.app) | `npm run deploy:prod` |

---

## 🛡️ Gobernanza & Compilaciones de Calidad

Esta aplicación se encuentra resguardada por el sistema de Quality Gates de la raíz (Husky y lint-staged).
- **Formatos y Tipos**: ESLint y TypeScript en modo estricto (`tsc --noEmit`) se auditan de forma headless pre-commit.
- **Tests**: `npm run test` verifica las especificaciones locales de componentes y servicios.
