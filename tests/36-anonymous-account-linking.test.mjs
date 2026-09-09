// tests/36-anonymous-account-linking.test.mjs
//
// 익명 사용자 → 회원 계정 데이터 승계 정책(사용자 결정사항) 회귀 테스트.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { rm } from 'node:fs/promises';

import { linkAnonymousData } from '../apps/api/src/services/auth-service.mjs';
import { createChildProfile, listChildProfilesForUser } from '../apps/api/src/repositories/child-profile-repository.mjs';
import { hasUsedFreeChildAnalysis, listPurchasedAnalysesForUser } from '../apps/api/src/repositories/purchased-analysis-repository.mjs';
import { generateChildGrowthAnalysis } from '../apps/api/src/services/child-profile-service.mjs';
import { createChartRecord } from '../apps/api/src/repositories/chart-repository.mjs';
import { computeChart } from '../packages/chart-engine/compute.mjs';
import { buildCanonicalChart } from '../packages/canonical/transform.mjs';

test.before(async () => {
  await rm('./data/db', { recursive: true, force: true });
});

async function makeChart() {
  const raw = computeChart({ birthDate: '1985-02-14', birthTime: '06:10', gender: 'female', city: 'Seoul' });
  return createChartRecord({ canonical: buildCanonicalChart(raw, { engineVersion: 'test' }) });
}

test('§1/§2: 익명 사용자가 무료 분석을 쓴 뒤 실제 계정에 연결하면 프로필과 무료 이력이 전부 새 계정으로 넘어간다', async () => {
  const anonId = `anon-${crypto.randomUUID()}`;
  const realUserId = crypto.randomUUID();

  const chart = await makeChart();
  const profile = await createChildProfile({ userId: anonId, chartId: chart.id });
  await generateChildGrowthAnalysis({ childProfileId: profile.id, userId: anonId, tier: 'basic' });

  // 링크 전: 익명ID는 무료를 이미 썼고, 실제 계정은 아직 안 씀
  assert.equal(await hasUsedFreeChildAnalysis(anonId), true);
  assert.equal(await hasUsedFreeChildAnalysis(realUserId), false);

  const result = await linkAnonymousData(anonId, realUserId);
  assert.equal(result.linked, true);
  assert.equal(result.linkedProfileCount, 1);
  assert.equal(result.linkedAnalysisCount, 1);

  // §3: 실제 계정이 이제 무료를 "이미 쓴 것"으로 판정되어야 한다(다시 못 받음)
  assert.equal(await hasUsedFreeChildAnalysis(realUserId), true);
  // 익명ID 쪽은 더 이상 데이터가 없어야 한다(재사용 방지의 기반)
  assert.equal(await hasUsedFreeChildAnalysis(anonId), false);

  const profiles = await listChildProfilesForUser(realUserId);
  assert.equal(profiles.length, 1);
  assert.equal(profiles[0].id, profile.id);
});

test('§5: anon- 접두사가 없는 값은 절대 연결하지 않는다(다른 사용자 데이터 탈취 방지)', async () => {
  const someOtherRealUserId = crypto.randomUUID(); // 실제 사용자 UUID인 척 위장
  const targetUserId = crypto.randomUUID();

  const result = await linkAnonymousData(someOtherRealUserId, targetUserId);
  assert.equal(result.linked, false);
  assert.equal(result.reason, 'NOT_ANONYMOUS_ID');
});

test('§5: 자기 자신에게 연결 시도는 거부된다', async () => {
  const id = crypto.randomUUID();
  const result = await linkAnonymousData(`anon-${id}`, `anon-${id}`);
  assert.equal(result.linked, false);
  assert.equal(result.reason, 'SAME_USER');
});

test('§4: 같은 승계를 두 번 호출해도 결과가 달라지지 않는다(멱등성 — 중복 생성 없음)', async () => {
  const anonId = `anon-${crypto.randomUUID()}`;
  const realUserId = crypto.randomUUID();

  const chart = await makeChart();
  const profile = await createChildProfile({ userId: anonId, chartId: chart.id });
  await generateChildGrowthAnalysis({ childProfileId: profile.id, userId: anonId, tier: 'basic' });

  const first = await linkAnonymousData(anonId, realUserId);
  assert.equal(first.linked, true);
  assert.equal(first.linkedProfileCount, 1);

  // 두 번째 호출 시점엔 이미 anonId 아래 데이터가 없으므로 0건이 나와야 정상(레코드가 늘지 않음)
  const second = await linkAnonymousData(anonId, realUserId);
  assert.equal(second.linked, true);
  assert.equal(second.linkedProfileCount, 0);
  assert.equal(second.linkedAnalysisCount, 0);

  const profiles = await listChildProfilesForUser(realUserId);
  assert.equal(profiles.length, 1, '중복 생성되면 안 됨 — 여전히 1개여야 함');

  const analyses = await listPurchasedAnalysesForUser(realUserId);
  assert.equal(analyses.length, 1, '중복 생성되면 안 됨 — 여전히 1개여야 함');
});

test('§7/§8: 승계 도중 실패하면 이미 적용된 변경을 되돌린다(보정 롤백)', async () => {
  const anonId = `anon-${crypto.randomUUID()}`;
  const realUserId = crypto.randomUUID();

  const chart = await makeChart();
  const profile1 = await createChildProfile({ userId: anonId, chartId: chart.id });
  const profile2 = await createChildProfile({ userId: anonId, chartId: chart.id });

  // 실제 동시성 실패(다른 프로세스가 승계 도중 레코드를 지우는 등)는 단일 스레드 동기 테스트
  // 코드로는 재현할 수 없어서, auth-service.mjs가 노출하는 테스트 전용 훅으로 "첫 번째
  // 프로필까지는 성공하고 그다음에 실패"하는 상황을 결정론적으로 만든다.
  await assert.rejects(
    () => linkAnonymousData(anonId, realUserId, { _simulateFailureAfterFirstProfile: true }),
    /시뮬레이션된 실패/
  );

  // 롤백 확인 — 두 profile 모두 다시 익명ID로 되돌아가 있어야 한다(실패 전 상태로 복구).
  const anonProfilesAfterRollback = await listChildProfilesForUser(anonId);
  assert.equal(anonProfilesAfterRollback.length, 2, '롤백 후 익명ID 쪽에 두 프로필 모두 다시 있어야 함');
  const anonIds = anonProfilesAfterRollback.map((p) => p.id).sort();
  assert.deepEqual(anonIds, [profile1.id, profile2.id].sort());

  const realProfilesAfterRollback = await listChildProfilesForUser(realUserId);
  assert.equal(realProfilesAfterRollback.length, 0, '롤백 후 실제 계정 쪽엔 하나도 남아있으면 안 됨');
});
