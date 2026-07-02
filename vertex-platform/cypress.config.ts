/// <reference types="node" />
import { defineConfig } from 'cypress';

export default defineConfig({
  e2e: {
    baseUrl: 'http://127.0.0.1:4200',
    specPattern: 'cypress/e2e/**/*.cy.ts',
    supportFile: 'cypress/support/e2e.ts',
    video: false,
    screenshotOnRunFailure: true,
    screenshotsFolder: 'cypress/screenshots',
    viewportWidth: 1366,
    viewportHeight: 900,
    setupNodeEvents(on, config) {
      on('task', {
        logToTerminal(msg) {
          console.log('\n===== BROWSER LOGS =====\n' + msg + '\n========================\n');
          return null;
        },
        generateCustomToken({ uid, claims }) {
          // Initialize firebase-admin if not already initialized
          process.env.FIREBASE_AUTH_EMULATOR_HOST = '127.0.0.1:9099';
          const { initializeApp, getApp } = require('firebase-admin/app');
          const { getAuth } = require('firebase-admin/auth');
          let app;
          try {
            app = getApp();
          } catch {
            app = initializeApp({ projectId: 'demo-vertex' });
          }
          return getAuth(app).createCustomToken(uid, claims);
        },
        clearStoreCustomDomain({ storeId }) {
          process.env.FIRESTORE_EMULATOR_HOST = '127.0.0.1:8080';
          const { initializeApp, getApp } = require('firebase-admin/app');
          const { getFirestore, FieldValue } = require('firebase-admin/firestore');
          let app;
          try {
            app = getApp();
          } catch {
            app = initializeApp({ projectId: 'demo-vertex' });
          }
          return getFirestore(app)
            .collection('stores')
            .doc(storeId)
            .update({ customDomain: FieldValue.delete() })
            .catch(() => null)
            .then(() => null);
        },
        setStoreCustomDomain({ storeId, customDomain }) {
          process.env.FIRESTORE_EMULATOR_HOST = '127.0.0.1:8080';
          const { initializeApp, getApp } = require('firebase-admin/app');
          const { getFirestore } = require('firebase-admin/firestore');
          let app;
          try {
            app = getApp();
          } catch {
            app = initializeApp({ projectId: 'demo-vertex' });
          }
          return getFirestore(app)
            .collection('stores')
            .doc(storeId)
            .update({ customDomain })
            .then(() => null);
        }
      });
      return config;
    }
  },
});
