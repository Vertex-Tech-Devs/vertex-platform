import { environment } from '../../../environments/environment';

export function tenantPath(collection: string): string {
  return `tenants/${environment.tenantId}/${collection}`;
}

export function tenantDocPath(collection: string, docId: string): string {
  return `tenants/${environment.tenantId}/${collection}/${docId}`;
}
