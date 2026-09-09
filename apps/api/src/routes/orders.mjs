// apps/api/src/routes/orders.mjs
import { Router } from 'express';
import { requireAuth } from '../middleware/session.mjs';
import { getProductByCode } from '../repositories/product-repository.mjs';
import { createOrder, getOrderById, listOrdersForUser } from '../repositories/order-repository.mjs';
import { verifySubjectOwnership, AnalysisScopeError } from '../repositories/analysis-scope-repository.mjs';

export function ordersRouter() {
  const router = Router();

  // POST /api/orders — 로그인 필수. userId는 세션에서만 가져온다(body로 온 값은 무시).
  // §Phase4 — chartId/childProfileId(선택)는 "이 상세분석 구매가 어떤 내 chart/child_profile에
  // 대한 것인지"를 알려주는 것뿐이다(권한 주장이 아니다). 서버가 실제 소유자인지 즉시 검증하고,
  // 결제 완료 시(confirmPaymentTransaction) 이 정보로 analysis_scope를 만들어 entitlement에
  // 연결한다.
  router.post('/', requireAuth, async (req, res) => {
    const { productCode, chartId, childProfileId, fortuneYear, dateSelectionParams } = req.body ?? {};
    if (typeof productCode !== 'string') {
      return res.status(400).json({ error: { code: 'INVALID_INPUT', message: 'productCode(string)는 필수입니다.' } });
    }
    if (fortuneYear !== undefined && fortuneYear !== null) {
      if (!Number.isInteger(fortuneYear) || fortuneYear < 2020 || fortuneYear > 2100) {
        return res.status(400).json({ error: { code: 'INVALID_INPUT', message: 'fortuneYear는 2020~2100 사이의 정수여야 합니다.' } });
      }
    }
    if (productCode === 'DATE_SELECTION') {
      // §출생일 택일 — 최소한의 존재/타입 검증만 여기서 한다(실제 날짜범위 유효성은
      // generateCandidateDateTimes가 결과 생성 시점에 검증 — 이번 범위 밖).
      const p = dateSelectionParams;
      const required = ['dateRangeStart', 'dateRangeEnd', 'timeRangeStart', 'timeRangeEnd', 'gender', 'city'];
      const missing = !p || required.some((k) => typeof p[k] !== 'string');
      if (missing) {
        return res.status(400).json({ error: { code: 'INVALID_INPUT', message: `dateSelectionParams에 ${required.join(', ')}가 모두 문자열로 필요합니다.` } });
      }
    }
    const product = await getProductByCode(productCode);
    if (!product || !product.active) {
      return res.status(404).json({ error: { code: 'PRODUCT_NOT_FOUND', message: '판매 중인 상품을 찾을 수 없습니다.' } });
    }
    if (chartId || childProfileId) {
      try {
        await verifySubjectOwnership({ userId: req.user.id, chartId: chartId ?? null, childProfileId: childProfileId ?? null });
      } catch (err) {
        if (err instanceof AnalysisScopeError) {
          const status = err.code === 'SUBJECT_NOT_FOUND' ? 404 : 403;
          return res.status(status).json({ error: { code: err.code, message: err.message } });
        }
        throw err;
      }
    }
    // §설계 — 생성 시점의 product.name/price를 스냅샷으로 저장한다(나중에 가격이 바뀌어도 이
    // 주문의 금액은 불변).
    const order = await createOrder({
      userId: req.user.id,
      productId: product.id,
      orderName: product.name,
      amount: product.price,
      subjectChartId: chartId ?? null,
      subjectChildProfileId: childProfileId ?? null,
      subjectFortuneYear: fortuneYear ?? null,
      subjectDateSelectionParams: productCode === 'DATE_SELECTION' ? dateSelectionParams : null,
    });
    return res.status(201).json({ order });
  });

  router.get('/:id', requireAuth, async (req, res) => {
    const order = await getOrderById(req.params.id);
    if (!order) return res.status(404).json({ error: { code: 'ORDER_NOT_FOUND', message: '주문을 찾을 수 없습니다.' } });
    if (order.user_id !== req.user.id) return res.status(403).json({ error: { code: 'FORBIDDEN', message: '본인의 주문만 조회할 수 있습니다.' } });
    return res.json({ order });
  });

  router.get('/', requireAuth, async (req, res) => {
    const orders = await listOrdersForUser(req.user.id);
    return res.json({ orders });
  });

  return router;
}
