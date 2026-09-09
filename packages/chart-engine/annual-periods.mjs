// packages/chart-engine/annual-periods.mjs
//
// 사주 세운(歲運) side-car 계산 모듈. calculateSaju()/SajuResult를 절대 변경하지 않고,
// 이미 계산된 SajuResult를 "읽기만" 해서 별도의 연도별 배열을 만들어낸다.
//
// 새로운 60갑자/십신/12운성/12신살 알고리즘을 만들지 않는다 — 전부 @orrery/core의 공개
// export를 그대로 조합해서 쓴다:
//   - getYearGanzi(year)              : 세운 간지 (원국 년주와 동일한 60갑자 순환 함수)
//   - getRelation(dayStem, targetStem): 십신 (일간 기준)
//   - getJeonggi(branch)              : 지지 정기 (지지 십신 계산에 필요)
//   - getTwelveMeteor(stem, branch)   : 12운성
//   - getTwelveSpirit(yearBranch, targetBranch) : 12신살 (연지 기준)
//   - getGongmang(dayGanzi)           : 공망
//   - analyzePillarRelations(g1, g2)  : 두 60갑자 사이의 형충합회해파원진귀문 (귀문 포함,
//                                        packages/chart-engine/gwimun.mjs가 이 결과에서
//                                        鬼門만 추려낸다 — 별도 판정 로직 없음)
//
// @orrery/core 자체에는 세운 개념이 없다 (2026-08 엔진 조사 결과) — "특정 연도"라는 축을
// 추가하는 것 자체가 이 모듈의 역할이고, 그 축 위에서의 실제 계산(간지/십신/운성/신살/관계)은
// 전부 기존 엔진 함수를 그대로 호출한다.

import { getYearGanzi, getRelation, getJeonggi, getTwelveMeteor, getTwelveSpirit, getGongmang, analyzePillarRelations } from '@orrery/core/pillars';

const PILLAR_POSITION_BY_ORRERY_INDEX = ['hour', 'day', 'month', 'year'];

function findCoveringMajorPeriod(daewoon, year) {
  // daewoon은 이미 index 순(=시간 순)으로 정렬되어 있음 (@orrery/core getDaewoon 출력).
  const sorted = [...daewoon].sort((a, b) => a.startDate - b.startDate);
  let covering = null;
  for (const period of sorted) {
    if (period.startDate.getFullYear() <= year) covering = period;
    else break;
  }
  return covering;
}

/**
 * @param {import('@orrery/core').SajuResult} sajuResult - 이미 계산된 원국 (읽기 전용, 변경 없음)
 * @param {object} [options]
 * @param {number} [options.fromYear] - 기본값: 올해
 * @param {number} [options.toYear] - 기본값: fromYear + 20
 * @returns {Array<object>} annual_periods 배열 (연도 오름차순)
 */
export function computeAnnualPeriods(sajuResult, options = {}) {
  const now = new Date();
  const fromYear = options.fromYear ?? now.getFullYear();
  const toYear = options.toYear ?? fromYear + 20;

  const dayPillar = sajuResult.pillars[1]; // [시,일,월,년] 순서 — index 1 = 일주
  const yearPillar = sajuResult.pillars[3]; // index 3 = 년주
  const dayStem = dayPillar.pillar.stem;
  const dayGanzi = dayPillar.pillar.ganzi;
  const natalYearBranch = yearPillar.pillar.branch;
  const [voidBranch1, voidBranch2] = getGongmang(dayGanzi);

  const results = [];
  for (let year = fromYear; year <= toYear; year++) {
    const ganzi = getYearGanzi(year);
    const heavenlyStem = ganzi[0];
    const earthlyBranch = ganzi[1];

    const stemTenGod = getRelation(dayStem, heavenlyStem);
    const branchJeonggi = getJeonggi(earthlyBranch);
    const branchTenGod = getRelation(dayStem, branchJeonggi);

    const relatedMajorPeriod = findCoveringMajorPeriod(sajuResult.daewoon, year);

    const relationsToNatal = sajuResult.pillars.map((p, i) => {
      const rel = analyzePillarRelations(ganzi, p.pillar.ganzi);
      return {
        pillar_position: PILLAR_POSITION_BY_ORRERY_INDEX[i],
        stem_relations: rel.stem,
        branch_relations: rel.branch,
      };
    });

    const relationsToMajorPeriod = relatedMajorPeriod
      ? (() => {
          const rel = analyzePillarRelations(ganzi, relatedMajorPeriod.ganzi);
          return { major_period_ganzi: relatedMajorPeriod.ganzi, stem_relations: rel.stem, branch_relations: rel.branch };
        })()
      : null;

    results.push({
      year,
      ganzi,
      heavenly_stem: heavenlyStem,
      earthly_branch: earthlyBranch,
      ten_god: { stem: stemTenGod?.hanja ?? null, branch: branchTenGod?.hanja ?? null },
      twelve_stage: getTwelveMeteor(dayStem, earthlyBranch),
      twelve_spirit: getTwelveSpirit(natalYearBranch, earthlyBranch),
      is_void: earthlyBranch === voidBranch1 || earthlyBranch === voidBranch2,
      related_major_period: relatedMajorPeriod ? { index: relatedMajorPeriod.index, ganzi: relatedMajorPeriod.ganzi } : null,
      relations_to_natal: relationsToNatal,
      relations_to_major_period: relationsToMajorPeriod,
    });
  }

  return results;
}

export const ANNUAL_PERIOD_CALCULATION_METHOD = 'orrery-core-composed-v1';
export const ANNUAL_PERIOD_ENGINE_FUNCTIONS = [
  'getYearGanzi', 'getRelation', 'getJeonggi', 'getTwelveMeteor', 'getTwelveSpirit', 'getGongmang', 'analyzePillarRelations',
];
