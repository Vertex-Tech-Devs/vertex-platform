# 🌐 Vertex Platform Ecosystem (Control Plane)

Control plane centralizado para la gobernanza, aprovisionamiento de recursos de infraestructura y ciclo de vida de tiendas independientes en el ecosistema SaaS multi-tenant de **Vertex**.

Este repositorio está estructurado como un **NPM Workspace** (monorepo) que no solo administra la consola administrativa principal de Vertex, sino que también aloja los contratos de validación compartidos y orquesta el entorno de desarrollo unificado (Docker/Emuladores) en conjunto con el repositorio de **Storefront**.

---

## 🏗️ Topología del Ecosistema

El proyecto de Vertex está dividido en dos repositorios hermanos en paralelo:

1. **`platform/`** (Este repositorio): Plano de control, API centralizada y contratos de datos.
2. **`storefront/`** (Repositorio `ecommerce-vertex`): Plantilla cliente para tienda (Frontend) y backoffice.

```mermaid
graph TD
    subgraph Platform Repo
        P_Dashboard[Control Plane Dashboard - Angular]
        P_Backend[Cloud Functions v2 - Node/Firebase]
        Shared_Contracts["Shared Contracts (@vertex/contracts)"]
    end

    subgraph Storefront Repo
        S_Shop[Storefront Customer Page - Angular]
        S_Admin[Storefront Admin Panel - Angular]
        S_Backend[Storefront Functions - Node/Firebase]
    end

    P_Backend -->|Provisiona Proyectos GCP| S_Backend
    S_Shop -->|Valida Formatos/Esquemas| Shared_Contracts
    S_Admin -->|Valida Formatos/Esquemas| Shared_Contracts
    P_Dashboard -->|Consulta y Operaciones| P_Backend
```

### 🤝 Consumo de Contratos Compartidos

Para evitar redundancia de código y garantizar consistencia de tipo estricto, el **Storefront** consume los contratos de validación de esquemas Zod (`@vertex/contracts`) directamente desde este repositorio mediante dependencias locales (`file:`) en su `package.json`:

```json
"dependencies": {
  "@vertex/contracts": "file:../platform/packages/shared-contracts"
}
```

---

## 🚀 Inicio Rápido: De Cero a Todo Funcionando (Docker Dev Stack)

El ecosistema cuenta con una suite de desarrollo contenedorizada completa que levanta la plataforma, el storefront, las bases de datos locales, la autenticación y los emuladores de Firebase en un entorno caliente e intercomunicado de manera automatizada.

### 1️⃣ Inicialización por Primera Vez (One-liner de Onboarding)

Asegúrate de tener **Docker Desktop** instalado y en ejecución en tu equipo. Abre una terminal y corre el siguiente comando consolidado:

```bash
mkdir -p "Vertex Projects" && cd "Vertex Projects" && git clone -b develop https://github.com/Vertex-Tech-Devs/vertex-platform.git platform && git clone -b develop https://github.com/Vertex-Tech-Devs/ecommerce-vertex.git storefront && cd platform && bash docker/start.sh
```

_¿Qué hace este comando?_

1. Crea el directorio padre `"Vertex Projects"`.
2. Clona la rama `develop` de ambos repositorios (`platform` y `storefront`) uno al lado del otro.
3. Ingresa a la raíz de `platform`.
4. Ejecuta el script de inicio de Docker (`docker/start.sh`), el cual construye las imágenes, crea los volúmenes para acelerar futuras instalaciones de `node_modules` y levanta todos los emuladores de Firebase.
5. Abre automáticamente pestañas en tu navegador cuando los servidores estén listos.

### 2️⃣ Comandos de Arranque Posteriores

Cuando ya tengas los repositorios clonados, usa estos comandos directos:

- **Con Docker (Recomendado - Completo):**
  ```bash
  # Desde la raíz de platform/
  bash docker/start.sh
  ```
- **Sin Docker (Nativo en el Host):**
  Asegúrate de autenticar tus herramientas de línea de comandos antes del arranque nativo:

  ```bash
  # 1. Autenticación inicial (Solo la primera vez)
  firebase login
  gcloud auth application-default login
  gcloud auth application-default set-quota-project vertex-platform-dev

  # 2. Iniciar orquestador local de servicios
  npm run start
  ```

---

## 📁 Estructura de Directorios (Platform Root)

- **`vertex-platform/`**: Proyecto principal de consola.
  - `src/app/`: Frontend independiente en Angular 22 con Signals.
  - `functions/src/`: Controladores de aprovisionamiento de Firebase Cloud Functions v2 (billing inteligente, fallback a shared-shard, seeding flat).
  - `scripts/`: Utilidades de orquestación y validación (`validate-firestore-rules.ts` con modo standalone para CI).
  - `firestore.rules` + `firestore.indexes.json`: reglas de seguridad e índices del plano de control.
- **`packages/shared-contracts/`**: Paquete NPM local `@vertex/contracts` con esquemas Zod compartidos de Base de Datos y APIs.
- **`docker/`**: Archivos de configuración de imágenes y scripts de entrada para Docker.
- **`scripts/`**: Utilidades de orquestación local (como `dev-e2e.ts`).

---

## ⚙️ Índice de Puertos en Desarrollo Local

Una vez levantado el entorno con Docker o el orquestador nativo, los siguientes servicios estarán accesibles:

- **Platform Admin Dashboard:** [http://localhost:4200](http://localhost:4200)
- **Storefront Cliente (Shop):** [http://localhost:4201/shop?tenantId=tienda-dos](http://localhost:4201/shop?tenantId=tienda-dos)
- **Storefront Admin Panel:** [http://localhost:4201/admin](http://localhost:4201/admin)
- **Firebase Emulator Suite UI:** [http://localhost:4000](http://localhost:4000)
- **Cloud Functions Emulator API:** `http://localhost:5001`
- **Cloud Firestore Emulator:** `http://localhost:8080`

---

## 🧩 Arquitectura de Datos y Aprovisionamiento (V1.0)

### Modelo de Datos Flat Multi-Tenant

A partir de la versión V1.0 el modelo de datos es **plano y etiquetado por `storeId`** (sin namespaces `tenants/{tenantId}/...`):

```
products/{storeId}-<id>        → { storeId, ... }
categories/{storeId}-<id>      → { storeId, ... }
attributes/{storeId}-<id>      → { storeId, ... }
configuracion/store_{storeId}  → { storeId, tenantId, ... }
configuracion/footer_{storeId} → { storeId, ... }
configuracion/hero_{storeId}   → { storeId, ... }
banners/home_{storeId}         → { storeId, ... }
pages/aboutUs_{storeId}        → { storeId, ... }
orders/{storeId}-<id>          → { storeId, ... }
clients/{storeId}_<email>      → { storeId, ... }
```

### Semillado de Datos de Prueba (`seedSalesAndClients`)

Al aprovisionar una tienda con la opción `seedSalesAndClients: true` (o `includeMockData = true`):

- `seedStoreData` en `seeds.ts` genera las colecciones `products`, `categories`, `attributes`, `clients` y `orders`.
- Los campos de tipo entero son transformados mediante `toFirestoreValue` a la estructura REST `integerValue: String(val)` y las fechas a `timestampValue: ISOString`.
- Todos los documentos quedan scoped por el `storeId` para aislar los datos multi-tenant de la tienda en el shard.

### Colecciones del Plano de Control (Siempre Privadas)

`stores`, `infrastructure_shards`, `provisioning_queue`, `provisioning_logs`, `users`, `admin_roles` — protegidas por el catch-all `match /{document=**} { allow read, write: if isPlatformAdmin(); }`.

### Shards (`infrastructure_shards`)

- Esquema: `status` en mayúsculas (`ACTIVE`, `FULL`, `WARMUP_READY`, ...), `maxCapacity`, `currentStores`, `reservedStores`.
- **Auto-healing**: si no existe un shard `ACTIVE`, se crea automáticamente `shared-dev-01` (`maxCapacity: 35`, `currentStores: 0`).
- Las tiendas **estándar** se asignan directamente a un shard activo **sin** crear proyectos GCP ni vincular billing (`skipGcpSteps` marca `createProject`/`linkBilling`/`addFirebase`/`enableApis` como `done`).

### Billing Inteligente y Fallback

- `pickBillingAccount` consulta `billing_accounts` con `status == 'ACTIVE'` (fallback legacy `billingAccounts`/`active == true`) y filtra `currentProjects < maxProjects`.
- Si una Tienda Dedicada no encuentra cuenta con cupo (`quotaExceeded` / `billing_quota_increase`): `console.warn` + auditoría `provisionStore-billing-fallback` + **conversión automática a Tienda Estándar sobre `shared-dev-01`** para que la tienda se cree al 100%.

### WebApp Única por Tienda

- `webAppDisplayName = vtx-${slug}-${uniqueSuffix}` (últimos 6 caracteres alfanuméricos del `storeId`) para evitar el bloqueo GCP 400 por soft-delete de 30 días.
- La creación de la WebApp usa **siempre el `gcpProjectId` real** (proyecto del shard o `vtx-<slug>` dedicado), con delay de propagación de 3s y hasta 3 reintentos ante `404/NOT_FOUND`.

### Validación de Reglas en CI (Standalone)

`scripts/validate-firestore-rules.ts` detecta `CI=true` / `GITHUB_ACTIONS=true` / `FORCE_STANDALONE=true` y valida **solo** las reglas locales de `vertex-platform` saliendo con `exit 0` en runners aislados (sin depender del repositorio storefront).

---

## 🛡️ Políticas de Calidad y Git Flow

### QA Local Automatizado

Antes de commitear o abrir un PR, es obligatorio verificar que la suite de QA unificada esté limpia:

```bash
# Validar la alineación estructural de reglas de seguridad de Firestore
npm run validate:rules

# Ejecutar verificación de linter, compilación estricta de TypeScript y reglas de Firestore
npm run qa:global

# Ejecutar tests unitarios completos (153 Frontend + 73 Backend)
npm test

# Ejecutar verificación de 0 vulnerabilidades
npm audit
```

### Flujo de Ramas (Git Flow)

1. **develop**: Integración activa de desarrollo. Las ramas de feature/chore nacen de `develop` y se reintegran mediante PRs.
2. **main**: Rama estable de producción. La promoción se realiza **exclusivamente vía Pull Request** de `develop` → `main` (el push directo a `main` está bloqueado por repo rules del servidor).
3. **Back-sync obligatorio**: tras fusionar en `main`, se ejecuta el back-merge `main` → `develop` para mantener 0 divergencia.
4. **Bypass de automatización**: los hooks de `pre-push` exigen `ALLOW_DIRECT_PUSH=true` para push directo a `develop`/`main` en escenarios de automatización/agentes (CI).

---

📖 **Nota para Desarrolladores:** Para guías de desarrollo de agentes de IA y flujos específicos, consulta [agent.md](agent.md). Para la documentación técnica detallada de la consola Angular, consulta [vertex-platform/README.md](vertex-platform/README.md). Para la arquitectura, el aprovisionamiento, el modelo de datos y el CI/CD, consulta [vertex-platform/docs/](vertex-platform/docs/).
