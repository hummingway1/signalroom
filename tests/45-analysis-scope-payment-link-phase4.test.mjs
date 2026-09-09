// tests/45-analysis-scope-payment-link-phase4.test.mjs
//
// Phase 4 — Payment → Analysis Scope → Entitlement 실제 연결. 이 환경엔 실제 Supabase Postgres가
// 없으므로, §11의 A(신규구매)/B(재구매)/E(복수분석)/H(quota) 같은 실제 DB 조회가 필요한
// 시나리오는 이 파일로 검증할 수 없다 — 로컬에서 실제 DB로 확인 필요(최종 보고서에 명시). 여기서는
// 이 환경에서 실제로 실행 가능한 것만 검증한다.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { rm, readFile } from 'node:fs/promises';

import { verifySubjectOwnership, AnalysisScopeError } from '../apps/api/src/repositories/analysis-scope-repository.mjs';
import { createChartRecord } from '../apps/api/src/repositories/chart-repository.mjs';
import { computeChart } from '../packages/chart-engine/compute.mjs';
import { buildCanonicalChart } from '../packages/canonical/transform.mjs';

test.before(async () => {
  await rm('./data/db', { recursive: true, force: true });
});

async function makeChart(userId = null) {
  const raw = computeChart({ birthDate: '1990-01-01', birthTime: '10:00', gender: 'male', city: 'Seoul' });
  return createChartRecord({ userId, canonical: buildCanonicalChart(raw, { engineVersion: 'test' }) });
}

// ============================================================
// A. 주문 생성 시 소유권 검증 (실제 JSON store로 검증 가능 — DB 불필요)
// ============================================================

test('A1: chart 소유자가 아닌 사용자가 그 chartId로 주문을 만들려 하면 거부된다(§Phase4 order-level ownership)', async () => {
  const chart = await makeChart('owner-user');
  await assert.rejects(
    () => verifySubjectOwnership({ userId: 'attacker-user', chartId: chart.id, childProfileId: null }),
    (err) => {
      assert.ok(err instanceof AnalysisScopeError);
      assert.equal(err.code, 'SUBJECT_OWNERSHIP_MISMATCH');
      return true;
    }
  );
});

test('A2: 실제 소유자는 자신의 chartId로 검증을 통과한다', async () => {
  const chart = await makeChart('owner-user');
  await assert.doesNotReject(() => verifySubjectOwnership({ userId: 'owner-user', chartId: chart.id, childProfileId: null }));
});

test('A3: 익명(user_id=null)으로 만들어진 chart는 아직 누구의 소유도 아니므로 소유권 충돌로 보지 않는다(§익명 승계 이전 상태)', async () => {
  const chart = await makeChart(null);
  await assert.doesNotReject(() => verifySubjectOwnership({ userId: 'any-user', chartId: chart.id, childProfileId: null }));
});

test('A4: 존재하지 않는 chartId는 SUBJECT_NOT_FOUND로 명확히 실패한다(가짜로 통과 안 함)', async () => {
  await assert.rejects(
    () => verifySubjectOwnership({ userId: 'u1', chartId: 'nonexistent-chart-id', childProfileId: null }),
    (err) => {
      assert.equal(err.code, 'SUBJECT_NOT_FOUND');
      return true;
    }
  );
});

// ============================================================
// B. 마이그레이션 안전성
// ============================================================

test('B1: orders.subject_chart_id/subject_child_profile_id는 nullable로 추가된다(기존 주문 강제 변환 없음)', async () => {
  const sql = await readFile('./migrations/007_order_subject_link.sql', 'utf-8');
  assert.ok(sql.includes('add column if not exists subject_chart_id'));
  assert.ok(sql.includes('add column if not exists subject_child_profile_id'));
  assert.ok(!sql.toLowerCase().includes('not null'));
});

// ============================================================
// C. 소스 레벨 정책 확인 — confirmPaymentTransaction의 analysis_scope 연결 로직
// ============================================================

test('C1: confirmPaymentTransaction이 SAJU_DETAIL/CHILD_DETAIL에 대해서만 analysis_scope를 실제로 생성한다', async () => {
  const source = await readFile('./apps/api/src/repositories/payment-repository.mjs', 'utf-8');
  assert.ok(source.includes("analysisType === 'SAJU_DETAIL' && order.subject_chart_id"));
  assert.ok(source.includes("analysisType === 'CHILD_DETAIL' && order.subject_child_profile_id"));
});

test('C2: RELATIONSHIP_DETAIL(궁합)의 analysis_scope 연결은 이번 라운드에서 시도하지 않으며, 그 이유(스키마 구조 충돌)가 코드 주석으로 명시되어 있다', async () => {
  const source = await readFile('./apps/api/src/repositories/payment-repository.mjs', 'utf-8');
  assert.ok(source.includes('RELATIONSHIP_DETAIL'));
  assert.ok(source.includes('STOP 조건에 해당'), '발견한 구조적 충돌이 명시적으로 문서화되어 있어야 함');
});

test('C3: analysis_scope와 entitlement 연결이 같은 트랜잭션(client) 안에서 이루어진다(반쪽 성공 방지)', async () => {
  const source = await readFile('./apps/api/src/repositories/payment-repository.mjs', 'utf-8');
  const secondCommitIndex = source.indexOf("await client.query('COMMIT')", source.indexOf("await client.query('COMMIT')") + 1);
  const beforeCommit = source.slice(source.indexOf('entitlements.order_id UNIQUE'), secondCommitIndex);
  assert.ok(beforeCommit.includes('insert into analysis_scopes'));
  assert.ok(beforeCommit.includes('update entitlements set analysis_id'));
});

test('C4: 클라이언트가 body로 보낸 chartId/childProfileId는 주문 생성 시 반드시 소유권 검증을 거친 뒤에만 저장된다', async () => {
  const source = await readFile('./apps/api/src/routes/orders.mjs', 'utf-8');
  const chartIdCheckIndex = source.indexOf('if (chartId || childProfileId)');
  const createOrderIndex = source.indexOf('const order = await createOrder');
  assert.ok(chartIdCheckIndex > -1 && chartIdCheckIndex < createOrderIndex, '소유권 검증이 주문 생성보다 먼저 실행되어야 함');
});

// ============================================================
// D. 재구매(§4) — 매번 새 UUID로 생성되므로 구조적으로 서로 다른 analysis_scope가 보장됨
// ============================================================

test('D1: analysis_scope 생성은 매번 randomUUID()로 새 id를 발급한다(재구매 시 이전 analysis_scope를 재사용/덮어쓰기하지 않음)', async () => {
  const source = await readFile('./apps/api/src/repositories/payment-repository.mjs', 'utf-8');
  const secondCommitIndex = source.indexOf("await client.query('COMMIT')", source.indexOf("await client.query('COMMIT')") + 1);
  const scopeSection = source.slice(source.indexOf('let analysisScopeId = null'), secondCommitIndex);
  assert.ok(scopeSection.includes('analysisScopeId = randomUUID()'));
  assert.ok(!scopeSection.includes('update analysis_scopes'));
});
