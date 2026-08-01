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

    // Super-admin SOLO por custom claims (platformAdmin/superAdmin), fijados por el
    // servidor. Los emails dev no se hardcodean en las reglas: se auto-provisionan
    // claims vía role.functions.ts (refreshMyAdminClaim) al iniciar sesión.
    function isSuperAdmin() {
      return isAuthenticated() && (
        request.auth.token.get('superAdmin', false) == true ||
        request.auth.token.get('platformAdmin', false) == true
      );
    }

    // Admin of a given store: custom claim (fast path — set by role.functions.ts after provisioning)
    // or root-level admin_roles composite key {storeId}_{email} fallback.
    function isStoreAdmin(storeId) {
      return isAuthenticated() && (
        isSuperAdmin() ||
        (request.auth.token.get('admin', false) == true && request.auth.token.get('tenantId', '') == storeId) ||
        (request.auth.token.get('email', '') != '' &&
         exists(/databases/$(database)/documents/admin_roles/$(storeId + '_' + request.auth.token.email)) &&
         (get(/databases/$(database)/documents/admin_roles/$(storeId + '_' + request.auth.token.email)).data.role == 'owner' ||
          get(/databases/$(database)/documents/admin_roles/$(storeId + '_' + request.auth.token.email)).data.role == 'admin'))
      );
    }

    // ── Writes de catálogo aislados por tienda (previene cross-tenant overwrite) ──
    // create: el storeId del documento debe pertenecer al admin.
    // update: además, el storeId NO puede cambiar respecto del documento existente
    //         (evita que un admin de la tienda A sobrescriba documentos de la tienda B).
    // delete: el documento existente debe pertenecer al admin.
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
    // Reads are public for storefront visitors; writes require an authenticated
    // admin whose tenantId claim matches the document's storeId field.

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

    // Configuración de pagos PRIVADA (store_payments/{storeId}):
    // solo administradores de la tienda (nunca lectura pública).
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
      // Public get for guest checkout (los clientes leen su orden tras el redirect de MP).
      // La creación es pública SOLO con forma válida: orden pendiente, items limitados
      // y sin marcar stock — evita falsificación de órdenes y floods de emails.
      allow get: if true;
      allow create: if request.resource.data.status == 'pending'
        && request.resource.data.storeId != ''
        && request.resource.data.items.size() <= 100
        && request.resource.data.stockDecremented == false;
      allow list: if isAuthenticated()
        && request.auth.token.get('admin', false) == true
        && request.query.get('storeId') == request.auth.token.get('tenantId', '');
      allow update: if canUpdateStoreDoc();
      allow delete: if canDeleteStoreDoc();
    }

    match /clients/{clientId} {
      allow get: if isAuthenticated() && isStoreAdmin(resource.data.storeId);
      allow list: if isAuthenticated()
        && request.auth.token.get('admin', false) == true
        && request.query.get('storeId') == request.auth.token.get('tenantId', '');
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
      allow get: if isAuthenticated() && isStoreAdmin(resource.data.storeId);
      allow list: if isAuthenticated()
        && request.auth.token.get('admin', false) == true
        && request.query.get('storeId') == request.auth.token.get('tenantId', '');
      allow create: if canCreateForStore();
      allow update: if canUpdateStoreDoc();
      allow delete: if canDeleteStoreDoc();
    }

    match /mail/{docId} {
      allow list: if isAuthenticated()
        && request.auth.token.get('admin', false) == true
        && request.query.get('storeId') == request.auth.token.get('tenantId', '');
      allow create: if canCreateForStore();
      allow update: if canUpdateStoreDoc();
      allow delete: if canDeleteStoreDoc();
    }

    // admin_roles is at the root level with composite key {storeId}_{email}.
    // The onRoleChange trigger in functions/role.functions.ts reads this collection
    // and sets custom auth claims. Written exclusively by the platform via Admin SDK.
    match /admin_roles/{compositeId} {
      allow read: if isAuthenticated()
        && request.auth.token.get('admin', false) == true
        && compositeId.matches(request.auth.token.get('tenantId', '') + '_.*');
      allow write: if false;
    }

    // Default fallback: any unmatched path is denied
    match /{document=**} {
      allow read, write: if false;
    }
  }
}
`;

export const STOREFRONT_STORAGE_RULES = `rules_version = '2';
service firebase.storage {
  match /b/{bucket}/o {

    // Administrador autenticado (plataforma o tienda) mediante claims de Firebase Auth
    function isStoreAdmin() {
      return request.auth != null && (
        request.auth.token.get('superAdmin', false) == true ||
        request.auth.token.get('platformAdmin', false) == true ||
        request.auth.token.get('admin', false) == true
      );
    }

    // Catálogo público: lectura libre de todas las imágenes.
    match /{allPaths=**} {
      allow read: if true;
    }

    // Escritura aislada por tienda: el primer segmento del path (stores/{storeId}/...)
    // debe coincidir con el tenantId del administrador autenticado, con tipos MIME
    // restringidos (image/jpeg, image/png, image/webp) y tamaño máximo 5MB.
    match /stores/{storeId}/{allPaths=**} {
      allow create, update: if isStoreAdmin()
        && storeId == request.auth.token.get('tenantId', '')
        && request.resource.size < 5 * 1024 * 1024
        && request.resource.contentType.matches('image/(jpeg|png|webp)');
      allow delete: if isStoreAdmin()
        && storeId == request.auth.token.get('tenantId', '');
    }
  }
}
`;
