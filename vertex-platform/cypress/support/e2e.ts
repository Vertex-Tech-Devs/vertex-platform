/// <reference types="cypress" />

// ─── Global intercepts ────────────────────────────────────────────────────────

/**
 * Block all Google OAuth / Firestore REST calls by default so tests
 * never make real network requests.
 */
beforeEach(() => {
  // Intercept googleapis Auth REST (identitytoolkit, securetoken)
  cy.intercept('POST', 'https://identitytoolkit.googleapis.com/**', (req) => {
    req.reply({
      statusCode: 200,
      body: {
        idToken: buildPlatformAdminJwt(),
        email: 'admin@vertex.test',
        displayName: 'Platform Admin',
        localId: 'test-uid-platform-admin',
        registered: true,
        expiresIn: '3600',
      },
    });
  }).as('googleAuthSignIn');

  cy.intercept('POST', 'https://securetoken.googleapis.com/**', (req) => {
    req.reply({
      statusCode: 200,
      body: {
        id_token: buildPlatformAdminJwt(),
        access_token: 'fake-access-token',
        expires_in: '3600',
        token_type: 'Bearer',
      },
    });
  }).as('googleTokenRefresh');

  // Block emulator calls to googleapis.com that might leak
  cy.intercept('GET', 'https://www.googleapis.com/**', { statusCode: 200, body: {} }).as(
    'googleApisCatchAll',
  );
});

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Build a minimal fake JWT-like token string carrying platformAdmin: true.
 * It is NOT cryptographically valid — it is only read by the app's
 * Firebase Auth stub interceptor.
 */
function buildPlatformAdminJwt(): string {
  const header = btoa(JSON.stringify({ alg: 'RS256', typ: 'JWT' }));
  const payload = btoa(
    JSON.stringify({
      sub: 'test-uid-platform-admin',
      email: 'admin@vertex.test',
      name: 'Platform Admin',
      picture: '',
      platformAdmin: true,
      iss: 'https://securetoken.google.com/vertex-platform-dev',
      aud: 'vertex-platform-dev',
      iat: Math.floor(Date.now() / 1000),
      exp: Math.floor(Date.now() / 1000) + 3600,
    }),
  );
  const signature = 'fake-signature';
  return `${header}.${payload}.${signature}`;
}

// ─── Custom commands ──────────────────────────────────────────────────────────

/**
 * cy.loginAsPlatformAdmin()
 *
 * Stubs Firebase Auth state so the Angular app sees a signed-in user
 * with `platformAdmin: true` custom claim, bypassing all real network calls.
 */
Cypress.Commands.add('loginAsPlatformAdmin', () => {
  const token = buildPlatformAdminJwt();

  // Stub the Firebase Auth currentUser in localStorage / IndexedDB
  // Angular Fire reads this on startup.
  window.localStorage.setItem(
    'firebase:authUser:vertex-platform-dev:[DEFAULT]',
    JSON.stringify({
      uid: 'test-uid-platform-admin',
      email: 'admin@vertex.test',
      displayName: 'Platform Admin',
      emailVerified: true,
      isAnonymous: false,
      providerData: [
        {
          providerId: 'google.com',
          uid: 'admin@vertex.test',
          email: 'admin@vertex.test',
          displayName: 'Platform Admin',
          photoURL: null,
        },
      ],
      stsTokenManager: {
        refreshToken: 'fake-refresh-token',
        accessToken: token,
        expirationTime: Date.now() + 3_600_000,
      },
      createdAt: '1700000000000',
      lastLoginAt: String(Date.now()),
    }),
  );

  // Intercept the getIdTokenResult call used to read custom claims
  cy.intercept('POST', '**/token?key=*', {
    statusCode: 200,
    body: {
      id_token: token,
      refresh_token: 'fake-refresh',
      expires_in: '3600',
      token_type: 'Bearer',
    },
  }).as('tokenRefresh');

  // Intercept custom-claim fetch (Firebase REST)
  cy.intercept('POST', '**/accounts:lookup*', {
    statusCode: 200,
    body: {
      users: [
        {
          localId: 'test-uid-platform-admin',
          email: 'admin@vertex.test',
          displayName: 'Platform Admin',
          customAttributes: JSON.stringify({ platformAdmin: true }),
        },
      ],
    },
  }).as('accountLookup');
});

/**
 * cy.stubStores(stores)
 *
 * Intercepts Firestore REST requests for the `stores` collection and
 * returns the provided array of store objects.
 */
Cypress.Commands.add('stubStores', (stores: StoreStub[]) => {
  const documents = stores.map((s) => firestoreDocument('stores', s.id, s));

  // Firestore REST v1 list
  cy.intercept('GET', '**/documents/stores*', {
    statusCode: 200,
    body: { documents },
  }).as('firestoreListStores');

  // Firestore REST v1 individual get
  stores.forEach((s) => {
    cy.intercept('GET', `**/documents/stores/${s.id}*`, {
      statusCode: 200,
      body: firestoreDocument('stores', s.id, s),
    }).as(`firestoreGetStore-${s.id}`);
  });

  // Firestore gRPC-web / channel (used by @angular/fire v7+)
  cy.intercept('POST', '**/google.firestore.v1.Firestore/Listen**', {
    statusCode: 200,
    body: {},
  }).as('firestoreListen');
});

// ─── TypeScript helper types ──────────────────────────────────────────────────

export interface StoreStub {
  id: string;
  name: string;
  slug: string;
  ownerEmail: string;
  status: 'active' | 'provisioning' | 'suspended';
  createdAt?: string;
}

// ─── Firestore wire-format helper ────────────────────────────────────────────

function firestoreDocument(
  collection: string,
  id: string,
  data: Record<string, unknown>,
): Record<string, unknown> {
  const fields: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(data)) {
    if (typeof v === 'string') fields[k] = { stringValue: v };
    else if (typeof v === 'number') fields[k] = { integerValue: String(v) };
    else if (typeof v === 'boolean') fields[k] = { booleanValue: v };
    else if (v === null) fields[k] = { nullValue: null };
    else fields[k] = { stringValue: JSON.stringify(v) };
  }
  return {
    name: `projects/vertex-platform-dev/databases/(default)/documents/${collection}/${id}`,
    fields,
    createTime: '2024-01-01T00:00:00Z',
    updateTime: '2024-01-01T00:00:00Z',
  };
}

// ─── TypeScript declarations (augment Cypress namespace) ─────────────────────

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Cypress {
    interface Chainable {
      /**
       * Stub Firebase Auth to simulate a signed-in platform admin
       * with `platformAdmin: true` custom claim.
       */
      loginAsPlatformAdmin(): Chainable<void>;

      /**
       * Intercept Firestore calls and return the provided stores array.
       * @param stores - Array of store stubs to return.
       */
      stubStores(stores: StoreStub[]): Chainable<void>;
    }
  }
}
