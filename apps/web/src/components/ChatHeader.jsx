// apps/web/src/components/ChatHeader.jsx
import { CharacterAvatar } from './CharacterAvatar.jsx';
import { getCharacterAsset } from '../characterAssets.js';

export function ChatHeader({ character, onBack, onOpenMenu, onHome }) {
  if (!character) return <div className="chat-header chat-header--empty" />;
  const asset = getCharacterAsset(character.id);
  return (
    <header className="chat-header">
      {onBack && (
        <button className="chat-header__back" onClick={onBack} aria-label="뒤로가기">
          ‹
        </button>
      )}
      <CharacterAvatar characterId={character.id} size={42} />
      <div className="chat-header__info">
        <div className="chat-header__name">{character.displayName}</div>
        <div className="chat-header__status">{asset.statusText}</div>
      </div>
      {onHome && (
        <button className="chat-header__home" onClick={onHome} aria-label="홈으로">
          ⌂
        </button>
      )}
      {onOpenMenu && (
        <div className="chat-header__menu">
          <button className="chat-header__menu-btn" onClick={onOpenMenu} aria-label="더보기 메뉴">
            ☰
          </button>
        </div>
      )}
    </header>
  );
}
