import { execSync } from 'child_process';

const args = process.argv.slice(2);
const isFull = args.includes('--full');

const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  red: '\x1b[31m',
  cyan: '\x1b[36m',
};

function logHeader(text: string) {
  console.log(`\n${colors.bright}${colors.cyan}=== ${text} ===${colors.reset}`);
}

function runStep(name: string, cmd: string, cwd?: string): { success: boolean; duration: number } {
  console.log(`\n⏳ Running: ${colors.bright}${name}${colors.reset}...`);
  const startTime = Date.now();
  try {
    execSync(cmd, { stdio: 'inherit', cwd });
    const duration = ((Date.now() - startTime) / 1000).toFixed(1);
    console.log(`✅ ${colors.green}${name} passed! (${duration}s)${colors.reset}`);
    return { success: true, duration: parseFloat(duration) };
  } catch (error) {
    const duration = ((Date.now() - startTime) / 1000).toFixed(1);
    console.log(`❌ ${colors.red}${name} failed! (${duration}s)${colors.reset}`);
    return { success: false, duration: parseFloat(duration) };
  }
}

async function main() {
  const startTime = Date.now();
  console.log(`${colors.bright}${colors.blue}🚀 Starting Vertex Platform Unified QA Pipeline${colors.reset}`);
  console.log(`Mode: ${isFull ? colors.yellow + 'FULL (Frontend + Backend)' : colors.green + 'QUICK (Frontend Only)'}${colors.reset}\n`);

  const results: Record<string, { success: boolean; duration: number }> = {};

  // 1. Prettier Format Check
  results['Code Formatting (Prettier)'] = runStep(
    'Code Formatting',
    'npx prettier --check "src/**/*.{ts,html,scss}" "functions/src/**/*.ts"'
  );

  // 2. ESLint
  results['Code Linting (ESLint)'] = runStep('Code Linting', 'npm run lint');

  // 3. TypeScript Typecheck
  results['Type Consistency (tsc)'] = runStep('Type Check', 'npm run typecheck');

  // 4. Frontend Unit Tests
  results['Frontend Unit Tests (Vitest)'] = runStep('Frontend Tests', 'npm run test');

  // 5. Backend Tests (only on --full)
  if (isFull) {
    results['Backend Unit Tests (Vitest)'] = runStep('Backend Tests', 'npm run test', 'functions');
  }

  // Console Summary
  const totalDuration = ((Date.now() - startTime) / 1000).toFixed(1);
  logHeader('QA PIPELINE SUMMARY');
  console.log(`Total time: ${totalDuration}s\n`);

  let allPassed = true;
  for (const [name, result] of Object.entries(results)) {
    const statusSymbol = result.success ? `${colors.green}✔ PASS` : `${colors.red}✘ FAIL`;
    console.log(`  ${statusSymbol}${colors.reset} | ${name.padEnd(35)} | ${result.duration}s`);
    if (!result.success) {
      allPassed = false;
    }
  }

  console.log('\n=======================================');
  if (allPassed) {
    console.log(`\n🎉 ${colors.bright}${colors.green}EXCELLENT! All checks passed. Ready for deployment!${colors.reset}\n`);
    process.exit(0);
  } else {
    console.log(`\n⚠️ ${colors.bright}${colors.red}QA Pipeline failed. Please resolve the issues shown above.${colors.reset}\n`);
    process.exit(1);
  }
}

main().catch((err) => {
  console.error('Fatal QA error:', err);
  process.exit(1);
});
