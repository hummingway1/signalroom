// apps/api/src/services/payment-service.mjs
//
// §결제 보안 핵심(STEP4 설계 그대로) — 프론트 결제 결과만 믿고 지급하지 않는다. 서버가 Toss
// 승인 API를 직접 호출해서, Toss가 실제로 응답한 금액/상태만을 기준으로 트랜잭션을 진행한다.
import { getOrderById } from '../repositories/order-repository.mjs';
import { confirmPaymentTransaction, PaymentConfirmationError } from '../repositories/payment-repository.mjs';

const TOSS_CONFIRM_URL = 'https://api.tosspayments.com/v1/payments/confirm';

async function callTossConfirmApi({ secretKey, paymentKey, orderId, amount }) {
  const auth = Buffer.from(`${secretKey}:`).toString('base64');
  const res = await fetch(TOSS_CONFIRM_URL, {
    method: 'POST',
    headers: { Authorization: `Basic ${auth}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ paymentKey, orderId, amount }),
  });
  const body = await res.json();
  if (!res.ok) {
    throw new PaymentConfirmationError('REFUND_PROVIDER_ERROR', `Toss 승인 실패: ${body.message ?? res.status}`);
  }
  return body; // { status: 'DONE', method, totalAmount, ... } — Toss 실제 응답
}

/**
 * 결제 승인 전체 흐름: Toss 승인 API 호출(클라이언트가 보낸 amount는 여기서 안 씀, Toss URL에는
 * "우리가 만든 order의 원래 금액"을 보내서 Toss 쪽에서도 대조하게 한다) → Toss가 실제로 확인해준
 * 금액/상태를 기준으로 DB 트랜잭션 진행.
 */
export async function confirmPayment({ orderId, userId, paymentKey, clientAmount, secretKey }) {
  const order = await getOrderById(orderId);
  if (!order) throw new PaymentConfirmationError('ORDER_NOT_FOUND', '주문을 찾을 수 없습니다.');
  if (order.user_id !== userId) throw new PaymentConfirmationError('UNAUTHORIZED', '본인의 주문이 아닙니다.');

  // Toss 승인 API 자체에 우리가 저장해둔 order.amount(클라이언트가 아니라 서버 값)를 보낸다 —
  // Toss도 자기 쪽 금액과 이 값을 대조해서 다르면 자체적으로 실패시킨다(이중 방어).
  const tossResponse = await callTossConfirmApi({ secretKey, paymentKey, orderId, amount: order.amount });

  if (tossResponse.status !== 'DONE') {
    throw new PaymentConfirmationError('PAYMENT_NOT_DONE', `결제 상태가 완료(DONE)가 아닙니다: ${tossResponse.status}`);
  }

  return confirmPaymentTransaction({
    orderId,
    userId,
    paymentKey,
    method: tossResponse.method ?? null,
    amount: tossResponse.totalAmount, // Toss가 실제로 확인해준 금액만 사용 — clientAmount는 참고만, 신뢰 안 함
    rawResponse: tossResponse,
  });
}
