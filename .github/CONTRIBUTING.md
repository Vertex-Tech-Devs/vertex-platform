# Contributing Guide

## Branching and Releases

- develop: integration branch
- main: release branch
- Feature branches: created from develop and merged back into develop

Release promotion must always happen via PR from develop to main.
After each release merge, execute a main to develop back-merge PR to avoid divergence.

## Commit Convention

This repository uses Conventional Commits.

Allowed types:

- feat
- fix
- docs
- style
- refactor
- perf
- test
- ci
- chore
- revert

## Local Quality Gate

Quality policy is strict: changes must be delivered with 0 errors and 0 warnings in local validation, CI, and editor diagnostics.

Run before pushing:

```bash
npm run lint
npm run typecheck
npm run test
npm run build:prod
cd functions && npm run test && npm run build && cd ..
```

## Pull Request Checklist

- Scope is clear and minimal
- Tests updated when behavior changes
- No secrets committed
- CI checks are green
- No errors or warnings remain in lint, typecheck, tests, build, or editor diagnostics
- Release governance policy respected

## Security Rules

- Never commit credentials or private keys.
- Use managed secret stores for operational secrets.
- Keep least privilege on CI/CD identities.
