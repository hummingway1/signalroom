// tests/real-ai/validators.mjs
//
// Automated (non-human) validation checks for real-AI evaluation results.
// Spec §8: "AI가 자기 답변을 스스로 '좋다'고 평가하게 하지 마라." — these
// checks are all mechanical/deterministic, never another AI call asking
// "was this good?". Human judgment (quality, classical-theory correctness,
// whether it's worth paying for) is explicitly OUT of scope here and left
// to the "사람 검토" section of REAL-AI-EVALUATION.md.

import Ajv from 'ajv';
import { ANALYSIS_RESPONSE_JSON_SCHEMA } from '../../packages/ai/schemas/analysis-response-schema.mjs';
import { extractRelevantData } from '../../packages/canonical/extract.mjs';
import { computeCurrentAge } from '../../packages/shared/date-utils.mjs';

const ajv = new Ajv({ allErrors: true, strict: false });
const validateAnalysisSchema = ajv.compile(ANALYSIS_RESPONSE_JSON_SCHEMA);

// Explicitly called out as forbidden in BOTH original prompts' 출력 공통 규칙.
const FORBIDDEN_CERTAINTY_PHRASES = ['반드시', '무조건', '100%', '운명적으로'];

// Real-AI run #1 (2026-08-17) surfaced a false-positive bug: a plain
// substring match flags "무조건 사업형이라고 단정할 수는 없어요" (= "you
// CAN'T say it's unconditionally X" — a hedge, exactly what the original
// prompts require) the same as an actual violation like "당신은 무조건
// 성공합니다". Both contain the word, but only one is a certainty claim.
//
// Fix: after finding a phrase, look at a window of text immediately
// following it (up to the next sentence boundary or NEGATION_WINDOW chars,
// whichever is shorter) for a negation marker. If one is found, the phrase
// is being used to DENY certainty (the desired behavior), not assert it, so
// it is not flagged. This is still a heuristic — pathological double
// negatives could slip through — but it eliminates the systematic
// false-positive pattern actually observed in real output (5/5 real
// occurrences across the 2026-08-17 run were hedges, 0 were genuine
// violations; see CHANGELOG for the specific quotes).
const NEGATION_WINDOW = 40;
// §실측 버그 수정(timing-quality T3, 2026) — "라기보다"(명사형: "이라기보다")만 있어서
// "다기보다"(동사형: "발생한다기보다") 같은 활용형을 놓치는 오탐(false positive: 실제로는 헤지인데
// FAIL 처리)이 있었다. "라기보다"/"다기보다" 둘 다 공통으로 포함하는 "기보다"로 일반화해서 두
// 활용형 모두 잡는다.
const NEGATION_MARKERS = ['아니', '아닙', '않', '없', '못', '기보다'];
const SENTENCE_BOUNDARY = /[.!?\n]/;

// Real-AI run #2 (main_quality fixture) surfaced another hedge pattern not
// caught by NEGATION_MARKERS: the model quoting a rejected black-and-white
// framing before refuting it — "'평생 회사원' 또는 '무조건 창업가'라는
// 양자택일보다는 ..." (= "rather than the false binary of 'lifelong
// employee' or 'unconditional entrepreneur'..."). The forbidden phrase sits
// INSIDE quotation marks as a strawman, not as the model's own assertion.
// Detecting "this phrase is quoted" is a more general fix than adding every
// individual rejection construction ("보다는", "라는 이분법", etc.) as a
// separate marker.
const QUOTE_CHARS = ['\u2018', '\u2019', '\u201c', '\u201d', '"', "'", '「', '『'];

function isWithinQuotedSpan(text, idx) {
  const before = text.slice(Math.max(0, idx - NEGATION_WINDOW), idx);
  const after = text.slice(idx, idx + NEGATION_WINDOW);
  const hasOpenBefore = QUOTE_CHARS.some((q) => before.includes(q));
  const hasCloseAfter = QUOTE_CHARS.some((q) => after.includes(q));
  return hasOpenBefore && hasCloseAfter;
}

function findUnhedgedOccurrences(text, phrase) {
  const flagged = [];
  let searchFrom = 0;
  while (true) {
    const idx = text.indexOf(phrase, searchFrom);
    if (idx === -1) break;
    const afterStart = idx + phrase.length;
    const boundaryMatch = text.slice(afterStart, afterStart + NEGATION_WINDOW).search(SENTENCE_BOUNDARY);
    const windowEnd = afterStart + (boundaryMatch === -1 ? NEGATION_WINDOW : boundaryMatch);
    const window = text.slice(afterStart, windowEnd);
    const isHedged = NEGATION_MARKERS.some((m) => window.includes(m)) || isWithinQuotedSpan(text, idx);
    if (!isHedged) {
      flagged.push({ phrase, context: text.slice(Math.max(0, idx - 20), windowEnd) });
    }
    searchFrom = afterStart;
  }
  return flagged;
}

// A representative (not exhaustive) set of star/stem/branch names the AI
// could plausibly hallucinate if it invents data. Used only to flag
// suspicious mentions for human follow-up, not as a definitive hallucination
// proof (a false positive is possible, e.g. explaining why a star is ABSENT).
const ALL_ZIWEI_STAR_NAMES = [
  '紫微', '天機', '太陽', '武曲', '天同', '廉貞', '天府', '太陰', '貪狼', '巨門', '天相', '天梁', '七殺', '破軍',
  '左輔', '右弼', '天魁', '天鉞', '文昌', '文曲', '祿存', '天馬',
  '擎羊', '陀羅', '火星', '鈴星', '地空', '地劫',
];
const ALL_STEMS = ['甲', '乙', '丙', '丁', '戊', '己', '庚', '辛', '壬', '癸'];
const ALL_BRANCHES = ['子', '丑', '寅', '卯', '辰', '巳', '午', '未', '申', '酉', '戌', '亥'];

function collectPresentZiweiStars(extracted) {
  const present = new Set();
  for (const p of extracted?.ziwei?.palaces ?? []) {
    for (const s of p.stars ?? []) present.add(s.name);
  }
  return present;
}

function collectPresentSajuStemsBranches(extracted) {
  const stems = new Set();
  const branches = new Set();
  for (const p of extracted?.saju?.pillars ?? []) {
    if (p.heavenly_stem) stems.add(p.heavenly_stem);
    if (p.earthly_branch) branches.add(p.earthly_branch);
    for (const h of p.hidden_stems ?? []) if (h.heavenly_stem) stems.add(h.heavenly_stem);
  }
  if (extracted?.saju?.day_master?.heavenly_stem) stems.add(extracted.saju.day_master.heavenly_stem);
  for (const dw of extracted?.saju?.major_periods ?? []) {
    if (dw.heavenly_stem) stems.add(dw.heavenly_stem);
    if (dw.earthly_branch) branches.add(dw.earthly_branch);
  }
  return { stems, branches };
}

// --- 세운/귀문관살/대운 fabrication checks (added after the follow-up task
// requesting explicit "invented data the chart doesn't have" detection) ---
//
// Canonical JSON currently has NO 세운(annual_periods) field and NO
// special_stars.gwimun(귀문관살) field at all — this was confirmed by the
// engine investigation (see CHANGELOG). So for now, ANY concrete claim tied
// to either concept is by definition unsupported by data. These checks are
// written so that once those fields ARE implemented (a separately-approved
// future step), only the "hasField" branch needs updating — the rest of the
// fabrication-detection logic stays valid.

function findGanziTokens(text) {
  const tokens = [];
  for (let i = 0; i < text.length - 1; i++) {
    if (ALL_STEMS.includes(text[i]) && ALL_BRANCHES.includes(text[i + 1])) {
      tokens.push({ ganzi: text[i] + text[i + 1], index: i });
    }
  }
  return tokens;
}

// Broader than NEGATION_MARKERS — these specifically signal "this data is
// absent / uncomputed", which is the CORRECT thing for the model to say
// about 세운/귀문관살/미래 대운 given the current schema.
const DATA_ABSENCE_MARKERS = ['없', '제공되지', '데이터가', '확인할 수 없', '알 수 없', '어렵', '정보가 부족', '계산되지', '포함되어 있지', '제공된 데이터', '시작되지 않'];
const DISCLAIMER_WINDOW = 60;

function hasNearbyDisclaimer(text, idx) {
  const before = text.slice(Math.max(0, idx - DISCLAIMER_WINDOW), idx);
  const after = text.slice(idx, idx + DISCLAIMER_WINDOW);
  return DATA_ABSENCE_MARKERS.some((m) => before.includes(m) || after.includes(m));
}

/** 세운 언급 + 근처의 구체적 간지(예: "丁亥") = 데이터에 없는 세운을 지어낸 것으로 간주. */
function checkAnnualPeriodFabrication(text, extractedSaju) {
  const hasField = Array.isArray(extractedSaju?.annual_periods);
  const presentGanzi = hasField ? new Set(extractedSaju.annual_periods.map((p) => p.ganzi)) : null;

  const flagged = [];
  let idx = text.indexOf('세운');
  while (idx !== -1) {
    const windowStart = Math.max(0, idx - 20);
    const windowEnd = Math.min(text.length, idx + 20);
    const nearbyGanzi = findGanziTokens(text.slice(windowStart, windowEnd));
    if (nearbyGanzi.length > 0 && !hasNearbyDisclaimer(text, idx)) {
      if (!hasField) {
        // 필드 자체가 없는데 구체적 간지를 제시 — 무조건 fabrication.
        flagged.push({ context: text.slice(windowStart, windowEnd), ganzi: nearbyGanzi.map((t) => t.ganzi), reason: 'annual_periods 필드 자체가 추출되지 않음' });
      } else {
        // 필드는 있음 — 실제 계산된 간지 목록에 없는 값을 댔는지 확인.
        const unmatched = nearbyGanzi.filter((t) => !presentGanzi.has(t.ganzi));
        if (unmatched.length > 0) {
          flagged.push({ context: text.slice(windowStart, windowEnd), ganzi: unmatched.map((t) => t.ganzi), reason: '추출된 annual_periods에 없는 간지' });
        }
      }
    }
    idx = text.indexOf('세운', idx + 2);
  }
  return { pass: flagged.length === 0, details: { flagged, has_annual_periods_field: hasField, note: hasField ? '실제 annual_periods 값과 대조함.' : '세운 데이터가 없는 상태에서 구체적 간지를 세운과 함께 제시하면 hallucination.' } };
}

const ASSERTIVE_PRESENCE_MARKERS = ['있습니다', '있어요', '있다', '해당합니다', '해당돼요', '해당된다', '나타납니다', '나타난다', '작용합니다', '작용한다', '작용해', '영향을 줍니다', '영향을 준다'];

/**
 * "~수 있습니다"/"~수 있다"(가능성을 나타내는 조동사 구문)를 "귀문관살이 있다"(존재 단정)와
 * 구분한다. 2026-08-17 실행에서 실제 오탐 발견: "귀문관살은 유파에 따라 판정 범위가 달라질 수
 * 있습니다"(순수 caveat 문장)의 "있습니다"가 존재 단정으로 오인됨.
 */
function isPossibilityModal(text, markerAbsoluteIdx) {
  const before = text.slice(Math.max(0, markerAbsoluteIdx - 3), markerAbsoluteIdx);
  return /수\s?$/.test(before);
}

/** 귀문관살 언급 + 존재를 단정하는 서술 (근처에 데이터 부재 고지 없이) = fabrication으로 간주. */
function checkGwimunFabrication(text, extractedSaju) {
  const hasField = extractedSaju?.special_stars && Object.prototype.hasOwnProperty.call(extractedSaju.special_stars, 'gwimun');
  const actuallyPresent = hasField && extractedSaju.special_stars.gwimun.length > 0;

  const flagged = [];
  let searchFrom = 0;
  while (true) {
    const idx = text.indexOf('귀문관살', searchFrom);
    if (idx === -1) break;
    const afterStart = idx + 4;
    const after = text.slice(afterStart, afterStart + 30);
    let asserts = false;
    for (const m of ASSERTIVE_PRESENCE_MARKERS) {
      const mIdx = after.indexOf(m);
      if (mIdx === -1) continue;
      if (!isPossibilityModal(text, afterStart + mIdx)) { asserts = true; break; }
    }
    if (asserts && !hasNearbyDisclaimer(text, idx)) {
      if (!hasField) {
        flagged.push({ context: text.slice(Math.max(0, idx - 20), idx + 34), reason: 'gwimun 필드 자체가 추출되지 않음' });
      } else if (!actuallyPresent) {
        // 필드는 있지만(빈 배열) 존재를 단정 — 실제 계산 결과와 모순.
        flagged.push({ context: text.slice(Math.max(0, idx - 20), idx + 34), reason: '추출된 gwimun 배열이 비어있는데 존재를 단정함' });
      }
      // hasField && actuallyPresent: 실제로 계산된 귀문관살이 있으므로 단정 서술이 근거 있음 — 정상.
    }
    searchFrom = idx + 4;
  }
  return {
    pass: flagged.length === 0,
    details: {
      flagged,
      has_gwimun_field: hasField,
      actually_present: actuallyPresent,
      note: hasField ? '실제 special_stars.gwimun 값과 대조함.' : '귀문관살 데이터가 없는 상태에서 존재를 단정하면 hallucination. 부재를 설명하는 문맥은 제외.',
    },
  };
}

/** 대운 언급 + 추출된 major_periods에 없는 간지 = fabrication으로 간주.
 *
 * 2026-08-17 targeted-quality 실행에서 실제 오탐 발견: "현재의 己未 대운 안에 있습니다. 세운에는..."
 * 처럼 대운을 설명하며 세운(annual_periods) 간지를 정당하게 함께 언급하는 문장에서, 그 세운 간지가
 * major_periods 목록에 없다는 이유만으로 fabrication으로 잘못 판정됐다. annual_periods가 함께
 * 추출된 경우 그 간지도 "이 대화에서 정당하게 등장 가능한 값"으로 인정해야 한다.
 */
function checkDaewoonFabrication(text, extractedSaju) {
  const presentMajorGanzi = new Set((extractedSaju?.major_periods ?? []).map((p) => p.ganzi));
  const presentAnnualGanzi = new Set((extractedSaju?.annual_periods ?? []).map((p) => p.ganzi));
  const flagged = [];
  let searchFrom = 0;
  while (true) {
    const idx = text.indexOf('대운', searchFrom);
    if (idx === -1) break;
    const windowStart = Math.max(0, idx - 15);
    const windowEnd = Math.min(text.length, idx + 15);
    const nearbyGanzi = findGanziTokens(text.slice(windowStart, windowEnd));
    for (const t of nearbyGanzi) {
      const isKnown = presentMajorGanzi.has(t.ganzi) || presentAnnualGanzi.has(t.ganzi);
      if (!isKnown && !hasNearbyDisclaimer(text, idx)) {
        flagged.push({ ganzi: t.ganzi, context: text.slice(windowStart, windowEnd) });
      }
    }
    searchFrom = idx + 2;
  }
  return { pass: flagged.length === 0, details: { flagged, present_major_ganzi: [...presentMajorGanzi], present_annual_ganzi: [...presentAnnualGanzi] } };
}

/**
 * 현재 나이가 어떤 대운 구간에도 속하지 않는 경우(예: 첫 대운 시작 나이 미만인 유아 명반),
 * AI가 "현재 대운"을 구체적으로 특정하려 하지 않았는지 확인한다. 유효한 구간이 있으면 항상 PASS
 * (특정 자체는 정상 동작).
 */
function checkCurrentDaewoonHandling(text, extractedSaju, subjectBirthDate) {
  const periods = extractedSaju?.major_periods ?? [];
  if (!subjectBirthDate || periods.length === 0) {
    return { pass: true, details: { note: '대운 데이터가 추출되지 않은 질문 — 해당 없음(N/A).' } };
  }
  const age = computeCurrentAge(subjectBirthDate);
  const sorted = [...periods].sort((a, b) => a.start_age - b.start_age);
  const hasCoveringPeriod = age >= sorted[0].start_age;
  if (hasCoveringPeriod) {
    return { pass: true, details: { note: '현재 나이가 유효한 대운 구간에 속함 — 특정 자체가 정상 동작.', age } };
  }
  const match = text.match(/현재\s*대운/);
  if (!match) {
    return { pass: true, details: { note: '아직 대운이 시작되지 않은 나이인데 "현재 대운"을 특정하지 않음 — 올바른 동작.', age, first_daewoon_start_age: sorted[0].start_age } };
  }
  const idx = match.index;
  const disclaimed = hasNearbyDisclaimer(text, idx);
  return {
    pass: disclaimed,
    details: {
      note: disclaimed
        ? '"현재 대운"을 언급했지만 데이터 부재/미도래를 함께 명시함 — 올바른 동작.'
        : '나이가 첫 대운 시작 나이 미만인데 "현재 대운"을 특정하려는 서술이 발견됨.',
      age,
      first_daewoon_start_age: sorted[0].start_age,
    },
  };
}

/**
 * 데이터가 부족한 상황(예: 유효한 현재 대운이 없음)에서 AI가 분석 제한을 실제로 언급했는지 확인.
 * needsDisclosure가 false면 애초에 해당 없음(N/A)으로 처리.
 */
function checkDataLimitationDisclosure(text, needsDisclosure) {
  if (!needsDisclosure) return { pass: true, details: { note: '데이터 제한 상황이 아님 — 해당 없음(N/A).' } };
  const disclosed = DATA_ABSENCE_MARKERS.some((m) => text.includes(m));
  return { pass: disclosed, details: { disclosed } };
}

/**
 * Runs every automated check against one real-AI test result.
 * @param {object} params
 * @param {object} params.analysisData - the parsed structured-output object (schema: analysis-response-schema.mjs)
 * @param {string} params.responseText - analysisData.response (also checked separately for convenience)
 * @param {object} params.routing - router output for this question
 * @param {object} params.extracted - extracted data actually used
 * @param {object} params.canonical - full canonical chart (for independent extraction re-check)
 * @param {'saju_only'|'ziwei_only'|'both'} params.expectedScope - what this test case SHOULD have routed to
 */
export function validateRealAIResult({ analysisData, routing, extracted, canonical, expectedScope }) {
  const checks = {};

  // 1. JSON schema conformance
  const schemaValid = validateAnalysisSchema(analysisData);
  checks.json_schema_valid = { pass: schemaValid, details: schemaValid ? null : validateAnalysisSchema.errors };

  // 2. required fields present and non-empty
  const requiredNonEmpty = [
    analysisData?.response?.length > 0,
    analysisData?.saju?.interpretation?.length > 0,
    analysisData?.ziwei?.interpretation?.length > 0,
    analysisData?.cross_analysis?.overall_judgment?.length > 0,
  ];
  checks.required_fields_non_empty = { pass: requiredNonEmpty.every(Boolean), details: { response: requiredNonEmpty[0], saju: requiredNonEmpty[1], ziwei: requiredNonEmpty[2], cross_analysis: requiredNonEmpty[3] } };

  // 3. forbidden certainty phrases
  const allText = [
    analysisData?.response,
    analysisData?.saju?.interpretation,
    analysisData?.ziwei?.interpretation,
    analysisData?.cross_analysis?.overall_judgment,
    analysisData?.cross_analysis?.common_direction,
    analysisData?.cross_analysis?.differences,
  ].filter(Boolean).join('\n');
  const allOccurrences = FORBIDDEN_CERTAINTY_PHRASES.flatMap((phrase) => findUnhedgedOccurrences(allText, phrase));
  const rawMatchCount = FORBIDDEN_CERTAINTY_PHRASES.reduce((sum, p) => sum + (allText.split(p).length - 1), 0);
  checks.forbidden_certainty_phrases = {
    pass: allOccurrences.length === 0,
    details: {
      flagged: allOccurrences,
      raw_match_count: rawMatchCount,
      hedged_and_excluded: rawMatchCount - allOccurrences.length,
    },
  };

  // 4. missing data hallucination (best-effort heuristic — flags for human review, not definitive)
  const presentStars = collectPresentZiweiStars(extracted);
  const mentionedButAbsentStars = ALL_ZIWEI_STAR_NAMES.filter((star) => allText.includes(star) && !presentStars.has(star));
  const { stems: presentStems, branches: presentBranches } = collectPresentSajuStemsBranches(extracted);
  // Note: single-character stem/branch hanzi are too noisy to scan reliably in free text
  // (e.g. 丁 could appear in an unrelated word), so we only flag when the extracted
  // saju data is completely EMPTY but stem/branch characters still appear in the text —
  // a much stronger signal that something was fabricated with no basis at all.
  const sajuDataEmpty = Object.keys(extracted?.saju ?? {}).length === 0;
  const suspiciousStemBranchMentions = sajuDataEmpty
    ? [...ALL_STEMS, ...ALL_BRANCHES].filter((c) => allText.includes(c))
    : [];
  checks.missing_data_hallucination = {
    pass: mentionedButAbsentStars.length === 0 && suspiciousStemBranchMentions.length === 0,
    details: { mentionedButAbsentStars, suspiciousStemBranchMentions, note: '휴리스틱 — false positive 가능, 사람 검토 필요' },
  };

  // 5. routing correctness (against the scope this test case was designed to exercise)
  const sajuFilled = (routing?.saju_fields?.length ?? 0) > 0;
  const ziweiFilled = (routing?.ziwei_fields?.length ?? 0) > 0;
  let routingPass;
  if (expectedScope === 'unconstrained') {
    // Question text doesn't name a system, so router-md's own fallback rule
    // ("특정 체계를 지정하지 않으면 두 체계 모두에서 채운다") means EITHER
    // outcome could be legitimate. Never auto-fail this — just record what
    // actually happened for human review (§8 사람 검토).
    routingPass = true;
  } else if (expectedScope === 'saju_only') routingPass = sajuFilled && !ziweiFilled;
  else if (expectedScope === 'ziwei_only') routingPass = !sajuFilled && ziweiFilled;
  else routingPass = sajuFilled && ziweiFilled; // 'both'
  checks.routing_correctness = { pass: routingPass, details: { expectedScope, sajuFilled, ziweiFilled, informational_only: expectedScope === 'unconstrained' } };

  // 6. extraction correctness — independently re-run extraction and diff
  const independentlyExtracted = extractRelevantData(canonical, routing);
  const extractionMatches = JSON.stringify(independentlyExtracted) === JSON.stringify(extracted);
  checks.extraction_correctness = { pass: extractionMatches, details: extractionMatches ? null : 'extracted data does not match what extractRelevantData(canonical, routing) independently produces' };

  // 7. 세운 fabrication — canonical currently has no annual_periods field at all
  checks.no_annual_period_fabrication = checkAnnualPeriodFabrication(allText, extracted?.saju);

  // 8. 귀문관살 fabrication — canonical currently has no special_stars.gwimun field at all
  checks.no_gwimun_fabrication = checkGwimunFabrication(allText, extracted?.saju);

  // 9. 대운 fabrication — any 대운-adjacent ganzi not in the actually-extracted major_periods
  checks.no_daewoon_fabrication = checkDaewoonFabrication(allText, extracted?.saju);

  // 10. 현재 대운을 특정할 수 없는 나이(예: 유아 명반)에서 AI가 억지로 특정하지 않는지
  const currentDaewoonCheck = checkCurrentDaewoonHandling(allText, extracted?.saju, canonical?.subject?.birth_date);
  checks.current_daewoon_handling = currentDaewoonCheck;

  // 11. 위 상황(현재 대운 특정 불가)처럼 데이터가 부족할 때, 분석 제한을 실제로 명시하는지
  const needsLimitationDisclosure = currentDaewoonCheck.details?.age !== undefined && currentDaewoonCheck.details?.first_daewoon_start_age !== undefined
    && currentDaewoonCheck.details.age < currentDaewoonCheck.details.first_daewoon_start_age;
  checks.data_limitation_disclosure = checkDataLimitationDisclosure(allText, needsLimitationDisclosure);

  const allPass = Object.values(checks).every((c) => c.pass);
  return { overall_pass: allPass, checks };
}
