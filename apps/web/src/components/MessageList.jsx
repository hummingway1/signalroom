// apps/web/src/components/MessageList.jsx
import { useEffect, useRef, useState } from 'react';
import { CharacterMessageBubble, UserMessageBubble, CharacterSwitchMarker } from './MessageBubbles.jsx';
import { TypingIndicator } from './TypingIndicator.jsx';
import { ChatBackground } from './ChatBackground.jsx';

const NEAR_BOTTOM_THRESHOLD_PX = 120;

export function MessageList({ messages, isTyping, currentCharacterId, onOpenDetail, onSelectProduct, onSignup }) {
  const scrollRef = useRef(null);
  const [showJumpToLatest, setShowJumpToLatest] = useState(false);
  const wasNearBottomRef = useRef(true);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    if (wasNearBottomRef.current) {
      el.scrollTop = el.scrollHeight;
      setShowJumpToLatest(false);
    } else {
      setShowJumpToLatest(true);
    }
  }, [messages, isTyping]);

  function handleScroll() {
    const el = scrollRef.current;
    if (!el) return;
    const distanceFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
    wasNearBottomRef.current = distanceFromBottom < NEAR_BOTTOM_THRESHOLD_PX;
    if (wasNearBottomRef.current) setShowJumpToLatest(false);
  }

  function jumpToLatest() {
    const el = scrollRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
    setShowJumpToLatest(false);
    wasNearBottomRef.current = true;
  }

  return (
    <div className="message-list-wrapper">
      <ChatBackground />
      <div className="message-list" ref={scrollRef} onScroll={handleScroll}>
        {messages.map((message, i) => {
          if (message.role === 'marker') return <CharacterSwitchMarker key={message.id} message={message} />;
          if (message.role === 'user') return <UserMessageBubble key={message.id} message={message} />;
          const prev = messages[i - 1];
          const showAvatar = !prev || prev.role !== 'character' || prev.character?.id !== message.character?.id;
          return <CharacterMessageBubble key={message.id} message={message} showAvatar={showAvatar} onOpenDetail={onOpenDetail} onSelectProduct={onSelectProduct} onSignup={onSignup} />;
        })}
        {isTyping && <TypingIndicator characterId={currentCharacterId} />}
      </div>
      {showJumpToLatest && (
        <button className="jump-to-latest" onClick={jumpToLatest}>
          새 메시지 ↓
        </button>
      )}
    </div>
  );
}
