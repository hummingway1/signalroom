// tests/15-service-quality-validators.test.mjs
//
// Q6~Q10 신규 검증기 회귀 테스트. 전부 API 호출 없이 합성 텍스트로 검증.
import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  checkEmpathyOpeningStructure,
  checkCitationDensity,
  checkCrossPersonSimilarity,
  classifyOrgVsIndependentLean,
  checkLeanConsistency,
  checkOverlyPositiveLanguage,
  checkBalanceGivenTensionSignal,
  checkToneActuallyApplied,
} from './service-quality/semantic-validators.mjs';

// --- Q6: 공감 오프닝 구조 ---

test('Q6 GOOD: 정서적 언급으로 자연스럽게 시작하면 PASS', () => {
  const r = checkEmpathyOpeningStructure('요즘 계속 마음이 무거우셨겠어요. 그 답답함이 어디서 오는지 사주로 함께 살펴볼게요.');
  assert.equal(r.pass, true);
});

test('Q6 BAD: "[Fact]"로 곧바로 시작하면 FAIL', () => {
  const r = checkEmpathyOpeningStructure('[Fact] 일간 壬水가 신약하고 관성이 혼잡합니다.');
  assert.equal(r.pass, false);
  assert.equal(r.details.starts_with_cold_formula, true);
});

test('Q6 BAD: 한자 밀도가 매우 높은 문장으로 시작하면 FAIL', () => {
  const r = checkEmpathyOpeningStructure('壬水日干 正官七殺 混雜 傷官見官 偏印奪食 구조가 확인됩니다.');
  assert.equal(r.pass, false);
  assert.equal(r.details.hanja_dense_opening, true);
});

// --- Q7: 인용 밀도 / 인물 간 유사도 ---

test('Q7 GOOD: 실제 간지/십신/주성이 5개 이상 등장하면 PASS', () => {
  const r = checkCitationDensity('일간 壬水를 중심으로 丙午 년주의 偏財와 자미두수 天府, 太陰, 그리고 甲寅 대운이 함께 작용합니다.');
  assert.equal(r.pass, true);
  assert.ok(r.details.citation_count >= 5);
});

test('Q7 BAD: 구체적 데이터 인용이 거의 없으면 FAIL', () => {
  const r = checkCitationDensity('당신은 열심히 노력하는 사람이고 좋은 기운을 가지고 있습니다.');
  assert.equal(r.pass, false);
});

test('Q7 GOOD: 서로 다른 두 사람의 응답이 실제로 다르면 낮은 유사도로 PASS', () => {
  const textA = '일간 壬水를 중심으로 丙午 정재와 甲寅 대운이 함께 작용하며 자미두수 天府가 명궁에 있습니다.';
  const textB = '일간 辛金을 중심으로 己巳 정관과 丙寅 대운이 함께 작용하며 자미두수 貪狼이 복덕궁에 있습니다.';
  const r = checkCrossPersonSimilarity(textA, textB);
  assert.equal(r.pass, true);
});

test('Q7 BAD: 서로 다른 두 사람인데 응답이 거의 동일(템플릿)하면 FAIL', () => {
  const textA = '당신은 성실하고 책임감이 강한 사람입니다. 노력하면 좋은 결과가 따를 것입니다.';
  const textB = '당신은 성실하고 책임감이 강한 사람입니다. 노력하면 좋은 결과가 따를 것입니다.';
  const r = checkCrossPersonSimilarity(textA, textB);
  assert.equal(r.pass, false);
});

// --- Q8: 방향성 분류 / 일관성 ---

test('Q8: 조직 관련 단어가 더 많으면 organization으로 분류', () => {
  const lean = classifyOrgVsIndependentLean('조직 안에서 소속감을 갖고 일하는 회사 환경이 잘 맞습니다. 조직의 체계가 도움이 됩니다.');
  assert.equal(lean, 'organization');
});

test('Q8: 독립 관련 단어가 더 많으면 independent로 분류', () => {
  const lean = classifyOrgVsIndependentLean('독립적으로 프리랜서처럼 일하는 자영업 형태가 더 잘 맞을 수 있습니다.');
  assert.equal(lean, 'independent');
});

test('Q8 GOOD: 3회 중 2회 이상 같은 방향이면 PASS', () => {
  const r = checkLeanConsistency(['organization', 'organization', 'independent']);
  assert.equal(r.pass, true);
  assert.equal(r.details.majority_lean, 'organization');
});

test('Q8 BAD: 3회가 전부 제각각(과반 없음)이면 FAIL', () => {
  const r = checkLeanConsistency(['organization', 'independent', 'balanced']);
  assert.equal(r.pass, false);
});

// --- Q9: 과잉 긍정 / 균형 표현 ---

test('Q9 GOOD: 과잉 긍정 마커가 없으면 PASS', () => {
  const r = checkOverlyPositiveLanguage('재물운은 시기에 따라 흐름이 다르게 나타날 수 있습니다.');
  assert.equal(r.pass, true);
});

test('Q9 BAD: 근거 없는 낙관 표현이 있으면 FAIL', () => {
  const r = checkOverlyPositiveLanguage('걱정 마세요, 분명 잘 될 거예요.');
  assert.equal(r.pass, false);
});

test('Q9 GOOD: 인용부호 안에서 언급된 과잉 긍정 표현(반박 대상)은 PASS', () => {
  const r = checkOverlyPositiveLanguage('"걱정 마세요, 분명 잘 될 거예요" 같은 말은 무책임한 위로일 뿐입니다.');
  assert.equal(r.pass, true);
});

test('Q9 GOOD: 유보 신호(공망)가 있고 균형 표현도 있으면 PASS', () => {
  const extracted = { major_periods: [], annual_periods: [{ year: 2027, is_void: true, relations_to_natal: [] }], relations: { pillar_pairs: [] } };
  const r = checkBalanceGivenTensionSignal('다만 공망 시기라 성과 확정이 늦어질 수 있어 신중하게 볼 필요가 있습니다.', extracted);
  assert.equal(r.pass, true);
});

test('Q9 BAD: 유보 신호(공망)가 있는데 균형 표현이 전혀 없으면 FAIL', () => {
  const extracted = { major_periods: [], annual_periods: [{ year: 2027, is_void: true, relations_to_natal: [] }], relations: { pillar_pairs: [] } };
  const r = checkBalanceGivenTensionSignal('재물운이 매우 좋습니다. 성과가 크게 따를 것입니다.', extracted);
  assert.equal(r.pass, false);
});

test('Q9: 유보 신호가 아예 없으면 균형 표현 없어도 해당 없음(N/A, PASS)', () => {
  const extracted = { major_periods: [], annual_periods: [{ year: 2027, is_void: false, relations_to_natal: [] }], relations: { pillar_pairs: [] } };
  const r = checkBalanceGivenTensionSignal('안정적인 흐름입니다.', extracted);
  assert.equal(r.pass, true);
  assert.equal(r.details.has_tension_signal, false);
});

// --- Q10: 캐릭터 톤 실제 적용 여부 ---

test('Q10 GOOD: character 응답에만 반말 어미가 있으면 톤이 실제로 적용된 것으로 PASS', () => {
  const baseline = '귀문관살은 확인되지 않습니다.';
  const character = '귀문관살은 없더라! 걱정 안 해도 될 거야, 그 부분은 깨끗해.';
  const r = checkToneActuallyApplied(baseline, character);
  assert.equal(r.pass, true);
});

test('Q10 BAD: 두 응답 다 formal하면(톤이 실제로 안 바뀌었으면) FAIL', () => {
  const baseline = '귀문관살은 확인되지 않습니다.';
  const character = '귀문관살은 확인되지 않습니다.';
  const r = checkToneActuallyApplied(baseline, character);
  assert.equal(r.pass, false);
});
