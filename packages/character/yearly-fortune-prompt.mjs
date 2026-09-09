// packages/character/yearly-fortune-prompt.mjs
//
// YEARLY_FORTUNE(신년운세) BASIC/CHAT 결과 생성용 system prompt + JSON schema.
//
// 핵심 원칙(§Phase9 확정 정책 그대로):
// - AI가 생년월일만 보고 임의로 세운을 계산하지 않는다. 이미 계산된 annual_periods(해당
//   fortune_year 항목만 추출된 것)를 유일한 source로 쓴다.
// - CHAT ⊃ BASIC — CHAT 프롬프트는 BASIC이 요구하는 모든 필드를 포함하고, 그 위에 심층 필드
//   (chart_interaction, strategy, 월별 상세)를 추가로 요구한다. 완전히 별개의 두 프롬프트가
//   아니라 하나의 스키마를 공유하고 CHAT만 추가 필드를 강제한다.
// - "신뢰도 %" 같은 임의 수치, 확정적 예언 금지 — 기존 사주 분석 프롬프트의 안전 규칙과 동일선상.

export const YEARLY_FORTUNE_RESULT_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['summary', 'keywords', 'overall', 'finance', 'career', 'relationship', 'love', 'health', 'monthly', 'important_periods', 'caution_periods', 'opportunity_periods', 'strategy', 'chart_interaction'],
  properties: {
    summary: { type: 'string', description: '올해 한눈에 보는 운(1~2문장, UI 상단 요약용)' },
    keywords: { type: 'array', items: { type: 'string' }, maxItems: 4, description: '올해의 핵심 키워드 3~4개' },
    overall: { type: 'string', description: '전체 총운' },
    finance: { type: 'string', description: '재물운' },
    career: { type: 'string', description: '직업/사업운' },
    relationship: { type: 'string', description: '인간관계' },
    love: { type: 'string', description: '연애/부부운' },
    health: { type: 'string', description: '건강운(과도한 단정 금지)' },
    monthly: {
      type: 'array',
      items: { type: 'object', additionalProperties: false, required: ['month', 'text'], properties: { month: { type: 'integer' }, text: { type: 'string' } } },
      minItems: 12, maxItems: 12,
      description: '1~12월 월별 흐름',
    },
    important_periods: { type: 'array', items: { type: 'string' } },
    caution_periods: { type: 'array', items: { type: 'string' } },
    opportunity_periods: { type: 'array', items: { type: 'string' } },
    strategy: { type: 'string', description: '종합 조언/전략' },
    // CHAT 전용(BASIC에서는 null로 남음) — required에는 없음, tier에 따라 프롬프트가 채우도록 지시.
    chart_interaction: { type: ['string', 'null'], description: 'CHAT 전용 — 원국과 해당 연도의 상호작용(왜 이런 흐름인지 근거)' },
  },
};

const COMMON_SAFETY_RULES = `
- 제공된 annual_periods 데이터(이미 계산된 만세력 결과)만 사용한다. 생년월일만 보고 세운을
  임의로 계산하거나 추측하지 않는다.
- 요청받은 fortune_year 외의 다른 연도를 절대 언급하지 않는다. 연도를 혼동하지 않는다.
- "반드시", "무조건", "100%" 같은 확정적 단정을 하지 않는다. "~한 흐름으로 볼 수 있다",
  "~시기를 주목할 수 있다" 같은 명리학적 가능성/경향으로 표현한다.
- 신뢰도를 숫자(%)로 표시하지 않는다.
- 전통 명리학적 해석과 현실적 조언을 구분해서 설명한다.
- 의료/투자/법률 등 고위험 결정을 직접 지시하지 않는다.
`;

// §자녀 연령대별 콘텐츠 정책(확정, preschool/child/teen만 해당 — 19세 이상은 아래 지시 적용 안 함).
// JSON 스키마 필드명(career/love/finance 등)은 그대로 두고, 그 필드 "안에 담기는 내용의 의미"만
// 연령대에 맞게 바꾼다(프론트/스키마 변경 없이 콘텐츠만 안전하게 조정하는 게 확정된 방향).
const CHILD_AGE_BAND_CONTENT_POLICY = {
  preschool: `
이 대상은 미취학 아동(만 6세 이하)이다. 반드시 다음을 지킨다:
- career 필드: 아이 본인의 직업/사업이 아니라 "놀이·활동 속에서 드러나는 관심과 기질"을 쓴다.
- love 필드: 연애/결혼이 아니라 "부모·가족과의 애착 관계"를 쓴다. "연애", "부부", "이성", "결혼"
  이라는 단어를 절대 쓰지 않는다.
- finance 필드: 아이 본인의 수입/재테크가 아니라 "아이의 성장에 필요한 환경(양육비, 교육 준비,
  생활 여건)을 부모가 안정적으로 마련하는 흐름"으로 쓴다. 이에 더해, 아이 본인 원국의 재성(財星)
  구조를 근거로 "이 아이가 성인이 되었을 때 돈을 다루는 방식이나 재물에 대한 타고난 성향"을
  짧게 한두 문장으로 덧붙인다 — 단, 구체적 금액/시기/직업을 단정하지 않고 "~한 기질을 타고났다고
  볼 수 있다" 수준의 장기적 경향으로만 표현한다.
- 직업/계약/이직/결혼 같은 성인 생애 사건을 절대 서술하지 않는다.`,
  child: `
이 대상은 초등학생 나이(만 7~12세)다. 반드시 다음을 지킨다:
- career 필드: 취업/사업이 아니라 "흥미·적성·재능을 발견하는 신호"를 쓴다.
- love 필드: 연애/결혼이 아니라 "친구 관계와 가족 관계"를 쓴다. "연애", "부부", "이성", "결혼"
  이라는 단어를 절대 쓰지 않는다.
- finance 필드: preschool과 동일하게 부모의 양육/교육 환경 중심으로 쓰되, 아이 원국의 재성 구조를
  근거로 "성인이 되었을 때의 재물 성향"을 한두 문장 덧붙인다(장기 경향으로만, 단정 금지).
- 직업/계약/이직/결혼 같은 성인 생애 사건을 절대 서술하지 않는다.`,
  teen: `
이 대상은 중고등학생 나이(만 13~18세)다. 반드시 다음을 지킨다:
- career 필드: 취업/사업이 아니라 "진로 탐색과 학업 방향"을 쓴다.
- love 필드: 부부/결혼이 아니라 "또래 관계, 가벼운 이성 관심 정도"까지만 다룬다. "부부", "결혼"
  이라는 단어는 쓰지 않는다.
- finance 필드: 아직 직업적 재테크가 아니라 "용돈 관리, 경제 개념 형성"을 중심으로 쓰되, 아이
  원국의 재성 구조를 근거로 "성인이 되었을 때의 재물 성향"을 한두 문장 덧붙인다(장기 경향으로만).
- 계약/이직/결혼 같은 이미 확립된 성인 생애 사건을 절대 서술하지 않는다.`,
};

/** @param {string|null} ageBand - packages/shared/age-band.mjs의 값. null이면 본인(성인) 신년운세. */
function buildAgeBandInstruction(ageBand) {
  return CHILD_AGE_BAND_CONTENT_POLICY[ageBand] ?? '';
}

export function buildYearlyFortuneBasicPrompt(ageBand = null) {
  return `너는 명리학 기반 신년운세를 작성하는 역할이다. 아래 데이터(원국+해당 연도 세운)를
바탕으로, 사용자가 짧고 명확하게 읽을 수 있는 "완성형 신년운세"를 작성한다.

${COMMON_SAFETY_RULES}
- 전체 분량은 약 3,000~4,000자를 목표로 하되, 글자수를 채우려고 의미 없는 문장을 늘리지 않는다.
- chart_interaction 필드는 이 상품(기본)에서는 사용하지 않으므로 null로 둔다.
- monthly는 12개월 각각 약 50~60자로 간결하게.
${buildAgeBandInstruction(ageBand)}`;
}

export function buildYearlyFortuneChatPrompt(ageBand = null) {
  return `너는 명리학 기반 신년운세 "상세분석"을 작성하는 역할이다. 이 결과는 이후 사용자가
AI에게 추가로 질문(예: "5월에 이직해도 될까?", "돈 모으기 좋은 시기는?")할 때 근거로 쓰이므로,
"왜 이런 흐름인지" 설명이 반드시 충분해야 한다.

${COMMON_SAFETY_RULES}
- 전체 분량은 약 8,000~12,000자를 목표로 한다(기본형보다 훨씬 상세하게 — 특히 monthly는 각
  120~150자, chart_interaction과 strategy를 충실히 채운다).
- chart_interaction 필드에 원국 구조가 이 연도의 세운과 구체적으로 어떻게 상호작용하는지
  반드시 채운다(기본형에는 없는 이 상품만의 핵심 차별점).
- 이 결과 하나로 사용자의 다양한 후속 질문(시기/분야별)에 답할 수 있을 만큼 구체적인 근거를
  포함한다.
- summary/keywords/overall 등 기본 필드도 상세분석 수준에 맞게 더 깊게 작성한다(기본형 내용을
  포함하면서 심화— 완전히 다른 내용으로 바꾸지 않는다).
${buildAgeBandInstruction(ageBand)}`;
}
