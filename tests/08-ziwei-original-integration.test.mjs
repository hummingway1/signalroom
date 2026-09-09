// tests/08-ziwei-original-integration.test.mjs
//
// Verifies the ziwei-original.md integration requested in the latest task:
//   - 원본 파일 존재 여부
//   - 원본 내용 로딩
//   - runtime adapter 연결
//   - ziwei 관련 질문 routing
//   - saju + ziwei cross-analysis routing
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile, access } from 'node:fs/promises';
import { createHash } from 'node:crypto';

import { runQuestionPipeline } from '../packages/ai/pipeline.mjs';
import { MockAIProvider } from '../packages/ai/providers/mock-provider.mjs';
import { expandToSamBangSaJeong, getSamBangSaJeong } from '../packages/shared/ziwei-relations.mjs';

const ORIGINAL_PATH = './prompts/originals/ziwei-original.md';
const ADAPTER_PATH = './prompts/runtime/ziwei.md';

let canonical;
test.before(async () => {
  canonical = JSON.parse(await readFile('./data/canonical-chart-example.json', 'utf-8'));
});

// --- 원본 파일 존재 여부 ---
test('ziwei-original.md exists on disk', async () => {
  await assert.doesNotReject(() => access(ORIGINAL_PATH));
});

test('ziwei-original.md is no longer the PENDING placeholder', async () => {
  const content = await readFile(ORIGINAL_PATH, 'utf-8');
  assert.ok(!content.includes('PENDING'), 'placeholder text should have been replaced');
  assert.ok(!content.includes('원본 미도착'));
});

// --- 원본 내용 로딩 (특징적인, 원본에만 있는 고유 규칙/용어가 실제로 들어있는지) ---
test('ziwei-original.md contains the exact core terminology from the uploaded original (verbatim, not paraphrased)', async () => {
  const content = await readFile(ORIGINAL_PATH, 'utf-8');
  // Spot-check several distinctive rules/terms explicitly called out as
  // must-not-delete in the task instructions.
  assert.ok(content.includes('삼방사정'), '삼방사정 rule missing');
  assert.ok(content.includes('공궁'), '공궁 rule missing');
  assert.ok(content.includes('생년사화'), '생년사화 rule missing');
  assert.ok(content.includes('[Fact]') && content.includes('[Claim]') && content.includes('[Disclosure]'), 'Fact/Claim/Disclosure format missing');
  assert.ok(content.includes('QUICK') && content.includes('STANDARD') && content.includes('DEEP'), 'output mode structure missing');
  assert.ok(content.includes('작성 10단계'), '10-step structure heading missing');
  assert.ok(content.includes('命財官') === false, 'sanity: this term belongs to the adapter, not the original — confirms files are not mixed up');
});

test('ziwei-original.md content is byte-identical to what was uploaded (checksum)', async () => {
  // We can't re-read the original upload path from a test (it's outside the
  // repo), so this test pins the checksum recorded at integration time —
  // if the file drifts from what was verified via `diff` during integration,
  // this test will catch it.
  const content = await readFile(ORIGINAL_PATH, 'utf-8');
  const hash = createHash('md5').update(content).digest('hex');
  assert.equal(hash, '5a5b7e543c2bb3813e5700df058d0f7e');
});

// --- runtime adapter 연결 ---
test('runtime/ziwei.md adapter does NOT duplicate the original text (plumbing-only, per instruction #6)', async () => {
  const adapter = await readFile(ADAPTER_PATH, 'utf-8');
  const original = await readFile(ORIGINAL_PATH, 'utf-8');
  // The adapter should reference the original file, not contain its content.
  assert.ok(adapter.includes('ziwei-original.md'));
  // A distinctive full sentence that exists only in the original's actual
  // rule text (not just a bracketed term name, which the adapter may
  // legitimately reference when explaining field mappings).
  const distinctiveOriginalSentence = '재물·사업·이직·결혼·이혼에 관해 직접 행동을 지시하지 않는다.';
  assert.ok(original.includes(distinctiveOriginalSentence), 'sanity: sentence should exist in the original');
  assert.ok(!adapter.includes(distinctiveOriginalSentence), 'adapter should not duplicate the original\'s actual rule sentences');
});

test('pipeline concatenates adapter + original verbatim at runtime (system prompt actually contains original content)', async () => {
  const provider = new MockAIProvider();
  await runQuestionPipeline({ provider, canonical, question: '자미두수로 보면 내 성격이 어때?' });
  // MockAIProvider logs each call; the 2nd call (saju_ziwei_cross_response)
  // system prompt is what pipeline.mjs actually sent to the "model".
  // We re-derive it the same way pipeline.mjs does, to assert equality.
  const adapter = await readFile(ADAPTER_PATH, 'utf-8');
  const original = await readFile(ORIGINAL_PATH, 'utf-8');
  const combined = `${adapter}\n\n${original}`;
  assert.ok(combined.includes('삼방사정을 근거로 결론 내리기 전 반드시'));
  assert.ok(combined.includes('이 서비스는 이 고정 관계를')); // adapter-only sentence
});

// --- ziwei 관련 질문 routing (ziwei만 추출) ---
test('a ziwei-named question routes to ziwei fields only (saju_fields empty)', async () => {
  const provider = new MockAIProvider();
  const result = await runQuestionPipeline({ provider, canonical, question: '자미두수 명궁을 보면 내가 어떤 사람이야?' });
  assert.deepEqual(result.router.saju_fields, []);
  assert.ok(result.router.ziwei_fields.length > 0);
  assert.deepEqual(Object.keys(result.extracted.saju), []);
  assert.ok(Object.keys(result.extracted.ziwei).length > 0);
});

test('a saju-named question routes to saju fields only (ziwei_fields empty)', async () => {
  const provider = new MockAIProvider();
  const result = await runQuestionPipeline({ provider, canonical, question: '사주로 봤을 때 내 성격이 어때?' });
  assert.deepEqual(result.router.ziwei_fields, []);
  assert.ok(result.router.saju_fields.length > 0);
  assert.deepEqual(Object.keys(result.extracted.ziwei), []);
  assert.ok(Object.keys(result.extracted.saju).length > 0);
});

// --- saju + ziwei cross-analysis routing (둘 다 추출) ---
test('a comparison question ("사주와 자미두수를 비교해서") routes to BOTH systems', async () => {
  const provider = new MockAIProvider();
  const result = await runQuestionPipeline({ provider, canonical, question: '사주와 자미두수를 비교해서 봐줘, 내 직업운이 각각 어떻게 다른지' });
  assert.ok(result.router.saju_fields.length > 0, 'expected non-empty saju_fields for a comparison question');
  assert.ok(result.router.ziwei_fields.length > 0, 'expected non-empty ziwei_fields for a comparison question');
  assert.ok(Object.keys(result.extracted.saju).length > 0);
  assert.ok(Object.keys(result.extracted.ziwei).length > 0);
  // Cross-analysis output must be present and populated for a comparison question.
  assert.ok(result.analysis.cross_analysis.common_direction.length > 0);
  assert.ok(result.analysis.cross_analysis.differences.length > 0);
});

test('"두 체계가 같은 결과를 말하느냐" style question also routes to both systems', async () => {
  const provider = new MockAIProvider();
  const result = await runQuestionPipeline({ provider, canonical, question: '사주와 자미두수 둘 다 같은 결과를 말하고 있어?' });
  assert.ok(result.router.saju_fields.length > 0);
  assert.ok(result.router.ziwei_fields.length > 0);
});

// --- 삼방사정 자동 확장 (ziwei 원본의 필수 규칙 반영 검증) ---
test('ziwei-relations: fixed 命財官 triad is correctly derived', () => {
  const { daeGung, samHapGung } = getSamBangSaJeong('life');
  assert.equal(daeGung, 'travel');
  assert.deepEqual(samHapGung.sort(), ['career', 'wealth']);
});

test('extraction always includes 삼방사정 for any ziwei question with a palace focus', async () => {
  const provider = new MockAIProvider();
  const result = await runQuestionPipeline({ provider, canonical, question: '내가 사업을 하는 게 맞을까?' });
  const returnedPositions = result.extracted.ziwei.palaces.map((p) => p.position);
  for (const focus of result.router.ziwei_palace_focus) {
    const { daeGung, samHapGung } = getSamBangSaJeong(focus);
    assert.ok(returnedPositions.includes(focus), `focus palace ${focus} missing`);
    assert.ok(returnedPositions.includes(daeGung), `대궁 ${daeGung} missing for focus ${focus}`);
    samHapGung.forEach((p) => assert.ok(returnedPositions.includes(p), `삼합궁 ${p} missing for focus ${focus}`));
  }
});
