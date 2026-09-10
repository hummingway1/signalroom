// tests/65-analysis-recommendation-and-time-known.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { computeChart } from '../packages/chart-engine/compute.mjs';
import { buildCanonicalChart } from '../packages/canonical/transform.mjs';

const { getAnalysisRecommendation } = await import('../apps/web/src/analysisRecommendation.js');

test('1. saju + 출생시간 정확히 알음 → 자미두수 추천, 사용자 선택 필요', () => {
  const r = getAnalysisRecommendation({ requestedServiceId: 'saju', timeKnown: true });
  assert.deepEqual(r, { requestedService: 'saju', recommendedService: 'jami', recommendationReason: 'birth_time_known', requiresUserChoice: true });
});

test('2. saju + 출생시간 모름 → 추천 없이 그대로 사주 진행', () => {
  const r = getAnalysisRecommendation({ requestedServiceId: 'saju', timeKnown: false });
  assert.deepEqual(r, { requestedService: 'saju', recommendedService: 'saju', recommendationReason: null, requiresUserChoice: false });
});

test('3. jami 직접 선택 + 시간 알음 → 추천 없이 즉시 자미두수', () => {
  const r = getAnalysisRecommendation({ requestedServiceId: 'jami', timeKnown: true });
  assert.deepEqual(r, { requestedService: 'jami', recommendedService: 'jami', recommendationReason: null, requiresUserChoice: false });
});

test('4. jami 직접 선택 + 시간 모름 → 그대로 자미두수', () => {
  const r = getAnalysisRecommendation({ requestedServiceId: 'jami', timeKnown: false });
  assert.deepEqual(r, { requestedService: 'jami', recommendedService: 'jami', recommendationReason: null, requiresUserChoice: false });
});

test('5. requiresUserChoice가 true인 유일한 경로는 saju+timeKnown뿐', () => {
  const cases = [
    { requestedServiceId: 'saju', timeKnown: true },
    { requestedServiceId: 'saju', timeKnown: false },
    { requestedServiceId: 'jami', timeKnown: true },
    { requestedServiceId: 'jami', timeKnown: false },
  ];
  const trueCount = cases.filter((c) => getAnalysisRecommendation(c).requiresUserChoice).length;
  assert.equal(trueCount, 1);
});

test('6. timeKnown=true → canonical.subject.time_known=true', () => {
  const raw = computeChart({ birthDate: '1990-05-15', birthTime: '12:00', timeKnown: true, gender: 'male', city: 'Seoul' });
  const canonical = buildCanonicalChart(raw, { engineVersion: '0.4.2' });
  assert.equal(canonical.subject.time_known, true);
});

test('7. timeKnown=false → canonical.subject.time_known=false(실제 버그였던 부분)', () => {
  const raw = computeChart({ birthDate: '1990-05-15', birthTime: '12:00', timeKnown: false, gender: 'male', city: 'Seoul' });
  const canonical = buildCanonicalChart(raw, { engineVersion: '0.4.2' });
  assert.equal(canonical.subject.time_known, false);
});

test('8. timeKnown 미전달(하위호환) → true로 처리', () => {
  const raw = computeChart({ birthDate: '1990-05-15', birthTime: '12:00', gender: 'male', city: 'Seoul' });
  const canonical = buildCanonicalChart(raw, { engineVersion: '0.4.2' });
  assert.equal(canonical.subject.time_known, true);
});

test('9. POST /api/charts 라우트가 timeKnown을 받아 createChart로 전달한다', async () => {
  const source = await readFile('./apps/api/src/routes/charts.mjs', 'utf-8');
  assert.ok(source.includes('const { birthDate, birthTime, timeKnown, gender, city, timezone, userId }'));
  assert.ok(source.includes('timeKnown === false ? false : true'));
});
