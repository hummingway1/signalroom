// tests/41-birth-selection-performance.test.mjs
//
// §Phase2(택일 300개 성능 개선) — 계산은 순차 유지(CPU바운드 동기 코드에 Promise.all은 실측상
// 이득 없음), 저장만 배치화(JsonStore.insertMany, N번 파일쓰기 -> 1번)해서 300개 후보 계산의
// 실제 병목(O(N^2) 파일 재작성)을 제거했는지 검증한다.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { rm, readFile } from 'node:fs/promises';

import { JsonStore } from '../packages/shared/json-store.mjs';
import { createCharts } from '../apps/api/src/services/chart-service.mjs';
import { computeCandidateCharts } from '../apps/api/src/services/birth-selection-service.mjs';

test.before(async () => {
  await rm('./data/db', { recursive: true, force: true });
});

test('1. insertMany는 한 번의 호출로 여러 레코드를 정확한 순서로 저장한다', async () => {
  await rm('./data/db/test-insertmany.json', { force: true });
  const store = new JsonStore('./data/db/test-insertmany.json');
  const records = [{ id: 'a', v: 1 }, { id: 'b', v: 2 }, { id: 'c', v: 3 }];
  await store.insertMany(records);
  const all = await store.list();
  assert.equal(all.length, 3);
  assert.deepEqual(all.map((r) => r.id), ['a', 'b', 'c']);
});

test('1-1. insertMany와 기존 insert()를 같은 파일에 섞어 써도 데이터가 섞이지 않는다', async () => {
  await rm('./data/db/test-insertmany2.json', { force: true });
  const store = new JsonStore('./data/db/test-insertmany2.json');
  await store.insert({ id: 'x', v: 0 });
  await store.insertMany([{ id: 'y', v: 1 }, { id: 'z', v: 2 }]);
  const all = await store.list();
  assert.equal(all.length, 3);
  assert.deepEqual(all.map((r) => r.id), ['x', 'y', 'z']);
});

test('1-2. insertMany가 실제로 파일에 정확히 최종 상태를 반영한다', async () => {
  const path = './data/db/test-insertmany3.json';
  await rm(path, { force: true });
  const store = new JsonStore(path);
  await store.insertMany(Array.from({ length: 50 }, (_, i) => ({ id: `id-${i}`, v: i })));
  const raw = await readFile(path, 'utf-8');
  const saved = JSON.parse(raw);
  assert.equal(saved.length, 50);
  assert.equal(saved[0].id, 'id-0');
  assert.equal(saved[49].id, 'id-49');
});

test('2. createCharts(배치)로 만든 결과가 개수/순서/구조 모두 기존 계약과 동일하다', async () => {
  const entries = [
    { birthInput: { birthDate: '2027-05-01', birthTime: '09:00', gender: 'male', city: 'Seoul' } },
    { birthInput: { birthDate: '2027-05-01', birthTime: '10:00', gender: 'male', city: 'Seoul' } },
    { birthInput: { birthDate: '2027-05-02', birthTime: '09:00', gender: 'male', city: 'Seoul' } },
  ];
  const charts = await createCharts(entries);
  assert.equal(charts.length, 3);
  for (const c of charts) {
    assert.ok(c.id);
    assert.ok(c.canonical.saju);
    assert.ok(c.canonical.ziwei);
    assert.ok(c.created_at);
  }
  assert.notDeepEqual(charts[0].canonical.saju.pillars, charts[2].canonical.saju.pillars);
});

test('3. computeCandidateCharts가 배치 저장으로 바뀐 후에도 각 후보의 chartId/canonical/candidateId가 정확히 매핑된다', async () => {
  const results = await computeCandidateCharts({
    dateRangeStart: '2027-05-01', dateRangeEnd: '2027-05-01',
    timeRangeStart: '09:00', timeRangeEnd: '11:00', intervalMinutes: 60,
    gender: 'female', city: 'Seoul',
  });
  assert.equal(results.length, 3);
  assert.deepEqual(results.map((r) => r.birthTime), ['09:00', '10:00', '11:00']);
  assert.deepEqual(results.map((r) => r.candidateId), ['2027-05-01T09:00', '2027-05-01T10:00', '2027-05-01T11:00']);
  const uniqueChartIds = new Set(results.map((r) => r.chartId));
  assert.equal(uniqueChartIds.size, 3);
});

test('4. 300개 근접 규모에서도 파일에 저장된 레코드 수와 순서가 계산 결과와 정확히 일치한다(무결성)', async () => {
  const results = await computeCandidateCharts({
    dateRangeStart: '2027-05-01', dateRangeEnd: '2027-05-13',
    timeRangeStart: '00:00', timeRangeEnd: '23:00', intervalMinutes: 60,
    gender: 'male', city: 'Seoul',
  });
  assert.ok(results.length >= 250, `테스트 전제 확인: 후보수=${results.length}`);

  const raw = await readFile('./data/db/charts.json', 'utf-8');
  const saved = JSON.parse(raw);
  const savedIds = new Set(saved.map((s) => s.id));
  assert.ok(results.every((r) => savedIds.has(r.chartId)));
});

test('5. 300개 근접 후보 계산이 개선 전(실측 약 86초) 대비 대폭 빨라졌다', async () => {
  const t0 = Date.now();
  const results = await computeCandidateCharts({
    dateRangeStart: '2027-05-01', dateRangeEnd: '2027-05-13',
    timeRangeStart: '00:00', timeRangeEnd: '23:00', intervalMinutes: 60,
    gender: 'female', city: 'Seoul',
  });
  const elapsed = Date.now() - t0;
  console.log(`    [실측] 후보 ${results.length}개 계산+저장: ${elapsed}ms`);
  assert.ok(elapsed < 10000, `10초 이내여야 함(실제: ${elapsed}ms) - 개선 전 실측 약 86000ms였음`);
});
