// tests/09-real-ai-harness.test.mjs
//
// Regression tests for the real-AI evaluation harness (scripts/analyze-real.mjs
// + tests/real-ai/validators.mjs + tests/real-ai/questions.mjs). These run
// with plain synthetic data / MockAIProvider — no API key or network needed
// — so `npm test` always covers the harness even when nobody has run a real
// evaluation yet.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile, rm } from 'node:fs/promises';

import { validateRealAIResult } from './real-ai/validators.mjs';
import { SINGLE_TURN_QUESTIONS, CONVERSATION_TEST } from './real-ai/questions.mjs';
import { runFullEvaluation } from '../scripts/real-ai-runner-core.mjs';
import { MockAIProvider } from '../packages/ai/providers/mock-provider.mjs';

let canonical;
test.before(async () => {
  canonical = JSON.parse(await readFile('./data/canonical-chart-example.json', 'utf-8'));
});

test('question set has exactly 10 single-turn questions matching the spec §3 wording', () => {
  assert.equal(SINGLE_TURN_QUESTIONS.length, 10);
  assert.equal(SINGLE_TURN_QUESTIONS[0].question, '내 성격의 핵심 구조를 사주로 설명해줘.');
  assert.equal(SINGLE_TURN_QUESTIONS[9].question, '두 체계를 종합했을 때 내가 장기적으로 가장 중요하게 관리해야 할 것은 무엇인가?');
});

test('conversation test has exactly 3 turns matching spec §5 wording', () => {
  assert.equal(CONVERSATION_TEST.turns.length, 3);
  assert.equal(CONVERSATION_TEST.turns[0], '내 직업 성향을 사주와 자미두수로 비교해줘.');
});

test('validators: a well-formed analysis result passes all checks', () => {
  const canonicalMinimal = { subject: {}, saju: { day_master: { heavenly_stem: '壬' }, pillars: [] }, ziwei: { palaces: [] } };
  const extracted = { subject: {}, saju: { day_master: { heavenly_stem: '壬' } }, ziwei: {} };
  const analysisData = {
    saju: { relevant_structure: 'x', interpretation: '일간이 강한 편입니다.' },
    ziwei: { relevant_structure: 'x', interpretation: 'y' },
    cross_analysis: { common_direction: 'a', differences: 'b', overall_judgment: 'c', real_world_checks: 'd' },
    response: '요청하신 성격에 대해 설명드릴게요.',
    sources: { saju: ['day_master'], ziwei: [] },
    highlight_card: null,
  };
  const result = validateRealAIResult({ analysisData, routing: { saju_fields: ['day_master'], ziwei_fields: [] }, extracted, canonical: canonicalMinimal, expectedScope: 'saju_only' });
  assert.equal(result.overall_pass, true);
});

test('validators: forbidden certainty phrase ("반드시") is caught', () => {
  const canonicalMinimal = { subject: {}, saju: {}, ziwei: {} };
  const analysisData = {
    saju: { relevant_structure: 'x', interpretation: 'x' },
    ziwei: { relevant_structure: 'x', interpretation: 'x' },
    cross_analysis: { common_direction: 'a', differences: 'b', overall_judgment: '이 사람은 반드시 성공합니다.', real_world_checks: 'd' },
    response: '반드시 성공할 것입니다.',
    sources: { saju: [], ziwei: [] },
  };
  const result = validateRealAIResult({ analysisData, routing: { saju_fields: [], ziwei_fields: [] }, extracted: {}, canonical: canonicalMinimal, expectedScope: 'unconstrained' });
  assert.equal(result.checks.forbidden_certainty_phrases.pass, false);
  assert.ok(result.checks.forbidden_certainty_phrases.details.flagged.some((f) => f.phrase === '반드시'));
  assert.equal(result.overall_pass, false);
});

test('validators: mentioning a ziwei star not present in extracted data is flagged (hallucination heuristic)', () => {
  const canonicalMinimal = { subject: {}, saju: {}, ziwei: { palaces: [] } };
  const extracted = { subject: {}, saju: {}, ziwei: { palaces: [{ position: 'life', stars: [{ name: '天機' }] }] } };
  const analysisData = {
    saju: { relevant_structure: 'x', interpretation: 'x' },
    ziwei: { relevant_structure: 'x', interpretation: '명궁에 紫微가 있어 리더십이 강합니다.' }, // 紫微 not in extracted data
    cross_analysis: { common_direction: 'a', differences: 'b', overall_judgment: 'c', real_world_checks: 'd' },
    response: 'x',
    sources: { saju: [], ziwei: [] },
  };
  const result = validateRealAIResult({ analysisData, routing: { saju_fields: [], ziwei_fields: ['palaces'] }, extracted, canonical: canonicalMinimal, expectedScope: 'ziwei_only' });
  assert.equal(result.checks.missing_data_hallucination.pass, false);
  assert.ok(result.checks.missing_data_hallucination.details.mentionedButAbsentStars.includes('紫微'));
});

test('validators: JSON schema violation (missing required field) is caught', () => {
  const canonicalMinimal = { subject: {}, saju: {}, ziwei: {} };
  const analysisData = { saju: { relevant_structure: 'x' } }; // missing everything else
  const result = validateRealAIResult({ analysisData, routing: { saju_fields: [], ziwei_fields: [] }, extracted: {}, canonical: canonicalMinimal, expectedScope: 'unconstrained' });
  assert.equal(result.checks.json_schema_valid.pass, false);
  assert.equal(result.overall_pass, false);
});

test('full harness end-to-end with MockAIProvider produces 11 result files, all schema-valid', async (t) => {
  const outputDir = './tests/real-ai/_test_harness_tmp';
  t.after(() => rm(outputDir, { recursive: true, force: true }));

  const provider = new MockAIProvider();
  const { stats, allResults } = await runFullEvaluation({ provider, canonical, model: 'mock', outputDir, isRealRun: false });

  assert.equal(allResults.length, 11); // 10 single-turn + 1 conversation
  assert.ok(stats.saju_only);
  assert.ok(stats.ziwei_only);
  assert.ok(stats.cross);
  assert.ok(stats.conversation);

  for (const file of ['01-saju-personality', '05-ziwei-money', '10-cross-long-term']) {
    const content = JSON.parse(await readFile(`${outputDir}/${file}.json`, 'utf-8'));
    assert.equal(content.mock_mode, true);
    assert.equal(content.validation.checks.json_schema_valid.pass, true);
  }

  const conversationContent = JSON.parse(await readFile(`${outputDir}/11-conversation-career.json`, 'utf-8'));
  assert.equal(conversationContent.turns.length, 3);
});
