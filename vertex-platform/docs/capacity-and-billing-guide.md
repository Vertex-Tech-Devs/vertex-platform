# 🏢 Guía de Capacidad de Infraestructura y Facturación GCP — Vertex Solutions

Este documento describe la arquitectura de capacidad multi-tenant de **Vertex Commerce Platform**, las reglas de negocio de aprovisionamiento y el runbook operativo para escalar la capacidad de proyectos y facturación en Google Cloud Platform (GCP).

---

## 📐 Modelo de Capacidad y Reglas de Negocio

El modelo SaaS de Vertex opera con aislamiento por capas para garantizar escalabilidad, seguridad y control estricto de costos:

```
                  ┌─────────────────────────────────────┐
                  │          Billing Accounts           │
                  │   (Pool de cuentas en GCP / Admin)  │
                  └──────────────────┬──────────────────┘
                                     │ Max 5 proyectos GCP / Billing Account
                                     ▼
                  ┌─────────────────────────────────────┐
                  │        Infrastructure Shards        │
                  │     (Proyectos independientes GCP)  │
                  └──────────────────┬──────────────────┘
                                     │ Max 35 tiendas SaaS / Shard
                                     ▼
                  ┌─────────────────────────────────────┐
                  │             Tiendas SaaS            │
                  │   (/shop público & /admin cliente) │
                  └─────────────────────────────────────┘
```

### 1. Regla de Tiendas por Infrastructure Shard
- **Límite de Capacidad:** Cada shard compartida (`shared-shard`) admite hasta **35 tiendas SaaS**.
- **Modos de Operación:**
  - `shared-shard`: Varias tiendas comparten recursos de Cloud Run / Firebase en un proyecto GCP común con aislamiento de base de datos Firestore por tenant ID.
  - `dedicated-project`: Tiendas enterprise de alto tráfico con proyecto GCP dedicado.
- **Monitoreo de Ocupación:** El servicio `StoresService.getRuntimeCapacitySummary()` computa la tasa de ocupación (`occupancyRatio`) de cada shard. Al llenar 35 tiendas, el shard pasa automáticamente a estado `FULL`.

### 2. Regla de Proyectos GCP por Billing Account
- **Límite Estándar GCP:** Cada Billing Account de autoservicio en Google Cloud admite hasta **5 proyectos vinculados** (Project Quota Limit).
- **Cálculo Real de Proyectos:** El panel de administración cruza los shards registrados en Firestore (`infrastructure_shards`) con sus correspondientes `billingAccountId` para computar en tiempo real la cantidad de proyectos en uso.
- **Fórmula de Capacidad:**
  $$\text{Capacidad Total} = \sum (\text{Billing Accounts Activas} \times \text{Límite de Proyectos (5)})$$
  $$\text{Cupos Libres} = \text{Capacidad Total} - \text{Proyectos GCP en Uso Real}$$

---

## 🚦 Smart Guidance Hub (Asistente de Capacidad)

El panel de Facturación de Vertex (`/settings/billing`) monitorea reactivamente los indicadores de capacidad y despliega alertas guiadas:

| Estado | Condición | Diagnóstico & Acción Requerida |
|---|---|---|
| 🟢 **Capacidad Óptima** | `totalGcpRemaining >= 3` && `readyCount >= 3` | El pool opera con holgura. Sin acción manual requerida. |
| 🟠 **Advertencia Preventiva** | `readyCount <= 2` && `totalGcpRemaining > 2` | Pool de shards listos bajo. Complete el onboarding y verificación de redirect URI de shards en `STANDBY`. |
| 🔴 **Alerta Crítica** | `totalGcpRemaining <= 2` | Capacidad GCP al límite. Siga el protocolo de expansión de Billing Accounts. |

---

## 🛠️ Runbook Operativo: Protocolo de Escalamiento

### Caso A: Shards Standby Incompletos (&le; 2 Shards Listos)
1. Ingrese a **Centro de Comando de Facturación** (`/settings/billing`).
2. En la sección **Monitor de Infrastructure Shards**, identifique las tarjetas con distintivo 🟡 `Incompleto`.
3. Haga clic en **"Cómo configurar"** para abrir el modal explicativo.
4. Registre el Redirect URI del shard (`https://{shard-project-id}.firebaseapp.com/__/auth/handler`) en la consola de OAuth de Google:
   `https://console.cloud.google.com/apis/credentials/oauthclient/988454979046-jnb1sj6boknturojkohr8peha3lgevtr.apps.googleusercontent.com?project=vertex-platform-dev`
5. Presione **"Verificar"** en el panel para validar que el shard cambie a 🟢 `Listo`.

---

### Caso B: Cupos GCP Bajos (&le; 2 Cupos Libres)
Cuando la capacidad total aprobada esté próxima a agotarse:

#### Opción 1: Registrar una Nueva Billing Account en GCP (Recomendado)
1. Diríjase a **Google Cloud Console Billing**: `https://console.cloud.google.com/billing`
2. Haga clic en **"Crear Cuenta de Facturación"** y asigne un nombre (ej. `Vertex Billing 3`).
3. Regrese al panel de Vertex (`/settings/billing`) y presione **"Sincronizar Cuentas"**.
4. La plataforma ejecutará la Cloud Function callable `listBillingAccounts` o el script de sincronización, auto-registrando la nueva cuenta en Firestore y agregando **+5 proyectos libres** al pool.

#### Opción 2: Solicitar Aumento de Cuota de Proyectos en GCP
1. Vaya a la sección de **Cuotas IAM & Admin** en GCP Console:
   `https://console.cloud.google.com/iam-admin/quotas`
2. Filtre por `Project creation` / `Projects per Billing Account`.
3. Solicite un incremento formal del límite de proyectos asociados a la cuenta de facturación deseada.
4. Al ser aprobado por Google Cloud support, edite el límite en el panel con el botón **"Editar"** en la tarjeta de la cuenta.

---

## 💻 Comandos CLI & Scripts Útiles

```bash
# Sincronizar Billing Accounts desde GCP hacia Firestore
npx tsx scripts/sync-billing-accounts.ts

# Auditar la salud y capacidad de los Infrastructure Shards
npx tsx scripts/audit-shards.ts

# Aprovisionar nuevos shards standby en GCP (target 10 shards)
npx tsx scripts/provision-shards.ts --target 10
```
