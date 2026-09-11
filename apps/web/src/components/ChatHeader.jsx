// apps/web/src/components/ChatHeader.jsx
//
// §ChatHeader 서비스명 위계 개선 — 이전엔 아바타 옆에 작은 글자(14px)로 서비스명/캐릭터명이
// 나란히 표시되어 "지금 어떤 서비스에 있는지"가 잘 안 보였다. 이제 서비스명을 헤더 중앙에
// 크고 명확하게, 캐릭터명은 그 아래 작은 보조 텍스트로 분리한다. Back/Home은 좌우 고정
// 영역 그대로 유지(§Home navigation 원칙과 무관, 위치만 그대로).
import { getCharacterAsset } from '../characterAssets.js';

export function ChatHeader({ character, serviceTitle, onBack, onOpenMenu, onHome }) {
  if (!character) return <div className="chat-header chat-header--empty" />;
  const asset = getCharacterAsset(character.id);
  return (
    <header className="chat-header chat-header--v2">
      <div className="chat-header__left">
        {onBack && (
          <button className="chat-header__back" onClick={onBack} aria-label="뒤로가기">
            ‹
          </button>
        )}
      </div>
      <div className="chat-header__center">
        <div className="chat-header__title">{serviceTitle ?? character.displayName}</div>
        <div className="chat-header__subtitle">{serviceTitle ? character.displayName : asset.statusText}</div>
      </div>
      <div className="chat-header__right">
        {onHome && (
          <button className="chat-header__home" onClick={onHome} aria-label="홈으로">
            ⌂
          </button>
        )}
        {onOpenMenu && (
          <button className="chat-header__menu-btn" onClick={onOpenMenu} aria-label="더보기 메뉴">
            ☰
          </button>
        )}
      </div>
    </header>
  );
}
