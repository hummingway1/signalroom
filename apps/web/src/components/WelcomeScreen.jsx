// apps/web/src/components/WelcomeScreen.jsx
//
// §GlobalHeader/ContentArea 분리 — 실제로 발견한 버그: 이전엔 .welcome-screen 전체가
// justify-content:center인 하나의 flex 컨테이너였고, topbar(Home/뒤로가기)가 avatar/
// messages/CTA와 함께 "콘텐츠"로 취급되어 콘텐츠 양에 따라 전체가 수직 중앙 정렬되면서
// topbar 위치가 대구 캐릭터 위치에 종속되어 흔들렸다(메시지가 늘어나면 topbar가 아래로
// 밀림). GlobalHeader는 이제 ContentArea의 형제(sibling)이자 flex-shrink:0인 별도
// 레이아웃 레벨이고, 콘텐츠(avatar/messages/CTA)만 별도 ContentArea 안에서 중앙 정렬된다
// — .chat-screen/.subscreen이 이미 쓰던 것과 동일한 안정적 구조로 통일.
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
      {/* §GlobalHeader — ContentArea와 완전히 분리된 flex-shrink:0 형제 요소. 메시지/CTA가
          몇 개 늘어나든 이 영역의 위치/높이는 절대 변하지 않는다. */}
      <div className="welcome-screen__global-header">
        {onBack && <button className="chat-header__back" onClick={onBack} aria-label="뒤로가기">‹</button>}
        <p className="welcome-screen__eyebrow">{info.title}</p>
        {onHome && <button className="chat-header__home" onClick={onHome} aria-label="홈으로">⌂</button>}
      </div>

      {/* §ContentArea — 여기 안에서만 세로 중앙 정렬. avatar/messages/CTA가 늘어나도
          GlobalHeader에는 영향이 없다. */}
      <div className="welcome-screen__content">
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
    </div>
  );
}
