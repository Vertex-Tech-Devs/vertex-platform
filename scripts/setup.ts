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

  try {
    // 1. Muted .firebaserc
    const firebasercPath = path.join(ecommerceRoot, '.firebaserc');
    if (fs.existsSync(firebasercPath)) {
      const rc = {
        projects: {
          default: prodProjectId,
          prod: prodProjectId,
          dev: devProjectId,
        },
      };
      fs.writeFileSync(firebasercPath, JSON.stringify(rc, null, 2), 'utf8');
    }

    // 2. Muted src/environments/environment.ts
    const envPath = path.join(ecommerceRoot, 'src/environments/environment.ts');
    if (fs.existsSync(envPath)) {
      let content = fs.readFileSync(envPath, 'utf8');
      content = content.replace(/tenantId:\s*['"][^'"]*['"]/, `tenantId: '${tenantId}'`);
      content = content.replace(/apiKey:\s*['"][^'"]*['"]/, `apiKey: '${apiKey}'`);
      content = content.replace(/authDomain:\s*['"][^'"]*['"]/, `authDomain: '${authDomain}'`);
      content = content.replace(/projectId:\s*['"][^'"]*['"]/, `projectId: '${devProjectId}'`);
      content = content.replace(/storageBucket:\s*['"][^'"]*['"]/, `storageBucket: '${storageBucket}'`);
      content = content.replace(/publicKey:\s*['"][^'"]*['"]/, `publicKey: '${mpPublicKey}'`);
      content = content.replace(/cloudFunctionsUrl:\s*['"][^'"]*['"]/, `cloudFunctionsUrl: 'https://us-central1-${devProjectId}.cloudfunctions.net'`);
      fs.writeFileSync(envPath, content, 'utf8');
    }

    // 3. Muted src/environments/environment.prod.ts
    const envProdPath = path.join(ecommerceRoot, 'src/environments/environment.prod.ts');
    if (fs.existsSync(envProdPath)) {
      let content = fs.readFileSync(envProdPath, 'utf8');
      content = content.replace(/tenantId:\s*['"][^'"]*['"]/, `tenantId: '${tenantId}'`);
      content = content.replace(/apiKey:\s*['"][^'"]*['"]/, `apiKey: '${apiKey}'`);
      content = content.replace(/authDomain:\s*['"][^'"]*['"]/, `authDomain: '${authDomain}'`);
      content = content.replace(/projectId:\s*['"][^'"]*['"]/, `projectId: '${prodProjectId}'`);
      content = content.replace(/storageBucket:\s*['"][^'"]*['"]/, `storageBucket: '${storageBucket}'`);
      content = content.replace(/publicKey:\s*['"][^'"]*['"]/, `publicKey: '${mpPublicKey}'`);
      content = content.replace(/cloudFunctionsUrl:\s*['"][^'"]*['"]/, `cloudFunctionsUrl: 'https://us-central1-${prodProjectId}.cloudfunctions.net'`);
      fs.writeFileSync(envProdPath, content, 'utf8');
    }

    // 4. Muted src/index.html
    const indexPath = path.join(ecommerceRoot, 'src/index.html');
    if (fs.existsSync(indexPath)) {
      let content = fs.readFileSync(indexPath, 'utf8');
      content = content.replace(/<title>[^<]*<\/title>/, `<title>${storeName}</title>`);
      fs.writeFileSync(indexPath, content, 'utf8');
    }

    // 5. Generate functions/.env
    const envExamplePath = path.join(ecommerceRoot, 'functions/.env.example');
    const envFunctionsPath = path.join(ecommerceRoot, 'functions/.env');
    if (fs.existsSync(envExamplePath)) {
      let content = fs.readFileSync(envExamplePath, 'utf8');
      content = content.replace(/MERCADOPAGO_ACCESSTOKEN=[^\r\n]*/, `MERCADOPAGO_ACCESSTOKEN=${mpAccessToken}`);
      content = content.replace(/MERCADOPAGO_WEBHOOK_URL=[^\r\n]*/, `MERCADOPAGO_WEBHOOK_URL=https://us-central1-${prodProjectId}.cloudfunctions.net/mercadoPagoWebhookHandler`);
      content = content.replace(/SITE_URL=[^\r\n]*/, `SITE_URL=${siteUrl}`);
      fs.writeFileSync(envFunctionsPath, content, 'utf8');
    }

    s.stop('Configuración de marca blanca multitenant completada con éxito.');
    p.outro('¡Proceso de inicialización finalizado! El entorno local está listo para despliegues.');
  } catch (error) {
    s.stop('Error durante la configuración.');
    p.log.error(String(error));
  }
}

main().catch(console.error);
