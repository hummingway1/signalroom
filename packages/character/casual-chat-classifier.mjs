// packages/character/casual-chat-classifier.mjs
//
// 문서 §13/§14 — 일상 대화와 사주 질문을 분리한다. §17 원칙대로 처음부터 AI 분류기를 만들지 않고
// rule-based로 시작한다 (필요하면 나중에 교체 가능하도록 함수 시그니처만 안정적으로 유지).

const SAJU_INTENT_MARKERS = [
  '사주', '자미두수', '명리', '대운', '세운', '궁합', '귀문관살', '운세', '팔자',
  '타고난', '천간', '지지', '오행', '십신', '용신', '격국', '명궁',
  // 2026-08-18 실제 사용자 테스트에서 발견된 버그: "재물운은 어때? 올해"가 casual로 잘못 분류됨
  // — "OO운" 형태의 운세 질문이 목록에 전혀 없었다. 자주 쓰이는 것들을 명시적으로 추가.
  '재물운', '연애운', '금전운', '직업운', '건강운', '결혼운', '이별운', '취업운', '학업운', '인연운', '행운',
];

// "OO운"(2글자 이상 한글 단어 + 운) 형태를 일반적으로 잡아낸다 — 위 명시적 목록에 없는 새로운 조합
// (예: "이직운", "합격운")도 놓치지 않기 위한 보강. "운동"/"운영"처럼 "운"이 앞에 오는 단어는 이
// 패턴에 걸리지 않는다(패턴이 [한글]+운 순서이므로).
const FORTUNE_SUFFIX_PATTERN = /[가-힣]운(?=[은는이가야다요]|\?|$|\s)/;

// "올해"/"내년"/"작년" 같은 시점 표현은 그 자체로는 애매하지만("올해 여행가고 싶어"), 위 SAJU_INTENT
// 마커나 FORTUNE_SUFFIX_PATTERN과 **함께** 나오면 이미 saju_question으로 분류되므로 별도 처리 불필요.

// "~게 맞아?"/"~일까?" 같은 결정을 묻는 어미와 결합되면 사주 판단 요청일 가능성이 높음
// (문서 §13 예시: "내가 회사를 그만두는 게 사주상 맞아?").
const DECISION_QUESTION_PATTERN = /(맞아|일까|해도 될까|가 될까)\??$/;

/**
 * @param {string} text - 사용자 자유 입력
 * @returns {'saju_question'|'casual'}
 */
export function classifyMessage(text) {
  const trimmed = text.trim();
  if (SAJU_INTENT_MARKERS.some((m) => trimmed.includes(m))) return 'saju_question';
  if (FORTUNE_SUFFIX_PATTERN.test(trimmed)) return 'saju_question';
  if (DECISION_QUESTION_PATTERN.test(trimmed) && trimmed.length > 8) return 'saju_question';
  return 'casual';
}
