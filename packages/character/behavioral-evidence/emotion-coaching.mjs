export const EMOTION_COACHING = {
  id: 'emotion_coaching',
  topic: '감정 코칭',
  confidence: 'moderate', // 단일 연구자(Gottman) 계열 중심, 폭넓은 반복검증은 제한적
  evidence_summary:
    '아이의 감정을 먼저 인식하고 이름을 붙여준 뒤 문제 해결을 돕는 방식(감정 코칭)이 정서 조절에 ' +
    '도움이 된다는 연구가 있다.',
  recommended_parent_behavior:
    '감정을 먼저 알아차리고 이름 붙여준다("지금 답답했겠다"), 그다음 행동/해결책을 함께 찾는다.',
  limitations:
    '감정을 인정하는 것과 그로 인한 행동(예: 소리 지르기)까지 허용하는 것은 다르다 — 이 둘을 구분해야 한다.',
  sources: [
    { authors: 'Gottman, J. M., Katz, L. F., & Hooven, C.', year: 1997, title: 'Raising an Emotionally Intelligent Child', venue: 'Simon & Schuster' },
  ],
  match_traits: [], // 특정 성향 계열에 국한되지 않음 — 감정 관련 키워드로만 매칭
  match_keywords: ['짜증', '화를', '울어', '분노', '소리를 질러', '떼를 써', '감정'],
};
