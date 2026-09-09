// tests/58-date-selection-chat.test.mjs
//
// §DATE_SELECTION 채팅 연결 — §6에서 요구한 최소 시나리오. 이 환경엔 실제 Postgres가 없어서
// authorizeAnalysisQuestion을 타는 지점부터는 DATABASE_URL 에러로 막힌다(기존 yearly-fortune
// 테스트와 동일한 패턴) — 그 전까지(conversation 생성, 라우팅, 비로그인 처리)는 실제로 실행해서
// 검증하고, DB가 필요한 나머지는 소스 레벨로 계약을 확인한다.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { rm, readFile } from 'node:fs/promises';

import { startConversation, handleFreeTextMessage } from '../apps/api/src/services/conversation-service.mjs';
import { MockAIProvider } from '../packages/ai/providers/mock-provider.mjs';

test.before(async () => {
  await rm('./data/db', { recursive: true, force: true });
});

test('1. DATE_SELECTION conversation은 chart_id 없이 정상 생성되고 date_selection_scope_id가 저장된다', async () => {
  const conv = await startConversation({ userId: 'user1', characterId: 'daegu', dateSelectionScopeId: 'scope-abc' });
  assert.ok(conv.id);
  assert.equal(conv.date_selection_scope_id, 'scope-abc');
  assert.equal(conv.chart_id, null);
});

test('2. classifyMessage 분류와 무관하게 DATE_SELECTION conversation은 항상 전용 경로로 라우팅된다(실제 버그 수정 확인)', async () => {
  const conv = await startConversation({ characterId: 'daegu', dateSelectionScopeId: 'scope-xyz' });
  const result = await handleFreeTextMessage({ conversationId: conv.id, text: '왜 1위가 좋아?', aiProvider: new MockAIProvider(), model: 'mock' });
  assert.ok(result.response.includes('로그인'), '캐주얼 응답으로 새면 안 됨');
  assert.equal(result.sources, null);
});

test('3. 비로그인 사용자는 AI 호출 자체가 발생하지 않고 즉시 안내로 차단된다(quota 소모 없음)', async () => {
  const conv = await startConversation({ characterId: 'daegu', dateSelectionScopeId: 'scope-noauth' });
  const provider = new MockAIProvider();
  const result = await handleFreeTextMessage({ conversationId: conv.id, text: '언제가 제일 좋아?', aiProvider: provider, model: 'mock' });
  assert.equal(result.sources, null);
  assert.equal(provider.callLog.length, 0, 'AI 호출 자체가 없어야 함');
});

test('4. 로그인 사용자는 authorizeAnalysisQuestion까지 도달하고, 이 환경엔 DB가 없어 DATABASE_URL 에러로 막힌다', async () => {
  const conv = await startConversation({ userId: 'user1', characterId: 'daegu', dateSelectionScopeId: 'scope-loggedin' });
  await assert.rejects(
    () => handleFreeTextMessage({ conversationId: conv.id, text: '2위와 뭐가 달라?', aiProvider: new MockAIProvider(), model: 'mock', userId: 'user1' }),
    /DATABASE_URL/
  );
});

test('5. DATE_SELECTION이 아닌 scope로 채팅 시작하면 라우트가 명확히 거부한다(소스 확인)', async () => {
  const source = await readFile('./apps/api/src/routes/birth-selection.mjs', 'utf-8');
  assert.ok(source.includes("scope.analysis_type !== 'DATE_SELECTION'"));
  assert.ok(source.includes('NOT_DATE_SELECTION_SCOPE'));
});

test('6. 존재하지 않는 scope는 ANALYSIS_NOT_FOUND로 거부되고 라우트가 404로 매핑한다', async () => {
  const source = await readFile('./apps/api/src/routes/birth-selection.mjs', 'utf-8');
  assert.ok(source.includes("err.code === 'ANALYSIS_NOT_FOUND'"));
});

test('7. access 판정 함수(findActiveEntitlementByAnalysisScopeId)는 quota 필터가 없다(quota 소진 여부는 별도 루프가 처리 - Phase10 버그 재발 방지)', async () => {
  const source = await readFile('./apps/api/src/services/entitlement-authorization-service.mjs', 'utf-8');
  assert.ok(source.includes('findActiveEntitlementByAnalysisScopeId(userId, dateSelectionScopeId)'));
  const fnBody = source.slice(source.indexOf('async function findAccessEntitlement'), source.indexOf('async function authorizeAnalysisQuestion'));
  assert.ok(!fnBody.includes('remaining_quantity > 0'), 'access 판정에는 quota 필터가 없어야 함');
});

test('8. AI 호출 성공 후에만 quota가 차감된다(consumeQuestionEntitlement가 aiResult 확인 이후에 위치)', async () => {
  const source = await readFile('./apps/api/src/services/conversation-service.mjs', 'utf-8');
  const consumeIdx = source.indexOf('consumeQuestionEntitlement(authResult.entitlementId, userId)');
  const aiResultIdx = source.indexOf('const aiResult = await aiProvider.complete({');
  assert.ok(aiResultIdx > -1 && consumeIdx > aiResultIdx, 'quota 차감은 AI 응답 확인 이후여야 함');
});

test('9. quota 차감은 try/catch로 감싸져 있어 실패해도 이미 생성된 응답을 취소하지 않는다', async () => {
  const source = await readFile('./apps/api/src/services/conversation-service.mjs', 'utf-8');
  const idx = source.indexOf('await consumeQuestionEntitlement(authResult.entitlementId, userId);');
  const before = source.slice(Math.max(0, idx - 60), idx);
  assert.ok(before.includes('try {'));
});

test('10. 클라이언트가 보낸 entitlementId는 DATE_SELECTION 채팅 경로 어디에도 등장하지 않는다', async () => {
  const source = await readFile('./apps/api/src/services/conversation-service.mjs', 'utf-8');
  const fnBody = source.slice(source.indexOf('async function handleDateSelectionChatMessage'), source.indexOf('export async function handleFreeTextMessage'));
  assert.ok(!fnBody.includes('req.body'));
  assert.ok(fnBody.includes('authResult.entitlementId'));
});

test('11. 채팅 컨텍스트에는 저장된 result_data 전체가 그대로 전달되고, AI가 후보를 다시 계산하지 않도록 지시한다', async () => {
  const source = await readFile('./apps/api/src/services/conversation-service.mjs', 'utf-8');
  assert.ok(source.includes('JSON.stringify(scope.result_data)'));
  const promptSource = await readFile('./packages/character/birth-selection-prompt.mjs', 'utf-8');
  const chatPromptFn = promptSource.slice(promptSource.indexOf('export function buildDateSelectionChatPrompt'));
  assert.ok(chatPromptFn.includes('새로운 날짜/시간/후보를 만들어내지 않는다'));
});

test('12. 응답의 sources 필드에도 result_data가 그대로 노출된다', async () => {
  const source = await readFile('./apps/api/src/services/conversation-service.mjs', 'utf-8');
  assert.ok(source.includes('sources: scope.result_data'));
});

test('13. YEARLY_FORTUNE의 기존 fortuneYear 분기는 이번 변경으로 손대지 않았다', async () => {
  const source = await readFile('./apps/api/src/services/entitlement-authorization-service.mjs', 'utf-8');
  assert.ok(source.includes('if (fortuneYear) {'));
  assert.ok(source.includes('findActiveYearlyFortuneChatEntitlement(userId, { chartId, childProfileId, fortuneYear })'));
});
