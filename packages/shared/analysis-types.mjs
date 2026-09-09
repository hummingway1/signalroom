// packages/shared/analysis-types.mjs
//
// §3(Phase 2 지시서) — analysis_type을 여러 곳에서 "SAJU"/"saju"/"SAJU_DETAIL"/"saju_detail"처럼
// 중복 정의하지 않는다. 이 파일이 유일한 canonical source다. products.analysis_type,
// entitlements.analysis_type, analyses.analysis_type 전부 이 값만 쓴다.
export const ANALYSIS_TYPES = Object.freeze({
  SAJU_BASIC: 'SAJU_BASIC',
  SAJU_DETAIL: 'SAJU_DETAIL',
  ZIWEI_DETAIL: 'ZIWEI_DETAIL', // 현재는 SAJU_DETAIL에 통합되어 있음(§4 Chart가 사주+자미두수 동시 포함) — 향후 분리 대비 예약
  YEARLY_FORTUNE: 'YEARLY_FORTUNE', // §Phase5 확정 정책 — BASIC/DETAIL을 analysis_type으로 나누지 않는다. tier는 product(YEARLY_FORTUNE_BASIC/YEARLY_FORTUNE_CHAT) 레벨에서 구분.
  CHILD_BASIC: 'CHILD_BASIC',
  CHILD_DETAIL: 'CHILD_DETAIL',
  RELATIONSHIP_BASIC: 'RELATIONSHIP_BASIC',
  RELATIONSHIP_DETAIL: 'RELATIONSHIP_DETAIL',
  DATE_SELECTION: 'DATE_SELECTION',
  NAMING: 'NAMING',
});

export const VALID_ANALYSIS_TYPES = Object.freeze(Object.values(ANALYSIS_TYPES));

export function isValidAnalysisType(value) {
  return VALID_ANALYSIS_TYPES.includes(value);
}
