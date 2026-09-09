// AIProfileContext entity — child_id당 1개. 캐주얼 AI에게 넘길 "이 아이에 대해 이미 알고 있는 것"
// 요약본. 원본 purchased_analysis.analysis_json은 절대 건드리지 않고, 이 레코드만 upsert(병합)한다.
import { randomUUID } from 'node:crypto';
import { storeFor } from './base.mjs';

const store = storeFor('ai_profile_contexts');

export async function getAIProfileContextByChildId(childId) {
  const matches = await store.filter((c) => c.child_id === childId);
  return matches[0] ?? null;
}

/** 새로 만들거나, 이미 있으면 병합해서 갱신한다. 병합 시 evidence_refs/source_analysis_ids는
 * 중복을 제거하며 누적하고, 기존 정보를 잃지 않는다(§4 원칙). */
export async function upsertAIProfileContext(childId, patch) {
  const existing = await getAIProfileContextByChildId(childId);

  if (!existing) {
    const record = {
      id: randomUUID(),
      child_id: childId,
      core_traits: patch.core_traits ?? null,
      parent_approach: patch.parent_approach ?? [],
      learning_context: patch.learning_context ?? [],
      social_context: patch.social_context ?? [],
      caution_points: patch.caution_points ?? [],
      observation_points: patch.observation_points ?? [],
      evidence_refs: dedupe(patch.evidence_refs ?? []),
      source_analysis_ids: dedupe(patch.source_analysis_ids ?? []),
      updated_at: new Date().toISOString(),
    };
    return store.insert(record);
  }

  const merged = {
    // core_traits는 최신 것으로 덮어씀(같은 아이의 원국 기반이라 분석마다 달라지지 않음)
    core_traits: patch.core_traits ?? existing.core_traits,
    parent_approach: dedupeByJSON([...(existing.parent_approach ?? []), ...(patch.parent_approach ?? [])]),
    learning_context: dedupeByJSON([...(existing.learning_context ?? []), ...(patch.learning_context ?? [])]),
    social_context: dedupeByJSON([...(existing.social_context ?? []), ...(patch.social_context ?? [])]),
    caution_points: dedupeByJSON([...(existing.caution_points ?? []), ...(patch.caution_points ?? [])]),
    observation_points: dedupe([...(existing.observation_points ?? []), ...(patch.observation_points ?? [])]),
    evidence_refs: dedupe([...(existing.evidence_refs ?? []), ...(patch.evidence_refs ?? [])]),
    source_analysis_ids: dedupe([...(existing.source_analysis_ids ?? []), ...(patch.source_analysis_ids ?? [])]),
    updated_at: new Date().toISOString(),
  };
  return store.update(existing.id, merged);
}

function dedupe(arr) {
  return [...new Set(arr)];
}
function dedupeByJSON(arr) {
  const seen = new Set();
  const result = [];
  for (const item of arr) {
    const key = JSON.stringify(item);
    if (!seen.has(key)) {
      seen.add(key);
      result.push(item);
    }
  }
  return result;
}
