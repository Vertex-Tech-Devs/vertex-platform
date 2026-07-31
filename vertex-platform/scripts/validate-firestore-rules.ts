import * as fs from 'fs';
import * as path from 'path';

const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  red: '\x1b[31m',
  cyan: '\x1b[36m',
};

function extractBlock(content: string, startPattern: string): string {
  const index = content.indexOf(startPattern);
  if (index === -1) return '';

  const braceIndex = content.indexOf('{', index + startPattern.length);
  if (braceIndex === -1) return '';

  let depth = 1;
  let pos = braceIndex + 1;
  while (depth > 0 && pos < content.length) {
    const char = content[pos];
    if (char === '{') {
      depth++;
    } else if (char === '}') {
      depth--;
    }
    pos++;
  }
  return content.substring(braceIndex + 1, pos - 1);
}

// Extracts top-level match paths (at depth 0) as { collectionName -> blockContent }
function getTopLevelMatches(blockContent: string): Map<string, string> {
  const matches = new Map<string, string>();
  let depth = 0;
  let i = 0;

  while (i < blockContent.length) {
    if (depth === 0) {
      const remaining = blockContent.substring(i);
      const matchStart = remaining.match(/^match\s+\/([a-zA-Z0-9_-]+)\/(\{[^}]*\})/);
      if (matchStart) {
        const collectionName = matchStart[1];
        const block = extractBlock(blockContent, `match /${collectionName}/{`);
        if (block) {
          matches.set(collectionName, block);
        }
        i += matchStart[0].length;
        continue;
      }
    }

    const char = blockContent[i];
    if (char === '{') {
      depth++;
    } else if (char === '}') {
      depth--;
    }
    i++;
  }

  return matches;
}

function main() {
  const storefrontRulesPath = path.resolve(__dirname, '../../../storefront/firestore.rules');
  const platformRulesPath = path.resolve(__dirname, '../firestore.rules');

  console.log(`${colors.bright}${colors.cyan}=== Firestore Rules Sync Validator ===${colors.reset}`);

  if (!fs.existsSync(storefrontRulesPath)) {
    console.error(
      `${colors.red}Error: Storefront firestore.rules not found at ${storefrontRulesPath}${colors.reset}`,
    );
    process.exit(1);
  }

  if (!fs.existsSync(platformRulesPath)) {
    console.error(
      `${colors.red}Error: Platform firestore.rules not found at ${platformRulesPath}${colors.reset}`,
    );
    process.exit(1);
  }

  const storefrontContent = fs.readFileSync(storefrontRulesPath, 'utf8');
  const platformContent = fs.readFileSync(platformRulesPath, 'utf8');

  // Strip comments to avoid false match results inside comments
  const stripComments = (str: string) => str.replace(/\/\/.*|\/\*[\s\S]*?\*\//g, '');
  const cleanStorefrontContent = stripComments(storefrontContent);
  const cleanPlatformContent = stripComments(platformContent);

  // ── 1. Storefront: flat public catalog collections with `allow read: if true` ──
  const storefrontDocumentsBlock =
    extractBlock(cleanStorefrontContent, 'match /databases/{database}/documents') ||
    cleanStorefrontContent;
  const storefrontBlocks = getTopLevelMatches(storefrontDocumentsBlock);

  const publicCatalogCollections = [
    'products',
    'categories',
    'attributes',
    'configuracion',
    'banners',
    'pages',
  ];

  console.log(
    `Storefront Public Catalog Collections: ${Array.from(storefrontBlocks.keys()).join(', ') || '(none)'}`,
  );

  const missingCatalog: string[] = [];
  const notPublic: string[] = [];
  for (const col of publicCatalogCollections) {
    const block = storefrontBlocks.get(col);
    if (!block) {
      missingCatalog.push(col);
    } else if (!block.includes('allow read: if true')) {
      notPublic.push(col);
    }
  }

  if (missingCatalog.length > 0) {
    console.error(`\n❌ ${colors.red}${colors.bright}Validation Failed!${colors.reset}`);
    console.error(
      `${colors.yellow}Storefront rules are missing public catalog collections (flat model):${colors.reset}`,
    );
    missingCatalog.forEach((col) => console.error(`  - ${col}`));
    console.error(
      `\nPlease ensure 'storefront/firestore.rules' defines root-level matchers for these collections.`,
    );
    process.exit(1);
  }

  if (notPublic.length > 0) {
    console.error(`\n❌ ${colors.red}${colors.bright}Validation Failed!${colors.reset}`);
    console.error(
      `${colors.yellow}Storefront catalog collections must allow public reads (allow read: if true):${colors.reset}`,
    );
    notPublic.forEach((col) => console.error(`  - ${col}`));
    process.exit(1);
  }

  // ── 2. Platform: control-plane collections must stay private (no public read) ──
  const controlPlaneCollections = [
    'stores',
    'infrastructure_shards',
    'provisioning_queue',
    'provisioning_logs',
    'users',
    'admin_roles',
  ];

  const platformDocumentsBlock =
    extractBlock(cleanPlatformContent, 'match /databases/{database}/documents') ||
    cleanPlatformContent;
  const platformBlocks = getTopLevelMatches(platformDocumentsBlock);

  const exposedControl: string[] = [];
  for (const col of controlPlaneCollections) {
    const block = platformBlocks.get(col);
    if (block && block.includes('if true')) {
      exposedControl.push(col);
    }
  }

  // The catch-all must NOT grant public access
  const catchAllBlock = extractBlock(cleanPlatformContent, 'match /{document=**}');
  const catchAllPublic =
    catchAllBlock.includes('if true') || !catchAllBlock.includes('isPlatformAdmin');

  if (exposedControl.length > 0 || catchAllPublic) {
    console.error(`\n❌ ${colors.red}${colors.bright}Validation Failed!${colors.reset}`);
    console.error(
      `${colors.yellow}Platform control-plane collections must not be publicly readable:${colors.reset}`,
    );
    exposedControl.forEach((col) => console.error(`  - ${col}`));
    if (catchAllPublic) {
      console.error('  - Catch-all match /{document=**} must require isPlatformAdmin()');
    }
    console.error(
      `\nPlease keep 'platform/vertex-platform/firestore.rules' control-plane collections private.`,
    );
    process.exit(1);
  }

  console.log(
    `\n🎉 ${colors.green}${colors.bright}Validation Passed! Storefront public catalog is exposed and platform control-plane stays private.${colors.reset}`,
  );
  process.exit(0);
}

main();
