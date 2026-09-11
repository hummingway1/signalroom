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
/** §Priority3 Hybrid 아키텍처 — 사용자 발화를 4가지 "결정적 처리" 버킷 중 하나로 분류하거나,
 * 어느 것에도 안 걸리면 null(= 기존 casual/saju_question 경로로 그대로 진행, 특히 진짜
 * 열린 대화는 Casual API가 처리하도록 남겨둔다). 문구를 하나하나 나열하는 대신 의미 단위
 * 키워드 버킷으로 판정해서 "사주 보려고"/"사주 좀 봐줘"/"사주 한번 보고싶어" 같은 무한한
 * 자연어 변형에 일반적으로 대응한다 — 특정 문장을 if문으로 추가하는 방식이 아님. */
const PAYMENT_KEYWORDS = ['결제', '카드', '페이', '계좌'];
const PRICE_KEYWORDS = ['가격', '얼마', '요금', '비용'];
const SIGNUP_KEYWORDS = ['회원가입', '가입'];
const HOW_KEYWORDS = ['어디', '어떻게', '언제', '방법'];
const START_KEYWORDS = ['보려고', '보고싶', '보고 싶', '봐줘', '보고파', '볼래', '봐줄래', '한번 볼까', '한 번 볼까', '보고싶어', '시작할래', '해줘'];
const SERVICE_NAME_KEYWORDS = ['사주', '자미두수', '궁합', '아이시그널', '택일', '작명', '신년운세', '운세'];

export function classifyServiceIntent(text) {
  const t = (text ?? '').trim();
  if (!t) return null;

  const hasPayment = PAYMENT_KEYWORDS.some((k) => t.includes(k));
  const hasPrice = PRICE_KEYWORDS.some((k) => t.includes(k));
  const hasSignup = SIGNUP_KEYWORDS.some((k) => t.includes(k));
  const hasHow = HOW_KEYWORDS.some((k) => t.includes(k));
  const hasStart = START_KEYWORDS.some((k) => t.includes(k));
  const hasServiceName = SERVICE_NAME_KEYWORDS.some((k) => t.includes(k));

  if (hasPayment && hasHow) return 'payment_question';
  if (hasPrice) return 'product_question';
  if (hasSignup && (hasHow || t.length < 15)) return 'signup_question';
  // "사주 보려고"처럼 서비스명 언급 없이도(이미 그 방에 있으므로) 시작 의도만으로 충분히 판단
  // 가능해야 한다 — SERVICE_NAME_KEYWORDS는 있으면 신뢰도를 더 높이는 보조 신호일 뿐, 필수는
  // 아니다("봐줘"만으로도 시작 의도로 본다. 다만 너무 짧은 잡담 방지를 위해 최소 길이 체크).
  if (hasStart && t.length <= 20) return 'service_start';

  return null;
}

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
