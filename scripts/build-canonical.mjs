// scripts/build-canonical.mjs
//
// Standalone CLI: birth input -> compute (Orrery) -> Canonical JSON file.
// This is the importable-module equivalent of the old canonical-transform.mjs
// CLI script (still preserved verbatim at packages/canonical/canonical-transform.mjs
// for reference), but uses packages/chart-engine/compute.mjs + 
// packages/canonical/transform.mjs directly instead of reading an
// intermediate raw JSON file from disk.
//
// Usage:
//   node scripts/build-canonical.mjs '{"birthDate":"2026-08-06","birthTime":"10:59","gender":"male","city":"Incheon"}'
//   node scripts/build-canonical.mjs   (uses a built-in example input)

import { writeFile, mkdir } from 'node:fs/promises';
import { computeChart } from '../packages/chart-engine/compute.mjs';
import { buildCanonicalChart } from '../packages/canonical/transform.mjs';
import { validateCanonicalChart } from '../packages/canonical/validate.mjs';

const EXAMPLE_INPUT = { birthDate: '2026-08-06', birthTime: '10:59', gender: 'male', city: 'Incheon', timezone: 'Asia/Seoul' };

const inputArg = process.argv[2];
const birthInput = inputArg ? JSON.parse(inputArg) : EXAMPLE_INPUT;

console.log('Input:', birthInput);

const raw = computeChart(birthInput);
const canonical = buildCanonicalChart(raw, { engineVersion: '0.4.2' });

const { valid, errors } = await validateCanonicalChart(canonical);
if (!valid) {
  console.error('❌ Generated canonical JSON failed schema validation:', JSON.stringify(errors, null, 2));
  process.exit(1);
}

await mkdir('./data', { recursive: true });
const outPath = './data/canonical-chart-example.json';
await writeFile(outPath, JSON.stringify(canonical, null, 2), 'utf-8');
console.log(`✅ Saved: ${outPath}`);
console.log(`   day_master: ${JSON.stringify(canonical.saju.day_master)}`);
console.log(`   life_palace: ${JSON.stringify(canonical.ziwei.life_palace)}`);
