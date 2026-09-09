// ChildProfile entity — 부모가 등록한 자녀 프로필. 기존 charts 테이블을 그대로 재사용한다
// (자녀의 canonical chart도 성인과 동일하게 charts에 저장됨, 새 저장 로직 없음).
import { randomUUID } from 'node:crypto';
import { storeFor } from './base.mjs';

const store = storeFor('child_profiles');

export async function createChildProfile({ userId, chartId, name = null }) {
  const profile = {
    id: randomUUID(),
    user_id: userId,
    chart_id: chartId,
    name,
    trial_started_at: null, // 24시간 5회 체험 — 첫 성장 코치 질문 시점에 채워짐
    trial_question_count: 0,
    subscription_status: null, // 이번 단계는 결제 미구현 — 항상 null, 스키마만 예약
    created_at: new Date().toISOString(),
  };
  return store.insert(profile);
}

export async function getChildProfile(id) {
  return store.find((p) => p.id === id);
}

export async function listChildProfilesForUser(userId) {
  return store.filter((p) => p.user_id === userId);
}

/** 테스트/향후 관리용 헬퍼 — 같은 store 인스턴스를 통해 갱신하므로 캐시 불일치가 없다. */
export async function updateChildProfile(id, patch) {
  return store.update(id, patch);
}

const TRIAL_WINDOW_MS = 24 * 60 * 60 * 1000;
const TRIAL_MAX_QUESTIONS = 5;

/**
 * 24시간 5회 체험 게이팅. 첫 호출 시 trial_started_at을 지금 시각으로 세팅한다.
 * 24시간이 지났으면(카운트 무관) 차단, 24시간 이내면 5회까지만 허용.
 * 24시간 경과 후 새 체험권을 자동 지급하지 않는다(§10 — 이번 구현은 최초 체험권 하나만).
 * @returns {{ allowed: boolean, reason: 'ok'|'trial_expired'|'trial_exhausted', questionCount: number }}
 */
export async function recordTrialUsage(childProfileId) {
  const profile = await getChildProfile(childProfileId);
  if (!profile) return { allowed: false, reason: 'not_found', questionCount: 0 };

  const now = Date.now();

  if (!profile.trial_started_at) {
    await store.update(childProfileId, { trial_started_at: new Date(now).toISOString(), trial_question_count: 1 });
    return { allowed: true, reason: 'ok', questionCount: 1 };
  }

  const startedAt = new Date(profile.trial_started_at).getTime();
  const withinWindow = now - startedAt <= TRIAL_WINDOW_MS;

  if (!withinWindow) {
    return { allowed: false, reason: 'trial_expired', questionCount: profile.trial_question_count };
  }
  if (profile.trial_question_count >= TRIAL_MAX_QUESTIONS) {
    return { allowed: false, reason: 'trial_exhausted', questionCount: profile.trial_question_count };
  }

  const nextCount = profile.trial_question_count + 1;
  await store.update(childProfileId, { trial_question_count: nextCount });
  return { allowed: true, reason: 'ok', questionCount: nextCount };
}
