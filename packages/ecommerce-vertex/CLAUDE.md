# ecommerce-vertex — Agent Instructions

## What this repo is

Angular e-commerce template deployed to each tenant store's Firebase project.
Every store gets its own isolated Firebase project with this app deployed to it.
The app reads store configuration from the store's own Firestore (`settings/storeConfig`).

## Tech stack

- **Framework**: Angular 21, standalone components, signals, SCSS
- **Backend**: Firebase Functions v2, TypeScript
- **Database**: Firestore (per-store project)
- **Hosting**: Firebase Hosting (per-store project)
- **CI/CD**: GitHub Actions

## Environments

| Trigger | Workflow | Description |
|---------|----------|-------------|
| Push to `develop` | validate → build-dev → deploy-dev | Deploy to `ecommerce-vertex-dev` |
| Push to `main` | validate → build-prod → deploy-prod | Deploy to `ecommerce-vertex` |
| `repository_dispatch: provision-store` | provision-store | Deploy to a client store's project |

## Provisioning flow

When `vertex-platform`'s `runProvisioning` completes step 8, it sends:
```json
{
  "event_type": "provision-store",
  "client_payload": {
    "project_id": "vtx-{slug}",
    "firebase_config": "{\"apiKey\":\"...\"}",
    "store_id": "...",
    "store_name": "..."
  }
}
```

The `provision-store` GitHub Actions job:
1. Generates `src/environments/environment.prod.ts` from the store's Firebase config
2. Builds with `npm run build` (production)
3. Writes a minimal `firebase.json` (hosting only, SPA rewrites)
4. Authenticates using `FIREBASE_SERVICE_ACCOUNT_PLATFORM` (SA key of vertex-platform-app's firebase-adminsdk)
5. Deploys hosting to `--project {project_id}` with `--only hosting`

## Key secrets (GitHub — Vertex-Tech-Devs/ecommerce-vertex)

- `FIREBASE_SERVICE_ACCOUNT_DEV`: SA key for `ecommerce-vertex-dev` deploy
- `FIREBASE_SERVICE_ACCOUNT_PROD`: SA key for `ecommerce-vertex` deploy
- `FIREBASE_SERVICE_ACCOUNT_PLATFORM`: SA key for `firebase-adminsdk-fbsvc@vertex-platform-app.iam.gserviceaccount.com` — used to deploy to client store projects (this SA is granted `roles/owner` on each provisioned project)
- `FIREBASE_API_KEY`, `FIREBASE_AUTH_DOMAIN`, etc.: Firebase config for dev/prod environments
- `MERCADOPAGO_ACCESSTOKEN`, `MERCADOPAGO_WEBHOOK_URL`, `SITE_URL`: Payment integration for functions

## Critical constraints

- **Never modify the `provision-store` job** without coordinating with vertex-platform — it's called remotely
- **`src/environments/environment.prod.ts`** is gitignored and generated at build time
- **`firebase.json`** in the provision-store job is overwritten at runtime — the committed one is for dev/prod only
- The `FIREBASE_SERVICE_ACCOUNT_PLATFORM` SA must have `roles/owner` on every provisioned store project
- Store admin login (`/admin/login`) is Google OAuth-only; do not reintroduce email/password login paths
- Access authorization is driven by `admin_roles/{email}` in each store Firestore project
- Valid store admin roles are `admin`, `warehouse`, `fulfillment`, `analyst`; role changes must propagate to custom claims

## Local development

```bash
npm ci
npm run start          # Angular dev server
npm run lint           # ESLint (ng lint)
npm run typecheck      # tsc --noEmit
npm run test:ci        # Vitest tests

cd functions
npm ci
npm run build
firebase emulators:start
```
