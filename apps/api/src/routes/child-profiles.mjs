// apps/api/src/routes/child-profiles.mjs
import { Router } from 'express';
import { createChildProfile, getChildProfile, listChildProfilesForUser } from '../repositories/child-profile-repository.mjs';
import { generateChildGrowthAnalysis, getChildContext, listAnalysesForChild, summarizeChildAnalysisForDisplay } from '../services/child-profile-service.mjs';

export function childProfilesRouter({ basicAiProviderFactory = () => null, fullAiProviderFactory = () => null } = {}) {
  const router = Router();

  // GET /api/child-profiles?userId=... — 이 사용자가 이미 등록한 자녀 프로필 목록을, 각각의
  // 구매 이력(어떤 tier까지 봤는지)과 함께 반환한다. 프론트가 이걸로 "이미 있는 아이"를 재사용해서
  // 매번 새 프로필을 만들지 않게 하고, "이미 전체 사주를 봤는지"를 실제로 기억하게 한다.
  router.get('/', async (req, res) => {
    const userId = req.query.userId;
    if (!userId) return res.status(400).json({ error: { code: 'INVALID_INPUT', message: 'userId 쿼리 파라미터는 필수입니다.' } });
    const profiles = await listChildProfilesForUser(userId);
    const withHistory = await Promise.all(
      profiles.map(async (profile) => {
        const analyses = await listAnalysesForChild(profile.id);
        const hasFullAnalysis = analyses.some((a) => a.tier === 'full');
        const hasBasicAnalysis = analyses.some((a) => a.tier === 'basic');
        return { ...profile, hasFullAnalysis, hasBasicAnalysis };
      })
    );
    return res.json({ profiles: withHistory });
  });

  // POST /api/child-profiles — { userId, chartId, name? } → 자녀 프로필 생성(기존 chart 재사용)
  router.post('/', async (req, res) => {
    const { userId, chartId, name } = req.body ?? {};
    if (!userId || !chartId) {
      return res.status(400).json({ error: { code: 'INVALID_INPUT', message: 'userId, chartId는 필수입니다.' } });
    }
    const profile = await createChildProfile({ userId, chartId, name: name ?? null });
    return res.status(201).json(profile);
  });

  // POST /api/child-profiles/:id/analyses — { userId, tier } → 분석 실행 + 불변 저장 + context 병합
  //   + §20 tier별 모델(basic=luna, full=terra)로 부모가 읽을 요약 텍스트까지 함께 생성.
  // 이번 단계는 결제 승인 검사를 하지 않는다("분석 생성"과 "결제 승인"을 의도적으로 분리).
  router.post('/:id/analyses', async (req, res) => {
    const { userId, tier } = req.body ?? {};
    if (!userId) return res.status(400).json({ error: { code: 'INVALID_INPUT', message: 'userId는 필수입니다.' } });
    const resolvedTier = tier === 'full' ? 'full' : 'basic';
    try {
      const { purchasedAnalysis, context } = await generateChildGrowthAnalysis({ childProfileId: req.params.id, userId, tier: resolvedTier });
      const provider = resolvedTier === 'full' ? fullAiProviderFactory() : basicAiProviderFactory();
      const summary = await summarizeChildAnalysisForDisplay({ analysisResult: purchasedAnalysis.analysis_json, tier: resolvedTier, aiProvider: provider });
      return res.status(201).json({ purchasedAnalysis, context, summary });
    } catch (err) {
      if (err.code === 'CHILD_PROFILE_NOT_FOUND' || err.code === 'CHART_NOT_FOUND') {
        return res.status(404).json({ error: { code: err.code, message: err.message } });
      }
      if (err.code === 'FORBIDDEN') {
        return res.status(403).json({ error: { code: err.code, message: err.message } });
      }
      if (err.code === 'FREE_TIER_EXHAUSTED') {
        return res.status(403).json({ error: { code: err.code, message: err.message } });
      }
      return res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: err.message } });
    }
  });

  // GET /api/child-profiles/:id/context?userId=... — AIProfileContext 조회, 소유권 검증
  router.get('/:id/context', async (req, res) => {
    const userId = req.query.userId;
    if (!userId) return res.status(400).json({ error: { code: 'INVALID_INPUT', message: 'userId 쿼리 파라미터는 필수입니다.' } });
    const result = await getChildContext(req.params.id, userId);
    if (result.error === 'NOT_FOUND') return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Child profile not found' } });
    if (result.error === 'FORBIDDEN') return res.status(403).json({ error: { code: 'FORBIDDEN', message: '이 자녀 프로필에 접근할 권한이 없습니다.' } });
    return res.json({ profile: result.profile, context: result.context });
  });

  // GET /api/child-profiles/:id/analyses — 해당 자녀의 구매 분석 목록(감사/디버깅용)
  router.get('/:id/analyses', async (req, res) => {
    const profile = await getChildProfile(req.params.id);
    if (!profile) return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Child profile not found' } });
    const analyses = await listAnalysesForChild(req.params.id);
    return res.json({ analyses });
  });

  return router;
}
