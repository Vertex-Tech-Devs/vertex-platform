# 🛒 Vertex Ecommerce (Storefront & Backoffice)

Esta es la plantilla premium y autogestionable de e-commerce (marca blanca) utilizada para los inquilinos (tenants) del ecosistema multi-tenant de **Vertex Solutions**. Lee dinámicamente su configuración de Firestore (`settings/storeConfig`) para adaptar la tienda al inquilino.

---

## 🚀 Inicio Rápido (Entorno Local)

Para iniciar el e-commerce localmente:

1. **Dependencias y Workspaces**:
   Asegúrate de instalar los paquetes desde la raíz del monorepo con `npm install` para la resolución de dependencias compartidas.

2. **Aprovisionamiento local**:
   Ejecuta `npm run setup` en la raíz del monorepo para inicializar el entorno.

3. **Iniciar el servidor local**:
   ```bash
   npm run start
   ```
   *El e-commerce se levanta en `http://localhost:4201`.*

---

## 📁 Estructura del Ecosistema

- **`src/app/shop`**: Frontend del storefront orientado al cliente final.
- **`src/app/admin`**: Panel de control administrativo y gestión interna para dueños de tienda.
- **`functions/src`**: Backend serverless que maneja integraciones de pagos (Mercado Pago), notificaciones e invitaciones de staff.
- **`cypress` / `integration-tests`**: Suites de pruebas integrales y de punta a punta.

---

## 🛡️ Compilaciones de Calidad & Cobertura de Tests

El e-commerce aplica un blindaje riguroso en el ciclo de vida local de Git:

- **Cobertura de Código**: El ejecutor de pruebas unitarias (`npm run test:ci`) exige una cobertura estricta de al menos **85%** en `statements`, `branches`, `functions` y `lines`. Si no se alcanza, el comando retorna `exit 1` y bloquea el flujo.
- **Validaciones en Commit/Push**: Husky intercepta los commits locales ejecutando ESLint y Typecheck (`npm run lint && npm run typecheck`). Al realizar un push, corre la suite de pruebas unitarias validando la cobertura del 85%.

---

## 🔐 Integraciones Core

### 1. Acceso Administrativo (Google OAuth-Only)
El login administrativo (`/admin/login`) acepta exclusivamente Google OAuth. Los correos deben preautorizarse en la colección de Firestore (`admin_roles/{email}`).

### 2. Pasarela de Pagos (Mercado Pago)
Las claves de tokens se persisten en Secret Manager. La URL de webhook se calcula de forma dinámica en base al dominio del tenant.
