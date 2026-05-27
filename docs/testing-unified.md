# Unified Testing Runbook (vertex-platform + ecommerce-vertex)

This runbook defines one quality criterion for both repositories and for the cross-repo lifecycle.

## 1. Prerequisites

- Both repositories checked out as sibling folders:
  - `vertex-platform`
  - `ecommerce-vertex`
- Node.js 22.x
- Chrome installed (for Cypress)
- Firebase CLI authenticated for local app startup (if your local setup requires it)

## 2. Fast validation by repository

### vertex-platform

```bash
cd vertex-platform
npm ci --legacy-peer-deps
npm run lint
npm run typecheck
npm test
npm run e2e:ci
cd functions && npm ci && npm test && cd ..
```

### ecommerce-vertex

```bash
cd ecommerce-vertex
npm ci
npm run lint
npm run typecheck
npm run test:ci
npm run e2e:ci
npm run test:integration
cd functions && npm ci && npm audit --audit-level=high && cd ..
```

## 3. Cross-repo integration lifecycle (single command)

From `vertex-platform`:

```bash
npm run test:integration:env
```

What it does:

1. Ensures dependencies are installed in both repos.
2. Starts `vertex-platform` on `http://127.0.0.1:4200`.
3. Starts `ecommerce-vertex` on `http://127.0.0.1:4201`.
4. Runs Playwright integration spec:
   - create store in platform
   - open storefront catalog
   - preload cart and open checkout
   - verify admin orders route shell
   - return to platform store detail

## 4. CI policy (unified)

- Both repos run quality-gate with lint, typecheck, tests, build, security audit.
- PRs into `main` trigger Playwright integration jobs.
- In `vertex-platform`, cross-repo CI requires `CROSS_REPO_PAT` secret to clone `ecommerce-vertex`.

## 5. Merge and deploy flow

1. Merge feature branches into `develop` in both repos.
2. Validate green CI in both repos.
3. Open PR `develop -> main` in both repos.
4. Merge after approvals.
5. Verify production deploy workflows completed.

## 6. Recommended release checklist

```bash
# In each repo before opening PR to main
npm run lint
npm run typecheck
npm run build
npm run e2e:ci
```

And for `vertex-platform`:

```bash
npm run test:integration
```

## 7. Local push guardrails (enforced by Husky)

Both repositories now enforce strict `pre-push` gates.

- Direct push to `develop` and `main` is blocked.
- Push from feature branches is blocked unless all required quality checks pass.

Current enforced checks:

- `ecommerce-vertex`: lint, typecheck, unit tests, production build, Cypress E2E, Playwright integration.
- `vertex-platform`: lint, typecheck, frontend tests (non-watch), production build, Cypress E2E, Playwright cross-repo integration, functions tests.
