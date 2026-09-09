// apps/api/src/routes/payments.mjs
import { Router } from 'express';
import { requireAuth } from '../middleware/session.mjs';
import { confirmPayment } from '../services/payment-service.mjs';
import { listEntitlementsForUser } from '../repositories/payment-repository.mjs';

export function paymentsRouter() {
  const router = Router();

  // POST /api/payments/confirm — 프론트가 Toss 결제창에서 받은 paymentKey/orderId/amount를
  // 그대로 넘기지만, 최종 판단은 서버가 Toss 승인 API를 직접 호출해서 받은 응답 기준으로 한다
  // (§결제 보안 핵심 — 프론트 값은 참고용, 신뢰하지 않음).
  router.post('/confirm', requireAuth, async (req, res) => {
    const { orderId, paymentKey, amount } = req.body ?? {};
    if (!orderId || !paymentKey || typeof amount !== 'number') {
      return res.status(400).json({ error: { code: 'INVALID_INPUT', message: 'orderId, paymentKey, amount(number)는 필수입니다.' } });
    }
    const secretKey = process.env.TOSS_SECRET_KEY;
    if (!secretKey) {
      return res.status(501).json({ error: { code: 'TOSS_NOT_CONFIGURED', message: 'TOSS_SECRET_KEY가 설정되지 않았습니다.' } });
    }
    try {
      const result = await confirmPayment({ orderId, userId: req.user.id, paymentKey, clientAmount: amount, secretKey });
      return res.json({ success: true, ...result });
    } catch (err) {
      const status = { ORDER_NOT_FOUND: 404, UNAUTHORIZED: 403, AMOUNT_MISMATCH: 400, PAYMENT_NOT_DONE: 400 }[err.code] ?? 500;
      return res.status(status).json({ error: { code: err.code ?? 'INTERNAL_ERROR', message: err.message } });
    }
  });

  router.get('/entitlements', requireAuth, async (req, res) => {
    const entitlements = await listEntitlementsForUser(req.user.id);
    return res.json({ entitlements });
  });

  return router;
}
