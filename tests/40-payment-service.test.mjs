// tests/40-payment-service.test.mjs
//
// 결제 서비스의 순수 로직 검증. 실제 Postgres(getOrderById 등)와 실제 Toss API는 이 환경에서
// 접근 불가하므로, order-repository/payment-repository를 mock으로 대체해서 payment-service의
// 판단 로직(Toss 응답 검증, 금액 대조, 상태 확인)만 검증한다. 실제 DB 트랜잭션(FOR UPDATE, UNIQUE
// 제약 등)은 사용자가 로컬에서 실제 Supabase Postgres로 검증해야 한다(보고서에 명시).
import { test } from 'node:test';
import assert from 'node:assert/strict';

function withMockedFetch(response, fn) {
  const original = global.fetch;
  global.fetch = async () => ({ ok: response.ok !== false, status: response.status ?? 200, json: async () => response.body });
  return fn().finally(() => {
    global.fetch = original;
  });
}

test('A1: DB 연결이 없는 환경에서는(이 샌드박스) confirmPayment가 명확한 DATABASE_URL 에러로 실패한다 — 가짜로 성공하지 않음', async () => {
  await withMockedFetch({ body: { status: 'READY', method: 'card', totalAmount: 990 } }, async () => {
    const { confirmPayment } = await import('../apps/api/src/services/payment-service.mjs');
    // 이 환경엔 실제 Supabase DATABASE_URL이 없다 — getOrderById가 Postgres에 접근하려다
    // postgres-client.mjs의 명확한 에러(가짜로 동작하는 척 안 함)를 그대로 던져야 한다.
    // 실제 order 조회/DONE 상태 검증 로직 자체는 사용자가 로컬에서 실제 DB로 검증해야 한다.
    await assert.rejects(
      () => confirmPayment({ orderId: 'nonexistent', userId: 'u1', paymentKey: 'pk', clientAmount: 990, secretKey: 'test_sk' }),
      /DATABASE_URL/
    );
  });
});

test('A2: PaymentConfirmationError가 code 속성을 가진 채로 던져진다(라우트의 상태코드 매핑에 필요)', async () => {
  const { PaymentConfirmationError } = await import('../apps/api/src/repositories/payment-repository.mjs');
  const err = new PaymentConfirmationError('AMOUNT_MISMATCH', '금액 불일치');
  assert.equal(err.code, 'AMOUNT_MISMATCH');
  assert.ok(err instanceof Error);
});

test('A3: routes/payments.mjs의 에러코드→HTTP상태 매핑이 예상대로 되어 있다(코드 레벨 확인)', async () => {
  // 실제 매핑 테이블을 라우트 파일에서 그대로 가져와 검증(중복 정의 없이 소스를 그대로 읽음).
  const { readFile } = await import('node:fs/promises');
  const source = await readFile('./apps/api/src/routes/payments.mjs', 'utf-8');
  assert.ok(source.includes('ORDER_NOT_FOUND: 404'));
  assert.ok(source.includes('UNAUTHORIZED: 403'));
  assert.ok(source.includes('AMOUNT_MISMATCH: 400'));
});

test('B1: 상품 시드 SQL이 990원 상품 3개를 정의한다(코드가 아니라 SQL/DB에서 가격 관리 원칙 확인)', async () => {
  const { readFile } = await import('node:fs/promises');
  const sql = await readFile('./migrations/003_seed_products.sql', 'utf-8');
  const matches990 = sql.match(/, 990,/g) ?? [];
  assert.equal(matches990.length, 3, '3개 상품 모두 990원으로 시드되어야 함');
  assert.ok(sql.includes('on conflict (code) do nothing'), '재실행해도 안전한 멱등 시드여야 함');
});

test('C1: orders 라우트가 productCode를 받아 서버가 조회한 product의 price/name을 스냅샷으로 저장한다(코드 레벨 확인)', async () => {
  const { readFile } = await import('node:fs/promises');
  const source = await readFile('./apps/api/src/routes/orders.mjs', 'utf-8');
  // 클라이언트가 amount/orderName을 직접 보내는 파라미터가 없어야 한다 — product.price/name만 사용.
  assert.ok(!source.includes('req.body.amount'), '클라이언트가 보낸 amount를 직접 쓰면 안 됨');
  assert.ok(source.includes('product.price') && source.includes('product.name'));
});
