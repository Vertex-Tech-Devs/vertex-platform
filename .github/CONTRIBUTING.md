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

## Proactive Quality Policy

Work must be proactive, not reactive. For every change, anticipate the next obvious failure points and validate them before requesting review.

- Validate adjacent impact, not only touched files.
- Pre-check likely breakpoints: auth/session flows, CI gates, build output, environment-specific behavior.
- If a change can reasonably trigger a follow-up error, include the preventive fix in the same PR.
- Avoid merge-then-fix cycles when a probable issue is already visible during implementation.

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

## PR Monitoring Policy

To avoid unnecessary polling and token usage, use long-interval monitoring for PR checks.

- Preferred command: `gh pr checks <PR_NUMBER> --watch --interval 300`
- Default interval: 300 seconds (5 minutes). Use 600 seconds for long-running release checks.
- Do not run repeated manual checks every few seconds.

Alternative notifications:

- Enable GitHub notifications for participating PRs (`Watching` -> `Custom` -> `Pull requests`).
- Rely on GitHub email/mobile notifications when checks complete.
- Use `gh pr merge <PR_NUMBER> --auto --merge` when repository settings allow auto-merge.

## Dependency PR Policy

Dependency updates must stay manageable and low-noise.

- Prefer grouped updates over many isolated PRs.
- Keep open dependency PR volume intentionally low.
- Merge dependency PRs through `develop` first, then promote via release PR to `main`.
- Prioritize security-related updates; defer low-risk churn when there is no operational value.

## Security Rules

- Never commit credentials or private keys.
- Use managed secret stores for operational secrets.
- Keep least privilege on CI/CD identities.
