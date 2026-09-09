export const SCAFFOLDING = {
  id: 'scaffolding',
  topic: '비계 설정',
  confidence: 'strong', // 교육심리학 표준 개념(Vygotsky 근접발달영역 이론 기반)
  evidence_summary:
    '아이가 혼자 하기 버거운 부분만 부모가 도와주고 나머지는 스스로 하게 두는 방식(비계 설정)이 ' +
    '학습과 문제해결 능력 발달에 도움이 된다는 연구.',
  recommended_parent_behavior:
    '전부 대신 해주지 않고, 막힌 부분만 힌트를 주거나 함께 시작해본다.',
  limitations:
    '적정 난이도 파악이 어려울 수 있다 — 아이의 실제 반응을 보면서 도움의 정도를 조절해야 한다.',
  sources: [
    { authors: 'Wood, D., Bruner, J. S., & Ross, G.', year: 1976, title: 'The role of tutoring in problem solving', venue: 'Journal of Child Psychology and Psychiatry' },
    { authors: 'Vygotsky, L. S.', year: 1978, title: 'Mind in Society', venue: 'Harvard University Press' },
  ],
  match_traits: ['receptive'],
  match_keywords: ['혼자 못', '도와줘야', '어려워해', '막막해'],
};
