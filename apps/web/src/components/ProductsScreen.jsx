// apps/web/src/components/ProductsScreen.jsx
//
// 상품 목록 → 선택 시 서버에 주문 생성 → Toss 결제창 호출. Toss SDK는 index.html의 공식 CDN
// 스크립트(https://js.tosspayments.com/v1/payment)로 이미 로드되어 window.TossPayments로 접근.
import { useEffect, useState } from 'react';
import * as api from '../api/client.js';
import { TOSS_CLIENT_KEY } from '../config.js';

export function ProductsScreen({ onBack, onHome }) {
  const [products, setProducts] = useState(null);
  const [error, setError] = useState(null);
  const [payingCode, setPayingCode] = useState(null);

  useEffect(() => {
    api.listProducts().then((r) => setProducts(r.products)).catch((err) => setError(err.message));
  }, []);

  async function handleBuy(product) {
    if (!TOSS_CLIENT_KEY) {
      setError('결제 기능이 아직 설정되지 않았어요. 잠시 후 다시 시도해주세요.');
      return;
    }
    if (!window.TossPayments) {
      setError('결제 모듈을 불러오지 못했어요. 새로고침 후 다시 시도해주세요.');
      return;
    }
    setPayingCode(product.code);
    setError(null);
    try {
      const { order } = await api.createOrder(product.code);
      const tossPayments = window.TossPayments(TOSS_CLIENT_KEY);
      await tossPayments.requestPayment('카드', {
        amount: order.amount,
        orderId: order.id,
        orderName: order.order_name,
        successUrl: `${window.location.origin}/?payment=success`,
        failUrl: `${window.location.origin}/?payment=fail`,
      });
      // requestPayment는 결제창으로 리다이렉트하므로 이 아래 코드는 정상 흐름에서 실행되지 않음.
    } catch (err) {
      // 사용자가 결제창을 닫은 경우(취소)도 여기로 온다 — 에러로 취급하지 않는다.
      if (err?.code !== 'USER_CANCEL') setError('결제를 시작하지 못했어요. 다시 시도해주세요.');
      setPayingCode(null);
    }
  }

  return (
    <div className="subscreen">
      <div className="subscreen__header">
        <button onClick={onBack} className="chat-header__back" aria-label="뒤로가기">‹</button>
        <div><p className="subscreen__header-title">상품 안내</p></div>
        {onHome && <button className="subscreen__header-home" onClick={onHome} aria-label="홈으로">⌂</button>}
      </div>
      <div className="subscreen__body">
        {error && <div className="intake-error">{error}</div>}
        {!products && !error && <p className="products-screen__loading">불러오는 중...</p>}
        <div className="products-screen__list">
          {products?.map((p) => (
            <div key={p.code} className="products-screen__card">
              <div className="products-screen__card-info">
                <p className="products-screen__card-name">{p.name}</p>
                <p className="products-screen__card-desc">{p.description}</p>
              </div>
              <div className="products-screen__card-buy">
                <p className="products-screen__card-price">{p.price.toLocaleString()}원</p>
                <button className="products-screen__buy-btn" onClick={() => handleBuy(p)} disabled={payingCode === p.code}>
                  {payingCode === p.code ? '이동 중...' : '구매하기'}
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
