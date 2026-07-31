import * as fs from 'fs';
import * as path from 'path';

// 1. Validar reglas locales del plano de control (Platform)
const platformRulesPath = path.resolve(__dirname, '../firestore.rules');
if (!fs.existsSync(platformRulesPath)) {
  console.error('❌ Error: Local platform firestore.rules not found!');
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

// 2. Buscar archivo de reglas del Storefront en rutas candidatas
const candidateStorefrontPaths = [
  path.resolve(__dirname, '../../storefront/firestore.rules'),
  path.resolve(__dirname, '../../ecommerce-vertex/firestore.rules'),
  path.resolve(__dirname, '../../../storefront/firestore.rules'),
  path.resolve(__dirname, '../../../ecommerce-vertex/firestore.rules'),
];

const storefrontPath = candidateStorefrontPaths.find((p) => fs.existsSync(p));

// 3. MODO STANDALONE (CI / Runner Aislado)
if (!storefrontPath) {
  console.log('=== Standalone Mode: Storefront rules not present in runner ===');
  console.log('✅ Validating local platform firestore.rules security boundaries...');

  // Las colecciones del plano de control están protegidas por el catch-all por defecto
  // `match /{document=**} { allow read, write: if isPlatformAdmin(); }`, que cubre
  // cualquier ruta sin matcher explícito. Verificamos que ese catch-all exista y exija
  // isPlatformAdmin(), y que ninguna colección del plano de control tenga un matcher
  // explícito que conceda acceso público (if true).
  const hasAdminOnlyCatchAll =
    platformRulesContent.includes('match /{document=**}') &&
    platformRulesContent.includes('isPlatformAdmin');

  if (!hasAdminOnlyCatchAll) {
    console.error('❌ Missing admin-only catch-all (match /{document=**} + isPlatformAdmin)');
    process.exit(1);
  }

  const requiredPrivateCollections = [
    'stores',
    'infrastructure_shards',
    'provisioning_queue',
    'users',
  ];
  for (const collection of requiredPrivateCollections) {
    const block = blockFor(platformRulesContent, collection);
    if (block.includes('if true')) {
      console.error(`❌ Public matcher found for control-plane collection: ${collection}`);
      process.exit(1);
    }
  }

  console.log('✅ Local platform rules validated successfully.');
  process.exit(0); // FINALIZAR LIMPIAMENTE SIN FALLBACKS
}

// 4. MODO FULL SYNC (Solo si el archivo storefront SÍ existe en disco)
const storefrontContent = fs.readFileSync(storefrontPath, 'utf8');

// Validar modelo plano directamente sobre el contenido real del storefront
const requiredFlatCollections = [
  'products',
  'categories',
  'attributes',
  'configuracion',
  'banners',
  'pages',
];
const missing: string[] = [];

for (const col of requiredFlatCollections) {
  if (!storefrontContent.includes(`match /${col}/`)) {
    missing.push(col);
  }
}

if (missing.length > 0) {
  console.error(`❌ Storefront rules missing matchers for: ${missing.join(', ')}`);
  process.exit(1);
}

console.log('✅ Full sync validation passed.');
process.exit(0);
