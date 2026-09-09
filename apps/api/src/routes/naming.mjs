// apps/api/src/routes/naming.mjs
import { Router } from 'express';
import { requireAuth } from '../middleware/session.mjs';
import { getOrGenerateNamingResult, NamingError } from '../services/naming-service.mjs';
import { verifyAnalysisScopeOwnership } from '../repositories/analysis-scope-repository.mjs';
import { startConversation } from '../services/conversation-service.mjs';

export function namingRouter({ aiProviderFactory = () => null } = {}) {
  const router = Router();

  router.post('/:analysisScopeId/chat', requireAuth, async (req, res) => {
    try {
      const scope = await verifyAnalysisScopeOwnership(req.params.analysisScopeId, req.user.id);
      if (scope.analysis_type !== 'NAMING') {
        return res.status(400).json({ error: { code: 'NOT_NAMING_SCOPE', message: '작명 분석이 아닙니다.' } });
      }
      const conversation = await startConversation({
        userId: req.user.id, characterId: 'daegu',
        chartId: scope.chart_id, namingScopeId: req.params.analysisScopeId,
      });
      return res.status(201).json({ conversationId: conversation.id });
    } catch (err) {
      if (err.code === 'ANALYSIS_NOT_FOUND') return res.status(404).json({ error: { code: err.code, message: err.message } });
      if (err.code === 'UNAUTHORIZED') return res.status(403).json({ error: { code: err.code, message: err.message } });
      throw err;
    }
  });

  router.get('/:analysisScopeId', requireAuth, async (req, res) => {
    try {
      const result = await getOrGenerateNamingResult({
        analysisScopeId: req.params.analysisScopeId,
        userId: req.user.id,
        aiProvider: aiProviderFactory(),
      });
      return res.json(result);
    } catch (err) {
      if (err instanceof NamingError) {
        const status = { NOT_NAMING_SCOPE: 400, PARAMS_NOT_FOUND: 404, SUBJECT_NOT_FOUND: 404, PROVIDER_NOT_CONFIGURED: 501 }[err.code] ?? 500;
        return res.status(status).json({ error: { code: err.code, message: err.message } });
      }
      if (err.code === 'ANALYSIS_NOT_FOUND') return res.status(404).json({ error: { code: err.code, message: err.message } });
      if (err.code === 'UNAUTHORIZED') return res.status(403).json({ error: { code: err.code, message: err.message } });
      throw err;
    }
  });

  return router;
}
