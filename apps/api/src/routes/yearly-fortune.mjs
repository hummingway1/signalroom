// apps/api/src/routes/yearly-fortune.mjs
import { Router } from 'express';
import { requireAuth } from '../middleware/session.mjs';
import { getOrGenerateYearlyFortuneResult, YearlyFortuneError } from '../services/yearly-fortune-service.mjs';
import { findYearlyFortuneScopesForTarget, getAnalysisScopeById, verifyAnalysisScopeOwnership } from '../repositories/analysis-scope-repository.mjs';
import { startConversation } from '../services/conversation-service.mjs';

export function yearlyFortuneRouter({ basicAiProviderFactory = () => null, detailAiProviderFactory = () => null } = {}) {
  const router = Router();

  // GET /api/yearly-fortune/lookup?chartId=&childProfileId=&fortuneYear= — 이 대상+연도에 이미
  // 구매한 BASIC/CHAT이 있는지 확인(프론트가 "결과 보기" vs "구매하기" 화면을 정하는 데 사용).
  router.get('/lookup', requireAuth, async (req, res) => {
    const { chartId, childProfileId, fortuneYear } = req.query;
    const year = Number(fortuneYear);
    if (!year || (!chartId && !childProfileId)) {
      return res.status(400).json({ error: { code: 'INVALID_INPUT', message: 'fortuneYear와 chartId 또는 childProfileId가 필요합니다.' } });
    }
    const scopes = await findYearlyFortuneScopesForTarget(req.user.id, { chartId: chartId ?? null, childProfileId: childProfileId ?? null, fortuneYear: year });
    return res.json({ scopes });
  });

  // POST /api/yearly-fortune/:analysisScopeId/chat — CHAT 결과 화면의 "AI에게 질문하기" 진입점.
  // 이 scope의 chart_id/child_profile_id/fortune_year로 conversation을 시작해서 conversationId를
  // 반환한다 — 이후 기존 ChatScreen/messages API를 그대로 재사용(§Phase5 authorization이 이미
  // conversation.fortune_year로 도메인을 판정하므로 여기서 추가 권한 로직을 만들지 않는다).
  router.post('/:analysisScopeId/chat', requireAuth, async (req, res) => {
    try {
      const scope = await verifyAnalysisScopeOwnership(req.params.analysisScopeId, req.user.id);
      if (scope.analysis_type !== 'YEARLY_FORTUNE') {
        return res.status(400).json({ error: { code: 'NOT_YEARLY_FORTUNE_SCOPE', message: '신년운세 분석이 아닙니다.' } });
      }
      const chartId = scope.chart_id ?? (await (async () => {
        const { getChildProfile } = await import('../repositories/child-profile-repository.mjs');
        const profile = await getChildProfile(scope.child_profile_id);
        return profile?.chart_id ?? null;
      })());
      if (!chartId) return res.status(404).json({ error: { code: 'SUBJECT_NOT_FOUND', message: '대상 chart를 찾을 수 없습니다.' } });

      const conversation = await startConversation({
        chartId, userId: req.user.id, characterId: 'daegu',
        childProfileId: scope.child_profile_id ?? null,
        fortuneYear: scope.fortune_year,
      });
      return res.status(201).json({ conversationId: conversation.id });
    } catch (err) {
      if (err.code === 'ANALYSIS_NOT_FOUND') return res.status(404).json({ error: { code: err.code, message: err.message } });
      if (err.code === 'UNAUTHORIZED') return res.status(403).json({ error: { code: err.code, message: err.message } });
      throw err;
    }
  });

  // GET /api/yearly-fortune/:analysisScopeId — 최초 호출 시 생성(LLM 1회), 이후로는 저장된
  // result_data를 그대로 반환(LLM 호출 없음). 소유권은 서버가 세션 userId로만 검증한다.
  router.get('/:analysisScopeId', requireAuth, async (req, res) => {
    try {
      const result = await getOrGenerateYearlyFortuneResult({
        analysisScopeId: req.params.analysisScopeId,
        userId: req.user.id,
        basicAiProvider: basicAiProviderFactory(),
        detailAiProvider: detailAiProviderFactory(),
      });
      return res.json(result);
    } catch (err) {
      if (err instanceof YearlyFortuneError) {
        const status = { NOT_YEARLY_FORTUNE_SCOPE: 400, ENTITLEMENT_NOT_FOUND: 404, SUBJECT_NOT_FOUND: 404, YEAR_DATA_NOT_FOUND: 404, PROVIDER_NOT_CONFIGURED: 501 }[err.code] ?? 500;
        return res.status(status).json({ error: { code: err.code, message: err.message } });
      }
      if (err.code === 'ANALYSIS_NOT_FOUND') return res.status(404).json({ error: { code: err.code, message: err.message } });
      if (err.code === 'UNAUTHORIZED') return res.status(403).json({ error: { code: err.code, message: err.message } });
      throw err;
    }
  });

  return router;
}
