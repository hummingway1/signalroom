export const AUTHORITATIVE_PARENTING = {
  id: 'authoritative_parenting',
  topic: '권위적 양육',
  confidence: 'strong', // Baumrind 이후 양육유형 연구의 표준 프레임, 수십 년간 반복검증
  evidence_summary:
    '따뜻함(반응성)과 일관된 기준(요구)을 동시에 갖춘 양육 방식(권위적 양육)이 권위주의적/허용적/방임적 ' +
    '양육보다 여러 발달 지표에서 유리하다는 연구가 오래전부터 축적되어 있다.',
  recommended_parent_behavior:
    '따뜻하게 대하되 정한 기준은 일관되게 유지한다. 기준을 바꿀 때는 이유를 설명한다.',
  limitations:
    '문화·맥락에 따라 최적의 균형점은 달라질 수 있다. 특정 상황에 대한 "정답"으로 오인해서는 안 된다.',
  sources: [
    { authors: 'Baumrind, D.', year: 1971, title: 'Current patterns of parental authority', venue: 'Developmental Psychology Monographs' },
  ],
  match_traits: ['structured'],
  match_keywords: ['규칙', '기준', '일관', '버릇'],
};
