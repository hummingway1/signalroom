// tests/38-birth-selection-pipeline.test.mjs
//
// 출산일시 택일 STEP D/E — Mock 기반 파이프라인 검증(§18의 1~6번). 결제 연동(7~12번)은
// Order/Payment/Entitlement가 아직 없어서 이번 범위에서 제외한다(STEP F 선행 필요, 별도 보고됨).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { rm } from 'node:fs/promises';

import { generateCandidateDateTimes } from '../packages/chart-engine/birth-selection-candidates.mjs';
import { computeCandidateCharts, extractBirthSelectionFields, evaluateCandidates, makeCandidateId, validateNoFabricatedCandidates, BirthSelectionError } from '../apps/api/src/services/birth-selection-service.mjs';
import { MockAIProvider } from '../packages/ai/providers/mock-provider.mjs';

test.before(async () => {
  await rm('./data/db', { recursive: true, force: true });
});

// ============================================================
// 1. 후보 날짜 생성 테스트
// ============================================================

test('1. 날짜/시간 범위를 주면 결정론적으로 후보 목록을 생성한다', () => {
  const candidates = generateCandidateDateTimes({ dateRangeStart: '2027-05-01', dateRangeEnd: '2027-05-02', timeRangeStart: '09:00', timeRangeEnd: '11:00', intervalMinutes: 60 });
  assert.deepEqual(candidates, [
    { birthDate: '2027-05-01', birthTime: '09:00' },
    { birthDate: '2027-05-01', birthTime: '10:00' },
    { birthDate: '2027-05-01', birthTime: '11:00' },
    { birthDate: '2027-05-02', birthTime: '09:00' },
    { birthDate: '2027-05-02', birthTime: '10:00' },
    { birthDate: '2027-05-02', birthTime: '11:00' },
  ]);
});

test('1-1. 시작 날짜가 종료 날짜보다 늦으면 에러를 던진다', () => {
  assert.throws(() => generateCandidateDateTimes({ dateRangeStart: '2027-05-10', dateRangeEnd: '2027-05-01', timeRangeStart: '09:00', timeRangeEnd: '11:00' }));
});

test('1-2. 시작 시간이 종료 시간보다 늦으면 에러를 던진다(같으면 단일 시각으로 허용)', () => {
  assert.throws(() => generateCandidateDateTimes({ dateRangeStart: '2027-05-01', dateRangeEnd: '2027-05-01', timeRangeStart: '11:00', timeRangeEnd: '09:00' }));
  assert.doesNotThrow(() => generateCandidateDateTimes({ dateRangeStart: '2027-05-01', dateRangeEnd: '2027-05-01', timeRangeStart: '09:00', timeRangeEnd: '09:00' }));
});

// ============================================================
// 2/3. 각 후보의 사주/자미두수 계산 연결 테스트 (기존 createChart 재사용 확인)
// ============================================================

test('2/3. 각 후보마다 실제 계산 엔진(createChart)이 호출되어 사주+자미두수가 함께 나온다', async () => {
  const results = await computeCandidateCharts({
    dateRangeStart: '2027-05-01', dateRangeEnd: '2027-05-01',
    timeRangeStart: '09:00', timeRangeEnd: '10:00', intervalMinutes: 60,
    gender: 'female', city: 'Seoul',
  });
  assert.equal(results.length, 2); // 09:00, 10:00
  for (const r of results) {
    assert.ok(r.chartId);
    assert.ok(r.canonical.saju, '사주 데이터가 있어야 함');
    assert.ok(r.canonical.ziwei, '자미두수 데이터가 있어야 함(AI가 아니라 계산 엔진 산출)');
    assert.ok(r.canonical.saju.day_master, '일간이 실제로 계산되어 있어야 함');
  }
  // 서로 다른 시각이므로 최소 일부 필드는 달라야 한다(같은 데이터를 복사만 한 게 아님을 확인).
  assert.notDeepEqual(results[0].canonical.saju.pillars, results[1].canonical.saju.pillars);
});

// ============================================================
// 4. 사주+자미두수 데이터가 AI adapter에 전달될 형태로 정확히 추출되는지
// ============================================================

test('4. extractBirthSelectionFields가 depth별로 필요한 필드만 추출하고 원본을 변경하지 않는다', async () => {
  const results = await computeCandidateCharts({
    dateRangeStart: '2027-05-01', dateRangeEnd: '2027-05-01',
    timeRangeStart: '09:00', timeRangeEnd: '09:00', intervalMinutes: 60,
    gender: 'male', city: 'Seoul',
  });
  const shallow = extractBirthSelectionFields(results[0].canonical, 'shallow');
  assert.ok(shallow.saju.day_master);
  assert.ok(shallow.saju.pillars);
  assert.ok(shallow.saju.relations);
  assert.equal(shallow.ziwei, undefined, 'shallow(1차)는 ziwei를 포함하지 않는다(§6 — 1차는 최소한의 saju 구조만)');
  assert.ok(!('hidden_stems' in (shallow.saju.pillars[0] ?? {})), 'shallow pillars에는 hidden_stems가 없어야 한다(2차 전용)');

  const deep = extractBirthSelectionFields(results[0].canonical, 'deep');
  assert.ok(deep.saju.day_master);
  assert.ok(deep.saju.special_stars, '2차는 신살을 포함해야 함');
  assert.ok(deep.saju.void_branches, '§1 실측 확인 결과 빠져있던 공망을 2차에 보강함');
  assert.ok(deep.ziwei.life_palace);
  assert.ok(deep.ziwei.life_palace_stars, '명궁의 별 구성이 포함되어야 함(§5 — 택일 판단에 유의미한 자미두수 필드)');
  assert.equal(deep.ziwei.palaces, undefined, '12궁 전체는 과도한 정보라 제외되어야 함(§5)');

  // 원본 canonical은 변경되지 않아야 한다.
  assert.deepEqual(deep.saju.day_master, results[0].canonical.saju.day_master);
});

// ============================================================
// 5. 실제 AI 평가 파이프라인(MockAIProvider) — 소규모 후보(20개 이하, 1차 생략)
// ============================================================

test('5. 후보가 20개 이하면 1차를 생략하고 2차만 호출해서 top1/top2to5를 만든다', async () => {
  const results = await computeCandidateCharts({
    dateRangeStart: '2027-05-01', dateRangeEnd: '2027-05-01',
    timeRangeStart: '09:00', timeRangeEnd: '13:00', intervalMinutes: 60,
    gender: 'female', city: 'Seoul',
  });
  assert.equal(results.length, 5);
  const provider = new MockAIProvider();
  const result = await evaluateCandidates({ candidatesWithFields: results, aiProvider: provider });

  assert.ok(result.top1.candidate_id);
  assert.ok(Array.isArray(result.top2to5));
  assert.equal(result.total_candidates_considered, 5);
  assert.ok(result.safety_disclosure.includes('의료진'));
  assert.ok(result.chat_context.top1);
  // 20개 이하이므로 1차(first_pass) 호출이 없어야 함 — 2차(second_pass) 호출만 1회.
  const schemaNames = provider.callLog.map((c) => c.schemaName);
  assert.ok(!schemaNames.includes('birth_selection_first_pass'), '20개 이하는 1차를 생략해야 함');
  assert.ok(schemaNames.includes('birth_selection_second_pass'));
});

// ============================================================
// 6. 존재하지 않는 날짜/시간이 결과에 포함되지 않는지
// ============================================================

test('6. 요청 범위를 벗어난 날짜/시간은 후보에 전혀 포함되지 않는다', () => {
  const candidates = generateCandidateDateTimes({ dateRangeStart: '2027-05-01', dateRangeEnd: '2027-05-01', timeRangeStart: '09:00', timeRangeEnd: '09:00', intervalMinutes: 60 });
  assert.equal(candidates.length, 1);
  assert.deepEqual(candidates[0], { birthDate: '2027-05-01', birthTime: '09:00' });
  // 범위 밖 날짜(예: 2027-05-02)나 시간(예: 08:00, 10:00)이 섞여 있으면 안 된다.
  assert.ok(!candidates.some((c) => c.birthDate === '2027-05-02'));
  assert.ok(!candidates.some((c) => c.birthTime === '08:00' || c.birthTime === '10:00'));
});
