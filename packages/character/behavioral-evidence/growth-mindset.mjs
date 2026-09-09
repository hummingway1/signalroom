export const GROWTH_MINDSET = {
  id: 'growth_mindset',
  topic: '성장 마인드셋',
  confidence: 'moderate', // 최근 재현성/효과크기 논쟁이 있어 과장하지 않음(요구사항 명시)
  evidence_summary:
    '능력을 고정된 것이 아니라 성장 가능한 것으로 보는 믿음이 도전과 실패에 대한 반응에 영향을 줄 수 ' +
    '있다는 연구. 다만 최근 메타분석에서는 효과크기가 작다는 지적도 있다.',
  recommended_parent_behavior:
    '결과보다 과정과 노력을 짚어주는 피드백을 준다("어려운 걸 끝까지 해봤네").',
  limitations:
    '이 방식만으로 모든 학습 동기 문제가 해결된다고 볼 수 없다 — 과장된 기대는 금지.',
  sources: [
    { authors: 'Dweck, C. S.', year: 2006, title: 'Mindset: The New Psychology of Success', venue: 'Random House' },
    { authors: 'Mueller, C. M., & Dweck, C. S.', year: 1998, title: 'Praise for intelligence can undermine children\u2019s motivation and performance', venue: 'Journal of Personality and Social Psychology' },
  ],
  match_traits: [],
  match_keywords: ['포기해', '못한다고', '자신 없어'],
};
