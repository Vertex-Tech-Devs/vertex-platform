import { spawn } from 'child_process';
import * as path from 'path';

const scriptPath = path.resolve(__dirname, '../vertex-platform/functions/src/scripts/seed-tenant-by-name.ts');

console.log(`[seed-technology-store] Executing seed via tsx on ${scriptPath}...`);

const child = spawn('npx', ['tsx', scriptPath], {
  stdio: 'inherit',
  env: { ...process.env },
  shell: true,
});

child.on('exit', (code) => {
  if (code === 0) {
    console.log('[seed-technology-store] ✅ Technology store seed completed successfully.');
    process.exit(0);
  } else {
    console.error(`[seed-technology-store] ❌ Process exited with code ${code}`);
    process.exit(code ?? 1);
  }
});
