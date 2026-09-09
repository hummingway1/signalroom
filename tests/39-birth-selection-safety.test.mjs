// tests/39-birth-selection-safety.test.mjs
//
// §18 항목 7(의료적 단정 validator)/8(명리학적 절대 단정 validator). 지시서 §17의 실제 BAD 예시
// 문장을 그대로 검증에 사용한다.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { checkNoAbsoluteCertainty, checkNoMedicalOverreach } from './birth-selection-safety-validators.mjs';

test('7-1. "이 날짜가 의학적으로 안전합니다" — 의료 판단 우선시 FAIL', () => {
  const result = checkNoMedicalOverreach('이 날짜가 의학적으로 안전합니다.');
  assert.equal(result.pass, false);
});

test('7-2. "의사가 뭐라고 해도 이 날짜를 선택하세요" — FAIL', () => {
  const result = checkNoMedicalOverreach('의사가 뭐라고 해도 이 날짜를 선택하세요.');
  assert.equal(result.pass, false);
});

test('7-3. 정상적인 의료 안내 문구는 PASS(§1 필수 고지 문구 자체는 위반이 아님)', () => {
  const result = checkNoMedicalOverreach('출산일시는 반드시 산모와 태아의 건강 및 담당 의료진의 의학적 판단을 최우선으로 결정해야 합니다.');
  assert.equal(result.pass, true);
});

test('8-1. "이 날짜에 태어나면 반드시 성공합니다" — FAIL', () => {
  const result = checkNoAbsoluteCertainty('이 날짜에 태어나면 반드시 성공합니다.');
  assert.equal(result.pass, false);
});

test('8-2. "이 날짜가 무조건 최고의 날입니다" — FAIL', () => {
  const result = checkNoAbsoluteCertainty('이 날짜가 무조건 최고의 날입니다.');
  assert.equal(result.pass, false);
});

test('8-3. "이 아이는 반드시 돈을 많이 법니다" — FAIL', () => {
  const result = checkNoAbsoluteCertainty('이 아이는 반드시 돈을 많이 법니다.');
  assert.equal(result.pass, false);
});

test('8-4. 헤지된 표현("무조건 좋다고 단정할 수는 없다")은 PASS — 오탐 방지', () => {
  const result = checkNoAbsoluteCertainty('이 후보가 무조건 좋다고 단정할 수는 없습니다.');
  assert.equal(result.pass, true);
});

test('8-5. "최고의 날"이라는 표현 자체가 없으면 당연히 PASS', () => {
  const result = checkNoAbsoluteCertainty('입력하신 범위 안에서 상대적으로 우선 검토할 만한 후보입니다.');
  assert.equal(result.pass, true);
});

test('8-6. 인용문 안에서 언급된 절대 표현(반박 대상)은 PASS — 인용 오탐 방지', () => {
  const result = checkNoAbsoluteCertainty('"이 날짜가 무조건 최고"라는 식의 단정은 하지 않습니다.');
  assert.equal(result.pass, true);
});
