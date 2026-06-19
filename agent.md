# Universal Agent Rules (agent.md)

## Development Commands
* **Start local server (Orchestrator):** `npm run start`
* **Start containerized environment:** `bash docker/start.sh`
* **Linting:** `npm run lint`
* **Type checking:** `npm run typecheck`
* **E2E Integration Tests (Cypress):** `npm run e2e:ci`
* **Functions Unit Tests (Vitest):** `cd functions && npm run test`
* **Functions Build:** `cd functions && npm run build`

## Code Guidelines
* **Type Safety:** Use strict type checks. Catch blocks must use `unknown` with type guards.
* **Firebase/Identity Toolkit:** Always initialize Auth in new projects (`initializeAuth` POST) and enable email/password sign-in. Use header `x-goog-user-project` or `quotaProject: projectId` in Identity Toolkit API calls to avoid 403s.
* **Dependencies:** Cloud functions reuse `SecretManagerServiceClient` in module scope to prevent 300ms latency on secret retrieval.
* **Git Flow:** Pushes to `develop` and `main` branches are allowed.
