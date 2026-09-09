// tests/02-data-extraction.test.mjs
// Spec §16 test #2: Saju data extraction
// Spec §16 test #3: Ziwei data extraction
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { extractRelevantData, estimateExtractionSavings } from '../packages/canonical/extract.mjs';

let canonical;
test.before(async () => {
  canonical = JSON.parse(await readFile('./data/canonical-chart-example.json', 'utf-8'));
});

test('saju extraction returns only requested fields', () => {
  const router = { saju_fields: ['day_master', 'pillars'], ziwei_fields: [], ziwei_palace_focus: [] };
  const extracted = extractRelevantData(canonical, router);
  assert.deepEqual(Object.keys(extracted.saju).sort(), ['day_master', 'pillars']);
  assert.deepEqual(extracted.ziwei, {});
});

test('saju extraction preserves actual field values (not just keys)', () => {
  const router = { saju_fields: ['day_master'], ziwei_fields: [], ziwei_palace_focus: [] };
  const extracted = extractRelevantData(canonical, router);
  assert.deepEqual(extracted.saju.day_master, canonical.saju.day_master);
});

test('ziwei extraction returns only requested fields', () => {
  const router = { saju_fields: [], ziwei_fields: ['life_palace', 'transformations'], ziwei_palace_focus: [] };
  const extracted = extractRelevantData(canonical, router);
  assert.deepEqual(Object.keys(extracted.ziwei).sort(), ['life_palace', 'transformations']);
  assert.deepEqual(extracted.saju, {});
});

test('ziwei palace_focus auto-expands to include 삼방사정 (opposite + trine palaces) — ziwei-original.md requires this, never just the requested palace alone', () => {
  const router = { saju_fields: [], ziwei_fields: ['palaces'], ziwei_palace_focus: ['career', 'wealth'] };
  const extracted = extractRelevantData(canonical, router);
  // career's 三合 group = [life, wealth, career], opposite(대궁) = spouse.
  // wealth's 三合 group = [life, wealth, career] (same group), opposite = fortune.
  // Union: life, wealth, career, spouse, fortune = 5 palaces, not just the 2 requested.
  assert.deepEqual(extracted.ziwei.palaces.map((p) => p.position).sort(), ['career', 'fortune', 'life', 'spouse', 'wealth']);
});

test('ziwei palaces without palace_focus returns all 12 palaces', () => {
  const router = { saju_fields: [], ziwei_fields: ['palaces'], ziwei_palace_focus: [] };
  const extracted = extractRelevantData(canonical, router);
  assert.equal(extracted.ziwei.palaces.length, 12);
});

test('extraction reduces payload size (the actual cost-saving mechanism)', () => {
  const router = { saju_fields: ['day_master'], ziwei_fields: ['life_palace'], ziwei_palace_focus: [] };
  const extracted = extractRelevantData(canonical, router);
  const savings = estimateExtractionSavings(canonical, extracted);
  assert.ok(savings.reduction_ratio > 0.5, `expected >50% reduction, got ${savings.reduction_ratio}`);
});

test('extraction ignores unknown/invalid field names silently (no crash)', () => {
  const router = { saju_fields: ['not_a_real_field'], ziwei_fields: [], ziwei_palace_focus: [] };
  const extracted = extractRelevantData(canonical, router);
  assert.deepEqual(extracted.saju, {});
});
