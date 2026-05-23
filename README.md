# Vertex Platform

Multi-tenant SaaS platform for creating and managing independent e-commerce stores. Each store
gets its own Firebase project provisioned automatically through Cloud Functions.

## Tech stack

- **Frontend**: Angular 21, standalone components, signals, `ChangeDetectionStrategy.OnPush`
- **Backend**: Firebase Functions v2 (Gen2 / Cloud Run), TypeScript
- **Database**: Firestore
- **Auth**: Firebase Auth with custom claims (`platformAdmin: true`)
- **CI/CD**: GitHub Actions → Firebase Hosting + Functions

## Environments

| Env | Firebase project | URL |
|-----|-----------------|-----|
| Production | `vertex-platform-app` | https://vertex-platform-app.web.app |
| Development | `vertex-platform-dev` | https://vertex-platform-dev.web.app |

## Prerequisites

- Node.js 20+
- Firebase CLI (`npm install -g firebase-tools`)
- Google Cloud SDK (`gcloud`)
- Two gcloud configurations:
  - `default` — personal account (`juan.l.espeche@gmail.com`) → dev
  - `vertex-prod` — Vertex account (`vertex.tech.dev@gmail.com`) → prod

## Local setup

```bash
# Install root dependencies (--legacy-peer-deps needed: @angular/fire@20 / Angular 21 peer conflict)
npm ci --legacy-peer-deps

# Install functions dependencies
cd functions && npm ci && cd ..

# Log in to Firebase
firebase login

# Set up local ADC for dev project
gcloud auth application-default login
gcloud auth application-default set-quota-project vertex-platform-dev
```

## Development server

```bash
npm run start
# → http://localhost:4200
```

## Code quality

```bash
npm run lint        # ESLint (Angular + TypeScript rules)
npm run typecheck   # tsc --noEmit (no emit, just type checking)
```

## Tests

```bash
# Angular unit tests (Vitest via @angular/build:unit-test)
npm test

# Functions unit tests (Vitest, node environment)
cd functions && npm test
```

Both suites run in CI on every PR and push to `main`.

## Building

```bash
npm run build:dev   # Development build → dist/vertex-platform/browser
npm run build:prod  # Production build  → dist/vertex-platform/browser
```

## Deploy

```bash
# Deploy to dev (uses 'default' gcloud config)
npm run deploy:dev

# Deploy to prod (uses 'vertex-prod' gcloud config)
npm run deploy:prod
```

CI auto-deploys to production on every push to `main` via GitHub Actions
(uses `FIREBASE_SERVICE_ACCOUNT` secret).

## Admin scripts

```bash
# Add / remove platform admin users
npm run add-admin    # prompts for email
npm run remove-admin # prompts for email

# Seed test stores in dev
npm run seed:stores

# Set up provisioning prerequisites
npm run setup-provisioning
```

## Architecture

### Functions modules

| Module | Functions |
|--------|-----------|
| `admin.ts` | `manageAdmin`, `listAdmins` |
| `provisioning.ts` | `provisionStore`, `runProvisioning` |
| `stores.ts` | `redeployStore`, `deleteStore`, `connectDomain`, `getActiveStores` |
| `billing.ts` | `listBillingAccounts`, `addBillingAccount`, `updateBillingAccount`, `removeBillingAccount` |

### Store provisioning flow

1. Admin calls `provisionStore` → Firestore doc created with `status: 'provisioning'`
2. `runProvisioning` Firestore trigger fires → 8 sequential GCP steps
3. Steps are idempotent — safe to retry on error
4. Step 8 dispatches `repository_dispatch` to `ecommerce-vertex` repo
5. ecommerce-vertex CI builds and deploys the store's Angular app

### Firestore schema

```
stores/{storeId}
  status: 'provisioning' | 'active' | 'suspended' | 'error'
  slug: string               # unique, 3–20 chars, [a-z0-9-]
  firebaseProjectId: string  # vtx-{slug}
  billingAccountId: string
  provisioningSteps: Record<stepId, { status, label, error? }>
  /private/firebaseConfig: { apiKey, authDomain, projectId, ... }

billingAccounts/{accountId}
  active: boolean
  maxProjects: number
  addedAt: Timestamp
```

### Key secrets (Secret Manager — `vertex-platform-app`)

| Secret | Purpose |
|--------|---------|
| `platform-owner-credentials` | OAuth2 ADC for `vertex.tech.dev@gmail.com` — creates GCP projects |
| `github-pat` | GitHub PAT with `repo` scope — dispatches to ecommerce-vertex |
| `deploy-token` | Machine-to-machine auth token for `getActiveStores` |

## Security

- All Cloud Functions require `platformAdmin: true` custom claim.
- CORS is strictly restricted to `vertex-platform-app.web.app` and `vertex-platform-dev.web.app`.
- Slug validated server-side: `/^[a-z0-9][a-z0-9-]{1,18}[a-z0-9]$/`.
- Error messages sanitized before returning to clients.
- **Firebase Auth Domain Best Practice**: When developing locally, add `localhost` as an authorized domain *strictly* inside the Dev project (`vertex-platform-dev`). **Never** add `localhost` to the Production project (`vertex-platform-app` / `vertex-prod`) to prevent phishing and session hijacking vulnerabilities.

## Custom Seeding Engine & Mock Data

The platform features a premium seeding engine that customizes the demo storefront's catalogs dynamically based on the vertical (Fashion, Gastronomy, Retail) and commercial identity defined by the tenant.

- **`includeMockData` Toggle Flag**: During both store creation and manual store database seeding (from the Orchestration panel), you can check/uncheck the **"Datos de Demostración"** checkbox to include or skip the 20 simulated clients and 20 simulated orders.
- **Why this option exists**: Firestore security rules in the storefront project (`ecommerce-vertex`) block editing or deleting client records (`allow write: if false`), and orders are permanent transactions. Omit this mock data to keep the database completely clean for pure production tenants, while still pre-populating attributes, categories, customized pages, and personalized banners.
- **Personalized Brand Engine**: The backend runs a recursive customizer (`customizeSeed`) that automatically replaces all references of `'Vertex'` with the store's dynamic commercial name inside product details, categories, pages, and footer contact handles.

