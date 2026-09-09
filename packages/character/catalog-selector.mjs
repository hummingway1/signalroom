// packages/character/catalog-selector.mjs
//
// Rule-based (문서 요구사항 §17 — "처음부터 추천 AI나 복잡한 ML 시스템을 만들지 않는다") 다음
// 선택지 결정 로직. AI 호출 없음 — 순수 데이터 필터링/정렬.

const DEFAULT_LIMIT = 4;

/**
 * @param {object} params
 * @param {Array} params.catalog
 * @param {string} params.currentContext - 현재 화면/주제 (예: 'personality')
 * @param {string[]} [params.seenIds] - 이미 노출된 카탈로그 id 목록 (§16 — 반복 노출 방지)
 * @param {number} [params.limit] - 기본 4개 (§12 — 선택지는 3~4개 유지)
 * @returns {Array} 선택된 카탈로그 항목들 (priority 내림차순)
 */
export function selectNextChoices({ catalog, currentContext, seenIds = [], limit = DEFAULT_LIMIT }) {
  const pool = catalog ?? [];
  const candidates = pool.filter((c) => {
    if (seenIds.includes(c.id)) return false; // 이미 본 건 다시 추천 안 함
    if (c.context !== currentContext) return false;
    if (c.prev_context.length > 0 && !c.prev_context.includes(currentContext)) return false;
    return true;
  });
  candidates.sort((a, b) => b.priority - a.priority);
  return candidates.slice(0, limit);
}

/**
 * 현재 context의 후보가 다 소진됐을 때(이미 다 봤을 때) 다른 context로 자연스럽게 넘어갈 선택지를
 * 찾는다 — "이 카테고리는 더 볼 게 없으니 다른 주제로" 폴백.
 */
export function selectFallbackTopicSwitch({ catalog, excludeContext, seenIds = [], limit = DEFAULT_LIMIT }) {
  const pool = catalog ?? [];
  const candidates = pool.filter((c) => !seenIds.includes(c.id) && c.context !== excludeContext && c.prev_context.length === 0);
  candidates.sort((a, b) => b.priority - a.priority);
  return candidates.slice(0, limit);
}

/**
 * 초기 진입점 — 아직 어떤 context에도 있지 않을 때(예: 차트 생성 직후) 보여줄 첫 선택지 세트.
 * prev_context가 빈 배열인 항목들(=아무 데서나 시작 가능) 중 우선순위 높은 순, context당 1개.
 */
export function selectOpeningChoices({ catalog, limit = DEFAULT_LIMIT }) {
  const pool = catalog ?? [];
  const openers = pool.filter((c) => c.prev_context.length === 0);
  openers.sort((a, b) => b.priority - a.priority);
  const seenContexts = new Set();
  const result = [];
  for (const c of openers) {
    if (seenContexts.has(c.context)) continue;
    seenContexts.add(c.context);
    result.push(c);
    if (result.length >= limit) break;
  }
  return result;
}

// §Toss 심사 준비 중 실측 테스트로 발견한 버그 수정 — "사주볼래" 같은 명시적 서비스 진입
// 발화가 classifyMessage에서 casual이 아닌 saju_question으로 정확히 분류된 뒤, 실제 분석
// 질문("내 재물운은?")과 동일하게 Router/authorization을 거쳐서 SAJU_DETAIL 미보유
// 사용자에게 차단당하고 있었다. 새로운 상태(START_ANALYSIS 등)를 추가하는 대신, 이미 있는
// 오프닝 선택지 메커니즘(getOpeningChoices)으로 되돌리는 순수 텍스트 패턴 감지만 추가한다
// — classifyMessage 자체(casual/saju_question 이분법)는 건드리지 않는다. 패턴은 지시받은
// 예시 문구 위주로 의도적으로 좁게 잡아서, 실제 분석 질문("내 사주에서 재물운은 어때?")을
// 서비스 진입으로 오분류하지 않도록 한다.
const SERVICE_ENTRY_PATTERNS = [
  /^사주\s*볼래[!.?~ㅋㅎ]*$/, /^사주\s*봐\s*줘[!.?~ㅋㅎ]*$/, /^사주\s*봐줘[!.?~ㅋㅎ]*$/,
  /^내\s*사주\s*보고\s*싶어[!.?~ㅋㅎ]*$/, /^사주\s*분석\s*시작[!.?~ㅋㅎ]*$/, /^사주\s*시작[할래]*[!.?~ㅋㅎ]*$/,
  /^사주\s*보고\s*싶어[!.?~ㅋㅎ]*$/, /^사주\s*볼게[!.?~ㅋㅎ]*$/,
  /^자미두수로?\s*볼래[!.?~ㅋㅎ]*$/, /^자미두수\s*봐\s*줘[!.?~ㅋㅎ]*$/, /^자미두수\s*봐줘[!.?~ㅋㅎ]*$/,
  /^내\s*자미두수\s*보고\s*싶어[!.?~ㅋㅎ]*$/, /^자미두수\s*분석\s*시작[!.?~ㅋㅎ]*$/,
  /^자미두수\s*보고\s*싶어[!.?~ㅋㅎ]*$/, /^자미두수\s*볼게[!.?~ㅋㅎ]*$/,
];

/** 자유입력 텍스트가 "구체적인 질문 없이 서비스 자체를 시작해달라"는 명시적 의도인지 판별한다.
 * true를 반환해도 이건 새로운 대화 상태가 아니라, 기존 오프닝 선택지를 다시 보여주는 것으로
 * 처리된다(Router/authorization 자체를 아예 안 태우므로 quota 소비도 없음). */
export function isServiceEntryIntent(text) {
  const trimmed = (text ?? '').trim();
  return SERVICE_ENTRY_PATTERNS.some((pattern) => pattern.test(trimmed));
}
