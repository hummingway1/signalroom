// packages/character/casual-chat-prompt.mjs
//
// 캐주얼 리액션 + "우리 아이 성장 코치"(child context 대화) system prompt.
//
// v3 재설계(승인된 설계): "질문에 특정 단어가 들어갔는가"가 아니라 "이 프로필 재료가 실제 답변에
// 도움이 되는가"를 판정한다. 핵심 흐름:
//   질문 → ① target(parent/child/relationship) → ② intent(why/how/concern/sharing/simple)
//        → ③ 큐레이션 situation/concept 태그 매칭(1차 필터, LLM 호출 없음)
//        → ④ personalization depth(NONE/LIGHT/FOCUSED/DEEP)
//        → ⑤ depth에 맞는 만큼만 재료를 꺼냄(전체 프로필을 절대 한꺼번에 안 줌)
// target≠'child'면(부모 자신에 대한 질문 등) depth는 무조건 NONE — 프로필 문자열이 프롬프트에
// 단 한 조각도 들어가지 않는다.

import { getCharacter } from './characters.mjs';
import { matchBehavioralEvidence } from './behavioral-evidence/index.mjs';

export const CASUAL_MESSAGE_MAX_LENGTH = 300;

const MEDICAL_OR_SAFETY_KEYWORDS = ['열이', '열나', '아파', '아프', '다쳤', '다침', '병원', '응급실', '구토', '설사', '코피', '숨쉬기', '알레르기', '약을', '119'];

export function isMedicalOrSafetyTopic(text) {
  return MEDICAL_OR_SAFETY_KEYWORDS.some((kw) => text.includes(kw));
}

export function buildCasualUserMessage(text, recentMessages = []) {
  const recent = recentMessages.slice(-6);
  if (recent.length === 0) return truncateForCasual(text);
  const historyText = recent.map((m) => `${m.role === 'user' ? '부모' : '너'}: ${m.content}`).join('\n');
  return `[최근 대화]\n${historyText}\n\n[지금 질문]\n${truncateForCasual(text)}`;
}

// ============================================================
// ① Target 판정 — 부모 자신에 대한 질문은 depth를 아예 계산하지 않고 즉시 NONE으로 종결한다.
//
// v3.1 재설계(BUG-1/BUG-3 수정): 순서 고정 정규식(부정목록) 대신 "신호 조합"으로 판정한다.
//   1. 부모 자기서술 = (자기서술 주어 신호) AND (감정/행동/자기평가 서술어 신호) — 순서 무관하게
//      문장 안에 둘 다 있으면 parent. "숙제 얘기만 나오면 저도 모르게 소리를 질러요"처럼 주어가
//      뒤에 오는 문장도 잡기 위해 각각 독립적으로 test한다.
//      단, "지쳐요/힘들어요" 같은 감정 서술어는 한국어 무주어 발화 관례상 주어 없이도 화자(부모)
//      자신을 가리키는 게 일반적이므로, 명시적으로 "아이가/애가"가 그 서술어를 직접 수식하지 않는
//      한 예외적으로 주어 없이도 parent로 판정한다.
//   2. relationship(순수 대사 요청) = 대사 요청 패턴이 매칭되고, 동시에 "지금 문장에 구체적인 아이
//      상황 묘사가 없을 때"만 성립한다 — situation/concept 태그가 매칭되거나, 아이 행동을 묘사하는
//      서술어(울어요/짜증/난리 등, 태그 매칭과 별개로 target 판정 전용 큐레이션)가 있으면 child가
//      우선한다. "아까/그때" 같은 과거 참조 신호가 있으면 상황 묘사가 있어도 relationship을 유지
//      (이미 다룬 화제를 다시 설명하지 않고 이전 대화 맥락에 의존하게 하기 위함).
// ============================================================

const PARENT_SELF_SUBJECT_PATTERN = /(제가|저는|저도|내가|나는)/;
const PARENT_SELF_ACTION_PREDICATE = /(화를? ?내|화내|화도\s*자주\s*내|소리를? ?질러|잘하고 있|심하게|엄격한|잘못하고 있|너무한가요|예민해진|육아를? ?잘|자신이\s*없)/;
// 주어 없이도 화자(부모) 자기서술로 간주하는 감정 상태 서술어(한국어 무주어 발화 관례). TASK2:
// 지치고/힘들고/버거워 같은 흔한 활용형을 최소 추가(형태소 분석기 없이 리터럴 변형만 보강).
const PARENT_SELF_STATE_PREDICATE = /(너무 ?지쳐|지쳐요|지치고|힘들어요|힘들고|불안해요|걱정돼요|후회돼요|번아웃|버거워|버겁)/;
// TASK2 수정: 이전엔 "아이가"가 서술어 "바로 앞"에 있을 때만 예외 처리해서, "아이가 말을 안 들어서
// 너무 힘들어요"처럼 중간에 절이 낀 문장을 못 잡았다. 이제 "아이가/애가"가 문장 어디에 있든(주어로
// 아이가 등장), 또는 아이 행동을 묘사하는 서술어(CHILD_BEHAVIOR_DESCRIPTOR)가 있으면 "아이 상황
// 보고"로 보고 child 쪽에 무게를 둔다 — 단, "제가/내가" 같은 명시적 부모 주어가 함께 있으면 그게
// 우선한다(부모가 스스로를 화자로 명시했기 때문).
const EXPLICIT_CHILD_SUBJECT_ANYWHERE = /(아이가|애가|우리\s*애가)/;

// 두 조건(주어+서술어 명시적 자기서술, 무주어 감정상태 서술)은 classifyTarget 안에서 순서대로
// 검사한다(relationship-interaction 신호 체크가 그 사이에 끼어들어야 하므로 하나의 함수로 합치지
// 않는다 — 아래 classifyTarget 참고).

const RELATIONSHIP_ASK_PATTERNS = [/뭐라고\s*말해야|어떻게\s*말해야|뭐라고\s*해야|어떻게\s*해야|뭐라고\s*할까요|어떻게\s*할까요/];
// 과거 참조(이미 다룬 화제) — 있으면 상황 묘사가 있어도 relationship 유지.
const PAST_REFERENCE_PATTERN = /아까|그때|저번에|전에\s*말한/;
// 아이 행동을 직접 묘사하는 서술어(태그 매칭과 별개로, target 판정 전용 큐레이션 — 흔한 단어
// "말/아이/안/해" 등은 절대 포함하지 않는다).
const CHILD_BEHAVIOR_DESCRIPTOR = /(울어요|울어서|짜증|난리|싫다고|안\s*하려|거부해요|버텨요|반발|하기\s*싫어|화내|화를?\s*내는)/;

// 개선①(relationship 정밀도): "아이와의 관계/상호작용"이 질문의 중심일 때 relationship으로 잡는다.
// "아이랑"/"아이와"/"아이하고"처럼 리터럴 조사가 아이 바로 뒤에 붙어있을 때만 인정 — "아이가
// 친구와 싸웠어요"처럼 다른 대상과의 상호작용까지 우연히 걸리지 않도록 조사 위치를 엄격히 고정.
const RELATIONSHIP_INTERACTION_SIGNAL = /(아이랑|아이와|아이하고|애랑|애와).{0,10}(싸워|싸우|부딪혀|부딪히|갈등|관계가|대화가|소통이|사이가)|관계가.{0,6}힘들|사이가.{0,6}힘들/;
// 위 신호가 있어도 구체적인 아이 행동(숙제/게임/식사/수면/고집 등)이 질문의 실제 중심이면 child를
// 우선한다("아이랑 숙제 때문에 매일 싸워요" 류 — 상호작용 신호보다 구체 행동이 우선).
const CHILD_ACTION_SIGNAL_STRONG = /(숙제|게임|밥을|잠을|고집을?\s*부려|아침마다)/;

export function classifyTarget(text) {
  if (PARENT_SELF_SUBJECT_PATTERN.test(text) && PARENT_SELF_ACTION_PREDICATE.test(text)) return 'parent';

  if (RELATIONSHIP_INTERACTION_SIGNAL.test(text) && !CHILD_ACTION_SIGNAL_STRONG.test(text)) return 'relationship';

  if (PARENT_SELF_STATE_PREDICATE.test(text)) {
    const hasChildSubjectOrBehavior = EXPLICIT_CHILD_SUBJECT_ANYWHERE.test(text) || CHILD_BEHAVIOR_DESCRIPTOR.test(text);
    const hasExplicitParentSubject = PARENT_SELF_SUBJECT_PATTERN.test(text);
    // 아이 주어/행동 서술이 있고, 부모를 명시적으로 화자로 지목하는 표현이 없으면 — "아이 상황
    // 보고"로 보고 parent로 확정하지 않는다(아래 로직으로 넘어가 결국 child가 됨).
    if (!hasChildSubjectOrBehavior || hasExplicitParentSubject) return 'parent';
  }

  const hasAskPattern = RELATIONSHIP_ASK_PATTERNS.some((p) => p.test(text));
  if (hasAskPattern) {
    const hasPastReference = PAST_REFERENCE_PATTERN.test(text);
    if (hasPastReference) return 'relationship';
    const hasConcreteChildSituation = CHILD_BEHAVIOR_DESCRIPTOR.test(text) || extractTriggeredTags(text, SITUATION_TAG_TRIGGERS).length > 0 || extractTriggeredTags(text, CONCEPT_TAG_TRIGGERS).length > 0;
    return hasConcreteChildSituation ? 'child' : 'relationship';
  }

  return 'child';
}

// ============================================================
// ② Intent 판정
// ============================================================

export function classifyIntent(text) {
  if (/왜\s/.test(text) || text.startsWith('왜')) return 'why';
  if (/어떻게|어떡해|어떡하지|뭐라고/.test(text)) return 'how';
  if (/모르겠어요|걱정|불안/.test(text)) return 'concern';
  if (text.length < 15) return 'simple';
  return 'sharing';
}

// ============================================================
// ③ 큐레이션 태그 트리거 사전 — 사람이 직접 고른 것만. "말/아이/안/해" 같은 흔한 단어는 절대
// 트리거로 넣지 않는다(승인된 설계 원칙). "고집" 같은 개념어는 프로필 원문에 그 단어가 없어도
// concept_tags로 매칭되게 하기 위한 트리거.
// ============================================================

const SITUATION_TAG_TRIGGERS = {
  '숙제': ['숙제'],
  '게임종료': ['게임'],
  '지시': ['시키면', '하라고', '하래', '지시'],
  '비교': ['비교', '형은', '동생은', '누나는', '언니는', '형제'],
  '루틴': ['루틴', '순서', '일정'],
  '일정변경': ['갑자기', '바뀌'],
  '새로운환경': ['새로운', '처음', '첫날', '학원'],
  '표현': ['설명', '어떻게 생각'],
  '평가': ['정답', '맞았'],
};
const CONCEPT_TAG_TRIGGERS = {
  // BUG-2 수정: self-directed 슬롯1의 observable_pattern은 concept_tags를 5개(자기결정/통제/고집/
  // 반항/미룸) 갖고 있어서 나머지 4개 중 하나만 걸려도 매칭되지만, "자기가 하고 싶은 것만 하려고
  // 해요"류 문장은 그 4개 어디에도 안 걸리는 게 실측으로 확인됐다 — 자기결정만 유일하게 실질적
  // 공백이었다. 흔한 단어("말/아이/안/해") 없이, 의미가 분명한 구절만 큐레이션.
  '자기결정': ['자기가 정한', '본인이 정한', '스스로 정한', '자기 마음대로', '자기가 하고 싶은', '본인이 선택한', '스스로 결정', '자기 생각대로'],
  '통제': ['통제'],
  '고집': ['고집', '말을 안 들어', '말 안 들어'],
  '반항': ['반항'],
  '미룸': ['미뤄', '미루'],
  '표현': ['설명', '표현'],
  // '참여'/'예측가능성'/'결과물'/'준비시간'은 각각 같은 파편(observable_pattern)에서 이미 트리거가
  // 있는 다른 concept_tag와 함께 붙어있어(예: '예측가능성'은 항상 '규칙'/'변화'와 동반) 실질적으로
  // 죽은 태그가 아니다 — findMatchingFragments가 concept_tags 중 "하나라도" 맞으면 매칭되므로,
  // 이 태그들 자체가 비어 있어도 형제 태그가 안전망 역할을 한다(실측으로 재확인 완료).
  '참여': [],
  '위축': ['위축'],
  '몰입': ['몰입', '빠져', '집중'],
  '규칙': ['규칙'],
  '예측가능성': [],
  '변화': ['바뀌'],
  '동기': ['동기', '의욕'],
  '결과물': [],
  '목표': ['목표'],
  '새로운상황': ['새로운'],
  '준비시간': [],
  '부담': ['부담'],
};

function extractTriggeredTags(text, triggerDict) {
  const tags = [];
  for (const [tag, triggers] of Object.entries(triggerDict)) {
    if (triggers.some((t) => text.includes(t))) tags.push(tag);
  }
  return tags;
}

// ============================================================
// ④ Depth 판정 + ⑤ 재료 선택
// ============================================================

/**
 * DEEP은 "재료를 많이 주는 단계"가 아니라 "같은 문제가 반복해서 언급되는 맥락"으로 정의한다
 * (승인된 설계). "아까/또/이번에도" 같은 반복 신호 + 이전 대화에 같은 situation_tag가 있었는지로
 * 판단 — 신규 계산 없이 텍스트 신호만 본다.
 */
const REPEAT_SIGNAL_PATTERN = /아까|또|이번에도|오늘도|맨날|계속/;

// 개선②(observable 정밀도): 여러 observable_pattern이 concept_tag로 매칭될 때 배열의 첫 번째가
// 아니라 "가장 적합한" 것을 고른다. LLM/임베딩 없이 결정론적으로: ①매칭된 concept_tag 개수
// ②질문 텍스트와 fragment 텍스트의 단어 겹침(2글자 이상 부분 문자열 겹침) 순으로 점수화한다.
// 동점이면 배열 순서상 먼저 나온 것을 유지(허용된 fallback).
function scoreObservableMatch(fragmentConceptTags, matchedConceptTags, questionText, fragmentText) {
  const tagOverlap = fragmentConceptTags.filter((t) => matchedConceptTags.includes(t)).length;
  const questionWords = questionText.replace(/[.,!?]/g, '').split(/\s+/).filter((w) => w.length >= 2);
  const fragmentWords = fragmentText.split(/\s+/).filter((w) => w.length >= 2);
  const wordOverlap = questionWords.filter((qw) => fragmentWords.some((fw) => fw.includes(qw) || qw.includes(fw))).length;
  return tagOverlap * 100 + wordOverlap * 10;
}

// TASK1(scene/strategy relevance): situation_tag를 "구체 주제"(숙제/게임종료/루틴/새로운환경/비교 —
// 특정 화제를 실제로 가리킴)와 "범용 방식"(지시/일정변경/표현/평가 — 여러 주제에 두루 쓰이는 상호작용
// 방식)으로 나눈다. 질문이 fragment의 "구체 주제" 태그는 하나도 언급 안 했는데 "범용 방식" 태그만
// 우연히 겹쳐서 매칭되면, 그 fragment의 구체적 사례 텍스트(예: "숙제하라고...")를 억지로 노출하지
// 않는다 — "관련 없는 구체적 scene을 넣는 것보다 넣지 않는 것이 낫다"는 원칙을 그대로 코드화.
const SPECIFIC_SITUATION_TAGS = new Set(['숙제', '게임종료', '루틴', '새로운환경', '비교', '결과물']);

function isRelevantFragment(fragmentTags, matchedTags) {
  if (!fragmentTags) return false;
  const matchedSpecific = fragmentTags.some((t) => matchedTags.includes(t) && SPECIFIC_SITUATION_TAGS.has(t));
  if (matchedSpecific) return true; // 질문이 실제로 이 구체 주제를 언급함 — 강한 매치
  const hasUnmatchedSpecific = fragmentTags.some((t) => !matchedTags.includes(t) && SPECIFIC_SITUATION_TAGS.has(t));
  if (hasUnmatchedSpecific) return false; // fragment는 특정 주제에 묶여있는데 질문엔 그 얘기가 없음 — 제외
  return true; // fragment 자체에 구체 주제 태그가 없음(순수 범용 조합) — 안전하게 사용 가능
}

function findMatchingFragments(parentApproach, situationTags, conceptTags, questionText) {
  const sceneMatches = [];
  const strategyMatches = [];
  let bestObservable = null;
  let bestScore = -1;
  for (const approach of parentApproach ?? []) {
    for (const s of approach.scene_examples ?? []) {
      if (s.situation_tags?.some((t) => situationTags.includes(t)) && isRelevantFragment(s.situation_tags, situationTags)) sceneMatches.push(s.text);
    }
    for (const p of approach.parent_strategy_examples ?? []) {
      if (p.situation_tags?.some((t) => situationTags.includes(t)) && isRelevantFragment(p.situation_tags, situationTags)) strategyMatches.push(p.text);
    }
    for (const o of approach.observable_patterns ?? []) {
      if (!o.concept_tags?.some((t) => conceptTags.includes(t))) continue;
      const score = scoreObservableMatch(o.concept_tags, conceptTags, questionText, o.text);
      if (score > bestScore) { // 엄격한 >만 사용 — 동점이면 먼저 나온(배열 앞쪽) 후보를 유지
        bestScore = score;
        bestObservable = o.text;
      }
    }
  }
  return { sceneMatches, strategyMatches, observableMatches: bestObservable ? [bestObservable] : [] };
}

/**
 * target/intent/매칭재료/history를 결합해서 depth를 정하고, 그 depth만큼의 재료를 잘라 반환한다.
 * NONE이면 material은 완전히 빈 상태(빈 배열들) — 프롬프트에 어떤 텍스트도 안 들어감.
 * export: 유닛 테스트 및 conversation-service.mjs의 evidence_refs 기록 조건 판정(BUG-4)에 사용.
 */
export function resolveDepthAndMaterial(childContext, text, target, intent, hasHistory, recentText = '') {
  if (target !== 'child') {
    return { depth: 'NONE', material: { observableText: null, sceneText: null, strategyText: null, cautionText: null } };
  }

  const situationTags = extractTriggeredTags(text, SITUATION_TAG_TRIGGERS);
  const conceptTags = extractTriggeredTags(text, CONCEPT_TAG_TRIGGERS);
  const { sceneMatches, strategyMatches, observableMatches } = findMatchingFragments(childContext.parent_approach, situationTags, conceptTags, text);
  // caution도 concept_tags로 매칭 시도(예: "몰입/집중"). 매칭이 없어도, 다른 재료가 이미 매칭돼서
  // depth가 NONE이 아니게 되면 caution은 부가 정보로 함께 보여준다(귀문처럼 실제 계산된 관찰
  // 포인트가 조용히 통째로 사라지는 걸 막기 위함 — v2까지는 항상 노출했던 정보).
  const cautionMatches = (childContext.caution_points ?? []).filter((c) => c.concept_tags?.some((t) => conceptTags.includes(t))).map((c) => c.observable_pattern);

  const isRepeatContext = hasHistory && REPEAT_SIGNAL_PATTERN.test(text) && extractTriggeredTags(recentText, SITUATION_TAG_TRIGGERS).some((t) => situationTags.includes(t));

  const hasAnyMatch = sceneMatches.length > 0 || strategyMatches.length > 0 || observableMatches.length > 0 || cautionMatches.length > 0;
  if (!hasAnyMatch) {
    return { depth: 'NONE', material: { observableText: null, sceneText: null, strategyText: null, cautionText: null } };
  }

  const allCaution = cautionMatches;

  if (isRepeatContext) {
    return {
      depth: 'DEEP',
      material: { observableText: observableMatches[0] ?? null, sceneText: sceneMatches.slice(0, 2), strategyText: strategyMatches.slice(0, 2), cautionText: allCaution.slice(0, 2) },
    };
  }

  if (sceneMatches.length > 0 || strategyMatches.length > 0) {
    return { depth: 'FOCUSED', material: { observableText: null, sceneText: sceneMatches.slice(0, 1), strategyText: strategyMatches.slice(0, 1), cautionText: allCaution.slice(0, 1) } };
  }

  if (observableMatches.length > 0) {
    return { depth: intent === 'why' ? 'FOCUSED' : 'LIGHT', material: { observableText: observableMatches[0], sceneText: [], strategyText: [], cautionText: allCaution.slice(0, 1) } };
  }

  if (allCaution.length > 0) {
    return { depth: 'LIGHT', material: { observableText: null, sceneText: [], strategyText: [], cautionText: allCaution.slice(0, 1) } };
  }

  return { depth: 'NONE', material: { observableText: null, sceneText: null, strategyText: null, cautionText: null } };
}

// ============================================================
// 프롬프트 조립
// ============================================================

const NATURAL_STYLE_RULES = `
자연스러운 한국어 대화 원칙:
- 불필요한 서론 없이 바로 답한다("말씀해주신 상황을 종합해보면..." 같은 시작 금지)
- "결론적으로", "요약하면", "시사하는 바가 크다" 같은 AI 특유 관용구를 쓰지 않는다
- "첫째/둘째/셋째"처럼 기계적으로 나열하지 않는다
- 문두에 "또한/따라서/즉"을 연달아 쓰지 않는다
- 결론을 다시 요약하지 않는다
- ㅋㅋ, ㅎㅎ, ㅋ, ㅎ, ^^, ^^; 같은 인터넷식 웃음 표현을 절대 쓰지 않는다. 부모가 먼저 써도 따라 쓰지 않는다.
- 문장 종결을 다양하게 쓴다. "~합니다/~보입니다/~할 수 있습니다"가 연속 3문장 이상 반복되면 안 된다.
- 답변 길이를 미리 정해두지 않는다. 짧게 끝날 질문엔 짧게, 부모가 길게 설명했으면 그만큼 답해도 된다.`;

const EMPATHY_RULES = `
공감 원칙:
- 부모의 상황/감정을 필요할 때만 짧게(1문장) 받아준다. 매 답변에 공감 문장을 강제로 넣지 않는다.
- 과잉 공감 금지: "얼마나 힘드셨을지 다 느껴집니다", "정말 많이 힘드셨겠어요" 같은 상담사식 과장 이입.
- 부모 자신에 대한 질문(육아 자책, 감정 소진 등)일 때는 매번 똑같은 위로 문장을 반복하지 말고
  상황에 맞게 다르게 반응한다 — 순수 공감만 할 수도, 짧게 되물을 수도, 담백한 조언을 줄 수도 있다.`;

const CAUSALITY_RULE = `
사주/자미두수와 실제 행동의 관계:
- 사주/자미두수 정보는 아이의 실제 행동을 증명하는 자료가 아니다. 실제 행동은 부모가 관찰한 사실이고,
  사주/자미두수는 그걸 이해하기 위한 하나의 해석 프레임일 뿐이다.
- 절대 금지: "귀문관살 때문에 예민합니다", "비겁이 강해서 고집이 셉니다", "재성이 강해서 숙제를
  싫어합니다", "사주상 ADHD 성향이 있습니다", "이 사주는 공부를 못하는 구조입니다."
- 아이를 고정된 성격으로 단정하지 않는다("이 아이는 원래 이런 아이예요" 금지).
- 의료/정신질환/발달/지능 판단, 공부·직업·성공 예언, 부모에게 죄책감 주는 표현을 하지 않는다.`;

// 학습/기억 관련 조언에서 아이를 고정 유형으로 분류하지 않는다. "시각형/청각형/운동형" 같은 통속
// 학습유형론은 재현성이 확립되지 않았고, 이 서비스의 핵심 철학(아이마다, 상황마다 다르다)과도
// 정면으로 배치된다.
const NO_LEARNING_STYLE_LABELING_RULE = `
학습 유형 단정 금지:
- "이 아이는 시각 기억형입니다", "청각형이라서 들으면서 외워야 합니다" 같은 고정 학습유형 단정을
  하지 않는다. 이런 분류는 과학적으로 확립되지 않았다.
- 대신 관찰 가능한 행동으로 표현한다: "직접 해본 내용을 다시 설명할 때 기억이 잘 남는 편으로
  보입니다", "짧게 나누어 제시했을 때 시작하기 쉬워 보입니다" 같은 식.
- 배경지식, 동기, 집중 상태, 과제 종류에 따라 잘 맞는 방법이 달라진다는 걸 전제로 말한다 — 한
  가지 방법을 모든 상황에 적용하라고 하지 않는다.`;

// 아이시그널의 핵심 교육 철학. 광고 문구처럼 매 답변에 반복하지 않고, 학습/숙제/집중/기억/공부
// 방법이 실제로 화제일 때만 자연스럽게 녹인다(강제 삽입 아님, 아래 프롬프트 조립부에서 조건부 포함).
const EDUCATION_PHILOSOPHY_HOOK = `
학습 관련 대화의 톤:
- 모든 아이에게 똑같은 공부법을 적용하기보다, 이 아이가 어떤 조건에서 더 잘 이해하고 기억하고
  시작하는지를 함께 알아가는 쪽으로 안내한다.
- 학원/문제집을 계속 바꿔보는 시행착오보다, 아이의 반응을 관찰하면서 방법을 조정하는 쪽을
  권한다. 단, "학원 다니지 마라", "숙제 시키지 마라"는 의미로 말하지 않는다 — 학원/숙제/문제집도
  유용하며, 핵심은 이 아이와 이 과제에 맞는 방식인지 확인하는 것이다.`;

/**
 * §2/§3/§9 — 교육·훈육 조언에 짧은 근거를 붙일 때 confidence 수준에 따라 단정/유보 표현을
 * 다르게 하도록 안내하는 규칙. evidence가 실제로 쓰일 때만(FOCUSED/DEEP && target=child) 조립부
 * 에서 포함시킨다 — 게이팅 조건 자체는 건드리지 않는다.
 */
const EVIDENCE_CITATION_RULE = `
교육/훈육 조언에 근거를 붙일 때:
- 논문을 길게 설명하거나 학술적 문체를 쓰지 않는다. 조언 바로 뒤에 한 문장 정도로 "왜 그런지"만
  가볍게 붙인다.
- confidence가 strong이면: "~하는 경향이 확인됩니다" 정도로 담담하게 말해도 된다.
- confidence가 moderate이면 더 유보적으로: "~일 가능성이 보고됩니다", "아직 모든 경우에 해당한다고
  단정하기는 어렵습니다" 같은 표현을 쓴다.
- "연구에 따르면 확실히 효과가 있습니다"처럼 confidence와 무관하게 단정하지 않는다.
- 출처를 짧게 언급할 수 있다(예: "자율성 지원과 동기에 관한 연구에서 확인된 내용이에요"). 저자명과
  연도를 언급해도 되지만, 반드시 괄호나 세미콜론, 가운뎃점(·), 콜론 없이 자연스러운 한 문장으로
  풀어써라 — 예를 들어 "데시와 라이언이 2000년에 발표한 연구에서..."처럼 쓰고, "(Deci·Ryan, 2000)"
  같은 괄호/기호 인용 표기는 절대 쓰지 않는다(사용자 화면에 표시되기 전 기호가 자동으로 제거돼서
  문장이 깨진다). 없는 연구나 숫자를 지어내지 않는다 — 아래 제공된 출처만 쓴다.
- 캐주얼한 잡담에는 근거를 억지로 붙이지 않는다. 교육/훈육/학습/기억과 직접 관련된 조언일 때만.`;

const PROFILE_NOT_EXPLAIN_RULE = `
프로필 사용 ≠ 프로필 설명:
- 아래 재료가 주어져도 "이 아이는 ~한 성향이 있습니다", "사주상 ~한 경향이 나타납니다", "원국에서
  ~이 강하게 나타납니다" 같은 설명형 문장을 만들지 않는다.
- 재료를 그대로 인용하지 않는다. 반드시 부모가 실제로 관찰할 수 있는 장면과, 오늘 바로 써볼 수
  있는 말로 번역해서 답한다.`;

// 개선③(장문+how UX): 길이/intent/상황서술 세 조건을 모두 만족할 때만 붙는 독립 블록. target이나
// depth 판정 자체는 전혀 바꾸지 않는다 — parent 질문이 이 조건을 만족해도 그대로 target=parent →
// depth=NONE 경로를 타고, 이 가이드만 얹힐 뿐 child profile material은 재활성화되지 않는다.
// 고정 답변 템플릿이 아니라 원칙 목록이라, "항상 이렇게 시작하라"는 문구를 주지 않는다.
const LONG_QUESTION_LENGTH_THRESHOLD = 40;
const LONG_HOW_GUIDE = `
장문으로 설명된 상황에 대한 질문이니:
- 부모가 설명한 상황을 먼저 짧게 받아준다(고정 문구를 반복하지 않고 상황에 맞게 다르게 표현한다).
- 여러 문제가 섞여 있다면 그 중 핵심 하나만 고른다.
- 관련된 재료가 있을 때만 사용하고, 없으면 재료 없이 상황 자체에 답한다.
- 바로 실행할 수 있는 대응 하나만 제시한다.
- 장황한 분석이나 프로필 전체 설명은 하지 않는다.`;

// 상황 서술 연결어미 — 태그 사전에 아직 없는 새로운 주제(또래관계/식사 등)라도, 부모가 장문으로
// 구체적 상황을 풀어 설명하고 있다면(연결어미+충분한 길이) "상황 서술이 있다"고 본다. 이걸 프로필
// 태그 매칭 여부와 혼동하면 안 된다 — "프로필에 없는 주제"와 "질문 자체에 상황 서술이 없음"은
// 다른 개념이다(전자는 material 배제 사유, 후자만 guide 활성화 조건).
const SITUATION_DESCRIPTION_CONNECTOR = /(는데|아서|어서|해서)/;

function isLongHowSituation(text, intent) {
  if (text.length < LONG_QUESTION_LENGTH_THRESHOLD || intent !== 'how') return false;
  const hasTaggedSituation = CHILD_BEHAVIOR_DESCRIPTOR.test(text) || extractTriggeredTags(text, SITUATION_TAG_TRIGGERS).length > 0 || extractTriggeredTags(text, CONCEPT_TAG_TRIGGERS).length > 0;
  const hasConnectorSituation = SITUATION_DESCRIPTION_CONNECTOR.test(text) && text.length > 18;
  return hasTaggedSituation || hasConnectorSituation;
}

/**
 * classifyTarget → classifyIntent → resolveDepthAndMaterial을 한 번에 실행해서 depth만 반환한다.
 * conversation-service.mjs가 "실제로 프로필 재료를 썼는지"(depth !== 'NONE')를 판정할 때 쓴다(BUG-4).
 */
export function getPersonalizationDepth(childContext, text, hasHistory = false, recentText = '') {
  if (!childContext) return 'NONE';
  const target = classifyTarget(text);
  const intent = classifyIntent(text);
  return resolveDepthAndMaterial(childContext, text, target, intent, hasHistory, recentText).depth;
}

export function buildCasualSystemPrompt(characterId, childContext = null, userText = '', hasHistory = false, recentText = '') {
  const character = getCharacter(characterId);
  const base = `너는 '${character.displayName}'라는 반말 쓰는 고양이 캐릭터야. 사용자가 사주와 무관한 일상적인
말을 걸었을 때 짧고 친근하게 반응해.

규칙:
- 1~2문장, 짧고 자연스럽게. 실제 메신저 대화처럼.
- 사주/운세/명리학적 판단을 절대 하지 않는다 — 이건 사주 분석 기능이 아니라 순수 잡담 반응이다.
  사용자가 사주 관련 내용을 물어보면 "그건 이따가 제대로 봐줄게" 정도로만 넘기고 판단하지 않는다.
- 의학적/심리적 진단, 확정적 조언을 하지 않는다.
- ${character.displayName} 특유의 톤을 유지한다: ${character.description}
${NATURAL_STYLE_RULES}`;

  if (!childContext) return base;

  const target = classifyTarget(userText);
  const intent = classifyIntent(userText);
  const { depth, material } = resolveDepthAndMaterial(childContext, userText, target, intent, hasHistory, recentText);

  const evidence = (depth === 'FOCUSED' || depth === 'DEEP') && userText ? matchBehavioralEvidence(userText, childContext.core_traits?.ten_god_dominance ?? null) : null;
  const longHowGuide = isLongHowSituation(userText, intent) ? LONG_HOW_GUIDE : '';

  if (depth === 'NONE') {
    // target이 parent/relationship이거나, child 질문이라도 실제 관련 재료가 전혀 없을 때 —
    // 프로필 재료(observable/scene/strategy) 텍스트는 단 한 조각도 프롬프트에 넣지 않는다.
    // 단, 안전 규칙(사주 원인 단정 금지 등)은 depth와 무관하게 항상 유지한다 — 재료가 없다고
    // 안전장치까지 빼면 모델이 스스로 사주 관련 표현을 지어낼 위험을 못 막는다.
    return `${base}
${EMPATHY_RULES}
${PROFILE_NOT_EXPLAIN_RULE}
${CAUSALITY_RULE}
${NO_LEARNING_STYLE_LABELING_RULE}
${longHowGuide}

---
지금은 "우리 아이 성장 코치" 대화야. 이번 질문은 아이의 성향 정보를 굳이 끌어올 필요가 없는
질문이야 — 아이 재료를 억지로 언급하지 말고, 부모가 말한 상황 자체에 자연스럽게 반응해.
사주/자미두수 얘기를 꺼내지 않는다.

---
답변 뒤에 자연스럽게 이어질 만한 질문을 딱 3개까지 만들어. 지금 화제와 무관한 고정 질문을
끼워넣지 않는다. 이어질 자연스러운 질문이 없으면 빈 배열로 둬도 된다.`;
  }

  const materialLines = [];
  if (material.observableText) materialLines.push(`- ${material.observableText}`);
  for (const s of material.sceneText ?? []) materialLines.push(`- 장면: ${s}`);
  for (const s of material.strategyText ?? []) materialLines.push(`- 대사: ${s}`);
  for (const c of material.cautionText ?? []) materialLines.push(`- 조금 더 세심하게 살펴볼 만한 부분: ${c}`);

  // §2/§3/§9 — evidence가 실제로 쓰일 때만(기존 게이팅 조건 그대로) confidence/sources를 함께
  // 넘겨서, 프롬프트가 confidence 수준에 맞는 표현을 고르고 짧은 출처를 붙일 수 있게 한다.
  const evidenceBlock = evidence
    ? `\n참고할 수 있는 육아 방법(confidence: ${evidence.confidence}): ${evidence.recommended_parent_behavior}\n한계: ${evidence.limitations}\n출처(짧게 언급 가능, 지어내지 말고 이 목록만 사용, 답변에 옮길 때 괄호나 세미콜론 없이 자연스러운 문장으로 풀어써라): ${evidence.sources.map((s) => `${s.authors}가 ${s.year}년에 발표한 연구`).join(', ')}`
    : '';
  // 학습유형 비분류(NO_LEARNING_STYLE_LABELING_RULE)는 CAUSALITY_RULE과 같은 성격의 안전
  // 원칙이라 evidence 유무와 무관하게 항상 포함한다. 교육철학 훅/근거인용 형식 안내는 evidence가
  // 실제로 있을 때만(=FOCUSED/DEEP && target=child, 기존 게이팅) 의미가 있으므로 그때만 포함.
  const educationRules = `\n${NO_LEARNING_STYLE_LABELING_RULE}${evidence ? `\n${EDUCATION_PHILOSOPHY_HOOK}\n${EVIDENCE_CITATION_RULE}` : ''}`;

  return `${base}
${EMPATHY_RULES}
${PROFILE_NOT_EXPLAIN_RULE}
${CAUSALITY_RULE}
${educationRules}
${longHowGuide}

---
지금은 "우리 아이 성장 코치" 대화야. 이번 질문에 실제로 도움이 될 만한 재료만 아래에 딱 필요한
만큼만 준비했어(전체 프로필이 아니야 — 이게 전부다):

${materialLines.join('\n')}
${evidenceBlock}

이 정보를 쓸 때 반드시 지킬 것:
- 부모의 질문에 먼저 직접 답한다. 사주 이야기부터 꺼내지 않는다.
- 매 답변마다 사주 용어를 언급하지 않는다.
- "신호"라는 단어를 쓰지 않는다.
- 이미 이전 대화에서 설명한 내용은 다시 처음부터 반복하지 않는다.

---
답변 뒤에 자연스럽게 이어질 만한 질문을 딱 3개까지 만들어. 지금 이 답변과 부모가 방금 한 말에서
바로 이어지는 질문만 만들고(예: 방금 얘기한 상황의 원인/대응법/그 다음 단계), 지금 화제와 무관한
숙제/게임/친구관계 같은 고정 질문을 끼워넣지 않는다. 이어질 자연스러운 질문이 없으면 빈 배열로
둬도 된다.`;
}

export const CASUAL_RESPONSE_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['reaction', 'suggestedQuestions'], // §버그수정 — OpenAI strict:true는 properties의 모든 키가 required에도 있어야 한다(실측으로 확정된 HTTP 400 원인). 빈 배열은 여전히 허용되므로 "없으면 빈 배열" 지침과 호환된다.
  properties: {
    reaction: { type: 'string', description: '사용자의 일상 메시지에 대한 짧고 친근한 반말 리액션.' },
    suggestedQuestions: {
      type: 'array',
      maxItems: 3,
      items: { type: 'string' },
      description: '지금 대화에서 자연스럽게 이어질 질문 후보(최대 3개). 무관한 화제 금지, 이어질 질문이 없으면 빈 배열([])을 반환한다(필드 자체는 항상 있어야 함).',
    },
  },
};

export function truncateForCasual(text) {
  return text.length > CASUAL_MESSAGE_MAX_LENGTH ? text.slice(0, CASUAL_MESSAGE_MAX_LENGTH) : text;
}
