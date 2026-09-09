// apps/web/src/components/ChatScreen.jsx
import { MessageList } from './MessageList.jsx';
import { QuickReplyChips } from './QuickReplyChips.jsx';
import { ChatInput } from './ChatInput.jsx';
import { ChatHeader } from './ChatHeader.jsx';

export function ChatScreen({ chat, onOpenDetail, onOpenMenu, onHome }) {
  const { messages, character, choices, isTyping, error, pickChoice, sendFreeText, retryLast } = chat;

  return (
    <div className="chat-screen">
      <ChatHeader character={character} onOpenMenu={onOpenMenu} onHome={onHome} />
      <MessageList messages={messages} isTyping={isTyping} currentCharacterId={character?.id} onOpenDetail={onOpenDetail} />
      {error && (
        <div className="error-banner">
          <span>{error}</span>
          <button onClick={retryLast}>닫기</button>
        </div>
      )}
      <QuickReplyChips choices={choices} onPick={pickChoice} disabled={isTyping} />
      <ChatInput characterId={character?.id} onSend={sendFreeText} />
    </div>
  );
}
