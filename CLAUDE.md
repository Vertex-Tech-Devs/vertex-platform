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

| Env | Firebase project | URL | Deploy |
|-----|-----------------|-----|--------|
| Production | `vertex-platform-app` | https://vertex-platform-app.web.app | `npm run deploy:prod` |
| Development | `vertex-platform-dev` | https://vertex-platform-dev.web.app | `npm run deploy:dev` |

Owner account for prod: `vertex.tech.dev@gmail.com` (stored in Secret Manager as `platform-owner-credentials`).
Owner account for dev: `juan.l.espeche@gmail.com` (personal ADC).

## Functions architecture

Entry: `functions/src/index.ts` (re-exports only — no logic)

| Module | Functions |
|--------|-----------|
| `admin.ts` | `manageAdmin`, `listAdmins` |
| `provisioning.ts` | `provisionStore`, `runProvisioning` |
| `stores.ts` | `redeployStore`, `deleteStore`, `connectDomain`, `getActiveStores` |
| `billing.ts` | `listBillingAccounts`, `addBillingAccount`, `updateBillingAccount`, `removeBillingAccount` |
| `helpers.ts` | `getOwnerOAuthClient`, `getGitHubPat`, `apiFetch`, `retry`, `pollOperation`, `pickBillingAccount` |
| `types.ts` | All shared interfaces |

## Provisioning flow

1. Admin calls `provisionStore` → creates Firestore doc with `status: 'provisioning'`
2. `runProvisioning` Firestore trigger fires → 9 sequential GCP steps tracked in `provisioningSteps`
3. Step 7 (`initAdmin`) creates the store admin Firebase Auth user, sets `admin: true` claim, sends password-reset invite email
4. Step 9 (`triggerDeploy`) dispatches `repository_dispatch` to `Vertex-Tech-Devs/ecommerce-vertex`
5. ecommerce-vertex CI builds Angular app with store's Firebase config and deploys to store's hosting

Steps are idempotent: each step checks its current status (`done`) before executing — safe to retry.

## Key secrets (Secret Manager — vertex-platform-app)

- `platform-owner-credentials`: OAuth2 ADC JSON for `vertex.tech.dev@gmail.com` — used to create GCP projects
- `github-pat`: GitHub PAT with `repo` scope — used to dispatch `repository_dispatch` events
- `deploy-token`: Shared token for machine-to-machine auth on `getActiveStores`

## Firestore schema

```
stores/{storeId}
  status: 'provisioning' | 'active' | 'suspended' | 'error'
  slug: string (unique, 3-20 chars, [a-z0-9-])
  firebaseProjectId: 'vtx-{slug}'
  billingAccountId: string
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
