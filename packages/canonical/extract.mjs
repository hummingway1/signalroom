// packages/canonical/extract.mjs
//
// "Relevant Data Extraction" stage. Pure code, NO AI call — this is the
// actual cost/latency saving mechanism (see README "AI 비용 구조"). Takes
// the FULL Canonical Chart JSON (kept on the server, never discarded — spec
// §5 "원본 데이터 자체는 서버에 보존한다") and a Question Router result,
// and returns a minimal object containing only the fields the router asked for.

import { expandToSamBangSaJeong } from '../shared/ziwei-relations.mjs';

/**
 * @param {object} canonical - full Canonical Chart JSON (schemas/canonical-chart-schema.json)
 * @param {object} routerResult - output of the router stage (packages/ai/schemas/router-schema.mjs)
 * @returns {object} reduced data: { subject, saju: {...selected fields}, ziwei: {...selected fields} }
 */
export function extractRelevantData(canonical, routerResult) {
  const sajuFields = routerResult.saju_fields ?? [];
  const ziweiFields = routerResult.ziwei_fields ?? [];
  const rawPalaceFocus = routerResult.ziwei_palace_focus ?? [];

  // ziwei-original.md §"12궁의 생활 영역": "궁 하나만으로 결론 내리지 않는다. 반드시 해당 궁의
  // 주성, 삼방사정, 생년사화, 보조성을 함께 본다." — the router only needs to pick the palace(s)
  // whose LIFE AREA is relevant to the question; extraction is responsible for automatically
  // including each picked palace's 대궁(opposite)+삼합궁(trine) so the mandatory 삼방사정 structure
  // is always present without the router (or the AI) having to compute palace geometry itself.
  const palaceFocus = rawPalaceFocus.length > 0 ? expandToSamBangSaJeong(rawPalaceFocus) : [];

  const saju = {};
  for (const field of sajuFields) {
    if (canonical.saju && field in canonical.saju) {
      saju[field] = canonical.saju[field];
    }
  }

  // calculation_provenance is meta-information about HOW annual_periods/gwimun were computed
  // (e.g. which BRANCH_GWIMUN pairs were used) — the router shouldn't have to know to ask for
  // this separately; it's carried along automatically whenever the data it describes is present,
  // the same way `subject` is always included regardless of router selection.
  if (canonical.saju?.calculation_provenance) {
    const relevantProvenance = {};
    if ('annual_periods' in saju && canonical.saju.calculation_provenance.annual_periods) {
      relevantProvenance.annual_periods = canonical.saju.calculation_provenance.annual_periods;
    }
    if ('special_stars' in saju && canonical.saju.calculation_provenance.gwimun) {
      relevantProvenance.gwimun = canonical.saju.calculation_provenance.gwimun;
    }
    if (Object.keys(relevantProvenance).length > 0) {
      saju.calculation_provenance = relevantProvenance;
    }
  }

  const ziwei = {};
  for (const field of ziweiFields) {
    if (!canonical.ziwei || !(field in canonical.ziwei)) continue;
    if (field === 'palaces' && palaceFocus.length > 0) {
      // Filter the 12-palace array down to only the palaces the router flagged
      // PLUS their required 삼방사정 (opposite + trine) counterparts.
      ziwei.palaces = canonical.ziwei.palaces.filter((p) => palaceFocus.includes(p.position));
    } else {
      ziwei[field] = canonical.ziwei[field];
    }
  }

  return {
    subject: canonical.subject,
    saju,
    ziwei,
  };
}

/**
 * Rough token-savings estimate for observability/testing — NOT exact (real
 * count depends on the tokenizer), but useful to prove extraction is doing
 * its job. Uses a simple chars/4 approximation.
 */
export function estimateExtractionSavings(canonical, extracted) {
  const fullChars = JSON.stringify(canonical).length;
  const extractedChars = JSON.stringify(extracted).length;
  return {
    full_chars: fullChars,
    extracted_chars: extractedChars,
    reduction_ratio: fullChars === 0 ? 0 : Number((1 - extractedChars / fullChars).toFixed(3)),
    approx_full_tokens: Math.ceil(fullChars / 4),
    approx_extracted_tokens: Math.ceil(extractedChars / 4),
  };
}
