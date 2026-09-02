# Changelog — Vertex Platform (`vertex-platform`)

Todos los cambios notables en este proyecto serán documentados en este archivo.
El formato está basado en [Keep a Changelog](https://keepachangelog.com/es-ES/1.0.0/) y este proyecto adhiere a [Semantic Versioning](https://semver.org/lang/es/).

---

## [0.8.0] - 2026-09-02

### 🧪 Calidad, Testing & Quality Gates
- **Quality Gate Obligatorio ≥95% (100% Ideal)**: Se estableció un umbral mínimo estricto y no negociable del **95%** en las 4 métricas de cobertura (`statements`, `branches`, `functions`, `lines`) en todo el frontend (`vertex-platform`) y backend (`functions`).
- **Git Hooks Bloqueantes (`pre-commit` y `pre-push`)**: Se configuraron hooks con Husky y scripts de validación (`verify-coverage.js`) que bloquean automáticamente cualquier `git commit` o `git push` si la cobertura es menor al 95%.
- **Suite de Tests Unitarios Exhaustiva**:
  - 197 tests unitarios en Frontend (Angular 22+ / Vitest).
  - 75 tests unitarios en Backend (Cloud Functions v2 / Vitest con cobertura V8).
  - Total: **272 tests unitarios pasando al 100%**.

### 💳 Suscripciones SaaS, Facturación & Portales de Pago
- **Módulo de Suscripciones SaaS Vertex (`/settings/subscriptions`)**:
  - Diseño responsivo y modular con panel de configuración centralizada de recaudación mediante Mercado Pago Access Token.
  - Indicadores en tiempo real: MRR estimado, recaudación anual proyectada, tiendas activas, en prueba, con descuento o cortesía.
  - Accesos rápidos para copiar links directos de pago y suscribir tiendas en 1 click (`/pay/:storeId` y `/subscribe/:storeId`).
- **Portal Público de Suscripción para Clientes (`/pay/:storeId` y `/subscribe/:storeId`)**:
  - Pantalla moderna con cálculo en vivo de ahorro anual ($100.000 ARS / 2 meses bonificados).
  - Integración nativa con Mercado Pago Checkout Pro y confirmación automática en `/pay/:storeId/success`.
  - Endpoint público seguro `getPublicStoreSubscriptionInfo` sin filtración de datos sensibles del backend.
- **Automatización del Ciclo de Vida de Tiendas**:
  - Períodos de prueba en días customizables (7, 14, 30 días o valor libre).
  - Modalidad de tiendas gratis 100% bonificadas permanente (`status: 'complimentary'`).
  - Scheduler diario `checkSubscriptionExpirations` con período de gracia de 5 días (`past_due`) antes de suspensión automática preventiba.
  - Webhook central `platformMercadoPagoWebhook` que procesa pagos y reactiva tiendas suspendidas en milisegundos.

### 🏬 Rubros Comerciales Dinámicos & Creación de Tiendas
- **Selector de Rubro Reutilizable (`RubroSelector`)**:
  - Buscador reactivo por nombre, descripción, ID y categorías con paginador de cards moderno.
  - Modal flotante `CustomVerticalModal` con estética dark-mode Glassmorphism para crear nuevos rubros personalizados en runtime.
- **Diseño Mejorado en Creación de Tiendas (`/stores/create`)**:
  - Bloque estilizado de suscripción y precios con selector de días de prueba y opción de tienda cortesía.
  - Selector de rubro interactivo con vista previa y métricas de capacidad de shards en tiempo real.

### 👥 Equipo & Operaciones Cloud
- **Gestión de Administradores (`/settings/team`)**:
  - ABM de administradores de plataforma con invitaciones por email y control de roles.
- **Infraestructura Cloud (`/settings/infrastructure`)**:
  - Monitor de shards GCP, ocupación física vs registrada y auto-reconciliación diaria `reconcileActiveStores`.
