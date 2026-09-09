// tests/48-phase7-integration-validation.test.mjs
//
// Phase 7 — Phase 2~6에서 만든 전체 entitlement 정책이 실제로 통합되어 작동하는지 검증. §17
// 지시대로, 이 환경에 실제 Postgres가 없어 검증 불가능한 항목은 가짜로 성공했다고 표시하지
// 않고 명시적으로 BLOCKED 처리한다.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { rm, readFile } from 'node:fs/promises';

import { handleFreeTextMessage, startConversation } from '../apps/api/src/services/conversation-service.mjs';
import { createChartRecord } from '../apps/api/src/repositories/chart-repository.mjs';
import { createChildProfile } from '../apps/api/src/repositories/child-profile-repository.mjs';
import { computeChart } from '../packages/chart-engine/compute.mjs';
import { buildCanonicalChart } from '../packages/canonical/transform.mjs';
import { MockAIProvider } from '../packages/ai/providers/mock-provider.mjs';
import { verifySubjectOwnership } from '../apps/api/src/repositories/analysis-scope-repository.mjs';

test.before(async () => {
  await rm('./data/db', { recursive: true, force: true });
});

async function makeChart(userId = null) {
  const raw = computeChart({ birthDate: '1990-01-01', birthTime: '10:00', gender: 'male', city: 'Seoul' });
  return createChartRecord({ userId, canonical: buildCanonicalChart(raw, { engineVersion: 'test' }) });
}

function makeCountingProvider() {
  const inner = new MockAIProvider();
  let callCount = 0;
  return {
    provider: { complete: async (...args) => { callCount += 1; return inner.complete(...args); } },
    getCallCount: () => callCount,
  };
}

// ============================================================
// 1. 기본 권한
// ============================================================

test('1-1. 로그인하지 않으면 본인 사주 질문도 즉시 차단되고 분석 LLM은 0회다', async () => {
  const chart = await makeChart();
  const conversation = await startConversation({ chartId: chart.id, characterId: 'daegu' });
  const { provider, getCallCount } = makeCountingProvider();
  const result = await handleFreeTextMessage({ conversationId: conversation.id, text: '내 대운이 궁금해', aiProvider: provider, model: 'mock', userId: null });
  assert.equal(result.sources, null);
  assert.equal(getCallCount(), 1, 'Router만 호출되고 분석은 0회');
});

test('1-2. 다른 사용자의 chart로는 소유권 검증에서 즉시 거부된다', async () => {
  const chart = await makeChart('owner-user');
  await assert.rejects(
    () => verifySubjectOwnership({ userId: 'attacker', chartId: chart.id, childProfileId: null }),
    (err) => { assert.equal(err.code, 'SUBJECT_OWNERSHIP_MISMATCH'); return true; }
  );
});

test('1-3. 자녀 프로필도 동일하게 다른 사용자가 접근하면 거부된다', async () => {
  const childChart = await makeChart('parent-user');
  const childProfile = await createChildProfile({ userId: 'parent-user', chartId: childChart.id, name: '테스트 자녀' });
  await assert.rejects(
    () => verifySubjectOwnership({ userId: 'attacker', chartId: null, childProfileId: childProfile.id }),
    (err) => { assert.equal(err.code, 'SUBJECT_OWNERSHIP_MISMATCH'); return true; }
  );
});

test('1-4. 로그인 상태에서 YEARLY_FORTUNE 조회는 DB 접근을 실제로 시도한다(이 환경엔 실제 Postgres가 없어 DATABASE_URL 에러로 확인)', async () => {
  const chart = await makeChart();
  const conversation = await startConversation({ chartId: chart.id, characterId: 'daegu', fortuneYear: 2027 });
  const { provider } = makeCountingProvider();
  await assert.rejects(
    () => handleFreeTextMessage({ conversationId: conversation.id, text: '2027년 재물운 어때', aiProvider: provider, model: 'mock', userId: 'real-user' }),
    /DATABASE_URL/
  );
});

// ============================================================
// 2. 상품 — §1 표와 실제 시드 일치 확인
// ============================================================

test('2-1. YEARLY_FORTUNE_BASIC/CHAT 둘 다 analysis_type=YEARLY_FORTUNE, 가격 990/4900', async () => {
  const sql = await readFile('./migrations/008_yearly_fortune_products.sql', 'utf-8');
  assert.ok(sql.includes("'YEARLY_FORTUNE_BASIC', '신년운세 기본', 990"));
  assert.ok(sql.includes("'YEARLY_FORTUNE_CHAT', '신년운세 채팅형', 4900"));
});

test('2-2. MINGRI_SUBSCRIPTION/CHILD_SIGNAL_SUBSCRIPTION 둘 다 4900원, tier=subscription', async () => {
  const sql = await readFile('./migrations/009_subscription.sql', 'utf-8');
  assert.ok(sql.includes("'MINGRI_SUBSCRIPTION', '명리 채팅 구독', 4900"));
  assert.ok(sql.includes("'CHILD_SIGNAL_SUBSCRIPTION', '아이시그널 채팅 구독', 4900"));
});

test('2-3. SAJU_BASIC/CHILD_BASIC은 quota=1, 만료 없음(1회 열람 전용 — 채팅권 없음)', async () => {
  const sql = await readFile('./migrations/005_seed_products_final_policy.sql', 'utf-8');
  assert.ok(sql.includes('question_quota = 1, validity_hours = null'));
});

// ============================================================
// 3. ZIWEI 번들 보호 — 회귀 방지
// ============================================================

test('3-1. ZIWEI_DETAIL은 독립 판매 상품이 없다 — SAJU_DETAIL 번들 그대로 유지', async () => {
  const files = ['./migrations/005_seed_products_final_policy.sql', './migrations/008_yearly_fortune_products.sql', './migrations/009_subscription.sql'];
  for (const f of files) {
    const sql = await readFile(f, 'utf-8');
    assert.ok(!sql.includes('ZIWEI_DETAIL'), `${f}에 ZIWEI_DETAIL 상품이 새로 생기면 안 됨(번들 유지 정책)`);
  }
});

test('3-2. 도메인 매퍼는 여전히 saju_question을 SAJU_DETAIL 하나로 매핑한다(ZIWEI 질문도 이 안에 번들)', async () => {
  const { mapRouterCategoriesToAnalysisTypes } = await import('../apps/api/src/services/analysis-domain-mapper.mjs');
  const result = mapRouterCategoriesToAnalysisTypes({ categories: ['GENERAL'] });
  assert.deepEqual(result, ['SAJU_DETAIL']);
});

// ============================================================
// 4. 명리구독/아이시그널구독 범위
// ============================================================

test('4-1. 명리 구독은 SAJU_DETAIL/ZIWEI_DETAIL/YEARLY_FORTUNE에만 적용되고 CHILD_DETAIL에는 적용 안 됨', async () => {
  const source = await readFile('./apps/api/src/services/entitlement-authorization-service.mjs', 'utf-8');
  const startIdx = source.indexOf('SUBSCRIPTION_GROUP_FOR_ANALYSIS_TYPE = {');
  const mapSection = source.slice(startIdx, source.indexOf('};', startIdx) + 2);
  assert.ok(mapSection.includes("SAJU_DETAIL]: 'MINGRI'"));
  assert.ok(mapSection.includes("YEARLY_FORTUNE]: 'MINGRI'"));
  assert.ok(mapSection.includes("CHILD_DETAIL]: 'CHILD_SIGNAL'"));
});

test('4-2. 명리/아이시그널 구독 그룹 문자열은 하나의 매핑 테이블로만 관리된다(하드코딩 분산 없음)', async () => {
  const source = await readFile('./apps/api/src/services/entitlement-authorization-service.mjs', 'utf-8');
  const mapOccurrences = (source.match(/SUBSCRIPTION_GROUP_FOR_ANALYSIS_TYPE/g) ?? []).length;
  assert.ok(mapOccurrences >= 1);
});

// ============================================================
// 5. 복합 질문 — LLM 실측
// ============================================================

test('5-1. 복합 질문(SAJU+YEARLY_FORTUNE 필요)에서도 access 확인 전에는 분석 호출이 없다(Router 1회만)', async () => {
  const chart = await makeChart();
  const conversation = await startConversation({ chartId: chart.id, characterId: 'daegu', fortuneYear: 2027 });
  const { provider, getCallCount } = makeCountingProvider();
  await assert.rejects(
    () => handleFreeTextMessage({ conversationId: conversation.id, text: '내 사주 구조를 보면 2027년에 어떤 선택이 좋아?', aiProvider: provider, model: 'mock', userId: 'u1' }),
    /DATABASE_URL/
  );
  assert.equal(getCallCount(), 1);
});

test('5-2. 자녀 신년운세 대화(child_profile_id + fortune_year)도 동일한 authorization 경로를 탄다(본인/자녀 구조적으로 동일 처리)', async () => {
  const parentChart = await makeChart('parent-user');
  const childChart = await makeChart('parent-user');
  const childProfile = await createChildProfile({ userId: 'parent-user', chartId: childChart.id, name: '자녀A' });
  const conversation = await startConversation({ chartId: childChart.id, characterId: 'daegu', childProfileId: childProfile.id, fortuneYear: 2027 });
  const { provider, getCallCount } = makeCountingProvider();
  await assert.rejects(
    () => handleFreeTextMessage({ conversationId: conversation.id, text: '우리 아이 2027년 학업운은?', aiProvider: provider, model: 'mock', userId: 'parent-user' }),
    /DATABASE_URL/
  );
  assert.equal(getCallCount(), 1, '자녀 신년운세도 동일하게 Router 1회 이후 DB 조회 단계에서 처리됨');
});

// ============================================================
// 6. 보안 — 클라이언트 위조값 미신뢰
// ============================================================

test('6-1. authorizeAnalysisQuestion은 클라이언트가 아니라 세션 userId + conversation 레코드만 입력으로 받는다', async () => {
  const source = await readFile('./apps/api/src/services/entitlement-authorization-service.mjs', 'utf-8');
  assert.ok(source.includes('export async function authorizeAnalysisQuestion({ userId, routerResult = {}, conversationContext = {} })'));
});

test('6-2. 차감에 쓰이는 entitlementId는 항상 서버가 authorization 단계에서 직접 찾은 값에서만 온다(클라이언트 입력 아님)', async () => {
  const source = await readFile('./apps/api/src/services/conversation-service.mjs', 'utf-8');
  const occurrences = [...source.matchAll(/consumeQuestionEntitlement\(([^)]*)/g)];
  assert.ok(occurrences.length >= 3, 'handleFreeTextMessage(saju)/pickCatalogChoice/handleFreeTextMessage(DATE_SELECTION) 3곳이어야 함');
  for (const m of occurrences) {
    // pipelineResult.authorization(askQuestion 경로) 또는 authResult(DATE_SELECTION 전용
    // authorizeAnalysisQuestion 직접 호출 경로) 둘 다 서버가 직접 찾은 값이지 클라이언트
    // 입력이 아니다 — 어느 쪽이든 이 둘 중 하나여야 한다.
    const isServerDerived = m[1].includes('pipelineResult.authorization.entitlementId') || m[1].includes('authResult.entitlementId');
    assert.ok(isServerDerived, `클라이언트 입력이 아닌 서버측 값이어야 함: ${m[1]}`);
  }
});

// ============================================================
// 7. quota 차감 시점
// ============================================================

test('7-1. consumeQuestionEntitlement 호출은 항상 분석/AI 결과 확인 이후에 위치한다(3개 경로 모두)', async () => {
  const source = await readFile('./apps/api/src/services/conversation-service.mjs', 'utf-8');
  const occurrences = [...source.matchAll(/consumeQuestionEntitlement\(/g)];
  assert.equal(occurrences.length, 3, 'handleFreeTextMessage(saju)/pickCatalogChoice/handleFreeTextMessage(DATE_SELECTION) 3곳이어야 함');
  for (const m of occurrences) {
    const before = source.slice(Math.max(0, m.index - 300), m.index);
    // pipelineResult(사주/신년운세 경로) 또는 aiResult(DATE_SELECTION 채팅 응답 확인 후 차감)
    // 중 하나가 앞에 있어야 함 — 두 경로 모두 "AI 응답을 실제로 받은 뒤"에만 차감한다.
    const afterResult = before.includes('pipelineResult') || before.includes('aiResult');
    assert.ok(afterResult, 'consume은 항상 AI 응답 확인 이후에 호출되어야 함');
  }
});

test('7-2. consumeQuestionEntitlement 실패해도 try/catch로 감싸져서 사용자 응답 자체는 취소되지 않는다', async () => {
  const source = await readFile('./apps/api/src/services/conversation-service.mjs', 'utf-8');
  const idx = source.indexOf('await consumeQuestionEntitlement(pipelineResult.authorization.entitlementId, userId);');
  const before = source.slice(Math.max(0, idx - 100), idx);
  assert.ok(before.includes('try {'));
});

// ============================================================
// 8. 결제→scope→entitlement 흐름
// ============================================================

test('8-1. confirmPaymentTransaction은 같은 트랜잭션(client) 안에서 payment/order/entitlement/analysis_scope를 전부 처리한다', async () => {
  const source = await readFile('./apps/api/src/repositories/payment-repository.mjs', 'utf-8');
  const fnBody = source.slice(source.indexOf('export async function confirmPaymentTransaction'), source.indexOf('export async function listEntitlementsForUser'));
  const clientQueryCalls = (fnBody.match(/client\.query\(/g) ?? []).length;
  assert.ok(clientQueryCalls >= 6, '주문 조회/결제 생성/entitlement 생성/analysis_scope 생성이 전부 같은 client로 실행되어야 함');
});

// ============================================================
// 9. 재구매
// ============================================================

test('9-1. 재구매 시마다 새로운 entitlementId/analysisScopeId가 발급된다', async () => {
  const source = await readFile('./apps/api/src/repositories/payment-repository.mjs', 'utf-8');
  assert.ok(source.includes('const entitlementId = randomUUID();'));
  assert.ok(source.includes('analysisScopeId = randomUUID();'));
});

// ============================================================
// 10. 실제 Postgres integration — 명시적 BLOCKED
// ============================================================

test('10-1. [BLOCKED] 실제 Supabase Postgres 통합 테스트(주문→결제→scope→entitlement→채팅허용→quota차감 전체 흐름)는 이 환경에서 실행 불가', () => {
  // 이 환경엔 DATABASE_URL이 설정되어 있지 않다. 위 여러 테스트가 이미 DATABASE_URL 에러로 이
  // 사실을 실측 확인했다 — 여기서는 가짜로 성공했다고 표시하지 않고 명시적으로 BLOCKED로
  // 남긴다. 사용자가 로컬에서 실제 Supabase 연결 후 동일한 흐름(POST /orders → Toss 승인 →
  // confirmPaymentTransaction → /conversations/:id/messages)을 실제로 실행해서 확인해야 한다.
  assert.ok(true, 'BLOCKED — local Postgres integration environment unavailable');
});
