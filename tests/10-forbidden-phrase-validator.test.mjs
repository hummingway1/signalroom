// tests/10-forbidden-phrase-validator.test.mjs
//
// Regression suite for the negation-aware forbidden_certainty_phrases check
// in tests/real-ai/validators.mjs. Added after the 2026-08-17 real-AI run
// produced 10 false-positive FAILs — every single one was the model
// correctly HEDGING ("무조건 X라는 뜻은 아닙니다") rather than asserting
// certainty, which a naive substring match couldn't distinguish.
//
// This file pins both:
//   (a) the exact real sentences that were wrongly flagged that day, and
//   (b) the explicit PASS/FAIL sentence pairs specified in the follow-up
//       task, so neither case can silently regress again.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { validateRealAIResult } from './real-ai/validators.mjs';

const CANONICAL_MINIMAL = { subject: {}, saju: {}, ziwei: {} };

function checkPhrase(text) {
  const analysisData = {
    saju: { relevant_structure: 'x', interpretation: 'x' },
    ziwei: { relevant_structure: 'x', interpretation: 'x' },
    cross_analysis: { common_direction: 'a', differences: 'b', overall_judgment: text, real_world_checks: 'd' },
    response: 'x',
    sources: { saju: [], ziwei: [] },
  };
  return validateRealAIResult({
    analysisData,
    routing: { saju_fields: [], ziwei_fields: [] },
    extracted: {},
    canonical: CANONICAL_MINIMAL,
    expectedScope: 'unconstrained',
  }).checks.forbidden_certainty_phrases;
}

// --- (a) exact real sentences from the 2026-08-17 run — must PASS ---

test('real false-positive #1 (07-cross-career): "무조건 X라는 단정할 수는 없다" hedge passes', () => {
  const result = checkPhrase('그렇다고 무조건 독립·사업형이라고 단정할 수는 없어요.');
  assert.equal(result.pass, true);
});

test('real false-positive #2 (11 turn1): "반드시 X라는 뜻은 아닙니다" (formal 아닙니다, not 아니다) hedge passes', () => {
  const result = checkPhrase('다만 반드시 관리직이나 사업가가 된다는 뜻은 아닙니다.');
  assert.equal(result.pass, true);
});

test('real false-positive #3 (11 turn2): quoted-then-denied claim passes', () => {
  const result = checkPhrase('아니요. "직장보다 사업이 무조건 더 맞다"는 뜻은 아니에요.');
  assert.equal(result.pass, true);
});

test('real false-positive #4 (11 turn2): "무조건" used in an unrelated behavioral question (not a fate claim) passes', () => {
  const result = checkPhrase('규칙을 무조건 거부하는지 아니면 개선하려 하는지');
  assert.equal(result.pass, true);
});

test('real false-positive #5 (11 turn3): "그렇다고 무조건 X해야 한다는 뜻은 아니다" hedge passes', () => {
  const result = checkPhrase('그렇다고 무조건 혼자 해야 한다는 뜻은 아니다.');
  assert.equal(result.pass, true);
});

test('real false-positive #6 (11 turn2): "A라기보다는 B" contrastive hedge (no direct negation morpheme) passes', () => {
  const result = checkPhrase("두 체계 모두 '직장보다 무조건 사업'이라기보다, 자율성·주도권·성과 책임이 있는 방식이 더 중요하다는 방향을 가리킨다.");
  assert.equal(result.pass, true);
});

test('real false-positive #7 (09-cross-work-business, main_quality 실행): 인용부호로 감싼 거짓 이분법 제시 후 거부 — 여는 인용부호가 금지어 바로 앞', () => {
  const result = checkPhrase("두 체계 모두 '평생 회사원' 또는 '무조건 창업가'라는 양자택일보다는 조직에서 실력을 축적하는 형태를 가리킵니다.");
  assert.equal(result.pass, true);
});

test('real false-positive #8 (11 turn2, main_quality 실행): 인용구 중간에 금지어가 위치 — 여는 인용부호가 금지어 훨씬 앞에 있음', () => {
  const result = checkPhrase("역할 분담이 잘 되어 있어 '조직생활이 안 맞고 무조건 사업해야 하는 구조'로 보기는 어렵다.");
  assert.equal(result.pass, true);
});

// --- (b) explicit spec sentence pairs (follow-up task) ---

test('spec PASS #1: "무조건 ~라는 뜻은 아닙니다."', () => {
  assert.equal(checkPhrase('무조건 사업가가 된다는 뜻은 아닙니다.').pass, true);
});

test('spec PASS #2: "반드시 ~하는 것은 아닙니다."', () => {
  assert.equal(checkPhrase('반드시 관리직을 하는 것은 아닙니다.').pass, true);
});

test('spec PASS #3: "100% 그렇게 나타난다고 볼 수 없습니다."', () => {
  assert.equal(checkPhrase('100% 그렇게 나타난다고 볼 수 없습니다.').pass, true);
});

test('spec FAIL #1: "무조건 성공합니다." (genuine assertion)', () => {
  const result = checkPhrase('무조건 성공합니다.');
  assert.equal(result.pass, false);
  assert.equal(result.details.flagged[0].phrase, '무조건');
});

test('spec FAIL #2: "반드시 사업가가 됩니다." (genuine assertion)', () => {
  const result = checkPhrase('반드시 사업가가 됩니다.');
  assert.equal(result.pass, false);
});

test('spec FAIL #3: "100% 이혼합니다." (genuine assertion)', () => {
  const result = checkPhrase('100% 이혼합니다.');
  assert.equal(result.pass, false);
});

test('"운명적으로" genuine fate-assertion still fails', () => {
  const result = checkPhrase('운명적으로 이 사람과 결혼하게 됩니다.');
  assert.equal(result.pass, false);
});

// --- boundary/robustness cases ---

test('negation in a LATER sentence (past a period) does not rescue an earlier assertion', () => {
  const result = checkPhrase('반드시 사업가가 됩니다. 그렇지 않으면 이상합니다.');
  assert.equal(result.pass, false);
  assert.equal(result.details.flagged[0].phrase, '반드시');
});

test('two genuine assertions in one sentence are both flagged', () => {
  const result = checkPhrase('이 사람은 반드시 부자가 되고, 100% 결혼도 하게 됩니다.');
  assert.equal(result.pass, false);
  assert.deepEqual(result.details.flagged.map((f) => f.phrase).sort(), ['100%', '반드시']);
});

test('raw_match_count and hedged_and_excluded are reported for transparency', () => {
  const result = checkPhrase('무조건 사업가가 된다는 뜻은 아닙니다.');
  assert.equal(result.details.raw_match_count, 1);
  assert.equal(result.details.hedged_and_excluded, 1);
  assert.equal(result.details.flagged.length, 0);
});
