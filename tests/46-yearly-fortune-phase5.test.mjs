// tests/46-yearly-fortune-phase5.test.mjs
//
// Phase 5 — 신년운세(YEARLY_FORTUNE). 이 환경엔 실제 Supabase Postgres가 없으므로, 실제 entitlement
// 보유/조회가 필요한 시나리오(§28의 3/4/5/6/7/9/11~19)는 이 파일로 완전히 검증할 수 없다 — 로컬
// 실제 DB 필요(최종 보고서에 명시). 여기서는 이 환경에서 실제로 실행 가능한 것만 검증한다:
// (1) 실제 MockAIProvider spy로 LLM 호출 횟수 측정, (2) 마이그레이션/시드 안전성, (3) 소스 레벨
// 정책 확인(tier 분리, 클라이언트 fortuneYear 미신뢰, 대상별 컬럼 분리).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { rm, readFile } from 'node:fs/promises';

import { ANALYSIS_TYPES, VALID_ANALYSIS_TYPES } from '../packages/shared/analysis-types.mjs';
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
// A. 상품/canonical type
// ============================================================

test('A1: YEARLY_FORTUNE은 canonical type 하나로 통일되어 있다(BASIC/DETAIL을 타입으로 나누지 않음)', () => {
  assert.equal(ANALYSIS_TYPES.YEARLY_FORTUNE, 'YEARLY_FORTUNE');
  assert.ok(!VALID_ANALYSIS_TYPES.includes('YEARLY_FORTUNE_BASIC'));
  assert.ok(!VALID_ANALYSIS_TYPES.includes('YEARLY_FORTUNE_DETAIL'));
  assert.ok(!VALID_ANALYSIS_TYPES.includes('CHILD_YEARLY_FORTUNE'), '금지된 별도 타입이 생성되지 않아야 함');
});

test('A2: 신년운세 상품 시드에 990원/4900원 두 상품이 같은 analysis_type=YEARLY_FORTUNE을 쓴다', async () => {
  const sql = await readFile('./migrations/008_yearly_fortune_products.sql', 'utf-8');
  assert.ok(sql.includes("'YEARLY_FORTUNE_BASIC'") && sql.includes('990'));
  assert.ok(sql.includes("'YEARLY_FORTUNE_CHAT'") && sql.includes('4900'));
  const matches = sql.match(/'YEARLY_FORTUNE'/g) ?? [];
  assert.equal(matches.length, 2, '두 상품 모두 analysis_type=YEARLY_FORTUNE을 참조해야 함');
});

test('A3: 두 상품은 서로 다른 model_tier를 갖는다(990=basic, 4900=detail — 이 구분이 채팅권 유무를 가른다)', async () => {
  const sql = await readFile('./migrations/008_yearly_fortune_products.sql', 'utf-8');
  const basicLine = sql.split('\n').find((l) => l.includes("'YEARLY_FORTUNE_BASIC'"));
  const chatLine = sql.split('\n').find((l) => l.includes("'YEARLY_FORTUNE_CHAT'"));
  assert.ok(basicLine.includes("'basic'"));
  assert.ok(chatLine.includes("'detail'"));
});

// ============================================================
// B. 정밀 조회 함수 — tier + 대상 + 연도 전부 확인하는지 소스 레벨 확인
// ============================================================

test('B1: findActiveYearlyFortuneChatEntitlement이 반드시 tier=detail로 필터링한다(990원이 채팅권을 잘못 부여하지 않도록)', async () => {
  const source = await readFile('./apps/api/src/repositories/payment-repository.mjs', 'utf-8');
  const fnSection = source.slice(source.indexOf('export async function findActiveYearlyFortuneChatEntitlement'));
  assert.ok(fnSection.includes("p.tier = 'detail'"));
  assert.ok(fnSection.includes('s.fortune_year = $2'), '연도가 정확히 일치해야 함(2027 entitlement로 2028 허용 금지)');
  assert.ok(fnSection.includes('s.chart_id = $3') && fnSection.includes('s.child_profile_id = $4'), '본인/자녀 대상이 정확히 일치해야 함');
});

// ============================================================
// C. authorization이 conversation-scoped fortune_year로 도메인을 결정하는지(질문 텍스트 아님)
// ============================================================

test('C1: authorizeAnalysisQuestion은 conversationContext.fortuneYear가 있으면 YEARLY_FORTUNE을 requiredAnalysisTypes에 추가한다(Router category와 무관하게 항상)', async () => {
  const source = await readFile('./apps/api/src/services/entitlement-authorization-service.mjs', 'utf-8');
  assert.ok(source.includes('requiredAnalysisTypes.push(ANALYSIS_TYPES.YEARLY_FORTUNE)'));
  assert.ok(source.includes('findActiveYearlyFortuneChatEntitlement'), 'YEARLY_FORTUNE access 확인에 전용 정밀 조회 함수를 써야 함');
});

test('C2: fortuneYear가 없는(기존) 대화는 완전히 기존 동작(SAJU_DETAIL 매핑)을 그대로 탄다', async () => {
  const source = await readFile('./apps/api/src/services/entitlement-authorization-service.mjs', 'utf-8');
  assert.ok(source.includes('mapRouterCategoriesToAnalysisTypes(routerResult)'), '기존 사주 채팅 경로가 그대로 남아있어야 함');
});

// ============================================================
// D. 클라이언트 신뢰 금지(§33) — fortuneYear는 conversation 레코드에서만 옴
// ============================================================

test('D1: authorization에 전달되는 fortuneYear는 conversation.fortune_year에서만 온다(요청 body가 아님)', async () => {
  const source = await readFile('./apps/api/src/services/conversation-service.mjs', 'utf-8');
  const matches = source.match(/conversationContext: \{ fortuneYear: conversation\.fortune_year/g) ?? [];
  assert.equal(matches.length, 2, 'handleFreeTextMessage/pickCatalogChoice 양쪽 다 conversation 레코드 값만 써야 함');
});

test('D2: 주문 생성 시 클라이언트의 fortuneYear는 범위 검증만 거치고(2020~2100), 그 자체가 권한을 부여하지 않는다', async () => {
  const source = await readFile('./apps/api/src/routes/orders.mjs', 'utf-8');
  assert.ok(source.includes('fortuneYear < 2020 || fortuneYear > 2100'));
});

// ============================================================
// E. 실제 LLM 호출 횟수 실측 — fortune_year 불일치 시 분석 호출 0회
// ============================================================

test('E1: fortune_year가 태깅된 대화에서 YEARLY_FORTUNE 조회 시도 자체는 실제로 일어난다(이 환경엔 DB가 없어 DATABASE_URL 에러로 확인 — 가짜로 통과 안 시킴). Router는 그 전에 정확히 1회 호출된다', async () => {
  const chart = await makeChart();
  const conversation = await startConversation({ chartId: chart.id, characterId: 'daegu', fortuneYear: 2027 });
  const { provider, getCallCount } = makeCountingProvider();

  await assert.rejects(
    () => handleFreeTextMessage({
      conversationId: conversation.id,
      text: '올해 재물운 어때',
      aiProvider: provider,
      model: 'mock',
      userId: 'test-user-no-entitlement',
    }),
    /DATABASE_URL/
  );
  // Router(1회)까지는 정상 실행됐고, 그 이후 authorization 단계(더 비싼 분석 호출 이전)에서
  // 실패했다는 것을 호출 횟수로 확인한다 — 분석 호출까지 도달하지 않았다는 뜻.
  assert.equal(getCallCount(), 1, 'Router만 호출되고, 분석 호출(2번째 .complete())에는 도달하지 않아야 함');
});

test('E2: fortune_year 태그가 없는 일반 사주 대화는 기존과 동일하게 동작한다(회귀 없음)', async () => {
  const chart = await makeChart();
  const conversation = await startConversation({ chartId: chart.id, characterId: 'daegu' });
  const { provider, getCallCount } = makeCountingProvider();

  const result = await handleFreeTextMessage({
    conversationId: conversation.id,
    text: '내 대운이 궁금해',
    aiProvider: provider,
    model: 'mock',
    userId: null,
  });

  assert.equal(result.intent, 'saju_question');
  assert.ok(result.response.includes('로그인'), '기존과 동일하게 로그인 안내를 받아야 함(신년운세 안내 아님)');
  assert.equal(getCallCount(), 1);
});
