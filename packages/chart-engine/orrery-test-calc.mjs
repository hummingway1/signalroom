// test-calc.mjs
//
// Minimal Node.js harness for @orrery/core.
// Input: birth date/time/gender/city/timezone
// Output: JSON file containing 사주, 자미두수, 서양점성술 birth-chart data.
//
// No UI, no AI analysis — this only proves the calculation pipeline works
// end-to-end in a local Node environment.

import { writeFile, mkdir, readFile } from 'node:fs/promises';
import path from 'node:path';

let orreryPkgVersion = 'unknown';
try {
  const pkgPath = path.resolve('./node_modules/@orrery/core/package.json');
  orreryPkgVersion = JSON.parse(await readFile(pkgPath, 'utf-8')).version;
} catch {
  // best-effort only — not critical to the calculation itself
}

import { calculateSaju } from '@orrery/core/saju';
import { createChart, getDaxianList } from '@orrery/core/ziwei';
import { calculateNatal } from '@orrery/core/natal';
import { filterCities, formatCityName, SEOUL } from '@orrery/core/cities';

// ---------------------------------------------------------------------------
// 1. Raw user input (as given in the spec)
// ---------------------------------------------------------------------------
const rawInput = {
  birthDate: '2026-08-06',
  birthTime: '10:59',
  gender: 'male',
  city: 'Incheon',
  timezone: 'Asia/Seoul',
};

// ---------------------------------------------------------------------------
// 2. Resolve city -> lat/lon
//    @orrery/core does not accept a raw timezone string. It always computes
//    with plain local wall-clock numbers (year/month/day/hour/minute) and
//    assumes Korean local time (KST, UTC+9), with a special-case correction
//    only for the 1987-1988 Korean Daylight Time period. Since our timezone
//    IS Asia/Seoul, this is exactly correct with no extra conversion needed.
//    If timezone were something other than Asia/Seoul, we'd need to convert
//    the wall-clock time to Seoul-local time ourselves before calling these
//    functions — @orrery/core has no timezone-aware input.
// ---------------------------------------------------------------------------
function resolveCity(cityQuery) {
  // filterCities searches Korean city names (and Korean initial-consonant
  // search). "Incheon" (English) won't match, so try Korean first, then
  // fall back to a small manual lookup, then Seoul default.
  const koreanNameMap = { Incheon: '인천' };
  const koreanQuery = koreanNameMap[cityQuery] ?? cityQuery;

  const hits = filterCities(koreanQuery);
  if (hits.length > 0) {
    return { city: hits[0], matched: true, displayName: formatCityName(hits[0]) };
  }
  return { city: SEOUL, matched: false, displayName: formatCityName(SEOUL) };
}

const { city, matched, displayName } = resolveCity(rawInput.city);
if (!matched) {
  console.warn(
    `[warn] city "${rawInput.city}" not found in @orrery/core city table — falling back to Seoul coordinates.`
  );
}
console.log(`City resolved: ${rawInput.city} -> ${displayName} (lat=${city.lat}, lon=${city.lon})`);

// ---------------------------------------------------------------------------
// 3. Parse date/time and build BirthInput
// ---------------------------------------------------------------------------
const [year, month, day] = rawInput.birthDate.split('-').map(Number);
const [hour, minute] = rawInput.birthTime.split(':').map(Number);
const genderCode = rawInput.gender === 'male' ? 'M' : 'F';
const isMale = genderCode === 'M';

/** @type {import('@orrery/core/types').BirthInput} */
const birthInput = {
  year,
  month,
  day,
  hour,
  minute,
  gender: genderCode,
  latitude: city.lat,
  longitude: city.lon,
};

console.log('BirthInput:', birthInput);

// ---------------------------------------------------------------------------
// 4. 사주팔자 (Saju) — pillars, 십신, 지장간, 운성, 합충형파해, 신살, 대운
// ---------------------------------------------------------------------------
const sajuResult = calculateSaju(birthInput);

// ---------------------------------------------------------------------------
// 5. 자미두수 (Ziwei Doushu) — 명반, 사화, 대한(대운)
// ---------------------------------------------------------------------------
const ziweiChart = createChart(year, month, day, hour, minute, isMale);
const ziweiDaxianList = getDaxianList(ziweiChart);

// 사화 (化祿/化權/化科/化忌) is embedded per-star inside each palace
// (star.siHua). Also collect a flat summary for convenience.
const ziweiSihuaSummary = Object.entries(ziweiChart.palaces).flatMap(([palaceKey, palace]) =>
  palace.stars
    .filter((s) => s.siHua)
    .map((s) => ({
      palace: palaceKey,
      palaceName: palace.name,
      star: s.name,
      siHua: s.siHua,
    }))
);

// ---------------------------------------------------------------------------
// 6. 서양점성술 출생차트 (Western Natal Chart) — 행성, ASC/MC, House, Aspect
// ---------------------------------------------------------------------------
const natalChart = await calculateNatal(birthInput); // Placidus (default)

// ---------------------------------------------------------------------------
// 7. Assemble final JSON, mapping to the 15 requested output items.
//    Map objects (e.g. relations.pairs) don't survive JSON.stringify as-is,
//    so we normalize them here.
// ---------------------------------------------------------------------------
function mapToObject(map) {
  return Object.fromEntries(map.entries());
}

const output = {
  meta: {
    generatedAt: new Date().toISOString(),
    engine: '@orrery/core',
    engineVersion: orreryPkgVersion,
    input: {
      ...rawInput,
      resolvedCity: { query: rawInput.city, matched, ...city },
      birthInputUsed: birthInput,
    },
  },

  saju: {
    // 1. 사주 원국
    pillars: sajuResult.pillars,
    // 2. 십신 (already embedded as stemSipsin/branchSipsin in each pillar,
    //    plus low-level relation pairs)
    // 3. 지장간 (embedded as .jigang in each pillar, plus 좌법/인종법 detail)
    jwabeop: sajuResult.jwabeop,
    injongbeop: sajuResult.injongbeop,
    // 4. 운성 (embedded as .unseong in each pillar / daewoon)
    // 5. 합충형파해
    relations: {
      pairs: mapToObject(sajuResult.relations.pairs),
      triple: sajuResult.relations.triple,
      directional: sajuResult.relations.directional,
    },
    // 6. 신살
    specialSals: sajuResult.specialSals,
    gongmang: sajuResult.gongmang,
    // 7. 대운
    daewoon: sajuResult.daewoon,
  },

  ziwei: {
    // 8. 자미두수 명반
    chart: ziweiChart,
    // 9. 사화
    sihuaSummary: ziweiSihuaSummary,
    // 10. 대운 (자미두수의 대한)
    daxian: ziweiDaxianList,
  },

  natal: {
    houseSystem: 'Placidus',
    // 11. 서양점성술 행성 위치
    planets: natalChart.planets,
    // 12. ASC / 13. MC (+ DESC, IC included for completeness)
    angles: natalChart.angles,
    // 14. House
    houses: natalChart.houses,
    // 15. Aspect
    aspects: natalChart.aspects,
  },
};

// ---------------------------------------------------------------------------
// 8. Write to JSON file
// ---------------------------------------------------------------------------
const outDir = path.resolve('./output');
await mkdir(outDir, { recursive: true });
const outPath = path.join(outDir, 'birth-chart-result.json');

await writeFile(outPath, JSON.stringify(output, null, 2), 'utf-8');

console.log(`\n✅ Saved: ${outPath}`);
console.log(`   pillars: ${sajuResult.pillars.length}, daewoon: ${sajuResult.daewoon.length}`);
console.log(`   ziwei palaces: ${Object.keys(ziweiChart.palaces).length}, daxian: ${ziweiDaxianList.length}`);
console.log(`   natal planets: ${natalChart.planets.length}, houses: ${natalChart.houses.length}, aspects: ${natalChart.aspects.length}`);
