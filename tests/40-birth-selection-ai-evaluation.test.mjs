// tests/40-birth-selection-ai-evaluation.test.mjs
//
// §Phase1(출생일 택일 AI 평가 엔진) — rankCandidatesMock을 대체한 실제 2단계 AI 평가
// (evaluateCandidates)의 end-to-end 검증. MockAIProvider를 사용해 실제 네트워크 호출 없이
// 파이프라인 배선/무결성 검증/배치 처리/안전장치 확장을 확인한다.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { rm } from 'node:fs/promises';

import {
  computeCandidateCharts, evaluateCandidates, makeCandidateId,
  validateNoFabricatedCandidates, BirthSelectionError,
} from '../apps/api/src/services/birth-selection-service.mjs';
import { MockAIProvider } from '../packages/ai/providers/mock-provider.mjs';
import { checkNoAbsoluteCertainty, checkNoMedicalOverreach, checkNoFabricatedCandidate } from './birth-selection-safety-validators.mjs';

test.before(async () => {
  await rm('./data/db', { recursive: true, force: true });
});

test('1. 20개 이하 후보 -> evaluateCandidates가 최종 결과 schema를 전부 채운다', async () => {
  const results = await computeCandidateCharts({
    dateRangeStart: '2027-05-01', dateRangeEnd: '2027-05-01',
    timeRangeStart: '09:00', timeRangeEnd: '13:00', intervalMinutes: 60,
    gender: 'female', city: 'Seoul',
  });
  const result = await evaluateCandidates({ candidatesWithFields: results, aiProvider: new MockAIProvider() });

  assert.ok(result.top1);
  assert.ok(Array.isArray(result.top2to5));
  assert.equal(typeof result.total_candidates_considered, 'number');
  assert.ok(result.safety_disclosure.length > 0);
  assert.ok(result.chat_context.top1);
  assert.ok(result.chat_context.top2to5);
  assert.ok(result.chat_context.candidate_comparison);
});

test('2. AI가 존재하지 않는 candidate_id를 반환하면 validateNoFabricatedCandidates가 예외를 던진다', () => {
  const validIds = ['2027-05-01T09:00', '2027-05-01T10:00'];
  assert.throws(
    () => validateNoFabricatedCandidates(['2027-05-01T09:00', '2099-01-01T00:00'], validIds),
    (err) => err instanceof BirthSelectionError && err.code === 'FABRICATED_CANDIDATE'
  );
});

test('2-1. 전부 유효한 candidate_id면 통과한다', () => {
  const validIds = ['2027-05-01T09:00', '2027-05-01T10:00'];
  assert.doesNotThrow(() => validateNoFabricatedCandidates(['2027-05-01T09:00'], validIds));
});

test('2-2. checkNoFabricatedCandidate(테스트 검증기)도 동일 원칙으로 동작한다', () => {
  const validIds = ['2027-05-01T09:00', '2027-05-01T10:00'];
  assert.equal(checkNoFabricatedCandidate(['2027-05-01T09:00'], validIds).pass, true);
  const failResult = checkNoFabricatedCandidate(['2099-12-31T23:00'], validIds);
  assert.equal(failResult.pass, false);
  assert.equal(failResult.flagged[0], '2099-12-31T23:00');
});

test('3. candidate_id는 date+time으로부터 결정론적으로 생성되므로, AI가 시간을 바꾸면 존재하지 않는 id가 되어 거부된다', () => {
  const original = makeCandidateId('2027-05-01', '09:00');
  const tampered = makeCandidateId('2027-05-01', '09:30');
  assert.notEqual(original, tampered);
  assert.throws(() => validateNoFabricatedCandidates([tampered], [original]));
});

test('4-1. "완벽한 날" - 신규 확장 표현 FAIL', () => {
  assert.equal(checkNoAbsoluteCertainty('이 날짜가 완벽한 날입니다.').pass, false);
});

test('4-2. "이 시간에 태어나야 한다" - 신규 확장 표현 FAIL', () => {
  assert.equal(checkNoAbsoluteCertainty('아이는 반드시 이 시간에 태어나야 한다.').pass, false);
});

test('4-3. "이날 태어나면 성공한다" - 신규 확장 표현 FAIL', () => {
  assert.equal(checkNoAbsoluteCertainty('이날 태어나면 성공한다는 이야기가 있습니다.').pass, false);
});

test('4-4. 헤지된 표현은 여전히 PASS(오탐 방지 유지 확인)', () => {
  assert.equal(checkNoAbsoluteCertainty('완벽한 날이라고 단정할 수는 없습니다.').pass, true);
});

test('5-1. "건강에 좋다" - 신규 확장 표현 FAIL', () => {
  assert.equal(checkNoMedicalOverreach('이 시간에 태어나면 건강에 좋다고 볼 수 있습니다.').pass, false);
});

test('5-2. "질병 위험이 낮다" - 신규 확장 표현 FAIL', () => {
  assert.equal(checkNoMedicalOverreach('질병 위험이 낮다는 결과가 나왔습니다.').pass, false);
});

test('5-3. "자연분만을 추천합니다" - 권유 동사 근접 시 FAIL', () => {
  assert.equal(checkNoMedicalOverreach('이 시기에는 자연분만을 추천합니다.').pass, false);
});

test('5-4. "제왕절개가 더 나을 것 같습니다" - 권유 동사 근접 시 FAIL', () => {
  assert.equal(checkNoMedicalOverreach('제왕절개가 더 나을 것 같습니다.').pass, false);
});

test('5-5. "자연분만이든 제왕절개든 담당 의료진과 상의하세요" - 권유 없이 단어만 언급되면 PASS(오탐 방지)', () => {
  const result = checkNoMedicalOverreach('자연분만이든 제왕절개든 이 분석과 무관하게 담당 의료진과 상의하세요.');
  assert.equal(result.pass, true);
});

test('6. evaluateCandidates 결과에 안전 고지 문구가 반드시 포함된다', async () => {
  const results = await computeCandidateCharts({
    dateRangeStart: '2027-05-01', dateRangeEnd: '2027-05-01',
    timeRangeStart: '09:00', timeRangeEnd: '10:00', intervalMinutes: 60,
    gender: 'male', city: 'Seoul',
  });
  const result = await evaluateCandidates({ candidatesWithFields: results, aiProvider: new MockAIProvider() });
  assert.ok(result.safety_disclosure.includes('의료진'));
  assert.ok(result.safety_disclosure.includes('산모'));
});

test('7. 후보 20개 - 1차 생략, 2차 1회만 호출', async () => {
  const results = await computeCandidateCharts({
    dateRangeStart: '2027-05-01', dateRangeEnd: '2027-05-04',
    timeRangeStart: '09:00', timeRangeEnd: '13:00', intervalMinutes: 60,
    gender: 'female', city: 'Seoul',
  });
  assert.equal(results.length, 20);
  const provider = new MockAIProvider();
  await evaluateCandidates({ candidatesWithFields: results, aiProvider: provider });
  const schemaNames = provider.callLog.map((c) => c.schemaName);
  assert.equal(schemaNames.filter((s) => s === 'birth_selection_first_pass').length, 0);
  assert.equal(schemaNames.filter((s) => s === 'birth_selection_second_pass').length, 1);
});

test('8. 후보 100개 초과 - 1차 배치 호출 후 2차 1회(조기 탈락 없이 A tier 전체가 2차로 전달됨)', async () => {
  const results = await computeCandidateCharts({
    dateRangeStart: '2027-05-01', dateRangeEnd: '2027-05-05',
    timeRangeStart: '00:00', timeRangeEnd: '23:00', intervalMinutes: 60,
    gender: 'male', city: 'Seoul',
  });
  assert.ok(results.length > 100, `테스트 전제 확인: 후보수=${results.length}`);
  const provider = new MockAIProvider();
  const result = await evaluateCandidates({ candidatesWithFields: results, aiProvider: provider });
  const schemaNames = provider.callLog.map((c) => c.schemaName);
  assert.ok(schemaNames.filter((s) => s === 'birth_selection_first_pass').length >= 2, '100개 초과라 1차가 100개 단위로 여러 번 호출되어야 함');
  assert.equal(schemaNames.filter((s) => s === 'birth_selection_second_pass').length, 1, '2차는 항상 1회');
  assert.equal(result.total_candidates_considered, results.length);
});

test('9. 300개 근접 - batch 여러 번 + 2차 1회', async () => {
  const results = await computeCandidateCharts({
    dateRangeStart: '2027-05-01', dateRangeEnd: '2027-05-13',
    timeRangeStart: '00:00', timeRangeEnd: '23:00', intervalMinutes: 60,
    gender: 'female', city: 'Seoul',
  });
  assert.ok(results.length >= 250, `테스트 전제 확인: 후보수=${results.length}`);
  const provider = new MockAIProvider();
  const result = await evaluateCandidates({ candidatesWithFields: results, aiProvider: provider });
  const schemaNames = provider.callLog.map((c) => c.schemaName);
  const firstPassCalls = schemaNames.filter((s) => s === 'birth_selection_first_pass').length;
  assert.ok(firstPassCalls >= 3, `300개 근접이면 1차가 최소 3번 이상 호출되어야 함(실제 ${firstPassCalls}회)`);
  assert.equal(schemaNames.filter((s) => s === 'birth_selection_second_pass').length, 1);
  assert.equal(result.total_candidates_considered, results.length);
});

test('10. 동일한 날짜/시간 범위 입력은 항상 같은 순서의 candidate_id 목록을 만든다(재현성)', async () => {
  const params = { dateRangeStart: '2027-05-01', dateRangeEnd: '2027-05-02', timeRangeStart: '09:00', timeRangeEnd: '11:00', intervalMinutes: 60, gender: 'male', city: 'Seoul' };
  const run1 = await computeCandidateCharts(params);
  const run2 = await computeCandidateCharts(params);
  assert.deepEqual(run1.map((c) => c.candidateId), run2.map((c) => c.candidateId));
});

test('10-1. candidate_id는 순수하게 date+time으로부터만 결정되고 다른 값에 의존하지 않는다', () => {
  assert.equal(makeCandidateId('2027-05-01', '09:00'), makeCandidateId('2027-05-01', '09:00'));
  assert.notEqual(makeCandidateId('2027-05-01', '09:00'), makeCandidateId('2027-05-01', '09:30'));
});
