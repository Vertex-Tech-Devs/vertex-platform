#!/usr/bin/env node
/**
 * sync-billing-accounts.ts — Gestión y sincronización automatizada de Billing Accounts.
 *
 * 1. Intenta crear subcuentas de facturación (Vertex Dev Billing 3..12) bajo la master account
 *    `01D2F4-C25DF1-489AE9` vía Cloud Billing API.
 * 2. Si está restringido por Google Billing (ej. tarjetas de crédito de autoservicio), escanea
 *    todas las Billing Accounts activas mediante gcloud/API.
 * 3. Auto-registra cada Billing Account en la colección `billing_accounts` de Firestore (`vertex-platform-dev`).
 * 4. Imprime el reporte final con el total de cupos de proyectos disponibles.
 */
import { initializeApp, getApps } from 'firebase-admin/app';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import { execSync } from 'child_process';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

const MASTER_BILLING_ACCOUNT = '01D2F4-C25DF1-489AE9';
const TARGET_PROJECT = 'vertex-platform-dev';

if (!getApps().length) {
  initializeApp({ projectId: TARGET_PROJECT });
}
const db = getFirestore();

interface BillingAccountItem {
  name: string; // e.g. "billingAccounts/01D2F4-C25DF1-489AE9"
  displayName?: string;
  open?: boolean;
  masterBillingAccount?: string;
}

async function getAccessToken(): Promise<string> {
  const candidates = [
    process.env.GOOGLE_APPLICATION_CREDENTIALS,
    path.join(os.homedir(), '.config/gcloud/application_default_credentials.json'),
  ].filter(Boolean) as string[];

  for (const file of candidates) {
    if (!fs.existsSync(file)) continue;
    try {
      const raw = JSON.parse(fs.readFileSync(file, 'utf8'));
      if (raw.type === 'authorized_user' && raw.refresh_token) {
        const params = new URLSearchParams({
          grant_type: 'refresh_token',
          client_id: raw.client_id,
          client_secret: raw.client_secret,
          refresh_token: raw.refresh_token,
        });
        const res = await fetch('https://oauth2.googleapis.com/token', {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: params,
        });
        if (res.ok) {
          const data = (await res.json()) as { access_token?: string };
          if (data.access_token) return data.access_token;
        }
      }
    } catch {
      // Continue fallback
    }
  }

  // Fallback to gcloud CLI
  return execSync('gcloud auth print-access-token', { encoding: 'utf8' }).trim();
}

async function attemptCreateSubaccounts(token: string): Promise<number> {
  console.log(`[1/3] Intentando crear subcuentas bajo la cuenta master billingAccounts/${MASTER_BILLING_ACCOUNT}...`);
  let createdCount = 0;

  for (let i = 3; i <= 12; i++) {
    const displayName = `Vertex Dev Billing ${i}`;
    try {
      const res = await fetch('https://cloudbilling.googleapis.com/v1/billingAccounts', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          displayName,
          masterBillingAccount: `billingAccounts/${MASTER_BILLING_ACCOUNT}`,
        }),
      });

      if (!res.ok) {
        const errText = await res.text();
        console.log(`⚠️ No se pudo crear subcuenta programática '${displayName}': Status ${res.status} (${errText.trim()})`);
        console.log('ℹ️ La creación de subcuentas standalone está restringida por el método de pago/cuenta de Google.');
        break;
      }

      const createdAccount = (await res.json()) as { name: string; displayName: string };
      console.log(`✅ Subcuenta creada: ${createdAccount.displayName} (${createdAccount.name})`);
      createdCount++;
    } catch (err: any) {
      console.log(`⚠️ Error al invocar Cloud Billing API para subcuentas: ${err.message || err}`);
      break;
    }
  }

  return createdCount;
}

function getActiveBillingAccountsFromGcloud(): BillingAccountItem[] {
  try {
    const output = execSync('gcloud beta billing accounts list --format=json', { encoding: 'utf8' });
    const parsed = JSON.parse(output) as BillingAccountItem[];
    return parsed.filter((acc) => acc.open !== false);
  } catch (err: any) {
    console.error('Error invocando gcloud beta billing accounts list:', err?.message || err);
    return [];
  }
}

async function main(): Promise<void> {
  console.log('=== Sincronización Automática de Billing Accounts ===\n');

  // Paso 1: Intentar creación de subcuentas
  let token = '';
  try {
    token = await getAccessToken();
    await attemptCreateSubaccounts(token);
  } catch (err: any) {
    console.log(`ℹ️ Omitiendo intento de API subaccounts: ${err.message || err}`);
  }

  // Paso 2: Escanear todas las Billing Accounts activas
  console.log('\n[2/3] Escaneando Billing Accounts activas en la organización...');
  const activeAccounts = getActiveBillingAccountsFromGcloud();
  console.log(`Se detectaron ${activeAccounts.length} Billing Accounts abiertas/activas:\n`);

  // Paso 3: Sincronizar en Firestore collection `billing_accounts`
  console.log('[3/3] Registrando/Sincronizando cuentas en Firestore (`vertex-platform-dev` → `billing_accounts`)...');

  // Obtener shards reales de Firestore para calcular currentProjects real por Billing Account
  const shardsSnap = await db.collection('infrastructure_shards').get();
  const shardBillingCounts: Record<string, number> = {};
  shardsSnap.docs.forEach((doc) => {
    const data = doc.data();
    const bId = String(data.billingAccountId || '').trim();
    if (bId) {
      shardBillingCounts[bId] = (shardBillingCounts[bId] || 0) + 1;
    }
  });

  const billingCollectionRef = db.collection('billing_accounts');
  let newRegisteredCount = 0;
  let totalQuotaAvailable = 0;
  let totalProjectsUsed = 0;

  for (let index = 0; index < activeAccounts.length; index++) {
    const acc = activeAccounts[index];
    const rawId = acc.name.replace('billingAccounts/', '');
    const docRef = billingCollectionRef.doc(rawId);
    const docSnap = await docRef.get();

    const displayName = acc.displayName || `Vertex Billing ${index + 1}`;
    const maxProjects = 5;
    const realUsed = shardBillingCounts[rawId] ?? 0;
    totalProjectsUsed += realUsed;

    if (!docSnap.exists) {
      await docRef.set({
        accountId: rawId,
        name: displayName,
        status: 'ACTIVE',
        maxProjects,
        currentProjects: realUsed,
        createdAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
      });
      console.log(`➕ Registrada nueva Billing Account: ${displayName} (ID: ${rawId}) [Límite: ${maxProjects}, Usados: ${realUsed}]`);
      newRegisteredCount++;
    } else {
      const data = docSnap.data();
      await docRef.update({
        currentProjects: realUsed,
        updatedAt: FieldValue.serverTimestamp(),
      });
      console.log(`ℹ️ Billing Account actualizada: ${displayName} (ID: ${rawId}) [Límite: ${data?.maxProjects ?? maxProjects}, Usados: ${realUsed}]`);
    }

    totalQuotaAvailable += maxProjects;
  }

  console.log('\n==================================================');
  console.log('=== REPORTE FINAL DE POOL DE BILLING ACCOUNTS ===');
  console.log('==================================================');
  console.log(`Total Billing Accounts activas: ${activeAccounts.length}`);
  console.log(`Nuevas Billing Accounts auto-registradas: ${newRegisteredCount}`);
  console.log(`Capacidad Total de Cupos para Shards: ${totalQuotaAvailable} proyectos (${activeAccounts.length} cuentas × 5 proyectos/cuenta)`);
  console.log(`Proyectos GCP en Uso Real: ${totalProjectsUsed} / ${totalQuotaAvailable} (${Math.round((totalProjectsUsed / (totalQuotaAvailable || 1)) * 100)}%)`);
  console.log('==================================================\n');
}

main().catch((err) => {
  console.error('Fatal error en sync-billing-accounts:', err);
  process.exit(1);
});
