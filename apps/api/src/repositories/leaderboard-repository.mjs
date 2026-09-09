// Leaderboard entity — 카테고리별(wealth/business) 랭킹 항목을 저장. 사용자가 결과를 볼 때마다
// 자기 점수를 리더보드에 제출/갱신할 수 있다(§실제 여러 사용자가 서로 비교하는 리더보드).
import { randomUUID } from 'node:crypto';
import { storeFor } from './base.mjs';

const store = storeFor('leaderboard_entries');

/** 같은 유저+카테고리 조합이 이미 있으면 갱신, 없으면 새로 추가. */
export async function submitLeaderboardEntry({ userId, nickname, category, score, title, emoji }) {
  const existing = await store.filter((e) => e.user_id === userId && e.category === category);
  if (existing.length > 0) {
    return store.update(existing[0].id, { nickname, score, title, emoji, updated_at: new Date().toISOString() });
  }
  const entry = {
    id: randomUUID(),
    user_id: userId,
    nickname,
    category,
    score,
    title,
    emoji,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };
  return store.insert(entry);
}

/** 카테고리별 상위 N개(점수 내림차순). */
export async function getLeaderboard(category, limit = 20) {
  const entries = await store.filter((e) => e.category === category);
  return entries.sort((a, b) => b.score - a.score).slice(0, limit);
}
