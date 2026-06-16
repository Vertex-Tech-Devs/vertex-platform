/// <reference types="cypress" />

// Block all outbound Firebase/Google API calls before every test.
// This ensures Angular boots instantly in CI (no waiting for unreachable backends).
// Individual tests register their own cy.intercept() calls, which take precedence
// over this global stub because Cypress matches interceptors in LIFO order.
beforeEach(() => {
  // Global Store Configuration Stub to prevent startup crashes or setup wizard blocks in E2E
  cy.intercept('GET', '**/documents/configuracion/store**', {
    statusCode: 200,
    body: {
      name: 'projects/test/databases/(default)/documents/configuracion/store',
      fields: {
        storeName: { stringValue: 'Tienda Test Vertex' },
        strapline: { stringValue: 'Tu tienda online' },
        currency: { stringValue: 'ARS' },
        currencySymbol: { stringValue: '$' },
        country: { stringValue: 'AR' },
        logoUrl: { nullValue: null },
        setupCompleted: { booleanValue: true },
      },
    },
  }).as('globalStoreConfig');

  cy.intercept('**/googleapis.com/**', { statusCode: 401, body: {} });
});

// ✅ Custom command: Login
Cypress.Commands.add('login', (email: string, password: string) => {
  cy.visit('/login');
  cy.get('[data-cy="email-input"]').type(email);
  cy.get('[data-cy="password-input"]').type(password);
  cy.get('[data-cy="submit-btn"]').click();
  cy.location('pathname').should('eq', '/dashboard');
});

// ✅ Custom command: Logout
Cypress.Commands.add('logout', () => {
  cy.get('[data-cy="user-menu"]').click();
  cy.get('[data-cy="logout-btn"]').click();
  cy.location('pathname').should('eq', '/login');
});

// ✅ Custom command: Add product to cart
Cypress.Commands.add('addToCart', (productId: string) => {
  cy.get(`[data-cy="product-${productId}"]`).within(() => {
    cy.get('[data-cy="add-to-cart-btn"]').click();
  });
  cy.get('[data-cy="success-message"]').should('be.visible');
});

// ✅ Custom command: Navigate to checkout
Cypress.Commands.add('goToCheckout', () => {
  cy.get('[data-cy="cart-icon"]').click();
  cy.get('[data-cy="checkout-btn"]').click();
  cy.location('pathname').should('eq', '/checkout');
});

// ✅ Custom command: Fill shipping form
Cypress.Commands.add('fillShippingForm', (shippingData: any) => {
  cy.get('[data-cy="street-input"]').type(shippingData.street);
  cy.get('[data-cy="city-input"]').type(shippingData.city);
  cy.get('[data-cy="state-select"]').select(shippingData.state);
  cy.get('[data-cy="zip-input"]').type(shippingData.zip);
});

// ✅ Custom command: Fill payment form
Cypress.Commands.add('fillPaymentForm', (paymentData: any) => {
  cy.get('[data-cy="card-number"]').type(paymentData.cardNumber);
  cy.get('[data-cy="card-expiry"]').type(paymentData.expiry);
  cy.get('[data-cy="card-cvc"]').type(paymentData.cvc);
});

// ✅ Custom command: Check API response
import type { Method } from 'cypress/types/net-stubbing';

Cypress.Commands.add('interceptAPI', (method: Method, pattern: string, fixture: string) => {
  cy.intercept(method, pattern, { fixture });
});

declare global {
  namespace Cypress {
    interface Chainable {
      login(email: string, password: string): Chainable<void>;
      logout(): Chainable<void>;
      addToCart(productId: string): Chainable<void>;
      goToCheckout(): Chainable<void>;
      fillShippingForm(data: any): Chainable<void>;
      fillPaymentForm(data: any): Chainable<void>;
      interceptAPI(method: Method, pattern: string, fixture: string): Chainable<void>;
    }
  }
}

export {};
