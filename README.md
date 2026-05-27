# Vertex Platform

Control plane for tenant provisioning, operations, and governance in the Vertex ecosystem.

Resumen ES: plataforma de control para crear, operar y gobernar tiendas multi-tenant.

## Quick Start (10 minutes) / Inicio Rapido (10 minutos)

### EN

1. Install dependencies.
2. Authenticate Firebase and Google Cloud.
3. Start the app.
4. Run baseline quality checks.

### ES

1. Instala dependencias.
2. Autentica Firebase y Google Cloud.
3. Inicia la app.
4. Ejecuta validaciones base.

Commands:

```bash
npm ci --legacy-peer-deps
cd functions && npm ci && cd ..
firebase login
gcloud auth application-default login
gcloud auth application-default set-quota-project vertex-platform-dev
npm run start
npm run lint && npm run typecheck
```

## Contents

- Overview / Resumen
- Architecture / Arquitectura
- Environments / Entornos
- Setup and Commands / Configuracion y Comandos
- Quality and Testing / Calidad y Testing
- Deploy and Release Governance / Despliegue y Gobernanza
- Access Control / Control de Acceso
- Incident Runbooks / Runbooks de Incidentes
- Documentation Index

## Overview / Resumen

### EN

Vertex Platform orchestrates tenant lifecycle operations and cross-repo integrations with ecommerce templates.

### ES

Vertex Platform orquesta el ciclo de vida de tenants y la integracion cross-repo con templates ecommerce.

Core capabilities:

- Tenant provisioning and lifecycle management
- Runtime and capacity administration
- Billing account management
- Platform user and role administration
- Cross-repo integration orchestration

## Architecture / Arquitectura

Stack:

- Frontend: Angular 21, standalone components, signals
- Backend: Firebase Functions v2 + v1 triggers (TypeScript)
- Data: Firestore
- Auth: Firebase Auth + custom claims
- CI/CD: GitHub Actions

Main backend modules:

- functions/src/admin.ts
- functions/src/provisioning.ts
- functions/src/stores.ts
- functions/src/billing.ts
- functions/src/versioning.ts

## Environments / Entornos

| Environment | Project ID | URL |
| --- | --- | --- |
| Development | vertex-platform-dev | https://vertex-platform-dev.web.app |
| Production | vertex-platform-app | https://vertex-platform-app.web.app |

Recommended operator split:

- Dev operations: juan.l.espeche@gmail.com
- Prod operations: vertex.tech.dev@gmail.com

## Setup and Commands / Configuracion y Comandos

Prerequisites:

- Node.js 20+
- npm 10+
- Firebase CLI
- Google Cloud SDK

Core commands:

```bash
# App
npm run start
npm run build:dev
npm run build:prod
npm run lint
npm run typecheck
npm test
npm run e2e:ci

# Integration and QA
npm run test:integration
npm run test:integration:ui
npm run test:integration:env
npm run qa
npm run qa:full

# Functions
cd functions
npm run build
npm run test

# Deploy
npm run deploy:dev
npm run deploy:prod
```

## Quality and Testing / Calidad y Testing

Local baseline:

- lint
- typecheck
- unit tests
- build

CI required gates:

- CI workflow
- CodeQL workflow
- Deploy workflow
- Cross-repo integration gate (when configured)

## Deploy and Release Governance / Despliegue y Gobernanza

Long-lived branches:

- develop = integration
- main = release

Mandatory policy:

1. Promote only with PR develop -> main.
2. Back-sync with PR main -> develop after release.
3. No direct push bypass on protected branches.
4. Do not merge with delete-branch when PR head is main or develop.

## Access Control / Control de Acceso

Authorization model:

- platformAdmin claim: required for platform operations
- superAdmin claim: required for role administration

Protected super-admin baseline (enforced):

- juan.l.espeche@gmail.com
- vertex.tech.dev@gmail.com

Enforcement behavior:

- Protected accounts are auto-seeded as superAdmin in platformAdmins.
- Protected accounts cannot be removed by standard role flows.
- Claim drift is corrected by synchronization logic.
- New auth records for protected users are elevated automatically.

Manual recovery:

```bash
npm run add-admin juan.l.espeche@gmail.com -- --dev
npm run add-admin juan.l.espeche@gmail.com
npm run add-admin vertex.tech.dev@gmail.com -- --dev
npm run add-admin vertex.tech.dev@gmail.com
```

After changes, user must sign out and sign in again.

## Incident Runbooks / Runbooks de Incidentes

### 1) Main branch appears red / Main en rojo

1. Inspect latest main runs.
2. If stale/cancelled required contexts exist, create clean sync PR develop -> main.
3. Wait for required checks to pass.
4. Merge through protected flow.

### 2) Deploy fails on Cloud Scheduler permissions

1. Ensure cloudscheduler.googleapis.com is enabled.
2. Ensure deployment principal has scheduler update permissions.
3. Re-run failed Deploy workflow.

### 3) Login denied with unauthorized access

1. Validate missing platformAdmin claim.
2. Re-assign role using add-admin script.
3. User signs out/signs in.

## Documentation Index

- docs/development.md
- docs/testing-unified.md
- docs/scalability-roadmap.md
- docs/email-provisioning.md
- docs/github-rulesets.md
- .github/CONTRIBUTING.md
- .github/dependabot.yml
- SECURITY.md
- .github/CODEOWNERS

Maintainer note: keep this README as canonical operational documentation. Use docs/ for deep-dive specifications and link them here.
