// apps/web/src/components/TypingIndicator.jsx
import { CharacterAvatar } from './CharacterAvatar.jsx';

export function TypingIndicator({ characterId }) {
  return (
    <div className="message-row message-row--character slide-up">
      <div className="message-row__avatar-slot">
        <CharacterAvatar characterId={characterId} size={32} />
      </div>
      <div className="bubble bubble--character bubble--typing" aria-label="입력 중">
        <span className="typing-dot t-dot" />
        <span className="typing-dot t-dot" />
        <span className="typing-dot t-dot" />
      </div>
    </div>
  );
}
