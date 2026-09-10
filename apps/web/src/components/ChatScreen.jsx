// apps/web/src/components/ChatScreen.jsx
import { MessageList } from './MessageList.jsx';
import { QuickReplyChips } from './QuickReplyChips.jsx';
import { ChatInput } from './ChatInput.jsx';
import { ChatHeader } from './ChatHeader.jsx';

export function ChatScreen({ chat, onOpenDetail, onOpenMenu, onHome, onNeedLogin, onNeedPurchase }) {
  const { messages, character, choices, isTyping, error, purchaseRequired, pickChoice, sendFreeText, retryLast, dismissPurchaseRequired } = chat;

  function handlePurchaseCtaClick() {
    dismissPurchaseRequired();
    if (purchaseRequired.loginRequired) {
      onNeedLogin?.();
    } else if (purchaseRequired.productCode) {
      onNeedPurchase?.(purchaseRequired.productCode);
    }
  }

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
      {/* §실제 상품 플로우 연결 — 이전엔 authorization이 거부돼도 안내 문구만 뜨고 사용자가 결제
          화면으로 갈 방법이 전혀 없었다(실제 브라우저 테스트로 발견된 핵심 문제). 이제 서버가
          내려준 구조화된 신호(purchaseRequired)로 실제 CTA 버튼을 보여준다. */}
      {purchaseRequired && (purchaseRequired.loginRequired || purchaseRequired.productCode) && (
        <div className="purchase-cta-banner">
          <button onClick={handlePurchaseCtaClick}>
            {purchaseRequired.loginRequired ? '로그인하기' : '상세분석 보러가기'}
          </button>
        </div>
      )}
      <QuickReplyChips choices={choices} onPick={pickChoice} disabled={isTyping} />
      <ChatInput characterId={character?.id} onSend={sendFreeText} />
    </div>
  );
}
