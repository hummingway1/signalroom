// apps/api/src/services/analysis-domain-mapper.mjs
//
// Phase 3 §5/§6/§7 — question-router가 이미 만드는 categories/saju_fields를 그대로 재사용해서
// "이 질문이 어떤 analysis_type 권한을 필요로 하는가"를 결정론적으로 판정한다. 새로운 LLM 호출을
// 추가하지 않는다(§13 절대 원칙) — Router는 어차피 파이프라인 1단계에서 항상 호출되므로, 그
// 결과를 재사용할 뿐이다.
//
// ⚠️ 발견된 정책 충돌(§14) — 지금 보고한다:
// question-router.md의 ANNUAL_PERIOD/MAJOR_PERIOD 카테고리(세운/대운)는 YEARLY_FORTUNE_DETAIL이
// 아니라 **같은 Chart(사주+자미두수 통합) 안의 annual_periods/major_periods 필드**를 가리킨다.
// YEARLY_FORTUNE_DETAIL은 아직 실제 상품/분석 파이프라인이 없다(Phase 5 예정, "1년 운영 분석"
// 이라는 훨씬 깊은 별도 데이터셋). 만약 지금 ANNUAL_PERIOD를 YEARLY_FORTUNE_DETAIL 요구로
// 매핑하면, SAJU_DETAIL만 산 기존 고객이 "2027년에는 어때?" 같은 이미 검증된 기능(시기 해석
// 품질 검증 라운드에서 3/3 PASS 확인됨)을 갑자기 못 쓰게 되는 회귀가 발생한다.
//
// 그래서 이번 Phase 3에서는: 사주 질문 파이프라인(askQuestion, saju_question intent)을 타는
// 모든 질문은 ANNUAL_PERIOD/MAJOR_PERIOD를 포함해 전부 SAJU_DETAIL 하나로 귀결시킨다. Phase 5에서
// YEARLY_FORTUNE_DETAIL이 실제로 "월운까지 포함한 1년 종합 운영 분석"이라는 별도 상품으로
// 출시되면, 그때 "단순 세운 조회"(SAJU_DETAIL 유지)와 "종합 신년운세"(YEARLY_FORTUNE_DETAIL 필요)
// 경계를 어디로 그을지 다시 결정해야 한다 — 지금 임의로 예단하지 않는다.
import { ANALYSIS_TYPES } from '../../../../packages/shared/analysis-types.mjs';

/**
 * @param {{categories?: string[]}} routerResult - question-router가 반환한 결과(이미 호출됨,
 *   추가 LLM 호출 없음).
 * @returns {string[]} 이 질문에 필요한 analysis_type 목록(현재는 항상 SAJU_DETAIL 하나 — 위 정책
 *   충돌 설명 참고).
 */
export function mapRouterCategoriesToAnalysisTypes(routerResult) {
  // 지금은 이 파이프라인(saju_question intent)에 들어온 시점에 이미 "사주/자미두수 상세 분석
  // 도메인"임이 확정된다 — categories 값과 무관하게 SAJU_DETAIL 하나로 귀결된다(위 정책 충돌
  // 설명 참고). categories 파라미터는 향후 YEARLY_FORTUNE_DETAIL이 분리될 때 실제로 분기하는
  // 지점으로 남겨둔다(지금 당장 분기 로직을 추측해서 만들지 않는다).
  void routerResult; // 현재 미사용 — 향후 확장 지점 표시
  return [ANALYSIS_TYPES.SAJU_DETAIL];
}
