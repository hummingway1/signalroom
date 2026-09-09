// apps/web/src/components/YearlyFortuneResult.jsx
//
// §Phase9 Frontend §10 — 실제 result_data에 있는 필드만 렌더링한다. 없는 필드는 어색하게
// "데이터 없음"으로 표시하지 않고 자연스럽게 숨긴다. 운세 내용을 프론트에서 만들어내지 않는다
// — 전부 서버 응답 그대로.
import { useEffect, useState } from 'react';
import * as api from '../api/client.js';

const MONTH_LABEL = (m) => `${String(m).padStart(2, '0')}월`;

export function YearlyFortuneResult({ analysisScopeId, scopes, targetName, year, header, onUpgrade, onOpenChat }) {
  const [state, setState] = useState('loading'); // loading | ready | error
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);

  const hasChat = scopes.some((s) => s.tier === 'detail');
  const chatScope = scopes.find((s) => s.tier === 'detail');

  useEffect(() => {
    let cancelled = false;
    setState('loading');
    api.getYearlyFortuneResult(analysisScopeId)
      .then(({ resultData }) => {
        if (cancelled) return;
        setData(resultData);
        setState('ready');
      })
      .catch((err) => {
        if (cancelled) return;
        setError(err.message ?? '결과를 불러오지 못했어요.');
        setState('error');
      });
    return () => { cancelled = true; };
  }, [analysisScopeId]);

  if (state === 'loading') {
    return (
      <div className="subscreen">
        {header}
        <div className="subscreen__body"><p className="yf-loading">{year}년의 흐름을 분석하고 있어요...</p></div>
      </div>
    );
  }

  if (state === 'error') {
    return (
      <div className="subscreen">
        {header}
        <div className="subscreen__body"><div className="intake-error">{error}</div></div>
      </div>
    );
  }

  const isDetail = data.tier === 'detail';
  const chatExpired = hasChat && chatScope?.expires_at && new Date(chatScope.expires_at) < new Date();
  const chatQuotaLeft = chatScope?.remaining_quantity;

  return (
    <div className="subscreen">
      {header}
      <div className="subscreen__body">
        <p className="yf-result__eyebrow">{targetName} · {year}년 신년운세 · {isDetail ? 'CHAT' : 'BASIC'}</p>

        {data.summary && (
          <div className="yf-result__summary-card fade-up">
            <p className="yf-result__summary-title">{year}년 한눈에 보기</p>
            <p className="yf-result__summary-text">{data.summary}</p>
            {data.keywords?.length > 0 && (
              <div className="yf-result__keywords">
                {data.keywords.map((k) => <span key={k} className="yf-result__keyword-chip">{k}</span>)}
              </div>
            )}
          </div>
        )}

        {[
          ['overall', '전체 총운'], ['finance', '재물운'], ['career', '직업/사업운'],
          ['relationship', '인간관계'], ['love', '연애/부부운'], ['health', '건강운'],
        ].map(([key, label]) => data[key] && (
          <div key={key} className="analysis-card">
            <div className="analysis-card__content">
              <p className="analysis-card__title">{label}</p>
              <p className="yf-result__section-text">{data[key]}</p>
            </div>
          </div>
        ))}

        {isDetail && data.chart_interaction && (
          <div className="analysis-card">
            <div className="analysis-card__content">
              <p className="analysis-card__title">원국과 {year}년의 상호작용</p>
              <p className="yf-result__section-text">{data.chart_interaction}</p>
            </div>
          </div>
        )}

        {data.monthly?.length > 0 && (
          <div className="yf-result__monthly">
            <p className="yf-result__section-heading">월별 흐름</p>
            {data.monthly.map((m) => (
              <div key={m.month} className="yf-result__month-row">
                <span className="yf-result__month-label">{MONTH_LABEL(m.month)}</span>
                <span className="yf-result__month-text">{m.text}</span>
              </div>
            ))}
          </div>
        )}

        {(data.important_periods?.length > 0 || data.caution_periods?.length > 0 || data.opportunity_periods?.length > 0) && (
          <div className="yf-result__periods">
            {data.important_periods?.length > 0 && <p><strong>중요한 시기</strong> {data.important_periods.join(', ')}</p>}
            {data.caution_periods?.length > 0 && <p><strong>주의할 시기</strong> {data.caution_periods.join(', ')}</p>}
            {data.opportunity_periods?.length > 0 && <p><strong>활용하기 좋은 시기</strong> {data.opportunity_periods.join(', ')}</p>}
          </div>
        )}

        {data.strategy && (
          <div className="analysis-card">
            <div className="analysis-card__content">
              <p className="analysis-card__title">종합 조언</p>
              <p className="yf-result__section-text">{data.strategy}</p>
            </div>
          </div>
        )}

        {!isDetail && (
          <div className="yf-upsell">
            <p className="yf-upsell__title">{year}년의 흐름을 더 깊이 알고 싶다면</p>
            <ul className="yf-product-card__list">
              <li>원국과 {year}년의 상호작용</li>
              <li>중요한 시기의 이유</li>
              <li>선택과 행동 전략</li>
              <li>AI에게 직접 질문</li>
            </ul>
            <button className="products-screen__buy-btn" onClick={onUpgrade}>AI에게 더 자세히 물어보기</button>
          </div>
        )}

        {isDetail && (
          <div className="yf-chat-entry">
            {!chatExpired ? (
              <>
                <p className="yf-chat-entry__quota">AI 질문 {chatQuotaLeft}회 남음 · {chatScope?.expires_at ? new Date(chatScope.expires_at).toLocaleDateString('ko-KR') : ''}까지</p>
                <button className="products-screen__buy-btn" onClick={onOpenChat}>이 운세에 대해 AI에게 질문하기</button>
              </>
            ) : (
              <>
                <p className="yf-chat-entry__quota">AI 채팅 이용기간이 종료되었어요. 분석 결과는 계속 볼 수 있어요.</p>
                <button className="products-screen__buy-btn" onClick={onUpgrade}>채팅 이용권 다시 구매</button>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
