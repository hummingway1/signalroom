// tests/13-targeted-quality-validators.test.mjs
//
// Regression suite for tests/targeted-quality/semantic-validators.mjs.
// Every "expected" value below is derived at runtime from the real fixture
// (data/fixtures/adult-main-quality-chart.json, computed by the actual
// calculation engine) — nothing is hand-typed as a hardcoded answer key.
// Both GOOD (should PASS) and BAD (should FAIL) synthetic responses are
// tested per spec §7 ("반드시 실패 사례를 일부러 만들어 검증하라") — these
// never call the real API, they're pure validator-logic tests.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

import { deriveExpectedValues } from './targeted-quality/expected-values.mjs';
import {
  checkAnnualYearAccuracy,
  checkAnnualTenGodAndStageConsistency,
  checkGwimunPositionAccuracy,
  checkGwimunExistenceConsistency,
  checkDaewoonAnnualLink,
  checkNoUnnecessaryAnnualExtraction,
} from './targeted-quality/semantic-validators.mjs';

let expected;
test.before(async () => {
  const canonical = JSON.parse(await readFile('./data/fixtures/adult-main-quality-chart.json', 'utf-8'));
  expected = deriveExpectedValues(canonical, { targetYear: 2027 });
});

// --- checkAnnualYearAccuracy ---

test('TEST1 GOOD: 실제 2027년 간지(丁未)를 정확히 언급하면 PASS', () => {
  const r = checkAnnualYearAccuracy('2027년은 丁未년으로, 재성 계열 기운이 두드러집니다.', expected);
  assert.equal(r.pass, true);
  assert.equal(r.details.correct_ganzi_mentioned, true);
});

test('TEST1 BAD: 2027년을 다른(존재하지 않는) 간지로 설명하면 FAIL — 연도 혼동', () => {
  // 2028년의 실제 간지(戊申)를 2027년인 것처럼 서술 — 흔한 "연도 한 칸 밀림" 오류를 시뮬레이션.
  const r = checkAnnualYearAccuracy('2027년은 戊申년으로 변화가 큰 해입니다.', expected);
  assert.equal(r.pass, false);
  assert.equal(r.details.wrong_ganzi_nearby[0].ganzi, '戊申');
});

test('TEST1 GOOD: 간지를 직접 언급하지 않고 풀어서 설명해도(오답 간지만 없으면) PASS', () => {
  const r = checkAnnualYearAccuracy('2027년은 편관 기운이 두드러지는 흐름으로 보입니다.', expected);
  assert.equal(r.pass, true);
  assert.equal(r.details.correct_ganzi_mentioned, false); // 명시적 언급은 없었다는 것도 기록됨
});

test('실제 오탐 사례 (2026-08-17 실행): 세운을 설명하며 그 세운이 속한 현재 대운을 정당하게 함께 언급 = PASS', () => {
  const r = checkAnnualYearAccuracy(
    `2027년은 ${expected.targetAnnual.ganzi}년으로, 현재의 ${expected.currentMajorPeriod.ganzi} 대운 안에 있습니다. 세운에는 편관과 편인이 들어옵니다.`,
    expected
  );
  assert.equal(r.pass, true);
  assert.equal(r.details.correct_ganzi_mentioned, true);
});

test('연도 자체를 언급하지 않으면 FAIL — 질문에 답하지 않은 것', () => {
  const r = checkAnnualYearAccuracy('전반적으로 안정적인 흐름입니다.', expected);
  assert.equal(r.pass, false);
});

// --- checkAnnualTenGodAndStageConsistency ---

test('TEST1 GOOD: 2027년 근처에서 실제 십신(偏官/偏印)을 언급하면 PASS', () => {
  const r = checkAnnualTenGodAndStageConsistency('2027년은 편관과 편인의 기운이 함께 작용하는 해입니다.', expected);
  assert.equal(r.pass, true);
});

test('TEST1 BAD: 2027년 근처에서 실제와 다른 십신을 언급하면 FAIL', () => {
  const r = checkAnnualTenGodAndStageConsistency('2027년은 정재의 기운이 강하게 들어오는 해입니다.', expected);
  assert.equal(r.pass, false);
  assert.deepEqual(r.details.wrong_ten_gods, ['正財']);
});

test('TEST1 BAD: 2027년 근처에서 실제와 다른 12운성을 언급하면 FAIL', () => {
  const r = checkAnnualTenGodAndStageConsistency('2027년은 12운성으로 帝旺에 해당하는 왕성한 해입니다.', expected);
  assert.equal(r.pass, false);
  assert.deepEqual(r.details.wrong_stages, ['帝旺']);
});

test('실제 오탐 사례 (2026-08-17 실행): "사건"처럼 무관한 단어의 "사" 음절이 死(사)로 오인되지 않음 = PASS', () => {
  const r = checkAnnualTenGodAndStageConsistency(
    '2027년은 편관과 편인이 함께 강해지는 흐름이다. 이는 특정 사건의 예고가 아니라 작동 방식이다.',
    expected
  );
  assert.equal(r.pass, true);
  assert.deepEqual(r.details.mentioned_stages, []); // 한자만 인식하므로 "사건"의 "사"는 애초에 매칭 안 됨
});

// --- checkGwimunPositionAccuracy ---

test('TEST2 GOOD: 실제 위치(년주/월주)를 정확히 언급하면 PASS', () => {
  const r = checkGwimunPositionAccuracy('귀문관살은 년주와 월주 사이에서 확인됩니다.', expected);
  assert.equal(r.pass, true);
  assert.deepEqual(r.details.wrong_positions, []);
});

test('TEST2 BAD: 실제로는 없는 위치(일주)를 귀문관살 위치로 잘못 언급하면 FAIL', () => {
  const r = checkGwimunPositionAccuracy('귀문관살은 일주와 시주 사이에서 나타납니다.', expected);
  assert.equal(r.pass, false);
  assert.ok(r.details.wrong_positions.includes('day'));
});

test('귀문관살을 아예 언급하지 않으면 해당 없음(N/A, PASS)', () => {
  const r = checkGwimunPositionAccuracy('전반적으로 안정적인 성향입니다.', expected);
  assert.equal(r.pass, true);
});

test('실제 오탐 사례 (2026-08-17 실행, 부산 fixture): 귀문관살이 없는 명반에서 원국 4주 지지를 설명하며 "없다"고 답하면 PASS (구조적 결함이었던 부분)', () => {
  // 부산 fixture(1989-06-01)는 실제로 gwimun이 빈 배열 — expected.gwimun=[]인 상황을 시뮬레이션.
  const emptyGwimunExpected = { ...expected, gwimun: [] };
  const text = '결론부터 말하면, 계산된 귀문관살은 없습니다. 원국 지지: 년지 巳, 월지 巳, 일지 辰, 시지 酉. 이 가운데 완성되는 지지 쌍이 없습니다.';
  const r = checkGwimunPositionAccuracy(text, emptyGwimunExpected);
  assert.equal(r.pass, true);
});

// --- checkGwimunExistenceConsistency ---

test('TEST2 GOOD: 실제로 존재하는 귀문관살의 존재를 인정하면 PASS', () => {
  const r = checkGwimunExistenceConsistency('귀문관살이 있습니다.', expected);
  assert.equal(r.pass, true);
});

test('TEST2 BAD: 실제로 존재하는데(년-월) 없다고 부정하면 FAIL', () => {
  const r = checkGwimunExistenceConsistency('귀문관살은 없습니다. 다른 신살만 확인됩니다.', expected);
  assert.equal(r.pass, false);
});

test('실제 오탐 사례 (2026-08-17 실행, 부산 fixture): 귀문관살이 없다고 명확히 답한 뒤 "~수 있습니다"(가능성 표현)로 유파 차이를 고지해도 PASS', () => {
  const emptyGwimunExpected = { ...expected, gwimun: [] };
  const text = '결론부터 말하면, 계산된 귀문관살은 없습니다. 귀문관살은 유파에 따라 판정 범위가 달라질 수 있습니다. 이 기준에서는 명확히 없음입니다.';
  const r = checkGwimunExistenceConsistency(text, emptyGwimunExpected);
  assert.equal(r.pass, true);
  assert.equal(r.details.denies_existence, true);
});

// --- checkDaewoonAnnualLink ---

test('TEST3 GOOD: 현재 대운(己未)과 2027년 세운(丁未) 간지를 둘 다 정확히 언급하면 PASS', () => {
  const r = checkDaewoonAnnualLink('현재 己未 대운 안에서 2027년 丁未 세운이 겹쳐 흐릅니다.', expected);
  assert.equal(r.pass, true);
});

test('TEST3 BAD: 현재 대운을 실제와 다른 간지로 설명하면 FAIL (간지 불일치로 검출)', () => {
  const r = checkDaewoonAnnualLink('현재 戊午 대운 안에서 2027년 상황을 봅니다.', expected);
  assert.equal(r.pass, false);
  assert.equal(r.details.major_ganzi_mentioned, false);
});

test('TEST3 BAD: 실제로 존재하지 않는 대운-세운 간 합충 관계를 지어내면 FAIL', () => {
  // fixture 실측: relations_to_major_period가 완전히 비어 있음(己未-丁未 사이에 형충합회 없음).
  const r = checkDaewoonAnnualLink('己未 대운과 丁未 세운이 충 관계를 이루어 갈등이 커질 수 있습니다.', expected);
  assert.equal(r.pass, false);
  assert.ok(r.details.claimed_relation_without_basis);
});

test('실제 오탐 사례 (2026-08-17 실행): "결합합니다"처럼 무관한 동사의 "합"이 合(관계)로 오인되지 않음 = PASS', () => {
  const r = checkDaewoonAnnualLink(
    `현재는 35세부터 시작된 ${expected.currentMajorPeriod.ganzi} 대운입니다. 2027년은 ${expected.targetAnnual.ganzi}로, 편관에 편인이 다시 결합합니다.`,
    expected
  );
  assert.equal(r.pass, true);
  assert.equal(r.details.claimed_relation_without_basis, null);
});

// --- checkNoUnnecessaryAnnualExtraction ---

test('TEST4 GOOD: 성격 질문에서 annual_periods가 추출되지 않으면 PASS', () => {
  const r = checkNoUnnecessaryAnnualExtraction({ day_master: {}, pillars: [] }, '온화하고 분석적인 성향입니다.');
  assert.equal(r.pass, true);
});

test('TEST4 BAD: 성격 질문인데도 annual_periods가 추출되면 FAIL (라우팅 과다 선택)', () => {
  const r = checkNoUnnecessaryAnnualExtraction({ annual_periods: expected.targetAnnual ? [expected.targetAnnual] : [] }, '온화한 성향입니다.');
  assert.equal(r.pass, false);
});
