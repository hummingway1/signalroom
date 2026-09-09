// apps/web/src/components/MembershipScreen.jsx
//
// SIGNAL ROOM MEMBERSHIP(명리 AI 대화 구독) 화면. 기존 API(listProducts/listEntitlements/
// createOrder)와 기존 Toss 결제 흐름(ProductsScreen.jsx와 동일 패턴)을 그대로 재사용한다 —
// 가격/quota/subscription_group을 프론트에 하드코딩하지 않고 서버 응답값만 표시한다.
import { useEffect, useState } from 'react';
import * as api from '../api/client.js';
import { TOSS_CLIENT_KEY } from '../config.js';

const MEMBERSHIP_PRODUCT_CODE = 'MINGRI_SUBSCRIPTION';

// 화면에 "이용 가능한 분석 범위"를 보여줄 때 쓰는 표시용 라벨(가격/quota 아님 — 순수 문구 매핑,
// 정책 값 자체는 전부 서버 응답을 그대로 씀).
const ANALYSIS_LABELS = {
  SAJU_DETAIL: '사주/자미두수 상세분석',
  YEARLY_FORTUNE_CHAT: '신년운세 상세분석',
};

function formatRemainingDays(expiresAt) {
  if (!expiresAt) return null;
  const diffMs = new Date(expiresAt).getTime() - Date.now();
  const days = Math.max(0, Math.ceil(diffMs / (1000 * 60 * 60 * 24)));
  return days;
}

export function MembershipScreen({ userId, onBack, onHome, onLogin }) {
  const [products, setProducts] = useState(null);
  const [entitlements, setEntitlements] = useState(null);
  const [error, setError] = useState(null);
  const [paying, setPaying] = useState(false);

  useEffect(() => {
    if (!userId) return;
    api.listProducts().then((r) => setProducts(r.products)).catch((err) => setError(err.message));
    api.listEntitlements().then((r) => setEntitlements(r.entitlements)).catch((err) => setError(err.message));
  }, [userId]);

  const membershipProduct = products?.find((p) => p.code === MEMBERSHIP_PRODUCT_CODE);
  // §authorization 원칙 그대로 — 여기서는 "권한 판정"을 하지 않는다. 실제 질문 가능 여부는
  // 서버의 기존 authorization 로직이 채팅 시점에 결정한다. 이 화면은 서버가 이미 발급한
  // entitlement 목록을 그대로 보여줄 뿐이다.
  const activeMembership = entitlements?.find(
    (e) => e.product_code === MEMBERSHIP_PRODUCT_CODE && e.remaining_quantity > 0 && (!e.expires_at || new Date(e.expires_at) > new Date())
  );
  const ownedDetailAnalyses = entitlements?.filter((e) => ANALYSIS_LABELS[e.product_code]) ?? [];

  async function handleBuy() {
    if (!membershipProduct) return;
    if (!TOSS_CLIENT_KEY) {
      setError('결제 기능이 아직 설정되지 않았어요. 잠시 후 다시 시도해주세요.');
      return;
    }
    if (!window.TossPayments) {
      setError('결제 모듈을 불러오지 못했어요. 새로고침 후 다시 시도해주세요.');
      return;
    }
    setPaying(true);
    setError(null);
    try {
      const { order } = await api.createOrder(membershipProduct.code);
      const tossPayments = window.TossPayments(TOSS_CLIENT_KEY);
      await tossPayments.requestPayment('카드', {
        amount: order.amount,
        orderId: order.id,
        orderName: order.order_name,
        successUrl: `${window.location.origin}/?payment=success`,
        failUrl: `${window.location.origin}/?payment=fail`,
      });
    } catch (err) {
      if (err?.code !== 'USER_CANCEL') setError('결제를 시작하지 못했어요. 다시 시도해주세요.');
      setPaying(false);
    }
  }

  return (
    <div className="subscreen membership-screen">
      <div className="subscreen__header membership-screen__header">
        <button onClick={onBack} className="chat-header__back" aria-label="뒤로가기">‹</button>
        <div><p className="subscreen__header-title">운명의 열쇠 · MEMBERSHIP</p></div>
        {onHome && <button className="subscreen__header-home" onClick={onHome} aria-label="홈으로">⌂</button>}
      </div>

      <div className="subscreen__body membership-screen__body">
        {error && <div className="intake-error">{error}</div>}

        {!userId && (
          <div className="membership-screen__login-gate">
            <p className="membership-screen__desc">로그인 후 이용할 수 있어요.</p>
            <button className="products-screen__buy-btn" onClick={onLogin}>로그인하기</button>
          </div>
        )}

        {userId && !products && !error && <p className="products-screen__loading">불러오는 중...</p>}

        {userId && membershipProduct && (
          <>
            <div className="membership-screen__intro">
              <p className="membership-screen__title">{membershipProduct.name}</p>
              <p className="membership-screen__desc">{membershipProduct.description}</p>
              <p className="membership-screen__price">{membershipProduct.price.toLocaleString()}원</p>
            </div>

            <div className="membership-screen__explain">
              <p className="membership-screen__explain-title">AI 상담은 구매한 상세분석을 바탕으로 진행됩니다.</p>
              <p className="membership-screen__explain-body">
                사주 상세분석을 구매했다면 사주 관련 질문을, 신년운세 상세분석을 구매했다면
                신년운세 관련 질문을 이어갈 수 있어요. 구매하지 않은 분석에 대해 질문하면
                해당 상세분석 구매가 필요하다는 안내를 받게 돼요.
              </p>
            </div>

            {activeMembership ? (
              <div className="membership-screen__status membership-screen__status--active">
                <p className="membership-screen__status-row">남은 질문 <strong>{activeMembership.remaining_quantity}회</strong></p>
                {activeMembership.expires_at && (
                  <p className="membership-screen__status-row">이용 가능 기간 <strong>{formatRemainingDays(activeMembership.expires_at)}일 남음</strong></p>
                )}
                <p className="membership-screen__status-label">이용 가능한 분석 범위</p>
                {ownedDetailAnalyses.length > 0 ? (
                  <ul className="membership-screen__analysis-list">
                    {ownedDetailAnalyses.map((e) => (
                      <li key={e.id}>{ANALYSIS_LABELS[e.product_code]}</li>
                    ))}
                  </ul>
                ) : (
                  <p className="membership-screen__desc">아직 구매한 상세분석이 없어요. 사주/신년운세 상세분석을 먼저 구매하면 이 멤버십으로 AI에게 질문할 수 있어요.</p>
                )}
              </div>
            ) : (
              <button className="products-screen__buy-btn membership-screen__buy-btn" onClick={handleBuy} disabled={paying}>
                {paying ? '이동 중...' : '구매하기'}
              </button>
            )}
          </>
        )}
      </div>
    </div>
  );
}
