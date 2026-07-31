import * as fs from 'fs';
import * as path from 'path';

console.log('=== Firestore Rules Sync Validator ===');

// 1. Validar reglas locales de la plataforma (Platform)
const platformRulesPath = path.resolve(__dirname, '../firestore.rules');
if (!fs.existsSync(platformRulesPath)) {
  console.error('❌ Critical: Local platform firestore.rules not found!');
  process.exit(1);
}
const platformRulesContent = fs.readFileSync(platformRulesPath, 'utf8');

// Extrae el contenido del bloque de un matcher explícito `match /{collection}/{...}` (si existe)
function blockFor(content: string, collection: string): string {
  const start = content.indexOf(`match /${collection}/{`);
  if (start === -1) return '';
  const braceIndex = content.indexOf('{', start);
  let depth = 1;
  let pos = braceIndex + 1;
  while (depth > 0 && pos < content.length) {
    if (content[pos] === '{') depth++;
    else if (content[pos] === '}') depth--;
    pos++;
  }
  return content.substring(braceIndex + 1, pos - 1);
}

// 2. Buscar reglas del Storefront en ubicaciones relativas
const candidateStorefrontPaths = [
  path.resolve(__dirname, '../../storefront/firestore.rules'),
  path.resolve(__dirname, '../../ecommerce-vertex/firestore.rules'),
  path.resolve(__dirname, '../../../storefront/firestore.rules'),
  path.resolve(__dirname, '../../../ecommerce-vertex/firestore.rules'),
];

// Permitir forzar modo standalone mediante variable de entorno para pruebas
const forceStandalone = process.env.FORCE_STANDALONE === 'true';
const storefrontPath = forceStandalone
  ? null
  : candidateStorefrontPaths.find((p) => fs.existsSync(p));

// 3. MODO STANDALONE (Runner Aislado de CI / Repositorio Único)
if (!storefrontPath) {
  console.log('=== Standalone Mode: Storefront rules not present in runner ===');
  console.log('✅ Validating local platform firestore.rules boundaries...');

  // Las colecciones del plano de control están protegidas por el catch-all por defecto
  // `match /{document=**} { allow read, write: if isPlatformAdmin(); }`, que cubre
  // cualquier ruta sin matcher explícito. Verificamos que ese catch-all exista y exija
  // isPlatformAdmin(), y que ninguna colección del plano de control tenga un matcher
  // explícito que conceda acceso público (if true).
  const hasAdminOnlyCatchAll =
    platformRulesContent.includes('match /{document=**}') &&
    platformRulesContent.includes('isPlatformAdmin');
  if (!hasAdminOnlyCatchAll) {
    console.error(
      '❌ Validation Failed: Missing admin-only catch-all (match /{document=**} + isPlatformAdmin)',
    );
    process.exit(1);
  }

  const controlPlaneCollections = [
    'stores',
    'infrastructure_shards',
    'provisioning_queue',
    'users',
  ];
  for (const col of controlPlaneCollections) {
    if (blockFor(platformRulesContent, col).includes('if true')) {
      console.error(`❌ Validation Failed: Public matcher found for platform collection '${col}'`);
      process.exit(1);
    }
  }

  console.log('✅ Standalone validation complete: Local platform rules are secure.');
  process.exit(0); // SALIDA LIMPIA
}

// 4. MODO FULL SYNC (Entorno Monorepo Local)
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
  const hasMatch =
    storefrontContent.includes(`match /${col}/`) ||
    storefrontContent.includes(`match /${col}`) ||
    new RegExp(`match\\s+/${col}`).test(storefrontContent);
  return !hasMatch;
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
