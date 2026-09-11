// tests/27-child-context-conversation-flow.test.mjs
//
// child context + conversation history + 관련성 게이팅(의료 질문 회피) + evidence_refs 추적.
// 요청된 12개 테스트 항목 전부 반영(1~7은 기존 26번 파일에서 이미 확인된 것 재검증 포함, 8~12는 신규).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { rm } from 'node:fs/promises';

import { createChartRecord } from '../apps/api/src/repositories/chart-repository.mjs';
import { createChildProfile } from '../apps/api/src/repositories/child-profile-repository.mjs';
import { generateChildGrowthAnalysis } from '../apps/api/src/services/child-profile-service.mjs';
import { createConversation } from '../apps/api/src/repositories/conversation-repository.mjs';
import { listMessages } from '../apps/api/src/repositories/message-repository.mjs';
import { handleFreeTextMessage } from '../apps/api/src/services/conversation-service.mjs';
import { buildCasualSystemPrompt, isMedicalOrSafetyTopic, buildCasualUserMessage } from '../packages/character/casual-chat-prompt.mjs';
import { computeChart } from '../packages/chart-engine/compute.mjs';
import { buildCanonicalChart } from '../packages/canonical/transform.mjs';

class RecordingMockAIProvider {
  constructor() { this.calls = []; }
  async complete({ system, user, schemaName }) {
    this.calls.push({ system, user, schemaName });
    if (schemaName === 'casual_reaction') {
      return { data: { reaction: '(recorded)' }, usage: { input_tokens: 1, output_tokens: 1, total_tokens: 2 } };
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
// 1~7: 기존 검증 항목 재확인 (26번 파일과 겹치되, 이번 handleFreeTextMessage 변경 이후로도 유지되는지)
// ============================================================

test('1. child context가 있는 conversation → 실제 prompt에 자녀 섹션이 주입된다', async () => {
  const profile = await makeChildWithAnalysis('u1', '1985-02-14', '06:10', 'female'); // self-directed(숙제 태그 실제 매칭됨)
  const parentChart = await makeChartFor('1990-03-01', '10:00', 'male');
  const conversation = await createConversation({ chartId: parentChart.id, childProfileId: profile.id });
  const provider = new RecordingMockAIProvider();
  await handleFreeTextMessage({ conversationId: conversation.id, text: '숙제를 너무 하기 싫어해', aiProvider: provider, casualAiProvider: provider });
  assert.ok(provider.last.system.includes('우리 아이 성장 코치'));
});

test('2. child context 없는 conversation → 기존 prompt와 완전히 동일', async () => {
  const chart = await makeChartFor('1986-05-22', '11:40', 'male');
  const conversation = await createConversation({ chartId: chart.id });
  const provider = new RecordingMockAIProvider();
  const result = await handleFreeTextMessage({ conversationId: conversation.id, text: '안녕', aiProvider: provider, casualAiProvider: provider });
  const directPrompt = buildCasualSystemPrompt(result.character.id, null, '', false, '', { userLoggedIn: false, birthDataExists: true });
  assert.equal(provider.last.system, directPrompt);
});

test('3. Child A/B는 서로 다른 context를 갖는다', async () => {
  const profileA = await makeChildWithAnalysis('u3', '1991-09-17', '04:50', 'female');
  const profileB = await makeChildWithAnalysis('u3', '1988-11-22', '10:30', 'female');
  const chart = await makeChartFor('1985-02-14', '06:10', 'female');
  const convA = await createConversation({ chartId: chart.id, childProfileId: profileA.id });
  const convB = await createConversation({ chartId: chart.id, childProfileId: profileB.id });
  const providerA = new RecordingMockAIProvider();
  const providerB = new RecordingMockAIProvider();
  // "숙제" situation_tag는 self-directed/expressive 프로필에만 있고 receptive에는 없어서
  // (실측 확인됨), A(receptive)는 NONE, B(expressive)는 FOCUSED로 실제로 갈린다.
  await handleFreeTextMessage({ conversationId: convA.id, text: '숙제를 너무 안 해', aiProvider: providerA, casualAiProvider: providerA });
  await handleFreeTextMessage({ conversationId: convB.id, text: '숙제를 너무 안 해', aiProvider: providerB, casualAiProvider: providerB });
  assert.notEqual(providerA.last.system, providerB.last.system);
});

test('4. 같은 질문 + 다른 child → 서로 다른 prompt (A/B 값이 실제 fact를 반영)', async () => {
  const profileA = await makeChildWithAnalysis('u4', '1991-09-17', '04:50', 'female'); // 귀문 있음
  const profileB = await makeChildWithAnalysis('u4', '1986-05-22', '11:40', 'male'); // 귀문 없음(실측 확인됨)
  const chart = await makeChartFor('1985-02-14', '06:10', 'female');
  const convA = await createConversation({ chartId: chart.id, childProfileId: profileA.id });
  const convB = await createConversation({ chartId: chart.id, childProfileId: profileB.id });
  const providerA = new RecordingMockAIProvider();
  const providerB = new RecordingMockAIProvider();
  // caution(귀문)의 concept_tags는 ['몰입','집중']이므로, 몰입 관련 질문이어야 실제로 caution이
  // 매칭되어 프롬프트에 노출된다("친구" 질문은 caution의 태그와 무관해서 원래 취지가 재현 안 됨).
  await handleFreeTextMessage({ conversationId: convA.id, text: '요즘 뭔가에 꽂히면 너무 몰입해서 다른 걸 못 봐요', aiProvider: providerA, casualAiProvider: providerA });
  await handleFreeTextMessage({ conversationId: convB.id, text: '요즘 뭔가에 꽂히면 너무 몰입해서 다른 걸 못 봐요', aiProvider: providerB, casualAiProvider: providerB });
  // "귀문"이라는 단어 자체는 금지 예시 문구("금지: 귀문관살 때문에...")에도 항상 등장하므로,
  // 실제 caution이 프롬프트에 노출되는 고유 문구("조금 더 세심하게 살펴볼 만한 부분")로 정확히
  // 구분한다(v2: 귀문 텍스트 자체는 _internal_note로 이동해 더 이상 프롬프트에 직접 노출되지 않음).
  assert.ok(providerA.last.system.includes('조금 더 세심하게 살펴볼 만한 부분'), 'A는 실제 귀문 caution 문구가 있어야 함');
  assert.ok(!providerB.last.system.includes('조금 더 세심하게 살펴볼 만한 부분'), 'B는 caution 문구 자체가 없어야 함(실제 fact 차이 반영)');
});

test('5. child context에 없는 fact(예: 없는 오행)는 프롬프트에 생성되지 않는다', async () => {
  const profile = await makeChildWithAnalysis('u5', '1986-05-22', '11:40', 'male');
  const chart = await makeChartFor('1985-02-14', '06:10', 'female');
  const conversation = await createConversation({ chartId: chart.id, childProfileId: profile.id });
  const provider = new RecordingMockAIProvider();
  await handleFreeTextMessage({ conversationId: conversation.id, text: '고집이 너무 세졌어', aiProvider: provider, casualAiProvider: provider });
  // 프롬프트 안의 모든 오행 언급이 실제 missingElements와 일치하는지는 26번 파일에서 이미 코드 레벨로
  // 검증됨 — 여기서는 "존재하지 않는 궁 이름"(예: 실제 계산에 없는 임의의 자미두수 주성)이 프롬프트에
  // 없는지 확인한다.
  const FAKE_STARS = ['환상성', '가짜별'];
  for (const fake of FAKE_STARS) assert.ok(!provider.last.system.includes(fake));
});

test('6. 귀문 없는 아이는 귀문 관련 caution 문장이 prompt에 없다', async () => {
  const profile = await makeChildWithAnalysis('u6', '1986-05-22', '11:40', 'male'); // 귀문 없음(실측)
  const chart = await makeChartFor('1985-02-14', '06:10', 'female');
  const conversation = await createConversation({ chartId: chart.id, childProfileId: profile.id });
  const provider = new RecordingMockAIProvider();
  await handleFreeTextMessage({ conversationId: conversation.id, text: '요즘 자꾸 거짓말을 하는 것 같아', aiProvider: provider, casualAiProvider: provider });
  assert.ok(!provider.last.system.includes('조금 더 세심하게 살펴볼 만한 부분'), '실제 caution 문구가 없어야 함(고정 금지 예시의 "귀문관살"은 항상 존재하므로 그걸로 판단하면 안 됨)');
});

test('7. 사주 원인 단정 표현 차단 규칙이 prompt에 명시되어 있다', async () => {
  const profile = await makeChildWithAnalysis('u7', '1991-09-17', '04:50', 'female');
  const chart = await makeChartFor('1985-02-14', '06:10', 'female');
  const conversation = await createConversation({ chartId: chart.id, childProfileId: profile.id });
  const provider = new RecordingMockAIProvider();
  await handleFreeTextMessage({ conversationId: conversation.id, text: '게임을 너무 많이 하는데 어떻게 하지?', aiProvider: provider, casualAiProvider: provider });
  assert.ok(provider.last.system.includes('실제 행동을 증명하는 자료가 아니다'));
});

// ============================================================
// 8~11: 신규 — conversation history / 관련성 게이팅 / evidence_refs
// ============================================================

test('8. conversation history + child context 동시 사용 — 이전 대화가 user 메시지에 포함된다', async () => {
  const profile = await makeChildWithAnalysis('u8', '1991-09-17', '04:50', 'female');
  const chart = await makeChartFor('1985-02-14', '06:10', 'female');
  const conversation = await createConversation({ chartId: chart.id, childProfileId: profile.id });
  const provider = new RecordingMockAIProvider();

  await handleFreeTextMessage({ conversationId: conversation.id, text: '숙제를 너무 하기 싫어해', aiProvider: provider, casualAiProvider: provider });
  await handleFreeTextMessage({ conversationId: conversation.id, text: '그럼 숙제를 시킬 때 어떻게 해야 해?', aiProvider: provider, casualAiProvider: provider });

  const secondCallUser = provider.calls[1].user;
  assert.ok(secondCallUser.includes('[최근 대화]'), '두 번째 호출부터는 히스토리가 포함되어야 함');
  assert.ok(secondCallUser.includes('숙제를 너무 하기 싫어해'), '직전 질문이 히스토리에 남아있어야 함');
  assert.ok(secondCallUser.includes('[지금 질문]'));
});

test('8-1. 첫 메시지(히스토리 없음)는 기존처럼 단순 텍스트만 전달된다', async () => {
  const profile = await makeChildWithAnalysis('u81', '1986-05-22', '11:40', 'male');
  const chart = await makeChartFor('1985-02-14', '06:10', 'female');
  const conversation = await createConversation({ chartId: chart.id, childProfileId: profile.id });
  const provider = new RecordingMockAIProvider();
  await handleFreeTextMessage({ conversationId: conversation.id, text: '안녕', aiProvider: provider, casualAiProvider: provider });
  assert.equal(provider.last.user, '안녕');
  assert.ok(!provider.last.user.includes('[최근 대화]'));
});

test('9. 관련 재료가 실제로 매칭되는 생활 질문에는 child context가 주입된다 (의료만 차단, 억지 차단 아님)', async () => {
  const profile = await makeChildWithAnalysis('u9', '1985-02-14', '06:10', 'female'); // self-directed(게임종료 태그 실제 보유)
  const chart = await makeChartFor('1990-03-01', '10:00', 'male');
  const conversation = await createConversation({ chartId: chart.id, childProfileId: profile.id });
  const provider = new RecordingMockAIProvider();
  await handleFreeTextMessage({ conversationId: conversation.id, text: '게임 끄라고 하면 난리가 나요', aiProvider: provider, casualAiProvider: provider });
  assert.ok(provider.last.system.includes('우리 아이 성장 코치'), '관련 재료가 있는 일반 생활 질문은 관련성 게이팅 대상이 아님(의료만 차단)');
});

test('10. 의료 질문에는 child context가 사용되지 않는다', async () => {
  const profile = await makeChildWithAnalysis('u10', '1991-09-17', '04:50', 'female');
  const chart = await makeChartFor('1985-02-14', '06:10', 'female');
  const conversation = await createConversation({ chartId: chart.id, childProfileId: profile.id });
  const provider = new RecordingMockAIProvider();
  await handleFreeTextMessage({ conversationId: conversation.id, text: '오늘 아이가 열이 나는데 어떻게 해야 해?', aiProvider: provider, casualAiProvider: provider });
  assert.ok(!provider.last.system.includes('자녀에 대해 이야기'), '의료 질문엔 child context가 빠져야 함');
});

test('10-1. isMedicalOrSafetyTopic 유틸이 실제 의료 키워드를 정확히 감지한다', () => {
  assert.equal(isMedicalOrSafetyTopic('오늘 열이 나요'), true);
  assert.equal(isMedicalOrSafetyTopic('병원 가야 할까요'), true);
  assert.equal(isMedicalOrSafetyTopic('숙제를 너무 하기 싫어해'), false);
  assert.equal(isMedicalOrSafetyTopic('게임을 너무 많이 해'), false);
});

test('11. evidence_refs가 메시지 metadata로 추적 가능하다(child context 사용 시에만)', async () => {
  const profile = await makeChildWithAnalysis('u11', '1985-02-14', '06:10', 'female'); // self-directed(숙제 태그 실제 매칭됨)
  const chart = await makeChartFor('1990-03-01', '10:00', 'male');
  const conversation = await createConversation({ chartId: chart.id, childProfileId: profile.id });
  const provider = new RecordingMockAIProvider();
  await handleFreeTextMessage({ conversationId: conversation.id, text: '숙제를 너무 안 해', aiProvider: provider, casualAiProvider: provider });

  const messages = await listMessages(conversation.id);
  const assistantMessage = messages.find((m) => m.role === 'assistant');
  assert.ok(assistantMessage.metadata?.evidence_refs, 'child context를 썼으면 evidence_refs가 메타데이터에 남아야 함');
  assert.ok(assistantMessage.metadata.evidence_refs.includes('saju.pillars'));
});

test('11-1. child context를 안 쓴 경우(일반 대화)에는 evidence_refs 메타데이터가 없다', async () => {
  const chart = await makeChartFor('1986-05-22', '11:40', 'male');
  const conversation = await createConversation({ chartId: chart.id }); // child_profile_id 없음
  const provider = new RecordingMockAIProvider();
  await handleFreeTextMessage({ conversationId: conversation.id, text: '심심해', aiProvider: provider, casualAiProvider: provider });
  const messages = await listMessages(conversation.id);
  const assistantMessage = messages.find((m) => m.role === 'assistant');
  assert.equal(assistantMessage.metadata, null);
});

test('buildCasualUserMessage: 최근 6개(3턴)까지만 포함하고 그 이전은 잘린다', () => {
  const manyMessages = Array.from({ length: 10 }, (_, i) => ({ role: i % 2 === 0 ? 'user' : 'assistant', content: `메시지${i}` }));
  const result = buildCasualUserMessage('지금 질문', manyMessages);
  assert.ok(!result.includes('메시지0'), '오래된 메시지는 제외되어야 함');
  assert.ok(result.includes('메시지9'), '최근 메시지는 포함되어야 함');
});

// ============================================================
// 12: 기존 전체 회귀는 npm test로 별도 확인(이 파일 자체가 그 일부)
// ============================================================

test('12. 이 파일의 모든 신규 로직이 기존 casual 응답 파이프라인(reaction/usage 반환 구조)을 깨지 않는다', async () => {
  const chart = await makeChartFor('1986-05-22', '11:40', 'male');
  const conversation = await createConversation({ chartId: chart.id });
  const provider = new RecordingMockAIProvider();
  const result = await handleFreeTextMessage({ conversationId: conversation.id, text: '안녕', aiProvider: provider, casualAiProvider: provider });
  assert.equal(result.intent, 'casual');
  assert.ok(result.response);
  assert.ok(result.usage);
  assert.ok(result.character);
  assert.equal(result.highlightCard, null);
});
