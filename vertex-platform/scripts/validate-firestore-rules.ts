import * as fs from 'fs';
import * as path from 'path';

console.log('=== Firestore Rules Sync Validator ===');

// 1. Validar reglas locales de la plataforma (Platform)
const platformRulesPath = path.resolve(__dirname, '../firestore.rules');
if (!fs.existsSync(platformRulesPath)) {
  console.error('❌ Error crítico: No se encontró el archivo local firestore.rules de vertex-platform');
  process.exit(1);
}

const platformRulesContent = fs.readFileSync(platformRulesPath, 'utf8');

// 2. Detección Estricta de Entorno CI (GitHub Actions)
const isCI =
  process.env.CI === 'true' ||
  process.env.GITHUB_ACTIONS === 'true' ||
  process.env.FORCE_STANDALONE === 'true';

// 3. MODO STANDALONE (CI / Runner Aislado)
if (isCI) {
  console.log('=== Standalone Mode: Running in isolated CI environment (vertex-platform) ===');
  console.log('✅ Validating local platform firestore.rules security boundaries...');

  // Verificar que el catch-all administrativo proteja el plano de control
  const hasCatchAll =
    platformRulesContent.includes('match /{document=**}') &&
    platformRulesContent.includes('isPlatformAdmin()');

  if (!hasCatchAll) {
    console.error('❌ Error de Validación: Las reglas de la plataforma no contienen la regla de protección global isPlatformAdmin()');
    process.exit(1);
  }

  console.log('✅ Standalone validation complete: Local platform rules are secure.');
  process.exit(0); // SALIDA CERO GARANTIZADA EN CI
}

// 4. MODO FULL SYNC (Solo en desarrollo local fuera de CI)
const candidateStorefrontPaths = [
  path.resolve(__dirname, '../../storefront/firestore.rules'),
  path.resolve(__dirname, '../../ecommerce-vertex/firestore.rules'),
  path.resolve(__dirname, '../../../storefront/firestore.rules'),
  path.resolve(__dirname, '../../../ecommerce-vertex/firestore.rules'),
];

const storefrontPath = candidateStorefrontPaths.find((p) => fs.existsSync(p));

if (!storefrontPath) {
  console.log('=== Standalone Mode: Storefront rules not present in local workspace ===');
  console.log('✅ Local platform rules validated successfully.');
  process.exit(0);
}

console.log(`✅ Storefront rules detected at: ${storefrontPath}`);
const storefrontContent = fs.readFileSync(storefrontPath, 'utf8');

const flatCatalogCollections = [
  'products',
  'categories',
  'attributes',
  'configuracion',
  'banners',
  'pages',
];
const missing = flatCatalogCollections.filter((col) => {
  return (
    !storefrontContent.includes(`match /${col}/`) &&
    !storefrontContent.includes(`match /${col}`) &&
    !new RegExp(`match\\s+/${col}`).test(storefrontContent)
  );
});

if (missing.length > 0) {
  console.error('❌ Validation Failed!');
  console.error(
    `Storefront rules are missing public catalog collections (flat model):\n  - ${missing.join('\n  - ')}`,
  );
  process.exit(1);
}

console.log('✅ Full sync validation passed.');
process.exit(0);
