export const environment = {
  production: false,
  tenantId: 'store',
  firebaseConfig: {
    apiKey: 'YOUR_API_KEY',
    authDomain: 'YOUR_AUTH_DOMAIN',
    projectId: 'YOUR_PROJECT_ID',
    storageBucket: 'YOUR_STORAGE_BUCKET',
    messagingSenderId: 'YOUR_MESSAGING_SENDER_ID',
    appId: 'YOUR_APP_ID',
  },
  mercadoPago: {
    // MercadoPago public key — use a TEST- prefixed key for sandbox environments.
    // Get yours at https://www.mercadopago.com.ar/developers/panel/credentials
    publicKey: 'TEST-YOUR_PUBLIC_KEY',
  },
  api: {
    // Base URL for Firebase Cloud Functions.
    // Local emulator: 'http://127.0.0.1:5001/<project-id>/us-central1'
    // Deployed:       'https://us-central1-<project-id>.cloudfunctions.net'
    cloudFunctionsUrl: 'http://127.0.0.1:5001/YOUR_PROJECT_ID/us-central1',
  },
  features: {
    // Enable verbose console logging throughout the app
    seedDataEnabled: false,
    debugLogging: false,
  },
};
