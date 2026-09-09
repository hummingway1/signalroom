// tests/targeted-quality/questions.mjs
//
// 5개 targeted-quality 질문. main_quality의 13문항과 달리 "데이터가 전달되는가"가 아니라
// "전달된 데이터를 실제로 정확하게 사용하는가"를 검증하는 게 목적이므로, 각 질문이 어떤
// 필드(annual_periods/gwimun/major_periods)를 반드시 건드리는지, 그리고 TEST4는 반대로
// 건드리면 안 되는지를 명시한다.
export const TARGETED_QUALITY_QUESTIONS = [
  {
    file: 't1-annual-direct',
    question: '2027년에는 어떤 흐름이 강하게 나타날까요?',
    purpose: '특정 연도 세운 직접 질문 — annual_periods 사용 정확성',
    scopeCheck: 'unconstrained', // 체계를 명시하지 않음 — question-router.md 규칙상 both가 기본이지만 강제하지 않음
    semanticChecks: ['annualYearAccuracy', 'annualTenGodAndStage'],
  },
  {
    file: 't2-gwimun-direct',
    question: '제 사주에 귀문관살이 있나요? 있다면 어디에 있고 어떻게 해석해야 하나요?',
    purpose: '귀문관살 직접 질문 — special_stars.gwimun 사용 정확성',
    scopeCheck: 'saju_only', // "제 사주에"라고 명시 — question-router.md 규칙상 saju만 선택되는 게 정상
    semanticChecks: ['gwimunPosition', 'gwimunExistence'],
  },
  {
    file: 't3-daewoon-annual-link',
    question: '현재 대운에서 2027년은 어떤 의미가 있나요?',
    purpose: '대운+세운 연결 — major_periods와 annual_periods의 상호작용',
    scopeCheck: 'unconstrained',
    semanticChecks: ['annualYearAccuracy', 'daewoonAnnualLink'],
  },
  {
    file: 't4-personality-no-annual',
    question: '제 기본적인 성격과 사고방식은 어떤 편인가요?',
    purpose: '세운이 불필요한 질문 — 데이터 과다 추출 방지 (음성 대조군)',
    scopeCheck: 'unconstrained',
    semanticChecks: ['noUnnecessaryAnnualExtraction'],
  },
  {
    file: 't5-gwimun-personality',
    question: '귀문관살이 제 성격이나 인간관계에 어떤 식으로 작용한다고 볼 수 있나요?',
    purpose: '귀문관살의 해석 품질 — 단순 탐지가 아니라 명리학적 해석으로의 변환',
    scopeCheck: 'unconstrained',
    semanticChecks: ['gwimunPosition', 'gwimunExistence'],
  },
];
