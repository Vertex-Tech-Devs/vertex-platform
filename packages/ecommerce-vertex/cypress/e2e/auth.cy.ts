describe('Admin Authentication', () => {
  beforeEach(() => {
    cy.visit('/admin/login');
  });

  it('should render Google OAuth login action', () => {
    cy.contains('h4', 'Iniciar Sesión').should('exist');
    cy.contains('button', 'Iniciar sesión con Google').should('exist');
  });

  it('should show OAuth-only guidance text', () => {
    cy.contains('Ingresá únicamente con tu cuenta de Google autorizada').should('exist');
  });

  it('should keep Google button enabled on initial render', () => {
    cy.contains('button', 'Iniciar sesión con Google').should('be.enabled');
  });
});
