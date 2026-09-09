// tests/52-legacy-entitlementid-removal.test.mjs
//
// Phase 10 — client-supplied entitlementId 직접 소비 레거시 제거 회귀 테스트. 실제 HTTP 요청
// body에 (본인 소유 또는 위조된) entitlementId를 억지로 넣어 보내도, 그것이 선차감되지 않고
// 오직 정식 authorization(질문 도메인 판정 → 서버가 직접 찾은 entitlement) 흐름만 quota를
// 변경한다는 것을 end-to-end로 검증한다.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import { rm, readFile } from 'node:fs/promises';

import { conversationsRouter } from '../apps/api/src/routes/conversations.mjs';
import { chartsRouter } from '../apps/api/src/routes/charts.mjs';
import { startConversation } from '../apps/api/src/services/conversation-service.mjs';
import { createChartRecord } from '../apps/api/src/repositories/chart-repository.mjs';
import { computeChart } from '../packages/chart-engine/compute.mjs';
import { buildCanonicalChart } from '../packages/canonical/transform.mjs';
import { MockAIProvider } from '../packages/ai/providers/mock-provider.mjs';

let server, baseUrl;

test.before(async () => {
  await rm('./data/db', { recursive: true, force: true });
  const app = express();
  app.use(express.json());
  const aiProviderFactory = () => new MockAIProvider();
  app.use('/api/charts', chartsRouter({ aiProviderFactory, model: 'mock' }));
  app.use('/api/conversations', conversationsRouter({ aiProviderFactory, model: 'mock' }));
  await new Promise((resolve) => {
    server = app.listen(0, () => {
      baseUrl = `http://localhost:${server.address().port}`;
      resolve();
    });
  });
});

test.after(async () => {
  await new Promise((resolve) => server.close(resolve));
});

async function postJson(path, body) {
  const res = await fetch(`${baseUrl}${path}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  return { status: res.status, body: await res.json() };
}

async function makeConversation() {
  const raw = computeChart({ birthDate: '1990-01-01', birthTime: '10:00', gender: 'male', city: 'Seoul' });
  const chart = await createChartRecord({ canonical: buildCanonicalChart(raw, { engineVersion: 'test' }) });
  const conversation = await startConversation({ chartId: chart.id, characterId: 'daegu' });
  return conversation.id;
}

test('A1: 요청 body에 임의의(위조) entitlementId를 넣어 보내도 캐주얼 대화에 아무 영향이 없다(선차감 안 됨, 무시됨)', async () => {
  const conversationId = await makeConversation();
  const res = await postJson(`/api/conversations/${conversationId}/messages`, { question: '오늘 점심 뭐 먹지', entitlementId: 'someone-elses-entitlement-id-12345' });
  // 레거시가 살아있던 시절엔 존재하지 않는 entitlementId를 보내면 ENTITLEMENT_NOT_FOUND로
  // 즉시 404가 났었다. 지금은 entitlementId 자체를 무시하므로 캐주얼 대화가 정상 처리된다.
  assert.equal(res.status, 200);
  assert.equal(res.body.intent, 'casual');
});

test('A2: 존재하지 않는 entitlementId를 사주 질문과 함께 보내도 entitlement 관련 에러(404/402/410) 없이 정상 authorization 흐름(비로그인 → 로그인 안내)으로 처리된다', async () => {
  const conversationId = await makeConversation();
  const res = await postJson(`/api/conversations/${conversationId}/messages`, { question: '내 대운이 궁금해', entitlementId: 'totally-fake-id-that-does-not-exist' });
  assert.equal(res.status, 200, '레거시였다면 ENTITLEMENT_NOT_FOUND로 404가 났을 상황');
  assert.equal(res.body.intent, 'saju_question');
  assert.equal(res.body.sources, null);
  assert.ok(res.body.response.includes('로그인'));
});

test('B1: 소스 레벨 — conversations.mjs에는 client entitlementId를 추출하거나 직접 소비하는 코드가 전혀 없다', async () => {
  const source = await readFile('./apps/api/src/routes/conversations.mjs', 'utf-8');
  assert.ok(!source.includes('const { question, entitlementId }'));
  assert.ok(!source.includes('consumeQuestionEntitlement('));
  assert.ok(!source.includes('import { consumeQuestionEntitlement }'));
});

test('B2: consumeQuestionEntitlement는 라우트 레벨 어디서도 직접 호출되지 않고, conversation-service.mjs의 authorization 성공 경로에서만 정확히 4번(자유입력/카탈로그선택/출생일택일채팅/작명채팅) 호출된다', async () => {
  const routeFiles = [
    './apps/api/src/routes/conversations.mjs',
    './apps/api/src/routes/charts.mjs',
    './apps/api/src/routes/orders.mjs',
    './apps/api/src/routes/payments.mjs',
    './apps/api/src/routes/yearly-fortune.mjs',
    './apps/api/src/routes/compatibility.mjs',
    './apps/api/src/routes/child-profiles.mjs',
    './apps/api/src/routes/birth-selection.mjs',
    './apps/api/src/routes/naming.mjs',
  ];
  for (const file of routeFiles) {
    let source;
    try {
      source = await readFile(file, 'utf-8');
    } catch {
      continue;
    }
    assert.ok(!source.includes('consumeQuestionEntitlement('), `${file}에는 직접 소비 호출이 없어야 함(라우트 레벨 우회 경로 방지)`);
  }
  const serviceSource = await readFile('./apps/api/src/services/conversation-service.mjs', 'utf-8');
  const occurrences = (serviceSource.match(/consumeQuestionEntitlement\(/g) ?? []).length;
  assert.equal(occurrences, 4, 'handleFreeTextMessage(saju)/pickCatalogChoice/handleFreeTextMessage(DATE_SELECTION)/handleFreeTextMessage(NAMING) 4곳에서만, 정확히 authorization 성공 이후에 호출되어야 함');
});
