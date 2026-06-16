import * as fs from 'node:fs';
import * as path from 'node:path';

function run() {
  const rootDir = process.cwd();
  
  // 1. Read firebase.json
  const firebaseJsonPath = path.join(rootDir, 'firebase.json');
  let functionsInfo = '';
  if (fs.existsSync(firebaseJsonPath)) {
    const firebaseJson = JSON.parse(fs.readFileSync(firebaseJsonPath, 'utf8'));
    const functions = firebaseJson.functions;
    if (Array.isArray(functions)) {
      for (const fn of functions) {
        functionsInfo += `- Codebase: \`${fn.codebase}\` (Source: \`${fn.source}\`)\n`;
      }
    } else if (functions) {
      functionsInfo += `- Codebase: \`${functions.codebase || 'default'}\` (Source: \`${functions.source || 'functions'}\`)\n`;
    }
  }

  // 2. Read Schemas from packages/shared-contracts/src
  const schemasDir = path.join(rootDir, 'packages/shared-contracts/src');
  const schemas: string[] = [];
  if (fs.existsSync(schemasDir)) {
    const files = fs.readdirSync(schemasDir);
    for (const file of files) {
      if (file.endsWith('.schema.ts')) {
        const content = fs.readFileSync(path.join(schemasDir, file), 'utf8');
        const matches = content.match(/export const (\w+Schema)/g);
        if (matches) {
          for (const match of matches) {
            const name = match.replace('export const ', '');
            schemas.push(name);
          }
        }
      }
    }
  }

  // 3. Generate Markdown Content
  const markdownContent = `# Vertex Context

## Active Database Schemas
${schemas.map((s) => `- \`${s}\``).join('\n')}

## Cloud Functions Endpoints
${functionsInfo || 'No active functions found.'}
`;

  // 4. Write to docs/architecture-context.md
  const docsDir = path.join(rootDir, 'docs');
  if (!fs.existsSync(docsDir)) {
    fs.mkdirSync(docsDir, { recursive: true });
  }
  fs.writeFileSync(path.join(docsDir, 'architecture-context.md'), markdownContent, 'utf8');
  console.log('Successfully generated docs/architecture-context.md');
}

run();
