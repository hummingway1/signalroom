// packages/chart-engine/compute.mjs
//
// Importable (non-CLI) wrapper around @orrery/core, computing SAJU + ZIWEI
// only. Western astrology (natal) is intentionally NOT computed in this
// product (see README §1 제품 방향 — "서양점성술은 이번 프로젝트에서 완전히
// 제외한다"). This is the same calculation logic validated in the earlier
// standalone test project (packages/chart-engine/orrery-test-calc.mjs,
// preserved verbatim for reference), refactored into an importable function
// so the API layer can call it directly instead of shelling out to a script.
//
// AGPL-3.0-only NOTICE: @orrery/core is AGPL-3.0-only. See README §"라이선스"
// for what this means for commercial deployment. This module exists
// specifically so the calculation engine stays swappable behind a clean
// function boundary (computeChart in, raw result out) — replacing
// @orrery/core later means rewriting only this file.

import { calculateSaju } from '@orrery/core/saju';
import { createChart, getDaxianList } from '@orrery/core/ziwei';
import { filterCities, formatCityName, SEOUL } from '@orrery/core/cities';

const KOREAN_CITY_NAME_MAP = { Incheon: '인천', Seoul: '서울', Busan: '부산' /* extend as needed */ };

function resolveCity(cityQuery) {
  const koreanQuery = KOREAN_CITY_NAME_MAP[cityQuery] ?? cityQuery;
  const hits = filterCities(koreanQuery);
  if (hits.length > 0) return { city: hits[0], matched: true, displayName: formatCityName(hits[0]) };
  return { city: SEOUL, matched: false, displayName: formatCityName(SEOUL) };
}

/**
 * @param {object} input
 * @param {string} input.birthDate - "YYYY-MM-DD"
 * @param {string} input.birthTime - "HH:mm"
 * @param {'male'|'female'} input.gender
 * @param {string} input.city
 * @param {string} [input.timezone] - only "Asia/Seoul" is currently handled correctly (see note below)
 */
export function computeChart({ birthDate, birthTime, gender, city, timezone = 'Asia/Seoul' }) {
  if (timezone !== 'Asia/Seoul') {
    // @orrery/core has no timezone parameter — it assumes KST wall-clock
    // time (see the earlier project's README for the full explanation).
    // Converting other timezones to KST is out of scope for this MVP.
    throw new ChartEngineError(
      'UNSUPPORTED_TIMEZONE',
      `현재 계산 엔진은 Asia/Seoul 기준 벽시계 시각만 지원합니다 (요청된 timezone: ${timezone}).`
    );
  }

  const { city: resolvedCity, matched, displayName } = resolveCity(city);

  const [year, month, day] = birthDate.split('-').map(Number);
  const [hour, minute] = birthTime.split(':').map(Number);
  const genderCode = gender === 'male' ? 'M' : 'F';
  const isMale = genderCode === 'M';

  const birthInput = {
    year, month, day, hour, minute,
    gender: genderCode,
    latitude: resolvedCity.lat,
    longitude: resolvedCity.lon,
  };

  const sajuResult = calculateSaju(birthInput);
  const ziweiChart = createChart(year, month, day, hour, minute, isMale);
  const ziweiDaxianList = getDaxianList(ziweiChart);

  const ziweiSihuaSummary = Object.entries(ziweiChart.palaces).flatMap(([palaceKey, palace]) =>
    palace.stars.filter((s) => s.siHua).map((s) => ({ palace: palaceKey, palaceName: palace.name, star: s.name, siHua: s.siHua }))
  );

  return {
    meta: {
      engine: '@orrery/core',
      input: {
        birthDate, birthTime, gender, city, timezone,
        resolvedCity: { query: city, matched, name: resolvedCity.name ?? displayName, lat: resolvedCity.lat, lon: resolvedCity.lon },
        birthInputUsed: birthInput,
      },
    },
    saju: sajuResult,
    ziwei: { chart: ziweiChart, sihuaSummary: ziweiSihuaSummary, daxian: ziweiDaxianList },
  };
}

export class ChartEngineError extends Error {
  constructor(code, message) {
    super(message);
    this.name = 'ChartEngineError';
    this.code = code;
  }
}
