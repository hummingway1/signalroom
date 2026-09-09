// tests/54-child-age-band-content-policy.test.mjs
//
// 자녀 신년운세 연령대별 콘텐츠 정책(Phase11 사후 설계 확정분). §확정 정책: fortune_year 1월 1일
// 기준 만 나이로 밴드를 고정, preschool/child/teen/adult 4단계, 19세 이상은 자녀용 특별 지시
// 미적용(성인과 동일 취급이 아니라 "분기 없음"으로 명시).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { calculateAgeBand, AGE_BANDS } from '../packages/shared/age-band.mjs';
import { buildYearlyFortuneBasicPrompt, buildYearlyFortuneChatPrompt } from '../packages/character/yearly-fortune-prompt.mjs';
import { readFile } from 'node:fs/promises';

// ============================================================
// A. calculateAgeBand — 경계값 정밀 검증
// ============================================================

test('A1: 6세는 preschool, 7세는 child (0~6 / 7~12 경계)', () => {
  assert.equal(calculateAgeBand('2020-01-01', 2026), AGE_BANDS.PRESCHOOL);
  assert.equal(calculateAgeBand('2019-01-01', 2026), AGE_BANDS.CHILD);
});

test('A2: 12세는 child, 13세는 teen (7~12 / 13~18 경계)', () => {
  assert.equal(calculateAgeBand('2014-01-01', 2026), AGE_BANDS.CHILD);
  assert.equal(calculateAgeBand('2013-01-01', 2026), AGE_BANDS.TEEN);
});

test('A3: 18세는 teen, 19세는 adult (13~18 / 19+ 경계)', () => {
  assert.equal(calculateAgeBand('2008-01-01', 2026), AGE_BANDS.TEEN);
  assert.equal(calculateAgeBand('2007-01-01', 2026), AGE_BANDS.ADULT);
});

test('A4: 나이 계산은 fortune_year 1월 1일 기준이다(연중 생일과 무관하게 한 해 동안 밴드 고정)', () => {
  assert.equal(calculateAgeBand('2020-08-06', 2027), AGE_BANDS.PRESCHOOL);
});

test('A5: 실제 문제가 됐던 영유아 fixture(2026-08-06생)의 2027년 밴드는 preschool이다', () => {
  assert.equal(calculateAgeBand('2026-08-06', 2027), AGE_BANDS.PRESCHOOL);
});

// ============================================================
// B. 프롬프트 — 연령대별 금지어/지시 포함 확인
// ============================================================

test('B1: ageBand=preschool 프롬프트는 "연애"/"부부"/"결혼" 단어를 절대 쓰지 말라는 지시를 포함한다', () => {
  const prompt = buildYearlyFortuneBasicPrompt('preschool');
  assert.ok(prompt.includes('"연애", "부부", "이성", "결혼"'));
  assert.ok(prompt.includes('부모·가족과의 애착 관계'));
});

test('B2: ageBand=preschool은 finance에 "성인이 되었을 때" 재물 성향을 덧붙이라는 지시를 포함한다(사용자 추가 요구사항)', () => {
  const prompt = buildYearlyFortuneBasicPrompt('preschool');
  assert.ok(prompt.includes('성인이 되었을 때 돈을 다루는 방식이나 재물에 대한 타고난 성향'));
});

test('B3: ageBand=child/teen도 각각 재성 구조 기반 "성인이 되었을 때의 재물 성향" 지시를 포함한다', () => {
  const childPrompt = buildYearlyFortuneChatPrompt('child');
  const teenPrompt = buildYearlyFortuneChatPrompt('teen');
  assert.ok(childPrompt.includes('성인이 되었을 때의 재물 성향'));
  assert.ok(teenPrompt.includes('성인이 되었을 때의 재물 성향'));
});

test('B4: ageBand=null(본인/성인)은 자녀용 지시가 전혀 추가되지 않는다(기존 프롬프트 완전 동일)', () => {
  const withNull = buildYearlyFortuneBasicPrompt(null);
  const withDefault = buildYearlyFortuneBasicPrompt();
  assert.equal(withNull, withDefault);
  assert.ok(!withNull.includes('미취학'));
  assert.ok(!withNull.includes('초등학생'));
});

test('B5: 19세 이상(adult) 자녀는 자녀용 콘텐츠 지시가 적용되지 않는다(서비스 레벨에서 ageBand를 null로 정규화)', async () => {
  const source = await readFile('./apps/api/src/services/yearly-fortune-service.mjs', 'utf-8');
  assert.ok(source.includes('computed === AGE_BANDS.ADULT ? null : computed'));
});

// ============================================================
// C. 서비스 레벨 — 본인 신년운세는 완전 무영향
// ============================================================

test('C1: scope.chart_id(본인) 경로에서는 ageBand 계산 자체를 시도하지 않는다(child_profile_id가 있을 때만 계산)', async () => {
  const source = await readFile('./apps/api/src/services/yearly-fortune-service.mjs', 'utf-8');
  assert.ok(source.includes('if (scope.child_profile_id) {'));
});

test('C2: result_data에 age_band가 함께 저장되어 투명성을 확보한다', async () => {
  const source = await readFile('./apps/api/src/services/yearly-fortune-service.mjs', 'utf-8');
  assert.ok(source.includes('age_band: ageBand'));
});
