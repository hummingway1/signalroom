// Conversation entity: groups Messages for a given (user, chart) pair.
// Stores a running `summary` + `important_context` so we don't have to
// replay the full message history into every AI call (spec §12).
import { randomUUID } from 'node:crypto';
import { storeFor } from './base.mjs';

const store = storeFor('conversations');

export async function createConversation({ userId = null, chartId = null, characterId = 'daegu', childProfileId = null, fortuneYear = null, dateSelectionScopeId = null }) {
  const conversation = {
    id: randomUUID(),
    user_id: userId,
    chart_id: chartId,
    character_id: characterId,
    child_profile_id: childProfileId, // 있으면 이 대화는 자녀 프로필 기반(AIProfileContext 주입 대상), 없으면 기존 대화 그대로
    fortune_year: fortuneYear, // §Phase5 — 있으면 이 대화는 특정 연도 신년운세 전용(구조적 스코프 태깅, child_profile_id와 동일한 방식)
    date_selection_scope_id: dateSelectionScopeId, // §출생일 택일 채팅 — 있으면 이 대화는 특정 택일 analysis_scope 전용(단일 chart_id로 표현 불가능한 다중 후보 비교 데이터라 별도 필드 필요, fortune_year와 동일한 구조적 스코프 태깅 방식)
    current_context: null, // packages/character/catalog-selector.mjs가 다음 선택지를 고를 때 쓰는 "지금 어떤 주제 화면인지"
    seen_catalog_ids: [], // §16 — 이미 노출된 catalog 항목은 다시 추천하지 않음
    casual_ai_call_log: [], // 캐주얼 AI(저가 모델) 호출 timestamp 기록 — 남용 방지 sliding window용
    recent_casual_responses: [], // 최근 캐주얼 응답 텍스트(최대 3개) — casual-response-engine.mjs 반복 방지용
    summary: '',
    important_context: [],
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };
  return store.insert(conversation);
}

export async function getConversation(id) {
  return store.find((c) => c.id === id);
}

export async function updateConversationSummary(id, { summary, important_context }) {
  return store.update(id, { summary, important_context, updated_at: new Date().toISOString() });
}

/** 캐릭터가 바뀌었을 때(카탈로그 항목이 다른 캐릭터에 배정된 경우) 대화 레코드에 영구 반영한다.
 * 이게 없으면 catalog 선택으로 캐릭터가 그 턴에만 바뀌고, 다음 자유 입력에서 다시 원래 캐릭터로
 * 돌아가버린다 — 실제 사용자 리포트로 발견된 버그(§9 "캐릭터 전환"이 지속되지 않던 문제). */
export async function updateConversationCharacter(id, characterId) {
  return store.update(id, { character_id: characterId, updated_at: new Date().toISOString() });
}

/**
 * 캐주얼 AI(저가 모델) 호출 예산 — 폭탄 메시지로 과금을 유도하는 남용을 막기 위한 대화별
 * sliding-window 카운터. 예산을 넘으면 AI를 호출하지 않고 무료 고정 반응으로 대체해야 한다
 * (실제 차단은 conversation-service.mjs가 이 함수의 반환값을 보고 판단).
 */
export async function recordAndCheckCasualAiBudget(id, { maxPerMinute, maxPerHour }) {
  const conversation = await getConversation(id);
  if (!conversation) return { allowed: false };
  const now = Date.now();
  const log = (conversation.casual_ai_call_log ?? []).filter((ts) => now - ts < 3600_000); // 1시간 넘은 기록은 정리

  const countLastMinute = log.filter((ts) => now - ts < 60_000).length;
  const countLastHour = log.length;

  const allowed = countLastMinute < maxPerMinute && countLastHour < maxPerHour;
  const updatedLog = allowed ? [...log, now] : log;

  await store.update(id, { casual_ai_call_log: updatedLog, updated_at: new Date().toISOString() });
  return { allowed, countLastMinute, countLastHour };
}

/** catalog 항목을 하나 소비했을 때 대화 상태를 갱신 — 다음 context로 이동 + seen 목록에 추가. */
export async function markCatalogEntrySeen(id, { catalogId, nextContext }) {
  const conversation = await getConversation(id);
  if (!conversation) return null;
  const seen = [...new Set([...(conversation.seen_catalog_ids ?? []), catalogId])];
  return store.update(id, { seen_catalog_ids: seen, current_context: nextContext ?? conversation.current_context, updated_at: new Date().toISOString() });
}

/** casual-response-engine.mjs가 방금 사용한 응답 텍스트를 기록 — 최근 3개만 유지(문서 요구사항
 * "직전 1~3개 메시지를 고려하여 같은 응답을 반복하지 않도록"). 다음 캐주얼 응답 생성 시 이 목록을
 * 조회해서 겹치는 후보를 제외한다. */
export async function recordCasualResponse(id, responseText) {
  const conversation = await getConversation(id);
  if (!conversation) return null;
  const recent = [...(conversation.recent_casual_responses ?? []), responseText].slice(-3);
  return store.update(id, { recent_casual_responses: recent, updated_at: new Date().toISOString() });
}
