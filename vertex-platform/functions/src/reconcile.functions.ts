import { onSchedule } from 'firebase-functions/v2/scheduler';
import * as logger from 'firebase-functions/logger';
import { getFirestore, Timestamp } from 'firebase-admin/firestore';
import { getOwnerOAuthClient, apiFetch } from './helpers';

/**
 * sweepStoresOrdersReconcile — Reconciliación automática del ciclo de órdenes POR SHARD.
 * Las órdenes viven en el Firestore del shard de cada tienda (no en el master), por eso
 * este job corre desde la plataforma (SA orquestadora con datastore.owner en los shards):
 *  1) Órdenes ABANDONADAS (pending/PENDING_PAYMENT con preferencia vencida >25 h y sin
 *     pago aprobado) → CANCELLED_UNPAID (sin tocar stock).
 *  2) Fantasmas LEGACY (processing + stockDecremented + sin paymentDetails.paymentId,
 *     >24 h) → se devuelve el stock y se marca CANCELLED_UNPAID.
 *  3) BACKFILL de clientes: órdenes approved/processing sin doc clients/{store}_{email}.
 * Idempotente, con límites por corrida y nunca aborta por una tienda puntual.
 */
export const sweepStoresOrdersReconcile = onSchedule(
  { schedule: 'every 60 minutes', timeoutSeconds: 540, memory: '512MiB', region: 'us-central1' },
  async () => {
    logger.info('[Reconcile] Inicio de la ronda.');
    const db = getFirestore();
    const started = Date.now();
    const HARD_CAP_ORDERS = 400;
    const summary = { stores: 0, cancelledAbandoned: 0, restoredLegacy: 0, clientsBackfilled: 0, errors: 0 };

    const storesSnap = await db.collection('stores').limit(200).get();
    const auth = await getOwnerOAuthClient();

    const docFields = (name: string, value: string | boolean | number) => {
      if (typeof value === 'boolean') return { [name]: { booleanValue: value } };
      if (typeof value === 'number') return { [name]: { integerValue: String(value) } };
      return { [name]: { stringValue: String(value) } };
    };

    const projectOf = (d: { firebaseProjectId?: string; runtimeProjectId?: string; projectId?: string }) =>
      String(d.runtimeProjectId || d.firebaseProjectId || d.projectId || '').trim();

    for (const storeDoc of storesSnap.docs) {
      const data = storeDoc.data();
      const projectId = projectOf(data as never);
      const slug = String((data as { slug?: string }).slug || storeDoc.id);
      if (!projectId) continue;
      summary.stores += 1;
      const root = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents`;
      const ordersUrl = `${root}/orders?pageSize=300`;
      let orders: Array<{ name: string; fields?: Record<string, unknown> }> = [];
      try {
        const list = (await apiFetch(auth, ordersUrl, { quotaProject: projectId })) as {
          documents?: Array<{ name: string; fields?: Record<string, unknown> }>;
        };
        orders = list.documents || [];
      } catch (err) {
        logger.warn(`[Reconcile] No se pudo listar órdenes de ${projectId} (${slug}):`, err);
        summary.errors += 1;
        continue;
      }

      let processed = 0;
      for (const order of orders) {
        if (processed >= HARD_CAP_ORDERS) break;
        const id = decodeURIComponent(order.name.split('/').pop() || '');
        const f = (order.fields || {}) as Record<string, { stringValue?: string; booleanValue?: boolean; integerValue?: string; mapValue?: { fields?: Record<string, unknown> }; timestampValue?: string; arrayValue?: { values?: Array<{ mapValue?: { fields?: Record<string, unknown> } }> } }>;
        const status = f['status']?.stringValue || '';
        const isPaid = f['paymentStatus']?.stringValue === 'approved' || status === 'approved';
        const paymentDetailsMap = (f['paymentDetails'] as {
          mapValue?: { fields?: Record<string, { stringValue?: string }> };
        } | undefined)?.mapValue?.fields;
        const paymentId = paymentDetailsMap?.['paymentId']?.stringValue;
        const stockDec = f['stockDecremented']?.booleanValue === true;
        const createdRaw = f['createdAt']?.timestampValue || f['orderDate']?.timestampValue || f['checkoutStartedAt']?.timestampValue || '';
        const createdMs = createdRaw ? new Date(createdRaw).getTime() : Date.now();
        const expRaw = (f['mercadopago_expiration_date'] as { timestampValue?: string } | undefined)?.timestampValue;
        const expiredMs = expRaw ? new Date(expRaw).getTime() : 0;
        const now = Date.now();
        const patchUrl = `${root}/orders/${encodeURIComponent(id)}`;

        // 1) Abandonadas
        if ((status === 'pending' || status === 'PENDING_PAYMENT') && !paymentId && !isPaid) {
          const ageOk = now - createdMs > 25 * 60 * 60 * 1000;
          const expiredOk = expRaw ? expiredMs < now - 30 * 60 * 1000 : ageOk;
          if (ageOk && expiredOk) {
            try {
              await apiFetch(auth, patchUrl, {
                method: 'PATCH',
                quotaProject: projectId,
                body: {
                  fields: {
                    ...docFields('status', 'CANCELLED_UNPAID'),
                    ...docFields('paymentStatus', 'cancelled'),
                    ...docFields('isPaid', false),
                    ...docFields('reconciledBy', 'sweepStoresOrdersReconcile'),
                    ...docFields('reconciledAt', new Date().toISOString()),
                    ...docFields('notes', 'Orden abandonada (pago vencido). Cancelada automáticamente por reconciliación.'),
                  },
                },
              });
              summary.cancelledAbandoned += 1;
              processed += 1;
              logger.info(`[Reconcile] ${slug} ${id}: abandonada → CANCELLED_UNPAID`);
            } catch (err) {
              logger.warn(`[Reconcile] Error cancelando ${slug}/${id}:`, err);
              summary.errors += 1;
            }
          }
          continue;
        }

        // 2) Fantasma legacy con stock
        if (status === 'processing' && stockDec && !paymentId && !isPaid && now - createdMs > 24 * 60 * 60 * 1000) {
          try {
            type ItFields = { stringValue?: string; integerValue?: string };
            type ItemDoc = { mapValue?: { fields?: Record<string, ItFields> } };
            const items = ((f['items'] as { arrayValue?: { values?: ItemDoc[] } } | undefined)?.arrayValue?.values || [])
              .map((it) => {
                const fl = it.mapValue?.fields || {};
                const qty = fl['quantity'];
                return {
                  productId: fl['productId']?.stringValue || '',
                  variantId: fl['variantId']?.stringValue || 'default',
                  qty: Number(qty?.stringValue ?? qty?.integerValue ?? 0),
                };
              });
            let restoredUnits = 0;
            for (const it of items) {
              if (!it.productId || it.qty <= 0) continue;
              const prodUrl = `${root}/products/${encodeURIComponent(it.productId)}`;
              const varUrl = `${root}/products/${encodeURIComponent(it.productId)}/variants/${encodeURIComponent(it.variantId)}`;
              try {
                const v = (await apiFetch(auth, varUrl, { quotaProject: projectId })) as { fields?: Record<string, unknown> };
                const cur = Number(((v.fields || {})['stock'] as { integerValue?: string })?.integerValue || 0);
                await apiFetch(auth, varUrl, {
                  method: 'PATCH',
                  quotaProject: projectId,
                  body: { fields: docFields('stock', cur + it.qty) },
                });
                restoredUnits += it.qty;
              } catch (err) {
                const msg = err instanceof Error ? err.message : '';
                if (!/404|not found/i.test(msg)) throw err;
              }
              try {
                const p = (await apiFetch(auth, prodUrl, { quotaProject: projectId })) as { fields?: Record<string, unknown> };
                const cur = Number(((p.fields || {})['totalStock'] as { integerValue?: string })?.integerValue || 0);
                await apiFetch(auth, prodUrl, {
                  method: 'PATCH',
                  quotaProject: projectId,
                  body: { fields: docFields('totalStock', cur + it.qty) },
                });
              } catch (err) {
                const msg = err instanceof Error ? err.message : '';
                if (!/404|not found/i.test(msg)) throw err;
              }
            }
            await apiFetch(auth, patchUrl, {
              method: 'PATCH',
              quotaProject: projectId,
              body: {
                fields: {
                  ...docFields('status', 'CANCELLED_UNPAID'),
                  ...docFields('paymentStatus', 'cancelled'),
                  ...docFields('isPaid', false),
                  ...docFields('stockDecremented', false),
                  ...docFields('reconciledBy', 'sweepStoresOrdersReconcile'),
                  ...docFields('reconciledAt', new Date().toISOString()),
                  ...docFields('notes', `Venta fantasma legacy: stock restituido (${restoredUnits} u.) y cancelada.`),
                },
              },
            });
            summary.restoredLegacy += 1;
            processed += 1;
            logger.info(`[Reconcile] ${slug} ${id}: legacy restaurado (${restoredUnits} u.) → CANCELLED_UNPAID`);
          } catch (err) {
            logger.warn(`[Reconcile] Error restaurando ${slug}/${id}:`, err);
            summary.errors += 1;
          }
          continue;
        }

        // 3) Backfill de clientes (órdenes pagadas sin cliente)
        if ((status === 'processing' || status === 'approved' || isPaid) && paymentId) {
          const email = f['clientEmail']?.stringValue || '';
          if (email && slug) {
            const clientDoc = `${root}/clients/${encodeURIComponent(`${slug}_${email}`)}`;
            try {
              await apiFetch(auth, clientDoc, { quotaProject: projectId });
            } catch (err) {
              const msg = err instanceof Error ? err.message : '';
              if (/404|not found/i.test(msg)) {
                try {
                  await apiFetch(auth, clientDoc, {
                    method: 'PATCH',
                    quotaProject: projectId,
                    body: {
                      fields: {
                        ...docFields('storeId', slug),
                        ...docFields('email', email),
                        ...docFields('fullName', f['clientName']?.stringValue || email),
                        ...docFields('phone', f['clientPhone']?.stringValue || ''),
                        ...docFields('firstOrderDate', new Date(createdMs).toISOString()),
                        ...docFields('lastOrderDate', new Date(createdMs).toISOString()),
                        ...docFields('numberOfOrders', 1),
                        ...docFields('totalSpent', Number(f['total']?.integerValue || f['total']?.stringValue || 0)),
                        ...docFields('reconciledBy', 'sweepStoresOrdersReconcile'),
                      },
                    },
                  });
                  summary.clientsBackfilled += 1;
                  processed += 1;
                  logger.info(`[Reconcile] ${slug}: cliente histórico creado ${email} (orden ${id})`);
                } catch (err2) {
                  logger.warn(`[Reconcile] Error backfill cliente ${email} en ${slug}:`, err2);
                  summary.errors += 1;
                }
              } else if (err) {
                logger.warn(`[Reconcile] Error leyendo cliente ${email} en ${slug}:`, err);
                summary.errors += 1;
              }
            }
          }
        }
      }
    }

    await db.collection('ops').doc('reconcileRuns').set(
      {
        ranAt: Timestamp.now(),
        durationMs: Date.now() - started,
        summary,
      },
      { merge: true },
    );
    logger.info(`[Reconcile] Ronda finalizada: ${JSON.stringify(summary)}`);

    // Alerta si la ronda tuvo que corregir algo (deduplicada contra la última ronda).
    if (summary.cancelledAbandoned + summary.restoredLegacy + summary.clientsBackfilled > 0) {
      await db.collection('alerts').doc('reconcile-actions').set({
        severity: 'warning',
        kind: 'reconcile_actions',
        status: 'open',
        title: 'Reconciliación de órdenes con correcciones',
        message:
          `Órdenes abandonadas canceladas: ${summary.cancelledAbandoned}. ` +
          `Fantasma restaurados (stock devuelto): ${summary.restoredLegacy}. ` +
          `Clientes históricos creados: ${summary.clientsBackfilled}.`,
        count: summary.cancelledAbandoned + summary.restoredLegacy + summary.clientsBackfilled,
        firstSeen: Timestamp.now(),
        lastSeen: Timestamp.now(),
        resolvedAt: null,
        link: `https://console.firebase.google.com/project/vertex-platform-app/firestore/data/~2Fops~2FreconcileRuns`,
      }, { merge: true });
    }
  },
);
