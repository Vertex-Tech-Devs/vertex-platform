/**
 * Tipos de dominio personalizados compartidos entre stores.ts y el cliente Angular.
 * La lógica de la Cloud Function `connectDomain` vive en stores.ts.
 */

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
