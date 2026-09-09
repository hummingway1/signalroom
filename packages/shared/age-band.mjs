// packages/shared/age-band.mjs
//
// §자녀 신년운세 연령대 정책(확정) — fortune_year의 1월 1일 기준 만 나이로 밴드를 고정한다
// (연중 나이 변화로 밴드가 흔들리는 걸 방지). 학년 정보는 쓰지 않는다(복잡도 증가 대비 이득 적음
// — 확정 판단).
export const AGE_BANDS = Object.freeze({
  PRESCHOOL: 'preschool', // 0~6세
  CHILD: 'child', // 7~12세
  TEEN: 'teen', // 13~18세
  ADULT: 'adult', // 19세 이상 — "성인용과 동일 취급"이 아니라 별도 명시(§확정 정책)
});

/**
 * @param {string} birthDateIso - 'YYYY-MM-DD'
 * @param {number} fortuneYear
 * @returns {string} AGE_BANDS 중 하나
 */
export function calculateAgeBand(birthDateIso, fortuneYear) {
  const [birthYear, birthMonth, birthDay] = birthDateIso.slice(0, 10).split('-').map(Number);
  // fortune_year의 1월 1일 시점 만 나이 — 생일이 1월 1일 그 자체가 아닌 이상, 그 해 1월 1일에는
  // 아직 생일이 지나지 않았으므로 연도차에서 1을 빼야 한다.
  const hasBirthdayPassedByJan1 = birthMonth === 1 && birthDay === 1;
  const age = fortuneYear - birthYear - (hasBirthdayPassedByJan1 ? 0 : 1);
  if (age <= 6) return AGE_BANDS.PRESCHOOL;
  if (age <= 12) return AGE_BANDS.CHILD;
  if (age <= 18) return AGE_BANDS.TEEN;
  return AGE_BANDS.ADULT;
}
