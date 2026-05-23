# Vertex Platform — Agent Instructions

## What this repo is

Multi-tenant SaaS platform that lets operators create and manage independent e-commerce stores.
Each store gets its own Firebase project provisioned automatically through Cloud Functions.

## Tech stack

- **Frontend**: Angular 21, standalone components, signals, `ChangeDetectionStrategy.OnPush`, SCSS
- **Backend**: Firebase Functions v2 (Gen2 / Cloud Run), TypeScript
- **Database**: Firestore (vertex-platform-app for platform data)
- **Auth**: Firebase Auth with custom claims (`platformAdmin: true`)
- **CI/CD**: GitHub Actions → Firebase Hosting + Functions

## Environments

| Env         | Firebase project      | URL                                 | Deploy                |
| ----------- | --------------------- | ----------------------------------- | --------------------- |
| Production  | `vertex-platform-app` | https://vertex-platform-app.web.app | `npm run deploy:prod` |
| Development | `vertex-platform-dev` | https://vertex-platform-dev.web.app | `npm run deploy:dev`  |

Owner account for prod: `vertex.tech.dev@gmail.com` (legacy single secret: `platform-owner-credentials`).
Owner account for dev: `juan.l.espeche@gmail.com` (personal ADC).

Provisioning owners can now be configured as a pool in Secret Manager under `platform-owner-credentials-pool`.
`createProject` rotates across that pool when one owner reaches its project creation quota.

## Project Quota Incident Notes

- Google Cloud project quota is currently a real operational constraint for the dedicated-project provisioning model.
- Projects in `DELETE_REQUESTED` still count against quota until permanently deleted.
- Billing account rotation does **not** solve `projects_count` exhaustion.
- Treat `1 store = 1 project` as a temporary compatibility path, not the scalable target architecture.

The long-term solution is documented in [docs/scalability-roadmap.md](docs/scalability-roadmap.md).

Current architectural direction:

- `shared-shard` runtime for standard stores
- `dedicated-project` runtime only for premium exceptions
- shard capacity target: `100` stores initially

## Functions architecture

Entry: `functions/src/index.ts` (re-exports only — no logic)

| Module            | Functions                                                                                                                            |
| ----------------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| `admin.ts`        | `manageAdmin`, `listAdmins`                                                                                                          |
| `provisioning.ts` | `provisionStore`, `runProvisioning`                                                                                                  |
| `stores.ts`       | `redeployStore`, `deleteStore`, `connectDomain`, `getActiveStores`                                                                   |
| `billing.ts`      | `listBillingAccounts`, `addBillingAccount`, `updateBillingAccount`, `removeBillingAccount`                                           |
| `helpers.ts`      | `getOwnerOAuthClient`, `listProvisioningOwnerCandidates`, `getGitHubPat`, `apiFetch`, `retry`, `pollOperation`, `pickBillingAccount` |
| `types.ts`        | All shared interfaces                                                                                                                |

## Provisioning flow

1. Admin calls `provisionStore` → creates Firestore doc with `status: 'provisioning'`
2. `runProvisioning` Firestore trigger fires → 9 sequential GCP steps tracked in `provisioningSteps`
3. Step 7 (`initAdmin`) creates the store admin Firebase Auth user, sets `admin: true` claim, sends password-reset invite email
4. Step 9 (`triggerDeploy`) dispatches `repository_dispatch` to `Vertex-Tech-Devs/ecommerce-vertex`
5. ecommerce-vertex CI builds Angular app with store's Firebase config and deploys to store's hosting

Steps are idempotent: each step checks its current status (`done`) before executing — safe to retry.

## Key secrets (Secret Manager — vertex-platform-app)

- `platform-owner-credentials`: OAuth2 ADC JSON kept as backward-compatible fallback for single-owner provisioning
- `platform-owner-credentials-pool`: array of provisioning owner credentials used to create GCP projects without depending on a single quota bucket
- `github-pat`: GitHub PAT with `repo` scope — used to dispatch `repository_dispatch` events
- `deploy-token`: Shared token for machine-to-machine auth on `getActiveStores`

## Firestore schema

```
stores/{storeId}
  status: 'provisioning' | 'active' | 'suspended' | 'error'
  slug: string (unique, 3-20 chars, [a-z0-9-])
  firebaseProjectId: 'vtx-{slug}'
  billingAccountId: string
   provisioningOwnerId?: string
  provisioningSteps: Record<stepId, { status, label, error? }>
  /private/firebaseConfig: { apiKey, authDomain, projectId, ... }

billingAccounts/{accountId}
  active: boolean
  maxProjects: number
  addedAt: Timestamp
```

## Critical constraints

- **CORS** is restricted to `vertex-platform-app.web.app` and `vertex-platform-dev.web.app`
- **All functions** require `platformAdmin: true` custom claim — never weaken this
- **`platform-owner-credentials`** must be rotated when the Vertex Google account changes
- **Slug** must be validated before store creation: `/^[a-z0-9][a-z0-9-]{1,18}[a-z0-9]$/`
- **`SOLO_MUST_INVITE_OWNERS`**: GCP projects outside an org can't receive direct `roles/owner` — use `roles/editor` + `roles/resourcemanager.projectIamAdmin` instead

## Local development

```bash
npm ci --legacy-peer-deps   # legacy needed: @angular/fire@20 peer conflict with Angular 21
npm run start               # serve Angular app
npm run lint                # ESLint (ng lint)
npm run typecheck           # tsc --noEmit

cd functions
npm ci
npm run build               # tsc
```

## Deploy scripts

```bash
npm run deploy:dev   # activates 'default' gcloud config, deploys to vertex-platform-dev
npm run deploy:prod  # activates 'vertex-prod' gcloud config, deploys to vertex-platform-app
```

Firebase CLI uses the currently active gcloud account for ADC — switching configs is mandatory.

## Cumulative Knowledge / Memory & Guidelines

To ensure continuous, automated learning and smooth collaboration:

1. **Always update this CLAUDE.md**: At the end of any significant coding session or bug resolution, update this section with your findings. This guarantees that future agents or sessions build on top of verified knowledge immediately.
2. **Identity Platform (Firebase Auth) Provisioning Flow**:
   - **Initialization Handshake Required**: In newly provisioned GCP projects, you cannot call Identity Toolkit endpoints (like creating or configuring accounts) without first triggering an explicit initialization. You must send a `POST` request to `https://identitytoolkit.googleapis.com/v2/projects/${projectId}/identityPlatform:initializeAuth` with an empty body `{}` to create the auth configuration resource.
   - **Enable Provider**: Immediately after initialization, make a `PATCH` request to `/config?updateMask=signIn` to set `signIn.email.enabled = true`.
3. **Multi-tenant GCP API Calls (`quotaProject`)**:
   - When calling Identity Toolkit v1/v2 REST APIs (especially when executing under local Application Default Credentials or user-associated roles), you must pass the `x-goog-user-project` header.
   - In the `apiFetch` helper, this is mapped via the `quotaProject` option. Always include `quotaProject: projectId` in `apiFetch` options to avoid `403 Forbidden` credentials/quota errors.
4. **Secret Manager Performance Optimization**:
   - In Cloud Functions, instantiating the client and retrieving secrets on every step incurs high latency (~300ms overhead) and API usage costs.
   - Re-use a single, module-scoped `SecretManagerServiceClient` instance and cache retrieved secrets (such as GCP Owner Credentials and GitHub PAT) in global variables to bypass repeated API calls.
5. **Git Push Policies**:
   - **ecommerce-vertex**: Direct pushes to the `main` branch are strictly blocked by pre-push hooks. Always commit to `develop` and open a Pull Request to merge into `main`.
   - **vertex-platform**: Both `develop` and `main` can be committed and pushed directly.
6. **Removal of HttpClient and ESLint Safe-Typing (v1.4.0)**:
   - The platform operates purely on direct Firebase SDKs. Angular's `HttpClient` is completely unused and should not be imported or provided.
   - To comply with strict quality gates and avoid `no-explicit-any` errors, always type records using descriptive interfaces like `RawDnsRecord`, and handle caught exceptions using safe `unknown` catches with `err instanceof Error` type guards.
7. Seeding & Mock Data Seeding Configurator (v1.5.0):
   - **`includeMockData` Payload Integration**: The store seeding process accepts an optional `includeMockData` boolean flag (defaults to `true`).
   - **Backend Handling**: In `seeds.ts`, when `includeMockData` is set to `false`, the seeding engine skips the loops that inject 20 mock clients and 20 mock orders. This is crucial because Firestore security rules restrict clients as read-only (`allow write: if false`), and orders represent non-deletable historical transactions. Skipping them provides a pristine store environment.
   - **Frontend UI Toggles**: Toggle options are available both globally in the `store-create` form and manually through a glass-blur confirmation modal (`showSeedConfirm`) in the `store-detail` Orchestration panel.
8. Firebase Auth Domain Security Policies:
   - **Authorized Domains (Dev/Local)**: Running local instances on `http://localhost:4200` with dev environment settings will cause `auth/unauthorized-domain` errors if `localhost` is not added to Firebase Auth -> Settings -> Authorized Domains. Adding `localhost` is 100% secure for Dev/Staging environments.
   - **Production Isolation Rule**: Never add `localhost` to the authorized domains of the production project (`vertex-platform-app` / `vertex-prod`) to prevent phishing and session hijacking vulnerabilities.
9. Global UX Loading Spinners:
   - **Unified Spinner Styling**: Spinner classes (`.spinner`, `.spinner-sm` and `@keyframes spin`) are declared globally in `src/styles.scss`.
   - **Usage Standard**: Every asynchronous action button (such as store creation submit or generating a manual password reset key) must show a spinning `.spinner-sm` loader inside the button state while loading is active (e.g. `isSubmitting()`, `isGeneratingLink()`) to provide smooth visual feedback and disable duplicate submissions.
