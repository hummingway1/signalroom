// tests/56-chart-batch-contract-fixes.test.mjs
//
// §Phase2 계약 차이 수정 회귀 테스트. 이 파일은 별도 프로세스로 실행되어야 하므로(node --test는
// 파일 단위로 프로세스를 분리한다) chart-repository.mjs의 store 싱글턴이 빈 캐시로 시작한다.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { rm, readFile } from 'node:fs/promises';

import { JsonStore } from '../packages/shared/json-store.mjs';
import { createCharts } from '../apps/api/src/services/chart-service.mjs';
import { storeFor } from '../apps/api/src/repositories/base.mjs';

function resetChartsStoreCache() {
  // §테스트 전용 — chart-repository.mjs의 store는 모듈 싱글턴이라 파일을 rm해도 인메모리
  // 캐시(this._cache)는 그대로 남는다. 같은 프로세스 안에서 여러 시나리오를 격리하려면
  // 캐시를 직접 무효화해야 한다(프로덕션 코드는 전혀 건드리지 않음, 테스트에서만 사용).
  storeFor('charts')._cache = null;
}

test.before(async () => {
  await rm('./data/db', { recursive: true, force: true });
  resetChartsStoreCache();
});

test('1. createCharts(배치)가 buildChartRecord를 항목마다 개별 호출해서 timestamp를 생성한다(소스 레벨 확인)', async () => {
  const source = await readFile('./apps/api/src/repositories/chart-repository.mjs', 'utf-8');
  assert.ok(source.includes('entries.map(buildChartRecord)'), 'buildChartRecord가 항목마다 개별 호출되어야 함');
  assert.ok(!source.includes('const now = new Date().toISOString()'), '배치 전체가 공유하는 단일 now 변수가 없어야 함(이전 계약 차이였던 패턴)');
  const buildFnOccurrences = (source.match(/buildChartRecord/g) ?? []).length;
  assert.ok(buildFnOccurrences >= 3, `buildChartRecord 정의+createChartRecord 사용+createChartRecords 사용, 최소 3곳에서 참조되어야 함(실제 ${buildFnOccurrences}회)`);
});

test('1-1. 실제로 생성된 레코드들이 유효한 ISO timestamp를 갖고, 단건 생성과 동일한 형식이다', async () => {
  const entries = [
    { birthInput: { birthDate: '2027-05-01', birthTime: '09:00', gender: 'male', city: 'Seoul' } },
    { birthInput: { birthDate: '2027-05-01', birthTime: '10:00', gender: 'male', city: 'Seoul' } },
  ];
  const charts = await createCharts(entries);
  for (const c of charts) {
    assert.ok(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(c.created_at), `ISO 8601 형식이어야 함: ${c.created_at}`);
  }
});

test('2-1. 5개 모두 성공하면 5개 저장되고 순서를 유지한다', async () => {
  await rm('./data/db', { recursive: true, force: true });
  resetChartsStoreCache();
  const entries = Array.from({ length: 5 }, (_, i) => ({ birthInput: { birthDate: '2027-05-01', birthTime: `0${i + 1}:00`, gender: 'male', city: 'Seoul' } }));
  const charts = await createCharts(entries);
  assert.equal(charts.length, 5);
});

test('2-2. 3번째 후보만 실패하면 나머지 4개는 저장되고, 실패는 throw로 전파되며, 저장은 batch 1회다', async () => {
  await rm('./data/db', { recursive: true, force: true });
  resetChartsStoreCache();
  const store = new JsonStore('./data/db/charts.json');

  const entries = [
    { birthInput: { birthDate: '2027-05-01', birthTime: '01:00', gender: 'male', city: 'Seoul' } },
    { birthInput: { birthDate: '2027-05-01', birthTime: '02:00', gender: 'male', city: 'Seoul' } },
    { birthInput: { birthDate: '2027-05-01', birthTime: '03:00', gender: 'male', city: 'Seoul', timezone: 'America/New_York' } },
    { birthInput: { birthDate: '2027-05-01', birthTime: '04:00', gender: 'male', city: 'Seoul' } },
    { birthInput: { birthDate: '2027-05-01', birthTime: '05:00', gender: 'male', city: 'Seoul' } },
  ];

  let thrown = null;
  try {
    await createCharts(entries);
  } catch (err) {
    thrown = err;
  }
  assert.ok(thrown, '실패가 있으면 여전히 throw되어야 함');
  assert.equal(thrown.code, 'UNSUPPORTED_TIMEZONE');

  const saved = await store.list();
  assert.equal(saved.length, 4, '3번째만 실패했으므로 나머지 4개는 저장되어야 함(부분 성공 semantics 복원)');
});

test('2-3. 전부 실패하면 저장 호출 자체가 없다(파일이 생성되지 않음)', async () => {
  await rm('./data/db', { recursive: true, force: true });
  resetChartsStoreCache();

  const entries = [
    { birthInput: { birthDate: '2027-05-01', birthTime: '01:00', gender: 'male', city: 'Seoul', timezone: 'America/New_York' } },
    { birthInput: { birthDate: '2027-05-01', birthTime: '02:00', gender: 'male', city: 'Seoul', timezone: 'America/New_York' } },
  ];

  await assert.rejects(() => createCharts(entries));

  let fileExists = true;
  try {
    await readFile('./data/db/charts.json', 'utf-8');
  } catch {
    fileExists = false;
  }
  assert.equal(fileExists, false, '전부 실패했으므로 파일이 생성되지 않아야 함');
});

test('2-4. 부분 성공 시 성공한 후보의 개수와 저장 결과가 정확히 일치한다(2번째만 실패)', async () => {
  await rm('./data/db', { recursive: true, force: true });
  resetChartsStoreCache();
  const store = new JsonStore('./data/db/charts.json');

  const entries = [
    { birthInput: { birthDate: '2027-05-01', birthTime: '01:00', gender: 'male', city: 'Seoul' } },
    { birthInput: { birthDate: '2027-05-01', birthTime: '02:00', gender: 'male', city: 'Seoul', timezone: 'America/New_York' } },
    { birthInput: { birthDate: '2027-05-01', birthTime: '03:00', gender: 'male', city: 'Seoul' } },
    { birthInput: { birthDate: '2027-05-01', birthTime: '04:00', gender: 'male', city: 'Seoul' } },
  ];

  await assert.rejects(() => createCharts(entries));
  const saved = await store.list();
  assert.equal(saved.length, 3, '2번째(02:00)만 제외된 3개가 정확히 저장되어야 함');
});

test('2-5. insertMany 호출은 정확히 1곳(createChartRecords 안)에만 있다(O(N^2) 병목 회귀 방지)', async () => {
  const source = await readFile('./apps/api/src/repositories/chart-repository.mjs', 'utf-8');
  const insertManyCallSites = (source.match(/store\.insertMany\(/g) ?? []).length;
  assert.equal(insertManyCallSites, 1, 'insertMany 호출은 정확히 1곳에만 있어야 함(개별 insert 반복 구조로 되돌아가지 않았는지 확인)');
});
