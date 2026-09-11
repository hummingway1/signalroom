// apps/web/src/components/MessageBubbles.jsx
import { CharacterAvatar } from './CharacterAvatar.jsx';
import { AnalysisCard } from './AnalysisCard.jsx';
import { ProductSelectionCard, SignupCtaCard } from './ProductSelectionCard.jsx';

export function CharacterMessageBubble({ message, showAvatar, onOpenDetail, onSelectProduct, onSignup }) {
  return (
    <div className="message-row message-row--character msg-in">
      <div className="message-row__avatar-slot">{showAvatar && <CharacterAvatar characterId={message.character?.id} size={32} />}</div>
      <div className="message-row__content">
        {message.sectionTitle && <p className="message-row__section-title">{message.sectionTitle}</p>}
        {message.text && <div className="bubble bubble--character">{message.text}</div>}
        {message.card?.type === 'product_selection' && <ProductSelectionCard card={message.card} onSelectProduct={onSelectProduct} />}
        {message.card?.type === 'signup_cta' && <SignupCtaCard onSignup={onSignup} />}
        {message.card && !message.card.type && <AnalysisCard card={message.card} onOpenDetail={() => onOpenDetail?.(message)} />}
      </div>
    </div>
  );
}

export function UserMessageBubble({ message }) {
  return (
    <div className="message-row message-row--user msg-in">
      <div className="bubble bubble--user">{message.text}</div>
    </div>
  );
}

/** 캐릭터 전환 마커 — Figma MsgRow kind="marker" 그대로. 대구↔맹구 전환 시 대화 중간에
 * "─── OO가 이어받았어 ───" 형태의 구분선을 삽입한다 (useChatController가 캐릭터 변경을 감지해
 * 이 role의 메시지를 자동으로 끼워 넣음). */
export function CharacterSwitchMarker({ message }) {
  const characterName = message.character?.displayName ?? (message.character?.id === 'manggu' ? '맹구' : '대구');
  return (
    <div className="character-switch-marker msg-in">
      <div className="character-switch-marker__line" />
      <div className="character-switch-marker__label">
        <CharacterAvatar characterId={message.character?.id} size={16} />
        <span>{characterName}가 이어받았어</span>
      </div>
      <div className="character-switch-marker__line" />
    </div>
  );
}
