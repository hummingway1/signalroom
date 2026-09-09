// tests/17-character-conversation.test.mjs
//
// packages/character/* + conversation-service.mjs 신규 함수(getOpeningChoices/pickCatalogChoice/
// handleFreeTextMessage) + conversations.mjs 신규 라우트 3개. 기존 라우트/서비스는 건드리지 않았음을
// 이 파일의 통과 여부 + tests/07-api-integration.test.mjs가 여전히 통과하는 것으로 함께 확인한다.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { rm } from 'node:fs/promises';
import express from 'express';

import { chartsRouter } from '../apps/api/src/routes/charts.mjs';
import { conversationsRouter } from '../apps/api/src/routes/conversations.mjs';
import { MockAIProvider } from '../packages/ai/providers/mock-provider.mjs';

import { QUESTION_CATALOG, getCatalogEntry } from '../packages/character/question-catalog.mjs';
import { selectOpeningChoices, selectNextChoices, selectFallbackTopicSwitch } from '../packages/character/catalog-selector.mjs';
import { classifyMessage } from '../packages/character/casual-chat-classifier.mjs';
import { getCharacter, CHARACTERS } from '../packages/character/characters.mjs';

// ============================================================
// 순수 함수 단위 테스트 (AI 호출 없음)
// ============================================================

test('question-catalog: 모든 항목의 required_data 필드명이 실제 categories.mjs 값과 일치한다', async () => {
  const { SAJU_FIELDS, ZIWEI_FIELDS, ZIWEI_PALACE_POSITIONS, QUESTION_CATEGORIES } = await import('../packages/shared/categories.mjs');
  for (const entry of QUESTION_CATALOG) {
    for (const f of entry.required_data.saju_fields) assert.ok(SAJU_FIELDS.includes(f), `${entry.id}: invalid saju field ${f}`);
    for (const f of entry.required_data.ziwei_fields) assert.ok(ZIWEI_FIELDS.includes(f), `${entry.id}: invalid ziwei field ${f}`);
    for (const p of entry.required_data.ziwei_palace_focus) assert.ok(ZIWEI_PALACE_POSITIONS.includes(p), `${entry.id}: invalid palace ${p}`);
    assert.ok(QUESTION_CATEGORIES.includes(entry.category), `${entry.id}: invalid category ${entry.category}`);
  }
});

test('question-catalog: 모든 display_text는 UX 설계 원칙대로 짧은 대화체다 (프롬프트 형식 문장 금지)', () => {
  // "말해줘"/"말해봐" 같은 짧고 자연스러운 요청은 제외 — 실제로 UX 설계문서 §5가 좋은 예로 든 표현이다.
  // "OO을/를 분석해줘/설명해줘/알려줘"처럼 명사구+formal 동사 조합만 프롬프트 형식으로 간주한다.
  const BANNED_PROMPT_PATTERNS = [/분석해줘/, /설명해줘/, /알려줘/, /해석해줘/, /를 봐줘/];
  for (const entry of QUESTION_CATALOG) {
    for (const pattern of BANNED_PROMPT_PATTERNS) {
      assert.ok(!pattern.test(entry.display_text), `${entry.id}: display_text "${entry.display_text}"가 AI 프롬프트 형식처럼 보임`);
    }
  }
});

test('getOpeningChoices 동등물(selectOpeningChoices): 3~4개, 서로 다른 context', () => {
  const choices = selectOpeningChoices({ catalog: QUESTION_CATALOG });
  assert.ok(choices.length >= 3 && choices.length <= 4);
  const contexts = choices.map((c) => c.context);
  assert.equal(new Set(contexts).size, contexts.length, 'context가 중복되면 안 됨');
});

test('selectNextChoices: 이미 본 항목(seenIds)은 제외된다', () => {
  const seen = ['personality_confirm_1'];
  const choices = selectNextChoices({ catalog: QUESTION_CATALOG, currentContext: 'personality', seenIds: seen });
  assert.ok(!choices.some((c) => c.id === 'personality_confirm_1'));
});

test('selectNextChoices: 선택지 수는 4개를 넘지 않는다 (§12)', () => {
  const choices = selectNextChoices({ catalog: QUESTION_CATALOG, currentContext: 'personality', seenIds: [] });
  assert.ok(choices.length <= 4);
});

test('selectFallbackTopicSwitch: 현재 context를 다 봤을 때 다른 주제로 전환할 선택지를 준다', () => {
  const allPersonalityIds = QUESTION_CATALOG.filter((c) => c.context === 'personality').map((c) => c.id);
  const fallback = selectFallbackTopicSwitch({ catalog: QUESTION_CATALOG, excludeContext: 'personality', seenIds: allPersonalityIds });
  assert.ok(fallback.length > 0);
  assert.ok(fallback.every((c) => c.context !== 'personality'));
});

test('classifyMessage: 사주 키워드가 있으면 saju_question', () => {
  assert.equal(classifyMessage('내 대운이 궁금해'), 'saju_question');
  assert.equal(classifyMessage('귀문관살 있어?'), 'saju_question');
});

test('실제 사용자 리포트 버그 (2026-08-18): "OO운" 형태의 운세 질문이 saju_question으로 분류된다', () => {
  assert.equal(classifyMessage('재물운은 어때? 올해'), 'saju_question');
  assert.equal(classifyMessage('연애운 좀 봐줘'), 'saju_question');
  assert.equal(classifyMessage('이직운 있어?'), 'saju_question'); // 명시적 목록에 없어도 접미사 패턴으로 잡힘
});

test('classifyMessage: "운"이 앞에 오는 무관한 단어("운동" 등)는 오탐하지 않는다', () => {
  assert.equal(classifyMessage('운동하러 가야 하는데'), 'casual');
  assert.equal(classifyMessage('회사 운영이 어려워'), 'casual');
});

test('classifyMessage: 일상적인 잡담은 casual', () => {
  assert.equal(classifyMessage('오늘 회사에서 개빡치는 일이 있었어.'), 'casual');
  assert.equal(classifyMessage('점심 뭐 먹지'), 'casual');
});

test('classifyMessage: 결정을 묻는 문장은 사주 의도로 분류될 수 있다 (§13 예시)', () => {
  assert.equal(classifyMessage('내가 회사를 그만두는 게 사주상 맞아?'), 'saju_question');
});

test('getCharacter: 대구/맹구/큐피/박사냥 전부 조회 가능하고 toneInstruction을 갖는다', () => {
  assert.ok(getCharacter('daegu').toneInstruction.length > 0);
  assert.ok(getCharacter('manggu').toneInstruction.length > 0);
  assert.ok(getCharacter('cupid').toneInstruction.length > 0);
  assert.ok(getCharacter('scholar').toneInstruction.length > 0);
  assert.equal(Object.keys(CHARACTERS).length, 4);
});

// ============================================================
// HTTP 통합 테스트 (MockAIProvider — 실제 API 호출 없음)
// ============================================================

let server;
let baseUrl;

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
async function getJson(path) {
  const res = await fetch(`${baseUrl}${path}`);
  return { status: res.status, body: await res.json() };
}

async function createChartAndConversation() {
  const chart = await postJson('/api/charts', { birthDate: '2026-08-06', birthTime: '10:59', gender: 'male', city: 'Incheon' });
  const first = await postJson(`/api/charts/${chart.body.id}/questions`, { question: '안녕' });
  return { chartId: chart.body.id, conversationId: first.body.conversationId };
}

test('GET /api/conversations/:id/opening-choices — AI 호출 없이 선택지를 반환한다', async () => {
  const { conversationId } = await createChartAndConversation();
  const { status, body } = await getJson(`/api/conversations/${conversationId}/opening-choices`);
  assert.equal(status, 200);
  assert.ok(body.choices.length >= 3);
  assert.ok(body.character.id);
});

test('실제 사용자 리포트 버그 (2026-08-18): catalog-choice로 바뀐 캐릭터가 이후 자유입력에서도 유지된다', async () => {
  const { conversationId } = await createChartAndConversation();
  const opening = await getJson(`/api/conversations/${conversationId}/opening-choices`);
  const mangguChoice = opening.body.choices.find((c) => c.character === 'manggu');
  assert.ok(mangguChoice, 'test setup: 맹구가 붙은 선택지가 opening-choices에 있어야 함');

  const catalogResult = await postJson(`/api/conversations/${conversationId}/catalog-choice`, { catalogId: mangguChoice.id });
  assert.equal(catalogResult.body.character.id, 'manggu');

  // 버그 재현: 수정 전에는 아래 자유입력이 다시 daegu로 돌아갔음.
  const freeText = await postJson(`/api/conversations/${conversationId}/messages`, { question: '재물운은 어때?' });
  assert.equal(freeText.body.character.id, 'manggu');
  assert.equal(freeText.body.intent, 'saju_question');
});

test('POST /api/conversations/:id/catalog-choice — 카탈로그 선택 시 정상 응답 + 다음 선택지를 반환한다', async () => {
  const { conversationId } = await createChartAndConversation();
  const opening = await getJson(`/api/conversations/${conversationId}/opening-choices`);
  const chosenId = opening.body.choices[0].id;

  const { status, body } = await postJson(`/api/conversations/${conversationId}/catalog-choice`, { catalogId: chosenId });
  assert.equal(status, 200);
  assert.equal(body.userDisplayText, getCatalogEntry(chosenId).display_text);
  assert.ok(body.response.length > 0);
  assert.ok(Array.isArray(body.nextChoices));
});

test('POST /api/conversations/:id/catalog-choice — 존재하지 않는 catalogId는 400', async () => {
  const { conversationId } = await createChartAndConversation();
  const { status, body } = await postJson(`/api/conversations/${conversationId}/catalog-choice`, { catalogId: 'nonexistent_id' });
  assert.equal(status, 400);
  assert.equal(body.error.code, 'CATALOG_ENTRY_NOT_FOUND');
});

test('§Phase3 정책변경: 사주 질문이어도 로그인하지 않았으면 sources/cross_analysis 없이 차단 안내를 반환한다(기존 "무료 채팅" 계약은 최종 상품 정책으로 대체됨)', async () => {
  const { conversationId } = await createChartAndConversation();
  const { status, body } = await postJson(`/api/conversations/${conversationId}/messages`, { question: '내 대운이 궁금해' });
  assert.equal(status, 200);
  assert.equal(body.intent, 'saju_question');
  assert.equal(body.sources, null, '권한 없음 = 분석 호출 자체가 없었으므로 sources도 없어야 함');
  assert.equal(body.cross_analysis, null);
  assert.ok(body.response, '차단 시에도 안내 메시지 자체는 있어야 함(빈 응답 아님)');
  // 로그인 + 실제 SAJU_DETAIL entitlement 보유 시 정상 허용되는 경로는 이 테스트 하네스(순수
  // express 앱, attachSession 미들웨어 없음)로는 재현할 수 없다 — 실제 Postgres 세션+entitlement가
  // 필요하다. tests/44-entitlement-authorization.test.mjs에 코드 레벨 검증이 있고, 최종 E2E는
  // 로컬에서 실제 DB로 확인 필요(보고서에 명시).
});

test('POST /api/conversations/:id/messages — 일상 대화면 intent=casual, AI 사용량 없음(usage=null)', async () => {
  const { conversationId } = await createChartAndConversation();
  const { status, body } = await postJson(`/api/conversations/${conversationId}/messages`, { question: '오늘 점심 뭐 먹지' });
  assert.equal(status, 200);
  assert.equal(body.intent, 'casual');
  assert.equal(body.usage, null);
  assert.equal(body.sources, null);
});

test('§실측 버그 수정 확인: free:true 카탈로그 항목은 비로그인이어도 차단되지 않는다(이전엔 무료라고 표시된 항목도 무조건 차단되던 실제 버그였음)', async () => {
  const { conversationId } = await createChartAndConversation();
  const opening = await getJson(`/api/conversations/${conversationId}/opening-choices`);
  const chosenId = opening.body.choices[0].id;
  const { body } = await postJson(`/api/conversations/${conversationId}/catalog-choice`, { catalogId: chosenId });
  assert.ok(!body.response.includes('로그인'), '오프닝 카탈로그 항목은 free:true이므로 비로그인이어도 정상 응답이 나와야 함(§실측 버그 수정)');
  // 자유입력(free 카탈로그도 아니고 서비스 진입 의도도 아닌 일반 분석 질문)은 여전히
  // 기존과 동일하게 authorization을 거쳐 비로그인이면 차단된다 — 이번 수정은 free 카탈로그
  // 항목과 서비스 진입 발화에만 영향을 준다.
  const freeText = await postJson(`/api/conversations/${conversationId}/messages`, { question: '내 세운이 궁금해' });
  assert.equal(freeText.body.sources, null, '일반 분석 질문은 여전히 비로그인이면 차단됨(기존 동작 유지)');
});

// ============================================================
// Rate limit (폭탄 메시지 남용 방지) — 별도 app 인스턴스에 실제로 미들웨어를 붙여서 검증
// ============================================================

test('rate-limit 미들웨어: 짧은 시간에 버스트 한도를 넘으면 429가 반환된다', async () => {
  const { burstLimiter } = await import('../apps/api/src/middleware/rate-limit.mjs');
  const rlApp = express();
  rlApp.use(express.json());
  rlApp.use('/api/conversations/:id/messages', burstLimiter);
  rlApp.use('/api/conversations', conversationsRouter({ aiProviderFactory: () => new MockAIProvider(), model: 'mock' }));
  rlApp.use('/api/charts', chartsRouter({ aiProviderFactory: () => new MockAIProvider(), model: 'mock' }));

  const rlServer = await new Promise((resolve) => {
    const s = rlApp.listen(0, () => resolve(s));
  });
  const rlBaseUrl = `http://localhost:${rlServer.address().port}`;

  try {
    const chart = await fetch(`${rlBaseUrl}/api/charts`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ birthDate: '2026-08-06', birthTime: '10:59', gender: 'male', city: 'Incheon' }),
    }).then((r) => r.json());
    const first = await fetch(`${rlBaseUrl}/api/charts/${chart.id}/questions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ question: '안녕' }),
    }).then((r) => r.json());

    const statuses = [];
    for (let i = 0; i < 8; i++) {
      const res = await fetch(`${rlBaseUrl}/api/conversations/${first.conversationId}/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question: `폭탄 메시지 ${i}` }),
      });
      statuses.push(res.status);
    }
    assert.ok(statuses.some((s) => s === 429), `버스트 한도(10초에 5회)를 넘겼는데 429가 한 번도 없음: ${statuses}`);
    assert.ok(statuses.filter((s) => s === 200).length <= 5, '버스트 한도 이내(5회)만 통과해야 함');
  } finally {
    await new Promise((resolve) => rlServer.close(resolve));
  }
});
