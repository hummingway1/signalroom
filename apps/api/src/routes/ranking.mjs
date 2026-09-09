// apps/api/src/routes/ranking.mjs
//
// ⚠️ packages/character/ranking-content.mjs 참고 — 엔터테인먼트 콘텐츠, 실제 명리학적 서열화가
// 아니다. 실제 canonical chart를 시드로만 사용해 안정적인 재미 결과를 만든다.
import { Router } from 'express';
import { fetchChart } from '../services/chart-service.mjs';
import { generateRankingResult, RANKING_CATEGORIES } from '../../../../packages/character/ranking-content.mjs';
import { submitLeaderboardEntry, getLeaderboard } from '../repositories/leaderboard-repository.mjs';
import { getUser } from '../repositories/user-repository.mjs';

const VALID_CATEGORIES = new Set(RANKING_CATEGORIES.map((c) => c.key));

export function rankingRouter() {
  const router = Router();

  // POST /api/ranking/:category — { chartId, userId? } → 결과 생성 (+ userId가 있으면 리더보드에 제출)
  router.post('/:category', async (req, res) => {
    const { category } = req.params;
    const { chartId, userId } = req.body ?? {};
    if (!VALID_CATEGORIES.has(category)) {
      return res.status(400).json({ error: { code: 'INVALID_CATEGORY', message: `category는 ${[...VALID_CATEGORIES].join('/')} 중 하나여야 합니다.` } });
    }
    if (!chartId) return res.status(400).json({ error: { code: 'INVALID_INPUT', message: 'chartId는 필수입니다.' } });

    const chart = await fetchChart(chartId);
    if (!chart) return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Chart not found' } });

    const result = generateRankingResult(chart.canonical, category);

    let submitted = false;
    if (userId) {
      const user = await getUser(userId);
      if (user) {
        await submitLeaderboardEntry({ userId, nickname: user.nickname, category, score: result.score, title: result.title, emoji: result.emoji });
        submitted = true;
      }
    }

    return res.json({ ...result, submitted });
  });

  // GET /api/ranking/:category/leaderboard — 상위 N개
  router.get('/:category/leaderboard', async (req, res) => {
    const { category } = req.params;
    if (!VALID_CATEGORIES.has(category)) {
      return res.status(400).json({ error: { code: 'INVALID_CATEGORY', message: `category는 ${[...VALID_CATEGORIES].join('/')} 중 하나여야 합니다.` } });
    }
    const limit = Math.min(Number(req.query.limit) || 20, 50);
    const entries = await getLeaderboard(category, limit);
    return res.json({ category, entries: entries.map((e) => ({ nickname: e.nickname, score: e.score, title: e.title, emoji: e.emoji })) });
  });

  return router;
}
