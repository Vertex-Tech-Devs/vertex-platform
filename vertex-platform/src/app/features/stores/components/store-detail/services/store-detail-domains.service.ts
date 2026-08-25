import { Injectable, inject, signal } from '@angular/core';
import { StoresService } from '@core/services/stores';
import { errorMessage } from '@core/utils/error.util';
import type { DnsRecord } from '@core/services/stores';

@Injectable({ providedIn: 'root' })
export class StoreDetailDomainsService {
  private storesService = inject(StoresService);

  readonly domainInput = signal('');
  readonly domainStatus = signal<'live' | 'pending'>('pending');
  readonly dnsRecords = signal<DnsRecord[]>([]);
  readonly isVerifyingDNS = signal(false);
  readonly isConnectingDomain = signal(false);
  readonly dnsVerificationError = signal('');
  readonly dnsVerificationSuccess = signal('');

  async connectDomain(storeId: string, domain: string): Promise<boolean> {
    if (!domain) {
      return false;
    }
    this.isConnectingDomain.set(true);
    this.dnsVerificationError.set('');
    this.dnsVerificationSuccess.set('');
    try {
      const res = await this.storesService.connectDomain(storeId, domain.trim());
      // Fallback anti-hang: si el backend no devolvió records (API de Hosting no los
      // incluye en el create), mostrar los registros estándar de Firebase Hosting.
      const records = res.dnsRecords.length
        ? res.dnsRecords
        : [
            { host: '@', type: 'A', value: '199.36.158.100', requiredAction: 'ADD' },
            { host: 'www', type: 'CNAME', value: `${storeId}.web.app`, requiredAction: 'ADD' },
          ];
      this.dnsRecords.set(records);
      this.domainStatus.set('pending');
      this.dnsVerificationSuccess.set(
        'Dominio configurado. Agregá los registros DNS en tu proveedor de dominio para activarlo.',
      );
      return true;
    } catch (err) {
      console.error('Error connecting domain:', err);
      this.dnsVerificationError.set(errorMessage(err) || 'No se pudo conectar el dominio.');
      return false;
    } finally {
      this.isConnectingDomain.set(false);
    }
  }

  private verifiedDomain: string | null = null;

  async verifyDNS(storeId: string, domain: string, silent = false): Promise<void> {
    if (!domain) {
      return;
    }
    if (silent && this.verifiedDomain === domain && this.dnsRecords().length > 0) {
      return;
    }
    if (!silent) {
      this.isVerifyingDNS.set(true);
      this.dnsVerificationError.set('');
      this.dnsVerificationSuccess.set('');
    }
    try {
      const res = await this.storesService.verifyDomain(storeId, domain.trim());
      // Anti-hang: si el backend no devolvió records, mostrar los estándar de Firebase.
      const records = res.dnsRecords.length
        ? res.dnsRecords
        : [
            { host: '@', type: 'A', value: '199.36.158.100', requiredAction: 'ADD' },
            { host: 'www', type: 'CNAME', value: `${storeId}.web.app`, requiredAction: 'ADD' },
          ];
      this.dnsRecords.set(records);
      this.verifiedDomain = domain;
      if (res.status === 'live') {
        this.domainStatus.set('live');
        if (!silent) {
          this.dnsVerificationSuccess.set('¡Dominio verificado con éxito y activo!');
        }
      } else {
        this.domainStatus.set('pending');
        if (!silent) {
          this.dnsVerificationError.set(
            'El dominio está conectado y esperando la propagación DNS. La emisión del certificado SSL puede tardar entre 2 y 24 horas.',
          );
        }
      }
    } catch (err) {
      console.error('Error verifying DNS:', err);
      if (!silent) {
        this.dnsVerificationError.set(
          errorMessage(err) || 'No se pudo verificar el estado DNS. Intentá de nuevo.',
        );
      }
    } finally {
      if (!silent) {
        this.isVerifyingDNS.set(false);
      }
    }
  }
}
