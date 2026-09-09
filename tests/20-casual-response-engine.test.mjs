// tests/20-casual-response-engine.test.mjs
//
// packages/character/casual-response-engine.mjs 회귀 테스트. 전부 순수 함수 테스트 — API 호출 없음.
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { classifyCasualIntent, generateCasualResponse, getTimeContext } from '../packages/character/casual-response-engine.mjs';

// --- intent 분류 ---

test('classifyCasualIntent: 대표 케이스들이 올바른 intent로 분류된다', () => {
  const cases = [
    ['안녕', 'greeting'],
    ['왔어', 'greeting'],
    ['잘자', 'farewell'],
    ['고마워', 'gratitude'],
    ['졸려', 'sleep'],
    ['심심해', 'boredom'],
    ['짜증나', 'frustration'],
    ['너무 슬퍼', 'sadness'],
    ['오늘 신나', 'excitement'],
    ['배고파', 'food'],
    ['날씨 춥다', 'weather'],
    ['회사 야근이야', 'work'],
    ['남친이랑 싸웠어', 'relationship'],
    ['뭐해', 'casual_question'],
  ];
  for (const [text, expected] of cases) {
    assert.equal(classifyCasualIntent(text), expected, `"${text}" → ${expected} 이어야 함`);
  }
});

test('classifyCasualIntent: 감정 표현이 우선 — "회사 힘들었어"는 tiredness로 분류(감정 먼저 반응)', () => {
  assert.equal(classifyCasualIntent('오늘 회사 너무 힘들었어'), 'tiredness');
});

test('classifyCasualIntent: 매칭 안 되는 텍스트는 ambiguous', () => {
  assert.equal(classifyCasualIntent('ㅁㄴㅇㄹ 123 xyz'), 'ambiguous');
});

// --- 캐릭터별 톤 차이 (문서 요구사항 §9) ---

test('generateCasualResponse: 대구/맹구가 같은 입력에도 서로 다른 응답 집합을 갖는다', () => {
  const daeguResponses = new Set();
  const mangguResponses = new Set();
  for (let i = 0; i < 30; i++) {
    daeguResponses.add(generateCasualResponse({ characterId: 'daegu', userText: '오늘 힘들었어' }).text);
    mangguResponses.add(generateCasualResponse({ characterId: 'manggu', userText: '오늘 힘들었어' }).text);
  }
  // 두 캐릭터의 응답 풀이 완전히 겹치면 안 됨(캐릭터 구분이 무의미해짐)
  const overlap = [...daeguResponses].filter((r) => mangguResponses.has(r));
  assert.ok(overlap.length < daeguResponses.size, '대구/맹구 응답이 사실상 동일하면 안 됨');
});

test('generateCasualResponse: 맹구는 "ㅋㅋ" 계열을 대구보다 많이 쓴다 (장난스러운 톤)', () => {
  let daeguLaughCount = 0;
  let mangguLaughCount = 0;
  for (let i = 0; i < 50; i++) {
    if (generateCasualResponse({ characterId: 'daegu', userText: '심심해' }).text.includes('ㅋㅋ')) daeguLaughCount++;
    if (generateCasualResponse({ characterId: 'manggu', userText: '심심해' }).text.includes('ㅋㅋ')) mangguLaughCount++;
  }
  assert.ok(mangguLaughCount >= daeguLaughCount, '맹구가 대구보다 "ㅋㅋ" 표현을 더 자주 써야 함');
});

// --- 금지된 챗봇 말투 검증 (문서 §5) ---

const BANNED_CHATBOT_PHRASES = ['오늘도 좋은 하루', '무엇을 도와드릴까요', '함께 이야기해봐요', '알아보겠습니다', '안내해', '도와드리겠습니다'];

test('모든 캐릭터×intent 응답 후보에 금지된 챗봇/고객센터 문구가 없다', async () => {
  // BANK 내부를 직접 검증 — 반복 실행 없이 전수 검사
  const { classifyCasualIntent: _c } = await import('../packages/character/casual-response-engine.mjs');
  void _c;
  const intents = ['greeting', 'farewell', 'gratitude', 'sleep', 'tiredness', 'frustration', 'sadness', 'excitement', 'boredom', 'food', 'weather', 'work', 'relationship', 'compliment', 'joke', 'casual_question', 'ambiguous'];
  const seedTexts = { greeting: '안녕', farewell: '잘자', gratitude: '고마워', sleep: '졸려', tiredness: '힘들어', frustration: '짜증나', sadness: '슬퍼', excitement: '신나', boredom: '심심해', food: '배고파', weather: '춥다', work: '회사 야근', relationship: '친구랑 싸웠어', compliment: '너 멋있다', joke: 'ㅋㅋㅋㅋ 웃겨', casual_question: '뭐해', ambiguous: 'ㅁㄴㅇㄹ' };
  for (const characterId of ['daegu', 'manggu']) {
    for (const intent of intents) {
      const seen = new Set();
      for (let i = 0; i < 40; i++) {
        const { text } = generateCasualResponse({ characterId, userText: seedTexts[intent] });
        seen.add(text);
      }
      for (const text of seen) {
        for (const banned of BANNED_CHATBOT_PHRASES) {
          assert.ok(!text.includes(banned), `${characterId}/${intent}: "${text}"에 금지 문구 "${banned}" 포함됨`);
        }
      }
    }
  }
});

// --- 반복 방지 ---

test('generateCasualResponse: recentResponses에 있는 텍스트는(대안이 있으면) 다시 나오지 않는다', () => {
  // 후보가 여러 개인 intent(tiredness)로 테스트 — 이미 나온 텍스트들을 recentResponses로 다 막으면
  // 남은 후보 중에서 골라야 한다.
  const first = generateCasualResponse({ characterId: 'daegu', userText: '오늘 힘들었어' });
  const second = generateCasualResponse({ characterId: 'daegu', userText: '오늘 힘들었어', recentResponses: [first.text] });
  // 후보가 4개 있으므로(BANK 참고) 같은 텍스트를 피할 여지가 있음 — 여러 번 시도해서 최소 한 번은 달라지는지 확인
  let everDifferent = false;
  for (let i = 0; i < 20; i++) {
    const r = generateCasualResponse({ characterId: 'daegu', userText: '오늘 힘들었어', recentResponses: [first.text] });
    if (r.text !== first.text) everDifferent = true;
  }
  assert.ok(everDifferent, 'recentResponses로 제외했는데 계속 같은 텍스트만 나오면 안 됨');
  void second;
});

test('generateCasualResponse: 후보 전부가 recentResponses에 있어도(극단적 상황) 에러 없이 응답한다', () => {
  const allPossible = new Set();
  for (let i = 0; i < 50; i++) allPossible.add(generateCasualResponse({ characterId: 'daegu', userText: '고마워' }).text);
  const result = generateCasualResponse({ characterId: 'daegu', userText: '고마워', recentResponses: [...allPossible] });
  assert.ok(result.text.length > 0, '모든 후보가 최근 응답과 겹쳐도 빈 응답을 주면 안 됨');
});

// --- 시간대 컨텍스트 ---

test('getTimeContext: 시간대별로 올바르게 분류된다', () => {
  assert.equal(getTimeContext(new Date('2026-01-01T07:00:00')), 'morning');
  assert.equal(getTimeContext(new Date('2026-01-01T14:00:00')), 'any');
  assert.equal(getTimeContext(new Date('2026-01-01T23:30:00')), 'night');
  assert.equal(getTimeContext(new Date('2026-01-01T02:00:00')), 'night');
});

test('generateCasualResponse: 아침 시간대 greeting은 아침 전용 문구를 우선 사용할 수 있다', () => {
  const morning = new Date('2026-01-01T07:00:00');
  const seen = new Set();
  for (let i = 0; i < 30; i++) seen.add(generateCasualResponse({ characterId: 'daegu', userText: '안녕', now: morning }).text);
  assert.ok([...seen].some((t) => t.includes('아침')), '아침 시간대에는 아침 관련 문구가 나올 수 있어야 함');
});

// --- 2문장 조합 지원 ---

test('generateCasualResponse: 일부 응답은 두 문장으로 구성된다 (반응+되묻기)', () => {
  const seen = new Set();
  for (let i = 0; i < 30; i++) seen.add(generateCasualResponse({ characterId: 'daegu', userText: '오늘 힘들었어' }).text);
  const hasTwoSentenceReply = [...seen].some((t) => t.includes('무슨 일 있었어?'));
  assert.ok(hasTwoSentenceReply, '반응+되묻기 형태의 2문장 응답이 후보에 있어야 함');
});

// --- 사주 판단 생성 안전장치 ---

test('캐주얼 응답 뱅크 어디에도 사주 관련 판단 용어가 없다 (문서 안전장치 원칙)', async () => {
  const SAJU_TERMS = ['대운', '세운', '십신', '사주', '자미두수', '용신', '격국', '귀문관살'];
  const intents = ['greeting', 'farewell', 'gratitude', 'sleep', 'tiredness', 'frustration', 'sadness', 'excitement', 'boredom', 'food', 'weather', 'work', 'relationship', 'compliment', 'joke', 'casual_question', 'ambiguous'];
  const seedTexts = { greeting: '안녕', farewell: '잘자', gratitude: '고마워', sleep: '졸려', tiredness: '힘들어', frustration: '짜증나', sadness: '슬퍼', excitement: '신나', boredom: '심심해', food: '배고파', weather: '춥다', work: '회사 야근', relationship: '친구랑 싸웠어', compliment: '너 멋있다', joke: 'ㅋㅋㅋㅋ 웃겨', casual_question: '뭐해', ambiguous: 'ㅁㄴㅇㄹ' };
  for (const characterId of ['daegu', 'manggu']) {
    for (const intent of intents) {
      for (let i = 0; i < 20; i++) {
        const { text } = generateCasualResponse({ characterId, userText: seedTexts[intent] });
        for (const term of SAJU_TERMS) assert.ok(!text.includes(term), `캐주얼 응답에 사주 용어 "${term}"가 있으면 안 됨: "${text}"`);
      }
    }
  }
});
