// tests/18-casual-ai-and-abuse-protection.test.mjs
//
// 캐주얼 전용 저가 AI(option B) + 폭탄 메시지 남용 방지. 실제 API 호출 없음(MockAIProvider).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { rm } from 'node:fs/promises';

import { createConversation, recordAndCheckCasualAiBudget } from '../apps/api/src/repositories/conversation-repository.mjs';
import { createChartRecord } from '../apps/api/src/repositories/chart-repository.mjs';
import { handleFreeTextMessage } from '../apps/api/src/services/conversation-service.mjs';
import { MockAIProvider } from '../packages/ai/providers/mock-provider.mjs';
import { buildCasualSystemPrompt, CASUAL_MESSAGE_MAX_LENGTH, truncateForCasual } from '../packages/character/casual-chat-prompt.mjs';

test.before(async () => {
  await rm('./data/db', { recursive: true, force: true });
});

async function makeConversation() {
  const chart = await createChartRecord({ canonical: { subject: {}, saju: {}, ziwei: {} } });
  return createConversation({ chartId: chart.id });
}

// --- 캐주얼 프롬프트/길이 제한 ---

test('buildCasualSystemPrompt: 사주 판단을 하지 않는다는 규칙이 명시된다', () => {
  const prompt = buildCasualSystemPrompt('daegu');
  assert.ok(prompt.includes('사주'));
  assert.ok(prompt.includes('판단하지 않는다'));
});

test('truncateForCasual: 짧은 메시지는 그대로, 긴 메시지는 잘린다', () => {
  const short = '오늘 힘들었어';
  assert.equal(truncateForCasual(short), short);

  const long = 'ㅋ'.repeat(1000);
  const truncated = truncateForCasual(long);
  assert.equal(truncated.length, CASUAL_MESSAGE_MAX_LENGTH);
});

// --- 대화별 캐주얼 AI 예산 (남용 방지) ---

test('recordAndCheckCasualAiBudget: 분당 상한 이내면 허용된다', async () => {
  const conv = await makeConversation();
  for (let i = 0; i < 5; i++) {
    const result = await recordAndCheckCasualAiBudget(conv.id, { maxPerMinute: 8, maxPerHour: 40 });
    assert.equal(result.allowed, true, `${i + 1}번째 호출은 허용돼야 함`);
  }
});

test('recordAndCheckCasualAiBudget: 분당 상한을 넘으면 차단된다 (폭탄 메시지 시뮬레이션)', async () => {
  const conv = await makeConversation();
  const results = [];
  for (let i = 0; i < 12; i++) {
    results.push(await recordAndCheckCasualAiBudget(conv.id, { maxPerMinute: 8, maxPerHour: 40 }));
  }
  const allowedCount = results.filter((r) => r.allowed).length;
  assert.equal(allowedCount, 8, '분당 상한(8)을 넘는 호출은 전부 차단돼야 함');
});

test('recordAndCheckCasualAiBudget: 시간당 상한도 별도로 적용된다', async () => {
  const conv = await makeConversation();
  const results = [];
  for (let i = 0; i < 50; i++) {
    results.push(await recordAndCheckCasualAiBudget(conv.id, { maxPerMinute: 1000, maxPerHour: 40 }));
  }
  const allowedCount = results.filter((r) => r.allowed).length;
  assert.equal(allowedCount, 40);
});

// --- handleFreeTextMessage 통합: 실제 캐주얼 AI 사용 vs 폴백 ---

test('casualAiProvider가 없으면(옵션 미설정) 기존처럼 무료 고정 반응 + usage=null', async () => {
  const conv = await makeConversation();
  const result = await handleFreeTextMessage({ conversationId: conv.id, text: '오늘 힘들었어', aiProvider: new MockAIProvider(), casualAiProvider: null });
  assert.equal(result.intent, 'casual');
  assert.equal(result.usage, null);
  assert.ok(result.response.length > 0);
});

test('casualAiProvider가 있으면 실제로 그걸 사용해서 usage가 채워진다', async () => {
  const conv = await makeConversation();
  const result = await handleFreeTextMessage({ conversationId: conv.id, text: '오늘 힘들었어', aiProvider: new MockAIProvider(), casualAiProvider: new MockAIProvider() });
  assert.equal(result.intent, 'casual');
  assert.ok(result.usage, 'casualAiProvider가 주어졌으면 usage가 있어야 함');
  assert.ok(result.response.length > 0);
});

test('예산을 초과하면 casualAiProvider가 있어도 무료 고정 반응으로 자동 대체된다 (남용 방지 핵심 동작)', async () => {
  const conv = await makeConversation();
  const provider = new MockAIProvider();
  let lastResult;
  for (let i = 0; i < 10; i++) {
    lastResult = await handleFreeTextMessage({ conversationId: conv.id, text: `테스트 메시지 ${i}`, aiProvider: provider, casualAiProvider: provider });
  }
  assert.equal(lastResult.usage, null, '예산 초과 후에는 AI를 호출하지 않고 usage가 없어야 함');
});

test('casualAiProvider 호출이 실패해도(예외) 사용자에게는 무료 고정 반응이 안전하게 대체된다', async () => {
  const conv = await makeConversation();
  const brokenProvider = { complete: async () => { throw new Error('network down'); } };
  const result = await handleFreeTextMessage({ conversationId: conv.id, text: '오늘 힘들었어', aiProvider: new MockAIProvider(), casualAiProvider: brokenProvider });
  assert.equal(result.intent, 'casual');
  assert.equal(result.usage, null);
  assert.ok(result.response.length > 0, 'AI가 실패해도 사용자는 여전히 응답을 받아야 함');
});

test('사주 질문(saju_question)은 캐주얼 예산과 무관하게 항상 정상 동작한다', async () => {
  const conv = await makeConversation();
  const provider = new MockAIProvider();
  for (let i = 0; i < 10; i++) {
    await handleFreeTextMessage({ conversationId: conv.id, text: `잡담 ${i}`, aiProvider: provider, casualAiProvider: provider });
  }
  const result = await handleFreeTextMessage({ conversationId: conv.id, text: '내 대운이 궁금해', aiProvider: provider, casualAiProvider: provider });
  assert.equal(result.intent, 'saju_question');
  assert.ok(result.usage);
});

test('casualAiProvider 없이 규칙기반 엔진(casual-response-engine)이 연속 대화에서 같은 응답을 반복하지 않는다', async () => {
  const conv = await makeConversation();
  const seen = [];
  for (let i = 0; i < 6; i++) {
    const result = await handleFreeTextMessage({ conversationId: conv.id, text: '오늘 힘들었어', aiProvider: new MockAIProvider(), casualAiProvider: null });
    seen.push(result.response);
  }
  // 최근 3개 연속으로 완전히 동일한 문장만 반복되면 안 됨 (recordCasualResponse가 실제로 반영되는지 확인)
  const last3 = seen.slice(-3);
  const allSame = last3.every((t) => t === last3[0]);
  assert.equal(allSame, false, '최근 3개 응답이 전부 동일하면 반복 방지가 동작하지 않은 것');
});
