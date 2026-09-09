// packages/shared/categories.mjs
//
// Single source of truth for:
//   - question intent categories (spec §9)
//   - the REAL canonical field names the router is allowed to request
//     (must match schemas/canonical-chart-schema.json exactly — no invented
//     field names, per spec §10 "실제 필드명은 canonical-chart-schema.json을
//     확인하여 정확하게 작성한다")

export const QUESTION_CATEGORIES = [
  'PERSONALITY', 'EMOTION', 'CAREER', 'BUSINESS', 'MONEY', 'LOVE', 'MARRIAGE',
  'FAMILY', 'CHILDREN', 'RELATIONSHIP', 'HEALTH_LIFESTYLE', 'LEARNING',
  'MOVEMENT', 'MAJOR_PERIOD', 'ANNUAL_PERIOD', 'STRENGTH', 'WEAKNESS',
  'DECISION', 'GENERAL',
];

// Real top-level fields under canonical.saju (schemas/canonical-chart-schema.json
// §saju.properties). Interpretive concepts like 격국/용신/조후/신강신약 are NOT
// separate stored fields — they are derived BY the saju prompt FROM
// day_master + pillars. The router therefore requests the underlying data
// fields, not the derived concepts.
export const SAJU_FIELDS = [
  'day_master',            // 일간 (오행/음양)
  'pillars',                // 4주 전체 (간지/십신/운성/지장간) — 격국·용신·조후·오행·십신 해석의 기반
  'hidden_stem_borrowing',  // 인종법
  'relations',              // 합충형파해
  'special_stars',          // 신살 (귀문관살 포함 — special_stars.gwimun)
  'void_branches',          // 공망
  'major_periods',          // 대운
  'annual_periods',         // 세운 (packages/chart-engine/annual-periods.mjs로 side-car 계산됨. 없을 수도 있음 — optional 필드)
];

// Real top-level fields under canonical.ziwei.
export const ZIWEI_FIELDS = [
  'five_elements_bureau',  // 오행국
  'life_palace',            // 명궁
  'body_palace',            // 신궁
  'palaces',                 // 12궁 전체 (주성/보조성/살성) — palace_focus로 세부 필터링 가능
  'transformations',        // 사화 (생년사화)
  'major_periods',          // 대한
];

// Canonical 12-palace position enum (schemas/canonical-chart-schema.json
// $defs.ziweiPalacePosition). Used to filter `palaces` down to only the
// palace(s) relevant to a question (e.g. CAREER -> career, wealth, travel, friends).
export const ZIWEI_PALACE_POSITIONS = [
  'life', 'siblings', 'spouse', 'children', 'wealth', 'health',
  'travel', 'friends', 'career', 'property', 'fortune', 'parents',
];
