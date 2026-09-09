// apps/web/src/components/RevealScreen.jsx
//
// 문서 지시(§10)에 따라 "격자 안에서 글자가 바뀌는" 기존 방식에서 "한자가 위에서 아래로 비처럼
// 떨어져 쌓이는(Matrix 느낌)" 방식으로 재작성했다. 여러 세로 컬럼(column)이 각자 다른 속도로
// 낙하하고, phase 3에서 가운데 命 글자가 발광하며 등장한다. 애니메이션 시간(5.7초)과 실제 API
// 응답시간은 완전히 분리되어 있다 — 이 화면 자체는 순수 연출이고, 실제 분석 호출은
// useChatController가 별도로 처리한다(애니메이션 종료를 기다리지 않고 항상 최소 재생시간만 보장).
import { useEffect, useMemo, useState } from 'react';

const KANJI = ['命', '運', '財', '情', '人', '緣', '業', '時', '福', '官', '星', '木', '火', '水', '金', '土', '風', '山', '月', '日', '龍', '鳳', '壽', '禄', '吉'];
const COLUMN_COUNT = 9;

function randomKanji() {
  return KANJI[Math.floor(Math.random() * KANJI.length)];
}

/** 각 컬럼마다 낙하하는 한자 스트림(세로로 여러 글자) + 낙하 속도/시작 딜레이를 미리 생성 */
function genColumns() {
  return Array.from({ length: COLUMN_COUNT }, (_, colIndex) => ({
    id: colIndex,
    leftPercent: (colIndex / (COLUMN_COUNT - 1)) * 100,
    durationS: 1.6 + Math.random() * 1.4, // 1.6~3.0초 사이 낙하 속도(컬럼마다 다르게 — Matrix 느낌)
    delayS: Math.random() * 0.8,
    chars: Array.from({ length: 6 }, randomKanji),
  }));
}

export function RevealScreen({ onComplete }) {
  const [phase, setPhase] = useState(0);
  const columns = useMemo(genColumns, []);

  useEffect(() => {
    const timers = [
      setTimeout(() => setPhase(1), 100), // 한자비 낙하 시작
      setTimeout(() => setPhase(2), 3200), // 낙하 서서히 옅어짐
      setTimeout(() => setPhase(3), 4200), // 가운데 命 등장
      setTimeout(() => setPhase(4), 5500), // 페이드아웃 시작
      setTimeout(() => onComplete(), 5700 + 400),
    ];
    return () => timers.forEach(clearTimeout);
  }, [onComplete]);

  return (
    <div className="reveal-screen" style={{ opacity: phase === 4 ? 0 : 1, transition: phase === 4 ? 'opacity 0.55s ease' : 'opacity 0.3s ease' }}>
      <div className="reveal-screen__horizon" />
      <div className="reveal-screen__scanlines" />

      {/* 한자 낙하(비) 연출 — 컬럼별로 독립적인 CSS 애니메이션 */}
      <div className="reveal-screen__rain" style={{ opacity: phase >= 3 ? 0.12 : phase >= 1 ? 1 : 0 }}>
        {columns.map((col) => (
          <div
            key={col.id}
            className="reveal-screen__rain-column"
            style={{
              left: `${col.leftPercent}%`,
              animationDuration: `${col.durationS}s`,
              animationDelay: `${col.delayS}s`,
            }}
          >
            {col.chars.map((ch, i) => (
              <span key={i} className="reveal-screen__rain-char" style={{ opacity: 1 - i * 0.16 }}>
                {ch}
              </span>
            ))}
          </div>
        ))}
      </div>

      {phase >= 3 && (
        <div className="reveal-screen__center">
          <svg width="220" height="220" viewBox="0 0 220 220" className="reveal-screen__ring ring-pulse">
            <circle cx="110" cy="110" r="98" stroke="#D4A855" strokeWidth="0.8" fill="none" opacity="0.22" strokeDasharray="5 10" />
            <circle cx="110" cy="110" r="84" stroke="#D4A855" strokeWidth="0.4" fill="none" opacity="0.14" />
            <circle cx="110" cy="110" r="68" stroke="#D4A855" strokeWidth="1.2" fill="none" opacity="0.28" strokeDasharray="2 6" />
          </svg>
          <div className="reveal-screen__glow" />
          <div className="reveal-screen__hanja reveal-in reveal-glow">命</div>
          <p className="reveal-screen__caption reveal-in" style={{ animationDelay: '0.35s' }}>
            분석 중...
          </p>
        </div>
      )}
    </div>
  );
}
