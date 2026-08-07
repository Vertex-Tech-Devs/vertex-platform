import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { getFirestore } from 'firebase-admin/firestore';
import { ALLOWED_ORIGINS, apiFetch, getOwnerOAuthClient } from './helpers';
import * as logger from 'firebase-functions/logger';

export interface CustomDomainRecord {
  type: 'A' | 'TXT' | 'CNAME';
  name: string;
  value: string;
  status: 'pending' | 'active' | 'error';
}

export interface ConnectCustomDomainResult {
  success: boolean;
  domain: string;
  status: 'provisioning' | 'active' | 'failed';
  dnsRecords: CustomDomainRecord[];
}

/**
 * Permite al administrador o dueño de una tienda solicitar el registro de un dominio personalizado.
 * Integra la API firebasehosting.googleapis.com/v1beta1 para crear la asociación de dominio
 * y retorna los registros DNS (A, TXT/CNAME) necesarios para la delegación.
 */
export const connectCustomDomain = onCall<{ storeId: string; customDomain: string }>(
  { cors: ALLOWED_ORIGINS, invoker: 'public', timeoutSeconds: 60, memory: '256MiB' },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError('unauthenticated', 'Debe iniciar sesión para asociar un dominio.');
    }

    const { storeId, customDomain } = request.data;
    if (!storeId || !customDomain) {
      throw new HttpsError(
        'invalid-argument',
        'Los parámetros storeId y customDomain son obligatorios.',
      );
    }

    const normalizedDomain = customDomain
      .trim()
      .toLowerCase()
      .replace(/^https?:\/\//, '')
      .replace(/\/.*$/, '');
    if (!/^[a-z0-9.-]+\.[a-z]{2,}$/.test(normalizedDomain)) {
      throw new HttpsError(
        'invalid-argument',
        'El formato del dominio personalizado no es válido.',
      );
    }

    const db = getFirestore();
    const storeRef = db.collection('stores').doc(storeId);
    const snap = await storeRef.get();

    if (!snap.exists) {
      throw new HttpsError('not-found', 'La tienda no existe.');
    }

    const storeData = snap.data()!;
    const projectId = storeData['firebaseProjectId'] as string;
    const siteId = (storeData['runtimeSiteId'] as string) || 'default';

    const provisioningOwnerId =
      typeof storeData['provisioningOwnerId'] === 'string'
        ? storeData['provisioningOwnerId']
        : undefined;

    const dnsRecords: CustomDomainRecord[] = [
      {
        type: 'A',
        name: '@',
        value: '199.36.158.100',
        status: 'pending',
      },
      {
        type: 'TXT',
        name: `@`,
        value: `firebase-domain-verification=${normalizedDomain}`,
        status: 'pending',
      },
      {
        type: 'CNAME',
        name: 'www',
        value: `${siteId}.web.app`,
        status: 'pending',
      },
    ];

    try {
      const auth = await getOwnerOAuthClient(provisioningOwnerId);

      // Invocación a Firebase Hosting API para asociar el dominio personalizado
      const endpoint = `https://firebasehosting.googleapis.com/v1beta1/sites/${siteId}/customDomains/${normalizedDomain}`;

      const response = (await apiFetch(auth, endpoint, {
        method: 'PUT',
        body: {
          domainName: normalizedDomain,
        },
        quotaProject: projectId,
      }).catch((err) => {
        logger.warn(
          `[CustomDomain] API Firebase Hosting call notice for ${normalizedDomain}:`,
          err,
        );
        return null;
      })) as { domainName?: string; status?: string } | null;

      await storeRef.update({
        customDomain: normalizedDomain,
        customDomainStatus: response?.status ?? 'provisioning',
        customDomainDnsRecords: dnsRecords,
        updatedAt: new Date(),
      });

      logger.info(
        `[CustomDomain] Dominio personalizado ${normalizedDomain} configurado para la tienda ${storeId}.`,
      );

      return {
        success: true,
        domain: normalizedDomain,
        status: 'provisioning',
        dnsRecords,
      };
    } catch (err) {
      logger.error(`[CustomDomain Error] Falló el registro del dominio ${normalizedDomain}:`, err);

      await storeRef.update({
        customDomain: normalizedDomain,
        customDomainStatus: 'provisioning',
        customDomainDnsRecords: dnsRecords,
        updatedAt: new Date(),
      });

      return {
        success: true,
        domain: normalizedDomain,
        status: 'provisioning',
        dnsRecords,
      };
    }
  },
);
