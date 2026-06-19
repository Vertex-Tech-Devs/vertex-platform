# Universal Agent Rules (agent.md)

This file contains universal instructions for AI agents and developers working on the Platform repository.

## 💻 Development Commands
* **Start local server (Orchestrator):** `npm run start` (Launches E2E development environment with hot-reloading)
* **Start containerized environment:** `bash docker/start.sh` (Spins up all microservices and emulators using Docker)
* **Linting:** `npm run lint` (Checks style & formatting rules)
* **Type checking:** `npm run typecheck` (Runs strict compiler check)
* **Unit Tests (Vitest - Backend):** `cd vertex-platform/functions && npm run test`
* **Build (Backend):** `cd vertex-platform/functions && npm run build`
* **E2E Integration Tests (Cypress):** `npm run e2e:ci`

## 🛠️ Code & Architecture Guidelines
* **Type Safety:** Use strict type checks. Always handle caught exceptions in catch blocks as `unknown` and apply appropriate type guards.
* **GCP API Performance & Latency:** Cloud Functions *must* instantiate Google Cloud SDK clients (e.g. `SecretManagerServiceClient`) once in the global module scope to avoid re-initialization latencies. Re-use the shared client exported from `helpers.ts`.
* **In-Memory Caching:** Cache resolved secrets (e.g., GCP deploy token) in module-scoped variables or maps to prevent redundant GCP API calls, reducing cost and latency.
* **Firebase Functions Config:** Aprovisionamiento-related tasks or latency-prone operations should be provisioned with adequate resources (e.g., memory of `512MiB`/`1GiB` and timeout of `300s`/`540s` as configured in `provisionStore` and `runProvisioning`).

## 🔄 Git Flow & PR Governance
* **Branch Protection:** Direct pushes to permanent branches `develop` and `main` are strictly blocked.
* **Pull Request Workflow:** Branch out from `develop` (`feat/*`, `fix/*`, `chore/*`) and merge via approved Pull Request.
* **CI Hooks Bypass:** If host dependency resolution issues prevent pre-commit or pre-push Husky checks from running, bypass them locally using the `--no-verify` flag:
  ```bash
  git commit -m "commit message" --no-verify
  git push origin branch-name --no-verify
  ```
