// apps/web/src/components/YearlyFortuneScreen.jsx
//
// §Phase9 Frontend — 본인/자녀 선택 → 연도 선택 → 기존 구매 확인(lookup) → 상품선택 또는 결과.
// 권한 판정은 전부 서버가 한다(§25 "프론트에서 권한 판정하지 않는다") — 이 화면은 서버 응답을
// 그대로 보여주는 얇은 레이어일 뿐이다.
import { useEffect, useState } from 'react';
import * as api from '../api/client.js';
import { YearlyFortuneResult } from './YearlyFortuneResult.jsx';

const CURRENT_YEAR = new Date().getFullYear();
const AVAILABLE_YEARS = [CURRENT_YEAR, CURRENT_YEAR + 1]; // 서버 annual_periods가 실제 지원하는 범위(약 20년치)의 일부만 상품으로 노출 — 임의 확장하지 않음

export function YearlyFortuneScreen({ userId, chartId, onBack, onHome, onNeedBirthData, onOpenChat }) {
  const [step, setStep] = useState('target'); // target | year | loading | product | result
  const [childProfiles, setChildProfiles] = useState([]);
  const [target, setTarget] = useState(null); // { type: 'self', chartId } | { type: 'child', childProfileId, name }
  const [year, setYear] = useState(null);
  const [scopes, setScopes] = useState([]);
  const [error, setError] = useState(null);
  const [buying, setBuying] = useState(null); // 구매 진행 중인 productCode
  const [viewingScopeId, setViewingScopeId] = useState(null);

  useEffect(() => {
    if (userId) api.listChildProfiles(userId).then((r) => setChildProfiles(r.profiles ?? [])).catch(() => {});
  }, [userId]);

  function selectSelf() {
    if (!chartId) return onNeedBirthData?.();
    setTarget({ type: 'self', chartId, name: '나' });
    setStep('year');
  }

  function selectChild(profile) {
    setTarget({ type: 'child', childProfileId: profile.id, name: profile.name });
    setStep('year');
  }

  async function selectYear(y) {
    setYear(y);
    setStep('loading');
    setError(null);
    try {
      const { scopes: found } = await api.lookupYearlyFortune({
        chartId: target.type === 'self' ? target.chartId : undefined,
        childProfileId: target.type === 'child' ? target.childProfileId : undefined,
        fortuneYear: y,
      });
      setScopes(found);
      if (found.length > 0) {
        setViewingScopeId(found[0].id); // tier=detail 우선 정렬되어 있음(§lookup 쿼리)
        setStep('result');
      } else {
        setStep('product');
      }
    } catch (err) {
      setError(err.message ?? '확인 중 문제가 발생했어요.');
      setStep('product');
    }
  }

  async function buy(productCode) {
    setBuying(productCode);
    setError(null);
    try {
      const { order } = await api.createOrder({
        productCode,
        ...(target.type === 'self' ? { chartId: target.chartId } : { childProfileId: target.childProfileId }),
        fortuneYear: year,
      });
      if (!window.TossPayments) throw new Error('결제 모듈을 불러오지 못했어요. 새로고침 후 다시 시도해주세요.');
      const tossPayments = window.TossPayments(import.meta.env.VITE_TOSS_CLIENT_KEY ?? '');
      await tossPayments.requestPayment('카드', {
        amount: order.amount,
        orderId: order.id,
        orderName: order.order_name,
        successUrl: `${window.location.origin}/?payment=success`,
        failUrl: `${window.location.origin}/?payment=fail`,
      });
    } catch (err) {
      if (err?.code !== 'USER_CANCEL') setError('결제를 시작하지 못했어요. 다시 시도해주세요.');
      setBuying(null);
    }
  }

  const header = (
    <div className="subscreen__header">
      <button onClick={step === 'target' ? onBack : () => setStep(step === 'year' ? 'target' : 'year')} className="chat-header__back" aria-label="뒤로가기">‹</button>
      <div><p className="subscreen__header-title">신년운세</p></div>
      {onHome && <button className="subscreen__header-home" onClick={onHome} aria-label="홈으로">⌂</button>}
    </div>
  );

  if (step === 'target') {
    return (
      <div className="subscreen">
        {header}
        <div className="subscreen__body">
          <p className="yf-step-title">누구의 신년운세를 볼까요?</p>
          <button className="yf-target-card" onClick={selectSelf}>나의 신년운세</button>
          {childProfiles.map((p) => (
            <button key={p.id} className="yf-target-card" onClick={() => selectChild(p)}>{p.name} 신년운세</button>
          ))}
        </div>
      </div>
    );
  }

  if (step === 'year') {
    return (
      <div className="subscreen">
        {header}
        <div className="subscreen__body">
          <p className="yf-step-title">{target.name}의 몇 년도 운세를 볼까요?</p>
          {AVAILABLE_YEARS.map((y) => (
            <button key={y} className="yf-target-card" onClick={() => selectYear(y)}>{y}년</button>
          ))}
        </div>
      </div>
    );
  }

  if (step === 'loading') {
    return (
      <div className="subscreen">
        {header}
        <div className="subscreen__body"><p className="yf-loading">확인하는 중...</p></div>
      </div>
    );
  }

  if (step === 'product') {
    return (
      <div className="subscreen">
        {header}
        <div className="subscreen__body">
          {error && <div className="intake-error">{error}</div>}
          <p className="yf-step-title">{target.name}의 {year}년 신년운세</p>

          <div className="yf-product-card">
            <p className="yf-product-card__tier">BASIC</p>
            <p className="yf-product-card__price">990원</p>
            <ul className="yf-product-card__list">
              <li>{year}년 총운·재물운·직업운·인간관계·연애운·건강운</li>
              <li>월별 흐름 · 핵심 시기 · 종합 조언</li>
              <li>분석 결과 영구 열람</li>
            </ul>
            <button className="products-screen__buy-btn" onClick={() => buy('YEARLY_FORTUNE_BASIC')} disabled={buying === 'YEARLY_FORTUNE_BASIC'}>
              {buying === 'YEARLY_FORTUNE_BASIC' ? '이동 중...' : '990원으로 보기'}
            </button>
          </div>

          <div className="yf-product-card yf-product-card--highlight">
            <p className="yf-product-card__tier">CHAT</p>
            <p className="yf-product-card__price">4,900원</p>
            <p className="yf-product-card__includes">BASIC 전체 내용 포함</p>
            <ul className="yf-product-card__list">
              <li>원국과 {year}년의 상호작용</li>
              <li>월별 상세 분석 · 중요한 시기 상세 분석</li>
              <li>행동/선택 전략</li>
              <li>AI에게 직접 질문 50회 (30일)</li>
            </ul>
            <button className="products-screen__buy-btn" onClick={() => buy('YEARLY_FORTUNE_CHAT')} disabled={buying === 'YEARLY_FORTUNE_CHAT'}>
              {buying === 'YEARLY_FORTUNE_CHAT' ? '이동 중...' : '4,900원으로 상세 분석'}
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (step === 'result') {
    return (
      <YearlyFortuneResult
        analysisScopeId={viewingScopeId}
        scopes={scopes}
        targetName={target.name}
        year={year}
        header={header}
        onUpgrade={() => setStep('product')}
        onOpenChat={() => onOpenChat?.(viewingScopeId, target.type === 'self' ? target.chartId : null)}
      />
    );
  }

  return null;
}
