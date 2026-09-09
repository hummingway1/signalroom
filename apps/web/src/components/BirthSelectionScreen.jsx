// apps/web/src/components/BirthSelectionScreen.jsx
//
// 출생일 택일 조건 입력 + 구매. 기존 BirthDataForm(성별/도시 입력 스타일)과
// YearlyFortuneScreen(구매/Toss 결제 패턴)을 그대로 재사용한다 — 새 결제 로직 없음.
import { useState } from 'react';
import * as api from '../api/client.js';
import { TOSS_CLIENT_KEY } from '../config.js';

export function BirthSelectionScreen({ onBack, onHome }) {
  const [step, setStep] = useState('input'); // input | product
  const [gender, setGender] = useState('female');
  const [city, setCity] = useState('');
  const [dateRangeStart, setDateRangeStart] = useState('');
  const [dateRangeEnd, setDateRangeEnd] = useState('');
  const [timeRangeStart, setTimeRangeStart] = useState('09:00');
  const [timeRangeEnd, setTimeRangeEnd] = useState('18:00');
  const [error, setError] = useState(null);
  const [buying, setBuying] = useState(false);
  const [product, setProduct] = useState(null);

  const canSubmit = city.trim().length > 0 && dateRangeStart && dateRangeEnd && timeRangeStart && timeRangeEnd;

  async function proceedToProduct() {
    setError(null);
    try {
      const { products } = await api.listProducts();
      const found = products?.find((p) => p.code === 'DATE_SELECTION');
      if (!found) {
        setError('상품 정보를 불러오지 못했어요.');
        return;
      }
      setProduct(found);
      setStep('product');
    } catch (err) {
      setError(err.message ?? '불러오는 중 문제가 발생했어요.');
    }
  }

  async function buy() {
    setBuying(true);
    setError(null);
    try {
      if (!TOSS_CLIENT_KEY) throw new Error('결제 기능이 아직 설정되지 않았어요. 잠시 후 다시 시도해주세요.');
      const { order } = await api.createOrder({
        productCode: 'DATE_SELECTION',
        dateSelectionParams: { dateRangeStart, dateRangeEnd, timeRangeStart, timeRangeEnd, gender, city: city.trim() },
      });
      if (!window.TossPayments) throw new Error('결제 모듈을 불러오지 못했어요. 새로고침 후 다시 시도해주세요.');
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
      setBuying(false);
    }
  }

  const header = (
    <div className="subscreen__header">
      <button onClick={step === 'input' ? onBack : () => setStep('input')} className="chat-header__back" aria-label="뒤로가기">‹</button>
      <div><p className="subscreen__header-title">출생일 택일</p></div>
      {onHome && <button className="subscreen__header-home" onClick={onHome} aria-label="홈으로">⌂</button>}
    </div>
  );

  if (step === 'product') {
    return (
      <div className="subscreen">
        {header}
        <div className="subscreen__body">
          {error && <div className="intake-error">{error}</div>}
          <p className="membership-screen__title">{product?.name}</p>
          <p className="membership-screen__desc">{product?.description}</p>
          <p className="membership-screen__price">{product?.price?.toLocaleString()}원</p>
          <button className="products-screen__buy-btn" onClick={buy} disabled={buying}>
            {buying ? '이동 중...' : '구매하기'}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="subscreen">
      {header}
      <div className="subscreen__body">
        {error && <div className="intake-error">{error}</div>}
        <p className="yf-step-title">아이의 성별</p>
        <div className="birth-screen__gender-row">
          <button className={`birth-screen__radio${gender === 'female' ? ' birth-screen__radio--active' : ''}`} onClick={() => setGender('female')}>여자</button>
          <button className={`birth-screen__radio${gender === 'male' ? ' birth-screen__radio--active' : ''}`} onClick={() => setGender('male')}>남자</button>
        </div>

        <p className="yf-step-title">출생 예정일 범위</p>
        <input type="date" value={dateRangeStart} onChange={(e) => setDateRangeStart(e.target.value)} />
        <input type="date" value={dateRangeEnd} onChange={(e) => setDateRangeEnd(e.target.value)} />

        <p className="yf-step-title">희망 시간 범위</p>
        <input type="time" value={timeRangeStart} onChange={(e) => setTimeRangeStart(e.target.value)} />
        <input type="time" value={timeRangeEnd} onChange={(e) => setTimeRangeEnd(e.target.value)} />

        <p className="yf-step-title">출생 예정 도시</p>
        <input type="text" placeholder="예: Seoul" value={city} onChange={(e) => setCity(e.target.value)} />

        <button className="intake-submit" disabled={!canSubmit} onClick={proceedToProduct}>다음</button>
      </div>
    </div>
  );
}
