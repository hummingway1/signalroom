// scripts/validate-canonical.mjs
// Usage: node scripts/validate-canonical.mjs [path/to/canonical.json]
import { readFile } from 'node:fs/promises';
import { validateCanonicalChart } from '../packages/canonical/validate.mjs';

const filePath = process.argv[2] ?? './data/canonical-chart-example.json';
const canonical = JSON.parse(await readFile(filePath, 'utf-8'));
const { valid, errors } = await validateCanonicalChart(canonical);

if (valid) {
  console.log(`✅ ${filePath} is valid against schemas/canonical-chart-schema.json`);
  process.exit(0);
} else {
  console.error(`❌ ${filePath} is INVALID:`);
  console.error(JSON.stringify(errors, null, 2));
  process.exit(1);
}
