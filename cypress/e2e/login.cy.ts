describe('Platform login', () => {
  it('redirects unauthenticated users to /login', () => {
    cy.visit('/');
    cy.location('pathname').should('eq', '/login');
  });

  it('renders the login card and Google CTA', () => {
    cy.visit('/login');
    cy.contains('h1', 'Vertex Platform').should('be.visible');
    cy.contains('Panel de gestión de tiendas').should('be.visible');
    cy.contains('button', 'Continuar con Google').should('be.visible');
  });
});
