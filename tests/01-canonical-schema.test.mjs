// tests/01-canonical-schema.test.mjs
// Spec §16 test #1: Canonical JSON schema validation
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { validateCanonicalChart } from '../packages/canonical/validate.mjs';

test('valid canonical chart JSON passes schema validation', async () => {
  const canonical = JSON.parse(await readFile('./data/canonical-chart-example.json', 'utf-8'));
  const { valid, errors } = await validateCanonicalChart(canonical);
  assert.equal(valid, true, `expected valid, got errors: ${JSON.stringify(errors)}`);
});

test('canonical chart without natal still validates (natal is optional for this product)', async () => {
  const canonical = JSON.parse(await readFile('./data/canonical-chart-example.json', 'utf-8'));
  delete canonical.natal;
  const { valid, errors } = await validateCanonicalChart(canonical);
  assert.equal(valid, true, `expected valid without natal, got errors: ${JSON.stringify(errors)}`);
});

test('canonical chart missing required saju field fails validation', async () => {
  const canonical = JSON.parse(await readFile('./data/canonical-chart-example.json', 'utf-8'));
  delete canonical.saju;
  const { valid, errors } = await validateCanonicalChart(canonical);
  assert.equal(valid, false);
  assert.ok(errors.length > 0);
});

test('canonical chart with wrong type for a field fails validation', async () => {
  const canonical = JSON.parse(await readFile('./data/canonical-chart-example.json', 'utf-8'));
  canonical.saju.pillars = 'not an array';
  const { valid } = await validateCanonicalChart(canonical);
  assert.equal(valid, false);
});
