// packages/chart-engine/compatibility-ranking.mjs
//
// RAW FACT → FEATURE(compatibility-analysis.mjs, 수정 안 함) → RANKING(이 파일) 순서의
// 세 번째 계층. 여러 후보를 상대적으로 비교해서 percentile/overall_score/tier를 만든다.
//
// 절대 원칙: 이 파일은 명리학적 계산을 하지 않는다. compatibility-analysis.mjs가 이미 계산한
// raw/features를 그대로 소비해서 "여러 후보 중 상대적으로 어디쯤인지"만 통계적으로 정리한다.
// mutual_ten_god는 여기서 점수화하지 않는다(승인된 설계 §3/§4 — Explanation 전용).

const WEIGHTS_DEFAULT = { attraction: 0.25, communication: 0.25, complementarity: 0.25, stimulation: 0.25 };

// Tier 경계 — 명리학적으로 확정된 기준이 아니라 서비스 설정값. 실사용 데이터가 쌓이면 조정 가능.
const TIER_BOUNDARIES_DEFAULT = { top: 15, high: 40 }; // top: 상위 15%, high: 상위 15~40%, 나머지 candidate

/**
 * attraction_raw = 천간합(天干合) 개수 + 일지 조화 존재 여부(0/1).
 * mutual_ten_god는 포함하지 않는다(승인된 설계 §3).
 */
function attractionRaw(result) {
  const f = result.features.attraction;
  return f.stem_combine_count + (f.day_branch_harmony.length > 0 ? 1 : 0);
}

/**
 * communication_raw = 육합(六合, branch harmony) 개수만. mutual_ten_god는 포함하지 않는다(§4).
 */
function communicationRaw(result) {
  return result.features.communication.branch_harmony_count;
}

/** complementarity_raw = 오행 보완 개수 그대로(§5 — count만 Ranking에 사용). */
function complementarityRaw(result) {
  return result.features.complementarity.count;
}

/** stimulation_raw = 충(沖) 개수(§6). */
function stimulationRaw(result) {
  return result.features.stimulation.chung_count;
}

const RAW_EXTRACTORS = {
  attraction: attractionRaw,
  communication: communicationRaw,
  complementarity: complementarityRaw,
  stimulation: stimulationRaw,
};

/**
 * Midrank percentile — 동점인 값들은 평균 순위를 공유한다(승인된 설계 §8).
 * 예: [1,2,2,2,5]에서 2는 인덱스 1,2,3(0-based)에 걸쳐 있으므로 평균 순위 2를 공유.
 * @param {number[]} values - 후보군 전체의 raw 값 배열
 * @returns {number[]} 같은 길이의 percentile(0~100) 배열, 입력 순서 그대로
 */
export function midrankPercentiles(values) {
  const n = values.length;
  if (n === 0) return [];
  if (n === 1) return [50]; // 후보가 1명뿐이면 상대 비교 자체가 불가 — 중간값으로 처리

  const indexed = values.map((v, i) => ({ v, i }));
  indexed.sort((a, b) => a.v - b.v);

  const ranks = new Array(n);
  let idx = 0;
  while (idx < n) {
    let end = idx;
    while (end + 1 < n && indexed[end + 1].v === indexed[idx].v) end++;
    // idx..end가 동점 그룹 — 이 구간의 평균 순위(0-based)를 전부에게 부여
    const avgRank = (idx + end) / 2;
    for (let k = idx; k <= end; k++) ranks[indexed[k].i] = avgRank;
    idx = end + 1;
  }

  // 0-based 평균 순위를 0~100 percentile로 변환 (n=1은 위에서 이미 처리)
  return ranks.map((r) => (r / (n - 1)) * 100);
}

/**
 * 한 명의 기준 인물(person)에 대해 여러 후보(candidates)를 랭킹한다.
 *
 * @param {{ id: string, sajuA: object, sajuB: object, result: {raw:object, features:object} }[]} candidateResults
 *   - 이미 analyzeCompatibilityFact(personSaju, candidateSaju)를 호출해서 얻은 결과들의 배열.
 *     이 함수는 새로 계산하지 않고 이미 계산된 결과만 소비한다.
 * @param {object} [options]
 * @param {object} [options.weights] - 기본 동일 가중치(§9), 향후 조정 가능하도록 옵션으로 분리
 * @param {object} [options.tierBoundaries] - 기본 top 15%/high 40%(§10), 서비스 설정값
 * @returns {object[]} rank 오름차순(1위부터) 정렬된 결과 배열
 */
export function rankCandidates(candidateResults, { weights = WEIGHTS_DEFAULT, tierBoundaries = TIER_BOUNDARIES_DEFAULT } = {}) {
  const featureKeys = Object.keys(RAW_EXTRACTORS);

  const rawByFeature = {};
  for (const key of featureKeys) {
    rawByFeature[key] = candidateResults.map((c) => RAW_EXTRACTORS[key](c.result));
  }

  const percentileByFeature = {};
  for (const key of featureKeys) {
    percentileByFeature[key] = midrankPercentiles(rawByFeature[key]);
  }

  const entries = candidateResults.map((c, i) => {
    const feature_raw = {};
    const feature_percentiles = {};
    for (const key of featureKeys) {
      feature_raw[key] = rawByFeature[key][i];
      feature_percentiles[key] = percentileByFeature[key][i];
    }
    const overall_score = featureKeys.reduce((sum, key) => sum + feature_percentiles[key] * (weights[key] ?? 0), 0);
    return { candidate_id: c.id, feature_raw, feature_percentiles, overall_score, _result: c.result };
  });

  entries.sort((a, b) => b.overall_score - a.overall_score);

  // tier는 overall_score의 percentile(전체 후보군 기준)로 결정 — 개별 feature와 별개로 종합점수 자체를 다시 percentile화
  const overallScores = entries.map((e) => e.overall_score);
  const overallPercentiles = midrankPercentiles(overallScores);

  return entries.map((entry, i) => {
    const pctFromTop = 100 - overallPercentiles[i]; // "상위 N%"로 표현하기 위해 뒤집음
    let overall_tier;
    if (pctFromTop <= tierBoundaries.top) overall_tier = 'top';
    else if (pctFromTop <= tierBoundaries.high) overall_tier = 'high';
    else overall_tier = 'candidate';

    return {
      candidate_id: entry.candidate_id,
      rank: i + 1,
      overall_tier,
      overall_score: entry.overall_score,
      feature_raw: entry.feature_raw,
      feature_percentiles: entry.feature_percentiles,
      _result: entry._result, // Explanation 계층에서 재사용 — 최종 사용자 응답에는 포함하지 않음(라우트에서 제거)
    };
  });
}

export const RANKING_FEATURE_KEYS = Object.keys(RAW_EXTRACTORS);
export const DEFAULT_WEIGHTS = WEIGHTS_DEFAULT;
export const DEFAULT_TIER_BOUNDARIES = TIER_BOUNDARIES_DEFAULT;
