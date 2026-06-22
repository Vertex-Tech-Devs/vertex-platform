export const environment = {
  production: true,
  appCheckDebugToken: false as boolean | string,
  // TODO: Register reCAPTCHA v3 in Firebase Console → App Check → Apps → Register,
  // then paste the site key here. Leave empty to skip App Check enforcement.
  appCheckSiteKey: '',
  // Routed via Firebase Hosting rewrite → logClientError Cloud Function
  errorReportingUrl: '/api/log-error',
  firebaseConfig: {
    apiKey: 'AIzaSyBQTl4_xK4AJW9Q6ts48Nop-x6ME-4gCzs',
    authDomain: 'vertex-platform-app.firebaseapp.com',
    projectId: 'vertex-platform-app',
    storageBucket: 'vertex-platform-app.firebasestorage.app',
    messagingSenderId: '291764287509',
    appId: '1:291764287509:web:50049859785fab7673761c',
  },
};
