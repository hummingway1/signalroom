// apps/api/src/routes/birth-selection.mjs
import { Router } from 'express';
import { requireAuth } from '../middleware/session.mjs';
import { getOrGenerateBirthSelectionResult, BirthSelectionError } from '../services/birth-selection-service.mjs';
import { verifyAnalysisScopeOwnership } from '../repositories/analysis-scope-repository.mjs';
import { startConversation } from '../services/conversation-service.mjs';

export function birthSelectionRouter({ aiProviderFactory = () => null } = {}) {
  const router = Router();

  // POST /api/birth-selection/:analysisScopeId/chat — 이 택일 결과에 대한 대화방을 새로 만든다
  // (YEARLY_FORTUNE의 /chat과 정확히 같은 계약 — 여기서 AI 응답을 바로 반환하지 않고 conversationId
  // 만 반환한다. 실제 질문/응답/quota차감은 POST /api/conversations/:id/messages로 이어진다).
  router.post('/:analysisScopeId/chat', requireAuth, async (req, res) => {
    try {
      const scope = await verifyAnalysisScopeOwnership(req.params.analysisScopeId, req.user.id);
      if (scope.analysis_type !== 'DATE_SELECTION') {
        return res.status(400).json({ error: { code: 'NOT_DATE_SELECTION_SCOPE', message: '출생일 택일 분석이 아닙니다.' } });
      }
      const conversation = await startConversation({
        userId: req.user.id, characterId: 'daegu',
        dateSelectionScopeId: req.params.analysisScopeId,
      });
      return res.status(201).json({ conversationId: conversation.id });
    } catch (err) {
      if (err.code === 'ANALYSIS_NOT_FOUND') return res.status(404).json({ error: { code: err.code, message: err.message } });
      if (err.code === 'UNAUTHORIZED') return res.status(403).json({ error: { code: err.code, message: err.message } });
      throw err;
    }
  });

  // GET /api/birth-selection/:analysisScopeId — 최초 호출 시 생성(LLM 1~수회), 이후로는
  // 저장된 result_data를 그대로 반환(LLM 호출 없음). 소유권은 서버가 세션 userId로만 검증한다.
  router.get('/:analysisScopeId', requireAuth, async (req, res) => {
    try {
      const result = await getOrGenerateBirthSelectionResult({
        analysisScopeId: req.params.analysisScopeId,
        userId: req.user.id,
        aiProvider: aiProviderFactory(),
      });
      return res.json(result);
    } catch (err) {
      if (err instanceof BirthSelectionError) {
        const status = { NOT_DATE_SELECTION_SCOPE: 400, PARAMS_NOT_FOUND: 404, PROVIDER_NOT_CONFIGURED: 501, FABRICATED_CANDIDATE: 502 }[err.code] ?? 500;
        return res.status(status).json({ error: { code: err.code, message: err.message } });
      }
      if (err.code === 'ANALYSIS_NOT_FOUND') return res.status(404).json({ error: { code: err.code, message: err.message } });
      if (err.code === 'UNAUTHORIZED') return res.status(403).json({ error: { code: err.code, message: err.message } });
      throw err;
    }
  });

  return router;
}
