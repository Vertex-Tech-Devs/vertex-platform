# Scalability Roadmap

## Why this document exists

The current provisioning model creates one Google Cloud project per store. That model is now a business risk.

- Google Cloud project quota is a hard commercial bottleneck for store creation.
- Projects in `DELETE_REQUESTED` continue counting against quota until permanent deletion.
- Quota requests for `projects_count` are not currently automatable from the CLI used in this repo.
- Billing account rotation does not solve project quota exhaustion.

This document defines the target architecture and the migration plan that removes project creation from the critical path for new stores.

## Business goal

- Support 100+ stores per runtime account/project shard.
- Make new store creation independent from `projects.create` quota.
- Preserve a path for premium isolated tenants when needed.
- Keep operations predictable and supportable for a small team.

## Current model

Current default:

- `vertex-platform` provisions a dedicated GCP/Firebase project per store.
- `ecommerce-vertex` is deployed per store with a store-specific `firebase-config.json`.
- Custom domains are attached to the dedicated Firebase Hosting project of that store.

Why this fails at scale:

- Store creation is blocked by `cloudresourcemanager` project quota.
- Old `DELETE_REQUESTED` projects can continue consuming quota for 30+ days.
- Store deployment latency scales with project creation, API enablement, Firebase activation, and store-specific CI/CD.
- The marginal infrastructure cost per store is unnecessarily high.

## Target model

### Default runtime mode: shared shard

Each shard is one shared Firebase/GCP runtime project that hosts many stores.

- One shard serves many tenants.
- A new store is assigned to a shard instead of creating a new project.
- The storefront resolves the tenant by hostname at runtime.
- Data, auth, storage, and functions are logically isolated by `tenantId`.

### Optional runtime mode: dedicated project

Reserved for premium or enterprise cases only.

- Explicit upsell feature, not the default.
- Higher setup latency and higher infrastructure cost are acceptable because they are monetized.

## Capacity model

Initial operational target:

- 100 stores per shard.
- Provision the next shard when a shard reaches 70-80 active stores.

Why 100 is a safe starting point:

- It reduces project-creation frequency by two orders of magnitude compared to the current model.
- It leaves headroom for Firestore indexes, Auth usage, Storage growth, and traffic spikes.
- It keeps incident blast radius bounded while the team learns real usage patterns.

Potential expansion path:

- 150-250 stores per shard after observing production traffic, Firestore usage, cold starts, and Storage growth.
- Do not raise the limit before having tenant-level metrics and load thresholds.

## Required product architecture changes

### 1. Storefront runtime configuration

Current storefront boot flow loads one `firebase-config.json` per deployment.

Target behavior:

- Boot with a shard-level Firebase config.
- Resolve the current tenant from `location.host`.
- Fetch tenant configuration from the platform or shard configuration store.
- Load branding, catalog, content, and settings using `tenantId`.

Implication:

- Per-store deploys are removed for shared-shard tenants.
- A shard deploy updates the storefront once for many stores.

### 2. Tenant-aware data model

Every tenant-owned record must be partitioned by `tenantId`.

Recommended structure:

```text
tenants/{tenantId}
tenants/{tenantId}/products/{productId}
tenants/{tenantId}/categories/{categoryId}
tenants/{tenantId}/orders/{orderId}
tenants/{tenantId}/clients/{clientId}
tenants/{tenantId}/settings/storeConfig
```

Rules:

- No cross-tenant reads without explicit admin privilege.
- No collection scans across all tenants in request paths.
- Every query path must include `tenantId` in the lookup or in the document path.

### 3. Tenant-aware auth

Shared Firebase Auth per shard requires memberships rather than project isolation.

Recommended approach:

- Store admin membership documents by tenant.
- Use custom claims only for coarse roles like `platformAdmin`.
- Resolve tenant-scoped permissions in application code and Firestore rules.

### 4. Shard registry in platform

New collection in `vertex-platform`:

```text
shards/{shardId}
  environment: 'development' | 'production'
  runtimeMode: 'shared-shard'
  projectId: string
  siteId: string
  region: string
  status: 'active' | 'draining' | 'maintenance'
  maxStores: number
  activeStores: number
  reservedStores: number
  currentTemplateVersion: string
  currentDataVersion: string
  createdAt: Timestamp
  updatedAt: Timestamp
```

Additional store fields:

```text
stores/{storeId}
  runtimeMode: 'shared-shard' | 'dedicated-project'
  shardId?: string
  tenantId: string
  runtimeProjectId: string
  runtimeSiteId?: string
```

### 5. Provisioning v2

Provisioning for shared shards should become:

1. `assignShard`
2. `createTenantRecord`
3. `seedTenantData`
4. `createTenantAdmin`
5. `connectDomain`
6. `publishTenant`

Remove from the critical path for shared shards:

- `createProject`
- `linkBilling`
- `addFirebase`
- `enableApis`
- `createWebApp`

## Operational guardrails

### Capacity

- Alert when a shard reaches 70 stores.
- Stop new assignments to a shard at 90 stores unless explicitly overridden.
- Keep at least one empty shard ready in production.

### Security

- Firestore rules must deny access when `tenantId` mismatches.
- Background jobs must operate on explicit tenant scopes only.
- Storage paths must be namespaced by tenant.
- Admin APIs must validate both operator role and target tenant.

### Performance

- Keep indexes tenant-scoped.
- Avoid tenant-agnostic aggregate queries in user-facing flows.
- Track per-shard store count, document count, Storage usage, and request latency.

### Releases

- Shared shards require a rollout strategy per shard, not per store.
- Backward compatibility for dedicated-project stores must be maintained until migration is complete.

## Migration plan

### Phase 0: Freeze the problem

- Do not invest further in one-project-per-store as the default path.
- Keep dedicated-project provisioning only as a temporary compatibility mode.
- Treat project quota issues as an architectural blocker, not as an operational annoyance.

### Phase 1: Introduce shared-shard metadata

- Add `shards` collection.
- Add `runtimeMode`, `shardId`, `tenantId`, and `runtimeProjectId` to stores.
- Keep dedicated-project stores supported.

### Phase 2: Storefront runtime boot refactor

- Replace per-store `firebase-config.json` assumption with shard-level boot.
- Resolve tenant by hostname.
- Load tenant config dynamically.

### Phase 3: Provisioning v2

- Implement shard assignment.
- Implement tenant seeding instead of project seeding.
- Remove `repository_dispatch` dependency for shared-shard tenants.

### Phase 4: Domain automation

- Attach custom domains to shard hosting.
- Map domain -> tenant in platform metadata.

### Phase 5: Commercial split

- Standard plans: shared-shard runtime.
- Premium plans: dedicated-project runtime.

## Explicit non-goals

- Do not promise infinite stores in a single shard.
- Do not mix tenant data without hard technical boundaries.
- Do not migrate existing dedicated tenants until shared-shard runtime is stable.
- Do not ship shared shards without tenant-aware security rules and observability.

## Acceptance criteria

The migration is considered successful when all of the following are true:

- New standard-plan stores do not call `projects.create`.
- A single shard can reliably host 100 active stores.
- Tenant resolution is based on hostname and runtime metadata.
- Shared-shard stores do not require per-store CI/CD deploys.
- Dedicated-project mode remains available for premium exceptions.
- Store creation is no longer blocked by GCP project quota under normal growth.