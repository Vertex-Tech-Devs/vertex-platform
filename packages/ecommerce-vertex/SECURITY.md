# Security Policy

## Supported Versions

| Project | Supported |
| --- | --- |
| `main` | Yes |
| `develop` | Best effort |
| Feature branches | No |

## Reporting a Vulnerability

If you discover a security issue, report it privately.

1. Do not open a public issue with exploit details.
2. Send the report to the security maintainers through private channels.
3. Include:
   - affected component and version
   - impact assessment
   - reproduction steps
   - suggested mitigation (if available)

## Response Targets

- Initial triage: within 48 hours
- Risk classification: within 5 business days
- Patch timeline: based on severity and operational risk

## Disclosure Policy

- Coordinated disclosure is required.
- Public disclosure should happen only after mitigation is deployed.

## Hard Requirements

- Never commit credentials, tokens, or private keys.
- Keep protected branches and required checks enabled for release flow.
- Use least-privilege credentials for CI/CD and deploy automation.
