// packages/shared/ziwei-relations.mjs
//
// 자미두수 12궁의 위치 관계(대궁/삼합궁)는 명반마다 달라지지 않는 고정된 구조다 — 12궁이 항상
// 命-兄-夫-子-財-疾-遷-友-官-田-福-父 순서로 원형 배열되기 때문에, 어느 궁이 어느 궁과 대궁/삼합
// 관계인지는 지지(地支) 배정과 무관하게 항상 동일하다. 이건 "해석"이 아니라 구조적 사실이므로, AI가
// 매번 판단하게 두지 않고 코드로 고정해서 제공한다 — 원본 프롬프트(ziwei-original.md)의
// "삼방사정을 근거로 결론 내리기 전 반드시 [본궁/대궁/삼합궁1/삼합궁2]를 먼저 제시한다"는 규칙을
// AI가 틀리지 않고 지킬 수 있게 하기 위함이다.
//
// 명궁(命)-재백(財)-관록(官), 형제(兄)-질액(疾)-전택(田), 부처(夫)-천이(遷)-복덕(福),
// 자녀(子)-교우(友)-부모(父) — 이 4개 삼합 그룹은 전통 자미두수의 잘 알려진 구조(命財官/兄疾田/
// 夫遷福/子友父)와 일치한다.

export const ZIWEI_PALACE_ORDER = [
  'life', 'siblings', 'spouse', 'children', 'wealth', 'health',
  'travel', 'friends', 'career', 'property', 'fortune', 'parents',
];

export const ZIWEI_PALACE_TRIADS = [
  ['life', 'wealth', 'career'],       // 命-財-官
  ['siblings', 'health', 'property'], // 兄-疾-田
  ['spouse', 'travel', 'fortune'],    // 夫-遷-福
  ['children', 'friends', 'parents'], // 子-友-父
];

const OPPOSITE_MAP = Object.fromEntries(
  ZIWEI_PALACE_ORDER.map((pos, i) => [pos, ZIWEI_PALACE_ORDER[(i + 6) % 12]])
);

const TRIAD_MAP = Object.fromEntries(
  ZIWEI_PALACE_TRIADS.flatMap((triad) => triad.map((pos) => [pos, triad.filter((p) => p !== pos)]))
);

/**
 * @param {string} position - one of the 12 canonical ziwei palace positions
 * @returns {{ honGung: string, daeGung: string, samHapGung: [string, string] }}
 *   본궁(honGung, 그대로 반환) / 대궁(daeGung, 對宮) / 삼합궁 2개(samHapGung, 三合宮)
 */
export function getSamBangSaJeong(position) {
  if (!ZIWEI_PALACE_ORDER.includes(position)) {
    throw new Error(`Unknown ziwei palace position: ${position}`);
  }
  return { honGung: position, daeGung: OPPOSITE_MAP[position], samHapGung: TRIAD_MAP[position] };
}

/**
 * 궁 목록(예: 라우터가 고른 관심 궁)을 받아서, 원본이 요구하는 삼방사정 구조를 만족하도록
 * 대궁+삼합궁까지 전부 포함한 확장된 궁 목록을 반환한다 (중복 제거).
 * @param {string[]} positions
 * @returns {string[]}
 */
export function expandToSamBangSaJeong(positions) {
  const expanded = new Set();
  for (const pos of positions) {
    if (!ZIWEI_PALACE_ORDER.includes(pos)) continue;
    const { honGung, daeGung, samHapGung } = getSamBangSaJeong(pos);
    expanded.add(honGung);
    expanded.add(daeGung);
    samHapGung.forEach((p) => expanded.add(p));
  }
  return [...expanded];
}
