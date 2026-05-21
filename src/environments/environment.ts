export const environment = {
  production: false,
  // Set to true to auto-generate a debug token printed in the console,
  // or set to a specific token string from Firebase Console → App Check → Apps → Manage debug tokens
  appCheckDebugToken: true as boolean | string,
  errorReportingUrl: '', // empty in dev — errors go to console only
  firebaseConfig: {
    apiKey: 'AIzaSyCmADhCFtiRKHz3ICFZo0rmWqXJ5e-ONFg',
    authDomain: 'vertex-platform-dev.firebaseapp.com',
    projectId: 'vertex-platform-dev',
    storageBucket: 'vertex-platform-dev.firebasestorage.app',
    messagingSenderId: '1011688892358',
    appId: '1:1011688892358:web:c28f5cb282321d602174c7',
  },
};
