// tests/71-systemic-denial-fix-and-campaign-consistency.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

test('1. buildDenialMessage가 더 이상 기계적 시스템 문구를 반환하지 않는다', async () => {
  const source = await readFile('./apps/api/src/services/entitlement-authorization-service.mjs', 'utf-8');
  assert.ok(!source.includes('이 질문은 ${name}에 포함된 내용이에요'));
});

test('2. product_question/payment_question이 캠페인 체크를 포함한 buildProductCardData를 사용한다', async () => {
  const source = await readFile('./apps/api/src/services/conversation-service.mjs', 'utf-8');
  const fnStart = source.indexOf('async function handleServiceIntentMessage');
  const fnBody = source.slice(fnStart, fnStart + 2500);
  assert.ok(fnBody.includes('await buildProductCardData(codes)'));
});

test('3. buildProductCardData가 SAJU_BASIC에 대해서만 실제로 getActiveCampaign을 조회한다', async () => {
  const source = await readFile('./apps/api/src/services/conversation-service.mjs', 'utf-8');
  const fnStart = source.indexOf('async function buildProductCardData');
  const fnBody = source.slice(fnStart, fnStart + 800);
  assert.ok(fnBody.includes("p.code === 'SAJU_BASIC' ? await getActiveCampaign('SAJU_BASIC') : null"));
});

test('4. 일반 saju_question이 authorization 거부되면 generateServiceGuidanceResponse로 대체된다', async () => {
  const source = await readFile('./apps/api/src/services/conversation-service.mjs', 'utf-8');
  assert.ok(source.includes('const guidance = await generateServiceGuidanceResponse({ conversationId, conversation, userId });'));
});

test('5. 존재하지 않는 "서비스 보기" 메뉴를 사용자에게 노출하는 문구가 제거되었다', async () => {
  const source = await readFile('./apps/web/src/hooks/useChatController.js', 'utf-8');
  assert.ok(!source.includes('메뉴의 "서비스 보기"에서'));
});

test('6. 프론트 quickReply(start/products)가 자체 로직 대신 백엔드(api.sendMessage)로 위임한다', async () => {
  const source = await readFile('./apps/web/src/hooks/useChatController.js', 'utf-8');
  assert.ok(source.includes("const delegateText = choice.action === 'products' ? '가격 얼마야?'"));
  assert.ok(!source.includes('await api.listProducts()'));
});
