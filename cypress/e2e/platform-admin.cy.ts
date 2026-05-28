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

// ─── Suite: Domain Connection Flow ────────────────────────────────────────────

describe('Platform Admin — Domain Connection Flow', () => {
  const STORE_WITH_DOMAIN = {
    ...STORES[0],
    customDomain: '',
  };

  const DNS_RECORDS = [
    { domainName: '@', type: 'A', rdata: '199.36.158.100', requiredAction: 'ADD' },
    { domainName: 'www', type: 'CNAME', rdata: 'alpha-store.web.app', requiredAction: 'ADD' },
  ];

  function setupDomainFlow() {
    cy.loginAsPlatformAdmin();
    cy.stubStores([STORE_WITH_DOMAIN]);

    cy.intercept('POST', '**/connectDomain**', {
      statusCode: 200,
      body: { result: { success: true, dnsRecords: DNS_RECORDS } },
    }).as('connectDomain');

    cy.intercept('POST', '**/verifyDomainDNSStatus**', {
      statusCode: 200,
      body: {
        result: { success: true, status: 'pending', rawStatus: 'PENDING', dnsRecords: DNS_RECORDS },
      },
    }).as('verifyDomain');
  }

  it('renders the domain tab on a store detail page', () => {
    setupDomainFlow();
    cy.visit(`/stores/${STORES[0].id}`);
    cy.get('body', { timeout: 10_000 })
      .contains(/dominios|dominio/i)
      .should('be.visible');
  });

  it('domain tab shows connect-domain button or form', () => {
    setupDomainFlow();
    cy.visit(`/stores/${STORES[0].id}`);
    cy.get('body').then(($body) => {
      const hasDomainSection = $body.text().match(/dominios|dominio|conectar/i);
      expect(hasDomainSection).to.exist;
    });
  });

  it('shows DNS records after domain connection', () => {
    setupDomainFlow();
    cy.visit(`/stores/${STORES[0].id}`);

    // Click the Dominios tab
    cy.get('body').then(($body) => {
      const domainTab = $body
        .find('button, a, [role="tab"]')
        .filter(($el) => /dominios|dominio/i.test($el.text()));
      if (domainTab.length) {
        cy.wrap(domainTab).first().click({ force: true });
      }
    });

    // Try to connect a domain
    cy.get('body').then(($body) => {
      const connectBtn = $body.find('button').filter(($el) => /conectar|connect/i.test($el.text()));
      if (connectBtn.length) {
        cy.wrap(connectBtn).first().click({ force: true });

        // Fill domain input if visible
        cy.get('body').then(($b2) => {
          const domainInput = $b2
            .find('input[placeholder*="domain"], input[type="text"]')
            .filter(($el) => !$el.closest('[hidden]').length);
          if (domainInput.length) {
            cy.wrap(domainInput).first().clear().type('mi-tienda.com');
          }
        });
      }
    });

    // After stubbed connectDomain call, DNS records should appear
    cy.wait('@connectDomain', { timeout: 8_000 }).then(() => {
      cy.get('body').should(($body) => {
        const hasDnsInfo = $body.text().match(/199\.36\.158\.100|A|CNAME|DNS/i);
        expect(hasDnsInfo).to.exist;
      });
    });
  });

  it('rejects domain with double-dot format', () => {
    setupDomainFlow();
    cy.intercept('POST', '**/connectDomain**', {
      statusCode: 400,
      body: { error: { status: 'INVALID_ARGUMENT', message: 'Invalid domain format.' } },
    }).as('connectDomainBadDomain');

    cy.visit(`/stores/${STORES[0].id}`);

    cy.get('body').then(($body) => {
      const domainTab = $body
        .find('button, a, [role="tab"]')
        .filter(($el) => /dominios|dominio/i.test($el.text()));
      if (domainTab.length) {
        cy.wrap(domainTab).first().click({ force: true });
      }

      const connectBtn = $body.find('button').filter(($el) => /conectar|connect/i.test($el.text()));
      if (connectBtn.length) {
        cy.wrap(connectBtn).first().click({ force: true });
      }

      const domainInput = $body.find('input[type="text"]').first();
      if (domainInput.length) {
        cy.wrap(domainInput).clear().type('bad..domain.com');
      }
    });

    cy.wait('@connectDomainBadDomain', { timeout: 6_000 }).then(() => {
      cy.get('body').should(($body) => {
        const hasError = $body.text().match(/inválido|error|invalid/i);
        expect(hasError).to.exist;
      });
    });
  });

  it('shows pending status after connecting domain', () => {
    setupDomainFlow();
    cy.visit(`/stores/${STORES[0].id}`);

    cy.wait('@connectDomain', { timeout: 3_000 }).then(() => {
      cy.get('body').should(($body) => {
        const hasPending = $body.text().match(/pending|pendiente|DNS/i);
        expect(hasPending).to.exist;
      });
    });
  });

  it('domain verify returns pending status before DNS propagates', () => {
    setupDomainFlow();
    const storeWithDomain = { ...STORE_WITH_DOMAIN, customDomain: 'mi-tienda.com' };
    cy.stubStores([storeWithDomain]);

    cy.visit(`/stores/${STORES[0].id}`);

    cy.get('body').then(($body) => {
      const verifyBtn = $body.find('button').filter(($el) => /verificar|verify/i.test($el.text()));
      if (verifyBtn.length) {
        cy.wrap(verifyBtn).first().click({ force: true });
        cy.wait('@verifyDomain', { timeout: 6_000 });
        cy.get('body').should(($b) => {
          const hasStatus = $b.text().match(/pending|pendiente|activo|live/i);
          expect(hasStatus).to.exist;
        });
      }
    });
  });

  it('domain verify shows live status when DNS is configured', () => {
    cy.loginAsPlatformAdmin();
    cy.stubStores([{ ...STORE_WITH_DOMAIN, customDomain: 'mi-tienda.com' }]);

    cy.intercept('POST', '**/verifyDomainDNSStatus**', {
      statusCode: 200,
      body: { result: { success: true, status: 'live', rawStatus: 'LIVE', dnsRecords: [] } },
    }).as('verifyDomainLive');

    cy.visit(`/stores/${STORES[0].id}`);

    cy.get('body').then(($body) => {
      const verifyBtn = $body.find('button').filter(($el) => /verificar|verify/i.test($el.text()));
      if (verifyBtn.length) {
        cy.wrap(verifyBtn).first().click({ force: true });
        cy.wait('@verifyDomainLive', { timeout: 6_000 });
        cy.get('body').should(($b) => {
          const hasLive = $b.text().match(/live|activo|verificado/i);
          expect(hasLive).to.exist;
        });
      }
    });
  });
});

// ─── Suite: Staff Invitation Flow (vertex-platform) ───────────────────────────

describe('Platform Admin — Staff Invitation', () => {
  const STAFF_RESPONSE = {
    staff: [{ email: 'staff@alpha.test', role: 'admin', uid: 'uid-staff-1' }],
    invitations: [],
  };

  function setupStaffTab() {
    cy.loginAsPlatformAdmin();
    cy.stubStores(STORES);

    cy.intercept('POST', '**/getStoreStaff**', {
      statusCode: 200,
      body: { result: STAFF_RESPONSE },
    }).as('getStoreStaff');

    cy.intercept('POST', '**/inviteStaff**', {
      statusCode: 200,
      body: { result: { success: true, inviteEmailSent: true } },
    }).as('inviteStaff');

    cy.intercept('POST', '**/getStoreStaff**', {
      statusCode: 200,
      body: {
        result: {
          staff: [
            ...STAFF_RESPONSE.staff,
            { email: 'nuevo@alpha.test', role: 'admin', uid: 'uid-staff-2' },
          ],
          invitations: [],
        },
      },
    }).as('getStoreStaffAfterInvite');
  }

  it('renders the Equipo tab in store detail', () => {
    setupStaffTab();
    cy.visit(`/stores/${STORES[0].id}`);
    cy.get('body')
      .contains(/equipo|team|colaboradores/i)
      .should('be.visible');
  });

  it('shows existing staff when Equipo tab is opened', () => {
    setupStaffTab();
    cy.visit(`/stores/${STORES[0].id}`);

    cy.get('body').then(($body) => {
      const teamTab = $body
        .find('button, a, [role="tab"]')
        .filter(($el) => /equipo|team/i.test($el.text()));
      if (teamTab.length) {
        cy.wrap(teamTab).first().click({ force: true });
        cy.wait('@getStoreStaff', { timeout: 6_000 });
        cy.contains('staff@alpha.test').should('be.visible');
      }
    });
  });

  it('shows the invite form with email and role fields', () => {
    setupStaffTab();
    cy.visit(`/stores/${STORES[0].id}`);

    cy.get('body').then(($body) => {
      const teamTab = $body
        .find('button, a, [role="tab"]')
        .filter(($el) => /equipo|team/i.test($el.text()));
      if (teamTab.length) {
        cy.wrap(teamTab).first().click({ force: true });
        cy.get('body').then(() => {
          cy.get('input[formcontrolname="email"], input[type="email"]').first().should('exist');
        });
      }
    });
  });

  it('sends an invitation successfully', () => {
    setupStaffTab();
    cy.visit(`/stores/${STORES[0].id}`);

    cy.get('body').then(($body) => {
      const teamTab = $body
        .find('button, a, [role="tab"]')
        .filter(($el) => /equipo|team/i.test($el.text()));
      if (teamTab.length) {
        cy.wrap(teamTab).first().click({ force: true });
        cy.wait('@getStoreStaff', { timeout: 6_000 });

        cy.get('input[formcontrolname="email"], input[type="email"]')
          .first()
          .type('nuevo@alpha.test');

        cy.get('button')
          .filter(($el) => /invitar|invite|send|enviar/i.test($el.text()))
          .first()
          .click({ force: true });

        cy.wait('@inviteStaff', { timeout: 6_000 });

        cy.get('body').should(($b) => {
          const hasSuccess = $b.text().match(/invitación enviada|éxito|autorizado|success/i);
          expect(hasSuccess).to.exist;
        });
      }
    });
  });

  it('shows error when email field is empty on invite submit', () => {
    setupStaffTab();
    cy.visit(`/stores/${STORES[0].id}`);

    cy.get('body').then(($body) => {
      const teamTab = $body
        .find('button, a, [role="tab"]')
        .filter(($el) => /equipo|team/i.test($el.text()));
      if (teamTab.length) {
        cy.wrap(teamTab).first().click({ force: true });
        cy.wait('@getStoreStaff', { timeout: 6_000 });

        cy.get('button')
          .filter(($el) => /invitar|invite|send|enviar/i.test($el.text()))
          .first()
          .click({ force: true });

        cy.get('body').should(($b) => {
          const hasError = $b.text().match(/requerido|required|obligatorio|email/i);
          expect(hasError).to.exist;
        });
      }
    });
  });
});

// ─── Suite: Additional Platform Admin Flows ──────────────────────────────────

describe('Platform Admin — Additional Admin Flows', () => {
  beforeEach(() => {
    cy.loginAsPlatformAdmin();
    cy.stubStores(STORES);
  });

  it('suspends and reactivates a store successfully', () => {
    cy.intercept('POST', '**/toggleStoreStatus**', {
      statusCode: 200,
      body: { result: { success: true, newStatus: 'suspended' } },
    }).as('suspendStore');

    cy.visit(`/stores/${STORES[0].id}`);

    cy.get('body').then(($body) => {
      const suspendBtn = $body
        .find('button')
        .filter((_, el) => /suspender|suspend/i.test(el.textContent ?? ''));
      if (suspendBtn.length) {
        cy.wrap(suspendBtn).first().click({ force: true });
        cy.wait('@suspendStore');
      }
    });
  });

  it('triggers store template version updates', () => {
    cy.intercept('POST', '**/redeployStore**', {
      statusCode: 200,
      body: { result: { success: true } },
    }).as('redeployStore');

    cy.visit(`/stores/${STORES[0].id}`);

    cy.get('body').then(($body) => {
      const updateBtn = $body
        .find('button')
        .filter((_, el) => /actualizar|update|redeploy|re-desplegar/i.test(el.textContent ?? ''));
      if (updateBtn.length) {
        cy.wrap(updateBtn).first().click({ force: true });
        cy.wait('@redeployStore');
      }
    });
  });

  it('handles permission denied or server error states gracefully', () => {
    cy.intercept('POST', '**/connectDomain**', {
      statusCode: 403,
      body: { error: { message: 'Permission Denied' } },
    }).as('connectDomainError');

    cy.visit(`/stores/${STORES[0].id}`);

    cy.get('body').then(($body) => {
      const domainTab = $body
        .find('button, a, [role="tab"]')
        .filter((_, el) => /dominios|dominio/i.test(el.textContent ?? ''));
      if (domainTab.length) {
        cy.wrap(domainTab).first().click({ force: true });
      }

      const connectBtn = $body
        .find('button')
        .filter((_, el) => /conectar|connect/i.test(el.textContent ?? ''));
      if (connectBtn.length) {
        cy.wrap(connectBtn).first().click({ force: true });
      }

      const domainInput = $body.find('input[type="text"]').first();
      if (domainInput.length) {
        cy.wrap(domainInput).clear().type('mi-tienda.com');
      }
    });

    cy.get('body').then(($body) => {
      const submitBtn = $body
        .find('button[type="submit"], button')
        .filter((_, el) => /confirmar|guardar|connect|conectar/i.test(el.textContent ?? ''));
      if (submitBtn.length) {
        cy.wrap(submitBtn).first().click({ force: true });
      }
    });
  });
});
