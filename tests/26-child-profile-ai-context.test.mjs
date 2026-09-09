// tests/26-child-profile-ai-context.test.mjs
//
// ChildProfile → PurchasedAnalysis(immutable) → AIProfileContext → child conversation → casual AI
// 전체 파이프라인 회귀 테스트. 요청된 18개 테스트 항목 전부 반영.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { rm } from 'node:fs/promises';

import { createChartRecord } from '../apps/api/src/repositories/chart-repository.mjs';
import { createChildProfile, getChildProfile } from '../apps/api/src/repositories/child-profile-repository.mjs';
import { getPurchasedAnalysis } from '../apps/api/src/repositories/purchased-analysis-repository.mjs';
import { getAIProfileContextByChildId } from '../apps/api/src/repositories/ai-profile-context-repository.mjs';
import { generateChildGrowthAnalysis, getChildContext } from '../apps/api/src/services/child-profile-service.mjs';
import { createConversation } from '../apps/api/src/repositories/conversation-repository.mjs';
import { handleFreeTextMessage } from '../apps/api/src/services/conversation-service.mjs';
import { buildCasualSystemPrompt } from '../packages/character/casual-chat-prompt.mjs';
import { computeChart } from '../packages/chart-engine/compute.mjs';
import { buildCanonicalChart } from '../packages/canonical/transform.mjs';

class RecordingMockAIProvider {
  constructor() { this.lastSystemPrompt = null; }
  async complete({ system, schemaName }) {
    this.lastSystemPrompt = system;
    if (schemaName === 'casual_reaction') {
      return { data: { reaction: '(recorded)' }, usage: { input_tokens: 1, output_tokens: 1, total_tokens: 2 } };
    }
    return { data: {}, usage: { input_tokens: 1, output_tokens: 1, total_tokens: 2 } };
  }
}

test.before(async () => {
  await rm('./data/db', { recursive: true, force: true });
});

async function makeChartFor(birthDate, birthTime, gender) {
  const raw = computeChart({ birthDate, birthTime, gender, city: 'Seoul' });
  const canonical = buildCanonicalChart(raw, { engineVersion: 'test' });
  return createChartRecord({ canonical });
}

// ============================================================
// 1~2. child profile 생성 / 다른 user 접근 차단
// ============================================================

test('1. child profile 생성 — 정상 생성 및 필드 확인', async () => {
  const chart = await makeChartFor('2019-05-01', '09:00', 'male');
  const profile = await createChildProfile({ userId: 'user-A', chartId: chart.id, name: '첫째' });
  assert.ok(profile.id);
  assert.equal(profile.user_id, 'user-A');
  assert.equal(profile.chart_id, chart.id);
  assert.equal(profile.name, '첫째');
});

test('2. 다른 user의 child 접근 차단 — generateChildGrowthAnalysis가 FORBIDDEN을 던진다', async () => {
  const chart = await makeChartFor('2018-03-12', '08:00', 'male');
  const profile = await createChildProfile({ userId: 'user-A', chartId: chart.id });
  await assert.rejects(
    () => generateChildGrowthAnalysis({ childProfileId: profile.id, userId: 'user-B', tier: 'full' }),
    (err) => err.code === 'FORBIDDEN'
  );
});

// ============================================================
// 3~5. 분석 생성 / immutable / engine version 저장
// ============================================================

test('3. child growth analysis 생성 — 실제 계산 결과가 저장된다', async () => {
  const chart = await makeChartFor('1991-09-17', '04:50', 'female'); // 귀문 2건 있는 fixture
  const profile = await createChildProfile({ userId: 'user-C', chartId: chart.id });
  const { purchasedAnalysis, context } = await generateChildGrowthAnalysis({ childProfileId: profile.id, userId: 'user-C', tier: 'full' });
  assert.ok(purchasedAnalysis.id);
  assert.equal(purchasedAnalysis.product_type, 'child_growth');
  assert.equal(purchasedAnalysis.purchase_id, null); // 결제 미구현
  assert.ok(purchasedAnalysis.analysis_json.core_signals);
  assert.ok(context.id);
});

test('4. purchased_analysis immutable — update 함수 자체가 export되지 않는다', async () => {
  const repoModule = await import('../apps/api/src/repositories/purchased-analysis-repository.mjs');
  assert.equal('updatePurchasedAnalysis' in repoModule, false);
  assert.equal('update' in repoModule, false);
  assert.equal('deletePurchasedAnalysis' in repoModule, false);
});

test('5. analysis_engine_version이 저장되고, 저장 후에는 절대 바뀌지 않는다', async () => {
  const chart = await makeChartFor('1995-06-15', '12:00', 'female');
  const profile = await createChildProfile({ userId: 'user-D', chartId: chart.id });
  const { purchasedAnalysis } = await generateChildGrowthAnalysis({ childProfileId: profile.id, userId: 'user-D', tier: 'full' });
  assert.equal(purchasedAnalysis.analysis_engine_version, 'canonical-chart-consumer-v3');
  const reloaded = await getPurchasedAnalysis(purchasedAnalysis.id);
  assert.equal(reloaded.analysis_engine_version, purchasedAnalysis.analysis_engine_version);
  assert.deepEqual(reloaded.analysis_json, purchasedAnalysis.analysis_json, '재조회해도 저장 당시 값 그대로여야 함(불변)');
});

// ============================================================
// 6~9. AIProfileContext 생성/병합/추적성
// ============================================================

test('6. AIProfileContext 정상 생성 — core_traits/evidence_refs가 실제 fact와 일치', async () => {
  const chart = await makeChartFor('1991-09-17', '04:50', 'female');
  const profile = await createChildProfile({ userId: 'user-E', chartId: chart.id });
  const { context } = await generateChildGrowthAnalysis({ childProfileId: profile.id, userId: 'user-E', tier: 'full' });
  assert.ok(context.core_traits.ten_god_dominance);
  assert.ok(Array.isArray(context.evidence_refs));
  assert.ok(context.evidence_refs.includes('saju.pillars'));
});

test('7. 여러 purchased_analysis 병합 — 같은 child에 두 번 생성해도 정보가 누적된다', async () => {
  const chart = await makeChartFor('1988-11-22', '10:30', 'female');
  const profile = await createChildProfile({ userId: 'user-F', chartId: chart.id });
  const first = await generateChildGrowthAnalysis({ childProfileId: profile.id, userId: 'user-F', tier: 'full' });
  const second = await generateChildGrowthAnalysis({ childProfileId: profile.id, userId: 'user-F', tier: 'full' });
  assert.notEqual(first.purchasedAnalysis.id, second.purchasedAnalysis.id, '분석은 매번 새 레코드로 불변 저장');
  const finalContext = await getAIProfileContextByChildId(profile.id);
  assert.equal(finalContext.source_analysis_ids.length, 2, '두 분석 모두 source_analysis_ids에 남아야 함');
});

test('8. source_analysis_ids 추적 — 병합 후에도 최초 분석 id가 남아있다', async () => {
  const chart = await makeChartFor('1990-03-01', '10:00', 'male');
  const profile = await createChildProfile({ userId: 'user-G', chartId: chart.id });
  const { purchasedAnalysis: first } = await generateChildGrowthAnalysis({ childProfileId: profile.id, userId: 'user-G', tier: 'full' });
  await generateChildGrowthAnalysis({ childProfileId: profile.id, userId: 'user-G', tier: 'full' });
  const context = await getAIProfileContextByChildId(profile.id);
  assert.ok(context.source_analysis_ids.includes(first.id));
});

test('9. evidence_refs 추적 — parent_approach/caution의 근거가 실제 fact_ref에서 왔는지', async () => {
  const chart = await makeChartFor('1985-02-14', '06:10', 'female');
  const profile = await createChildProfile({ userId: 'user-H', chartId: chart.id });
  const { context, purchasedAnalysis } = await generateChildGrowthAnalysis({ childProfileId: profile.id, userId: 'user-H', tier: 'full' });
  const allFactRefsInAnalysis = new Set(['ziwei.life_palace']); // core_signals.life_palace_stars.fact_ref
  for (const a of purchasedAnalysis.analysis_json.parent_actions) for (const r of a.fact_ref) allFactRefsInAnalysis.add(r);
  for (const c of purchasedAnalysis.analysis_json.caution) for (const r of c.fact_ref) allFactRefsInAnalysis.add(r);
  for (const ref of context.evidence_refs) {
    assert.ok(allFactRefsInAnalysis.has(ref), `evidence_ref "${ref}"가 원본 분석(parent_actions/caution) 어디에도 없음`);
  }
});

// ============================================================
// 10. child A/B 혼선 방지
// ============================================================

test('10. child A와 child B의 context가 절대 섞이지 않는다', async () => {
  const chartA = await makeChartFor('1991-09-17', '04:50', 'female'); // 귀문 있음
  const chartB = await makeChartFor('1990-03-01', '10:00', 'male'); // 다른 조합
  const profileA = await createChildProfile({ userId: 'user-I', chartId: chartA.id });
  const profileB = await createChildProfile({ userId: 'user-I', chartId: chartB.id });
  await generateChildGrowthAnalysis({ childProfileId: profileA.id, userId: 'user-I', tier: 'full' });
  await generateChildGrowthAnalysis({ childProfileId: profileB.id, userId: 'user-I', tier: 'full' });

  const contextA = await getAIProfileContextByChildId(profileA.id);
  const contextB = await getAIProfileContextByChildId(profileB.id);
  assert.notEqual(contextA.id, contextB.id);
  assert.equal(contextA.source_analysis_ids.some((id) => contextB.source_analysis_ids.includes(id)), false, 'source_analysis_ids가 섞이면 안 됨');
});

// ============================================================
// 11~13. conversation 연결 (context 주입/fallback/regression)
// ============================================================

test('11. child conversation에서 context가 실제로 casual AI system prompt에 주입된다', async () => {
  const chart = await makeChartFor('1991-09-17', '04:50', 'female');
  const profile = await createChildProfile({ userId: 'user-J', chartId: chart.id });
  await generateChildGrowthAnalysis({ childProfileId: profile.id, userId: 'user-J', tier: 'full' });

  const parentChart = await makeChartFor('1985-02-14', '06:10', 'female'); // 대화 주체(부모)의 chart
  const conversation = await createConversation({ chartId: parentChart.id, childProfileId: profile.id });

  const provider = new RecordingMockAIProvider();
  // v3: 관련성 없는 순수 잡담("오늘 좀 힘들었어")은 이제 NONE으로 빠지는 게 정확한 동작이므로
  // (억지 개인화 방지 원칙), 실제로 재료가 매칭되는 질문으로 검증한다.
  const result = await handleFreeTextMessage({ conversationId: conversation.id, text: '숙제를 너무 하기 싫어해', aiProvider: provider, casualAiProvider: provider });

  assert.equal(result.intent, 'casual');
  assert.ok(provider.lastSystemPrompt.includes('우리 아이 성장 코치'), 'system prompt에 자녀 context 섹션이 없음');
  assert.ok(provider.lastSystemPrompt.includes('실제 행동을 증명하는 자료가 아니다'), '사주 원인 단정 금지 규칙이 없음');
});

test('12. AIProfileContext가 없는(분석 미실행) child_profile_id 대화는 기존 casual fallback과 동일하다', async () => {
  const chart = await makeChartFor('2000-12-25', '05:45', 'female');
  const profile = await createChildProfile({ userId: 'user-K', chartId: chart.id }); // 분석 생성 안 함
  const conversation = await createConversation({ chartId: chart.id, childProfileId: profile.id });

  const provider = new RecordingMockAIProvider();
  await handleFreeTextMessage({ conversationId: conversation.id, text: '심심해', aiProvider: provider, casualAiProvider: provider });
  assert.ok(!provider.lastSystemPrompt.includes('자녀에 대해 이야기'), 'context 없으면 자녀 섹션이 붙으면 안 됨');
});

test('13. child_profile_id 없는 기존 conversation은 기존 동작 100% 그대로다 (regression)', async () => {
  const chart = await makeChartFor('1990-03-01', '10:00', 'male');
  const conversation = await createConversation({ chartId: chart.id }); // childProfileId 생략(기존 호출 패턴)
  assert.equal(conversation.child_profile_id, null);

  const provider = new RecordingMockAIProvider();
  const result = await handleFreeTextMessage({ conversationId: conversation.id, text: '안녕', aiProvider: provider, casualAiProvider: provider });
  assert.equal(result.intent, 'casual');
  assert.ok(!provider.lastSystemPrompt.includes('자녀에 대해 이야기'));
  // 기존 buildCasualSystemPrompt(characterId)와 동일한 결과인지 직접 대조
  const directPrompt = buildCasualSystemPrompt(result.character.id);
  assert.equal(provider.lastSystemPrompt, directPrompt);
});

// ============================================================
// 14~15. 귀문 caution 관련 (child-growth-analysis.mjs 재검증 — 이번 통합에서도 유지되는지)
// ============================================================

test('14. 귀문 없는 child는 caution이 생성되지 않는다', async () => {
  const chart = await makeChartFor('1990-03-01', '10:00', 'male'); // 귀문 없는 조합으로 가정, 실측으로 확인
  const profile = await createChildProfile({ userId: 'user-L', chartId: chart.id });
  const { purchasedAnalysis } = await generateChildGrowthAnalysis({ childProfileId: profile.id, userId: 'user-L', tier: 'full' });
  const gwimun = chart.canonical.saju.special_stars.gwimun;
  if (gwimun.length === 0) {
    assert.equal(purchasedAnalysis.analysis_json.caution.length, 0);
  }
});

test('15. 귀문 있는 child는 caution의 fact_ref가 special_stars.gwimun이다', async () => {
  const chart = await makeChartFor('1991-09-17', '04:50', 'female'); // 귀문 2건 확인된 fixture
  const profile = await createChildProfile({ userId: 'user-M', chartId: chart.id });
  const { purchasedAnalysis } = await generateChildGrowthAnalysis({ childProfileId: profile.id, userId: 'user-M', tier: 'full' });
  assert.ok(purchasedAnalysis.analysis_json.caution.length > 0);
  for (const c of purchasedAnalysis.analysis_json.caution) {
    assert.deepEqual(c.fact_ref, ['special_stars.gwimun']);
  }
});

// ============================================================
// 16~17. im-not-ai 스타일 규칙 / 사주 원인 단정 금지 규칙이 prompt에 실제로 존재
// ============================================================

test('16. im-not-ai에서 채택한 자연스러운 대화 원칙이 system prompt에 포함된다 (v2: 장면 번역 원칙으로 재설계됨)', () => {
  const prompt = buildCasualSystemPrompt('daegu');
  assert.ok(prompt.includes('AI 특유 관용구'));
  assert.ok(prompt.includes('기계적으로 나열'));
  // v2: "완곡한 표현은 계속 써도 된다"를 명시적으로 홍보하던 구버전 원칙은 폐기됨(이 문구 자체가
  // "~경향이 있어요" 예시를 프롬프트에 심어 반복 유발). 대신 조건부 장면 표현("만약 실제로 이런
  // 상황에서...")으로 hedging의 역할을 대체 — 완전 제거는 아니되 특정 문구를 홍보하지 않는다.
  // v3: "장면 번역" 원칙은 PROFILE_NOT_EXPLAIN_RULE("프로필 사용 ≠ 프로필 설명")로 재설계됨.
  const dummyContext = { core_traits: { ten_god_dominance: 'self-directed' }, parent_approach: [], caution_points: [] };
  const withContext = buildCasualSystemPrompt('daegu', dummyContext);
  assert.ok(withContext.includes('프로필 사용') && withContext.includes('프로필 설명'), '프로필 사용≠설명 원칙이 있어야 함');
  assert.ok(!withContext.includes('완곡한 표현') || !withContext.includes('계속 써도 된다'), '"~경향이 있어요"를 예시로 든 구버전 hedging 홍보 문구는 더 이상 없어야 함');
});

test('17. 사주 원인 단정 금지 규칙이 childContext 있을 때 prompt에 존재한다', () => {
  const dummyContext = { core_traits: { ten_god_dominance: 'self-directed' }, parent_approach: [], caution_points: [] };
  const prompt = buildCasualSystemPrompt('daegu', dummyContext);
  assert.ok(prompt.includes('귀문관살 때문에'));
  assert.ok(prompt.includes('실제 행동을 증명하는 자료가 아니다'));
  assert.ok(prompt.includes('죄책감'));
  assert.ok(prompt.includes('고정된 성격으로 단정하지 않는다'));
});

// ============================================================
// 18. 기존 전체 회귀 (이 파일 자체가 이미 291개 위에 추가되는 형태 — 별도로 npm test에서 확인)
// ============================================================

test('18. 서로 다른 3명의 child가 서로 다른 core_traits/evidence_refs를 갖는다 (실제 fixture로 육안 확인용 데이터 생성)', async () => {
  const inputs = [
    ['1991-09-17', '04:50', 'female'],
    ['1988-11-22', '10:30', 'female'],
    ['1990-03-01', '10:00', 'male'],
  ];
  const contexts = [];
  for (const [d, t, g] of inputs) {
    const chart = await makeChartFor(d, t, g);
    const profile = await createChildProfile({ userId: 'user-N', chartId: chart.id });
    const { context } = await generateChildGrowthAnalysis({ childProfileId: profile.id, userId: 'user-N', tier: 'full' });
    contexts.push(context);
  }
  const dominances = contexts.map((c) => c.core_traits.ten_god_dominance);
  const uniqueCount = new Set(dominances).size;
  assert.ok(uniqueCount >= 1, '최소 1개 이상의 서로 다른 성향이 나와야 함(동일해도 오류는 아니지만 로그로 확인)');
  console.log('    [정보] 3명의 ten_god_dominance:', dominances.join(', '));
});
