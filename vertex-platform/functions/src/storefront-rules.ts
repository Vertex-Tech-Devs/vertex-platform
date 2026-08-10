/**
 * Reglas de seguridad del template storefront (ecommerce-vertex).
 * La plataforma las despliega en cada proyecto de shard/tienda durante el
 * aprovisionamiento (paso initFirestore) para que el storefront público pueda
 * leer el catálogo (clientes sin usuario) y los admins escribir.
 * Mantener sincronizado con storefront/firestore.rules y storefront/storage.rules.
 */
export const STOREFRONT_FIRESTORE_RULES = `rules_version = '2';

service cloud.firestore {
  match /databases/{database}/documents {

    function isAuthenticated() {
      return request.auth != null;
    }

    // Super-admin SOLO por custom claims (platformAdmin/superAdmin) o emails de desarrollador de la plataforma.
    function isSuperAdmin() {
      return isAuthenticated() && (
        request.auth.token.get('superAdmin', false) == true ||
        request.auth.token.get('platformAdmin', false) == true ||
        (request.auth.token.get('email', '') != '' &&
         request.auth.token.email in ['juan.l.espeche@gmail.com', 'leivalihue@gmail.com', 'vertex.tech.dev@gmail.com'])
      );
    }

    // Admin of a given store: custom claim (fast path — set by role.functions.ts after provisioning)
    // or root-level admin_roles composite key {storeId}_{email} fallback.
    function isStoreAdmin(storeId) {
      let targetTenant = (storeId != null && storeId != '') ? storeId : request.auth.token.get('tenantId', '');
      return isAuthenticated() && (
        isSuperAdmin() ||
        (request.auth.token.get('admin', false) == true && (
          targetTenant == '' ||
          request.auth.token.get('tenantId', '') == '' ||
          request.auth.token.get('tenantId', '') == targetTenant ||
          targetTenant.matches('^vtx-pr-.*')
        )) ||
        (request.auth.token.get('email', '') != '' &&
         targetTenant != '' &&
         exists(/databases/$(database)/documents/admin_roles/$(targetTenant + '_' + request.auth.token.email)) &&
         (get(/databases/$(database)/documents/admin_roles/$(targetTenant + '_' + request.auth.token.email)).data.role == 'owner' ||
          get(/databases/$(database)/documents/admin_roles/$(targetTenant + '_' + request.auth.token.email)).data.role == 'admin'))
      );
    }

    // ── Writes de catálogo aislados por tienda (previene cross-tenant overwrite) ──
    function canCreateForStore() {
      return isStoreAdmin(request.resource.data.storeId);
    }
    function canUpdateStoreDoc() {
      return isStoreAdmin(request.resource.data.storeId)
        && request.resource.data.storeId == resource.data.storeId;
    }
    function canDeleteStoreDoc() {
      return isStoreAdmin(resource.data.storeId);
    }

    // ── Public catalog collections (flat root-level, storeId-tagged) ────────────
    match /products/{productId} {
      allow read: if true;
      allow create: if canCreateForStore();
      allow update: if canUpdateStoreDoc();
      allow delete: if canDeleteStoreDoc();

      match /{allChildren=**} {
        allow read: if true;
        allow create: if canCreateForStore();
        allow update: if canUpdateStoreDoc();
        allow delete: if canDeleteStoreDoc();
      }
    }

    match /categories/{categoryId} {
      allow read: if true;
      allow create: if canCreateForStore();
      allow update: if canUpdateStoreDoc();
      allow delete: if canDeleteStoreDoc();
    }

    match /attributes/{attributeId} {
      allow read: if true;
      allow create: if canCreateForStore();
      allow update: if canUpdateStoreDoc();
      allow delete: if canDeleteStoreDoc();
    }

    match /configuracion/{docId} {
      allow read: if true;
      allow create: if canCreateForStore();
      allow update: if canUpdateStoreDoc();
      allow delete: if canDeleteStoreDoc();
    }

    match /store_payments/{storeId} {
      allow read: if isStoreAdmin(storeId);
      allow create: if canCreateForStore();
      allow update: if canUpdateStoreDoc();
      allow delete: if canDeleteStoreDoc();
    }

    match /banners/{docId} {
      allow read: if true;
      allow create: if canCreateForStore();
      allow update: if canUpdateStoreDoc();
      allow delete: if canDeleteStoreDoc();
    }

    match /pages/{docId} {
      allow read: if true;
      allow create: if canCreateForStore();
      allow update: if canUpdateStoreDoc();
      allow delete: if canDeleteStoreDoc();
    }

    // ── Transactional / admin collections ────────────────────────────────────────

    match /orders/{orderId} {
      allow get: if true;
      allow create: if request.resource.data.status == 'pending'
        && request.resource.data.storeId != ''
        && request.resource.data.items.size() <= 100
        && request.resource.data.stockDecremented == false;
      allow list: if isAuthenticated() && (
        isSuperAdmin() ||
        isStoreAdmin(request.auth.token.get('tenantId', '')) ||
        (resource != null && isStoreAdmin(resource.data.storeId)) ||
        (request.query.get('storeId', '') != '' && isStoreAdmin(request.query.get('storeId', '')))
      );
      allow update: if canUpdateStoreDoc();
      allow delete: if canDeleteStoreDoc();
    }

    match /clients/{clientId} {
      allow get: if isAuthenticated() && (
        isSuperAdmin() ||
        isStoreAdmin(request.auth.token.get('tenantId', '')) ||
        (resource != null && isStoreAdmin(resource.data.storeId))
      );
      allow list: if isAuthenticated() && (
        isSuperAdmin() ||
        isStoreAdmin(request.auth.token.get('tenantId', '')) ||
        (resource != null && isStoreAdmin(resource.data.storeId)) ||
        (request.query.get('storeId', '') != '' && isStoreAdmin(request.query.get('storeId', '')))
      );
      allow write: if false;
    }

    match /reviews/{reviewId} {
      allow read: if true;
      allow create: if isAuthenticated()
        && request.resource.data.userId == request.auth.uid
        && request.resource.data.storeId == request.auth.token.get('tenantId', '')
        && request.resource.data.rating >= 1 && request.resource.data.rating <= 5;
      allow update, delete: if isAuthenticated()
        && (resource.data.userId == request.auth.uid || isStoreAdmin(resource.data.storeId));
    }

    match /settings/{docId} {
      allow get: if isAuthenticated() && (
        isSuperAdmin() ||
        isStoreAdmin(request.auth.token.get('tenantId', '')) ||
        (resource != null && isStoreAdmin(resource.data.storeId))
      );
      allow list: if isAuthenticated() && (
        isSuperAdmin() ||
        isStoreAdmin(request.auth.token.get('tenantId', '')) ||
        (resource != null && isStoreAdmin(resource.data.storeId)) ||
        (request.query.get('storeId', '') != '' && isStoreAdmin(request.query.get('storeId', '')))
      );
      allow create: if canCreateForStore();
      allow update: if canUpdateStoreDoc();
      allow delete: if canDeleteStoreDoc();
    }

    match /mail/{docId} {
      allow list: if isAuthenticated() && (
        isSuperAdmin() ||
        isStoreAdmin(request.auth.token.get('tenantId', '')) ||
        (resource != null && isStoreAdmin(resource.data.storeId)) ||
        (request.query.get('storeId', '') != '' && isStoreAdmin(request.query.get('storeId', '')))
      );
      allow create: if canCreateForStore();
      allow update: if canUpdateStoreDoc();
      allow delete: if canDeleteStoreDoc();
    }

    match /admin_roles/{compositeId} {
      allow read: if isAuthenticated() && (
        isSuperAdmin() ||
        (request.auth.token.get('admin', false) == true && compositeId.matches(request.auth.token.get('tenantId', '') + '_.*'))
      );
      allow write: if false;
    }

    match /{document=**} {
      allow read, write: if false;
    }
  }
}
`;

export const STOREFRONT_STORAGE_RULES = `rules_version = '2';
service firebase.storage {
  match /b/{bucket}/o {

    function isAuthenticated() {
      return request.auth != null;
    }

    function isSuperAdmin() {
      return isAuthenticated() && (
        request.auth.token.get('superAdmin', false) == true ||
        request.auth.token.get('platformAdmin', false) == true ||
        (request.auth.token.get('email', '') != '' &&
         request.auth.token.email in ['juan.l.espeche@gmail.com', 'leivalihue@gmail.com', 'vertex.tech.dev@gmail.com'])
      );
    }

    function isStoreAdmin(storeId) {
      return isAuthenticated() && (
        isSuperAdmin() ||
        (request.auth.token.get('admin', false) == true && (
          request.auth.token.get('tenantId', '') == '' ||
          request.auth.token.get('tenantId', '') == storeId ||
          storeId.matches('^vtx-pr-.*')
        ))
      );
    }

    match /{allPaths=**} {
      allow read: if true;
    }

    match /stores/{storeId}/{allPaths=**} {
      allow create, update: if isStoreAdmin(storeId)
        && request.resource.size < 5 * 1024 * 1024
        && request.resource.contentType.matches('image/(jpeg|png|webp|x-icon|vnd.microsoft.icon|svg\\+xml)');
      allow delete: if isStoreAdmin(storeId);
    }
  }
}
`;
