// packages/chart-engine/compatibility-analysis.mjs
//
// "나와 잘 맞는 사람 찾기" 매칭 기능의 계산 기반 — Fact → Feature 레이어만 구현한다.
// Service Score/AI 해석/UI/DB/API는 이 모듈의 범위가 아니다(승인된 설계 문서 참고).
//
// 새 계산 로직을 만들지 않는다 — analyzePillarRelations/getRelation은 세운/귀문관살
// (annual-periods.mjs, gwimun.mjs)에서 이미 재사용한 @orrery/core의 공개 함수를 그대로 쓴다.
// 이 함수들이 원국 4주로 범위가 제한되지 않고 임의의 두 60갑자에 대해 작동한다는 건 이미
// gwimun.mjs 조사 결과로 확인돼 있고, 이번 모듈에서 다시 두 "사람"의 4주 교차에 적용한다.
//
// 원칙(승인된 설계 문서 그대로):
//   1. RAW FACT: 엔진이 실제로 계산한 값 그대로 보존 — 숫자로 뭉개지 않는다.
//   2. FEATURE: Fact를 유형별로 재구조화하되, 원자료(어느 주끼리 무슨 관계인지)를 잃지 않는다.
//   3. "합이 많으면 좋다/충이 많으면 나쁘다" 판단을 하지 않는다 — 이 모듈은 관계의 존재만 보고한다.
//   4. Service Score(0~100 점수화)와 AI Interpretation은 다음 단계 — 여기서 만들지 않는다.
//   5. 용신/희신/격국 궁합, 자미두수 궁합, 삼합/방합의 두 사람 적용, 성별 기반 배우자성 판정은
//      명리학적으로 검증되지 않아 이번 모듈에서 제외한다(승인된 보고서 §10).

import { getRelation, analyzePillarRelations } from '@orrery/core/pillars';

// 표준 오행 매핑(모든 명리학 자료에 공통되는 기초 상수 — 새로 만든 공식이 아니다).
// packages/canonical/transform.mjs에도 동일한 매핑(천간만)이 있지만 그 파일은 이번 작업에서
// 수정 금지 대상이라 export되어 있지 않다 — 독립적으로 재정의한다(값 자체는 완전히 동일).
const STEM_ELEMENT = {
  '甲': 'wood', '乙': 'wood', '丙': 'fire', '丁': 'fire', '戊': 'earth',
  '己': 'earth', '庚': 'metal', '辛': 'metal', '壬': 'water', '癸': 'water',
};
const BRANCH_ELEMENT = {
  '寅': 'wood', '卯': 'wood', '巳': 'fire', '午': 'fire',
  '辰': 'earth', '戌': 'earth', '丑': 'earth', '未': 'earth',
  '申': 'metal', '酉': 'metal', '亥': 'water', '子': 'water',
};

const POSITIONS = ['year', 'month', 'day', 'hour'];
const FRICTION_TYPES = new Set(['刑', '破', '害', '怨嗔', '鬼門']); // 沖은 stimulation feature 전용으로 분리(승인된 실증 결과, 상관계수 0.108)

function findPillar(pillars, position) {
  return pillars.find((p) => p.position === position) ?? null;
}

/**
 * 두 사람의 canonical.saju.pillars 4주를 전부 교차(최대 4×4=16개 조합)해서, 어느 사람의 어느 주와
 * 상대방의 어느 주 사이에 무슨 관계가 있는지 전부 추적 가능한 형태로 반환한다. 관계가 없는 조합은
 * 결과에 아예 안 남는다(추정하지 않음, §7 원칙).
 */
function computeCrossPillarRelations(pillarsA, pillarsB) {
  const relations = [];
  for (const posA of POSITIONS) {
    const pillarA = findPillar(pillarsA, posA);
    if (!pillarA) continue;
    for (const posB of POSITIONS) {
      const pillarB = findPillar(pillarsB, posB);
      if (!pillarB) continue;
      const result = analyzePillarRelations(pillarA.ganzi, pillarB.ganzi);
      for (const r of result.stem) {
        relations.push({ personA_pillar: posA, personB_pillar: posB, kind: 'stem', relation: r.type, detail: r.detail ?? null });
      }
      for (const r of result.branch) {
        relations.push({ personA_pillar: posA, personB_pillar: posB, kind: 'branch', relation: r.type, detail: r.detail ?? null });
      }
    }
  }
  return relations;
}

/**
 * 일지-일지 관계 — 4×4 전체 관계 안에 묻지 않고 별도로 계산/보존한다(§7 — 배우자궁으로서 궁합에서
 * 전통적으로 중요하게 취급되기 때문). 관계가 없으면 harmony/conflict 둘 다 빈 배열.
 */
function computeDayBranchRelation(pillarsA, pillarsB) {
  const dayA = findPillar(pillarsA, 'day');
  const dayB = findPillar(pillarsB, 'day');
  if (!dayA || !dayB) return { relations: [], harmony: [], conflict: [] };

  const result = analyzePillarRelations(dayA.ganzi, dayB.ganzi);
  const allRelations = [
    ...result.stem.map((r) => ({ kind: 'stem', relation: r.type, detail: r.detail ?? null })),
    ...result.branch.map((r) => ({ kind: 'branch', relation: r.type, detail: r.detail ?? null })),
  ];
  return {
    relations: allRelations,
    harmony: allRelations.filter((r) => r.relation === '合'),
    conflict: allRelations.filter((r) => r.relation === '沖' || FRICTION_TYPES.has(r.relation)),
  };
}

/**
 * 상호 십신 — 방향성 보존(§8). A→B와 B→A를 절대 하나로 합치지 않는다. 일간(day_master) 기준.
 */
function computeMutualTenGod(sajuA, sajuB) {
  const stemA = sajuA.day_master.heavenly_stem;
  const stemB = sajuB.day_master.heavenly_stem;
  return {
    personA_to_B: getRelation(stemA, stemB).hanja,
    personB_to_A: getRelation(stemB, stemA).hanja,
  };
}

/**
 * 오행 분포 — 4주(년/월/일/시)의 천간+지지를 전부 세어서 각자 보존(§9). 지지는 본기(지장간)가 아니라
 * 지지 자체의 통상적 오행 배속을 쓴다(예: 寅=木) — 이건 원국 해석용 격국/용신 계산이 아니라 "오행이
 * 몇 개 있는지" 세는 단순 카운트라, 지장간까지 갈 필요 없이 지지 표준 오행으로 충분하다.
 */
function computeFiveElementDistribution(pillars) {
  const counts = { wood: 0, fire: 0, earth: 0, metal: 0, water: 0 };
  for (const p of pillars) {
    const stemEl = STEM_ELEMENT[p.heavenly_stem];
    const branchEl = BRANCH_ELEMENT[p.earthly_branch];
    if (stemEl) counts[stemEl]++;
    if (branchEl) counts[branchEl]++;
  }
  return counts;
}

/**
 * 오행 보완 — "A에게 부족한(0~1개) 오행을 B가 채워주는지"를 근거와 함께 반환(§9 — 단순 숫자만
 * 반환하지 않고 어떤 오행이 어떻게 보완됐는지 추적 가능해야 함).
 */
function computeFiveElementComplementarity(fiveElementA, fiveElementB) {
  const complements = [];
  for (const element of ['wood', 'fire', 'earth', 'metal', 'water']) {
    if (fiveElementA[element] <= 1 && fiveElementB[element] >= 2) {
      complements.push({ element, lacking_in: 'personA', lacking_count: fiveElementA[element], supplied_by: 'personB', supplying_count: fiveElementB[element] });
    }
    if (fiveElementB[element] <= 1 && fiveElementA[element] >= 2) {
      complements.push({ element, lacking_in: 'personB', lacking_count: fiveElementB[element], supplied_by: 'personA', supplying_count: fiveElementA[element] });
    }
  }
  return { complements, count: complements.length };
}

/**
 * conflict_potential 전용 — 같은 "간지쌍"에서 여러 관계 유형이 동시에 발생해도(예: 害+怨嗔+鬼門이
 * 같은 지지쌍에서 함께 나오는 경우가 실제로 관측됨) 단순 개수 합산으로 과대평가하지 않도록,
 * personA_pillar-personB_pillar 조합 단위로 묶어서 반환한다(§5-⑥, §6 원칙).
 */
function groupFrictionByPillarPair(crossPillarRelations) {
  const groups = new Map();
  for (const r of crossPillarRelations) {
    if (r.kind !== 'branch' || !FRICTION_TYPES.has(r.relation)) continue;
    const key = `${r.personA_pillar}-${r.personB_pillar}`;
    if (!groups.has(key)) groups.set(key, { personA_pillar: r.personA_pillar, personB_pillar: r.personB_pillar, relations: [] });
    groups.get(key).relations.push(r.relation);
  }
  return [...groups.values()];
}

/**
 * Fact를 7개 서비스 유형별 Feature로 재구조화한다. 전부 원자료(raw relation 배열)를 그대로 포함하며,
 * 점수화하지 않는다 — count는 "몇 건인지"를 보여주는 참고용일 뿐 가중치가 적용된 점수가 아니다.
 */
function buildFeatures(raw) {
  const stemCombineRelations = raw.cross_pillar_relations.filter((r) => r.kind === 'stem' && r.relation === '合');
  const branchHarmonyRelations = raw.cross_pillar_relations.filter((r) => r.kind === 'branch' && r.relation === '合');
  const chungRelations = raw.cross_pillar_relations.filter((r) => r.kind === 'branch' && r.relation === '沖');
  const frictionRelations = raw.cross_pillar_relations.filter((r) => r.kind === 'branch' && FRICTION_TYPES.has(r.relation));
  const frictionByPillarPair = groupFrictionByPillarPair(raw.cross_pillar_relations);
  const dayStemCombine = stemCombineRelations.filter((r) => r.personA_pillar === 'day' && r.personB_pillar === 'day');

  return {
    // ① attraction — 근거: 천간합/상호십신/일지조화. 가중치 미확정(§1 원칙) — 원자료만 보존.
    attraction: {
      stem_combine_count: stemCombineRelations.length,
      stem_combine_relations: stemCombineRelations,
      mutual_ten_god: raw.mutual_ten_god,
      day_branch_harmony: raw.day_branch_relation.harmony,
    },
    // ② communication — 근거: 지지 육합. (표현 관련 십신은 별도 계산 로직 없음 — mutual_ten_god을
    // 그대로 참조해서 다음 단계(Interpretation)에서 판단하도록 여기서는 원자료만 전달)
    communication: {
      branch_harmony_count: branchHarmonyRelations.length,
      branch_harmony_relations: branchHarmonyRelations,
      mutual_ten_god: raw.mutual_ten_god,
    },
    // ③ emotional_stability — 근거: 일지 관계 + 마찰 관계. "갈등=나쁨" 판단 안 함, 데이터만 반환.
    emotional_stability: {
      day_branch_relation: raw.day_branch_relation,
      friction_count: frictionRelations.length,
      friction_relations: frictionRelations,
    },
    // ④ complementarity — 근거: 오행 보완. 실증 검증 결과(0~4, 변별력 상대적으로 약함) 명시.
    complementarity: {
      element_complements: raw.five_element_complementarity.complements,
      count: raw.five_element_complementarity.count,
      note: '28명/756건 실증 검증 결과 0~4 범위로 다른 feature 대비 변별력이 약함 — 단독 지표로 쓸지 보조 지표로 흡수할지는 서비스 설계 결정 필요(미확정).',
    },
    // ⑤ stimulation — 沖(충)만. conflict_potential과 분리(실증 상관계수 0.108, 서로 다른 축).
    stimulation: {
      chung_count: chungRelations.length,
      chung_relations: chungRelations,
    },
    // ⑥ conflict_potential — 刑破害怨嗔鬼門(沖 제외). 같은 주 쌍에서 여러 유형이 겹쳐도 원자료 보존.
    conflict_potential: {
      unique_pillar_pair_count: frictionByPillarPair.length,
      raw_relation_count: frictionRelations.length,
      pillar_pairs: frictionByPillarPair,
    },
    // ⑦ romance_chemistry — 일지 관계 + 일주끼리의 천간합. "합=무조건 좋은 연애" 판단 안 함.
    romance_chemistry: {
      day_branch_relation: raw.day_branch_relation,
      day_stem_combine: dayStemCombine,
    },
  };
}

/**
 * 두 사람의 canonical Saju(각각 { pillars, day_master } 형태 — Canonical Chart JSON의 saju 부분)를
 * 입력받아 Fact와 Feature를 반환한다. AI 판단 없음, 점수화 없음, DB/API/UI 없음 — 이 함수 자체가
 * 이번 단계의 전체 범위다.
 *
 * @param {{pillars: object[], day_master: {heavenly_stem: string}}} sajuA
 * @param {{pillars: object[], day_master: {heavenly_stem: string}}} sajuB
 * @returns {{raw: object, features: object}}
 */
export function analyzeCompatibilityFact(sajuA, sajuB) {
  const crossPillarRelations = computeCrossPillarRelations(sajuA.pillars, sajuB.pillars);
  const dayBranchRelation = computeDayBranchRelation(sajuA.pillars, sajuB.pillars);
  const mutualTenGod = computeMutualTenGod(sajuA, sajuB);
  const fiveElementA = computeFiveElementDistribution(sajuA.pillars);
  const fiveElementB = computeFiveElementDistribution(sajuB.pillars);
  const fiveElementComplementarity = computeFiveElementComplementarity(fiveElementA, fiveElementB);

  const raw = {
    cross_pillar_relations: crossPillarRelations,
    day_branch_relation: dayBranchRelation,
    mutual_ten_god: mutualTenGod,
    five_element_a: fiveElementA,
    five_element_b: fiveElementB,
    five_element_complementarity: fiveElementComplementarity,
  };

  return { raw, features: buildFeatures(raw) };
}

// provenance 기록용 — 세운/귀문관살 모듈과 동일한 관례(어떤 엔진 함수를 재사용했는지 기록).
export const COMPATIBILITY_ANALYSIS_METHOD = 'orrery-core-pillar-relations-cross-person-v1';
export const COMPATIBILITY_FEATURE_KEYS = ['attraction', 'communication', 'emotional_stability', 'complementarity', 'stimulation', 'conflict_potential', 'romance_chemistry'];
