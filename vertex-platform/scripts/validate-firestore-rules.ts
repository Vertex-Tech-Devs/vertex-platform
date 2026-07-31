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

// Flat-model public catalog contract. These collections are publicly readable in the
// storefront project's rules (sibling repo). In the platform control-plane rules they
// must stay private — public exposure lives in the storefront Firestore, not the platform's.
const PUBLIC_CATALOG_COLLECTIONS = [
  'products',
  'categories',
  'attributes',
  'configuracion',
  'banners',
  'pages',
];

// Control-plane collections that must NEVER be publicly readable in the platform rules.
const CONTROL_PLANE_COLLECTIONS = [
  'stores',
  'infrastructure_shards',
  'provisioning_queue',
  'provisioning_logs',
  'users',
  'admin_roles',
];

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

function fail(message: string): never {
  console.error(`\n❌ ${colors.red}${colors.bright}Validation Failed!${colors.reset}`);
  console.error(`${colors.yellow}${message}${colors.reset}`);
  process.exit(1);
}

function main() {
  const platformRulesPath = path.resolve(__dirname, '../firestore.rules');
  const storefrontRulesPath = path.resolve(__dirname, '../../../storefront/firestore.rules');
  const forceStandalone =
    process.argv.includes('--standalone') || process.env['STANDALONE'] === '1';

  console.log(`${colors.bright}${colors.cyan}=== Firestore Rules Sync Validator ===${colors.reset}`);

  // The platform rules are this repo's own file and are always required.
  if (!fs.existsSync(platformRulesPath)) {
    fail(`Platform firestore.rules not found at ${platformRulesPath}`);
  }

  const stripComments = (str: string) => str.replace(/\/\/.*|\/\*[\s\S]*?\*\//g, '');
  const platformContent = fs.readFileSync(platformRulesPath, 'utf8');
  const cleanPlatformContent = stripComments(platformContent);

  const platformDocumentsBlock =
    extractBlock(cleanPlatformContent, 'match /databases/{database}/documents') ||
    cleanPlatformContent;
  const platformBlocks = getTopLevelMatches(platformDocumentsBlock);

  // ── Always: platform control-plane collections must stay private (no public read) ──
  const exposedControl = CONTROL_PLANE_COLLECTIONS.filter((col) => {
    const block = platformBlocks.get(col);
    return block !== undefined && block.includes('if true');
  });

  // The catch-all must NOT grant public access
  const catchAllBlock = extractBlock(cleanPlatformContent, 'match /{document=**}');
  const catchAllPublic =
    catchAllBlock.includes('if true') || !catchAllBlock.includes('isPlatformAdmin');

  if (exposedControl.length > 0 || catchAllPublic) {
    const details = exposedControl.map((col) => `  - ${col}`).join('\n');
    fail(
      `Platform control-plane collections must not be publicly readable:\n${details}\n` +
        (catchAllPublic
          ? '  - Catch-all match /{document=**} must require isPlatformAdmin()\n'
          : '') +
        `Please keep 'vertex-platform/firestore.rules' control-plane collections private.`,
    );
  }

  const storefrontExists = fs.existsSync(storefrontRulesPath);

  // ── Mode A: standalone (CI / isolated repo — no sibling storefront checkout) ──
  // Validate the local platform rules and verify the flat public-catalog contract
  // directly: the catalog collections must NOT be publicly exposed in the platform
  // control-plane rules (public exposure belongs to the storefront project).
  if (forceStandalone || !storefrontExists) {
    console.log(
      `${colors.yellow}${
        storefrontExists
          ? 'Standalone mode forced via --standalone. '
          : 'Standalone mode: storefront rules not present in this checkout. '
      }Verifying flat catalog contract against platform rules.${colors.reset}`,
    );

    const exposedCatalog = PUBLIC_CATALOG_COLLECTIONS.filter((col) => {
      const block = platformBlocks.get(col);
      return block !== undefined && block.includes('allow read: if true');
    });

    if (exposedCatalog.length > 0) {
      fail(
        `Catalog collections must not be publicly readable in platform control-plane rules (flat contract):\n` +
          exposedCatalog.map((col) => `  - ${col}`).join('\n') +
          `\nPublic reads for '${PUBLIC_CATALOG_COLLECTIONS.join("', '")}' belong to the storefront project's firestore.rules.`,
      );
    }

    console.log(
      `Flat catalog contract verified: ${PUBLIC_CATALOG_COLLECTIONS.join(', ')} (not exposed in platform rules).`,
    );
    console.log(
      `\n🎉 ${colors.green}${colors.bright}Validation Passed! Standalone platform rules are safe and control-plane stays private.${colors.reset}`,
    );
    process.exit(0);
  }

  // ── Mode B: full sync (sibling storefront checkout present) ──
  const storefrontContent = fs.readFileSync(storefrontRulesPath, 'utf8');
  const cleanStorefrontContent = stripComments(storefrontContent);

  const storefrontDocumentsBlock =
    extractBlock(cleanStorefrontContent, 'match /databases/{database}/documents') ||
    cleanStorefrontContent;
  const storefrontBlocks = getTopLevelMatches(storefrontDocumentsBlock);

  console.log(
    `Storefront Public Catalog Collections: ${Array.from(storefrontBlocks.keys()).join(', ') || '(none)'}`,
  );

  const missingCatalog = PUBLIC_CATALOG_COLLECTIONS.filter((col) => !storefrontBlocks.has(col));
  const notPublic = PUBLIC_CATALOG_COLLECTIONS.filter((col) => {
    const block = storefrontBlocks.get(col);
    return block !== undefined && !block.includes('allow read: if true');
  });

  if (missingCatalog.length > 0) {
    fail(
      `Storefront rules are missing public catalog collections (flat model):\n` +
        missingCatalog.map((col) => `  - ${col}`).join('\n') +
        `\nPlease ensure 'storefront/firestore.rules' defines root-level matchers for these collections.`,
    );
  }

  if (notPublic.length > 0) {
    fail(
      `Storefront catalog collections must allow public reads (allow read: if true):\n` +
        notPublic.map((col) => `  - ${col}`).join('\n'),
    );
  }

  console.log(
    `\n🎉 ${colors.green}${colors.bright}Validation Passed! Storefront public catalog is exposed and platform control-plane stays private.${colors.reset}`,
  );
  process.exit(0);
}

main();
