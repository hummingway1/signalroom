// tests/41-pricing-policy.test.mjs
//
// §최종 상품 정책 확정 반영 검증. 실제 Postgres 트랜잭션(FOR UPDATE, 동시성)은 이 환경에서
// 접근 불가 — 사용자가 로컬 실제 DB로 검증해야 한다(보고서에 명시). 여기서는 코드 레벨로 검증
// 가능한 것만 다룬다: 소스 로직 확인, 순수 함수, 에러 클래스 동작.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

test('A1: 시드 SQL이 사주/자녀/궁합 각각 기본+상세 쌍(990/4900)을 정의한다', async () => {
  const sql = await readFile('./migrations/005_seed_products_final_policy.sql', 'utf-8');
  assert.ok(sql.includes('SAJU_DETAIL') && sql.includes(', 4900,'));
  assert.ok(sql.includes('CHILD_DETAIL'));
  assert.ok(sql.includes('RELATIONSHIP_DETAIL'));
  assert.ok(sql.includes('question_quota, validity_hours) values'));
});

test('A2: 상세 상품 시드가 정확히 질문 10회/24시간으로 설정되어 있다', async () => {
  const sql = await readFile('./migrations/005_seed_products_final_policy.sql', 'utf-8');
  assert.ok(sql.includes("'detail', 10, 24"), '상세 상품은 quota=10, validity=24시간이어야 함');
});

test('A3: 100회/8900원 구독 상품이 시드에 전혀 없다(§11 금지사항 확인)', async () => {
  const sql = await readFile('./migrations/005_seed_products_final_policy.sql', 'utf-8');
  assert.ok(!sql.includes('8900'), '8900원 상품이 존재하면 안 됨');
  assert.ok(!/,\s*100\s*,/.test(sql), '100회 quota 상품이 존재하면 안 됨');
});

test('B1: confirmPaymentTransaction이 product별 question_quota/validity_hours/analysis_type을 조회해서 사용한다(하드코딩 아님)', async () => {
  const source = await readFile('./apps/api/src/repositories/payment-repository.mjs', 'utf-8');
  assert.ok(source.includes('select question_quota, validity_hours, analysis_type, subscription_group from products'));
  assert.ok(!source.includes("quantity, remaining_quantity) values ($1, $2, $3, $4, $5, $6)\n      [entitlementId, userId, order.product_id, orderId, 1, 1]"), '더 이상 quantity=1을 하드코딩하면 안 됨');
});

test('B2: EntitlementError가 code 속성을 갖고, 각 상태(만료/소진/미발견/권한없음)를 구분한다', async () => {
  const { EntitlementError } = await import('../apps/api/src/repositories/payment-repository.mjs');
  const err = new EntitlementError('ENTITLEMENT_EXPIRED', '만료');
  assert.equal(err.code, 'ENTITLEMENT_EXPIRED');
  assert.ok(err instanceof Error);
});

test('C1: /api/conversations/:id/messages 라우트는 client entitlementId를 더 이상 다루지 않는다(§Phase10 — req.body에서 destructuring/변수 추출을 안 함, 설명 주석 제외)', async () => {
  const source = await readFile('./apps/api/src/routes/conversations.mjs', 'utf-8');
  assert.ok(!source.includes('const { question, entitlementId }'), 'entitlementId를 body에서 추출하는 코드가 없어야 함');
  assert.ok(!source.includes('consumeQuestionEntitlement(entitlementId'), 'entitlementId 변수를 직접 소비에 쓰는 코드가 없어야 함');
});

test('C2: consumeQuestionEntitlement는 이 라우트 파일 안에서 직접 호출되지 않는다(§Phase10 — 소비는 conversation-service.mjs의 authorization 흐름에서만 일어남)', async () => {
  const source = await readFile('./apps/api/src/routes/conversations.mjs', 'utf-8');
  const occurrences = (source.match(/consumeQuestionEntitlement\(/g) ?? []).length;
  assert.equal(occurrences, 0, '라우트 레벨에서 직접 차감하는 경로가 없어야 함 — 서버측 authorization을 우회할 방법 자체가 없어야 함');
});

test('C3: 프론트 버블 분리(splitIntoBubbles)는 백엔드 응답을 받은 이후 클라이언트에서만 일어난다(백엔드가 버블 개념 자체를 모른다는 아키텍처 확인)', async () => {
  const backendFiles = ['./apps/api/src/routes/conversations.mjs', './apps/api/src/services/conversation-service.mjs'];
  for (const f of backendFiles) {
    const source = await readFile(f, 'utf-8');
    assert.ok(!source.includes('splitIntoBubbles'), `백엔드(${f})는 버블 분리 로직을 알면 안 됨 — 프론트 전용 관심사`);
  }
});

test('D1: /api/conversations/:id/messages 가 50자 초과 질문을 400으로 거부한다(소스 확인)', async () => {
  const source = await readFile('./apps/api/src/routes/conversations.mjs', 'utf-8');
  assert.ok(source.includes('question.length > 50'));
  assert.ok(source.includes('QUESTION_TOO_LONG'));
});

test('D2: /api/charts/:id/questions 도 동일하게 50자 제한이 있다(첫 질문 포함, 일관성)', async () => {
  const source = await readFile('./apps/api/src/routes/charts.mjs', 'utf-8');
  assert.ok(source.includes('question.length > 50'));
});

test('E1: charts.mjs가 tier=basic일 때 basicAiProviderFactory(Luna)로 분기한다(소스 확인)', async () => {
  const source = await readFile('./apps/api/src/routes/charts.mjs', 'utf-8');
  assert.ok(source.includes("tier === 'basic'"));
  assert.ok(source.includes('basicAiProviderFactory'));
});

test('E2: server.mjs가 charts 라우터에 실제 childCoachAiProviderFactory(기존 Luna factory)를 재사용해서 넘긴다(새 모델 안 만듦)', async () => {
  const source = await readFile('./apps/api/src/server.mjs', 'utf-8');
  assert.ok(source.includes('basicAiProviderFactory: childCoachAiProviderFactory'), '기존 Luna factory를 그대로 재사용해야 함(중복 구현 금지)');
});
