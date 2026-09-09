// tests/04-missing-invalid-data.test.mjs
// Spec §16 test #9: missing data
// Spec §16 test #10: invalid chart
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { extractRelevantData } from '../packages/canonical/extract.mjs';
import { validateCanonicalChart } from '../packages/canonical/validate.mjs';
import { computeChart, ChartEngineError } from '../packages/chart-engine/compute.mjs';

test('#9 missing data: extraction from a canonical chart with an empty saju object does not crash', () => {
  const sparseCanonical = { subject: {}, saju: {}, ziwei: { palaces: [] } };
  const router = { saju_fields: ['day_master', 'pillars'], ziwei_fields: ['palaces'], ziwei_palace_focus: [] };
  const extracted = extractRelevantData(sparseCanonical, router);
  // Fields simply aren't present in the output — no fabricated placeholder values.
  assert.deepEqual(extracted.saju, {});
  assert.deepEqual(extracted.ziwei.palaces, []);
});

test('#9 missing data: chart with missing subject.birth_place still extracts fine (no crash)', async () => {
  const canonical = JSON.parse(await readFile('./data/canonical-chart-example.json', 'utf-8'));
  delete canonical.subject.birth_place;
  const router = { saju_fields: ['day_master'], ziwei_fields: [], ziwei_palace_focus: [] };
  assert.doesNotThrow(() => extractRelevantData(canonical, router));
});

test('#10 invalid chart: malformed canonical JSON (wrong types) fails schema validation with details', async () => {
  const canonical = { schema_version: '1.0.0', generated_at: 'not-a-date', source: {}, subject: {}, saju: { pillars: 'wrong-type' }, ziwei: {} };
  const { valid, errors } = await validateCanonicalChart(canonical);
  assert.equal(valid, false);
  assert.ok(Array.isArray(errors) && errors.length > 0);
});

test('#10 invalid chart: unsupported timezone in chart-engine input throws a typed ChartEngineError, not a silent miscalculation', () => {
  assert.throws(
    () => computeChart({ birthDate: '2026-08-06', birthTime: '10:59', gender: 'male', city: 'New York', timezone: 'America/New_York' }),
    (err) => err instanceof ChartEngineError && err.code === 'UNSUPPORTED_TIMEZONE'
  );
});

test('#10 invalid chart: empty canonical object fails validation rather than being silently accepted', async () => {
  const { valid } = await validateCanonicalChart({});
  assert.equal(valid, false);
});
