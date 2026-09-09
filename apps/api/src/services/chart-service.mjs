// apps/api/src/services/chart-service.mjs
//
// INPUT -> CALCULATION -> CANONICAL DATA (spec §5 layer 1-3).

import { computeChart } from '../../../../packages/chart-engine/compute.mjs';
import { buildCanonicalChart } from '../../../../packages/canonical/transform.mjs';
import { validateCanonicalChart } from '../../../../packages/canonical/validate.mjs';
import { createChartRecord, createChartRecords, getChart } from '../repositories/chart-repository.mjs';

export class ChartValidationError extends Error {
  constructor(errors) {
    super('생성된 Canonical Chart JSON이 스키마를 만족하지 않습니다.');
    this.name = 'ChartValidationError';
    this.errors = errors;
  }
}

/**
 * @param {object} birthInput - { birthDate, birthTime, gender, city, timezone }
 * @param {string} [userId]
 */
export async function createChart(birthInput, userId = null) {
  const rawEngineOutput = computeChart(birthInput);
  const canonical = buildCanonicalChart(rawEngineOutput, { engineVersion: '0.4.2' });

  const { valid, errors } = await validateCanonicalChart(canonical);
  if (!valid) {
    throw new ChartValidationError(errors);
  }

  return createChartRecord({ userId, canonical, rawEngineOutput });
}

/**
 * §Phase2(택일 300개 성능 개선, 이후 부분 성공 semantics 복원) — 여러 chart를 계산해서
 * 한 번에 저장한다.
 *
 * 계산(computeChart)은 순수 CPU 바운드 동기 함수라 Promise.all로 감싸도 실측상 이득이 없음을
 * 확인했다(워밍업 후 벤치마크: 순차 41ms vs Promise.all 83ms, 100회 기준). 그래서 계산 단계는
 * 순차 for 루프를 유지한다.
 *
 * §부분 성공 semantics — Phase2 최초 구현은 "전부 계산 성공해야 저장"(all-or-nothing)이었는데,
 * 이건 기존(배치 도입 전) computeCandidateCharts의 실제 계약과 달랐다: 기존엔 candidate 1,2,3...
 * 을 하나씩 계산+저장하다가 특정 candidate에서 실패하면, 그 이전까지 성공한 것들은 이미 파일에
 * 남아있었다("부분 성공"). 이 함수는 그 계약을 복원한다 — 실패한 candidate가 있어도 나머지는
 * 계속 계산을 시도하고, 성공한 것들만 모아서 **한 번의 배치 저장**으로 파일에 반영한다(개별
 * insert()로 되돌리지 않음 — O(N^2) 병목 제거는 그대로 유지). 오류는 삼키지 않고, 실패가
 * 하나라도 있으면 성공분을 먼저 저장한 뒤 첫 번째 오류를 그대로 다시 던진다(기존 "실패 시
 * 예외가 호출자에게 전파된다"는 계약 유지 — 반환값/에러 타입도 변경하지 않음).
 *
 * @param {Array<{birthInput: object, userId?: string}>} entries
 * @returns {Promise<Array>} 전부 성공했을 때만 반환됨(입력 순서와 정확히 동일한 순서)
 */
export async function createCharts(entries) {
  const computed = [];
  let firstError = null;
  for (const { birthInput, userId = null } of entries) {
    try {
      const rawEngineOutput = computeChart(birthInput);
      const canonical = buildCanonicalChart(rawEngineOutput, { engineVersion: '0.4.2' });
      const { valid, errors } = await validateCanonicalChart(canonical);
      if (!valid) {
        throw new ChartValidationError(errors);
      }
      computed.push({ userId, canonical, rawEngineOutput });
    } catch (err) {
      if (!firstError) firstError = err; // 오류를 삼키지 않고 기록 — 계속 진행하되 반드시 다시 던진다.
    }
  }

  const saved = computed.length > 0 ? await createChartRecords(computed) : [];

  if (firstError) {
    throw firstError; // §기존 계약 — 실패가 있으면 여전히 throw(단, 성공분은 이미 저장 완료).
  }
  return saved; // 입력 순서 그대로 반환(§5 — 순서 보존, 전부 성공한 경우에만 도달).
}

export async function fetchChart(chartId) {
  return getChart(chartId);
}
