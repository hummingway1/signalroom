// tests/targeted-quality/expected-values.mjs
//
// 절대 임의로 데이터를 만들지 않는다 — 전부 실제 fixture(data/fixtures/adult-main-quality-chart.json,
// 실제 계산 엔진으로 생성됨)를 읽어서 도출한다. 여기 있는 어떤 값도 손으로 입력한 것이 아니라,
// canonical JSON을 실행 시점에 파싱해서 뽑아낸 것이다 — fixture가 바뀌면 이 값들도 자동으로 바뀐다.

import { computeCurrentAge } from '../../packages/shared/date-utils.mjs';

const POSITION_LABEL_KO = { year: '년', month: '월', day: '일', hour: '시' };

/**
 * @param {object} canonical - 전체 Canonical Chart JSON (fixture 그대로)
 * @param {object} [opts]
 * @param {number} [opts.targetYear] - 세운 관련 테스트가 검사할 연도 (기본 2027)
 * @returns {object} 5개 targeted-quality 테스트가 공통으로 참조하는 ground truth
 */
export function deriveExpectedValues(canonical, { targetYear = 2027 } = {}) {
  const saju = canonical.saju;

  const annualPeriods = saju.annual_periods;
  if (!Array.isArray(annualPeriods) || annualPeriods.length === 0) {
    throw new Error('fixture에 annual_periods가 없습니다 — 세운 통합이 먼저 완료되어 있어야 합니다.');
  }
  const targetAnnual = annualPeriods.find((p) => p.year === targetYear);
  if (!targetAnnual) {
    throw new Error(`fixture의 annual_periods 범위에 ${targetYear}년이 없습니다 (범위: ${annualPeriods[0].year}~${annualPeriods.at(-1).year}).`);
  }

  const gwimun = saju.special_stars?.gwimun ?? [];

  const currentAge = computeCurrentAge(canonical.subject.birth_date);
  const sortedMajor = [...saju.major_periods].sort((a, b) => a.start_age - b.start_age);
  const currentMajorPeriod = [...sortedMajor].reverse().find((p) => currentAge >= p.start_age) ?? null;
  if (!currentMajorPeriod) {
    throw new Error('이 fixture는 현재 나이가 어떤 대운 구간에도 속하지 않습니다 — targeted-quality 테스트는 유효한 현재 대운이 있는 명반(main_quality)을 전제로 설계되었습니다. edge_case로는 실행하지 마세요.');
  }

  // 대상 연도 세운이 실제로 걸쳐 있는 대운과 "현재" 대운이 다를 수 있음 — TEST3는 이 둘이 실제로
  // 같은지(=현재 대운 구간 안에 2027년이 들어오는지) 그 자체도 확인 대상.
  const targetYearMajorPeriod = targetAnnual.related_major_period
    ? sortedMajor.find((p) => p.ganzi === targetAnnual.related_major_period.ganzi)
    : null;

  return {
    targetYear,
    dayMaster: saju.day_master,
    pillars: saju.pillars, // [{position, ganzi, heavenly_stem, earthly_branch, ...}]
    targetAnnual, // 2027년 annual_periods 원본 항목 그대로
    gwimun, // [{positions:[pos,pos], detail}]
    calculationProvenance: saju.calculation_provenance,
    currentAge,
    currentMajorPeriod, // 현재(37세) 대운
    targetYearMajorPeriod, // 2027년이 속하는 대운 (currentMajorPeriod와 같아야 정상)
    positionLabelKo: POSITION_LABEL_KO,
  };
}
