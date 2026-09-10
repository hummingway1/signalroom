// apps/web/src/analysisRecommendation.js
//
// §ANALYSIS_ROUTER(추천 전용, 자동전환 아님) — SERVICE_CATALOG와 완전히 분리된 순수 함수.
// birth data(timeKnown)만 보고 "추천"을 반환할 뿐, 최종 분석 방식은 항상 사용자가 직접
// 선택한다(requiresUserChoice가 true이면 반드시 선택 UI를 거쳐야 함).
export function getAnalysisRecommendation({ requestedServiceId, timeKnown }) {
  if (requestedServiceId === 'jami') {
    return { requestedService: 'jami', recommendedService: 'jami', recommendationReason: null, requiresUserChoice: false };
  }
  if (requestedServiceId === 'saju' && timeKnown === true) {
    return { requestedService: 'saju', recommendedService: 'jami', recommendationReason: 'birth_time_known', requiresUserChoice: true };
  }
  return { requestedService: requestedServiceId, recommendedService: requestedServiceId, recommendationReason: null, requiresUserChoice: false };
}

export const RECOMMENDATION_COPY = {
  birth_time_known: {
    message: '출생시간을 정확히 알고 있어요.\n시간 정보를 활용하는 자미두수 분석도 진행할 수 있어요.',
    recommendedLabel: '자미두수로 분석하기',
    requestedLabel: '사주로 분석하기',
  },
};
