// apps/web/src/components/ChatScreen.jsx
import { MessageList } from './MessageList.jsx';
import { QuickReplyChips } from './QuickReplyChips.jsx';
import { ChatInput } from './ChatInput.jsx';
import { ChatHeader } from './ChatHeader.jsx';
import { getServiceCatalogEntry } from '../serviceCatalog.js';

export function ChatScreen({ chat, userId, onOpenDetail, onOpenMenu, onHome, onNeedLogin, onNeedPurchase, onOpenBirthForm }) {
  const { messages, character, choices, isTyping, error, purchaseRequired, serviceId, pickChoice, sendFreeText, retryLast, dismissPurchaseRequired, confirmBirth, claimFreeTrialAction } = chat;
  const serviceTitle = getServiceCatalogEntry(serviceId)?.title ?? null;

  // §중복 CTA 제거(실측 버그 수정) — 마지막 메시지에 이미 구조화된 카드(product_selection/
  // signup_cta)가 붙어있으면, 그 카드 자체가 실제 액션 버튼을 갖고 있으므로 fallback
  // 배너("로그인하기"/"상세분석 보러가기")는 숨긴다. 카드가 없는 경우(예: authorization
  // 거부로 productCode만 오고 카드는 안 만들어진 기존 경로)에는 배너가 정상 작동해야
  // 하므로, 카드 유무로만 판단하고 배너 자체를 없애지는 않는다.
  const lastMessage = messages[messages.length - 1];
  const lastMessageHasCard = lastMessage?.card?.type === 'product_selection' || lastMessage?.card?.type === 'signup_cta';
  const showPurchaseBanner = purchaseRequired && (purchaseRequired.loginRequired || purchaseRequired.productCode) && !lastMessageHasCard;

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
      <ChatHeader character={character} serviceTitle={serviceTitle} onOpenMenu={onOpenMenu} onHome={onHome} />
      <MessageList
        messages={messages}
        isTyping={isTyping}
        currentCharacterId={character?.id}
        onOpenDetail={onOpenDetail}
        onSelectProduct={(code) => onNeedPurchase?.(code)}
        onSignup={() => onNeedLogin?.()}
        onConfirmBirth={(chartId, confirmed) => confirmBirth(userId, chartId, confirmed)}
        onOpenBirthForm={() => onOpenBirthForm?.()}
        onClaimFreeTrial={() => claimFreeTrialAction(userId)}
      />
      {error && (
        <div className="error-banner">
          <span>{error}</span>
          <button onClick={retryLast}>닫기</button>
        </div>
      )}
      {showPurchaseBanner && (
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
