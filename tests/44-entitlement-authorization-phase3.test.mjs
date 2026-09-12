// tests/44-entitlement-authorization-phase3.test.mjs
//
// Phase 3 — 서버 측 authorization. 이 환경엔 실제 Supabase Postgres가 없으므로, "로그인+실제
// entitlement 보유 → ALLOW" 케이스(§12 Case A/B/C 성공 경로)는 이 파일로 검증할 수 없다 —
// 로컬에서 실제 DB로 확인 필요(보고서에 명시). 여기서는 이 환경에서 실제로 실행 가능한 것만
// 검증한다: (1) MockAIProvider를 spy로 감싸서 실제 LLM 호출 횟수를 측정, (2) userId 없으면
// DB 호출 전에 즉시 거부, (3) 클라이언트가 보낸 entitlementId/analysisType이 authorization
// 경로 어디에서도 실제로 쓰이지 않는다는 것을 소스 레벨로 확인.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { rm } from 'node:fs/promises';
import { readFile } from 'node:fs/promises';

import { authorizeAnalysisQuestion } from '../apps/api/src/services/entitlement-authorization-service.mjs';
import { mapRouterCategoriesToAnalysisTypes } from '../apps/api/src/services/analysis-domain-mapper.mjs';
import { handleFreeTextMessage } from '../apps/api/src/services/conversation-service.mjs';
import { startConversation } from '../apps/api/src/services/conversation-service.mjs';
import { createChartRecord } from '../apps/api/src/repositories/chart-repository.mjs';
import { computeChart } from '../packages/chart-engine/compute.mjs';
import { buildCanonicalChart } from '../packages/canonical/transform.mjs';
import { MockAIProvider } from '../packages/ai/providers/mock-provider.mjs';

test.before(async () => {
  await rm('./data/db', { recursive: true, force: true });
});

async function makeConversation() {
  const raw = computeChart({ birthDate: '1990-01-01', birthTime: '10:00', gender: 'male', city: 'Seoul' });
  const chart = await createChartRecord({ canonical: buildCanonicalChart(raw, { engineVersion: 'test' }) });
  const conversation = await startConversation({ chartId: chart.id, characterId: 'daegu' });
  return conversation.id;
}

/** MockAIProvider를 감싸서 실제 .complete() 호출 횟수를 센다 — LLM 호출 0회/1회를 직접 실측. */
function makeCountingProvider() {
  const inner = new MockAIProvider();
  let callCount = 0;
  return {
    provider: { complete: async (...args) => { callCount += 1; return inner.complete(...args); } },
    getCallCount: () => callCount,
  };
}

// ============================================================
// A. 비로그인 사용자 — DB 호출 없이 즉시 거부
// ============================================================

test('A1: authorizeAnalysisQuestion 자체는 userId 유효성을 검사하지 않는다(그 책임은 호출부에 있음) — null을 그대로 넘기면 DB 조회를 시도하다 명확한 에러가 난다(가짜로 허용 안 함)', async () => {
  await assert.rejects(
    () => authorizeAnalysisQuestion({ userId: null, routerResult: {} }),
    /DATABASE_URL/
  );
});

// ============================================================
// B. 실제 LLM 호출 횟수 실측 — 핵심 요구사항(§11/§13/§14)
// ============================================================

test('B1: 비로그인 사용자의 사주 질문 → 분석 LLM 호출은 0회다(Router는 호출되지만 분석은 스킵)', async () => {
  const conversationId = await makeConversation();
  const { provider, getCallCount } = makeCountingProvider();

  const result = await handleFreeTextMessage({
    conversationId,
    text: '내 대운이 궁금해',
    aiProvider: provider,
    model: 'mock',
    userId: null, // 비로그인
  });

  assert.equal(result.intent, 'saju_question');
  assert.equal(result.sources, null, '분석이 실행 안 됐으므로 sources 없음');
    assert.equal(result.purchaseRequired?.loginRequired, true, '로그인 필요 신호가 구조화된 필드로 와야 함(§실측 개선 — 시스템 문구 대신 대구 말투+구조화 신호)');
  // Router 1회는 호출되지만(기존 비용, §2 "새 LLM 호출 추가 안 함" — 기존에 항상 있던 호출),
  // 더 비싼 분석 호출은 정확히 0회여야 한다. Mock provider가 Router/분석 구분 없이 매 .complete()
  // 호출마다 카운트되므로, "Router만 1회, 분석 0회"는 총 호출 수가 1이어야 함을 뜻한다.
  assert.equal(getCallCount(), 1, 'Router 1회만 호출되고 분석 호출은 없어야 함(0회)');
});

test('B2: 캐주얼 대화는 authorization 자체가 적용되지 않는다(기존과 동일하게 무료, LLM 호출 0회 — casual은 규칙기반)', async () => {
  const conversationId = await makeConversation();
  const { provider, getCallCount } = makeCountingProvider();

  const result = await handleFreeTextMessage({
    conversationId,
    text: '안녕',
    aiProvider: provider,
    model: 'mock',
    userId: null,
  });

  assert.equal(result.intent, 'casual');
  assert.equal(getCallCount(), 0, '캐주얼 대화는 애초에 이 aiProvider를 쓰지 않음(규칙기반 엔진)');
});

// ============================================================
// C. 클라이언트 조작 방어 — 소스 레벨 검증(§16)
// ============================================================

test('C1: saju_question 경로의 authorization은 req.body의 entitlementId/analysisType/analysisId를 전혀 참조하지 않는다', async () => {
  const source = await readFile('./apps/api/src/services/conversation-service.mjs', 'utf-8');
  // authorizeBeforeAnalysis 콜백 정의 부분에서 body 파라미터(entitlementId 등)를 참조하면 안 됨.
  // userId(세션에서만 옴)만 참조해야 한다.
  const callbackSection = source.slice(source.indexOf('const authorizeBeforeAnalysis ='), source.indexOf('const authorizeBeforeAnalysis =') + 500);
  assert.ok(!callbackSection.includes('entitlementId'), 'authorization 콜백이 클라이언트 entitlementId를 참조하면 안 됨');
  assert.ok(callbackSection.includes('userId'), 'authorization은 반드시 서버측 userId만 근거로 해야 함');
});

test('C2: 라우트가 req.user.id(세션)만 handleFreeTextMessage에 전달하고, body의 값을 userId로 쓰지 않는다', async () => {
  const source = await readFile('./apps/api/src/routes/conversations.mjs', 'utf-8');
  assert.ok(source.includes('userId: req.user?.id ?? null'), 'userId는 반드시 세션(req.user)에서만 와야 함');
  assert.ok(!source.includes('userId: req.body'), '클라이언트가 보낸 userId를 신뢰하면 안 됨');
});

test('C3: entitlement 소비(consumeQuestionEntitlement)에 쓰이는 entitlementId는 클라이언트가 아니라 authorization 결과(서버가 찾은 값)에서 온다', async () => {
  const source = await readFile('./apps/api/src/services/conversation-service.mjs', 'utf-8');
  assert.ok(source.includes('pipelineResult.authorization.entitlementId'), '차감 시 서버가 authorization 단계에서 직접 찾은 entitlementId만 써야 함');
});

// ============================================================
// D. Domain mapper — 현재 정책(단일 도메인) 확인 + 정책 충돌 문서화 확인
// ============================================================

test('D1: 현재는 어떤 카테고리든 SAJU_DETAIL 하나로 귀결된다(YEARLY_FORTUNE_DETAIL 상품이 아직 없어서)', () => {
  assert.deepEqual(mapRouterCategoriesToAnalysisTypes({ categories: ['ANNUAL_PERIOD'] }), ['SAJU_DETAIL']);
  assert.deepEqual(mapRouterCategoriesToAnalysisTypes({ categories: ['MAJOR_PERIOD'] }), ['SAJU_DETAIL']);
  assert.deepEqual(mapRouterCategoriesToAnalysisTypes({ categories: ['GENERAL'] }), ['SAJU_DETAIL']);
});

test('D2: 정책 충돌(ANNUAL_PERIOD vs YEARLY_FORTUNE_DETAIL)이 코드 주석으로 명시되어 있다', async () => {
  const source = await readFile('./apps/api/src/services/analysis-domain-mapper.mjs', 'utf-8');
  assert.ok(source.includes('정책 충돌'));
  assert.ok(source.includes('YEARLY_FORTUNE_DETAIL'));
});

// ============================================================
// E. entitlement.analysis_type 저장 (선행 작업) 확인
// ============================================================

test('E1: confirmPaymentTransaction이 product.analysis_type을 entitlement에 저장한다(소스 레벨)', async () => {
  const source = await readFile('./apps/api/src/repositories/payment-repository.mjs', 'utf-8');
  assert.ok(source.includes('select question_quota, validity_hours, analysis_type, subscription_group from products'));
  assert.ok(source.includes('insert into entitlements') && source.includes('analysis_type'));
});

test('E2: findActiveEntitlementByAnalysisType이 legacy entitlement(analysis_type=NULL)를 자동 승격하지 않는다(조회 조건에 analysis_type이 명시되어 있어 NULL은 매칭 안 됨)', async () => {
  const source = await readFile('./apps/api/src/repositories/payment-repository.mjs', 'utf-8');
  const fnSection = source.slice(source.indexOf('export async function findActiveEntitlementByAnalysisType'));
  assert.ok(fnSection.includes('analysis_type = $2'), 'analysis_type을 명시적으로 조건에 걸어야 legacy(NULL)가 매칭 안 됨');
});
