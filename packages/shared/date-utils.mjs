// packages/shared/date-utils.mjs
//
// Pure calendar arithmetic only. This is categorically different from
// astrological/명리 calculation (사주팔자, 대운, 명반 등) — it's just
// "how many years since this date", the same math a birthday app would do.
// Both original prompts require "현재 나이" as an input the AI is NOT
// supposed to guess (saju-original.md §4, ziwei-original.md §입력 양식/
// §입력 검증 규칙: "현재 나이가 없으면 현재 대운을 특정하지 않는다").
// Since this app knows subject.birth_date already, it computes this
// deterministically server-side instead of asking the user to type it in.

/**
 * 만 나이 (Korean international age convention).
 * @param {string} birthDateStr - "YYYY-MM-DD"
 * @param {Date} [asOf] - defaults to now
 * @returns {number}
 */
export function computeCurrentAge(birthDateStr, asOf = new Date()) {
  const [by, bm, bd] = birthDateStr.split('-').map(Number);
  let age = asOf.getFullYear() - by;
  const hasHadBirthdayThisYear = asOf.getMonth() + 1 > bm || (asOf.getMonth() + 1 === bm && asOf.getDate() >= bd);
  if (!hasHadBirthdayThisYear) age -= 1;
  return age;
}
