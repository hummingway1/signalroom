// 자율성 지원(Autonomy Support) — Self-Determination Theory(자기결정이론) 계열.
// 실제 문헌 조사 결과(웹 검색으로 확인) 기반. AI가 매번 새로 검색하지 않는 정적 데이터.
export const AUTONOMY_SUPPORT = {
  id: 'autonomy_support',
  topic: '자율성 지원',
  confidence: 'strong', // 수십 년간 반복 검증된 메타분석 다수(2023 ScienceDirect 메타분석 등)
  evidence_summary:
    '아이에게 선택권을 주고 이유를 설명해주는 양육 방식(자율성 지원)은 내재적 동기, 학업 성취, ' +
    '적응적 기능과 정적 상관을 보인다는 연구가 다수 존재한다.',
  recommended_parent_behavior:
    '지시보다 선택지를 제시하고("A 먼저 할래, B 먼저 할래?"), 규칙을 정할 때는 이유를 함께 설명한다.',
  limitations:
    '모든 상황에서 무제한 선택권을 주라는 의미는 아니다. 안전/규범이 필요한 상황에서는 제한된 범위 안의 선택지를 주는 것이 핵심이다.',
  sources: [
    { authors: 'Deci, E. L., & Ryan, R. M.', year: 2000, title: 'Self-Determination Theory and the Facilitation of Intrinsic Motivation, Social Development, and Well-Being', venue: 'American Psychologist' },
    { authors: 'Grolnick, W. S., Deci, E. L., & Ryan, R. M.', year: 1997, title: 'Internalization within the family: The self-determination theory perspective' },
  ],
  match_traits: ['self-directed'],
  match_keywords: ['숙제', '지시', '하기 싫어', '거부', '안 하려', '시키면', '말을 안 들어'],
};
