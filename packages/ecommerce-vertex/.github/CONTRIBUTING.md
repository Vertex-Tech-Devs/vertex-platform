# Contributing Guide

Thank you for using this template! This guide covers how to set up the project locally, work with the codebase, and contribute improvements back.

---

## Prerequisites

| Tool | Version | Install |
|------|---------|---------|
| Node.js | 22.x LTS | [nodejs.org](https://nodejs.org) |
| Angular CLI | 20.x | `npm install -g @angular/cli` |
| Firebase CLI | latest | `npm install -g firebase-tools` |

---

## Local Setup

1. **Clone and install dependencies**

   ```bash
   git clone <your-repo-url>
   cd ecommerce-vertex
   npm install
   ```

2. **Configure environment**

   The `postinstall` script copies `environment.example.ts` to `environment.ts` automatically.
   Open `src/environments/environment.ts` and fill in your values:

   ```ts
   export const environment = {
     production: false,
     firebaseConfig: {
       apiKey: '...',
       authDomain: '...',
       projectId: '...',
       storageBucket: '...',
       messagingSenderId: '...',
       appId: '...',
     },
     mercadoPago: {
       publicKey: 'TEST-...',  // MercadoPago public key (TEST- prefix for sandbox)
     },
     api: {
       cloudFunctionsUrl: 'http://127.0.0.1:5001/<project-id>/us-central1',
     },
     features: {
       seedDataEnabled: true,   // Show the seed-data panel in dev mode
       debugLogging: true,
     },
   };
   ```

3. **Connect to Firebase**

   ```bash
   firebase login
   firebase use --add   # select your development project
   ```

4. **Start the dev server**

   ```bash
   npm start            # http://localhost:4200
   ```

---

## Branching Strategy

| Branch type | Pattern | Example |
|-------------|---------|---------|
| Feature | `feat/<short-description>` | `feat/product-filters` |
| Bug fix | `fix/<short-description>` | `fix/cart-total-rounding` |
| Chore / infra | `chore/<short-description>` | `chore/update-dependencies` |
| Documentation | `docs/<short-description>` | `docs/readme-setup` |

**Base branch:** always branch off `develop`. Only `develop` → `main` merges happen at release time.

> [!IMPORTANT]
> **Norma de Permanencia de Ramas:** Las ramas `develop` y `main` son ramas de largo ciclo de vida y **JAMÁS se deben eliminar** bajo ninguna circunstancia. Cualquier acción manual o automática que intente removerlas o alterar su persistencia histórica está terminantemente prohibida.

---

## Commit Convention

This project uses [Conventional Commits](https://www.conventionalcommits.org/).
Commitlint is enforced via a Husky hook.

```
<type>(<optional-scope>): <subject>

<optional body>

<optional footer>
```

Allowed types: `feat`, `fix`, `docs`, `style`, `refactor`, `perf`, `test`, `ci`, `chore`, `revert`

Rules:
- Type and scope must be **lowercase**
- Subject must **not** be capitalized (no `Start-Case`, no `UPPER-CASE`)
- Subject must **not** end with a period
- Header max 72 characters
- Body and footer must be preceded by a blank line

Examples:

```
feat(cart): add quantity selector to cart items

fix(auth): prevent redirect loop on token expiry

chore(deps): update angular to v20.1
```

---

## Running Tests

### Unit tests

```bash
npm test              # run once with coverage report
npm run test:ci       # headless Chrome (for CI)
```

Coverage thresholds (configured in `angular.json`): **40%** minimum for statements, branches, functions, and lines.

### E2E tests

```bash
npm run e2e:open      # open Cypress interactive mode
npm run e2e           # headless run
npm run e2e:ci        # headless Chrome (for CI)
```

---

## Before Opening a PR

Quality policy is strict: changes must be delivered with 0 errors and 0 warnings in local validation, CI, and editor diagnostics.

- [ ] `npm run lint` passes with 0 errors
- [ ] `npm run typecheck` passes with 0 errors
- [ ] `npm test` passes and coverage does not drop below thresholds
- [ ] No warnings remain in lint, typecheck, tests, build, or editor diagnostics
- [ ] No `console.log` left in production code
- [ ] New components/services have at least a basic `.spec.ts`
- [ ] Commit messages follow the Conventional Commits format
- [ ] PR description explains **what** and **why**, not just what files changed

---

## Proactive Quality Policy

Work must be proactive, not reactive. For every change, anticipate the next obvious failure points and validate them before requesting review.

- Validate adjacent impact, not only touched files.
- Pre-check likely breakpoints: auth/session flows, CI gates, build output, environment-specific behavior.
- If a change can reasonably trigger a follow-up error, include the preventive fix in the same PR.
- Avoid merge-then-fix cycles when a probable issue is already visible during implementation.

---

## PR Monitoring Policy

To avoid unnecessary polling and token usage, use long-interval monitoring for PR checks.

- Preferred command: `gh pr checks <PR_NUMBER> --watch --interval 300`
- Default interval: 300 seconds (5 minutes). Use 600 seconds for long-running release checks.
- Do not run repeated manual checks every few seconds.

Alternative notifications:

- Enable GitHub notifications for participating PRs (`Watching` -> `Custom` -> `Pull requests`).
- Rely on GitHub email/mobile notifications when checks complete.
- Use `gh pr merge <PR_NUMBER> --auto --merge` when repository settings allow auto-merge.

---

## Dependency PR Policy

Dependency updates must stay manageable and low-noise.

- Prefer grouped updates over many isolated PRs.
- Keep open dependency PR volume intentionally low.
- Merge dependency PRs through `develop` first, then promote via release PR to `main`.
- Prioritize security-related updates; defer low-risk churn when there is no operational value.

---

## Code Standards

- **File length:** keep files under ~300 lines. Split by responsibility if needed.
- **Linting:** ESLint strict config is enforced. Run `npm run fix` to auto-fix formatting.
- **Type safety:** no `any` — use explicit types or generics.
- **Imports:** use `import type` for type-only imports; runtime DI tokens must use value imports.
- **Signals:** prefer Angular Signals for local reactive state; use RxJS only for async streams.
- **Standalone components:** all new components must be standalone (`standalone: true`).

---

## Project Structure

```
src/
├── app/
│   ├── core/              # Services, models, guards — shared app-wide
│   │   ├── services/
│   │   ├── models/
│   │   └── guards/
│   ├── features/
│   │   ├── admin/         # Admin dashboard (products, categories, orders)
│   │   └── shop/          # Customer-facing storefront
│   └── shared/            # Reusable components and pipes
├── environments/          # environment.ts (gitignored) + environment.example.ts
└── assets/
functions/                 # Firebase Cloud Functions (Node.js)
cypress/                   # E2E tests
.github/
├── workflows/             # CI, deploy, stale PR automation
└── dependabot.yml
```

---

## Deploying

```bash
npm run deploy:dev    # build + deploy to Firebase dev project
npm run deploy:prod   # build + deploy to Firebase prod project
```

Both commands require `firebase use` to point at the correct project.
