// apps/web/src/components/BirthSelectionResult.jsx
//
// §DATE_SELECTION SIGNAL ROOM 연결 — 실제 result_data(top1/top2to5/candidate_comparison/
// safety_disclosure)에 있는 필드만 렌더링한다. 백엔드가 제공하지 않는 정보를 프론트에서
// 추측해서 만들지 않는다(§2 원칙).
import { useEffect, useState } from 'react';
import * as api from '../api/client.js';

export function BirthSelectionResult({ analysisScopeId, header, onOpenChat }) {
  const [state, setState] = useState('loading'); // loading | ready | error
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;
    setState('loading');
    api.getBirthSelectionResult(analysisScopeId)
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
        <div className="subscreen__body"><p className="yf-loading">최적의 시간을 찾고 있어요...</p></div>
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

  return (
    <div className="subscreen">
      {header}
      <div className="subscreen__body">
        {data.top1 && (
          <div className="analysis-card">
            <p className="membership-screen__title">추천 1위</p>
            <p>{data.top1.date} {data.top1.time}</p>
            {data.top1.final_reason && <p className="membership-screen__desc">{data.top1.final_reason}</p>}
            {data.top1.strengths?.length > 0 && (
              <ul className="membership-screen__analysis-list">
                {data.top1.strengths.map((s, i) => <li key={i}>{s}</li>)}
              </ul>
            )}
          </div>
        )}

        {data.top2to5?.length > 0 && (
          <div className="analysis-card">
            <p className="membership-screen__title">다른 추천 후보</p>
            {data.top2to5.map((c) => (
              <div key={c.candidate_id} className="membership-screen__status">
                <p>{c.relative_rank}위 - {c.date} {c.time}</p>
                {c.how_it_differs_from_top1 && <p className="membership-screen__desc">{c.how_it_differs_from_top1}</p>}
              </div>
            ))}
          </div>
        )}

        {typeof data.total_candidates_considered === 'number' && (
          <p className="membership-screen__desc">전체 {data.total_candidates_considered}개 후보 중에서 비교한 결과입니다.</p>
        )}

        {data.safety_disclosure && (
          <div className="intake-error">{data.safety_disclosure}</div>
        )}

        {onOpenChat && (
          <button className="products-screen__buy-btn" onClick={onOpenChat}>이 결과에 대해 AI에게 더 물어보기</button>
        )}
      </div>
    </div>
  );
}
