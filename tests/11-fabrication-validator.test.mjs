// tests/11-fabrication-validator.test.mjs
//
// Regression suite for the 5 checks added per the follow-up task:
//   - no_annual_period_fabrication (세운)
//   - no_gwimun_fabrication (귀문관살)
//   - no_daewoon_fabrication (대운)
//   - current_daewoon_handling (나이가 대운 시작 전이면 특정하지 않아야 함)
//   - data_limitation_disclosure (데이터 부족 시 제한을 명시해야 함)
//
// Canonical JSON currently has NO annual_periods / special_stars.gwimun
// field at all (confirmed by engine investigation), so these checks treat
// ANY concrete claim tied to either concept as unsupported-by-data unless
// the model explicitly discloses the absence.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { validateRealAIResult } from './real-ai/validators.mjs';

function run(text, { extracted, canonical, routing = { saju_fields: ['major_periods'], ziwei_fields: [] }, expectedScope = 'saju_only' } = {}) {
  const analysisData = {
    saju: { relevant_structure: 'x', interpretation: text },
    ziwei: { relevant_structure: 'x', interpretation: 'x' },
    cross_analysis: { common_direction: 'a', differences: 'b', overall_judgment: 'c', real_world_checks: 'd' },
    response: 'x',
    sources: { saju: [], ziwei: [] },
  };
  return validateRealAIResult({
    analysisData,
    routing,
    extracted: extracted ?? { saju: {}, ziwei: {} },
    canonical: canonical ?? { subject: { birth_date: '2026-08-06' }, saju: {}, ziwei: {} },
    expectedScope,
  });
}

const WITH_DAEWOON = { saju: { major_periods: [{ ganzi: '丙申', start_age: 1 }, { ganzi: '丁酉', start_age: 11 }] }, ziwei: {} };

// --- 세운 fabrication ---

test('세운 + 구체적 간지 언급 = FAIL (데이터에 세운 필드 자체가 없음)', () => {
  const r = run('2027년 세운은 丁未년으로, 재물운이 강합니다.', { extracted: WITH_DAEWOON });
  assert.equal(r.checks.no_annual_period_fabrication.pass, false);
});

test('세운 + 데이터 부재 고지 = PASS', () => {
  const r = run('세운 데이터가 제공되지 않아 연도별 분석은 어렵습니다.', { extracted: WITH_DAEWOON });
  assert.equal(r.checks.no_annual_period_fabrication.pass, true);
});

test('세운을 아예 언급하지 않으면 PASS', () => {
  const r = run('대운 흐름을 중심으로 설명하겠습니다.', { extracted: WITH_DAEWOON });
  assert.equal(r.checks.no_annual_period_fabrication.pass, true);
});

test('세운 필드가 실제로 존재하고 실제 계산된 간지를 언급 = PASS (값 대조 성공)', () => {
  const extractedWithAnnual = { saju: { annual_periods: [{ year: 2027, ganzi: '丁未' }] }, ziwei: {} };
  const r = run('2027년 세운은 丁未년입니다.', { extracted: extractedWithAnnual });
  assert.equal(r.checks.no_annual_period_fabrication.pass, true);
  assert.equal(r.checks.no_annual_period_fabrication.details.has_annual_periods_field, true);
});

test('세운 필드가 존재하지만 실제 계산값과 다른 간지를 언급 = FAIL (값 대조 실패)', () => {
  const extractedWithAnnual = { saju: { annual_periods: [{ year: 2027, ganzi: '丁未' }] }, ziwei: {} };
  const r = run('2027년 세운은 甲子년입니다.', { extracted: extractedWithAnnual }); // 甲子는 실제 계산값이 아님
  assert.equal(r.checks.no_annual_period_fabrication.pass, false);
});

// --- 귀문관살 fabrication ---

test('귀문관살 존재를 단정 = FAIL', () => {
  const r = run('이 명식은 귀문관살에 해당합니다.', { extracted: WITH_DAEWOON });
  assert.equal(r.checks.no_gwimun_fabrication.pass, false);
});

test('귀문관살 데이터 부재를 명시 = PASS', () => {
  const r = run('귀문관살 정보는 제공된 데이터에 없어 분석할 수 없습니다.', { extracted: WITH_DAEWOON });
  assert.equal(r.checks.no_gwimun_fabrication.pass, true);
});

test('실제 오탐 사례 (2026-08-17 실행): "판정 범위가 달라질 수 있습니다"의 "있습니다"(가능성 표현)가 존재 단정으로 오인되지 않음 = PASS', () => {
  const extractedEmptyGwimun = { saju: { special_stars: { gwimun: [] } }, ziwei: {} };
  const r = run('계산된 귀문관살은 없습니다. 귀문관살은 유파에 따라 판정 범위가 달라질 수 있습니다.', { extracted: extractedEmptyGwimun });
  assert.equal(r.checks.no_gwimun_fabrication.pass, true);
});

test('gwimun 필드가 존재하고 실제로 매칭이 있음(양성) + 존재를 단정 = PASS', () => {
  const extractedWithGwimun = { saju: { special_stars: { gwimun: [{ positions: ['day', 'year'], detail: null }] } }, ziwei: {} };
  const r = run('이 명식은 귀문관살에 해당합니다.', { extracted: extractedWithGwimun });
  assert.equal(r.checks.no_gwimun_fabrication.pass, true);
  assert.equal(r.checks.no_gwimun_fabrication.details.actually_present, true);
});

test('gwimun 필드가 존재하지만 실제로는 빈 배열(음성)인데 존재를 단정 = FAIL', () => {
  const extractedWithEmptyGwimun = { saju: { special_stars: { gwimun: [] } }, ziwei: {} };
  const r = run('이 명식은 귀문관살에 해당합니다.', { extracted: extractedWithEmptyGwimun });
  assert.equal(r.checks.no_gwimun_fabrication.pass, false);
  assert.equal(r.checks.no_gwimun_fabrication.details.actually_present, false);
});

// --- 대운 fabrication ---

test('대운 + 추출 데이터에 없는 간지 = FAIL', () => {
  const r = run('현재 대운은 戊戌 대운으로 안정적입니다.', { extracted: WITH_DAEWOON, canonical: { subject: { birth_date: '2000-01-01' }, saju: {}, ziwei: {} } });
  assert.equal(r.checks.no_daewoon_fabrication.pass, false);
});

test('대운 + 실제 추출된 간지 = PASS (no_daewoon_fabrication 체크 자체는)', () => {
  const r = run('丁酉 대운의 흐름을 보면...', { extracted: WITH_DAEWOON, canonical: { subject: { birth_date: '2000-01-01' }, saju: {}, ziwei: {} } });
  assert.equal(r.checks.no_daewoon_fabrication.pass, true);
});

test('실제 오탐 사례 (2026-08-17 targeted-quality 실행): "대운" 언급 근처에 정당한 세운(annual_periods) 간지가 함께 나와도 PASS', () => {
  const extractedWithBoth = { saju: { major_periods: [{ ganzi: '己未', start_age: 35 }], annual_periods: [{ year: 2027, ganzi: '丁未' }] }, ziwei: {} };
  const r = run('2027년은 丁未년으로, 현재의 己未 대운 안에 있습니다.', { extracted: extractedWithBoth, canonical: { subject: { birth_date: '1988-11-22' }, saju: {}, ziwei: {} } });
  assert.equal(r.checks.no_daewoon_fabrication.pass, true);
});

// --- 현재 대운 특정 가능 여부 ---

test('나이가 첫 대운 이전(유아) + "현재 대운" 특정하지 않음 = PASS', () => {
  const r = run('아직 대운이 시작되지 않아 직업 환경을 논하기 어렵습니다.', {
    extracted: { saju: { major_periods: [{ ganzi: '丙申', start_age: 1 }] }, ziwei: {} },
    canonical: { subject: { birth_date: '2026-08-06' }, saju: {}, ziwei: {} }, // age 0 in 2026-08-17 test context
  });
  assert.equal(r.checks.current_daewoon_handling.pass, true);
});

test('나이가 첫 대운 이전(유아)인데 "현재 대운"을 특정 = FAIL', () => {
  const r = run('현재 대운은 丙申 대운으로 활발한 시기입니다.', {
    extracted: { saju: { major_periods: [{ ganzi: '丙申', start_age: 1 }] }, ziwei: {} },
    canonical: { subject: { birth_date: '2026-08-06' }, saju: {}, ziwei: {} },
  });
  assert.equal(r.checks.current_daewoon_handling.pass, false);
});

test('나이가 유효 대운 구간에 속하면 "현재 대운" 특정은 정상 (성인 명반)', () => {
  const r = run('현재 대운은 丁酉 대운입니다.', {
    extracted: WITH_DAEWOON,
    canonical: { subject: { birth_date: '2000-01-01' }, saju: {}, ziwei: {} }, // 26세, 두 번째 대운(11세~) 구간
  });
  assert.equal(r.checks.current_daewoon_handling.pass, true);
});

test('대운 데이터가 애초에 추출되지 않은 질문은 해당 없음(N/A, PASS)', () => {
  const r = run('성격이 온화한 편입니다.', { extracted: { saju: { day_master: {} }, ziwei: {} } });
  assert.equal(r.checks.current_daewoon_handling.pass, true);
  assert.match(r.checks.current_daewoon_handling.details.note, /N\/A/);
});

// --- 데이터 제한 고지 ---

test('데이터 제한 상황(유아, 현재 대운 특정 불가)에서 제한을 명시하면 PASS', () => {
  const r = run('아직 대운이 시작되지 않아 이 시점의 직업 성향을 특정하기는 어렵습니다.', {
    extracted: { saju: { major_periods: [{ ganzi: '丙申', start_age: 1 }] }, ziwei: {} },
    canonical: { subject: { birth_date: '2026-08-06' }, saju: {}, ziwei: {} },
  });
  assert.equal(r.checks.data_limitation_disclosure.pass, true);
});

test('데이터 제한 상황인데 아무 제한 언급 없이 단정적으로 서술하면 FAIL', () => {
  const r = run('이 사람은 활동적이고 사업 수완이 뛰어난 성향입니다.', {
    extracted: { saju: { major_periods: [{ ganzi: '丙申', start_age: 1 }] }, ziwei: {} },
    canonical: { subject: { birth_date: '2026-08-06' }, saju: {}, ziwei: {} },
  });
  assert.equal(r.checks.data_limitation_disclosure.pass, false);
});

test('데이터 제한 상황이 아니면(성인, 유효 대운 있음) 항상 N/A(PASS)', () => {
  const r = run('현재 대운은 丁酉 대운입니다.', {
    extracted: WITH_DAEWOON,
    canonical: { subject: { birth_date: '2000-01-01' }, saju: {}, ziwei: {} },
  });
  assert.equal(r.checks.data_limitation_disclosure.pass, true);
  assert.match(r.checks.data_limitation_disclosure.details.note, /N\/A/);
});
