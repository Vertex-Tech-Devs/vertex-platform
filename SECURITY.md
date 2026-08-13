# Security Policy

## Supported Versions

We support security updates for the active development and release branches.

## Reporting a Vulnerability

Please report security vulnerabilities by emailing security@vertex.tech or opening a private report on GitHub.

## Threat Model — Multi-tenant e-commerce

### Superficie de ataque

- **Panel SaaS** (`vertex-platform`): acceso solo con claims `platformAdmin`/`superAdmin`
  verificados en cada callable (onCall). Gestión de roles protegida con rate-limit
  (`checkRateLimit`) y auditoría (`logAuditAction` → colección `auditLog`).
- **Storefront público** (catálogo): lectura pública; **escritura aislada por tienda**
  (rules: `isStoreAdmin()` con `tenantId == storeId`). Nunca se usa
  `allow write: if isAuthenticated()` genérico — rompería el aislamiento multi-tenant.
- **Firestore del platform** (plano de control): catch-all `match /{document=**}` con
  `allow read, write: if isPlatformAdmin()` — cualquier colección no declarada queda
  bloqueada por defecto.
- **Storage**: escritura solo con claims de admin/plataforma (`storage.rules`).
- **Webhooks y checkout**: endpoints públicos necesarios (Mercado Pago, checkout de
  invitado, `refreshMyAdminClaim`) con validación de input (zod) y sin credenciales en
  el cliente; el token de Mercado Pago vive en **Secret Manager** (nunca en el bundle).

### Controles clave

| Control | Dónde |
|---|---|
| Validación de claims en todas las callables | `functions/src/*` |
| Rate-limit en mutadores (admin, billing, staff, provisioning) | `checkRateLimit` |
| Auditoría de acciones de rol/tienda | `logAuditAction` |
| OIDC (GitHub Actions) para `completeStoreDeployment` | `github-oidc.ts` |
| Secrets: tokens de MP por tienda en Secret Manager | `mercadopago.service.ts` |
| Redirect URI OAuth por shard (único paso manual) | `check-oauth-redirects.ts` + banner panel |
| CI: CodeQL + npm audit + lint/typecheck/tests | GitHub Actions |

### Prácticas

- No commitear `.env` ni tokens (verificado en CI: `git ls-files`).
- Dependencias: `npm audit` en CI; sin vulnerabilidades críticas/altas conocidas.
- Reportes de vulnerabilidades: `security@vertex.tech` o reporte privado en GitHub.
