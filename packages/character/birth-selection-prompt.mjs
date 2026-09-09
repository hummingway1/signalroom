// packages/character/birth-selection-prompt.mjs
//
// 출생일 택일(DATE_SELECTION) 후보 평가용 system prompt + JSON schema.
//
// 핵심 원칙:
// - 절대 점수("85점짜리 사주") 금지. 오직 "이번에 입력한 후보군 안에서의 상대적 위치"만 판단한다.
// - 신강/신약·격국·용신·희신·조후는 계산 엔진에 없다. AI가 이를 추론해서 새로 만들어내지 않는다.
// - "오행이 많으면 좋다/충이 있으면 나쁘다/합이 많으면 좋다/신살이 많으면 좋다" 같은 단일 요소의
//   기계적 길흉 치환을 금지한다 — 각 요소가 후보 전체 구조 안에서 어떻게 작용하는지 종합 서술한다.
// - AI는 candidate_id를 새로 만들거나 날짜/시간을 변경하지 않는다. 반드시 제공된 candidate_id
//   중에서만 언급한다(1차 방어: JSON schema enum, 2차 방어: 서버 post-processing).

const COMMON_SAFETY_RULES = `
- 절대적 확정 표현을 쓰지 않는다: "반드시", "무조건", "100%", "운명적으로", "최고의 날", "완벽한 날",
  "이 시간에 태어나야 한다", "이날 태어나면 성공한다" 같은 표현 금지. "상대적으로 ~한 경향을 보일
  수 있다", "다른 후보에 비해 ~로 볼 수 있다"처럼 항상 비교적/가능성 표현을 쓴다.
- 의료적 판단을 사주/자미두수 해석이 대체하거나 우선시하지 않는다: "의학적으로 안전하다",
  "건강에 좋다", "질병 위험이 낮다", "자연분만을 추천한다", "제왕절개를 추천한다", "의료진보다
  중요하다" 같은 표현을 절대 쓰지 않는다. 출산 방식/시기에 대한 의학적 판단은 전적으로 담당
  의료진의 몫이며, 이 분석은 그 판단을 대체하지 않는다.
- 신강/신약, 격국, 용신, 희신, 조후는 제공된 데이터에 없다. 이 개념들을 스스로 추론하거나
  언급하지 않는다 — 오직 제공된 필드(일간, 사주 구성, 지장간, 십신, 십이운성, 합충형파해,
  신살, 공망, 자미두수 명궁 등)만 근거로 삼는다.
- "오행이 많다/적다", "충이 있다/없다", "합이 많다", "신살이 많다" 같은 단일 요소를 그 자체로
  길흉으로 단순 치환하지 않는다. 각 요소가 이 후보의 전체 구조 안에서 어떻게 작용하는지
  종합적으로, 비교적으로 서술한다.
- 반드시 제공된 candidate_id 목록 안에서만 언급한다. 새로운 날짜/시간을 만들거나 candidate_id를
  변형하지 않는다.
`;

export function buildFirstPassPrompt() {
  return `너는 출생일시 택일 후보를 평가하는 역할이다. 여러 후보를 짧고 일관된 기준으로
비교해서 상대적 등급(A/B/C)을 매긴다.

${COMMON_SAFETY_RULES}
- 이건 "탈락시키는" 단계가 아니라 "다음 정밀 비교 단계로 넘길 후보를 추리는" 단계다.
- relative_tier는 절대 점수가 아니라 "이번 후보군 안에서의 상대적 위치"다. 근거 없이 모든
  후보를 A로 주지 않는다 — 전체 후보 중 상대적으로 균형 잡힌 구조를 보이는 일부만 A로,
  나머지는 B/C로 분산해서 평가한다(대략 전체의 20~30% 정도만 A가 되도록 하되, 억지로 특정
  개수를 맞추려 하지 말고 실제 데이터 차이에 따라 판단한다).
- 각 후보의 strengths/concerns/comparison_signals는 짧게(각 1~2개, 문장 아닌 구절 수준).`;
}

export function buildFirstPassSchema(candidateIds) {
  return {
    type: 'object',
    additionalProperties: false,
    required: ['evaluations'],
    properties: {
      evaluations: {
        type: 'array',
        items: {
          type: 'object',
          additionalProperties: false,
          required: ['candidate_id', 'relative_tier', 'strengths', 'concerns', 'comparison_signals'],
          properties: {
            candidate_id: { type: 'string', enum: candidateIds },
            relative_tier: { type: 'string', enum: ['A', 'B', 'C'] },
            strengths: { type: 'array', items: { type: 'string' }, maxItems: 3 },
            concerns: { type: 'array', items: { type: 'string' }, maxItems: 3 },
            comparison_signals: { type: 'array', items: { type: 'string' }, maxItems: 3 },
          },
        },
      },
    },
  };
}

export function buildSecondPassPrompt() {
  return `너는 출생일시 택일 후보 중 1차로 추려진 상위 후보들을 최종적으로 정밀 비교하는
역할이다. 사주(일간, 사주 구성, 지장간, 십신, 십이운성, 합충형파해, 신살, 공망)와 자미두수
(명궁/신궁의 별 구성, 오행국)에서 실제로 제공된 정보를 전체적으로 종합해서 후보 간 차이를
비교한다.

${COMMON_SAFETY_RULES}
- 최종적으로 1위(top1)와 2~5위(top2to5, 최대 4개)만 사용자에게 노출한다.
- top1은 왜 다른 후보들에 비해 상대적으로 더 균형 잡힌 구조로 볼 수 있는지 구체적 근거를 든다.
- top2to5의 각 후보는 top1과 무엇이 다른지(how_it_differs_from_top1)를 명확히 서술한다.
- candidate_comparison에는 최종 후보 전체(top1 포함)에 대해 "1위와 비교했을 때 어떤지"를
  한두 문장으로 요약한다.
- 자미두수 정보(명궁 별 구성 등)가 실제로 후보 간 유의미한 차이를 보이지 않는다면 억지로
  비중 있게 다루지 않는다 — 사주 정보만으로 충분히 설명되면 자미두수는 보조적으로만 언급한다.`;
}

export const SECOND_PASS_RESULT_SCHEMA_BASE = {
  type: 'object',
  additionalProperties: false,
  required: ['top1', 'top2to5', 'candidate_comparison'],
  properties: {
    top1: {
      type: 'object',
      additionalProperties: false,
      required: ['candidate_id', 'final_reason', 'strengths', 'concerns'],
      properties: {
        candidate_id: { type: 'string' },
        final_reason: { type: 'string' },
        strengths: { type: 'array', items: { type: 'string' }, maxItems: 4 },
        concerns: { type: 'array', items: { type: 'string' }, maxItems: 3 },
      },
    },
    top2to5: {
      type: 'array',
      maxItems: 4,
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['candidate_id', 'relative_rank', 'strengths', 'concerns', 'how_it_differs_from_top1'],
        properties: {
          candidate_id: { type: 'string' },
          relative_rank: { type: 'integer', minimum: 2, maximum: 5 },
          strengths: { type: 'array', items: { type: 'string' }, maxItems: 3 },
          concerns: { type: 'array', items: { type: 'string' }, maxItems: 3 },
          how_it_differs_from_top1: { type: 'string' },
        },
      },
    },
    candidate_comparison: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['candidate_id', 'vs_top1_summary'],
        properties: {
          candidate_id: { type: 'string' },
          vs_top1_summary: { type: 'string' },
        },
      },
    },
  },
};

export function buildSecondPassSchema(candidateIds) {
  const schema = JSON.parse(JSON.stringify(SECOND_PASS_RESULT_SCHEMA_BASE));
  schema.properties.top1.properties.candidate_id.enum = candidateIds;
  schema.properties.top2to5.items.properties.candidate_id.enum = candidateIds;
  schema.properties.candidate_comparison.items.properties.candidate_id.enum = candidateIds;
  return schema;
}

export const SAFETY_DISCLOSURE_TEXT = '출산일시는 산모와 태아의 건강 및 담당 의료진의 의학적 판단을 최우선으로 결정해야 합니다.';

// ── 출생일 택일 결과에 대한 후속 채팅 ────────────────────────────────────
// OpenAIProvider.complete()는 항상 jsonSchema를 요구하므로(자유 텍스트 응답 미지원), 채팅
// 답변도 최소한의 구조화 스키마로 감싼다.
export const DATE_SELECTION_CHAT_RESPONSE_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['response'],
  properties: {
    response: { type: 'string' },
  },
};

export function buildDateSelectionChatPrompt() {
  return `너는 이미 생성된 출생일 택일 분석 결과에 대해 사용자의 후속 질문에 답하는 역할이다.
제공된 분석 결과(top1/top2to5/candidate_comparison)에 있는 정보만 근거로 답한다.

${COMMON_SAFETY_RULES}
- 제공된 분석 결과에 없는 새로운 날짜/시간/후보를 만들어내지 않는다.
- "왜 1위가 좋은지", "2위와 무엇이 다른지" 같은 질문에는 제공된 근거를 그대로 풀어서 설명한다.
- 분석 결과에 없는 정보를 추측해서 답하지 않는다 — 없으면 "제공된 분석에는 그 정보가 없다"고
  솔직하게 답한다.`;
}
