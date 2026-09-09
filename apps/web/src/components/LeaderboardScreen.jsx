// apps/web/src/components/LeaderboardScreen.jsx
//
// ⚠️ 엔터테인먼트 콘텐츠 — packages/character/ranking-content.mjs 참고. 실제 명리학적 서열화가
// 아니다.
import { useEffect, useState } from 'react';
import * as api from '../api/client.js';

const CATEGORIES = [
  { key: 'wealth', label: '재물운' },
  { key: 'business', label: '사업운' },
];

export function LeaderboardScreen({ chartId, userId, onBack, onHome }) {
  const [category, setCategory] = useState('wealth');
  const [myResult, setMyResult] = useState(null);
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      try {
        const [result, board] = await Promise.all([
          api.generateRanking(category, chartId, userId),
          api.getLeaderboard(category),
        ]);
        if (!cancelled) {
          setMyResult(result);
          setEntries(board.entries);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => { cancelled = true; };
  }, [category, chartId, userId]);

  return (
    <div className="subscreen">
      <div className="subscreen__header">
        <button onClick={onBack} className="chat-header__back" aria-label="뒤로가기">‹</button>
        <div>
          <p className="subscreen__header-title">랭킹</p>
          <p className="subscreen__header-subtitle">재미로 보는 나의 순위 🎮</p>
        </div>
        {onHome && <button className="subscreen__header-home" onClick={onHome} aria-label="홈으로">⌂</button>}
      </div>

      <div className="fun-tabs">
        {CATEGORIES.map((c) => (
          <button key={c.key} className={`fun-tab${category === c.key ? ' fun-tab--active' : ''}`} onClick={() => setCategory(c.key)}>
            {c.label}
          </button>
        ))}
      </div>

      <div className="subscreen__body">
        {loading && <p className="leaderboard__loading">불러오는 중...</p>}

        {!loading && myResult && (
          <div className="leaderboard__my-result slide-up">
            <div className="leaderboard__my-emoji">{myResult.emoji}</div>
            <div>
              <p className="leaderboard__my-title">{myResult.title}</p>
              <p className="leaderboard__my-percentile">상위 {myResult.percentile}%</p>
            </div>
          </div>
        )}

        <p className="leaderboard__section-title">리더보드 TOP {entries.length}</p>
        <div className="leaderboard__list">
          {entries.map((e, i) => (
            <div key={`${e.nickname}-${i}`} className="leaderboard__row">
              <span className="leaderboard__rank">{i + 1}</span>
              <span className="leaderboard__emoji">{e.emoji}</span>
              <span className="leaderboard__nickname">{e.nickname}</span>
              <span className="leaderboard__title">{e.title}</span>
            </div>
          ))}
          {!loading && entries.length === 0 && <p className="leaderboard__empty">아직 아무도 없어요. 첫 번째가 되어보세요!</p>}
        </div>
      </div>

      <div className="subscreen__footer">
        <button onClick={onBack} className="subscreen__btn-full">대화로 돌아가기</button>
      </div>
    </div>
  );
}
