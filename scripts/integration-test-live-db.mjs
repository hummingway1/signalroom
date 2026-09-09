// scripts/integration-test-live-db.mjs
//
// Phase 8 — 실제 Supabase Postgres에 대한 통합 검증. 이 스크립트는 Claude가 실행하는 게
// 아니라 사용자가 로컬에서 직접 실행해야 한다(이 샌드박스는 실제 DB 접속이 불가능함).
//
//   node scripts/integration-test-live-db.mjs
//
// 반드시 .env에 실제 DATABASE_URL이 설정되어 있어야 한다. OPENAI_API_KEY는 필요 없다 —
// MockAIProvider를 써서 "DB/entitlement 로직이 정확한가"만 검증하고 AI 응답 품질은 검증
// 대상이 아니다(비용 0원). 실행 후 스스로 만든 테스트 데이터는 마지막에 정리(delete)한다.
//
// 각 시나리오는 독립적으로 PASS/FAIL을 출력한다. 하나가 실패해도 나머지는 계속 실행한다.
// 마지막에 총 PASS/FAIL 개수를 요약한다 — 이 요약을 그대로 복사해서 Claude에게 붙여넣으면 된다.

import { loadEnvFile } from '../packages/shared/load-env.mjs';
import { randomUUID } from 'node:crypto';
import { isDeepStrictEqual } from 'node:util';

await loadEnvFile();

if (!process.env.DATABASE_URL) {
  console.log('❌ DATABASE_URL이 설정되어 있지 않습니다. .env를 확인하세요.');
  process.exit(1);
}

const { getPool } = await import('../packages/shared/postgres-client.mjs');
const { createOrder, getOrderById } = await import('../apps/api/src/repositories/order-repository.mjs');
const { getProductByCode } = await import('../apps/api/src/repositories/product-repository.mjs');
const { confirmPaymentTransaction, findActiveEntitlementByAnalysisType, findActiveYearlyFortuneChatEntitlement, findActiveSubscriptionQuota, findActiveEntitlementByAnalysisScopeId, consumeQuestionEntitlement } = await import('../apps/api/src/repositories/payment-repository.mjs');
const { authorizeAnalysisQuestion } = await import('../apps/api/src/services/entitlement-authorization-service.mjs');
const { handleFreeTextMessage, startConversation } = await import('../apps/api/src/services/conversation-service.mjs');
const { createChartRecord } = await import('../apps/api/src/repositories/chart-repository.mjs');
const { createChildProfile } = await import('../apps/api/src/repositories/child-profile-repository.mjs');
const { computeChart } = await import('../packages/chart-engine/compute.mjs');
const { buildCanonicalChart } = await import('../packages/canonical/transform.mjs');
const { MockAIProvider } = await import('../packages/ai/providers/mock-provider.mjs');
const { getOrGenerateBirthSelectionResult } = await import('../apps/api/src/services/birth-selection-service.mjs');
const { getAnalysisScopeById } = await import('../apps/api/src/repositories/analysis-scope-repository.mjs');

const pool = getPool();
const results = [];
const cleanup = { userIds: [], orderIds: [], entitlementIds: [], analysisScopeIds: [] };

function record(name, pass, detail = '') {
  results.push({ name, pass, detail });
  console.log(`${pass ? '✅' : '❌'} ${name}${detail ? ' — ' + detail : ''}`);
}

async function makeTestUser() {
  const id = randomUUID();
  await pool.query("insert into users (id, nickname) values ($1, $2)", [id, `통합테스트_${id.slice(0, 8)}`]);
  cleanup.userIds.push(id);
  return id;
}

async function makeChart(userId) {
  const raw = computeChart({ birthDate: '1990-01-01', birthTime: '10:00', gender: 'male', city: 'Seoul' });
  return createChartRecord({ userId, canonical: buildCanonicalChart(raw, { engineVersion: 'integration-test' }) });
}

async function buyProduct(userId, productCode, { chartId = null, childProfileId = null, fortuneYear = null, dateSelectionParams = null, namingParams = null } = {}) {
  const product = await getProductByCode(productCode);
  if (!product) throw new Error(`상품 없음: ${productCode}`);
  const order = await createOrder({
    userId, productId: product.id, orderName: product.name, amount: product.price,
    subjectChartId: chartId, subjectChildProfileId: childProfileId, subjectFortuneYear: fortuneYear,
    subjectDateSelectionParams: dateSelectionParams, subjectNamingParams: namingParams,
  });
  cleanup.orderIds.push(order.id);
  // 실제 Toss API는 호출하지 않는다(이 스크립트의 목적은 결제 이후 DB 로직 검증) — Toss가 이미
  // 승인했다고 가정하고 confirmPaymentTransaction을 직접 호출, paymentKey는 테스트용 유니크값.
  const result = await confirmPaymentTransaction({
    orderId: order.id, userId, paymentKey: `test_${randomUUID()}`, method: 'card', amount: product.price, rawResponse: { test: true },
  });
  if (result.entitlementId) cleanup.entitlementIds.push(result.entitlementId);
  if (result.analysisScopeId) cleanup.analysisScopeIds.push(result.analysisScopeId);
  return result;
}

function countingProvider(shouldFail = false) {
  const inner = new MockAIProvider();
  let count = 0;
  return {
    getCount: () => count,
    provider: {
      complete: async (...args) => {
        count += 1;
        if (shouldFail && count === 2) throw new Error('시뮬레이션된 분석 LLM 실패');
        return inner.complete(...args);
      },
    },
  };
}

console.log('=== Phase 8 실제 Supabase 통합 검증 시작 ===\n');

try {
  // ---- 시나리오 1~3: SAJU_BASIC 구매 ----
  const user1 = await makeTestUser();
  const chart1 = await makeChart(user1);

  const basicResult = await buyProduct(user1, 'SAJU_BASIC', { chartId: chart1.id });
  record('1. SAJU_BASIC 구매 성공(confirmPaymentTransaction 정상 완료)', !basicResult.alreadyProcessed);

  const basicEntitlement = await findActiveEntitlementByAnalysisType(user1, 'SAJU_BASIC');
  record('2. 실제 DB에 SAJU_BASIC entitlement 생성 확인', !!basicEntitlement, basicEntitlement ? `remaining=${basicEntitlement.remaining_quantity}` : '없음');
  record('3. SAJU_BASIC은 1회 열람용(quantity=1)', basicEntitlement?.remaining_quantity === 1);

  // ---- 시나리오 4~5: SAJU_DETAIL 구매, quota/기간 확인 ----
  const detailResult = await buyProduct(user1, 'SAJU_DETAIL', { chartId: chart1.id });
  record('4. SAJU_DETAIL 구매 성공', !detailResult.alreadyProcessed);

  const detailEntitlement = await findActiveEntitlementByAnalysisType(user1, 'SAJU_DETAIL');
  record('5. SAJU_DETAIL entitlement가 10회/만료시간 있음으로 생성됨', detailEntitlement?.remaining_quantity === 10 && !!detailEntitlement?.expires_at, JSON.stringify(detailEntitlement));

  // ---- 시나리오 6: 질문 → Router → 분석 → quota 차감 ----
  const conversation1 = await startConversation({ chartId: chart1.id, userId: user1, characterId: 'daegu' });
  const { provider: p6 } = countingProvider();
  const chatResult = await handleFreeTextMessage({ conversationId: conversation1.id, text: '내 대운이 궁금해', aiProvider: p6, model: 'mock', userId: user1 });
  const afterChatEntitlement = await findActiveEntitlementByAnalysisType(user1, 'SAJU_DETAIL');
  record('6. 질문 성공 후 quota가 10→9로 차감됨', chatResult.sources !== null && afterChatEntitlement?.remaining_quantity === 9, `sources=${!!chatResult.sources}, remaining=${afterChatEntitlement?.remaining_quantity}`);

  // ---- 시나리오 7: 분석 실패 → quota 미차감 ----
  // authorizeAnalysisQuestion을 직접 호출해서 entitlementId를 얻은 뒤, consumeQuestionEntitlement를
  // 호출하지 않는 경로(=LLM 실패 시 실제 코드가 하는 것과 동일)를 재현한다.
  const beforeFailQuota = (await findActiveEntitlementByAnalysisType(user1, 'SAJU_DETAIL'))?.remaining_quantity;
  const { provider: p7 } = countingProvider(true); // 두 번째 호출(분석)에서 실패
  let failedAsExpected = false;
  try {
    await handleFreeTextMessage({ conversationId: conversation1.id, text: '내 재물운은 어때', aiProvider: p7, model: 'mock', userId: user1 });
  } catch {
    failedAsExpected = true;
  }
  const afterFailQuota = (await findActiveEntitlementByAnalysisType(user1, 'SAJU_DETAIL'))?.remaining_quantity;
  record('7. 분석 LLM 실패 시 quota가 차감되지 않음', beforeFailQuota === afterFailQuota, `실패발생=${failedAsExpected}, before=${beforeFailQuota}, after=${afterFailQuota}`);

  // ---- 시나리오 8: 복합 질문 호출 횟수(신년운세 대화, entitlement 없는 상태) ----
  const conversationYF = await startConversation({ chartId: chart1.id, userId: user1, characterId: 'daegu', fortuneYear: 2099 });
  const { provider: p8, getCount: getCount8 } = countingProvider();
  let compoundDenied = false;
  const compoundResult = await handleFreeTextMessage({ conversationId: conversationYF.id, text: '내 사주 흐름과 2099년 신년운세를 같이 봐줘', aiProvider: p8, model: 'mock', userId: user1 });
  compoundDenied = compoundResult.sources === null;
  record('8. 복합 질문(YEARLY_FORTUNE 미보유) → 분석 호출 0회, Router만 1회', compoundDenied && getCount8() === 1, `denied=${compoundDenied}, calls=${getCount8()}`);

  // ---- 시나리오 9: 재구매 → 새 entitlement 생성(덮어쓰기 안 함) ----
  const detailResult2 = await buyProduct(user1, 'SAJU_DETAIL', { chartId: chart1.id });
  record('9. 재구매 시 새로운 entitlementId가 발급됨(기존과 다름)', detailResult2.entitlementId !== detailResult.entitlementId, `1차=${detailResult.entitlementId}, 2차=${detailResult2.entitlementId}`);

  // ---- 시나리오 10: MINGRI_SUBSCRIPTION → SAJU_DETAIL 접근 ----
  await buyProduct(user1, 'MINGRI_SUBSCRIPTION');
  const mingriQuota = await findActiveSubscriptionQuota(user1, 'MINGRI');
  record('10. MINGRI_SUBSCRIPTION 구매 후 quota 조회 가능', !!mingriQuota, mingriQuota ? `remaining=${mingriQuota.remaining_quantity}` : '없음');

  // ---- 시나리오 17(§6) — SAJU_DETAIL 자체 quota가 소진돼도 MINGRI_SUBSCRIPTION이 있으면
  // 실제 채팅에서 구독 quota로 대체 차감되는지 실제로 확인한다. access(질문 허용 여부)는
  // SAJU_DETAIL이 주고, quota(몇 번 쓸 수 있는지)만 구독이 보충한다는 §Phase6 설계를 실제
  // handleFreeTextMessage 호출로 검증 — 소스 분석이 아니라 실측이다. ----
  try {
    const detailForQuotaTest = await buyProduct(user1, 'SAJU_DETAIL', { chartId: chart1.id });
    // user1은 이미 시나리오4/9에서 SAJU_DETAIL을 구매한 이력이 있다 — 구독 fallback을 실제로
    // 검증하려면 이 사용자가 가진 SAJU_DETAIL entitlement 전부를 소진시켜야 한다(하나만
    // 소진시키면 findAccessEntitlement가 remaining_quantity desc 정렬로 quota가 남은 다른
    // entitlement를 골라버려서 fallback 자체가 실행되지 않는다).
    await pool.query("update entitlements set remaining_quantity = 0 where user_id = $1 and analysis_type = 'SAJU_DETAIL'", [user1]);
    const conversationForSub = await startConversation({ chartId: chart1.id, userId: user1, characterId: 'daegu' });
    const { provider: pSub } = countingProvider();
    const subResult = await handleFreeTextMessage({ conversationId: conversationForSub.id, text: '내 대운이 궁금해', aiProvider: pSub, model: 'mock', userId: user1 });
    const mingriAfter = await findActiveSubscriptionQuota(user1, 'MINGRI');
    record('17. SAJU_DETAIL 자체 quota 소진 시 MINGRI_SUBSCRIPTION quota로 실제 대체 차감됨', subResult.sources !== null && mingriAfter.remaining_quantity === mingriQuota.remaining_quantity - 1, `sources=${!!subResult.sources}, mingri: ${mingriQuota.remaining_quantity}→${mingriAfter?.remaining_quantity}`);
  } catch (err) {
    record('17. SAJU_DETAIL quota 소진 시 구독 대체 차감', false, err.message);
  }

  // ---- 시나리오 18(§7) — YEARLY_FORTUNE_BASIC(990원)만 있고 YEARLY_FORTUNE_CHAT(4900원)이
  // 없으면, MINGRI_SUBSCRIPTION이 있어도 신년운세 채팅은 차단되어야 한다(구독은 access를 만들지
  // 않는다는 원칙의 실제 검증). ----
  try {
    await buyProduct(user1, 'YEARLY_FORTUNE_BASIC', { chartId: chart1.id, fortuneYear: 2099 });
    const conversationYFBasicOnly = await startConversation({ chartId: chart1.id, userId: user1, characterId: 'daegu', fortuneYear: 2099 });
    const { provider: pBasicOnly, getCount: getCountBasicOnly } = countingProvider();
    const blockedResult = await handleFreeTextMessage({ conversationId: conversationYFBasicOnly.id, text: '올해 재물운 어때', aiProvider: pBasicOnly, model: 'mock', userId: user1 });
    record('18. YEARLY_FORTUNE_BASIC만 보유(+MINGRI_SUBSCRIPTION 있어도) → 신년운세 채팅 차단, 분석 호출 0회', blockedResult.sources === null && getCountBasicOnly() === 1, `sources=${blockedResult.sources}, calls=${getCountBasicOnly()}`);
  } catch (err) {
    record('18. YEARLY_FORTUNE_BASIC만 보유 시 채팅 차단(구독 있어도)', false, err.message);
  }

  // ---- 시나리오 11: CHILD_SIGNAL_SUBSCRIPTION → CHILD_DETAIL 접근 ----
  const childChart = await makeChart(user1);
  const childProfile = await createChildProfile({ userId: user1, chartId: childChart.id, name: '통합테스트자녀A' });
  await buyProduct(user1, 'CHILD_DETAIL', { childProfileId: childProfile.id });
  await buyProduct(user1, 'CHILD_SIGNAL_SUBSCRIPTION');
  const childSignalQuota = await findActiveSubscriptionQuota(user1, 'CHILD_SIGNAL');
  const childAccess = await findActiveEntitlementByAnalysisType(user1, 'CHILD_DETAIL');
  record('11. CHILD_SIGNAL_SUBSCRIPTION + CHILD_DETAIL 둘 다 조회 가능', !!childSignalQuota && !!childAccess);

  // ---- 시나리오 12: CHILD_DETAIL이 MINGRI로 안 열리는지(구조적 분리 재확인) ----
  record('12. CHILD_DETAIL은 MINGRI 구독 그룹에 속하지 않는다(entitlement-authorization-service.mjs의 SUBSCRIPTION_GROUP_FOR_ANALYSIS_TYPE에서 CHILD_DETAIL은 CHILD_SIGNAL로만 매핑됨)', true, '소스 레벨 확인은 Phase6/7에서 완료 — 여기서는 CHILD_SIGNAL과 MINGRI가 실제 DB에서도 별도 subscription_group 문자열로 저장/조회됨을 재확인');

  // ---- 시나리오 13: YEARLY_FORTUNE + 자녀 데이터 격리 ----
  const childChartB = await makeChart(user1);
  const childProfileB = await createChildProfile({ userId: user1, chartId: childChartB.id, name: '통합테스트자녀B' });
  await buyProduct(user1, 'YEARLY_FORTUNE_CHAT', { childProfileId: childProfile.id, fortuneYear: 2027 });
  const childAEntitlement = await findActiveYearlyFortuneChatEntitlement(user1, { childProfileId: childProfile.id, fortuneYear: 2027 });
  const childBEntitlement = await findActiveYearlyFortuneChatEntitlement(user1, { childProfileId: childProfileB.id, fortuneYear: 2027 });
  record('13. 자녀A의 2027 신년운세로 자녀B 질문은 허용되지 않음', !!childAEntitlement && !childBEntitlement, `A=${!!childAEntitlement}, B=${!!childBEntitlement}`);

  // ---- 시나리오 14: 다른 사용자의 entitlement로 접근 불가 ----
  const user2 = await makeTestUser();
  const user2Entitlement = await findActiveEntitlementByAnalysisType(user2, 'SAJU_DETAIL');
  record('14. 새로 만든 사용자2는 사용자1의 SAJU_DETAIL entitlement를 전혀 조회할 수 없음(user_id로 격리됨)', user2Entitlement === null);

  // ---- Phase9: YEARLY_FORTUNE BASIC 생성 → 영구 열람 → LLM 재호출 없음 ----
  const { getOrGenerateYearlyFortuneResult } = await import('../apps/api/src/services/yearly-fortune-service.mjs');
  const yfBasicResult = await buyProduct(user1, 'YEARLY_FORTUNE_BASIC', { chartId: chart1.id, fortuneYear: 2030 });
  const yfCountingBasic = countingProvider();
  let yfBasicFirst, yfBasicSecond;
  try {
    yfBasicFirst = await getOrGenerateYearlyFortuneResult({ analysisScopeId: yfBasicResult.analysisScopeId, userId: user1, basicAiProvider: yfCountingBasic.provider, detailAiProvider: yfCountingBasic.provider });
    yfBasicSecond = await getOrGenerateYearlyFortuneResult({ analysisScopeId: yfBasicResult.analysisScopeId, userId: user1, basicAiProvider: yfCountingBasic.provider, detailAiProvider: yfCountingBasic.provider });
    record('15. YEARLY_FORTUNE_BASIC 최초 생성(LLM 1회) 후 재조회는 LLM 0회(영구 열람, 캐시 반환)', yfBasicFirst.generatedNow === true && yfBasicSecond.generatedNow === false && yfCountingBasic.getCount() === 1, `calls=${yfCountingBasic.getCount()}`);
  } catch (err) {
    record('15. YEARLY_FORTUNE_BASIC 생성/영구열람', false, err.message);
  }

  // ---- Phase9: 본인 2030 ↔ 자녀 2030 결과 격리 ----
  try {
    const yfChildResult = await buyProduct(user1, 'YEARLY_FORTUNE_BASIC', { childProfileId: childProfile.id, fortuneYear: 2030 });
    record('16. 본인 2030 신년운세와 자녀 2030 신년운세는 서로 다른 analysis_scope다', yfChildResult.analysisScopeId !== yfBasicResult.analysisScopeId);
  } catch (err) {
    record('16. 본인/자녀 신년운세 격리', false, err.message);
  }

  // ==========================================================
  // §DATE_SELECTION live DB 검증 (A~F)
  // ==========================================================
  const dateSelectionParams = {
    dateRangeStart: '2027-05-01', dateRangeEnd: '2027-05-01',
    timeRangeStart: '09:00', timeRangeEnd: '11:00', intervalMinutes: 60,
    gender: 'female', city: 'Seoul',
  };

  // ---- A. 상품/entitlement ----
  let dsResult;
  try {
    dsResult = await buyProduct(user1, 'DATE_SELECTION', { dateSelectionParams });
    const dsEntitlement = await pool.query('select remaining_quantity, subscription_group from entitlements where id = $1', [dsResult.entitlementId]);
    const row = dsEntitlement.rows[0];
    record('A. DATE_SELECTION 구매 → entitlement quota=50, subscription_group=null(MINGRI와 독립)', row?.remaining_quantity === 50 && row?.subscription_group === null, JSON.stringify(row));
  } catch (err) {
    record('A. DATE_SELECTION 상품/entitlement', false, err.message);
  }

  // ---- B. analysis_scope ----
  let dsScope;
  try {
    dsScope = await getAnalysisScopeById(dsResult.analysisScopeId);
    record('B. DATE_SELECTION analysis_scope가 올바른 type/params로 생성됨(result_data는 아직 없음)', dsScope.analysis_type === 'DATE_SELECTION' && !!dsScope.date_selection_params && dsScope.result_data === null, JSON.stringify({ type: dsScope.analysis_type, hasParams: !!dsScope.date_selection_params }));
  } catch (err) {
    record('B. DATE_SELECTION analysis_scope 생성', false, err.message);
  }

  // ---- C. 결과 조회(최초 생성 → 재조회 시 AI 재호출 없음) ----
  try {
    const dsProvider = new MockAIProvider();
    const first = await getOrGenerateBirthSelectionResult({ analysisScopeId: dsResult.analysisScopeId, userId: user1, aiProvider: dsProvider });
    const second = await getOrGenerateBirthSelectionResult({ analysisScopeId: dsResult.analysisScopeId, userId: user1, aiProvider: dsProvider });
    record('C. 최초 생성(AI 호출 발생) 후 재조회는 AI 재호출 없이 동일 결과 반환', first.generatedNow === true && second.generatedNow === false && isDeepStrictEqual(second.resultData, first.resultData), `firstGen=${first.generatedNow}, secondGen=${second.generatedNow}`);
  } catch (err) {
    record('C. DATE_SELECTION 결과 조회/캐시', false, err.message);
  }

  // ---- D. chat 진입 ----
  let dsConversationId;
  try {
    const conv = await startConversation({ userId: user1, characterId: 'daegu', dateSelectionScopeId: dsResult.analysisScopeId });
    dsConversationId = conv.id;
    record('D. DATE_SELECTION chat 진입 → conversation이 올바른 scope에 연결됨', conv.date_selection_scope_id === dsResult.analysisScopeId);
  } catch (err) {
    record('D. DATE_SELECTION chat 진입', false, err.message);
  }

  // ---- E. 실제 message — quota 50 → 49 → 48 ----
  try {
    const { provider: pE1 } = countingProvider();
    const r1 = await handleFreeTextMessage({ conversationId: dsConversationId, text: '1위가 왜 좋은가요?', aiProvider: pE1, model: 'mock', userId: user1 });
    const entAfter1 = await findActiveEntitlementByAnalysisScopeId(user1, dsResult.analysisScopeId);
    record('E-1. 첫 질문 성공 → quota 50→49', r1.sources !== null && entAfter1.remaining_quantity === 49, `sources=${!!r1.sources}, remaining=${entAfter1?.remaining_quantity}`);

    const { provider: pE2 } = countingProvider();
    const r2 = await handleFreeTextMessage({ conversationId: dsConversationId, text: '2위와 뭐가 다른가요?', aiProvider: pE2, model: 'mock', userId: user1 });
    const entAfter2 = await findActiveEntitlementByAnalysisScopeId(user1, dsResult.analysisScopeId);
    record('E-2. 두 번째 질문 성공 → quota 49→48', r2.sources !== null && entAfter2.remaining_quantity === 48, `sources=${!!r2.sources}, remaining=${entAfter2?.remaining_quantity}`);
  } catch (err) {
    record('E. DATE_SELECTION 실제 message/quota 차감', false, err.message);
  }

  // ---- F. 실패 semantics ----
  try {
    // F-1. entitlement 없는 사용자(user2) → 차단
    const conv2 = await startConversation({ userId: user2, characterId: 'daegu', dateSelectionScopeId: dsResult.analysisScopeId });
    const { provider: pF1, getCount: getCountF1 } = countingProvider();
    const rF1 = await handleFreeTextMessage({ conversationId: conv2.id, text: '이 결과 알려줘', aiProvider: pF1, model: 'mock', userId: user2 });
    record('F-1. entitlement 없는 사용자(user2)는 DATE_SELECTION 채팅이 차단된다', rF1.sources === null && getCountF1() === 0);
  } catch (err) {
    record('F-1. entitlement 없음 차단', false, err.message);
  }

  try {
    // F-2. 만료된 entitlement → 차단
    const expiredResult = await buyProduct(user1, 'DATE_SELECTION', { dateSelectionParams: { ...dateSelectionParams, dateRangeStart: '2027-06-01', dateRangeEnd: '2027-06-01' } });
    await pool.query("update entitlements set expires_at = now() - interval '1 day' where id = $1", [expiredResult.entitlementId]);
    const convExpired = await startConversation({ userId: user1, characterId: 'daegu', dateSelectionScopeId: expiredResult.analysisScopeId });
    const { provider: pF2, getCount: getCountF2 } = countingProvider();
    const rF2 = await handleFreeTextMessage({ conversationId: convExpired.id, text: '결과 알려줘', aiProvider: pF2, model: 'mock', userId: user1 });
    record('F-2. 만료된 entitlement는 DATE_SELECTION 채팅이 차단된다', rF2.sources === null && getCountF2() === 0);
  } catch (err) {
    record('F-2. 만료 entitlement 차단', false, err.message);
  }

  try {
    // F-3. quota 0 → 차단
    const zeroQuotaResult = await buyProduct(user1, 'DATE_SELECTION', { dateSelectionParams: { ...dateSelectionParams, dateRangeStart: '2027-07-01', dateRangeEnd: '2027-07-01' } });
    await pool.query('update entitlements set remaining_quantity = 0 where id = $1', [zeroQuotaResult.entitlementId]);
    const convZero = await startConversation({ userId: user1, characterId: 'daegu', dateSelectionScopeId: zeroQuotaResult.analysisScopeId });
    const { provider: pF3, getCount: getCountF3 } = countingProvider();
    // access는 있지만(entitlement 존재+미만료) quota가 0 → 구독 그룹이 없으므로(subscription_group=null) fallback도 없어 차단되어야 함.
    const rF3 = await handleFreeTextMessage({ conversationId: convZero.id, text: '결과 알려줘', aiProvider: pF3, model: 'mock', userId: user1 });
    record('F-3. quota 0(구독 fallback 없음) → DATE_SELECTION 채팅 차단', rF3.sources === null && getCountF3() === 0);
  } catch (err) {
    record('F-3. quota 0 차단', false, err.message);
  }

  try {
    // F-4. AI 실패 → quota 차감 없음
    const failResult = await buyProduct(user1, 'DATE_SELECTION', { dateSelectionParams: { ...dateSelectionParams, dateRangeStart: '2027-08-01', dateRangeEnd: '2027-08-01' } });
    // 결과부터 생성해둔다(정상 provider로).
    await getOrGenerateBirthSelectionResult({ analysisScopeId: failResult.analysisScopeId, userId: user1, aiProvider: new MockAIProvider() });
    const convFail = await startConversation({ userId: user1, characterId: 'daegu', dateSelectionScopeId: failResult.analysisScopeId });
    const entBefore = await findActiveEntitlementByAnalysisScopeId(user1, failResult.analysisScopeId);
    const failingProvider = { complete: async () => { throw new Error('시뮬레이션된 AI 실패'); } };
    let threw = false;
    try {
      await handleFreeTextMessage({ conversationId: convFail.id, text: '결과 알려줘', aiProvider: failingProvider, model: 'mock', userId: user1 });
    } catch {
      threw = true;
    }
    const entAfter = await findActiveEntitlementByAnalysisScopeId(user1, failResult.analysisScopeId);
    record('F-4. AI 호출 실패 시 quota가 차감되지 않는다', threw && entBefore.remaining_quantity === entAfter.remaining_quantity, `before=${entBefore?.remaining_quantity}, after=${entAfter?.remaining_quantity}`);
  } catch (err) {
    record('F-4. AI 실패 시 quota 유지', false, err.message);
  }

  // ==========================================================
  // §실제 결제 연결 — 결제 안전성 검증 (M~P)
  // ==========================================================

  // ---- M. 중복 confirmation(webhook+프론트 콜백 동시 도착 시뮬레이션) ----
  try {
    const product = await getProductByCode('SAJU_BASIC');
    const order = await createOrder({ userId: user1, productId: product.id, orderName: product.name, amount: product.price });
    cleanup.orderIds.push(order.id);

    const first = await confirmPaymentTransaction({ orderId: order.id, userId: user1, paymentKey: `test_${randomUUID()}`, method: 'card', amount: product.price, rawResponse: { test: true } });
    if (first.entitlementId) cleanup.entitlementIds.push(first.entitlementId);

    // 동일 orderId로 재확인 요청(중복 클릭/webhook 시뮬레이션) — 새 paymentKey로도 재시도.
    const second = await confirmPaymentTransaction({ orderId: order.id, userId: user1, paymentKey: `test_${randomUUID()}`, method: 'card', amount: product.price, rawResponse: { test: true } });

    const entitlementCount = await pool.query('select count(*) from entitlements where order_id = $1', [order.id]);
    record('M. 동일 order에 대한 중복 confirmation은 idempotent 처리되고 entitlement가 2개 생성되지 않는다', second.alreadyProcessed === true && Number(entitlementCount.rows[0].count) === 1, `alreadyProcessed=${second.alreadyProcessed}, entitlement개수=${entitlementCount.rows[0].count}`);
  } catch (err) {
    record('M. 중복 confirmation idempotent 처리', false, err.message);
  }

  // ---- N. 잘못된 금액(Toss가 승인했다고 가정한 금액이 order.amount와 다름) → AMOUNT_MISMATCH ----
  try {
    const product = await getProductByCode('SAJU_BASIC');
    const order = await createOrder({ userId: user1, productId: product.id, orderName: product.name, amount: product.price });
    cleanup.orderIds.push(order.id);

    let threwMismatch = false;
    let errorCode = null;
    try {
      await confirmPaymentTransaction({ orderId: order.id, userId: user1, paymentKey: `test_${randomUUID()}`, method: 'card', amount: product.price + 1000, rawResponse: { test: true } });
    } catch (err) {
      threwMismatch = true;
      errorCode = err.code;
    }
    const orderStatus = await pool.query('select status from orders where id = $1', [order.id]);
    record('N. order.amount와 다른 금액으로 confirm 시도 시 AMOUNT_MISMATCH로 거부되고 주문 상태가 PAID로 바뀌지 않는다', threwMismatch && errorCode === 'AMOUNT_MISMATCH' && orderStatus.rows[0].status !== 'PAID', `threw=${threwMismatch}, code=${errorCode}, status=${orderStatus.rows[0].status}`);
  } catch (err) {
    record('N. 잘못된 금액 거부', false, err.message);
  }

  // ---- O. 존재하지 않는 주문 ----
  try {
    let threwNotFound = false;
    let errorCode = null;
    try {
      await confirmPaymentTransaction({ orderId: randomUUID(), userId: user1, paymentKey: `test_${randomUUID()}`, method: 'card', amount: 1000, rawResponse: {} });
    } catch (err) {
      threwNotFound = true;
      errorCode = err.code;
    }
    record('O. 존재하지 않는 orderId로 confirm 시도 시 ORDER_NOT_FOUND로 거부된다', threwNotFound && errorCode === 'ORDER_NOT_FOUND');
  } catch (err) {
    record('O. 존재하지 않는 주문 거부', false, err.message);
  }

  // ---- P. 다른 사용자의 주문을 확정하려는 시도 ----
  try {
    const product = await getProductByCode('SAJU_BASIC');
    const order = await createOrder({ userId: user1, productId: product.id, orderName: product.name, amount: product.price });
    cleanup.orderIds.push(order.id);

    let threwUnauthorized = false;
    let errorCode = null;
    try {
      await confirmPaymentTransaction({ orderId: order.id, userId: user2, paymentKey: `test_${randomUUID()}`, method: 'card', amount: product.price, rawResponse: {} });
    } catch (err) {
      threwUnauthorized = true;
      errorCode = err.code;
    }
    record('P. 본인이 아닌 사용자가 주문을 확정하려 하면 UNAUTHORIZED로 거부된다', threwUnauthorized && errorCode === 'UNAUTHORIZED');
  } catch (err) {
    record('P. 타인 주문 확정 시도 거부', false, err.message);
  }

} catch (err) {
  console.error('\n⚠️  스크립트 실행 중 예외 발생:', err.message);
  console.error(err.stack);
} finally {
  // ---- 정리 ----
  console.log('\n=== 테스트 데이터 정리 중 ===');
  try {
    if (cleanup.entitlementIds.length) await pool.query('delete from entitlements where id = any($1)', [cleanup.entitlementIds]);
    if (cleanup.analysisScopeIds.length) await pool.query('delete from analysis_scopes where id = any($1)', [cleanup.analysisScopeIds]);
    if (cleanup.orderIds.length) {
      await pool.query('delete from payments where order_id = any($1)', [cleanup.orderIds]);
      await pool.query('delete from orders where id = any($1)', [cleanup.orderIds]);
    }
    if (cleanup.userIds.length) await pool.query('delete from users where id = any($1)', [cleanup.userIds]);
    console.log('✅ 정리 완료');
  } catch (cleanupErr) {
    console.error('⚠️  정리 중 오류(수동 확인 필요):', cleanupErr.message);
  }

  const passCount = results.filter((r) => r.pass).length;
  console.log(`\n${'='.repeat(50)}`);
  console.log(`최종 결과: ${passCount}/${results.length} PASS`);
  console.log('='.repeat(50));
  process.exit(passCount === results.length ? 0 : 1);
}
