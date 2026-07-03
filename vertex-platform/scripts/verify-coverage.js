const fs = require('fs');
const path = require('path');

const THRESHOLD = 85;

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

const METRICS = ['statements', 'branches', 'functions', 'lines'];

let failed = false;

paths.forEach(({ name, file }) => {
  console.log(`\n🔍 Checking coverage for: ${name}...`);
  if (!fs.existsSync(file)) {
    console.error(`❌ Coverage file not found: ${file}`);
    console.error(`   Please run tests with coverage first.`);
    failed = true;
    return;
  }

  try {
    const raw = fs.readFileSync(file, 'utf8');
    const data = JSON.parse(raw);
    const total = data.total;

    METRICS.forEach((metric) => {
      const pct = total?.[metric]?.pct;

      if (pct === undefined) {
        console.error(`❌ Could not read ${metric} percentage from ${file}`);
        failed = true;
        return;
      }

      const numPct = typeof pct === 'string' ? parseFloat(pct) : pct;
      const display = `${metric.charAt(0).toUpperCase() + metric.slice(1)}`;

      console.log(`   📊 ${display} Coverage: ${numPct}%`);

      if (typeof numPct === 'number' && !isNaN(numPct)) {
        if (numPct < THRESHOLD) {
          console.error(`   ❌ ${display} threshold not met: ${numPct}% < ${THRESHOLD}%`);
          failed = true;
        } else {
          console.log(`   ✅ ${display} is sufficient!`);
        }
      } else {
        console.error(`   ❌ Invalid value for ${metric}: ${pct}`);
        failed = true;
      }
    });
  } catch (error) {
    console.error(`❌ Error parsing coverage file: ${error.message}`);
    failed = true;
  }
});

console.log(''); // empty line

if (failed) {
  console.log('❌ Some coverage checks failed!');
  process.exit(1);
} else {
  console.log('🎉 All coverage checks passed!');
  process.exit(0);
}
