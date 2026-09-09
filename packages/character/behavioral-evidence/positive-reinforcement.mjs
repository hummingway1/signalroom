export const POSITIVE_REINFORCEMENT = {
  id: 'positive_reinforcement',
  topic: '긍정적 강화',
  confidence: 'moderate', // 조작적 조건화 이론 자체는 확립되어 있으나 상황 일반화엔 주의 필요
  evidence_summary:
    '막연한 칭찬보다 구체적인 행동을 짚어주는 강화가 그 행동의 반복 가능성을 높인다는 행동수정 연구의 표준적 관점.',
  recommended_parent_behavior:
    '"잘했어" 대신 "혼자 시작한 게 좋았어"처럼 구체적인 행동을 짚어서 말해준다.',
  limitations:
    '보상에 지나치게 의존하면 내재적 동기를 오히려 낮출 수 있다는 연구도 있어(과잉정당화 효과), 구체적 인정과 물질적 보상을 구분해야 한다.',
  sources: [
    { authors: 'Skinner, B. F.', year: 1953, title: 'Science and Human Behavior', venue: 'Macmillan' },
  ],
  match_traits: [],
  match_keywords: ['칭찬', '잘했어', '보상', '인정'],
};
