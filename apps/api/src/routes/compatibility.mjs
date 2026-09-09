// apps/api/src/routes/compatibility.mjs
//
// ⚠️ packages/character/compatibility-content.mjs 참고 — 엔터테인먼트 콘텐츠, 실제 두 사람의
// 명리학적 궁합 계산이 아니다. (기존 무료 라우트, 무변경)
//
// §최종 상품 정책 §2 — /analysis는 별개의 새 AI 기반 궁합 분석(990원 기본/4900원 상세).
import { Router } from 'express';
import { fetchChart } from '../services/chart-service.mjs';
import { generateCompatibilityResult } from '../../../../packages/character/compatibility-content.mjs';
import { generateCompatibilityAnalysis } from '../services/compatibility-analysis-service.mjs';

export function compatibilityRouter({ basicAiProviderFactory = () => null, fullAiProviderFactory = () => null } = {}) {
  const router = Router();

  // POST /api/compatibility — { chartIdA, chartIdB } → 궁합 엔터테인먼트 결과 (기존, 무료, 무변경)
  router.post('/', async (req, res) => {
    const { chartIdA, chartIdB } = req.body ?? {};
    if (!chartIdA || !chartIdB) {
      return res.status(400).json({ error: { code: 'INVALID_INPUT', message: 'chartIdA, chartIdB는 필수입니다.' } });
    }
    const [chartA, chartB] = await Promise.all([fetchChart(chartIdA), fetchChart(chartIdB)]);
    if (!chartA || !chartB) return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Chart not found' } });

    const result = generateCompatibilityResult(chartA.canonical, chartB.canonical);
    return res.json(result);
  });

  // POST /api/compatibility/analysis — { chartIdA, chartIdB, tier } → AI 기반 궁합 분석
  // (신규, tier='basic'이면 Luna/990원, tier='full'이면 Terra/4900원 — 모델 선택은 호출부가 결제
  // entitlement 확인 후 tier를 결정해서 넘긴다는 전제, 이 라우트 자체는 tier 값만 보고 분기한다).
  router.post('/analysis', async (req, res) => {
    const { chartIdA, chartIdB, tier } = req.body ?? {};
    if (!chartIdA || !chartIdB) {
      return res.status(400).json({ error: { code: 'INVALID_INPUT', message: 'chartIdA, chartIdB는 필수입니다.' } });
    }
    if (tier !== 'basic' && tier !== 'full') {
      return res.status(400).json({ error: { code: 'INVALID_INPUT', message: "tier는 'basic' 또는 'full'이어야 합니다." } });
    }
    const [chartA, chartB] = await Promise.all([fetchChart(chartIdA), fetchChart(chartIdB)]);
    if (!chartA || !chartB) return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Chart not found' } });

    const aiProvider = tier === 'full' ? fullAiProviderFactory() : basicAiProviderFactory();
    try {
      const result = await generateCompatibilityAnalysis({ chartA: chartA.canonical, chartB: chartB.canonical, tier, aiProvider });
      return res.json(result);
    } catch (err) {
      return res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: err.message } });
    }
  });

  return router;
}
