"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const colors = {
    reset: '\x1b[0m',
    bright: '\x1b[1m',
    green: '\x1b[32m',
    yellow: '\x1b[33m',
    red: '\x1b[31m',
    cyan: '\x1b[36m',
};
function extractBlock(content, startPattern) {
    const index = content.indexOf(startPattern);
    if (index === -1)
        return '';
    const braceIndex = content.indexOf('{', index + startPattern.length);
    if (braceIndex === -1)
        return '';
    let depth = 1;
    let pos = braceIndex + 1;
    while (depth > 0 && pos < content.length) {
        const char = content[pos];
        if (char === '{') {
            depth++;
        }
        else if (char === '}') {
            depth--;
        }
        pos++;
    }
    return content.substring(braceIndex + 1, pos - 1);
}
// Extracts top-level match paths (at depth 0 relative to the block's inside content)
function getTopLevelSubcollections(blockContent) {
    const subcollections = new Set();
    let depth = 0;
    let i = 0;
    while (i < blockContent.length) {
        // Check if we are at depth 0 and see a "match" keyword
        if (depth === 0) {
            const remaining = blockContent.substring(i);
            const matchStart = remaining.match(/^match\s+\/([a-zA-Z0-9_-]+)\//);
            if (matchStart) {
                subcollections.add(matchStart[1]);
                i += matchStart[0].length;
                continue;
            }
        }
        const char = blockContent[i];
        if (char === '{') {
            depth++;
        }
        else if (char === '}') {
            depth--;
        }
        i++;
    }
    return subcollections;
}
function main() {
    const storefrontRulesPath = path.resolve(__dirname, '../../../storefront/firestore.rules');
    const platformRulesPath = path.resolve(__dirname, '../firestore.rules');
    console.log(`${colors.bright}${colors.cyan}=== Firestore Rules Sync Validator ===${colors.reset}`);
    if (!fs.existsSync(storefrontRulesPath)) {
        console.error(`${colors.red}Error: Storefront firestore.rules not found at ${storefrontRulesPath}${colors.reset}`);
        process.exit(1);
    }
    if (!fs.existsSync(platformRulesPath)) {
        console.error(`${colors.red}Error: Platform firestore.rules not found at ${platformRulesPath}${colors.reset}`);
        process.exit(1);
    }
    const storefrontContent = fs.readFileSync(storefrontRulesPath, 'utf8');
    const platformContent = fs.readFileSync(platformRulesPath, 'utf8');
    // Strip comments to avoid false match results inside comments
    const stripComments = (str) => str.replace(/\/\/.*|\/\*[\s\S]*?\*\//g, '');
    const cleanStorefrontContent = stripComments(storefrontContent);
    const cleanPlatformContent = stripComments(platformContent);
    const storefrontTenantBlock = extractBlock(cleanStorefrontContent, 'match /tenants/{tenantId}');
    const platformTenantBlock = extractBlock(cleanPlatformContent, 'match /tenants/{tenantId}');
    if (!storefrontTenantBlock) {
        console.error(`${colors.red}Error: 'match /tenants/{tenantId}' block not found in Storefront rules.${colors.reset}`);
        process.exit(1);
    }
    if (!platformTenantBlock) {
        console.error(`${colors.red}Error: 'match /tenants/{tenantId}' block not found in Platform rules.${colors.reset}`);
        process.exit(1);
    }
    const storefrontCols = getTopLevelSubcollections(storefrontTenantBlock);
    const platformCols = getTopLevelSubcollections(platformTenantBlock);
    console.log(`Storefront Tenant Subcollections: ${Array.from(storefrontCols).join(', ')}`);
    console.log(`Platform Tenant Subcollections:   ${Array.from(platformCols).join(', ')}`);
    const missingInPlatform = [];
    for (const col of storefrontCols) {
        if (!platformCols.has(col)) {
            missingInPlatform.push(col);
        }
    }
    if (missingInPlatform.length > 0) {
        console.error(`\n❌ ${colors.red}${colors.bright}Validation Failed!${colors.reset}`);
        console.error(`${colors.yellow}The following tenant subcollections are defined in Storefront rules but missing in Platform rules:${colors.reset}`);
        missingInPlatform.forEach((col) => {
            console.error(`  - ${col}`);
        });
        console.error(`\nPlease ensure that 'platform/vertex-platform/firestore.rules' defines a matcher for these collections under '/tenants/{tenantId}'.`);
        process.exit(1);
    }
    console.log(`\n🎉 ${colors.green}${colors.bright}Validation Passed! All storefront tenant subcollections are mapped in platform rules.${colors.reset}`);
    process.exit(0);
}
main();
