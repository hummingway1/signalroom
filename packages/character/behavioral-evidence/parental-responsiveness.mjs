export const PARENTAL_RESPONSIVENESS = {
  id: 'parental_responsiveness',
  topic: '부모 반응성',
  confidence: 'strong', // 양육 2차원(반응성×통제) 모델, 애착이론과도 연결되는 확립된 개념
  evidence_summary:
    '아이가 보내는 신호(감정, 요구)를 민감하게 알아차리고 적절히 반응하는 것이 안정적인 관계 형성과 연결된다는 연구.',
  recommended_parent_behavior:
    '아이가 표현하는 걸 먼저 알아차리고 반응해준 다음, 필요한 방향으로 대화를 이어간다.',
  limitations:
    '모든 요구에 즉각 반응하라는 뜻이 아니라, "알아차리고 있다는 것"을 전달하는 것이 핵심이다.',
  sources: [
    { authors: 'Maccoby, E. E., & Martin, J. A.', year: 1983, title: 'Socialization in the context of the family: Parent-child interaction', venue: 'Handbook of Child Psychology' },
  ],
  match_traits: ['receptive'],
  match_keywords: ['말을 안 해', '표현을 안', '속마음'],
};
