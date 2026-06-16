export const COLLECTIONS = {
  PRODUCTS: 'products',
  ORDERS: 'orders',
  SETTINGS: 'settings',
  MAIL: 'mail',
  CLIENTS: 'clients',
  ADMIN_ROLES: 'admin_roles',
  ATTRIBUTES: 'attributes',
};

export const DOCS = {
  EMAIL_TEMPLATES: 'emailTemplates',
};

/**
 * Returns the tenant-namespaced Firestore path for a collection.
 * admin_roles is intentionally excluded — it lives at root with composite key {tenantId}_{email}.
 */
export function tenantCollection(tenantId: string, collection: string): string {
  return `tenants/${tenantId}/${collection}`;
}

export function tenantDoc(tenantId: string, collection: string, docId: string): string {
  return `tenants/${tenantId}/${collection}/${docId}`;
}
