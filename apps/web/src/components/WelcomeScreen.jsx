// apps/web/src/components/WelcomeScreen.jsx
//
// §SERVICE_CATALOG 도입 — 이전엔 "아이시그널"이라는 타이틀과 "사주 보러 왔구나..." 문구가
// 어떤 서비스를 선택했는지와 무관하게 항상 고정으로 표시되고 있었다(실제 브라우저 테스트로
// 발견된 버그). 이제 serviceId로 catalog를 조회해서 서비스별로 정확한 title/greeting을
// 보여준다. Figma 원본의 타이밍(phase 1: 0.6s, phase 2: 1.5s, phase 3: 2.6s)은 그대로 유지.
import { useEffect, useState } from 'react';
import { CharacterAvatar } from './CharacterAvatar.jsx';
import { getServiceCatalogEntry } from '../serviceCatalog.js';

export function WelcomeScreen({ serviceId, onStart, onBack, onHome }) {
  const [phase, setPhase] = useState(0);
  const info = getServiceCatalogEntry(serviceId);

  useEffect(() => {
    const timers = [
      setTimeout(() => setPhase(1), 600),
      setTimeout(() => setPhase(2), 1500),
      setTimeout(() => setPhase(3), 2600),
    ];
    return () => timers.forEach(clearTimeout);
  }, []);

  if (!info) return null;
  const npc = info.npc ?? 'daegu';

  return (
    <div className="welcome-screen">
      <div className="welcome-screen__topbar">
        {onBack && <button className="chat-header__back" onClick={onBack} aria-label="뒤로가기">‹</button>}
        <p className="welcome-screen__eyebrow">{info.title}</p>
        {onHome && <button className="chat-header__home" onClick={onHome} aria-label="홈으로">⌂</button>}
      </div>
      <div className="welcome-screen__avatar">
        <CharacterAvatar characterId={npc} size={96} />
      </div>

      <div className="welcome-screen__messages">
        {phase >= 1 && (
          <div className="welcome-screen__msg-row msg-in">
            <div className="welcome-screen__msg-avatar-slot">
              <CharacterAvatar characterId={npc} size={28} />
            </div>
            <div className="welcome-screen__bubble">{info.greeting}</div>
          </div>
        )}
        {phase >= 2 && (
          <div className="welcome-screen__msg-row msg-in">
            <div className="welcome-screen__msg-avatar-slot welcome-screen__msg-avatar-slot--hidden" />
            <div className="welcome-screen__bubble">{info.description}</div>
          </div>
        )}
      </div>

      {phase >= 3 && (
        <button onClick={onStart} className="welcome-screen__cta slide-up">
          {info.quickReplies?.[0]?.label ?? '시작하기'}
        </button>
      )}
    </div>
  );
}
