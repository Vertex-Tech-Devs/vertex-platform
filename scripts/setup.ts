import * as fs from 'fs';
import * as path from 'path';
import * as p from '@clack/prompts';

async function main() {
  p.intro('=== Vertex Multi-tenant Storefront Setup Wizard ===');

  const storeName = await p.text({
    message: 'Ingrese el Nombre de la Tienda (ej. Mi Tienda Fashion):',
    placeholder: 'Mi Tienda',
    validate(value) {
      if (!value.trim()) return 'El nombre de la tienda es requerido.';
      return;
    },
  });
  if (p.isCancel(storeName)) {
    p.cancel('Operación cancelada.');
    process.exit(0);
  }

  const devProjectId = await p.text({
    message: 'Ingrese el Firebase Project ID de Desarrollo (Dev):',
    placeholder: 'vertex-platform-dev',
    validate(value) {
      if (!value.trim()) return 'El Project ID de Desarrollo es requerido.';
      return;
    },
  });
  if (p.isCancel(devProjectId)) {
    p.cancel('Operación cancelada.');
    process.exit(0);
  }

  const prodProjectId = await p.text({
    message: 'Ingrese el Firebase Project ID de Producción (Prod):',
    placeholder: 'vertex-platform-app',
    validate(value) {
      if (!value.trim()) return 'El Project ID de Producción es requerido.';
      return;
    },
  });
  if (p.isCancel(prodProjectId)) {
    p.cancel('Operación cancelada.');
    process.exit(0);
  }

  const apiKey = await p.text({
    message: 'Ingrese la Firebase API Key (Prod/Dev):',
    placeholder: 'AIzaSy...',
    validate(value) {
      if (!value.trim()) return 'La API Key es requerida.';
      return;
    },
  });
  if (p.isCancel(apiKey)) {
    p.cancel('Operación cancelada.');
    process.exit(0);
  }

  const authDomain = await p.text({
    message: 'Ingrese el Firebase Auth Domain:',
    placeholder: 'vertex-platform-app.firebaseapp.com',
    validate(value) {
      if (!value.trim()) return 'El Auth Domain es requerido.';
      return;
    },
  });
  if (p.isCancel(authDomain)) {
    p.cancel('Operación cancelada.');
    process.exit(0);
  }

  const storageBucket = await p.text({
    message: 'Ingrese el Firebase Storage Bucket:',
    placeholder: 'vertex-platform-app.firebasestorage.app',
    validate(value) {
      if (!value.trim()) return 'El Storage Bucket es requerido.';
      return;
    },
  });
  if (p.isCancel(storageBucket)) {
    p.cancel('Operación cancelada.');
    process.exit(0);
  }

  const siteUrl = await p.text({
    message: 'Ingrese la URL del Sitio Web:',
    placeholder: 'https://mitienda.web.app',
    validate(value) {
      if (!value.trim()) return 'La URL del sitio es requerida.';
      return;
    },
  });
  if (p.isCancel(siteUrl)) {
    p.cancel('Operación cancelada.');
    process.exit(0);
  }

  const mpPublicKey = await p.text({
    message: 'Ingrese la Clave Pública de MercadoPago (Client-side):',
    placeholder: 'TEST-xxxx-xxxx',
    validate(value) {
      if (!value.trim()) return 'La clave pública de MercadoPago es requerida.';
      return;
    },
  });
  if (p.isCancel(mpPublicKey)) {
    p.cancel('Operación cancelada.');
    process.exit(0);
  }

  const mpAccessToken = await p.text({
    message: 'Ingrese el Access Token de MercadoPago (Server-side):',
    placeholder: 'APP_USR-xxxx-xxxx',
    validate(value) {
      if (!value.trim()) return 'El access token de MercadoPago es requerido.';
      return;
    },
  });
  if (p.isCancel(mpAccessToken)) {
    p.cancel('Operación cancelada.');
    process.exit(0);
  }

  const s = p.spinner();
  s.start('Configurando e integrando parámetros multitenant...');

  const ecommerceRoot = path.join(__dirname, '../../ecommerce-vertex');
  const tenantId = storeName.toLowerCase().replace(/[^a-z0-9]/g, '-').replace(/-+/g, '-');

  // Helper for safe file mutation without TOCTOU race conditions
  const mutateFileIfExists = (filePath: string, mutator: (content: string) => string) => {
    try {
      const content = fs.readFileSync(filePath, 'utf8');
      const mutated = mutator(content);
      fs.writeFileSync(filePath, mutated, 'utf8');
    } catch (err: any) {
      if (err.code !== 'ENOENT') {
        throw err;
      }
    }
  };

  try {
    // 1. Muted .firebaserc
    const firebasercPath = path.join(ecommerceRoot, '.firebaserc');
    mutateFileIfExists(firebasercPath, () => {
      const rc = {
        projects: {
          default: prodProjectId,
          prod: prodProjectId,
          dev: devProjectId,
        },
      };
      return JSON.stringify(rc, null, 2);
    });

    // 2. Muted src/environments/environment.ts
    const envPath = path.join(ecommerceRoot, 'src/environments/environment.ts');
    mutateFileIfExists(envPath, (content) => {
      let result = content.replace(/tenantId:\s*['"][^'"]*['"]/, `tenantId: '${tenantId}'`);
      result = result.replace(/apiKey:\s*['"][^'"]*['"]/, `apiKey: '${apiKey}'`);
      result = result.replace(/authDomain:\s*['"][^'"]*['"]/, `authDomain: '${authDomain}'`);
      result = result.replace(/projectId:\s*['"][^'"]*['"]/, `projectId: '${devProjectId}'`);
      result = result.replace(/storageBucket:\s*['"][^'"]*['"]/, `storageBucket: '${storageBucket}'`);
      result = result.replace(/publicKey:\s*['"][^'"]*['"]/, `publicKey: '${mpPublicKey}'`);
      result = result.replace(/cloudFunctionsUrl:\s*['"][^'"]*['"]/, `cloudFunctionsUrl: 'https://us-central1-${devProjectId}.cloudfunctions.net'`);
      return result;
    });

    // 3. Muted src/environments/environment.prod.ts
    const envProdPath = path.join(ecommerceRoot, 'src/environments/environment.prod.ts');
    mutateFileIfExists(envProdPath, (content) => {
      let result = content.replace(/tenantId:\s*['"][^'"]*['"]/, `tenantId: '${tenantId}'`);
      result = result.replace(/apiKey:\s*['"][^'"]*['"]/, `apiKey: '${apiKey}'`);
      result = result.replace(/authDomain:\s*['"][^'"]*['"]/, `authDomain: '${authDomain}'`);
      result = result.replace(/projectId:\s*['"][^'"]*['"]/, `projectId: '${prodProjectId}'`);
      result = result.replace(/storageBucket:\s*['"][^'"]*['"]/, `storageBucket: '${storageBucket}'`);
      result = result.replace(/publicKey:\s*['"][^'"]*['"]/, `publicKey: '${mpPublicKey}'`);
      result = result.replace(/cloudFunctionsUrl:\s*['"][^'"]*['"]/, `cloudFunctionsUrl: 'https://us-central1-${prodProjectId}.cloudfunctions.net'`);
      return result;
    });

    // 4. Muted src/index.html
    const indexPath = path.join(ecommerceRoot, 'src/index.html');
    mutateFileIfExists(indexPath, (content) => {
      return content.replace(/<title>[^<]*<\/title>/, `<title>${storeName}</title>`);
    });

    // 5. Generate functions/.env
    const envExamplePath = path.join(ecommerceRoot, 'functions/.env.example');
    const envFunctionsPath = path.join(ecommerceRoot, 'functions/.env');
    try {
      const content = fs.readFileSync(envExamplePath, 'utf8');
      let result = content.replace(/MERCADOPAGO_ACCESSTOKEN=[^\r\n]*/, `MERCADOPAGO_ACCESSTOKEN=${mpAccessToken}`);
      result = result.replace(/MERCADOPAGO_WEBHOOK_URL=[^\r\n]*/, `MERCADOPAGO_WEBHOOK_URL=https://us-central1-${prodProjectId}.cloudfunctions.net/mercadoPagoWebhookHandler`);
      result = result.replace(/SITE_URL=[^\r\n]*/, `SITE_URL=${siteUrl}`);
      fs.writeFileSync(envFunctionsPath, result, 'utf8');
    } catch (err: any) {
      if (err.code !== 'ENOENT') {
        throw err;
      }
    }

    s.stop('Configuración de marca blanca multitenant completada con éxito.');
    p.outro('¡Proceso de inicialización finalizado! El entorno local está listo para despliegues.');
  } catch (error) {
    s.stop('Error durante la configuración.');
    p.log.error(String(error));
  }
}

main().catch(console.error);
