// tests/03-question-routing.test.mjs
// Spec §16 tests #4 (question routing), #5 (career), #6 (money), #7 (relationship), #8 (general)
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { runQuestionPipeline } from '../packages/ai/pipeline.mjs';
import { MockAIProvider } from '../packages/ai/providers/mock-provider.mjs';
import { QUESTION_CATEGORIES, SAJU_FIELDS, ZIWEI_FIELDS } from '../packages/shared/categories.mjs';

let canonical;
test.before(async () => {
  canonical = JSON.parse(await readFile('./data/canonical-chart-example.json', 'utf-8'));
});

test('#4 question routing: router output only uses real canonical field names', async () => {
  const provider = new MockAIProvider();
  const result = await runQuestionPipeline({ provider, canonical, question: '내 성격이 궁금해' });
  for (const cat of result.router.categories) assert.ok(QUESTION_CATEGORIES.includes(cat), `unknown category: ${cat}`);
  for (const f of result.router.saju_fields) assert.ok(SAJU_FIELDS.includes(f), `unknown saju field: ${f}`);
  for (const f of result.router.ziwei_fields) assert.ok(ZIWEI_FIELDS.includes(f), `unknown ziwei field: ${f}`);
});

test('#5 career question routes to CAREER-related categories and career/travel palaces', async () => {
  const provider = new MockAIProvider();
  const result = await runQuestionPipeline({ provider, canonical, question: '이직을 고민하고 있어. 지금 직장을 계속 다녀야 할까?' });
  assert.ok(result.router.categories.includes('CAREER'));
  assert.ok(result.router.ziwei_palace_focus.includes('career'));
  assert.equal(result.response.length > 0, true);
});

test('#6 money question routes to MONEY category and wealth-related palaces', async () => {
  const provider = new MockAIProvider();
  const result = await runQuestionPipeline({ provider, canonical, question: '나는 재테크에 소질이 있을까?' });
  assert.ok(result.router.categories.includes('MONEY'));
  assert.ok(result.router.ziwei_palace_focus.includes('wealth'));
});

test('#7 relationship question routes to RELATIONSHIP category and friends/siblings palaces', async () => {
  const provider = new MockAIProvider();
  const result = await runQuestionPipeline({ provider, canonical, question: '왜 나는 인간관계가 이렇게 피곤할까?' });
  assert.ok(result.router.categories.includes('RELATIONSHIP'));
  assert.ok(result.router.ziwei_palace_focus.includes('friends'));
});

test('#8 general/unrecognized question falls back to GENERAL category with a safe default field set', async () => {
  const provider = new MockAIProvider();
  const result = await runQuestionPipeline({ provider, canonical, question: '그냥 아무거나 얘기해줘' });
  assert.deepEqual(result.router.categories, ['GENERAL']);
  assert.ok(result.router.saju_fields.length > 0, 'GENERAL should still select a safe default, not an empty set');
});

test('multi-category question (business+career+money+decision) selects a superset of relevant fields', async () => {
  const provider = new MockAIProvider();
  const result = await runQuestionPipeline({ provider, canonical, question: '직장을 계속 다닐지 사업을 시작할지 고민돼' });
  assert.ok(result.router.categories.includes('BUSINESS'));
  assert.ok(result.router.categories.includes('CAREER'));
  assert.ok(result.router.categories.includes('MONEY'));
  assert.ok(result.router.categories.includes('DECISION'));
});
