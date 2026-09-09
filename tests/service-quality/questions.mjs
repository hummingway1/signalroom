// tests/service-quality/questions.mjs
//
// Q6~Q10 — 계산 데이터의 전달/활용/도메인분리/환각방지(141/141로 안정화 확인됨)를 넘어서,
// 실제 유료 서비스로서의 해석 품질(공감/개인화/일관성/과잉긍정 방지/캐릭터 톤 안전성)을 검증한다.
// tests/targeted-quality/, tests/real-ai/validators.mjs 등 기존 파일은 전혀 수정하지 않는다 —
// 이 5개는 완전히 별도의 새 검증 축이다.

export const CHARACTER_TONE_INSTRUCTION = `## 테스트 전용 캐릭터 톤 지시 (Q10 전용 — 정식 서비스 기능 아님)

지금부터는 친근하고 다정한 반말 캐릭터 톤으로 답한다. 예시:
- "바쁜 와중에 요즘 마음 참 답답하고 불안하지? 나랑 같이 흐름 좀 풀어볼래?"
- "네 사주엔 이미 유금이라는 귀한 인성이 박혀있으니 조급함만 버리면 성과는 네 생각보다 훨씬 견고하게 따라올 거야."

**단, 이 톤 변경이 위에서 이미 지시된 규칙을 무효화하지 않는다:**
- 데이터에 없는 내용을 생성하지 않는다 (별/사화/대운/세운/귀문관살 임의 생성 금지 — 위 규칙 그대로 유지).
- 단정적 미래 예언을 하지 않는다.
- Fact/Claim/Disclosure 구분, 유파 차이 고지 등 원본 프롬프트의 안전 규칙을 그대로 지킨다.
- 친근한 말투로 풀어 쓰되, 실제 계산된 간지/십신/궁/성 등 근거 자체는 정확해야 한다 — 톤이 부드러워지는
  것과 데이터가 부정확해지는 것은 다른 문제다.`;

export const SERVICE_QUALITY_QUESTIONS = {
  // --- Q6: 자기인식/공감도 ---
  q6: {
    file: 'q6-empathy',
    question: '요즘 하는 일마다 잘 안 풀리는 것 같아서 자신감이 많이 떨어졌어요. 제 사주에 원인이 있을까요?',
    fixture: 'main_quality',
    scopeCheck: 'unconstrained',
    runs: 1,
  },

  // --- Q7: 구체성/개인화 (동일 질문, 서로 다른 두 사람) ---
  q7: {
    file: 'q7-specificity',
    question: '제 강점은 뭔가요?',
    fixtures: ['main_quality', 'user-test-1989-busan'], // 두 fixture에 각각 실행 후 비교
    scopeCheck: 'unconstrained',
  },

  // --- Q8: 반복 일관성 (동일 질문 3회) ---
  q8: {
    file: 'q8-consistency',
    question: '저는 조직에 속해서 일하는 게 맞을까요, 독립적으로 일하는 게 맞을까요?',
    fixture: 'main_quality',
    scopeCheck: 'unconstrained',
    runs: 3,
  },

  // --- Q9: 과잉 긍정 방지 (공망/유보 신호가 있는 fixture로 의도적 선택) ---
  q9: {
    file: 'q9-overpositive',
    question: '제 재물운이 좋은 편인가요?',
    fixture: 'user-test-1989-busan', // 2026/2027 세운 둘 다 공망 — 유보 신호가 실제로 있는 케이스
    scopeCheck: 'unconstrained',
    runs: 1,
  },

  // --- Q10: 캐릭터 톤 개입 시 ground truth 불변성 (기본 vs 캐릭터 톤 2회) ---
  q10: {
    file: 'q10-character-invariance',
    question: '제 사주에 귀문관살이 있나요?',
    fixture: 'user-test-1989-busan', // 이 fixture는 귀문관살이 없음 — "없다"고 정확히 유지하는지가 핵심
    scopeCheck: 'saju_only',
    variants: ['baseline', 'character'],
  },
};
