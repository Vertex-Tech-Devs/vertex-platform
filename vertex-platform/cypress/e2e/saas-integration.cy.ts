/// <reference types="cypress" />

describe('SaaS Integration E2E - Real Local Emulator', () => {
  const adminEmail = 'juan.l.espeche@gmail.com';
  const newStoreSlug = `real-test-${Math.floor(Math.random() * 10000)}`;

  const loginAsRealPlatformAdmin = () => {
    cy.task('generateCustomToken', {
      uid: 'emulator-admin-uid',
      claims: { platformAdmin: true, superAdmin: true, email: adminEmail }
    }).then((token) => {
      cy.visit('http://localhost:4200/login');
      cy.window().then((win) => {
        const loginFn = (win as any).loginWithCustomToken;
        if (loginFn) {
          return loginFn(token);
        } else {
          return new Promise((resolve) => {
            const interval = setInterval(() => {
              if ((win as any).loginWithCustomToken) {
                clearInterval(interval);
                resolve((win as any).loginWithCustomToken(token));
              }
            }, 50);
          });
        }
      });
      // Session is now active. Navigate to /stores directly.
      cy.visit('http://localhost:4200/stores');
      cy.url({ timeout: 15000 }).should('include', '/stores');
    });
  };

  it('1 · List existing stores from Firestore emulator', () => {
    loginAsRealPlatformAdmin();
    
    // We expect the local database seeds (like Tienda Dos) to be rendered on screen.
    cy.contains('Tienda Dos', { timeout: 15000 }).should('be.visible');
    cy.contains('tienda-dos').should('be.visible');
  });

  it('2 · Create a new store using the live provisionStore cloud function', () => {
    loginAsRealPlatformAdmin();
    cy.visit('http://localhost:4200/stores/new');

    // Fill out the creation form
    cy.get('input[placeholder*="Nombre"], input[formcontrolname="name"]').type('Tienda Real Test E2E');
    
    // Clear and input the unique slug
    cy.get('input[placeholder*="slug"], input[formcontrolname="slug"]')
      .clear()
      .type(newStoreSlug);

    cy.get('input[placeholder*="mail"], input[formcontrolname="ownerEmail"]')
      .clear()
      .type('owner@reale2e.com');

    // Submit
    cy.get('button[type="submit"]').click();

    // Check we navigate to the provisioning status page of the newly created store
    cy.url({ timeout: 15000 }).should('match', /\/stores\/[a-zA-Z0-9_-]+/);

    // Verify the steps display and automatically complete
    cy.contains('Aprovisionando tienda', { timeout: 15000 }).should('be.visible');
    cy.contains('Crear proyecto GCP').should('be.visible');
    
    // Verify the store becomes fully active in the emulator
    cy.contains('Desplegar tienda', { timeout: 25000 }).should('be.visible');
  });

  it('3 · Open storefront and check real product database items', () => {
    // Visit the newly generated store in local storefront template
    cy.visit(`http://localhost:4201/shop?tenantId=tienda-dos`);

    // Verify that the catalog page successfully fetched products from local Firestore emulator
    cy.contains('Remera Vertex Classic', { timeout: 10000 }).should('be.visible');
    cy.contains('Jean Classic Fit').should('be.visible');
    cy.contains('$12,000').should('be.visible');
  });

  it('4 · View Store Details & DNS Domain Management', () => {
    // Clear any previous customDomain state to ensure form is displayed
    cy.task('clearStoreCustomDomain', { storeId: 'tienda-dos' });

    loginAsRealPlatformAdmin();
    // Navigate to tienda-dos details page
    cy.contains('Tienda Dos', { timeout: 15000 }).click();
    cy.url({ timeout: 15000 }).should('include', '/stores/tienda-dos');

    // Click "Dominios (DNS)" tab
    cy.contains('Dominios (DNS)').click();

    // Fill domain
    cy.get('input[placeholder*="tienda.com"]').type('reale2etestdomain.com');

    // Accept checklist checkboxes
    cy.get('.checkbox-custom').click({ multiple: true });

    // Intercept function calls
    cy.intercept('POST', '**/connectDomain', {
      body: {
        result: {
          success: true,
          dnsRecords: [
            { domainName: 'reale2etestdomain.com', type: 'A', rdata: '199.36.158.100', requiredAction: 'ADD' },
            { domainName: 'www.reale2etestdomain.com', type: 'CNAME', rdata: 'tienda-dos.web.app', requiredAction: 'ADD' }
          ]
        }
      }
    }).as('connectDomain');

    cy.intercept('POST', '**/verifyDomainDNSStatus', {
      body: {
        result: {
          success: true,
          status: 'pending',
          dnsRecords: [
            { domainName: 'reale2etestdomain.com', type: 'A', rdata: '199.36.158.100', requiredAction: 'ADD' },
            { domainName: 'www.reale2etestdomain.com', type: 'CNAME', rdata: 'tienda-dos.web.app', requiredAction: 'ADD' }
          ]
        }
      }
    }).as('verifyDomain');

    // Submit domain linking
    cy.contains('Vincular Dominio').click();
    cy.wait('@connectDomain');

    // Manually set customDomain in local emulator database to trigger reactive UI switch to DNS info view
    cy.task('setStoreCustomDomain', { storeId: 'tienda-dos', customDomain: 'reale2etestdomain.com' });

    // Click verify records DNS button
    cy.contains('Verificar Registros DNS').click();
    cy.wait('@verifyDomain');

    // Check required DNS records show up
    cy.contains('Registros DNS Requeridos').should('be.visible');
    cy.contains('CNAME').should('be.visible');
  });

  it('5 · Staff Invitation (Team tab)', () => {
    loginAsRealPlatformAdmin();
    cy.visit('http://localhost:4200/stores/tienda-dos');

    // Click "Equipo" tab
    cy.contains('Equipo (RBAC)').click();

    // Invite new staff
    cy.get('input[formcontrolname="email"]').type('staff-e2e@vertex.test');
    cy.contains('Enviar Invitación').click();

    // Check pending list
    cy.contains('staff-e2e@vertex.test', { timeout: 15000 }).should('be.visible');
  });

  it('6 · Platform-wide Billing Account Management', () => {
    loginAsRealPlatformAdmin();
    cy.visit('http://localhost:4200/settings/billing');

    // Add new billing account
    cy.get('input[placeholder*="XXXXXX-XXXXXX-XXXXXX"]').type('012345-555555-555555');
    cy.get('input[placeholder*="Vertex Billing Account"]').clear().type('Billing Account E2E Test');
    cy.contains('button', 'Agregar').click();

    // Verify it appears in active list
    cy.contains('Billing Account E2E Test', { timeout: 15000 }).should('be.visible');
  });

  it('7 · Storefront Cart & Checkout Flow', () => {
    // Visit tienda-dos shop storefront
    cy.visit('http://localhost:4201/shop?tenantId=tienda-dos');

    // Select the product
    cy.contains('Remera Vertex Classic', { timeout: 15000 }).click();

    // Add to cart
    cy.contains('Añadir al Carrito', { timeout: 15000 }).should('be.visible').click();
    
    // Visit cart
    cy.visit('http://localhost:4201/shop/cart?tenantId=tienda-dos');
    cy.contains('Iniciar Compra').click();

    // Fill contact and shipping details
    cy.get('#firstName').type('Jane');
    cy.get('#lastName').type('Doe');
    cy.get('#email').type('jane.doe@vertex.test');
    cy.get('#phone').type('+541122334455');
    cy.get('#address').type('Av. Corrientes 1234');
    cy.get('#city').type('Buenos Aires');
    cy.get('#zipCode').type('1414');
    cy.get('#province').type('Capital Federal');

    // Submit payment
    cy.contains('Pagar con Mercado Pago').click();

    // Verify redirect to order-confirmation page
    cy.url({ timeout: 25000 }).should('include', '/shop/order-confirmation');
    cy.contains('¡Gracias por tu compra, Jane!', { timeout: 15000 }).should('be.visible');
  });

  it('8 · Simulate MercadoPago Payment Webhook', () => {
    // We can simulate webhook payment notification for a new order.
    // First, let's create a pending order.
    cy.visit('http://localhost:4201/shop?tenantId=tienda-dos');
    cy.contains('Remera Vertex Classic', { timeout: 15000 }).click();
    cy.contains('Añadir al Carrito', { timeout: 15000 }).click();
    cy.visit('http://localhost:4201/shop/cart?tenantId=tienda-dos');
    cy.contains('Iniciar Compra').click();

    cy.get('#firstName').type('John');
    cy.get('#lastName').type('Doe');
    cy.get('#email').type('john.doe@vertex.test');
    cy.get('#phone').type('+541122334455');
    cy.get('#address').type('Av. Corrientes 1234');
    cy.get('#city').type('Buenos Aires');
    cy.get('#zipCode').type('1414');
    cy.get('#province').type('Capital Federal');

    // Intercept/capture the order ID when creating payment preference
    cy.intercept('POST', '**/createPaymentPreference').as('paymentPref');
    cy.contains('Pagar con Mercado Pago').click();
    
    cy.wait('@paymentPref', { timeout: 20000 }).then((interception) => {
      const orderId = interception.request.body.data.external_reference;
      expect(orderId).to.exist;

      // Now dispatch the simulated webhook notification payload to local function emulator
      cy.request({
        method: 'POST',
        url: `http://localhost:5001/demo-vertex/us-central1/mercadoPagoWebhookHandler?topic=payment&id=mp-mock-payment-${orderId}`,
        failOnStatusCode: false
      }).then((response) => {
        expect(response.status).to.eq(200);

        // Verify in Firestore emulator directly that order is updated to processing
        const orderUrl = `http://localhost:8080/v1/projects/demo-vertex/databases/(default)/documents/tenants/tienda-dos/orders/${orderId}`;
        cy.request(orderUrl).then((firestoreRes) => {
          const status = firestoreRes.body.fields.status.stringValue;
          expect(status).to.eq('processing');
        });
      });
    });
  });
});
