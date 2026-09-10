// packages/canonical/transform.mjs
//
// Importable (non-CLI) Orrery-raw -> Canonical JSON transform, SAJU + ZIWEI
// only (natal omitted — see README §1). This is the same field-mapping
// logic validated in canonical-transform.mjs (preserved verbatim in this
// project as a standalone CLI script for reference / offline use), factored
// into exported functions so the chart service can call it directly.
//
// ADDITIVE UPDATE (세운/귀문관살 통합): buildCanonicalChart() now also calls
// packages/chart-engine/annual-periods.mjs and packages/chart-engine/gwimun.mjs
// — both are side-car modules that only READ the already-computed SajuResult
// and never touch calculateSaju()'s own output. transformSaju() itself is
// UNCHANGED (still produces exactly what it always produced); the new data
// is merged in at the buildCanonicalChart() level only.

import { computeAnnualPeriods, ANNUAL_PERIOD_CALCULATION_METHOD, ANNUAL_PERIOD_ENGINE_FUNCTIONS } from '../chart-engine/annual-periods.mjs';
import { extractNatalGwimun, GWIMUN_CALCULATION_METHOD, GWIMUN_PAIRS_USED } from '../chart-engine/gwimun.mjs';

const PILLAR_POSITION_BY_ORRERY_INDEX = ['hour', 'day', 'month', 'year'];
const CANONICAL_PILLAR_ORDER = ['year', 'month', 'day', 'hour'];

export const STEM_ELEMENT = {
  '甲': 'wood', '乙': 'wood', '丙': 'fire', '丁': 'fire', '戊': 'earth',
  '己': 'earth', '庚': 'metal', '辛': 'metal', '壬': 'water', '癸': 'water',
};
const STEM_YINYANG = {
  '甲': 'yang', '丙': 'yang', '戊': 'yang', '庚': 'yang', '壬': 'yang',
  '乙': 'yin', '丁': 'yin', '己': 'yin', '辛': 'yin', '癸': 'yin',
};

const ZIWEI_PALACE_CANONICAL = {
  '命宮': 'life', '兄弟': 'siblings', '夫妻': 'spouse', '子女': 'children',
  '財帛': 'wealth', '疾厄': 'health', '遷移': 'travel', '交友': 'friends',
  '官祿': 'career', '田宅': 'property', '福德': 'fortune', '父母': 'parents',
};
const ZIWEI_MAIN_STARS = new Set(['紫微', '天機', '太陽', '武曲', '天同', '廉貞', '天府', '太陰', '貪狼', '巨門', '天相', '天梁', '七殺', '破軍']);
const ZIWEI_MALEFIC_STARS = new Set(['擎羊', '陀羅', '火星', '鈴星', '地空', '地劫']);
const ZIWEI_LUCKY_STARS = new Set(['左輔', '右弼', '天魁', '天鉞', '文昌', '文曲', '祿存', '天馬']);

function ziweiStarCategory(name) {
  if (ZIWEI_MAIN_STARS.has(name)) return 'main_star';
  if (ZIWEI_MALEFIC_STARS.has(name)) return 'malefic_star';
  if (ZIWEI_LUCKY_STARS.has(name)) return 'lucky_star';
  return 'auxiliary_star';
}

export function transformSaju(saju, sourcePillars) {
  const dayPillar = sourcePillars[1];
  const dayMaster = {
    heavenly_stem: dayPillar.pillar.stem,
    element: STEM_ELEMENT[dayPillar.pillar.stem] ?? null,
    yin_yang: STEM_YINYANG[dayPillar.pillar.stem] ?? null,
  };

  const pillarsByOrreryIndex = sourcePillars.map((p, i) => ({
    position: PILLAR_POSITION_BY_ORRERY_INDEX[i],
    ganzi: p.pillar.ganzi,
    heavenly_stem: p.pillar.stem,
    earthly_branch: p.pillar.branch,
    ten_god: { stem: p.stemSipsin === '本元' ? null : p.stemSipsin, branch: p.branchSipsin },
    twelve_stage: p.unseong,
    twelve_spirit: p.sinsal ?? null,
    hidden_stems: (saju.jwabeop[i] ?? []).map((h) => ({ heavenly_stem: h.stem, ten_god: h.sipsin, twelve_stage: h.unseong })),
  }));

  const positionIndex = Object.fromEntries(pillarsByOrreryIndex.map((p, i) => [p.position, i]));
  const pillars = CANONICAL_PILLAR_ORDER.map((pos) => pillarsByOrreryIndex[positionIndex[pos]]);

  const hidden_stem_borrowing = (saju.injongbeop ?? []).map((x) => ({ category: x.category, borrowed_from_stem: x.yangStem, twelve_stage: x.unseong }));

  const pillar_pairs = Object.entries(saju.relations.pairs).map(([key, val]) => {
    const [i1, i2] = key.split(',').map(Number);
    return {
      positions: [PILLAR_POSITION_BY_ORRERY_INDEX[i1], PILLAR_POSITION_BY_ORRERY_INDEX[i2]],
      stem_relations: val.stem.map((r) => ({ type: r.type, detail: r.detail })),
      branch_relations: val.branch.map((r) => ({ type: r.type, detail: r.detail })),
    };
  });

  const special_stars = {
    yangin: saju.specialSals.yangin.map((i) => PILLAR_POSITION_BY_ORRERY_INDEX[i]),
    baekho: saju.specialSals.baekho,
    goegang: saju.specialSals.goegang,
    dohwa: saju.specialSals.dohwa.map((i) => PILLAR_POSITION_BY_ORRERY_INDEX[i]),
    cheoneul_gwiin: saju.specialSals.cheonul.map((i) => PILLAR_POSITION_BY_ORRERY_INDEX[i]),
    cheondeok_gwiin: saju.specialSals.cheonduk.map((i) => PILLAR_POSITION_BY_ORRERY_INDEX[i]),
    woldeok_gwiin: saju.specialSals.wolduk.map((i) => PILLAR_POSITION_BY_ORRERY_INDEX[i]),
    munchang_gwiin: saju.specialSals.munchang.map((i) => PILLAR_POSITION_BY_ORRERY_INDEX[i]),
    hongyeom: saju.specialSals.hongyeom,
    geumyeo: saju.specialSals.geumyeo.map((i) => PILLAR_POSITION_BY_ORRERY_INDEX[i]),
  };

  const void_branches = { branches: saju.gongmang.branches, affected_pillars: saju.gongmang.pillarIndices.map((i) => PILLAR_POSITION_BY_ORRERY_INDEX[i]) };

  const major_periods = saju.daewoon.map((dw) => ({
    sequence: dw.index,
    ganzi: dw.ganzi,
    heavenly_stem: dw.ganzi[0],
    earthly_branch: dw.ganzi[1],
    start_age: dw.age,
    start_date: dw.startDate instanceof Date ? dw.startDate.toISOString() : dw.startDate,
    ten_god: { stem: dw.stemSipsin, branch: dw.branchSipsin },
    twelve_stage: dw.unseong,
    twelve_spirit: dw.sinsal ?? null,
    is_void: dw.isGongmang,
  }));

  return {
    day_master: dayMaster,
    pillars,
    hidden_stem_borrowing,
    relations: { pillar_pairs, triple_combinations: saju.relations.triple, directional_combinations: saju.relations.directional },
    special_stars,
    void_branches,
    major_periods,
  };
}

export function transformZiwei(ziwei) {
  const chart = ziwei.chart;

  const palaces = Object.entries(chart.palaces).map(([nameKey, p]) => ({
    position: ZIWEI_PALACE_CANONICAL[nameKey] ?? nameKey,
    stem_branch: p.ganZhi,
    is_body_palace: p.isShenGong,
    stars: p.stars.map((s) => ({ name: s.name, category: ziweiStarCategory(s.name), brightness: s.brightness || null, transformation: s.siHua || null })),
  }));

  const bodyPalaceEntry = Object.entries(chart.palaces).find(([, p]) => p.isShenGong);

  const transformations = ziwei.sihuaSummary.map((s) => ({ star: s.star, type: s.siHua, palace_position: ZIWEI_PALACE_CANONICAL[s.palace] ?? s.palace }));

  const major_periods = ziwei.daxian.map((dx, i) => ({
    sequence: i + 1,
    age_start: dx.ageStart,
    age_end: dx.ageEnd,
    palace_position: ZIWEI_PALACE_CANONICAL[dx.palaceName] ?? dx.palaceName,
    stem_branch: dx.ganZhi,
    main_stars: dx.mainStars,
  }));

  return {
    five_elements_bureau: { name: chart.wuXingJu.name, number: chart.wuXingJu.number },
    life_palace: { earthly_branch: chart.mingGongZhi, stem_branch: chart.palaces['命宮']?.ganZhi ?? null },
    body_palace: { earthly_branch: chart.shenGongZhi, palace_position: bodyPalaceEntry ? (ZIWEI_PALACE_CANONICAL[bodyPalaceEntry[0]] ?? bodyPalaceEntry[0]) : null },
    palaces,
    transformations,
    major_periods,
  };
}

/**
 * @param {object} raw - output of packages/chart-engine/compute.mjs computeChart()
 * @param {object} [opts]
 * @param {boolean} [opts.includeAnnualPeriods] - 기본 true. false로 주면 세운/귀문관살 계산을
 *   건너뛰고 이전 버전과 완전히 동일한 saju 객체를 반환한다 (하위 호환용 escape hatch).
 * @param {object} [opts.annualPeriodOptions] - computeAnnualPeriods()에 그대로 전달 (fromYear/toYear).
 * @returns {object} Canonical Chart JSON (schema_version/generated_at/source/subject/saju/ziwei — no natal)
 */
export function buildCanonicalChart(raw, { adapterVersion = '1.1.0', engineVersion = 'unknown', includeAnnualPeriods = true, annualPeriodOptions = {} } = {}) {
  const sajuCanonical = transformSaju(raw.saju, raw.saju.pillars);

  if (includeAnnualPeriods) {
    // side-car — raw.saju(@orrery/core의 SajuResult)를 읽기만 함, transformSaju는 이미 끝났고
    // 그 결과에 새 필드를 "추가"만 한다. 기존 필드는 전혀 건드리지 않는다.
    sajuCanonical.annual_periods = computeAnnualPeriods(raw.saju, annualPeriodOptions);
    sajuCanonical.special_stars.gwimun = extractNatalGwimun(raw.saju);
    sajuCanonical.calculation_provenance = {
      annual_periods: {
        calculation_method: ANNUAL_PERIOD_CALCULATION_METHOD,
        engine_functions: ANNUAL_PERIOD_ENGINE_FUNCTIONS,
      },
      gwimun: {
        calculation_method: GWIMUN_CALCULATION_METHOD,
        pairs_used: GWIMUN_PAIRS_USED,
        engine_functions: ['getBranchRelation', 'analyzePillarRelations'],
      },
    };
  }

  return {
    schema_version: '1.0.0',
    generated_at: new Date().toISOString(),
    source: { engine_name: raw.meta.engine, engine_version: engineVersion, adapter_version: adapterVersion },
    subject: {
      birth_date: raw.meta.input.birthDate,
      birth_time: raw.meta.input.birthTime,
      time_known: raw.meta.input.timeKnown !== false,
      gender: raw.meta.input.gender,
      birth_place: {
        name: raw.meta.input.city,
        resolved_name: raw.meta.input.resolvedCity.name,
        latitude: raw.meta.input.resolvedCity.lat,
        longitude: raw.meta.input.resolvedCity.lon,
      },
      timezone: raw.meta.input.timezone,
    },
    saju: sajuCanonical,
    ziwei: transformZiwei(raw.ziwei),
    // natal intentionally omitted — see README §1 (서양점성술 완전 제외)
  };
}
