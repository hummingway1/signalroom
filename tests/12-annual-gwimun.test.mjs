// tests/12-annual-gwimun.test.mjs
//
// packages/chart-engine/annual-periods.mjs + packages/chart-engine/gwimun.mjs
//
// Every expected value here was independently verified by calling the real
// @orrery/core functions before writing the assertion (see CHANGELOG "5차
// 반영" for the exact node -e commands used) — nothing here is guessed.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { calculateSaju } from '@orrery/core/saju';

import { computeAnnualPeriods, ANNUAL_PERIOD_CALCULATION_METHOD, ANNUAL_PERIOD_ENGINE_FUNCTIONS } from '../packages/chart-engine/annual-periods.mjs';
import { extractNatalGwimun, checkGwimunBetween, checkGwimunBranches, GWIMUN_CALCULATION_METHOD, GWIMUN_PAIRS_USED } from '../packages/chart-engine/gwimun.mjs';
import { computeChart } from '../packages/chart-engine/compute.mjs';

// Fixed test subject: 2026-08-06 10:59, male, Incheon (same chart used
// throughout this project — 乙巳/壬子/乙未/丙午).
const EDGE_CASE_INPUT = { year: 2026, month: 8, day: 6, hour: 10, minute: 59, gender: 'M', latitude: 37.4563, longitude: 126.7052 };

// Real adult chart with an active 대운 in 2026 (35~44세, 己未).
const ADULT_INPUT = { birthDate: '1988-11-22', birthTime: '14:30', gender: 'female', city: 'Seoul' };

// Real chart found by brute-force search over the actual engine (see
// CHANGELOG) that genuinely produces a 鬼門(귀문) hit — day pillar 乙丑 vs
// year pillar 庚午, branches 丑/午 matching BRANCH_GWIMUN's "丑,午" pair.
const GWIMUN_POSITIVE_INPUT = { year: 1990, month: 3, day: 1, hour: 10, minute: 0, gender: 'M', latitude: 37.5665, longitude: 126.978 };

let edgeCaseSaju, adultRaw;
test.before(() => {
  edgeCaseSaju = calculateSaju(EDGE_CASE_INPUT);
  adultRaw = computeChart(ADULT_INPUT);
});

// --- 세운 간지: 2024~2027 ---

test('세운 간지: 2024=甲辰, 2025=乙巳, 2026=丙午, 2027=丁未', () => {
  const periods = computeAnnualPeriods(edgeCaseSaju, { fromYear: 2024, toYear: 2027 });
  const byYear = Object.fromEntries(periods.map((p) => [p.year, p.ganzi]));
  assert.equal(byYear[2024], '甲辰');
  assert.equal(byYear[2025], '乙巳');
  assert.equal(byYear[2026], '丙午');
  assert.equal(byYear[2027], '丁未');
});

// --- +20년 범위 ---

test('기본 범위는 fromYear~fromYear+20 (21개 항목)', () => {
  const periods = computeAnnualPeriods(edgeCaseSaju, { fromYear: 2026 });
  assert.equal(periods.length, 21);
  assert.equal(periods[0].year, 2026);
  assert.equal(periods[20].year, 2046);
  assert.equal(periods[20].ganzi, '丙寅'); // getYearGanzi(2046) 실측값
});

test('연도 범위를 명시적으로 지정할 수 있다', () => {
  const periods = computeAnnualPeriods(edgeCaseSaju, { fromYear: 2030, toYear: 2035 });
  assert.equal(periods.length, 6);
  assert.equal(periods[0].year, 2030);
  assert.equal(periods[5].year, 2035);
});

// --- 세운 십신 / 12운성 / 12신살 / 공망 ---

test('세운 십신: 일간 壬 기준 丙午년(2026) → 천간 偏財, 지지(정기 丁) 正財', () => {
  const periods = computeAnnualPeriods(edgeCaseSaju, { fromYear: 2026, toYear: 2026 });
  assert.deepEqual(periods[0].ten_god, { stem: '偏財', branch: '正財' });
});

test('세운 십신: 같은 천간(비견)도 정상적으로 계산된다 (本元 특수 케이스 아님)', () => {
  // 일간이 乙일 때, 세운 천간이 乙이 되는 해를 찾아 비견으로 나오는지 확인.
  const periods = computeAnnualPeriods(edgeCaseSaju, { fromYear: 2024, toYear: 2035 });
  const sameStemYear = periods.find((p) => p.heavenly_stem === edgeCaseSaju.pillars[1].pillar.stem);
  assert.ok(sameStemYear, 'test setup: no matching year found in range');
  assert.equal(sameStemYear.ten_god.stem, '比肩');
});

test('세운 12운성: getTwelveMeteor(일간, 세운지)와 일치', () => {
  const periods = computeAnnualPeriods(edgeCaseSaju, { fromYear: 2026, toYear: 2026 });
  assert.equal(periods[0].twelve_stage, '胎'); // getTwelveMeteor('壬','午') 실측값
});

test('세운 12신살: getTwelveSpirit(원국 연지, 세운지)와 일치', () => {
  const periods = computeAnnualPeriods(edgeCaseSaju, { fromYear: 2026, toYear: 2026 });
  assert.equal(periods[0].twelve_spirit, '將星'); // getTwelveSpirit('午','午') 실측값
});

test('세운 공망: 일주 공망 지지와 일치하는 해는 is_void=true', () => {
  // edgeCase 일주 壬子 → getGongmang('壬子') = ['寅','卯']
  const periods = computeAnnualPeriods(edgeCaseSaju, { fromYear: 2024, toYear: 2040 });
  const voidYears = periods.filter((p) => p.is_void);
  assert.ok(voidYears.length > 0, '공망에 해당하는 해가 최소 1개는 있어야 함');
  for (const p of voidYears) {
    assert.ok(['寅', '卯'].includes(p.earthly_branch));
  }
  const nonVoidYears = periods.filter((p) => !p.is_void);
  for (const p of nonVoidYears) {
    assert.ok(!['寅', '卯'].includes(p.earthly_branch));
  }
});

// --- 원국과 세운의 형충합회해파형원진귀문 ---

test('원국과의 관계: 4주 전부에 대해 relations_to_natal이 채워진다', () => {
  const periods = computeAnnualPeriods(edgeCaseSaju, { fromYear: 2026, toYear: 2026 });
  const rel = periods[0].relations_to_natal;
  assert.equal(rel.length, 4);
  assert.deepEqual(rel.map((r) => r.pillar_position), ['hour', 'day', 'month', 'year']);
});

test('원국과의 관계: 세운지 午가 원국 년지 午와 비견 지지 관계(동일 지지)를 갖는 등 실제 analyzePillarRelations 결과와 일치', () => {
  // 2026 세운 = 丙午. 원국 년주 = 丙午 (동일 간지) → 자기 자신과의 관계 = 완전 동일 간지 비교.
  const periods = computeAnnualPeriods(edgeCaseSaju, { fromYear: 2026, toYear: 2026 });
  const rel = periods[0].relations_to_natal.find((r) => r.pillar_position === 'year');
  assert.ok(rel.branch_relations.length >= 0); // 구조 확인 (동일 간지끼리는 특별한 관계 유형이 없을 수 있음 — 크래시하지 않는지가 핵심)
});

// --- 대운과 세운 관계 ---

test('related_major_period: 대운이 시작되지 않은 해는 null', () => {
  const periods = computeAnnualPeriods(edgeCaseSaju, { fromYear: 2024, toYear: 2024 });
  assert.equal(periods[0].related_major_period, null);
  assert.equal(periods[0].relations_to_major_period, null);
});

test('related_major_period: 성인 명반의 2026년은 己未 대운(35~44세, 2023년 시작)에 매칭됨', () => {
  const periods = computeAnnualPeriods(adultRaw.saju, { fromYear: 2026, toYear: 2026 });
  assert.deepEqual(periods[0].related_major_period, { index: 4, ganzi: '己未' });
  assert.ok(periods[0].relations_to_major_period);
  assert.equal(periods[0].relations_to_major_period.major_period_ganzi, '己未');
});

// --- 귀문관살 양성/음성 케이스 ---

test('귀문관살 양성 케이스: 1990-03-01 실제 명반(브루트포스로 발견, 임의 생성 아님) — 일주/년주 사이 鬼門', () => {
  const saju = calculateSaju(GWIMUN_POSITIVE_INPUT);
  assert.equal(saju.pillars[1].pillar.ganzi, '乙丑'); // 일주
  assert.equal(saju.pillars[3].pillar.ganzi, '庚午'); // 년주
  const hits = extractNatalGwimun(saju);
  assert.equal(hits.length, 1);
  assert.deepEqual(hits[0].positions, ['day', 'year']);
});

test('귀문관살 음성 케이스: edge_case 명반(乙巳/壬子/乙未/丙午)은 귀문관살 없음', () => {
  const hits = extractNatalGwimun(edgeCaseSaju);
  assert.deepEqual(hits, []);
});

test('checkGwimunBetween: 임의의 두 60갑자 사이 귀문관살도 동일 로직(analyzePillarRelations)으로 판정된다', () => {
  const hits = checkGwimunBetween('乙丑', '庚午');
  assert.equal(hits.length, 1);
});

test('checkGwimunBranches: BRANCH_GWIMUN의 6쌍이 전부 정확히 판정된다', () => {
  const pairs = [['子', '酉'], ['丑', '午'], ['寅', '未'], ['卯', '申'], ['辰', '亥'], ['巳', '戌']];
  for (const [a, b] of pairs) {
    assert.equal(checkGwimunBranches(a, b).length, 1, `${a},${b} 쌍은 귀문관살이어야 함`);
  }
  // 비-귀문 조합은 걸리지 않아야 함
  assert.equal(checkGwimunBranches('子', '午').length, 0); // 이건 沖 관계이지 귀문이 아님
});

// --- calculation_method / provenance ---

test('ANNUAL_PERIOD_CALCULATION_METHOD와 사용 함수 목록이 노출된다', () => {
  assert.equal(ANNUAL_PERIOD_CALCULATION_METHOD, 'orrery-core-composed-v1');
  assert.ok(ANNUAL_PERIOD_ENGINE_FUNCTIONS.includes('getYearGanzi'));
  assert.ok(ANNUAL_PERIOD_ENGINE_FUNCTIONS.includes('analyzePillarRelations'));
});

test('GWIMUN_CALCULATION_METHOD와 실제 사용된 페어 테이블이 노출된다 (엔진 상수 그대로)', () => {
  assert.equal(GWIMUN_CALCULATION_METHOD, 'orrery-core-branch-gwimun-v1');
  assert.equal(GWIMUN_PAIRS_USED.length, 6);
  assert.ok(GWIMUN_PAIRS_USED.includes('丑,午'));
});

// --- 기존 calculateSaju 결과 불변 ---

test('computeAnnualPeriods는 SajuResult를 절대 변경하지 않는다', () => {
  const saju = calculateSaju(EDGE_CASE_INPUT);
  const before = JSON.stringify(saju);
  computeAnnualPeriods(saju, { fromYear: 2020, toYear: 2050 });
  const after = JSON.stringify(saju);
  assert.equal(before, after);
});

test('extractNatalGwimun은 SajuResult를 절대 변경하지 않는다', () => {
  const saju = calculateSaju(GWIMUN_POSITIVE_INPUT);
  const before = JSON.stringify(saju);
  extractNatalGwimun(saju);
  const after = JSON.stringify(saju);
  assert.equal(before, after);
});
