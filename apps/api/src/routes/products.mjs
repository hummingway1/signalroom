// apps/api/src/routes/products.mjs
import { Router } from 'express';
import { listActiveProducts } from '../repositories/product-repository.mjs';

export function productsRouter() {
  const router = Router();

  router.get('/', async (req, res) => {
    try {
      const products = await listActiveProducts();
      return res.json({ products });
    } catch (err) {
      // §실측 버그 수정 — 이 catch가 없으면 DB 에러가 uncaught exception으로 올라가서
      // 이 요청 하나가 아니라 Node 프로세스 전체가 죽는다(실제 브라우저 테스트로 발견 —
      // ServiceIntroScreen이 이 API를 호출하도록 바뀌면서 처음 노출된 위험). 다른 라우트들과
      // 동일하게 500으로 안전하게 실패 응답만 준다.
      console.error('[상품 목록 조회 실패]', err.message);
      return res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: '상품 정보를 불러오지 못했습니다.' } });
    }
  });

  return router;
}
