# 🧪 Roadmap Completo de Testing — Vertex Platform

## Fase 1: Validación Local (CI - Ya Implementada)

### 1.1 Linting & Type Checking ✅
```bash
# Frontend
npm run lint          # ESLint
npm run typecheck     # Angular strict mode

# Backend
npm run lint -w functions  # ESLint en functions
npm run build -w functions # TypeScript compilation
```
**Estado:** ✅ Ejecutándose en GitHub Actions (`validate` job)

---

### 1.2 Unit Tests ✅
```bash
# Frontend (125 tests)
npm run test

# Backend (28 tests con coverage)
npm run test:coverage -w functions
```
**Cobertura:** 90.75% (statements + lines), 77.77% (branches), 100% (functions)  
**Umbrales:** 85% (statements/functions/lines), 60% (branches)  
**Estado:** ✅ Ejecutándose en GitHub Actions (`unit-tests` job)

---

### 1.3 Build Validation ✅
```bash
# Development build (dev env)
npm run build:dev

# Production build (prod env)
npm run build:prod
```
**Budget:** 700 KB warning / 900 KB error  
**Actual:** 622 KB (dev), 192 KB (prod) comprimido  
**Estado:** ✅ Ejecutándose en GitHub Actions (`build-dev`, `build-prod` jobs)

---

## Fase 2: Integration Tests (Cros-Repo)

### 2.1 E2E Tests — Vertex Platform ✅
```bash
# Ejecuta suite Cypress contra vertex-platform-dev
npm run e2e

# Specs:
# - Login (platform admin)
# - Crear/listar/eliminar tiendas
# - Staff invitations
# - Domain management
# - Email manager
```
**Ubicación:** `cypress/e2e/`  
**Estado:** ✅ 4 suites principales

---

### 2.2 E2E Tests — Ecommerce Vertex ✅
```bash
# Ejecuta suite Cypress contra ecommerce storefront
npm run e2e

# Specs:
# - Login (store admin)
# - Catálogo y productos
# - Carrito y checkout
# - Staff management
# - Email manager
# - Paymentz (Mercado Pago)
# - Domain rewrite
```
**Ubicación:** `cypress/e2e/`  
**Estado:** ✅ 7 suites principales

---

### 2.3 Playwright Integration Tests (Cross-Repo) ✅
```bash
# Suite de integración que toca ambos repos
cd vertex-platform
npm run test:integration        # Env prod (CROSS_REPO_PAT required)
npm run test:integration:env    # Env dev (local test)
```
**Specs:**
- Crear tienda en plataforma
- Verificar que Firestore está inicializado
- Verificar que se creó la app web de Firebase
- Verificar que se puede loguear en el storefront
- Crear producto en storefront
- Hacer order con Mercado Pago mock

**Ubicación:** `integration-tests/specs/`  
**Estado:** ✅ Suite de integración cross-repo

---

## Fase 3: Provisioning E2E (Manual / Orchestrated)

### 3.1 Aprovisionamiento Completo (11 pasos) ⚠️ NUEVO

**Flujo:**
```
1. createProject          [~2min]
2. linkBilling            [~1min]
3. addFirebase            [~2min]
4. enableApis             [~1min]
5. createWebApp           [~1min]
6. initFirestore          [~1min]
7. configureEmail         [~30s]
8. installEmailExtension  [~2-3min] ← CRÍTICO - nuevo
9. initAdmin              [~30s]
10. grantAccess           [~30s]
11. triggerDeploy         [~5min]

TOTAL: ~15-20 min
```

**Validación:**
```bash
# Script para automatizar la validación
npm run test:provision -- --dev --verbose

# Checklist automático:
✓ Proyecto GCP creado
✓ Billing vinculado
✓ Firebase habilitado
✓ APIs habilitadas
✓ Firestore database activa
✓ Email extension instalada
✓ Secret SMTP presente
✓ Storefront desplegado
✓ DNS configurado (si custom domain)
✓ Email test enviado y recibido
```

---

### 3.2 Email Delivery E2E ⚠️ NUEVO

**Flujo:**
```
1. Crear tienda
2. Invitar staff → Email debe llegar
3. Loguear como staff → Primer email de bienvenida
4. Enviar email de prueba desde Email Manager → Debe llegar
5. Crear orden → Email de confirmación a cliente
```

**Validación:**
```bash
npm run test:email-delivery -- --dev
# Espera emails en inbox de prueba configurada
```

---

## Fase 4: Performance Testing (Nuevo)

### 4.1 Aprovisionamiento Bajo Carga
```bash
npm run test:provision-load -- --concurrent 5 --dev
# Crea 5 tiendas en paralelo
# Mide tiempo de cada paso
# Reporta bottlenecks
```

**Métricas:**
- Tiempo promedio por paso
- Percentil p95 (qué tan consistente es)
- Tasa de error
- Uso de memoria en Functions

---

### 4.2 Email Under Load
```bash
npm run test:email-load -- --messages 100 --dev
# Envía 100 emails en paralelo
# Mide latencia y throughput
```

---

## Fase 5: Regresión Automática

### 5.1 Snapshot Testing
```bash
npm run test:snapshots -- --frontend --backend
# Compara builds, bundles, y tipos contra snapshot guardado
```

### 5.2 Breaking Changes Detection
```bash
npm run test:breaking-changes
# Verifica:
# - Cambios en API schemas
# - Cambios en Firestore structure
# - Cambios en Firebase Functions signatures
```

---

## 🤖 **Automatización Propuesta**

### Script: `npm run test:all` (Suite Completa)
```bash
#!/bin/bash
# verify-ci.sh

echo "🚀 Running full test suite..."

# Stage 1: Lint & Type Check (fast)
npm run lint
npm run typecheck

# Stage 2: Unit Tests with Coverage
npm run test
npm run test:coverage -w functions

# Stage 3: Build Validation
npm run build:dev
npm run build:prod

# Stage 4: E2E Tests (against test env)
npm run e2e

# Stage 5: Integration Tests
npm run test:integration:env

# Stage 6: Provisioning Validation (optional, requires secrets)
# npm run test:provision -- --dev --quick

echo "✅ All tests passed!"
```

**Tiempo total:** ~45-60 min (mayoría parallelizable)

---

### Script: `npm run test:quick` (Pre-PR)
```bash
# Solo lo esencial para un PR rápido
npm run lint && \
npm run typecheck && \
npm run test && \
npm run test:coverage -w functions && \
npm run build:dev

# Tiempo: ~15 min
```

---

### Script: `npm run test:provision` (Manual / Scheduled)
```bash
# Orchestrates full provisioning test
# Runs nightly or on-demand

steps=(
  "Creating GCP project..."
  "Linking billing..."
  "Enabling Firebase..."
  "Enabling APIs..."
  "Creating web app..."
  "Initializing Firestore..."
  "Configuring emails..."
  "Installing extension..."
  "Initializing admin..."
  "Granting access..."
  "Triggering deploy..."
)

for step in "${steps[@]}"; do
  echo "⏳ $step"
  # ... run step ...
  # ... check for errors ...
  # ... log metrics ...
done

# Sends report to Slack / Email
```

---

### GitHub Actions Workflows to Add

#### `.github/workflows/test-provision-scheduled.yml`
```yaml
name: Nightly Provisioning Test

on:
  schedule:
    - cron: '0 2 * * *'  # 2 AM every day
  workflow_dispatch:

jobs:
  provision-test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v6
      - name: Test provisioning (dev)
        run: npm run test:provision -- --dev --notify-slack
```

#### `.github/workflows/test-email-delivery.yml`
```yaml
name: Email Delivery Test

on:
  schedule:
    - cron: '*/30 * * * *'  # Every 30 min
  workflow_dispatch:

jobs:
  email-test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v6
      - name: Test email delivery
        run: npm run test:email-delivery -- --dev
```

#### `.github/workflows/test-performance.yml`
```yaml
name: Performance Benchmarks

on:
  schedule:
    - cron: '0 3 * * 0'  # Sundays at 3 AM
  push:
    branches: [main]

jobs:
  perf-test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v6
      - name: Run performance tests
        run: npm run test:perf -- --compare-baseline
      - name: Upload metrics
        uses: actions/upload-artifact@v3
        with:
          name: perf-report-${{ github.sha }}
          path: perf-results/
```

---

## 📊 Dashboard & Monitoring

### Métricas a Recopilar
```
Provisioning:
  - Duración total
  - Duración por paso
  - Tasa de error
  - Pasos que más fallan

Email:
  - Latencia de envío (p50, p95, p99)
  - Throughput (emails/sec)
  - Tasa de entrega
  - Rebotes

Frontend:
  - Bundle size trend
  - Build time
  - Test coverage trend

Backend:
  - Function execution time
  - Memory usage
  - Error rate
```

### Herramientas Sugeridas
- **Datadog / New Relic:** APM de Functions
- **Grafana:** Dashboards de métricas
- **Sentry:** Error tracking (frontend + backend)
- **Slack Notifications:** Alertas de test failures

---

## 🎯 Roadmap de Implementación

| Semana | Tarea | Automatización |
|--------|-------|---|
| Esta | ✅ Fix CI Node22 env var | PR + test run |
| Esta | ⚠️ Crear tienda de prueba e2e | Manual + Playwright |
| Próxima | Script `test:provision` | npm run + GitHub Actions |
| Próxima | Script `test:email-delivery` | npm run + scheduled workflow |
| Próxima | Dashboard de métricas | Grafana + Datadog |
| Próxima | Slack notifications | GitHub Actions + webhooks |
| Futuro | Performance benchmarking | npm run + historical comparison |

---

## ✅ Checklist para Implementar Ahora

- [ ] Mergear PR de fix CI (Node22 env)
- [ ] Crear tienda de prueba y validar aprovisionamiento completo
- [ ] Enviar 5 test emails desde Email Manager
- [ ] Verificar que staff invitation llega en email
- [ ] Documentar los 11 pasos de aprovisionamiento en runbook
- [ ] Crear script `verify-provision.sh` en `scripts/`
- [ ] Agregar GitHub Actions `test-provision-scheduled.yml`
- [ ] Configurar Slack notifications

