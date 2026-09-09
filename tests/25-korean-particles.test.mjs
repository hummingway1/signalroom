// tests/25-korean-particles.test.mjs
//
// packages/shared/korean-particles.mjs 회귀 테스트. compatibility-explanation.mjs/
// child-growth-analysis.mjs 리팩터링(공유 유틸 추출) 과정에서 요구된 케이스 전부 검증.
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { coreTextForParticle, hasFinalConsonant, eunNeun, iGa, eulReul, gwaWa } from '../packages/shared/korean-particles.mjs';

test('coreTextForParticle: 괄호가 있으면 괄호 앞부분만 추출한다', () => {
  assert.equal(coreTextForParticle('목(木)'), '목');
  assert.equal(coreTextForParticle('수(水)'), '수');
  assert.equal(coreTextForParticle('당신'), '당신'); // 괄호 없으면 그대로
});

test('목(木)은 / 목(木)을 — 받침 있는 오행 용어', () => {
  assert.equal(eunNeun('목(木)'), '은');
  assert.equal(eulReul('목(木)'), '을');
});

test('수(水)는 / 수(水)를 / 수(水)와 — 받침 없는 오행 용어', () => {
  assert.equal(eunNeun('수(水)'), '는');
  assert.equal(eulReul('수(水)'), '를');
  assert.equal(gwaWa('수(水)'), '와');
});

test('당신은 / 당신을 — 받침 있는 일반 한글 단어(괄호 없음)', () => {
  assert.equal(eunNeun('당신'), '은');
  assert.equal(eulReul('당신'), '을');
});

test('실제 발견됐던 버그 재현 방지: 괄호 안 한자가 조사 판단에 영향을 주지 않는다', () => {
  // "목(木)"의 실제 마지막 문자는 ")"지만, 조사는 괄호 앞부분("목", 받침 있음) 기준으로 판단해야 함.
  // 예전엔 괄호 전체를 보고 항상 "받침 없음"으로 오판정했던 버그가 있었음(이번에 유틸로 고정).
  assert.equal(eunNeun('목(木)'), '은', '"목(木)"은 받침이 있어 "은"이어야 하는데, 괄호 때문에 "는"으로 오판정되면 안 됨');
  assert.equal(iGa('목(木)'), '이');
});

test('한글 완성형 범위 밖(영문/숫자)은 받침 없음으로 처리한다(정책상 한글 닉네임만 허용, 별도 발음 규칙 미지원)', () => {
  assert.equal(hasFinalConsonant('P4'), false);
  assert.equal(eunNeun('P4'), '는');
});

test('빈 문자열/공백만 있는 입력에도 에러 없이 동작한다', () => {
  assert.equal(hasFinalConsonant(''), false);
  assert.doesNotThrow(() => eunNeun('   '));
});
