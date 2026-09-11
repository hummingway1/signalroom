// apps/api/src/routes/conversations.mjs
import { Router } from 'express';
import { askQuestion, getConversationHistory, getOpeningChoices, pickCatalogChoice, handleFreeTextMessage, getChildOpeningChoices, pickChildCatalogChoice } from '../services/conversation-service.mjs';
import { handlePipelineError } from './charts.mjs';

export function conversationsRouter({ aiProviderFactory, model, casualAiProviderFactory = () => null, casualModel = 'unknown', childCoachAiProviderFactory = () => null, childCoachModel = 'unknown' }) {
  const router = Router();

  // GET /api/conversations/:id — 대화 조회 (메시지 히스토리 포함)
  router.get('/:id', async (req, res) => {
    try {
      const messages = await getConversationHistory(req.params.id);
      return res.json({ conversationId: req.params.id, messages });
    } catch (err) {
      return res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: err.message } });
    }
  });

  // POST /api/conversations/:id/messages — 대화 이어가기 (자유 입력)
  // §13/§14: 일상 대화면 캐릭터 리액션만(AI 호출 없음), 사주 질문이면 기존 파이프라인으로.
  router.post('/:id/messages', async (req, res) => {
    const { question } = req.body ?? {};
    if (!question || typeof question !== 'string') {
      return res.status(400).json({ error: { code: 'INVALID_INPUT', message: 'question(string)은 필수입니다.' } });
    }
    // §Phase10 확정 정책 — 사용자 질문은 최대 50자(AI 답변에는 이 제한이 없다, 서로 다른 제약이다).
    if (question.length > 50) {
      return res.status(400).json({ error: { code: 'QUESTION_TOO_LONG', message: '질문은 50자 이내로 입력해주세요.' } });
    }
    // §Phase10 — 클라이언트가 entitlementId를 보내더라도 여기서 소비 근거로 쓰지 않는다(제거된
    // 레거시). entitlement 소비는 handleFreeTextMessage 내부의 authorization(질문 도메인 판정 →
    // 서버가 직접 찾은 entitlement 확인 → LLM 성공 후 차감) 흐름 하나로만 이루어진다.
    try {
      const aiProvider = aiProviderFactory();
      const casualAiProvider = casualAiProviderFactory();
      const childCoachAiProvider = childCoachAiProviderFactory();
      const result = await handleFreeTextMessage({ conversationId: req.params.id, text: question, aiProvider, model, casualAiProvider, casualModel, childCoachAiProvider, userId: req.user?.id ?? null });
      return res.json({
        conversationId: req.params.id,
        intent: result.intent,
        response: result.response,
        character: { id: result.character.id, displayName: result.character.displayName, emoji: result.character.emoji },
        sources: result.sources ?? null,
        cross_analysis: result.cross_analysis ?? null,
        highlight_card: result.highlightCard ?? null,
        usage: result.usage,
        suggestedQuestions: result.suggestedQuestions ?? [], // §버그수정 — handleFreeTextMessage가 만들어도 라우트가 응답에서 누락시키고 있었음
        // §실제 상품 플로우 연결 버그 수정 — authorization이 거부되면 result.authorization.missingAnalysisType
        // 은 이미 존재했지만(analysis_type 문자열 === product.code 문자열, 확인됨) 라우트가 이걸 응답에서
        // 완전히 버리고 있어서 프론트가 "구매 CTA"를 만들 데이터 자체가 없었다. 이제 그대로 노출한다 —
        // 새 백엔드 로직이 아니라 이미 있던 authorization 판정 결과를 그대로 드러내는 것뿐이다.
        purchaseRequired: (result.authorization && !result.authorization.authorized)
          ? { productCode: result.authorization.missingAnalysisType ?? null, loginRequired: result.authorization.loginRequired === true }
          : (result.purchaseRequired ?? null),
      });
    } catch (err) {
      return handlePipelineError(res, err);
    }
  });

  // GET /api/conversations/:id/opening-choices — 대화 시작 시 첫 선택지 세트 (AI 호출 없음)
  router.get('/:id/opening-choices', async (req, res) => {
    try {
      const { character, choices } = getOpeningChoices();
      return res.json({
        conversationId: req.params.id,
        character: { id: character.id, displayName: character.displayName, emoji: character.emoji },
        choices,
      });
    } catch (err) {
      return res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: err.message } });
    }
  });

  // POST /api/conversations/:id/catalog-choice — 사용자가 선택지(카탈로그 항목)를 골랐을 때
  // body: { catalogId }
  router.post('/:id/catalog-choice', async (req, res) => {
    const { catalogId } = req.body ?? {};
    if (!catalogId || typeof catalogId !== 'string') {
      return res.status(400).json({ error: { code: 'INVALID_INPUT', message: 'catalogId(string)은 필수입니다.' } });
    }
    try {
      const aiProvider = aiProviderFactory();
      const result = await pickCatalogChoice({ conversationId: req.params.id, catalogId, aiProvider, model, userId: req.user?.id ?? null });
      return res.json({
        conversationId: req.params.id,
        userDisplayText: result.displayText,
        response: result.response,
        character: { id: result.character.id, displayName: result.character.displayName, emoji: result.character.emoji },
        nextChoices: result.nextChoices,
        highlight_card: result.highlightCard ?? null,
        usage: result.usage,
        purchaseRequired: (result.authorization && !result.authorization.authorized)
          ? { productCode: result.authorization.missingAnalysisType ?? null, loginRequired: result.authorization.loginRequired === true }
          : (result.purchaseRequired ?? null),
      });
    } catch (err) {
      if (err.code === 'CATALOG_ENTRY_NOT_FOUND') {
        return res.status(400).json({ error: { code: err.code, message: err.message } });
      }
      return handlePipelineError(res, err);
    }
  });

  // GET /api/conversations/:id/child-opening-choices — 자녀 사주 전용 오프닝 선택지 (항상 박사냥)
  router.get('/:id/child-opening-choices', async (req, res) => {
    try {
      const { character, choices } = getChildOpeningChoices();
      return res.json({
        conversationId: req.params.id,
        character: { id: character.id, displayName: character.displayName, emoji: character.emoji },
        choices,
      });
    } catch (err) {
      return res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: err.message } });
    }
  });

  // POST /api/conversations/:id/child-catalog-choice — 자녀 사주 카탈로그 선택 처리
  router.post('/:id/child-catalog-choice', async (req, res) => {
    const { catalogId } = req.body ?? {};
    if (!catalogId || typeof catalogId !== 'string') {
      return res.status(400).json({ error: { code: 'INVALID_INPUT', message: 'catalogId(string)은 필수입니다.' } });
    }
    try {
      const aiProvider = aiProviderFactory();
      const result = await pickChildCatalogChoice({ conversationId: req.params.id, catalogId, aiProvider, model });
      return res.json({
        conversationId: req.params.id,
        userDisplayText: result.displayText,
        response: result.response,
        character: { id: result.character.id, displayName: result.character.displayName, emoji: result.character.emoji },
        nextChoices: result.nextChoices,
        highlight_card: result.highlightCard ?? null,
        usage: result.usage,
      });
    } catch (err) {
      if (err.code === 'CATALOG_ENTRY_NOT_FOUND') {
        return res.status(400).json({ error: { code: err.code, message: err.message } });
      }
      return handlePipelineError(res, err);
    }
  });

  return router;
}
