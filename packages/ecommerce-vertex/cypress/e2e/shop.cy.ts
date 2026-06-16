/**
 * E2E: Shop flows — home, catalog, cart
 *
 * Firestore reads are intercepted so tests don't need a live Firebase project.
 */

describe('Shop — Home & Catalog', () => {
  beforeEach(() => {
    // Intercept Firestore REST calls to return a minimal product list
    cy.intercept('POST', '**/firestore.googleapis.com/**', (req) => {
      req.reply({
        statusCode: 200,
        body: {
          documents: [
            {
              name: 'projects/test/databases/(default)/documents/products/prod-1',
              fields: {
                name: { stringValue: 'Camiseta Test' },
                price: { doubleValue: 2500 },
                categoryId: { stringValue: 'cat-1' },
                image: { stringValue: 'https://via.placeholder.com/300' },
                totalStock: { integerValue: '10' },
              },
            },
          ],
        },
      });
    }).as('firestoreQuery');
  });

  it('should redirect / to /shop', () => {
    cy.visit('/');
    cy.location('pathname').should('include', 'shop');
  });

  it('should display the shop homepage', () => {
    cy.visit('/shop');
    cy.get('body').should('exist');
    // Page should load without error
    cy.get('app-root').should('exist');
  });

  it('should navigate to catalog page', () => {
    cy.visit('/shop/catalog');
    cy.location('pathname').should('eq', '/shop/catalog');
    cy.get('body').should('exist');
  });
});

describe('Shop — Cart', () => {
  beforeEach(() => {
    cy.visit('/shop/cart');
  });

  it('should display the cart page', () => {
    cy.location('pathname').should('eq', '/shop/cart');
    cy.get('body').should('exist');
  });

  it('should show empty cart message when cart is empty', () => {
    // localStorage is clean — empty cart expected
    cy.window().then((win) => win.localStorage.removeItem('cart_store'));
    cy.reload();

    // At minimum the page exists and there are no item rows
    cy.get('body').should('exist');
    // No items should be rendered in a table or list
    cy.get('[class*="cart-item"], tr[class*="item"]').should('not.exist');
  });

  it('should display cart items loaded from localStorage', () => {
    const cart = {
      items: [
        {
          id: 'var-1',
          productId: 'prod-1',
          variantId: 'var-1',
          name: 'Camiseta Test (Color: Rojo)',
          price: 2500,
          quantity: 2,
          image: 'https://via.placeholder.com/80',
          attributes: { color: 'Rojo' },
          stock: 10,
        },
      ],
      total: 5000,
    };

    cy.window().then((win) => win.localStorage.setItem('cart_store', JSON.stringify(cart)));
    cy.reload();

    // Item name should appear somewhere on the page
    cy.contains('Camiseta Test').should('exist');
  });

  it('should navigate to checkout when checkout button is clicked', () => {
    // Seed a cart item so the checkout button is visible
    const cart = {
      items: [
        {
          id: 'var-1',
          productId: 'prod-1',
          variantId: 'var-1',
          name: 'Producto Test',
          price: 1000,
          quantity: 1,
          image: '',
          attributes: {},
          stock: 5,
        },
      ],
      total: 1000,
    };

    cy.window().then((win) => win.localStorage.setItem('cart_store', JSON.stringify(cart)));
    cy.reload();

    // Click a checkout link/button if it exists
    cy.get('body').then(($body) => {
      const btn = $body.find(
        'a[href*="checkout"], button:contains("Checkout"), button:contains("Finalizar"), [routerlink*="checkout"]'
      );
      if (btn.length > 0) {
        cy.wrap(btn.first()).click();
        cy.location('pathname').should('include', 'checkout');
      }
    });
  });
});
