// Analysis entity: one record per AI-answered question — stores what data
// was selected, the model used, the response, and token usage (spec §15,
// §11 "AI API 비용이 발생하는 위치"를 추적하기 위한 핵심 테이블).
import { randomUUID } from 'node:crypto';
import { storeFor } from './base.mjs';

const store = storeFor('analyses');

export async function recordAnalysis({ chartId, conversationId, question, selectedData, model, response, tokenUsage }) {
  const analysis = {
    id: randomUUID(),
    chart_id: chartId,
    conversation_id: conversationId,
    question,
    selected_data: selectedData,
    model,
    response,
    token_usage: tokenUsage,
    created_at: new Date().toISOString(),
  };
  return store.insert(analysis);
}

export async function listAnalysesForConversation(conversationId) {
  return store.filter((a) => a.conversation_id === conversationId);
}
