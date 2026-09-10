// apps/web/src/components/AnalysisChoiceScreen.jsx
//
// §ANALYSIS_ROUTER UX 확정안 — "추천 후 사용자 선택"(자동전환 아님).
import { RECOMMENDATION_COPY } from '../analysisRecommendation.js';

export function AnalysisChoiceScreen({ recommendation, onChoose, onBack }) {
  const copy = RECOMMENDATION_COPY[recommendation.recommendationReason];
  if (!copy) return null;

  return (
    <div className="subscreen">
      <div className="subscreen__header">
        {onBack && <button onClick={onBack} className="chat-header__back" aria-label="뒤로가기">‹</button>}
        <div><p className="subscreen__header-title">분석 방식 선택</p></div>
      </div>
      <div className="subscreen__body">
        <p className="service-intro__detail" style={{ whiteSpace: 'pre-line' }}>{copy.message}</p>
      </div>
      <div className="subscreen__footer">
        <button
          onClick={() => onChoose(recommendation.recommendedService)}
          className="subscreen__btn-full"
          style={{ background: 'var(--primary)', color: 'var(--primary-foreground)' }}
        >
          {copy.recommendedLabel}
        </button>
        <button
          onClick={() => onChoose(recommendation.requestedService)}
          className="subscreen__btn-secondary"
        >
          {copy.requestedLabel}
        </button>
      </div>
    </div>
  );
}
