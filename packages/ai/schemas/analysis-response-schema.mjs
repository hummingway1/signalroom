// packages/ai/schemas/analysis-response-schema.mjs
//
// Structured Output schema for Stage 2 (combined saju/ziwei/cross-analysis +
// conversational response). See README "AI 비용 구조" for why this is one
// call instead of 3-4 separate ones.

export const ANALYSIS_RESPONSE_JSON_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['saju', 'ziwei', 'cross_analysis', 'response', 'sources', 'highlight_card'],
  properties: {
    saju: {
      type: 'object',
      additionalProperties: false,
      required: ['relevant_structure', 'interpretation'],
      properties: {
        relevant_structure: { type: 'string', description: '이번 질문과 관련해 추출된 사주 데이터에서 어떤 구조(일간/십신/격국/용신/조후/대운 등)를 근거로 삼았는지.' },
        interpretation: { type: 'string', description: '사주 관점의 해석. [사주 관점] 섹션에 사용됨.' },
      },
    },
    ziwei: {
      type: 'object',
      additionalProperties: false,
      required: ['relevant_structure', 'interpretation'],
      properties: {
        relevant_structure: { type: 'string', description: '이번 질문과 관련해 추출된 자미두수 데이터에서 어떤 궁/주성/사화/대한을 근거로 삼았는지.' },
        interpretation: { type: 'string', description: '자미두수 관점의 해석. [자미두수 관점] 섹션에 사용됨.' },
      },
    },
    cross_analysis: {
      type: 'object',
      additionalProperties: false,
      required: ['common_direction', 'differences', 'overall_judgment', 'real_world_checks'],
      properties: {
        common_direction: { type: 'string', description: '두 체계가 공통적으로 가리키는 방향. "두 점술이 증명했다" 같은 과잉 표현 금지.' },
        differences: { type: 'string', description: '두 체계가 다르게 말하는 부분. 없으면 "특별한 차이 없음"이라고 명시.' },
        overall_judgment: { type: 'string', description: '종합 판단. 확정적 예언/단정 금지.' },
        real_world_checks: { type: 'string', description: '현실에서 사용자가 스스로 확인해볼 수 있는 조건들.' },
      },
    },
    response: {
      type: 'string',
      description: '사용자에게 그대로 보여줄 최종 대화형 답변 (자연어, 전문용어 과다 나열 금지, conversation.md 스타일 준수). 질문 성격에 따라 구조를 유연하게 사용하되 safety.md의 금지사항을 절대 위반하지 않는다.',
    },
    sources: {
      type: 'object',
      additionalProperties: false,
      required: ['saju', 'ziwei'],
      description: '출처 표시용 — 실제 근거로 사용한 canonical 필드/궁 이름 (전문용어 나열 최소화, UI에서 "근거 보기" 등에 사용).',
      properties: {
        saju: { type: 'array', items: { type: 'string' } },
        ziwei: { type: 'array', items: { type: 'string' } },
      },
    },
    highlight_card: {
      // 채팅 UI에서 response 전문 대신 짧은 "카드"로 강조해서 보여줄 요약 — 프론트엔드 요구사항
      // (§15 "긴 텍스트 대신 카드로") 대응. 선택 필드: 강조할 만한 단일 포인트가 없으면 null.
      // response에 이미 있는 내용을 요약하는 것이지, response에 없는 새 사실을 추가하지 않는다 —
      // Fact/Claim/Disclosure 규칙과 동일하게 이 필드도 근거 없는 내용을 만들면 안 된다.
      type: ['object', 'null'],
      description: '채팅에서 카드로 강조할 짧은 하이라이트(선택). response 내용을 벗어난 새로운 사실을 만들지 않는다. 강조할 단일 포인트가 마땅치 않으면 null.',
      additionalProperties: false,
      required: ['title', 'subtitle', 'detail_available'],
      properties: {
        title: { type: 'string', description: '카드 제목 — 예: "2027년", "丙寅 대운". 5~10자 내외의 짧은 라벨.' },
        subtitle: { type: 'string', description: '카드 부제 — 예: "관계 변화가 커지는 시기". response의 핵심을 한 줄로.' },
        detail_available: { type: 'boolean', description: 'true면 UI가 "자세히 보기"를 노출할 수 있음(현재는 response 전문 펼치기로 연결 — 별도 상세 콘텐츠 페이지는 다음 단계).' },
      },
    },
  },
};
