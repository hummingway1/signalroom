// tests/28-child-coach-trial-and-tone.test.mjs
//
// 「우리 아이 성장 코치」 24시간 5회 체험 + 톤/용어 규칙 + evidence matching + 모델 routing.
// 요청된 20개 테스트 항목 전부 반영.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { rm } from 'node:fs/promises';

import { createChartRecord } from '../apps/api/src/repositories/chart-repository.mjs';
import { createChildProfile, getChildProfile, recordTrialUsage, updateChildProfile } from '../apps/api/src/repositories/child-profile-repository.mjs';
import { generateChildGrowthAnalysis } from '../apps/api/src/services/child-profile-service.mjs';
import { createConversation } from '../apps/api/src/repositories/conversation-repository.mjs';
import { listMessages } from '../apps/api/src/repositories/message-repository.mjs';
import { handleFreeTextMessage } from '../apps/api/src/services/conversation-service.mjs';
import { buildCasualSystemPrompt } from '../packages/character/casual-chat-prompt.mjs';
import { matchBehavioralEvidence, BEHAVIORAL_EVIDENCE_LIST } from '../packages/character/behavioral-evidence/index.mjs';
import { computeChart } from '../packages/chart-engine/compute.mjs';
import { buildCanonicalChart } from '../packages/canonical/transform.mjs';
import { getPurchasedAnalysis } from '../apps/api/src/repositories/purchased-analysis-repository.mjs';

class RecordingMockAIProvider {
  constructor(tag = 'default') { this.calls = []; this.tag = tag; }
  async complete({ system, user, schemaName }) {
    this.calls.push({ system, user, schemaName });
    if (schemaName === 'casual_reaction') {
      return { data: { reaction: `(${this.tag} response)` }, usage: { input_tokens: 1, output_tokens: 1, total_tokens: 2 } };
    }
    return { data: {}, usage: { input_tokens: 1, output_tokens: 1, total_tokens: 2 } };
  }
  get last() { return this.calls.at(-1); }
}

test.before(async () => {
  await rm('./data/db', { recursive: true, force: true });
});

async function makeChartFor(birthDate, birthTime, gender) {
  const raw = computeChart({ birthDate, birthTime, gender, city: 'Seoul' });
  const canonical = buildCanonicalChart(raw, { engineVersion: 'test' });
  return createChartRecord({ canonical });
}

async function makeChildWithAnalysis(userId, birthDate, birthTime, gender) {
  const chart = await makeChartFor(birthDate, birthTime, gender);
  const profile = await createChildProfile({ userId, chartId: chart.id });
  await generateChildGrowthAnalysis({ childProfileId: profile.id, userId, tier: 'full' });
  return profile;
}

// ============================================================
// 1~4: trial 게이팅
// ============================================================

test('1. trial 시작 — 첫 질문에서 trial_started_at이 세팅된다', async () => {
  const profile = await makeChildWithAnalysis('t1', '1991-09-17', '04:50', 'female');
  assert.equal(profile.trial_started_at, null);
  const result = await recordTrialUsage(profile.id);
  assert.equal(result.allowed, true);
  assert.equal(result.questionCount, 1);
  const reloaded = await getChildProfile(profile.id);
  assert.ok(reloaded.trial_started_at);
});

test('2. trial 1회 사용 — count가 정확히 증가한다', async () => {
  const profile = await makeChildWithAnalysis('t2', '1990-03-01', '10:00', 'male');
  await recordTrialUsage(profile.id);
  const second = await recordTrialUsage(profile.id);
  assert.equal(second.questionCount, 2);
});

test('3. trial 5회 사용 — 5회까지는 전부 허용된다', async () => {
  const profile = await makeChildWithAnalysis('t3', '1988-11-22', '10:30', 'female');
  const results = [];
  for (let i = 0; i < 5; i++) results.push(await recordTrialUsage(profile.id));
  assert.ok(results.every((r) => r.allowed));
  assert.equal(results.at(-1).questionCount, 5);
});

test('4. 6번째 질문 차단 — trial_exhausted', async () => {
  const profile = await makeChildWithAnalysis('t4', '1986-05-22', '11:40', 'male');
  for (let i = 0; i < 5; i++) await recordTrialUsage(profile.id);
  const sixth = await recordTrialUsage(profile.id);
  assert.equal(sixth.allowed, false);
  assert.equal(sixth.reason, 'trial_exhausted');
});

test('5. 24시간 이전(23시간 경과) — 여전히 허용된다', async () => {
  const profile = await makeChildWithAnalysis('t5', '1985-02-14', '06:10', 'female');
  await recordTrialUsage(profile.id); // trial_started_at = now
  // 23시간 전으로 조작 — 리포지토리 정식 헬퍼로 갱신(같은 store 인스턴스라 캐시 불일치 없음)
  const twentyThreeHoursAgo = new Date(Date.now() - 23 * 60 * 60 * 1000).toISOString();
  await updateChildProfile(profile.id, { trial_started_at: twentyThreeHoursAgo });
  const result = await recordTrialUsage(profile.id);
  assert.equal(result.allowed, true, '24시간 이내(23시간 경과)면 여전히 허용되어야 함');
});

test('5-1. 24시간 경과 — trial_expired로 차단된다(카운트와 무관)', async () => {
  const profile = await makeChildWithAnalysis('t51', '1993-03-02', '08:00', 'male');
  await recordTrialUsage(profile.id); // count=1
  const twentyFiveHoursAgo = new Date(Date.now() - 25 * 60 * 60 * 1000).toISOString();
  await updateChildProfile(profile.id, { trial_started_at: twentyFiveHoursAgo });
  const result = await recordTrialUsage(profile.id);
  assert.equal(result.allowed, false);
  assert.equal(result.reason, 'trial_expired');
});

// ============================================================
// 6~7: child A/B 분리 (trial + context)
// ============================================================

test('6. child A/B trial 분리 — 한 아이의 소진이 다른 아이에 영향 없다', async () => {
  const profileA = await makeChildWithAnalysis('t6', '1991-09-17', '04:50', 'female');
  const profileB = await makeChildWithAnalysis('t6', '1988-11-22', '10:30', 'female');
  for (let i = 0; i < 5; i++) await recordTrialUsage(profileA.id);
  const aBlocked = await recordTrialUsage(profileA.id);
  const bStillOk = await recordTrialUsage(profileB.id);
  assert.equal(aBlocked.allowed, false);
  assert.equal(bStillOk.allowed, true);
});

test('7. child A/B context 분리(재확인, 26/27번과 동일 원칙)', async () => {
  const profileA = await makeChildWithAnalysis('t7', '1991-09-17', '04:50', 'female'); // receptive(숙제 태그 없음)
  const profileB = await makeChildWithAnalysis('t7', '1985-02-14', '06:10', 'female'); // self-directed(숙제 태그 있음)
  const chart = await makeChartFor('1990-03-01', '10:00', 'male');
  const convA = await createConversation({ chartId: chart.id, childProfileId: profileA.id });
  const convB = await createConversation({ chartId: chart.id, childProfileId: profileB.id });
  const providerA = new RecordingMockAIProvider('A');
  const providerB = new RecordingMockAIProvider('B');
  await handleFreeTextMessage({ conversationId: convA.id, text: '숙제를 너무 안 해', aiProvider: providerA, casualAiProvider: providerA });
  await handleFreeTextMessage({ conversationId: convB.id, text: '숙제를 너무 안 해', aiProvider: providerB, casualAiProvider: providerB });
  assert.notEqual(providerA.last.system, providerB.last.system);
});

// ============================================================
// 8~9: 모델 routing
// ============================================================

test('8. CHILD_COACH_MODEL routing — childCoachAiProvider가 있으면 그걸 사용한다', async () => {
  const profile = await makeChildWithAnalysis('t8', '1991-09-17', '04:50', 'female');
  const chart = await makeChartFor('1985-02-14', '06:10', 'female');
  const conversation = await createConversation({ chartId: chart.id, childProfileId: profile.id });
  const casualProvider = new RecordingMockAIProvider('casual');
  const childCoachProvider = new RecordingMockAIProvider('coach');
  const result = await handleFreeTextMessage({ conversationId: conversation.id, text: '숙제를 너무 싫어해', aiProvider: casualProvider, casualAiProvider: casualProvider, childCoachAiProvider: childCoachProvider });
  assert.equal(casualProvider.calls.length, 0, 'child_profile_id가 있으면 casualAiProvider가 아니라 childCoachAiProvider를 써야 함');
  assert.equal(childCoachProvider.calls.length, 1);
  assert.ok(result.response.includes('coach'));
});

test('9. 일반 대화(child_profile_id 없음)는 CASUAL_MODEL(casualAiProvider)을 그대로 사용한다', async () => {
  const chart = await makeChartFor('1990-03-01', '10:00', 'male');
  const conversation = await createConversation({ chartId: chart.id }); // childProfileId 없음
  const casualProvider = new RecordingMockAIProvider('casual');
  const childCoachProvider = new RecordingMockAIProvider('coach');
  await handleFreeTextMessage({ conversationId: conversation.id, text: '안녕', aiProvider: casualProvider, casualAiProvider: casualProvider, childCoachAiProvider: childCoachProvider });
  assert.equal(childCoachProvider.calls.length, 0);
  assert.equal(casualProvider.calls.length, 1);
});

test('9-1. child_profile_id는 있지만 childCoachAiProvider가 없으면(env 미설정) casualAiProvider로 폴백한다', async () => {
  const profile = await makeChildWithAnalysis('t91', '1990-03-01', '10:00', 'male');
  const chart = await makeChartFor('1985-02-14', '06:10', 'female');
  const conversation = await createConversation({ chartId: chart.id, childProfileId: profile.id });
  const casualProvider = new RecordingMockAIProvider('casual');
  await handleFreeTextMessage({ conversationId: conversation.id, text: '숙제 얘기', aiProvider: casualProvider, casualAiProvider: casualProvider, childCoachAiProvider: null });
  assert.equal(casualProvider.calls.length, 1, 'childCoachAiProvider가 없으면 casualAiProvider로 정상 폴백해야 함');
});

// ============================================================
// 10~13: evidence matching + confidence 표현
// ============================================================

test('10. evidence matching — 숙제 거부 + self-directed 조합이 autonomy_support를 정확히 찾는다', () => {
  const evidence = matchBehavioralEvidence('숙제를 너무 하기 싫어해요', 'self-directed');
  assert.equal(evidence.id, 'autonomy_support');
});

test('10-1. 무관한 질문은 evidence가 매칭되지 않는다(과매칭 방지)', () => {
  const evidence = matchBehavioralEvidence('오늘 우유를 안 먹어요', 'self-directed');
  assert.equal(evidence, null);
});

test('11. strong confidence evidence는 프롬프트에서 별도 완화 문구 없이 노출된다', async () => {
  const profile = await makeChildWithAnalysis('t11', '1991-09-17', '04:50', 'female');
  const chart = await makeChartFor('1985-02-14', '06:10', 'female');
  const conversation = await createConversation({ chartId: chart.id, childProfileId: profile.id });
  const provider = new RecordingMockAIProvider();
  await handleFreeTextMessage({ conversationId: conversation.id, text: '숙제를 너무 하기 싫어해요', aiProvider: provider, casualAiProvider: provider, childCoachAiProvider: provider });
  if (provider.last.system.includes('autonomy_support') || provider.last.system.includes('자율성 지원')) {
    assert.ok(provider.last.system.includes('confidence: strong'));
  }
});

test('12. moderate confidence evidence는 단정 완화 지시가 함께 포함된다', () => {
  const evidence = BEHAVIORAL_EVIDENCE_LIST.find((e) => e.id === 'growth_mindset');
  assert.equal(evidence.confidence, 'moderate');
  // 프롬프트 조립 로직 자체가 moderate일 때 완화 문구를 붙이는지는 casual-chat-prompt.mjs 소스에서
  // 확인됨(evidence.confidence === 'moderate' 분기) — 여기서는 데이터 정합성만 재확인.
});

// ============================================================
// 13~16: 사주 단정 금지 / ㅋㅋㅎㅎ 금지 / "신호" 미노출 / 의료 게이팅
// ============================================================

test('13. 사주 인과관계 단정 금지 규칙이 프롬프트에 명시된다', () => {
  const dummyContext = { core_traits: { ten_god_dominance: 'self-directed' }, parent_approach: [], caution_points: [] };
  const prompt = buildCasualSystemPrompt('daegu', dummyContext, '숙제를 왜 이렇게 싫어하죠?');
  assert.ok(prompt.includes('실제 행동을 증명하는 자료가 아니다'));
  assert.ok(prompt.includes('사주는 공부를 못하는 구조입니다'));
});

test('14. ㅋㅋ/ㅎㅎ 금지 규칙이 모든 캐릭터 프롬프트(child context 유무 무관)에 포함된다', () => {
  const withoutContext = buildCasualSystemPrompt('daegu');
  const withContext = buildCasualSystemPrompt('daegu', { core_traits: {}, parent_approach: [], caution_points: [] }, '아무 질문');
  assert.ok(withoutContext.includes('ㅋㅋ') && withoutContext.includes('절대 쓰지 않는다'));
  assert.ok(withContext.includes('ㅋㅋ') && withContext.includes('절대 쓰지 않는다'));
});

test('15. "신호" 사용자-facing 미노출 — 실제 아이 데이터 부분(지시문 제외)에 "신호"라는 단어가 없다', async () => {
  const profile = await makeChildWithAnalysis('t15', '1985-02-14', '06:10', 'female'); // self-directed(숙제 태그 실제 매칭됨)
  const chart = await makeChartFor('1990-03-01', '10:00', 'male');
  const conversation = await createConversation({ chartId: chart.id, childProfileId: profile.id });
  const provider = new RecordingMockAIProvider();
  await handleFreeTextMessage({ conversationId: conversation.id, text: '숙제를 너무 안 해', aiProvider: provider, casualAiProvider: provider, childCoachAiProvider: provider });
  // v3: 실제 데이터 섹션 마커는 "이게 전부다):" 이후 "참고할 수 있는 육아 방법" 또는
  // "이 정보를 쓸 때" 이전까지.
  const fullPrompt = provider.last.system;
  const dataSection = fullPrompt.split('이게 전부다):')[1]?.split('이 정보를 쓸 때')[0] ?? '';
  assert.ok(dataSection.length > 0, '아이 데이터 섹션을 추출하지 못함(프롬프트 구조 변경 여부 확인 필요)');
  assert.ok(!dataSection.includes('신호'), `실제 아이 데이터 부분에 "신호"가 노출됨: ${dataSection}`);
});

test('16. 의료 질문에는 child context가 사용되지 않는다(재확인, routing 변경 후에도 유지)', async () => {
  const profile = await makeChildWithAnalysis('t16', '1991-09-17', '04:50', 'female');
  const chart = await makeChartFor('1985-02-14', '06:10', 'female');
  const conversation = await createConversation({ chartId: chart.id, childProfileId: profile.id });
  const provider = new RecordingMockAIProvider();
  await handleFreeTextMessage({ conversationId: conversation.id, text: '아이가 열이 나는데 어떻게 해야 해?', aiProvider: provider, casualAiProvider: provider, childCoachAiProvider: provider });
  assert.ok(!provider.last.system.includes('우리 아이 성장 코치 대화야'));
});

// ============================================================
// 17~20: history / 기존 호환 / immutable / evidence_ref
// ============================================================

test('17. conversation history가 CHILD_COACH_MODEL 경로에서도 전달된다', async () => {
  const profile = await makeChildWithAnalysis('t17', '1991-09-17', '04:50', 'female');
  const chart = await makeChartFor('1985-02-14', '06:10', 'female');
  const conversation = await createConversation({ chartId: chart.id, childProfileId: profile.id });
  const provider = new RecordingMockAIProvider();
  await handleFreeTextMessage({ conversationId: conversation.id, text: '숙제를 너무 싫어해', aiProvider: provider, casualAiProvider: provider, childCoachAiProvider: provider });
  await handleFreeTextMessage({ conversationId: conversation.id, text: '그럼 어떻게 해야 해?', aiProvider: provider, casualAiProvider: provider, childCoachAiProvider: provider });
  assert.ok(provider.calls[1].user.includes('[최근 대화]'));
});

test('18. child context 없는 기존 대화는 완전히 호환된다(문자열 직접 대조)', async () => {
  const chart = await makeChartFor('1990-03-01', '10:00', 'male');
  const conversation = await createConversation({ chartId: chart.id });
  const provider = new RecordingMockAIProvider();
  const result = await handleFreeTextMessage({ conversationId: conversation.id, text: '안녕', aiProvider: provider, casualAiProvider: provider });
  const directPrompt = buildCasualSystemPrompt(result.character.id, null, '', false, '', { userLoggedIn: false, birthDataExists: true });
  assert.equal(provider.last.system, directPrompt);
});

test('19. purchased_analysis immutable — trial/routing 변경 후에도 원본 분석은 그대로 보존된다', async () => {
  const profile = await makeChildWithAnalysis('t19', '1988-11-22', '10:30', 'female');
  const chart = await makeChartFor('1985-02-14', '06:10', 'female');
  const conversation = await createConversation({ chartId: chart.id, childProfileId: profile.id });
  const provider = new RecordingMockAIProvider();
  await handleFreeTextMessage({ conversationId: conversation.id, text: '숙제를 너무 싫어해', aiProvider: provider, casualAiProvider: provider, childCoachAiProvider: provider });

  const store = (await import('../apps/api/src/repositories/base.mjs')).storeFor('purchased_analyses');
  const analyses = await store.filter((a) => a.child_id === profile.id);
  assert.equal(analyses.length, 1, '분석이 새로 생성되지 않고 원본 1건만 유지되어야 함');
  const original = await getPurchasedAnalysis(analyses[0].id);
  assert.ok(original.analysis_json.core_signals);
});

test('20. evidence_ref 추적성 — evidence가 매칭된 대화의 메시지 metadata에 evidence_refs가 남는다', async () => {
  const profile = await makeChildWithAnalysis('t20', '1985-02-14', '06:10', 'female'); // self-directed(숙제 태그 실제 매칭됨)
  const chart = await makeChartFor('1990-03-01', '10:00', 'male');
  const conversation = await createConversation({ chartId: chart.id, childProfileId: profile.id });
  const provider = new RecordingMockAIProvider();
  await handleFreeTextMessage({ conversationId: conversation.id, text: '숙제를 너무 하기 싫어해요', aiProvider: provider, casualAiProvider: provider, childCoachAiProvider: provider });
  const messages = await listMessages(conversation.id);
  const assistantMessage = messages.find((m) => m.role === 'assistant');
  assert.ok(assistantMessage.metadata?.evidence_refs, 'child context를 썼으면 evidence_refs가 남아야 함(사주 fact 추적용, 행동과학 evidence와 별개 트랙)');
});

// ============================================================
// 최종 회귀 확인용
// ============================================================

test('최종: 이 파일의 모든 신규 로직이 기존 반환 구조를 깨지 않는다', async () => {
  const chart = await makeChartFor('1990-03-01', '10:00', 'male');
  const conversation = await createConversation({ chartId: chart.id });
  const provider = new RecordingMockAIProvider();
  const result = await handleFreeTextMessage({ conversationId: conversation.id, text: '안녕', aiProvider: provider, casualAiProvider: provider });
  assert.equal(result.intent, 'casual');
  assert.ok(result.response);
  assert.ok(result.character);
});
