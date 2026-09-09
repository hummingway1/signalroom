// tests/47-subscription-compound-phase6.test.mjs
//
// Phase 6 — 명리 구독 + 복합 질문. 실제 Postgres가 없는 이 환경에서는 §25의 실제 entitlement
// 보유 기반 시나리오(1~18)는 완전히 검증할 수 없다 — 로컬 실제 DB 필요(보고서에 명시). 여기서는
// 실제 실행 가능한 것만 검증한다: 구독 상품 시드, access/quota 분리 원칙의 소스 레벨 확인,
// 그리고 실제 MockAIProvider spy로 측정한 LLM 호출 횟수(19~22 중 일부).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { rm, readFile } from 'node:fs/promises';

import { handleFreeTextMessage, startConversation } from '../apps/api/src/services/conversation-service.mjs';
import { createChartRecord } from '../apps/api/src/repositories/chart-repository.mjs';
import { computeChart } from '../packages/chart-engine/compute.mjs';
import { buildCanonicalChart } from '../packages/canonical/transform.mjs';
import { MockAIProvider } from '../packages/ai/providers/mock-provider.mjs';

test.before(async () => {
  await rm('./data/db', { recursive: true, force: true });
});

async function makeChart() {
  const raw = computeChart({ birthDate: '1990-01-01', birthTime: '10:00', gender: 'male', city: 'Seoul' });
  return createChartRecord({ canonical: buildCanonicalChart(raw, { engineVersion: 'test' }) });
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
// A. 구독 상품
// ============================================================

test('A1: MINGRI_SUBSCRIPTION/CHILD_SIGNAL_SUBSCRIPTION 둘 다 4900원, tier=subscription으로 시드된다', async () => {
  const sql = await readFile('./migrations/009_subscription.sql', 'utf-8');
  assert.ok(sql.includes("'MINGRI_SUBSCRIPTION'") && sql.includes("'MINGRI'"));
  assert.ok(sql.includes("'CHILD_SIGNAL_SUBSCRIPTION'") && sql.includes("'CHILD_SIGNAL'"));
  const tierMatches = sql.match(/, 'subscription',/g) ?? [];
  assert.equal(tierMatches.length, 2);
});

test('A2: 구독 상품은 특정 analysis_type 하나에 매핑되지 않는다(products.analysis_type이 null 허용으로 완화됨)', async () => {
  const sql = await readFile('./migrations/009_subscription.sql', 'utf-8');
  assert.ok(sql.includes('alter column analysis_type drop not null'));
});

// ============================================================
// B. Access vs Quota 분리 원칙(§7/§31) — 구독이 access를 만들지 않는다
// ============================================================

test('B1: findAccessEntitlement(access 판정)은 구독 조회 함수(findActiveSubscriptionQuota)를 전혀 참조하지 않는다', async () => {
  const source = await readFile('./apps/api/src/services/entitlement-authorization-service.mjs', 'utf-8');
  const fnBody = source.slice(source.indexOf('async function findAccessEntitlement'), source.indexOf('export async function authorizeAnalysisQuestion'));
  assert.ok(!fnBody.includes('findActiveSubscriptionQuota'), 'access 확인 단계에서 구독을 참조하면 구독이 접근권을 만들어주는 셈이 되어 §7/§31 위반');
});

test('B2: 구독 quota는 access가 전부 확인된 이후에만 참조된다', async () => {
  const source = await readFile('./apps/api/src/services/entitlement-authorization-service.mjs', 'utf-8');
  const accessLoopIndex = source.indexOf('for (const analysisType of requiredAnalysisTypes)');
  const subscriptionIndex = source.indexOf('findActiveSubscriptionQuota(userId, subscriptionGroup)');
  assert.ok(accessLoopIndex > -1 && subscriptionIndex > accessLoopIndex, 'access 확인이 구독 조회보다 먼저 실행되어야 함');
});

test('B3: RELATIONSHIP_DETAIL은 어떤 구독 그룹에도 속하지 않는다(궁합은 명리/아이시그널 구독과 완전 분리)', async () => {
  const source = await readFile('./apps/api/src/services/entitlement-authorization-service.mjs', 'utf-8');
  const mapSection = source.slice(source.indexOf('SUBSCRIPTION_GROUP_FOR_ANALYSIS_TYPE = {'), source.indexOf('};') + 2);
  assert.ok(!mapSection.includes('RELATIONSHIP_DETAIL'));
});

// ============================================================
// C. 복합 질문 판정 로직(§12~15)
// ============================================================

test('C1: fortune_year 대화에서 annual_periods/major_periods 외의 일반 필드가 필요하면 SAJU_DETAIL도 추가로 요구한다(복합 질문)', async () => {
  const source = await readFile('./apps/api/src/services/entitlement-authorization-service.mjs', 'utf-8');
  assert.ok(source.includes("f !== 'annual_periods' && f !== 'major_periods'"));
  assert.ok(source.includes('requiredAnalysisTypes.push(ANALYSIS_TYPES.SAJU_DETAIL)'));
});

test('C2: 복합 질문 판정에 새로운 LLM 호출이 추가되지 않았다(기존 routerResult.saju_fields만 재사용)', async () => {
  const source = await readFile('./apps/api/src/services/entitlement-authorization-service.mjs', 'utf-8');
  assert.ok(!source.includes('.complete('), 'authorization 서비스 자체는 LLM을 직접 호출하면 안 됨');
});

// ============================================================
// D. 실제 LLM 호출 횟수 실측
// ============================================================

test('D1: 복합 질문(YEARLY_FORTUNE+SAJU_DETAIL 필요) 상황에서도 Router는 1회만 호출되고 분석 호출에는 도달하지 않는다', async () => {
  const chart = await makeChart();
  const conversation = await startConversation({ chartId: chart.id, characterId: 'daegu', fortuneYear: 2027 });
  const { provider, getCallCount } = makeCountingProvider();

  await assert.rejects(
    () => handleFreeTextMessage({
      conversationId: conversation.id,
      text: '내 사주 흐름과 2027년 신년운세를 같이 보고 이직 여부를 알려줘',
      aiProvider: provider,
      model: 'mock',
      userId: 'test-user-no-entitlement',
    }),
    /DATABASE_URL/
  );
  assert.equal(getCallCount(), 1, '복합 질문이어도 Router 1회 이후 분석 호출 전에 access 확인 단계에서 막혀야 함');
});

// ============================================================
// E. ZIWEI_DETAIL 분리 보류 사실 문서화
// ============================================================

test('E1: ZIWEI_DETAIL 단독 판매 상품이 아직 없다(사실 확인 — 분리 보류의 근거)', async () => {
  const products = await readFile('./migrations/005_seed_products_final_policy.sql', 'utf-8');
  let products2 = '';
  try {
    products2 = await readFile('./migrations/008_yearly_fortune_products.sql', 'utf-8');
  } catch {}
  assert.ok(!products.includes('ZIWEI_DETAIL') && !products2.includes('ZIWEI_DETAIL'));
});
