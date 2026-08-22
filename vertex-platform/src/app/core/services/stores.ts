import { Injectable, inject, signal, computed } from '@angular/core';
import {
  getFirestore,
  collection,
  onSnapshot,
  doc,
  updateDoc,
  serverTimestamp,
  query,
  orderBy,
  limit,
} from 'firebase/firestore';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { toSignal, toObservable } from '@angular/core/rxjs-interop';
import { Observable, switchMap, of } from 'rxjs';
import { AuthService } from './auth';

import type {
  Store,
  CreateStorePayload,
  StoreConfig,
  StaffMember,
  PendingInvitation,
  TemplateVersion,
} from '../models/store';
import type {
  DnsRecord,
  RawDnsRecord,
  RuntimeShardCapacity,
  RuntimeCapacitySummary,
  ShardReadinessReason,
  ShardReadiness,
  ShardReadinessReport,
} from '../models/shard-capacity';
import { normalizeDomainStatus, mapDnsRecords } from '../models/shard-capacity';
import {
  PLATFORM_BUSINESS_VERTICALS,
  type VerticalOption,
  type CreateCustomVerticalPayload,
} from '../constants/business-verticals.constants';

export type {
  DnsRecord,
  RuntimeShardCapacity,
  RuntimeCapacitySummary,
  ShardReadinessReason,
  ShardReadiness,
  ShardReadinessReport,
};

@Injectable({ providedIn: 'root' })
export class StoresService {
  private db = getFirestore();
  private fns = getFunctions();
  private storesRef = collection(this.db, 'stores');
  private customVerticalsRef = collection(this.db, 'business_verticals');
  private authService = inject(AuthService);

  readonly stores = toSignal(
    toObservable(this.authService.user).pipe(
      switchMap((u) => {
        if (u === undefined) {
          // Auth is still resolving. Keep isLoading true.
          return of([]);
        }
        if (u === null) {
          this.isLoading.set(false);
          return of([]);
        }
        return new Observable<Store[]>((subscriber) => {
          const unsub = onSnapshot(
            this.storesRef,
            (snap) => {
              this.isLoading.set(false);
              subscriber.next(snap.docs.map((d) => ({ id: d.id, ...d.data() }) as Store));
            },
            (error) => {
              // Firestore SDK handles reconnection internally; this handler covers
              // persistent failures. The SDK logs transport-level noise independently.
              if (error?.code === 'unavailable' || error?.code === 'cancelled') {
                console.warn('[StoresService] Firestore temporarily unavailable, retrying...');
              } else {
                console.error(
                  '[StoresService] Firestore subscription error:',
                  error?.code || error,
                );
              }
              this.isLoading.set(false);
              subscriber.next([]);
            },
          );
          return unsub;
        });
      }),
    ),
    { initialValue: [] },
  );

  readonly customVerticals = toSignal(
    toObservable(this.authService.user).pipe(
      switchMap((u) => {
        if (!u) {
          return of([]);
        }
        return new Observable<VerticalOption[]>((subscriber) => {
          const unsub = onSnapshot(
            this.customVerticalsRef,
            (snap) => {
              const list: VerticalOption[] = snap.docs.map((d) => {
                const data = d.data();
                return {
                  id: d.id,
                  icon: data['icon'] || '🏷️',
                  name: data['name'] || d.id,
                  description: data['description'] || '',
                  isCustom: true,
                  categories: data['categories'] || [],
                  themeColors: data['themeColors'],
                };
              });
              subscriber.next(list);
            },
            (err) => {
              console.warn('[StoresService] Error loading custom verticals:', err);
              subscriber.next([]);
            },
          );
          return unsub;
        });
      }),
    ),
    { initialValue: [] },
  );

  readonly allVerticals = computed<VerticalOption[]>(() => {
    const custom = this.customVerticals() || [];
    return [...PLATFORM_BUSINESS_VERTICALS, ...custom];
  });

  /** True hasta que llega el primer snapshot de tiendas (para skeletons/loadings). */
  readonly isLoading = signal(true);

  /** Alerta de pool de shards bajo (in-app) — leída de system_alerts/pool_low_{env}. */
  readonly poolAlert = signal<{
    availableShards: number;
    threshold: number;
    command: string;
  } | null>(null);

  private readonly poolAlertUnsub = (() => {
    try {
      // Solo suscribirse si la app de Firebase está inicializada (los tests unitarios
      // sin initializeApp no deben romper la construcción del servicio).
      const env = this.authService.user()?.uid
        ? this.db.app?.options?.projectId === 'vertex-platform-app'
          ? 'prod'
          : 'dev'
        : 'dev';
      return onSnapshot(doc(this.db, `system_alerts/pool_low_${env}`), (snap) => {
        const data = snap.data() as
          | {
              active?: boolean;
              availableShards?: number;
              threshold?: number;
              command?: string;
            }
          | undefined;
        this.poolAlert.set(
          data?.active
            ? {
                availableShards: data.availableShards ?? 0,
                threshold: data.threshold ?? 2,
                command: data.command ?? 'npx tsx scripts/provision-shards.ts --target 10',
              }
            : null,
        );
      });
    } catch {
      return () => {};
    }
  })();

  async createStore(payload: CreateStorePayload): Promise<string> {
    const fn = httpsCallable<CreateStorePayload, { storeId: string }>(this.fns, 'provisionStore');
    const result = await fn(payload);
    return result.data.storeId;
  }

  async getRuntimeCapacitySummary(): Promise<RuntimeCapacitySummary> {
    const fn = httpsCallable<
      Record<string, never>,
      { summary?: RuntimeCapacitySummary } & RuntimeCapacitySummary
    >(this.fns, 'getRuntimeCapacitySummary');
    const result = await fn({});
    return result.data.summary ?? (result.data as RuntimeCapacitySummary);
  }

  async getShardReadiness(): Promise<ShardReadinessReport> {
    const fn = httpsCallable<Record<string, never>, ShardReadinessReport>(
      this.fns,
      'getShardReadiness',
    );
    const result = await fn({});
    return result.data;
  }

  async redeployStore(storeId: string): Promise<void> {
    const fn = httpsCallable<{ storeId: string }, { success: boolean }>(this.fns, 'redeployStore');
    await fn({ storeId });
  }

  getStoreDeploymentHistory(storeId: string): Observable<Record<string, unknown>[]> {
    const deploysRef = collection(this.db, 'stores', storeId, 'deploys');
    const q = query(deploysRef, orderBy('timestamp', 'desc'), limit(50));
    return new Observable<Record<string, unknown>[]>((subscriber) => {
      return onSnapshot(
        q,
        (snap) => {
          subscriber.next(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
        },
        (error) => {
          console.warn('[StoresService] error fetching deploy history:', error);
          subscriber.next([]);
        },
      );
    });
  }

  async deleteStore(storeId: string): Promise<void> {
    const fn = httpsCallable<{ storeId: string }, { success: boolean }>(this.fns, 'deleteStore');
    await fn({ storeId });
  }

  async connectDomain(storeId: string, domain: string): Promise<{ dnsRecords: DnsRecord[] }> {
    const fn = httpsCallable<
      { storeId: string; domain: string },
      { success: boolean; dnsRecords: RawDnsRecord[] }
    >(this.fns, 'connectDomain');
    const result = await fn({ storeId, domain });
    return { dnsRecords: mapDnsRecords(result.data.dnsRecords) };
  }

  async updateStore(
    id: string,
    data: Partial<Pick<Store, 'name' | 'ownerEmail' | 'logoUrl' | 'autoUpdate'>>,
  ): Promise<void> {
    await updateDoc(doc(this.db, 'stores', id), { ...data, updatedAt: serverTimestamp() });
  }

  async setStatus(id: string, status: 'active' | 'suspended'): Promise<void> {
    await updateDoc(doc(this.db, 'stores', id), { status, updatedAt: serverTimestamp() });
  }

  async resetStoreDeployStatus(id: string): Promise<void> {
    await updateDoc(doc(this.db, 'stores', id), {
      versionUpdateStatus: 'idle',
      versionUpdateProgress: null,
      versionUpdateTarget: null,
      redeployStatus: 'idle',
      redeployError: null,
      updatedAt: serverTimestamp(),
    });
  }

  /** Dormir tienda (suspender sin eliminar): pausa el sitio y la excluye de deploys. */
  async suspendStore(storeId: string): Promise<void> {
    const fn = httpsCallable<{ storeId: string }, { success: boolean }>(this.fns, 'suspendStore');
    await fn({ storeId });
  }

  /** Reactivar tienda dormida: restaura el sitio con su versión activa. */
  async activateStore(storeId: string): Promise<void> {
    const fn = httpsCallable<{ storeId: string }, { success: boolean }>(this.fns, 'activateStore');
    await fn({ storeId });
  }

  async retryProvisioning(storeId: string): Promise<void> {
    const fn = httpsCallable<{ storeId: string }, { success: boolean }>(
      this.fns,
      'retryProvisioning',
    );
    await fn({ storeId });
  }

  async updateStoreConfig(storeId: string, config: Partial<StoreConfig>): Promise<void> {
    const fn = httpsCallable<
      { storeId: string; config: Partial<StoreConfig> },
      { success: boolean }
    >(this.fns, 'updateStoreConfig');
    await fn({ storeId, config });
  }

  async getStoreStaff(
    storeId: string,
  ): Promise<{ staff: StaffMember[]; invitations: PendingInvitation[] }> {
    const fn = httpsCallable<
      { storeId: string },
      { success: boolean; staff: StaffMember[]; invitations: PendingInvitation[] }
    >(this.fns, 'getStoreStaff');
    const result = await fn({ storeId });
    return {
      staff: result.data.staff ?? [],
      invitations: result.data.invitations ?? [],
    };
  }

  async inviteStaff(
    storeId: string,
    email: string,
    role: string,
  ): Promise<{ inviteEmailSent: boolean }> {
    const fn = httpsCallable<
      { storeId: string; email: string; role: string },
      { success: boolean; inviteEmailSent?: boolean }
    >(this.fns, 'inviteStaff');
    const result = await fn({ storeId, email, role });
    return { inviteEmailSent: result.data.inviteEmailSent !== false };
  }

  async generatePasswordResetLink(
    storeId: string,
    email: string,
  ): Promise<{ success: boolean; actionLink: string }> {
    const fn = httpsCallable<
      { storeId: string; email: string },
      { success: boolean; actionLink: string }
    >(this.fns, 'generatePasswordResetLink');
    const result = await fn({ storeId, email });
    return result.data;
  }

  async verifyDomain(
    storeId: string,
    domain: string,
  ): Promise<{ status: 'live' | 'pending'; dnsRecords: DnsRecord[] }> {
    const fn = httpsCallable<
      { storeId: string; domain: string },
      { success: boolean; status: string; dnsRecords: RawDnsRecord[] }
    >(this.fns, 'verifyDomainDNSStatus');
    const result = await fn({ storeId, domain });
    const normalizedStatus = normalizeDomainStatus(result.data.status);
    return {
      status: normalizedStatus,
      dnsRecords: mapDnsRecords(result.data.dnsRecords),
    };
  }

  async getStoreConfig(storeId: string): Promise<StoreConfig | null> {
    const fn = httpsCallable<{ storeId: string }, { config: StoreConfig | null }>(
      this.fns,
      'getStoreConfig',
    );
    const result = await fn({ storeId });
    return result.data.config;
  }

  async seedStore(
    storeId: string,
    includeMockData = true,
    provisioningMode = 'FULL_DEMO',
    verticalId?: string,
  ): Promise<void> {
    const fn = httpsCallable<
      { storeId: string; includeMockData: boolean; provisioningMode?: string; verticalId?: string },
      { success: boolean }
    >(this.fns, 'seedStore');
    await fn({ storeId, includeMockData, provisioningMode, verticalId });
  }

  async listTemplateVersions(): Promise<TemplateVersion[]> {
    const fn = httpsCallable<Record<string, never>, { versions: TemplateVersion[] }>(
      this.fns,
      'listTemplateVersions',
    );
    const result = await fn({});
    return result.data.versions;
  }

  async updateStoreVersion(storeId: string, version: string): Promise<void> {
    const fn = httpsCallable<{ storeId: string; version: string }, { success: boolean }>(
      this.fns,
      'updateStoreVersion',
    );
    await fn({ storeId, version });
  }

  async createCustomVertical(
    payload: CreateCustomVerticalPayload,
  ): Promise<{ success: boolean; vertical: VerticalOption }> {
    const fn = httpsCallable<
      CreateCustomVerticalPayload,
      { success: boolean; vertical: VerticalOption }
    >(this.fns, 'createCustomVertical');
    const result = await fn(payload);
    return result.data;
  }
}
