// packages/character/casual-response-engine.mjs
//
// API 호출 0회로 동작하는 일상 대화 응답 엔진. "챗봇처럼 정형적인" 5개 고정 문구를 대체한다.
//
// 설계: character × intent × tone × timeContext 조합에서 variant를 뽑는다. 전부 rule-based —
// AI 호출 없음(§17 원칙 유지, 문서 §4 "일상대화는 API 호출을 하지 않는다").
//
// 절대 원칙: 이 엔진은 사주 판단을 만들지 않는다. intent 분류는 이미 casualAI로 분류된("casual")
// 메시지에 대해서만 2차로 세분류하는 것이지, saju_question 여부를 다시 판단하지 않는다
// (그건 casual-chat-classifier.mjs의 책임 그대로 유지).
//
// 말투 조사 방법: 특정 사이트/커뮤니티 문장을 그대로 옮기지 않고, 20~30대 한국어 메신저 대화의
// 구조적 패턴(짧은 문장, 어미 생략, 추임새, 되묻기)만 추상화해서 자체 템플릿을 작성했다. 오래되었거나
// 특정 커뮤니티 전용 은어는 배제하고 "ㅋㅋ/ㅠㅠ/헐/오/아/음/엥/앗"처럼 수명이 긴 표현만 사용한다.

// ============================================================
// 1. Intent 분류 (rule-based, 2차 분류 — casual로 판별된 메시지 안에서만 동작)
// ============================================================

const INTENT_PATTERNS = [
  // 순서가 우선순위 — 위에서부터 먼저 매칭되는 것으로 분류
  { intent: 'gratitude', patterns: ['고마워', '고맙', '감사'] },
  { intent: 'farewell', patterns: ['잘자', '잘 자', '갈게', '나갈게', '끊을게', '자야', '자러'] },
  { intent: 'greeting', patterns: ['안녕', '왔어', '하이', '헬로'] },
  { intent: 'sleep', patterns: ['졸려', '졸리', '잠와', '잠이 와', '피곤해서 자'] },
  { intent: 'tiredness', patterns: ['피곤', '지쳐', '힘들', '빡세', '빡셌'] },
  { intent: 'frustration', patterns: ['짜증', '빡쳐', '화나', '화나다', '열받'] },
  { intent: 'sadness', patterns: ['슬퍼', '우울', 'ㅠㅠ', '눈물', '속상'] },
  { intent: 'excitement', patterns: ['신나', '설레', '기대돼', '기대된다', '개좋'] },
  { intent: 'boredom', patterns: ['심심', '지루', '할거없', '할 거 없'] },
  { intent: 'food', patterns: ['배고', '밥', '먹었', '점심', '저녁', '야식', '치킨', '떡볶이'] },
  { intent: 'weather', patterns: ['날씨', '춥다', '더워', '비온다', '비 온다', '눈온다', '눈 온다'] },
  { intent: 'work', patterns: ['회사', '일이', '업무', '야근', '출근', '퇴근', '상사', '팀장'] },
  { intent: 'relationship', patterns: ['친구', '남친', '여친', '남자친구', '여자친구', '싸웠', '연락'] },
  { intent: 'compliment', patterns: ['너 좋다', '너 대박', '귀엽다', '멋있다', '최고야'] },
  { intent: 'joke', patterns: ['ㅋㅋㅋㅋ', '웃겨', '개웃김', '드립'] },
  { intent: 'casual_question', patterns: ['뭐해', '뭐하냐', '뭐 해', '뭐하고 있어', '뭐하는 중'] },
];

/**
 * @param {string} text - 사용자 메시지 (이미 casual로 1차 분류된 것)
 * @returns {string} intent
 */
export function classifyCasualIntent(text) {
  const trimmed = text.trim();
  for (const { intent, patterns } of INTENT_PATTERNS) {
    if (patterns.some((p) => trimmed.includes(p))) return intent;
  }
  return 'ambiguous';
}

// ============================================================
// 2. 시간대 컨텍스트
// ============================================================

export function getTimeContext(date = new Date()) {
  const hour = date.getHours();
  if (hour >= 5 && hour < 10) return 'morning';
  if (hour >= 23 || hour < 5) return 'night';
  return 'any';
}

// ============================================================
// 3. 응답 뱅크 — character × intent × variant[]
//    variant.lines: 1문장 또는 2문장(배열). variant.timeContext: 'any'|'morning'|'night'(생략 시 any)
// ============================================================

const BANK = {
  daegu: {
    greeting: [
      { lines: ['어, 왔네.'] },
      { lines: ['왔어?'] },
      { lines: ['오늘은 좀 일찍 왔네.'] },
      { lines: ['어 왔구나.', '무슨 일 있어?'] },
      { lines: ['아침부터 왔네.'], timeContext: 'morning' },
      { lines: ['이 시간에 웬일이야.'], timeContext: 'night' },
    ],
    farewell: [
      { lines: ['어, 가.'] },
      { lines: ['그래, 다음에 또 얘기하자.'] },
      { lines: ['잘 자.'], timeContext: 'night' },
      { lines: ['조심히 가.'] },
    ],
    gratitude: [
      { lines: ['뭘 이런 걸 가지고.'] },
      { lines: ['별거 아니야.'] },
      { lines: ['그래, 됐어.'] },
    ],
    sleep: [
      { lines: ['졸리면 자.'] },
      { lines: ['자야지, 이 시간에.'], timeContext: 'night' },
      { lines: ['많이 졸린가보네.'] },
    ],
    tiredness: [
      { lines: ['아… 오늘 좀 빡셌나보네.', '무슨 일 있었어?'] },
      { lines: ['많이 힘들었구나.'] },
      { lines: ['그래, 오늘은 좀 쉬어.'] },
      { lines: ['피곤할 만하네.', '뭐 때문에 그래?'] },
    ],
    frustration: [
      { lines: ['왜, 뭔 일인데.'] },
      { lines: ['화날 만했나보네.'] },
      { lines: ['진정하고, 무슨 일이야.'] },
    ],
    sadness: [
      { lines: ['왜, 무슨 일 있었어.'] },
      { lines: ['속상한 일 있었구나.'] },
      { lines: ['괜찮아?'] },
    ],
    excitement: [
      { lines: ['오, 뭔데?'] },
      { lines: ['좋은 일 있나보네.'] },
      { lines: ['기분 좋아 보이는데.'] },
    ],
    boredom: [
      { lines: ['심심하면 얘기해.'] },
      { lines: ['그럼 나랑 얘기하자.'] },
      { lines: ['할 거 없으면 딴 거 볼래?'] },
    ],
    food: [
      { lines: ['뭐 먹었는데.'] },
      { lines: ['배고프면 뭐라도 먹어.'] },
      { lines: ['맛있는 거 먹었어?'] },
    ],
    weather: [
      { lines: ['그러네, 오늘 날씨가 좀 그렇지.'] },
      { lines: ['날씨 얘기하니까 갑자기 밖에 나가고 싶다.'] },
    ],
    work: [
      { lines: ['일이 많았나보네.'] },
      { lines: ['회사 일이야?'] },
      { lines: ['아 그게 제일 지치지.', '계속 쌓이는 느낌이라.'] },
    ],
    relationship: [
      { lines: ['무슨 일 있었어?'] },
      { lines: ['그 얘기 좀 더 해봐.'] },
    ],
    compliment: [
      { lines: ['갑자기 왜 이래.'] },
      { lines: ['고마워, 너도.'] },
    ],
    joke: [
      { lines: ['뭔데 그게.'] },
      { lines: ['뭐야, 갑자기.'] },
    ],
    casual_question: [
      { lines: ['그냥 있어.'] },
      { lines: ['너 기다리고 있었지.'] },
      { lines: ['별거 안 해.'] },
    ],
    ambiguous: [
      { lines: ['그래?'] },
      { lines: ['음, 그런가.'] },
      { lines: ['그렇구나.'] },
    ],
  },

  manggu: {
    greeting: [
      { lines: ['왔어.'] },
      { lines: ['오 왔네?'] },
      { lines: ['오잉 오늘 웬일로 일찍 왔어 ㅋㅋ'] },
      { lines: ['어 안녕 ㅋㅋ'] },
      { lines: ['아침부터 왔네 ㅋㅋ'], timeContext: 'morning' },
      { lines: ['이 시간에? ㅋㅋ 안 자?'], timeContext: 'night' },
    ],
    farewell: [
      { lines: ['어 가?'] },
      { lines: ['ㅇㅋ 담에 또 와.'] },
      { lines: ['잘 자 ㅋㅋ'], timeContext: 'night' },
    ],
    gratitude: [
      { lines: ['ㅋㅋ 뭘.'] },
      { lines: ['오 고마워하기는.'] },
      { lines: ['별걸 다 고마워하네 ㅋㅋ'] },
    ],
    sleep: [
      { lines: ['졸리면 자야지 ㅋㅋ'] },
      { lines: ['오 벌써 졸려?'] },
    ],
    tiredness: [
      { lines: ['헐 오늘 왜 ㅋㅋ', '무슨 일 있었는데'] },
      { lines: ['아 힘들었겠다.'] },
      { lines: ['오늘 진짜 빡셌나보네 ㅋㅋ'] },
    ],
    frustration: [
      { lines: ['헐 뭔데 뭔데'] },
      { lines: ['왜 왜, 무슨 일이야'] },
      { lines: ['오잉 화났어?'] },
    ],
    sadness: [
      { lines: ['헐... 왜 무슨 일이야'] },
      { lines: ['아 진짜? 괜찮아?'] },
    ],
    excitement: [
      { lines: ['오 뭔데 뭔데 ㅋㅋ'] },
      { lines: ['오오 좋은 일 있어?'] },
      { lines: ['헐 뭐야 신나 보이는데'] },
    ],
    boredom: [
      { lines: ['ㅋㅋ 나도 심심한데'] },
      { lines: ['그럼 나랑 놀자'] },
    ],
    food: [
      { lines: ['오 뭐 먹었어?'] },
      { lines: ['배고파? ㅋㅋ 뭐라도 먹어'] },
    ],
    weather: [
      { lines: ['아 오늘 그렇지 ㅋㅋ'] },
      { lines: ['날씨 얘기하니까 나가고 싶다 ㅋㅋ'] },
    ],
    work: [
      { lines: ['헐 오늘 왜 ㅋㅋ', '무슨 일 있었는데'] },
      { lines: ['아 그럼 진짜 귀찮았겠다 ㅋㅋ', '오늘은 좀 쉬어'] },
      { lines: ['회사 얘기만 나오면 한숨부터 나오네 ㅋㅋ'] },
    ],
    relationship: [
      { lines: ['헐 뭔 일이야'] },
      { lines: ['오 무슨 일인데, 말해봐'] },
    ],
    compliment: [
      { lines: ['오잉 왜 이래 ㅋㅋ'] },
      { lines: ['ㅋㅋㅋ 고마워'] },
    ],
    joke: [
      { lines: ['ㅋㅋㅋㅋ 뭔데'] },
      { lines: ['헐 뭐야 그게'] },
    ],
    casual_question: [
      { lines: ['그냥 있지 ㅋㅋ'] },
      { lines: ['너 기다렸지'] },
      { lines: ['별거 안 해 ㅋㅋ'] },
    ],
    ambiguous: [
      { lines: ['오 그래?'] },
      { lines: ['음 그런가 ㅋㅋ'] },
      { lines: ['오잉 그렇구나'] },
    ],
  },
};

// ============================================================
// 4. 선택 로직 — 반복 방지 (직전 1~3개 응답과 겹치지 않게)
// ============================================================

function variantKey(variant) {
  return variant.lines.join('|');
}

/** 최근 사용한 응답(텍스트)과 겹치지 않는 후보 중에서 고른다. 전부 겹치면(후보가 너무 적을 때)
 * 어쩔 수 없이 재사용을 허용한다 — 완전히 응답을 못 주는 것보다는 낫다. */
function pickVariant(candidates, recentTexts) {
  const fresh = candidates.filter((v) => !recentTexts.includes(variantKey(v)));
  const pool = fresh.length > 0 ? fresh : candidates;
  return pool[Math.floor(Math.random() * pool.length)];
}

/**
 * @param {object} params
 * @param {string} params.characterId - 'daegu' | 'manggu'
 * @param {string} params.userText - 사용자 메시지
 * @param {string[]} [params.recentResponses] - 최근 사용한 캐주얼 응답 텍스트(반복 방지용, 대화별로 관리)
 * @param {Date} [params.now]
 * @returns {{ intent: string, text: string }}
 */
export function generateCasualResponse({ characterId, userText, recentResponses = [], now = new Date() }) {
  const intent = classifyCasualIntent(userText);
  const timeContext = getTimeContext(now);
  const characterBank = BANK[characterId] ?? BANK.daegu;
  const intentBank = characterBank[intent] ?? characterBank.ambiguous;

  // 시간대에 맞는 것 우선(timeContext 지정된 것 + 'any') — 없으면 전체 후보로 폴백.
  const timeMatched = intentBank.filter((v) => !v.timeContext || v.timeContext === timeContext);
  const candidates = timeMatched.length > 0 ? timeMatched : intentBank;

  const chosen = pickVariant(candidates, recentResponses);
  return { intent, text: chosen.lines.join(' ') };
}
