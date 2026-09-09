// apps/web/src/components/WelcomeScreen.jsx
//
// Figma WelcomeScreen 이식 — 큰 아바타 + phase에 따라 순차 등장하는 메시지 2개 + CTA 버튼.
// "사주 질문을 선택하세요" 화면이 아니라 "고양이가 나한테 말을 걸고 있다"는 첫인상을 주는 것이
// 목적(원본 기획서 §10). 타이밍(phase 1: 0.6s, phase 2: 1.5s, phase 3: 2.6s)도 Figma 그대로.
import { useEffect, useState } from 'react';
import { CharacterAvatar } from './CharacterAvatar.jsx';

export function WelcomeScreen({ onStart, onBack, onHome }) {
  const [phase, setPhase] = useState(0);

  useEffect(() => {
    const timers = [
      setTimeout(() => setPhase(1), 600),
      setTimeout(() => setPhase(2), 1500),
      setTimeout(() => setPhase(3), 2600),
    ];
    return () => timers.forEach(clearTimeout);
  }, []);

  return (
    <div className="welcome-screen">
      <div className="welcome-screen__topbar">
        {onBack && <button className="chat-header__back" onClick={onBack} aria-label="뒤로가기">‹</button>}
        <p className="welcome-screen__eyebrow">아이시그널</p>
        {onHome && <button className="chat-header__home" onClick={onHome} aria-label="홈으로">⌂</button>}
      </div>
      <div className="welcome-screen__avatar">
        <CharacterAvatar characterId="daegu" size={96} />
      </div>

      <div className="welcome-screen__messages">
        {phase >= 1 && (
          <div className="welcome-screen__msg-row msg-in">
            <div className="welcome-screen__msg-avatar-slot">
              <CharacterAvatar characterId="daegu" size={28} />
            </div>
            <div className="welcome-screen__bubble">사주 보러 왔구나. 요즘 뭐가 제일 궁금해?</div>
          </div>
        )}
        {phase >= 2 && (
          <div className="welcome-screen__msg-row msg-in">
            <div className="welcome-screen__msg-avatar-slot welcome-screen__msg-avatar-slot--hidden" />
            <div className="welcome-screen__bubble">
              너 얘기 좀 해봐.
              <br />
              내가 사주 한번 봐줄게.
            </div>
          </div>
        )}
      </div>

      {phase >= 3 && (
        <button onClick={onStart} className="welcome-screen__cta slide-up">
          내 사주 이야기 시작하기
        </button>
      )}
    </div>
  );
}
