// tests/66-hybrid-intent-routing.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { classifyServiceIntent } from '../packages/character/catalog-selector.mjs';
import { startConversation, handleFreeTextMessage } from '../apps/api/src/services/conversation-service.mjs';
import { createChartRecord } from '../apps/api/src/repositories/chart-repository.mjs';
import { computeChart } from '../packages/chart-engine/compute.mjs';
import { buildCanonicalChart } from '../packages/canonical/transform.mjs';
import { MockAIProvider } from '../packages/ai/providers/mock-provider.mjs';

async function makeConversation() {
  const raw = computeChart({ birthDate: '1990-05-15', birthTime: '14:30', gender: 'male', city: 'Seoul' });
  const canonical = buildCanonicalChart(raw, { engineVersion: '0.4.2' });
  const chart = await createChartRecord({ userId: null, canonical, rawEngineOutput: raw });
  return startConversation({ chartId: chart.id, characterId: 'daegu' });
}

test('1. classifyServiceIntent — 결제/가격/시작 의도를 정확히 분류한다', () => {
  assert.equal(classifyServiceIntent('사주 보려고'), 'service_start');
  assert.equal(classifyServiceIntent('사주 좀 봐줘'), 'service_start');
  assert.equal(classifyServiceIntent('나 사주 보고 싶어'), 'service_start');
  assert.equal(classifyServiceIntent('어디서 결제해?'), 'payment_question');
  assert.equal(classifyServiceIntent('결제 어떻게 해?'), 'payment_question');
  assert.equal(classifyServiceIntent('가격 얼마야?'), 'product_question');
});

test('2. classifyServiceIntent — 진짜 열린 대화는 null(casual 유지)을 반환한다', () => {
  const openEnded = ['안녕', '그냥 궁금해서', '요즘 좀 답답해', '사주 처음 봐', '너는 어떻게 보는 거야?', '사주 같은 거 믿어?', '뭘 알 수 있는데?'];
  for (const t of openEnded) {
    assert.equal(classifyServiceIntent(t), null, `"${t}"는 casual로 남아야 함`);
  }
});

test('3. 비로그인 "사주 보려고" → 시스템 안내문이 아니라 대구 말투 응답, AI 호출 0회', async () => {
  const conv = await makeConversation();
  const provider = new MockAIProvider();
  const result = await handleFreeTextMessage({ conversationId: conv.id, text: '사주 보려고', aiProvider: provider, model: 'mock' });
  assert.ok(!result.response.includes('로그인 후 상세분석을 구매하시면'));
  assert.ok(!result.response.includes('이 질문은'));
  assert.equal(provider.callLog.length, 0);
  assert.deepEqual(result.purchaseRequired, { productCode: null, loginRequired: true });
});

test('4. 비로그인 "어디서 결제해?" → 동일하게 대구 말투로 회원가입 안내', async () => {
  const conv = await makeConversation();
  const result = await handleFreeTextMessage({ conversationId: conv.id, text: '어디서 결제해?', aiProvider: new MockAIProvider(), model: 'mock' });
  assert.ok(!result.response.includes('음, 그런가'));
  assert.equal(result.purchaseRequired.loginRequired, true);
});

test('5. 로그인 상태에서 "가격 얼마야?" → 실제 product DB 조회를 시도한다', async () => {
  const raw = computeChart({ birthDate: '1990-05-15', birthTime: '14:30', gender: 'male', city: 'Seoul' });
  const canonical = buildCanonicalChart(raw, { engineVersion: '0.4.2' });
  const chart = await createChartRecord({ userId: 'user1', canonical, rawEngineOutput: raw });
  const conv = await startConversation({ chartId: chart.id, characterId: 'daegu', userId: 'user1' });
  await assert.rejects(
    () => handleFreeTextMessage({ conversationId: conv.id, text: '가격 얼마야?', aiProvider: new MockAIProvider(), model: 'mock', userId: 'user1' }),
    /DATABASE_URL/
  );
});

test('6. "안녕" 같은 진짜 casual 발화는 hybrid 라우팅에 걸리지 않는다', async () => {
  const conv = await makeConversation();
  const result = await handleFreeTextMessage({ conversationId: conv.id, text: '안녕', aiProvider: new MockAIProvider(), model: 'mock' });
  assert.equal(result.intent, 'casual');
});

test('7. 자녀 프로필 대화는 hybrid 라우팅을 건너뛴다', async () => {
  const source = await readFile('./apps/api/src/services/conversation-service.mjs', 'utf-8');
  assert.ok(source.includes('if (serviceIntent && !earlyConversation?.child_profile_id)'));
});

test('8. routes/conversations.mjs는 result.authorization이 없을 때 result.purchaseRequired로 폴백한다', async () => {
  const source = await readFile('./apps/api/src/routes/conversations.mjs', 'utf-8');
  const occurrences = (source.match(/: \(result\.purchaseRequired \?\? null\),/g) ?? []).length;
  assert.equal(occurrences, 2);
});

test('9. casual 프롬프트에 실제 로그인/생년월일 상태가 주입된다', async () => {
  const source = await readFile('./apps/api/src/services/conversation-service.mjs', 'utf-8');
  assert.ok(source.includes('{ userLoggedIn: !!userId, birthDataExists: !!conversation?.chart_id }'));
});
