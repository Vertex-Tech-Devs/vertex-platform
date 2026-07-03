# Universal Agent Rules — Platform (`vertex-platform`)

This file contains instructions for AI agents and developers working on the Platform repository.

---

## 🏗️ Arquitectura del Monorepo

```
platform/
├── vertex-platform/          # App Angular + Cloud Functions
│   ├── src/app/              # Frontend Angular 20+ (Signals, Standalone)
│   └── functions/src/        # Cloud Functions v2 (TypeScript)
│       ├── provisioning.ts   # Aprovisionamiento y ciclo de vida de tiendas
│       ├── versioning.ts     # Gestión de versiones del template
│       ├── stores.ts         # CRUD de tiendas y helpers
│       ├── auth.ts           # Autenticación y roles
│       └── index.ts          # Entry point — exports de todas las functions
├── packages/
│   └── shared-contracts/     # @vertex/contracts — esquemas Zod compartidos
└── scripts/                  # Orquestación de dev local
```

---

## 💻 Comandos de desarrollo

```bash
# Desde platform/
npm run start                            # Orquestador E2E con hot-reload
bash docker/start.sh                     # Stack Docker completo

# Tests
cd vertex-platform/functions && npm run test           # Backend (Vitest) — 33 tests
npm run test --workspace=vertex-platform -- --watch=false  # Frontend

# Build
cd vertex-platform/functions && npm run build          # Build backend
npm run build:dev --workspace=vertex-platform           # Build frontend dev
npm run build:prod --workspace=vertex-platform          # Build frontend prod

# QA
npm run lint                             # Linting
npm run typecheck                        # TypeScript strict
npm run qa:global                        # Lint + typecheck + firestore rules
```

---

## 🔄 Git Flow & PR Governance

- Ramas: `develop` (dev/staging) y `main` (prod)
- Feature branches: `feat/*`, `fix/*`, `chore/*` desde `develop`
- Direct push bloqueado por server-side rules
- Bypass Husky local:
  ```bash
  HUSKY=0 git commit -m "..." && HUSKY=0 git push origin branch-name
  ```

---

## 🔢 Versionado del Template de Tienda

La constante `CURRENT_TEMPLATE_VERSION` en `provisioning.ts` define qué versión del storefront
se usa al provisionar nuevas tiendas.

**NO editar manualmente.** Se actualiza automáticamente vía PR generado por `sync-template-version.yml`
cuando el storefront publica un nuevo release.

Versión actual: `0.1.0`

### Flujo automático
1. Storefront hace `npm run release:minor` → tag `v0.2.0`
2. Workflow `release.yml` del storefront dispara `repository_dispatch: storefront-release`
3. Workflow `sync-template-version.yml` de la plataforma abre PR automático
4. Admin de plataforma revisa y mergea el PR

---

## 🔥 Cloud Functions — Patterns críticos

### Inicialización de clientes (GCP SDK)
```typescript
// ✅ CORRECTO: cliente en scope global (evita re-init latency)
const secretClient = new SecretManagerServiceClient();
export { secretClient };

// ❌ INCORRECTO: dentro de la función
export const myFunction = onCall(async () => {
  const client = new SecretManagerServiceClient(); // NO
});
```

### Caching en memoria
```typescript
// Cache secrets para evitar llamadas repetidas a GCP
const secretCache = new Map<string, string>();
```

### Recursos de Functions
- `provisionStore`, `runProvisioning`: `512MiB` / `300s` timeout
- Resto: defaults

---

## 🛡️ Acceso y Permisos

| Componente | Acceso |
|---|---|
| Plataforma admin dashboard | Solo: `juanson-espeche`, `lihue`, cuenta Vertex |
| Storefront `/shop` | Público |
| Storefront `/admin` | Admin autorizado en `admin_roles/{email}` |

### Administradores de plataforma autorizados
- `juanson-espeche` (owner)
- `lihue` (admin)
- Cuenta `vertex` (service account)

---

## 📋 Entornos Firebase

| Entorno | Proyecto Firebase | URL |
|---|---|---|
| Platform DEV | `vertex-platform-dev` | https://vertex-platform-dev.web.app |
| Platform PROD | `vertex-platform-app` | https://vertex-platform-app.web.app |
| Storefront DEV | `ecommerce-vertex-dev` | https://ecommerce-vertex-dev.web.app |
| Storefront PROD | `ecommerce-vertex` | https://ecommerce-vertex.web.app |

---

## ⚠️ Patrones a evitar

- **NO** crear `getStoreDeploymentHistory` ni similar — fue removido por generar hasta 50 llamadas a GitHub por carga de vista
- **NO** usar `setInterval` para polling en componentes Angular; usar `toSignal` o RxJS
- **NO** editar `CURRENT_TEMPLATE_VERSION` manualmente — el workflow lo gestiona
- **NO** hardcodear versiones de template fuera de `provisioning.ts`

---

## 🔗 Repositorios relacionados

- **Platform**: `https://github.com/Vertex-Tech-Devs/vertex-platform`
- **Storefront**: `https://github.com/Vertex-Tech-Devs/ecommerce-vertex`
- Ambos bajo la org `Vertex-Tech-Devs`
