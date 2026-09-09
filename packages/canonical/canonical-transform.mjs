// canonical-transform.mjs
//
// Adapter: @orrery/core raw output -> canonical-chart-schema.json shape.
//
// Purpose: prove the canonical schema (output/canonical-chart-schema.json)
// can actually hold everything the engine produces, and give a concrete
// example of "engine swap isolation" — if we ever replace @orrery/core with
// a different saju/ziwei/natal engine, only this file needs to change; the
// canonical JSON shape (and everything downstream: AI prompts, DB schema,
// API responses) stays identical.
//
// Usage: node canonical-transform.mjs [path/to/orrery-raw.json]
//   defaults to ./output/birth-chart-result.json
//   writes ./output/canonical-chart-example.json

import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

const ADAPTER_VERSION = '1.0.0';

// ---------------------------------------------------------------------------
// Static lookup tables (engine-specific knowledge lives ONLY in this file)
// ---------------------------------------------------------------------------

const PILLAR_POSITION_BY_ORRERY_INDEX = ['hour', 'day', 'month', 'year']; // orrery order
const CANONICAL_PILLAR_ORDER = ['year', 'month', 'day', 'hour']; // chronological, canonical order

const STEM_ELEMENT = {
  '甲': 'wood', '乙': 'wood',
  '丙': 'fire', '丁': 'fire',
  '戊': 'earth', '己': 'earth',
  '庚': 'metal', '辛': 'metal',
  '壬': 'water', '癸': 'water',
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

const ZIWEI_MAIN_STARS = new Set([
  '紫微', '天機', '太陽', '武曲', '天同', '廉貞', '天府', '太陰',
  '貪狼', '巨門', '天相', '天梁', '七殺', '破軍',
]);
const ZIWEI_MALEFIC_STARS = new Set(['擎羊', '陀羅', '火星', '鈴星', '地空', '地劫']);
const ZIWEI_LUCKY_STARS = new Set(['左輔', '右弼', '天魁', '天鉞', '文昌', '文曲', '祿存', '天馬']);

function ziweiStarCategory(name) {
  if (ZIWEI_MAIN_STARS.has(name)) return 'main_star';
  if (ZIWEI_MALEFIC_STARS.has(name)) return 'malefic_star';
  if (ZIWEI_LUCKY_STARS.has(name)) return 'lucky_star';
  return 'auxiliary_star';
}

const PLANET_ID_CANONICAL = {
  Sun: 'sun', Moon: 'moon', Mercury: 'mercury', Venus: 'venus', Mars: 'mars',
  Jupiter: 'jupiter', Saturn: 'saturn', Uranus: 'uranus', Neptune: 'neptune',
  Pluto: 'pluto', Chiron: 'chiron', NorthNode: 'north_node', SouthNode: 'south_node',
  Fortuna: 'fortuna',
};

const ASPECT_TYPE_CANONICAL = {
  conjunction: 'conjunction', sextile: 'sextile', square: 'square',
  trine: 'trine', opposition: 'opposition',
};

// ---------------------------------------------------------------------------
// Transform functions
// ---------------------------------------------------------------------------

function transformSaju(saju, sourcePillars) {
  // sourcePillars order: [hour, day, month, year] (orrery order)
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
    ten_god: {
      stem: p.stemSipsin === '本元' ? null : p.stemSipsin,
      branch: p.branchSipsin,
    },
    twelve_stage: p.unseong,
    twelve_spirit: p.sinsal ?? null,
    hidden_stems: (saju.jwabeop[i] ?? []).map((h) => ({
      heavenly_stem: h.stem,
      ten_god: h.sipsin,
      twelve_stage: h.unseong,
    })),
  }));

  // Reorder to canonical [year, month, day, hour]
  const positionIndex = Object.fromEntries(pillarsByOrreryIndex.map((p, i) => [p.position, i]));
  const pillars = CANONICAL_PILLAR_ORDER.map((pos) => pillarsByOrreryIndex[positionIndex[pos]]);

  const hidden_stem_borrowing = (saju.injongbeop ?? []).map((x) => ({
    category: x.category,
    borrowed_from_stem: x.yangStem,
    twelve_stage: x.unseong,
  }));

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

  const void_branches = {
    branches: saju.gongmang.branches,
    affected_pillars: saju.gongmang.pillarIndices.map((i) => PILLAR_POSITION_BY_ORRERY_INDEX[i]),
  };

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
    relations: {
      pillar_pairs,
      triple_combinations: saju.relations.triple,
      directional_combinations: saju.relations.directional,
    },
    special_stars,
    void_branches,
    major_periods,
  };
}

function transformZiwei(ziwei) {
  const chart = ziwei.chart;

  const palaces = Object.entries(chart.palaces).map(([nameKey, p]) => ({
    position: ZIWEI_PALACE_CANONICAL[nameKey] ?? nameKey,
    stem_branch: p.ganZhi,
    is_body_palace: p.isShenGong,
    stars: p.stars.map((s) => ({
      name: s.name,
      category: ziweiStarCategory(s.name),
      brightness: s.brightness || null,
      transformation: s.siHua || null,
    })),
  }));

  const bodyPalaceEntry = Object.entries(chart.palaces).find(([, p]) => p.isShenGong);

  const transformations = ziwei.sihuaSummary.map((s) => ({
    star: s.star,
    type: s.siHua,
    palace_position: ZIWEI_PALACE_CANONICAL[s.palace] ?? s.palace,
  }));

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
    body_palace: {
      earthly_branch: chart.shenGongZhi,
      palace_position: bodyPalaceEntry ? (ZIWEI_PALACE_CANONICAL[bodyPalaceEntry[0]] ?? bodyPalaceEntry[0]) : null,
    },
    palaces,
    transformations,
    major_periods,
  };
}

function transformNatal(natal) {
  const planets = natal.planets.map((p) => ({
    id: PLANET_ID_CANONICAL[p.id] ?? p.id.toLowerCase(),
    longitude: p.longitude,
    latitude: p.latitude ?? null,
    speed: p.speed ?? null,
    sign: p.sign,
    degree_in_sign: p.degreeInSign,
    is_retrograde: p.isRetrograde,
    house: p.house ?? null,
  }));

  const anglePoint = (a) => (a ? { longitude: a.longitude, sign: a.sign, degree_in_sign: a.degreeInSign } : null);
  const angles = natal.angles
    ? {
        ascendant: anglePoint(natal.angles.asc),
        midheaven: anglePoint(natal.angles.mc),
        descendant: anglePoint(natal.angles.desc),
        imum_coeli: anglePoint(natal.angles.ic),
      }
    : { ascendant: null, midheaven: null, descendant: null, imum_coeli: null };

  const houses = natal.houses.map((h) => ({
    number: h.number,
    cusp_longitude: h.cuspLongitude,
    sign: h.sign,
    degree_in_sign: h.degreeInSign,
  }));

  const aspects = natal.aspects.map((a) => ({
    planet_a: PLANET_ID_CANONICAL[a.planet1] ?? a.planet1.toLowerCase(),
    planet_b: PLANET_ID_CANONICAL[a.planet2] ?? a.planet2.toLowerCase(),
    type: ASPECT_TYPE_CANONICAL[a.type] ?? a.type,
    angle: a.angle,
    orb: a.orb,
  }));

  return {
    house_system: natal.houseSystem,
    planets,
    angles,
    houses,
    aspects,
  };
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  const inputPath = process.argv[2] ?? './output/birth-chart-result.json';
  const raw = JSON.parse(await readFile(path.resolve(inputPath), 'utf-8'));

  const canonical = {
    schema_version: '1.0.0',
    generated_at: new Date().toISOString(),
    source: {
      engine_name: raw.meta.engine,
      engine_version: raw.meta.engineVersion,
      adapter_version: ADAPTER_VERSION,
    },
    subject: {
      birth_date: raw.meta.input.birthDate,
      birth_time: raw.meta.input.birthTime,
      time_known: true, // this test input always includes a birth time
      gender: raw.meta.input.gender,
      birth_place: {
        name: raw.meta.input.city,
        resolved_name: raw.meta.input.resolvedCity.name,
        latitude: raw.meta.input.resolvedCity.lat,
        longitude: raw.meta.input.resolvedCity.lon,
      },
      timezone: raw.meta.input.timezone,
    },
    saju: transformSaju(raw.saju, raw.saju.pillars),
    ziwei: transformZiwei(raw.ziwei),
    natal: transformNatal(raw.natal),
  };

  const outPath = path.resolve('./output/canonical-chart-example.json');
  await writeFile(outPath, JSON.stringify(canonical, null, 2), 'utf-8');
  console.log(`✅ Saved canonical example: ${outPath}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
