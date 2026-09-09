// apps/api/src/routes/charts.mjs
import { Router } from 'express';
import { createChart, fetchChart, ChartValidationError } from '../services/chart-service.mjs';
import { startConversation, askQuestion } from '../services/conversation-service.mjs';
import { ChartEngineError } from '../../../../packages/chart-engine/compute.mjs';
import { AIProviderError } from '../../../../packages/ai/providers/openai-provider.mjs';

export function chartsRouter({ aiProviderFactory, model, basicAiProviderFactory = null, basicModel = 'unknown' }) {
  const router = Router();

  // POST /api/charts — 생년월일시 입력 → 계산 → Canonical Chart 생성
  router.post('/', async (req, res) => {
    const { birthDate, birthTime, gender, city, timezone, userId } = req.body ?? {};
    if (!birthDate || !birthTime || !gender || !city) {
      return res.status(400).json({ error: { code: 'INVALID_INPUT', message: 'birthDate, birthTime, gender, city는 필수입니다.' } });
    }
    try {
      const chart = await createChart({ birthDate, birthTime, gender, city, timezone }, userId ?? null);
      return res.status(201).json({ id: chart.id, canonical: chart.canonical, created_at: chart.created_at });
    } catch (err) {
      if (err instanceof ChartEngineError) {
        return res.status(400).json({ error: { code: err.code, message: err.message } });
      }
      if (err instanceof ChartValidationError) {
        return res.status(500).json({ error: { code: 'SCHEMA_VALIDATION_FAILED', message: err.message, details: err.errors } });
      }
      return res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: err.message } });
    }
  });

  // GET /api/charts/:id — 저장된 차트 조회
  router.get('/:id', async (req, res) => {
    const chart = await fetchChart(req.params.id);
    if (!chart) return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Chart not found' } });
    return res.json({ id: chart.id, canonical: chart.canonical, created_at: chart.created_at });
  });

  // POST /api/charts/:id/questions — 사용자 질문 → AI 답변
  // (conversationId를 body로 주면 이어서 대화, 없으면 새 conversation 생성)
  router.post('/:id/questions', async (req, res) => {
    const { question, conversationId, characterId, childProfileId, tier } = req.body ?? {};
    if (!question || typeof question !== 'string') {
      return res.status(400).json({ error: { code: 'INVALID_INPUT', message: 'question(string)은 필수입니다.' } });
    }
    // §6 확정 정책 — 사용자 질문은 최대 50자.
    if (question.length > 50) {
      return res.status(400).json({ error: { code: 'QUESTION_TOO_LONG', message: '질문은 50자 이내로 입력해주세요.' } });
    }

    try {
      const chart = await fetchChart(req.params.id);
      if (!chart) return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Chart not found' } });

      const conversation = conversationId
        ? { id: conversationId }
        : await startConversation({ chartId: chart.id, characterId: characterId ?? 'daegu', childProfileId: childProfileId ?? null });

      // §최종 상품 정책 — 기본 분석(990원)은 Luna, 상세 분석(4900원)은 Terra. tier가 명시적으로
      // 'basic'이 아니면 기존 동작(Terra) 그대로 유지 — 하위 호환.
      const useBasic = tier === 'basic' && basicAiProviderFactory;
      const provider = useBasic ? basicAiProviderFactory() : aiProviderFactory();
      const effectiveModel = useBasic ? basicModel : model;
      const result = await askQuestion({ conversationId: conversation.id, question, aiProvider: provider, model: effectiveModel });

      return res.json({
        conversationId: conversation.id,
        response: result.response,
        sources: result.analysis.sources,
        cross_analysis: result.analysis.cross_analysis,
        usage: result.usage,
      });
    } catch (err) {
      return handlePipelineError(res, err);
    }
  });

  return router;
}

export function handlePipelineError(res, err) {
  if (err.code === 'CHART_NOT_FOUND' || err.code === 'CONVERSATION_NOT_FOUND') {
    return res.status(404).json({ error: { code: err.code, message: err.message } });
  }
  if (err instanceof AIProviderError) {
    const status = err.code === 'REFUSAL' ? 422 : err.code === 'NETWORK_ERROR' ? 502 : 500;
    return res.status(status).json({ error: { code: err.code, message: err.message } });
  }
  return res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: err.message } });
}
