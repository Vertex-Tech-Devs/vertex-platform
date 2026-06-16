const fs = require('fs');
const path = require('path');

const paths = [
  {
    name: 'Frontend',
    file: path.join(__dirname, '../coverage/vertex-platform/coverage-summary.json'),
  },
  {
    name: 'Functions (Backend)',
    file: path.join(__dirname, '../functions/coverage/coverage-summary.json'),
  }
];

let failed = false;

paths.forEach(({ name, file }) => {
  console.log(`Checking coverage for: ${name}...`);
  if (!fs.existsSync(file)) {
    console.error(`❌ Coverage file not found: ${file}`);
    console.error(`   Please run tests with coverage first.`);
    failed = true;
    return;
  }

  try {
    const raw = fs.readFileSync(file, 'utf8');
    const data = JSON.parse(raw);
    const pct = data.total?.statements?.pct;

    if (pct === undefined) {
      console.error(`❌ Could not read statements percentage from ${file}`);
      failed = true;
      return;
    }

    console.log(`📊 Statements Coverage: ${pct}%`);

    if (typeof pct === 'number' && pct < 85) {
      console.error(`❌ Coverage threshold not met: ${pct}% < 85%`);
      failed = true;
    } else if (typeof pct === 'string' && pct !== 'Unknown' && parseFloat(pct) < 85) {
      console.error(`❌ Coverage threshold not met: ${pct}% < 85%`);
      failed = true;
    } else {
      console.log(`✅ Coverage is sufficient!`);
    }
  } catch (error) {
    console.error(`❌ Error parsing coverage file: ${error.message}`);
    failed = true;
  }
});

if (failed) {
  process.exit(1);
} else {
  console.log('🎉 All coverage checks passed!');
  process.exit(0);
}
