// tests/real-ai/questions.mjs
//
// Fixed question set (verbatim from the task spec, §3 + §5). Do not edit
// wording — these are meant to be reproducible across model/version changes
// so results are comparable over time.

// scope_check 값:
//   'saju_only'/'ziwei_only'/'both' — 질문 문장 자체가 체계를 명시하거나(예: "...사주로 설명해줘"),
//     비교를 요청해서(교차 질문) routing이 반드시 그래야 하는 경우. 자동 routing_correctness 체크가
//     엄격하게(hard pass/fail) 적용된다.
//   'unconstrained' — 질문 문장이 특정 체계를 명시하지 않은 경우(예: "나는 돈을 어떤 방식으로...").
//     question-router.md 자체 규칙("특정 체계를 지정하지 않으면 두 체계 모두에서 채운다")에 따르면
//     이런 질문은 두 체계 모두로 라우팅되는 게 정상 동작이다. §3의 "사주 단독"/"자미두수 단독" 섹션
//     제목은 사람이 결과를 분류해서 읽기 위한 헤더일 뿐, 질문 자체에 체계 강제가 없으므로 이 경우
//     routing_correctness는 강제 실패시키지 않고 실제 라우팅 결과를 기록만 해서 사람이 검토하게 한다.
export const SINGLE_TURN_QUESTIONS = [
  { file: '01-saju-personality', category: 'saju_only', scope_check: 'saju_only', question: '내 성격의 핵심 구조를 사주로 설명해줘.' },
  { file: '02-saju-money', category: 'saju_only', scope_check: 'unconstrained', question: '나는 돈을 어떤 방식으로 벌고 관리하는 성향이 강해?' },
  { file: '03-saju-career', category: 'saju_only', scope_check: 'unconstrained', question: '직업에서 내가 가장 경쟁력을 발휘하기 쉬운 환경은?' },

  { file: '04-ziwei-personality', category: 'ziwei_only', scope_check: 'ziwei_only', question: '자미두수에서 내 성격의 핵심 구조를 설명해줘.' },
  { file: '05-ziwei-money', category: 'ziwei_only', scope_check: 'ziwei_only', question: '자미두수 기준으로 돈을 만드는 방식과 재물 관리 성향을 설명해줘.' },
  { file: '06-ziwei-career', category: 'ziwei_only', scope_check: 'ziwei_only', question: '자미두수 기준으로 직업과 사업에서 어떤 환경이 맞는지 설명해줘.' },

  { file: '07-cross-career', category: 'cross', scope_check: 'both', question: '사주와 자미두수를 같이 보면 내 직업 성향은 어떻게 보이나?' },
  { file: '08-cross-money', category: 'cross', scope_check: 'both', question: '사주와 자미두수가 내 재물운에 대해 공통적으로 말하는 것과 서로 다르게 말하는 것은 무엇인가?' },
  { file: '09-cross-work-business', category: 'cross', scope_check: 'both', question: '나는 직장형인지 사업형인지 사주와 자미두수를 각각 보고 비교해줘.' },
  { file: '10-cross-long-term', category: 'cross', scope_check: 'both', question: '두 체계를 종합했을 때 내가 장기적으로 가장 중요하게 관리해야 할 것은 무엇인가?' },
];

// §5 대화 연속성 테스트 — 세 turn을 순서대로, 같은 conversation summary를 이어서 실행한다.
export const CONVERSATION_TEST = {
  file: '11-conversation-career',
  category: 'cross', // 모든 turn이 궁극적으로 사주+자미두수 비교 맥락
  scope_check: 'both', // turn 1이 명시적으로 "사주와 자미두수로 비교해줘"라고 요청 — 이후 turn도 같은 맥락 유지가 기대됨
  turns: [
    '내 직업 성향을 사주와 자미두수로 비교해줘.',
    '그럼 나는 직장보다 사업이 더 맞는다는 뜻이야?',
    '그렇다면 혼자 하는 사업과 동업 중 어느 쪽을 더 조심해서 봐야 해?',
  ],
};

// expectedScope 값은 validators.mjs의 routing_correctness 체크가 쓰는 값과 맞춰야 한다.
// (구버전 호환용 — 새 코드는 각 항목의 scope_check 필드를 직접 사용한다.)
export function expectedScopeFor(category) {
  if (category === 'saju_only') return 'saju_only';
  if (category === 'ziwei_only') return 'ziwei_only';
  return 'both';
}
