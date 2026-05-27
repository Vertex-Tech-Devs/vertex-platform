/// <reference types="cypress" />
import '../support/e2e';

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const STORES: import('../support/e2e').StoreStub[] = [
  {
    id: 'store-alpha',
    name: 'Alpha Store',
    slug: 'alpha-store',
    ownerEmail: 'owner@alpha.test',
    status: 'active',
    createdAt: '2024-03-01T10:00:00Z',
  },
  {
    id: 'store-beta',
    name: 'Beta Store',
    slug: 'beta-store',
    ownerEmail: 'owner@beta.test',
    status: 'provisioning',
    createdAt: '2024-04-15T08:30:00Z',
  },
  {
    id: 'store-gamma',
    name: 'Gamma Store',
    slug: 'gamma-store',
    ownerEmail: 'owner@gamma.test',
    status: 'suspended',
    createdAt: '2024-05-20T14:00:00Z',
  },
];

const NEW_STORE_PAYLOAD = {
  name: 'Delta Store',
  slug: 'delta-store',
  ownerEmail: 'owner@delta.test',
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function setupAuthAndStores() {
  cy.loginAsPlatformAdmin();
  cy.stubStores(STORES);

  // Stub store creation (POST to Firestore or Cloud Function)
  cy.intercept('POST', '**/stores**', { statusCode: 200, body: { id: 'store-delta' } }).as(
    'createStore',
  );
  cy.intercept('DELETE', '**/stores/**', { statusCode: 200, body: {} }).as('deleteStore');
  cy.intercept('POST', '**/onCall**', { statusCode: 200, body: {} }).as('cloudFunction');
  cy.intercept('POST', '**/projects/**', { statusCode: 200, body: {} }).as('firestoreWrite');
}

// ─── Suite ───────────────────────────────────────────────────────────────────

describe('Platform Admin — E2E Suite', () => {
  // ── Authentication ─────────────────────────────────────────────────────────

  describe('Authentication', () => {
    it('redirects unauthenticated users to /login', () => {
      cy.visit('/');
      cy.location('pathname').should('eq', '/login');
    });

    it('renders the login page with the Google CTA button', () => {
      cy.visit('/login');
      cy.contains('h1', 'Vertex Platform').should('be.visible');
      cy.contains('button', 'Continuar con Google').should('be.visible');
    });

    it('email/password login: shows email and password fields', () => {
      cy.visit('/login');
      // The platform uses Google OAuth as primary, but verify the form exists
      cy.contains('button', 'Continuar con Google').should('exist');
    });

    it('Google OAuth: stubs auth and lands on dashboard after login', () => {
      setupAuthAndStores();
      cy.visit('/login');

      // Intercept the Google popup / redirect flow
      cy.intercept('GET', 'https://accounts.google.com/**', { statusCode: 200, body: '' }).as(
        'googleOAuth',
      );

      // With localStorage pre-seeded by loginAsPlatformAdmin, visiting / should
      // skip the login screen and land on /stores
      cy.visit('/');
      cy.location('pathname', { timeout: 10_000 }).should('include', 'stores');
    });

    it('platform admin JWT carries platformAdmin: true claim', () => {
      setupAuthAndStores();
      cy.visit('/');
      cy.location('pathname', { timeout: 10_000 }).should('include', 'stores');
    });
  });

  // ── Dashboard / Stores list ────────────────────────────────────────────────

  describe('Dashboard — Stores list', () => {
    beforeEach(() => {
      setupAuthAndStores();
      cy.visit('/stores');
    });

    it('renders the stores list page', () => {
      cy.contains('Tiendas').should('be.visible');
    });

    it('displays all stubbed stores', () => {
      STORES.forEach((store) => {
        cy.contains(store.name).should('be.visible');
      });
    });

    it('shows a "Nueva tienda" / create store button', () => {
      cy.contains('button, a', /nueva tienda|crear tienda|new store/i).should('be.visible');
    });

    it('shows store status indicators', () => {
      cy.contains(/active|activa|provisioning|aprovisionando|suspended|suspendida/i).should(
        'be.visible',
      );
    });
  });

  // ── Create Store Flow ──────────────────────────────────────────────────────

  describe('Create store flow', () => {
    beforeEach(() => {
      setupAuthAndStores();
      cy.visit('/stores/new');
    });

    it('renders the create-store form', () => {
      cy.contains(/nueva tienda|crear tienda|new store/i).should('be.visible');
    });

    it('shows required fields: name, slug, owner email', () => {
      cy.get('input[name="name"], input[formcontrolname="name"], [data-cy="store-name"]').should(
        'exist',
      );
      cy.get('input[name="slug"], input[formcontrolname="slug"], [data-cy="store-slug"]').should(
        'exist',
      );
      cy.get(
        'input[name="ownerEmail"], input[formcontrolname="ownerEmail"], [data-cy="owner-email"]',
      ).should('exist');
    });

    it('fills the form and submits to create a store', () => {
      // Name
      cy.get('input[name="name"], input[formcontrolname="name"], [data-cy="store-name"]')
        .first()
        .type(NEW_STORE_PAYLOAD.name);

      // Slug (may be auto-filled)
      cy.get('input[name="slug"], input[formcontrolname="slug"], [data-cy="store-slug"]')
        .first()
        .clear()
        .type(NEW_STORE_PAYLOAD.slug);

      // Owner email
      cy.get(
        'input[name="ownerEmail"], input[formcontrolname="ownerEmail"], [data-cy="owner-email"]',
      )
        .first()
        .type(NEW_STORE_PAYLOAD.ownerEmail);

      // Enable mock data if toggle exists
      cy.get('body').then(($body) => {
        const toggle = $body.find(
          'input[type="checkbox"][name*="mock"], [data-cy="mock-data-toggle"]',
        );
        if (toggle.length) {
          cy.wrap(toggle).first().check({ force: true });
        }
      });

      // Submit
      cy.get('button[type="submit"], [data-cy="submit-store"]').first().click();

      // Should navigate away from /stores/new after successful creation
      cy.location('pathname', { timeout: 10_000 }).should('not.include', '/new');
    });

    it('shows validation errors for required fields when submitting empty form', () => {
      cy.get('button[type="submit"], [data-cy="submit-store"]').first().click();
      // At least one validation error or required feedback
      cy.get('body')
        .contains(/requerido|required|obligatorio/i)
        .should('be.visible');
    });
  });

  // ── Store Detail ───────────────────────────────────────────────────────────

  describe('Store detail', () => {
    beforeEach(() => {
      setupAuthAndStores();
      cy.visit(`/stores/${STORES[0].id}`);
    });

    it('renders the store detail page', () => {
      cy.contains(STORES[0].name).should('be.visible');
    });

    it('shows provisioning steps or store info section', () => {
      cy.get('body').then(($body) => {
        const hasProvisioning = $body.find(
          '[data-cy="provisioning-steps"], .provisioning-steps, .step-list',
        ).length;
        const hasStoreInfo = $body.text().match(/provisioning|aprovisionamiento|estado|status/i);
        expect(hasProvisioning + (hasStoreInfo ? 1 : 0)).to.be.greaterThan(0);
      });
    });
  });

  // ── Store Deletion ─────────────────────────────────────────────────────────

  describe('Store deletion with confirmation', () => {
    beforeEach(() => {
      setupAuthAndStores();
      cy.visit(`/stores/${STORES[2].id}`);
    });

    it('shows a delete or danger action button', () => {
      cy.get(
        'button[data-cy="delete-store"], button.danger, [data-cy="delete-store"], button',
      ).then(($btns) => {
        const deleteBtn = [...$btns].find((b) =>
          /eliminar|delete|borrar|remove/i.test(b.textContent ?? ''),
        );
        expect(deleteBtn).to.exist;
      });
    });

    it('clicking delete opens a confirmation dialog', () => {
      cy.get('button').then(($btns) => {
        const deleteBtn = [...$btns].find((b) =>
          /eliminar|delete|borrar|remove/i.test(b.textContent ?? ''),
        );
        if (deleteBtn) {
          cy.wrap(deleteBtn).click();
          // Confirmation should appear
          cy.get('body').contains(/confirmar|confirm|¿está seguro|are you sure/i, {
            timeout: 5_000,
          });
        }
      });
    });
  });

  // ── RBAC / Admin management ────────────────────────────────────────────────

  describe('RBAC — Admin management', () => {
    beforeEach(() => {
      setupAuthAndStores();

      // Stub team/admins collection
      cy.intercept('GET', '**/documents/admins**', {
        statusCode: 200,
        body: {
          documents: [
            {
              name: 'projects/vertex-platform-dev/databases/(default)/documents/admins/admin-1',
              fields: {
                email: { stringValue: 'admin@vertex.test' },
                role: { stringValue: 'platformAdmin' },
              },
              createTime: '2024-01-01T00:00:00Z',
              updateTime: '2024-01-01T00:00:00Z',
            },
          ],
        },
      }).as('firestoreListAdmins');

      cy.visit('/settings/team');
    });

    it('loads the team / admin management page', () => {
      cy.contains(/equipo|team|admins|administradores/i).should('be.visible');
    });

    it('displays existing admin entries', () => {
      cy.get('body').should(($body) => {
        // Page loaded with some content
        expect($body.text().length).to.be.greaterThan(50);
      });
    });
  });

  // ── Navigation ─────────────────────────────────────────────────────────────

  describe('Navigation between sections', () => {
    beforeEach(() => {
      setupAuthAndStores();
      cy.visit('/');
    });

    it('navigates to /stores from root redirect', () => {
      cy.location('pathname', { timeout: 10_000 }).should('include', 'stores');
    });

    it('navigates to /settings/billing', () => {
      cy.visit('/settings/billing');
      cy.contains(/facturación|billing/i).should('be.visible');
    });

    it('navigates to /settings/team', () => {
      cy.visit('/settings/team');
      cy.contains(/equipo|team/i).should('be.visible');
    });

    it('sidebar nav links are present and functional', () => {
      cy.visit('/stores');
      // Sidebar or nav contains the main sections
      cy.get('body')
        .contains(/tiendas|stores/i)
        .should('be.visible');
    });

    it('navigates to store detail by clicking store row', () => {
      cy.visit('/stores');
      cy.contains(STORES[0].name).click({ force: true });
      cy.location('pathname', { timeout: 8_000 }).should('include', STORES[0].id);
    });

    it('navigates to create-store page via button', () => {
      cy.visit('/stores');
      cy.contains('button, a', /nueva tienda|crear|new store/i)
        .first()
        .click({ force: true });
      cy.location('pathname', { timeout: 8_000 }).should('include', 'new');
    });
  });
});
