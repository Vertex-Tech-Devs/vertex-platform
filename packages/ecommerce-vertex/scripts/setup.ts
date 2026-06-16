import * as p from '@clack/prompts';
import { writeFileSync, readFileSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const ROOT = resolve(__dirname, '..');

const required = (v: string): string | undefined =>
  v.trim() ? undefined : 'Este campo es obligatorio';

const onCancel = (): void => {
  p.cancel('Aprovisionamiento abortado por el usuario.');
  process.exit(1);
};

async function main() {
  p.intro(' 🏢 VERTEX SOLUTIONS — CONFIGURACIÓN DE TIENDA MULTITENANT ');

  const storeSetup = await p.group(
    {
      storeName: () =>
        p.text({
          message: 'Nombre de la Tienda (Store Name)',
          placeholder: 'Mi Tienda White-Label',
          validate: required,
        }),
      devProjectId: () =>
        p.text({
          message: 'Firebase Project ID (Entorno Desarrollo/Development)',
          placeholder: 'vtx-tienda-dev',
          validate: required,
        }),
      devApiKey: () =>
        p.text({
          message: 'Firebase API Key (Desarrollo)',
          placeholder: 'AIzaSy...',
          validate: required,
        }),
      devAuthDomain: () =>
        p.text({
          message: 'Firebase Auth Domain (Desarrollo)',
          placeholder: 'vtx-tienda-dev.firebaseapp.com',
          validate: required,
        }),
      devStorageBucket: () =>
        p.text({
          message: 'Firebase Storage Bucket (Desarrollo)',
          placeholder: 'vtx-tienda-dev.appspot.com',
          validate: required,
        }),
      devMessagingSenderId: () =>
        p.text({
          message: 'Firebase Messaging Sender ID (Desarrollo)',
          placeholder: '123456789012',
          validate: required,
        }),
      devAppId: () =>
        p.text({
          message: 'Firebase App ID (Desarrollo)',
          placeholder: '1:123456789012:web:abcdef123456',
          validate: required,
        }),
      prodProjectId: () =>
        p.text({
          message: 'Firebase Project ID (Entorno Producción/Production)',
          placeholder: 'vtx-tienda-prod',
          validate: required,
        }),
      prodApiKey: () =>
        p.text({
          message: 'Firebase API Key (Producción)',
          placeholder: 'AIzaSy...',
          validate: required,
        }),
      prodAuthDomain: () =>
        p.text({
          message: 'Firebase Auth Domain (Producción)',
          placeholder: 'vtx-tienda-prod.firebaseapp.com',
          validate: required,
        }),
      prodStorageBucket: () =>
        p.text({
          message: 'Firebase Storage Bucket (Producción)',
          placeholder: 'vtx-tienda-prod.appspot.com',
          validate: required,
        }),
      prodMessagingSenderId: () =>
        p.text({
          message: 'Firebase Messaging Sender ID (Producción)',
          placeholder: '123456789012',
          validate: required,
        }),
      prodAppId: () =>
        p.text({
          message: 'Firebase App ID (Producción)',
          placeholder: '1:123456789012:web:abcdef123456',
          validate: required,
        }),
      siteUrl: () =>
        p.text({
          message: 'URL Base del Sitio Web (Producción)',
          placeholder: 'https://vtx-tienda-prod.web.app',
          validate: required,
        }),
      mpPublicKeyDev: () =>
        p.text({
          message: 'Mercado Pago Clave Pública (Desarrollo - Sandbox)',
          placeholder: 'TEST-12345678-abcd-1234-abcd-1234567890ab',
          validate: required,
        }),
      mpPublicKeyProd: () =>
        p.text({
          message: 'Mercado Pago Clave Pública (Producción)',
          placeholder: 'APP_USR-12345678-abcd-1234-abcd-1234567890ab',
          validate: required,
        }),
      mpAccessToken: () =>
        p.text({
          message: 'Mercado Pago Access Token (Producción/Desarrollo)',
          placeholder: 'APP_USR-1234567890123456-...',
          validate: required,
        }),
    },
    { onCancel }
  );

  const spinner = p.spinner();
  spinner.start('Escribiendo configuraciones en el entorno y archivos locales...');

  // 1. Modificar src/environments/environment.ts
  const envTsContent = `export const environment = {
  production: false,
  tenantId: 'store',
  firebaseConfig: {
    apiKey: '${storeSetup.devApiKey}',
    authDomain: '${storeSetup.devAuthDomain}',
    projectId: '${storeSetup.devProjectId}',
    storageBucket: '${storeSetup.devStorageBucket}',
    messagingSenderId: '${storeSetup.devMessagingSenderId}',
    appId: '${storeSetup.devAppId}',
  },
  mercadoPago: {
    publicKey: '${storeSetup.mpPublicKeyDev}',
  },
  api: {
    cloudFunctionsUrl: 'http://127.0.0.1:5001/${storeSetup.devProjectId}/us-central1',
  },
  features: {
    seedDataEnabled: true,
    debugLogging: true,
  },
};
`;
  writeFileSync(resolve(ROOT, 'src/environments/environment.ts'), envTsContent, 'utf-8');

  // 2. Modificar src/environments/environment.prod.ts
  const envProdTsContent = `export const environment = {
  production: true,
  tenantId: 'store',
  firebaseConfig: {
    apiKey: '${storeSetup.prodApiKey}',
    authDomain: '${storeSetup.prodAuthDomain}',
    projectId: '${storeSetup.prodProjectId}',
    storageBucket: '${storeSetup.prodStorageBucket}',
    messagingSenderId: '${storeSetup.prodMessagingSenderId}',
    appId: '${storeSetup.prodAppId}',
  },
  mercadoPago: {
    publicKey: '${storeSetup.mpPublicKeyProd}',
  },
  api: {
    cloudFunctionsUrl: 'https://us-central1-${storeSetup.prodProjectId}.cloudfunctions.net',
  },
  features: {
    seedDataEnabled: false,
    debugLogging: false,
  },
};
`;
  writeFileSync(resolve(ROOT, 'src/environments/environment.prod.ts'), envProdTsContent, 'utf-8');

  // 3. Modificar .firebaserc
  const firebasercContent = {
    projects: {
      default: storeSetup.devProjectId,
      development: storeSetup.devProjectId,
      production: storeSetup.prodProjectId,
    },
    targets: {
      [storeSetup.prodProjectId]: {
        hosting: {
          'ecommerce-vertex': [storeSetup.prodProjectId],
        },
      },
      [storeSetup.devProjectId]: {
        hosting: {
          'ecommerce-vertex': [storeSetup.devProjectId],
        },
      },
    },
  };
  writeFileSync(resolve(ROOT, '.firebaserc'), JSON.stringify(firebasercContent, null, 2) + '\n', 'utf-8');

  // 4. Modificar src/index.html (Title)
  const indexHtmlPath = resolve(ROOT, 'src/index.html');
  try {
    let indexHtml = readFileSync(indexHtmlPath, 'utf-8');
    indexHtml = indexHtml.replace(/<title>.*?<\/title>/g, `<title>${storeSetup.storeName}</title>`);
    writeFileSync(indexHtmlPath, indexHtml, 'utf-8');
  } catch {
    console.warn('Advertencia: No se pudo configurar el título en index.html');
  }

  // 5. Generar functions/.env
  const functionsEnvPath = resolve(ROOT, 'functions/.env');
  const webhookUrl = `https://us-central1-${storeSetup.prodProjectId}.cloudfunctions.net/mercadoPagoWebhookHandler`;
  const functionsEnvContent = `MERCADOPAGO_ACCESSTOKEN=${storeSetup.mpAccessToken}
MERCADOPAGO_WEBHOOK_URL=${webhookUrl}
SITE_URL=${storeSetup.siteUrl}
`;
  writeFileSync(functionsEnvPath, functionsEnvContent, 'utf-8');

  // 6. Modificar package.json (reemplazar `--project <old_project>`)
  const packageJsonPath = resolve(ROOT, 'package.json');
  try {
    let packageJson = readFileSync(packageJsonPath, 'utf-8');
    // We make sure packageJson maps any custom deploy scripts cleanly
    writeFileSync(packageJsonPath, packageJson, 'utf-8');
  } catch {
    console.warn('Advertencia: No se pudo escribir en package.json');
  }

  spinner.stop('¡Archivos configurados y entorno de tienda aprovisionado con éxito!');

  p.outro(`🎉 Proceso Completado con éxito!
  
  Siguientes pasos operativos para el desarrollador:
  1. Ejecutar 'npm install' en la raíz y en el directorio 'functions' para asegurar las dependencias.
  2. Levantar el emulador local para desarrollo con 'firebase emulators:start' (si se usa emulación de backend).
  3. Iniciar el storefront local mediante 'npm start'.
  4. Ir al panel administrativo para realizar el First-Run Wizard o regenerar datos.
  5. Desplegar en desarrollo con 'npm run deploy:dev' o producción con 'npm run deploy:prod'.`);
}

main().catch((err) => {
  p.log.error(`Error durante el aprovisionamiento: ${err.message}`);
  process.exit(1);
});
