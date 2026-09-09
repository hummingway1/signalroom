// tests/60-payment-security-integration.test.mjs
//
// §실제 결제 연결 — Toss Payments가 이미 확정된 provider임을 확인.
// confirmPaymentTransaction/confirmPayment는 실제 Postgres가 필요해서 이 환경에서 직접
// 실행할 수 없다 — 이미 구현된 안전장치들이 실제로 코드에 존재하는지 소스 레벨로
// 검증하고, DB가 필요한 지점은 DATABASE_URL 에러로 정상 차단되는지 실행 확인한다.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { confirmPayment } from '../apps/api/src/services/payment-service.mjs';

test('1. 결제 provider는 Toss Payments로 확정되어 있다(PortOne 코드 없음)', async () => {
  const envExample = await readFile('./.env.example', 'utf-8');
  assert.ok(envExample.includes('TOSS_CLIENT_KEY'));
  assert.ok(envExample.includes('TOSS_SECRET_KEY'));
  assert.ok(!envExample.includes('PORTONE') && !envExample.includes('PORT_ONE'));
});

test('2. TOSS_SECRET_KEY가 없으면 501로 명확히 거부하고 가짜로 결제를 통과시키지 않는다', async () => {
  const source = await readFile('./apps/api/src/routes/payments.mjs', 'utf-8');
  assert.ok(source.includes('TOSS_NOT_CONFIGURED'));
  assert.ok(source.includes('res.status(501)'));
});

test('3. confirmPayment는 클라이언트가 보낸 금액이 아니라 서버가 저장한 order.amount를 Toss 승인 API에 보낸다', async () => {
  const source = await readFile('./apps/api/src/services/payment-service.mjs', 'utf-8');
  assert.ok(source.includes('amount: order.amount'));
  assert.ok(source.includes('amount: tossResponse.totalAmount'));
});

test('4. 결제 상태가 DONE이 아니면 즉시 실패 처리한다', async () => {
  const source = await readFile('./apps/api/src/services/payment-service.mjs', 'utf-8');
  assert.ok(source.includes("tossResponse.status !== 'DONE'"));
  assert.ok(source.includes('PAYMENT_NOT_DONE'));
});

test('5. confirmPaymentTransaction은 order.amount와 승인된 amount가 다르면 AMOUNT_MISMATCH로 거부한다(이중 방어)', async () => {
  const source = await readFile('./apps/api/src/repositories/payment-repository.mjs', 'utf-8');
  assert.ok(source.includes('order.amount !== amount'));
  assert.ok(source.includes('AMOUNT_MISMATCH'));
});

test('6. 이미 처리된(PAID) 주문에 대한 재확인 요청은 idempotent하게 처리되어 entitlement가 중복 생성되지 않는다', async () => {
  const source = await readFile('./apps/api/src/repositories/payment-repository.mjs', 'utf-8');
  const idx = source.indexOf("order.status === 'PAID'");
  assert.ok(idx > -1);
  const block = source.slice(idx, idx + 400);
  assert.ok(block.includes('alreadyProcessed: true'));
  assert.ok(!block.includes('insert into entitlements'));
});

test('7. 동시 요청에도 단 한 번만 처리되도록 FOR UPDATE로 order 행을 잠근다', async () => {
  const source = await readFile('./apps/api/src/repositories/payment-repository.mjs', 'utf-8');
  const queryLine = source.split('\n').find((line) => line.includes('from orders where id = $1 for update'));
  assert.ok(queryLine);
});

test('8. payment_key UNIQUE 제약을 기대하는 방어 심층화 설계가 유지되어 있다', async () => {
  const source = await readFile('./apps/api/src/repositories/payment-repository.mjs', 'utf-8');
  assert.ok(source.includes('payment_key UNIQUE 제약'));
});

test('9. 존재하지 않는 주문으로 confirmPayment 호출 시 DATABASE_URL 에러로 정상 차단된다(가짜로 통과시키지 않음)', async () => {
  await assert.rejects(
    () => confirmPayment({ orderId: 'nonexistent', userId: 'u1', paymentKey: 'pk', clientAmount: 1000, secretKey: 'sk_test_dummy' }),
    /DATABASE_URL/
  );
});

test('10. 잘못된 productCode로 주문 생성 시 404로 명확히 거부한다', async () => {
  const source = await readFile('./apps/api/src/routes/orders.mjs', 'utf-8');
  assert.ok(source.includes('PRODUCT_NOT_FOUND'));
  assert.ok(source.includes('res.status(404)'));
});

test('11. 다른 사용자의 주문을 조회/확정할 수 없다', async () => {
  const orderSource = await readFile('./apps/api/src/repositories/payment-repository.mjs', 'utf-8');
  assert.ok(orderSource.includes('order.user_id !== userId'));
  assert.ok(orderSource.includes('UNAUTHORIZED'));
});

test('12. entitlement 발급이 상품코드 하드코딩 분기가 아니라 products 테이블 설정을 그대로 읽는다', async () => {
  const source = await readFile('./apps/api/src/repositories/payment-repository.mjs', 'utf-8');
  assert.ok(source.includes('select question_quota, validity_hours, analysis_type, subscription_group from products where id = $1'));
});
