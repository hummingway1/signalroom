// tests/targeted-quality/timing-questions.mjs
//
// 기존 tests/targeted-quality/questions.mjs(5개)는 건드리지 않는다. 이 파일은 "시기 해석" 전용
// 신규 질문 3개만 담는다(요청 문서의 TEST2/TEST3/TEST4 — TEST1/TEST5는 기존 t1/t3와 개념적으로
// 겹쳐서 재사용).
//
// 확정적 예언 검증("반드시/무조건/100%" 등, 인용·부정문 오탐 방지 포함)은 새로 만들지 않는다 —
// tests/real-ai/validators.mjs의 FORBIDDEN_CERTAINTY_PHRASES 검증이 이미 정교하게 구현되어
// 있으므로 그대로 재사용한다(semanticChecks 목록에 별도로 안 넣어도 validateRealAIResult가
// 항상 적용함).
//
// 아래 3개(timingProvided/multipleYearsCompared/notPersonalityOnlyAnswer)만 신규 구현이 필요
// 하고, annualYearAccuracy는 기존 semantic-validators.mjs의 checkAnnualYearAccuracy를 그대로
// 재사용한다(중복 구현 아님).
export const TIMING_QUESTIONS = [
  {
    file: 't2-marriage-relationship-timing',
    question: '내 인생에서 결혼이나 중요한 인연의 흐름이 강해지는 시기는 언제로 볼 수 있어?',
    purpose: '인연/결혼 시기 — 대운+세운으로 "시기"를 찾는가, 근거 없는 확정 연도를 만들지 않는가',
    scopeCheck: 'unconstrained',
    semanticChecks: ['annualYearAccuracy', 'timingProvided'], // 확정적 예언은 validateRealAIResult가 공통 처리
  },
  {
    file: 't3-long-term-change-timing',
    question: '앞으로 몇 년 중에서 내 삶의 흐름이 크게 달라지는 시기는 언제야?',
    purpose: '장기 변화 시기 — 여러 annual_periods를 비교해서 우선순위를 매기는가',
    scopeCheck: 'unconstrained',
    semanticChecks: ['annualYearAccuracy', 'multipleYearsCompared'],
  },
  {
    file: 't4-career-money-timing',
    question: '앞으로 직업이나 돈과 관련해서 변화가 생기기 쉬운 시기는 언제야?',
    purpose: '영역(직업/돈)+시기 결합 — 단순 성향 설명으로 도망가지 않는가',
    scopeCheck: 'unconstrained',
    semanticChecks: ['annualYearAccuracy', 'timingProvided', 'notPersonalityOnlyAnswer'],
  },
];
