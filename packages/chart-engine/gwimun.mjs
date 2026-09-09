// packages/chart-engine/gwimun.mjs
//
// 귀문관살(鬼門關殺) 판정 — 새 규칙을 만들지 않는다. @orrery/core가 이미 갖고 있는
// BRANCH_GWIMUN 상수(6쌍: 子酉/丑午/寅未/卯申/辰亥/巳戌)와, 그 상수를 실제로 조회하는
// getBranchRelation()을 authoritative source로 그대로 재사용한다. 이 모듈은 그 함수의
// 호출 결과에서 "鬼門" 타입만 걸러내는 side-car일 뿐, 지지 조합 판정 로직 자체는 전혀
// 다시 구현하지 않는다.
//
// 판정 범위 확인 (2026-08 엔진 조사 결과, 코드로 직접 확인):
//   - getBranchRelation(a, b)는 BRANCH_GWIMUN 테이블에서 (a,b) 순서쌍을 조회한다.
//   - analyzePillarRelations(ganzi1, ganzi2) → getBranchRelation(branch1, branch2)을 내부
//     호출하므로, "두 개의 60갑자(주)"가 있으면 어떤 조합이든(원국-원국, 원국-대운,
//     원국-세운, 대운-세운 등) 동일한 로직으로 귀문 판정이 가능하다 — 엔진 자체가 원국
//     4주로 범위를 제한하지 않는다. 범위 제한은 우리 코드(saju.js의 analyzeAllRelations
//     호출)가 원국 4주끼리만 돌리기 때문이지, getBranchRelation 자체의 한계가 아니다.
//   - 따라서 세운/대운과의 귀문관살도 "같은 함수를 다른 두 주에 대해 호출"하는 것으로
//     충분하며, 별도의 판정 규칙이 필요 없다.

import { getBranchRelation, analyzePillarRelations } from '@orrery/core/pillars';
import { BRANCH_GWIMUN } from '@orrery/core/constants';

export const GWIMUN_CALCULATION_METHOD = 'orrery-core-branch-gwimun-v1';

/** BRANCH_GWIMUN에 실제로 등록된 페어 목록 (provenance 기록용, 하드코딩 아님 — 엔진 상수를 그대로 읽음). */
export const GWIMUN_PAIRS_USED = Object.keys(BRANCH_GWIMUN);

const PILLAR_POSITION_BY_ORRERY_INDEX = ['hour', 'day', 'month', 'year'];

function isGwimun(relationResult) {
  return relationResult.type === '鬼門';
}

/**
 * 원국 4주끼리의 귀문관살만 추출 (이미 calculateSaju가 계산해 둔 saju.relations.pairs를
 * 재사용 — 재계산하지 않음).
 * @param {import('@orrery/core').SajuResult} sajuResult
 * @returns {Array<{ positions: [string, string], detail: string|null }>}
 */
export function extractNatalGwimun(sajuResult) {
  const hits = [];
  for (const [key, pair] of sajuResult.relations.pairs.entries()) {
    const gwimunHits = pair.branch.filter(isGwimun);
    if (gwimunHits.length === 0) continue;
    const [i1, i2] = key.split(',').map(Number);
    for (const hit of gwimunHits) {
      hits.push({ positions: [PILLAR_POSITION_BY_ORRERY_INDEX[i1], PILLAR_POSITION_BY_ORRERY_INDEX[i2]], detail: hit.detail });
    }
  }
  return hits;
}

/**
 * 임의의 두 60갑자(예: 세운 vs 원국, 세운 vs 대운) 사이의 귀문관살만 추출.
 * analyzePillarRelations를 그대로 호출 — 원국-원국 판정과 완전히 동일한 함수/로직.
 * @param {string} ganzi1
 * @param {string} ganzi2
 * @returns {Array<{ detail: string|null }>}
 */
export function checkGwimunBetween(ganzi1, ganzi2) {
  const relation = analyzePillarRelations(ganzi1, ganzi2);
  return relation.branch.filter(isGwimun).map((hit) => ({ detail: hit.detail }));
}

/** 두 지지만으로 귀문관살 여부를 바로 확인하고 싶을 때 (analyzePillarRelations보다 가벼움). */
export function checkGwimunBranches(branch1, branch2) {
  return getBranchRelation(branch1, branch2).filter(isGwimun);
}
