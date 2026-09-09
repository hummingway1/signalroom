// apps/api/src/services/entitlement-authorization-service.mjs
//
// Phase 3 §3/§4 핵심 — 클라이언트가 보낸 entitlementId는 authorization 근거로 절대 쓰지 않는다.
// 서버가 (userId, 필요한 analysis_type들)만으로 유효한 entitlement를 직접 찾는다.
import { ANALYSIS_TYPES } from '../../../../packages/shared/analysis-types.mjs';
import {
  findActiveEntitlementByAnalysisType,
  findActiveYearlyFortuneChatEntitlement,
  findActiveEntitlementByAnalysisScopeId,
  findActiveSubscriptionQuota,
} from '../repositories/payment-repository.mjs';
import { mapRouterCategoriesToAnalysisTypes } from './analysis-domain-mapper.mjs';

// §22 UX 원칙 — "권한이 없습니다"가 아니라 왜 안 되는지, 어떤 상품을 이용하면 되는지 안내한다.
const FRIENDLY_NAME_BY_ANALYSIS_TYPE = {
  SAJU_DETAIL: '사주/자미두수 상세분석',
  ZIWEI_DETAIL: '자미두수 상세분석',
  YEARLY_FORTUNE: '신년운세 상세분석',
  CHILD_DETAIL: '아이 성장 코치 상세분석',
  RELATIONSHIP_DETAIL: '궁합 상세분석',
  DATE_SELECTION: '출산일시 택일',
  NAMING: '작명',
};

// §Phase6 §7/§9/§11 — 구독은 이 도메인 그룹에 속한 analysis_type들의 "질문 횟수"만 보충한다.
// RELATIONSHIP_DETAIL은 의도적으로 어디에도 속하지 않는다(궁합은 명리/아이시그널과 완전히 분리).
const SUBSCRIPTION_GROUP_FOR_ANALYSIS_TYPE = {
  [ANALYSIS_TYPES.SAJU_DETAIL]: 'MINGRI',
  [ANALYSIS_TYPES.ZIWEI_DETAIL]: 'MINGRI',
  [ANALYSIS_TYPES.YEARLY_FORTUNE]: 'MINGRI',
  [ANALYSIS_TYPES.CHILD_DETAIL]: 'CHILD_SIGNAL',
};

function buildDenialMessage(missingAnalysisType) {
  const name = FRIENDLY_NAME_BY_ANALYSIS_TYPE[missingAnalysisType] ?? missingAnalysisType;
  return `이 질문은 ${name}에 포함된 내용이에요. ${name}을 이용하면 이 내용에 대해 채팅으로 질문할 수 있어요.`;
}

/**
 * analysisType 하나에 대한 "access"(그 사용자가 실제로 이 analysis_type의 유효한 entitlement를
 * 갖고 있는가)를 확인한다. 구독은 여기서 절대 access를 만들어주지 않는다(§7/§31).
 */
async function findAccessEntitlement(userId, analysisType, { chartId, childProfileId, fortuneYear, dateSelectionScopeId }) {
  if (analysisType === ANALYSIS_TYPES.YEARLY_FORTUNE) {
    return findActiveYearlyFortuneChatEntitlement(userId, { chartId, childProfileId, fortuneYear });
  }
  if (analysisType === ANALYSIS_TYPES.DATE_SELECTION) {
    return findActiveEntitlementByAnalysisScopeId(userId, dateSelectionScopeId);
  }
  return findActiveEntitlementByAnalysisType(userId, analysisType);
}

/**
 * §Phase5/6 — 신년운세는 질문 텍스트나 Router category로 도메인을 판정하지 않는다. 대신
 * CHILD_DETAIL이 이미 쓰고 있는 것과 동일한 원칙 — "사용자가 어느 conversation(진입 경로)에
 * 있는가"로 구조적으로 결정한다(§Phase5 CHANGELOG 참고).
 *
 * §Phase6 §12~15 복합 질문 — fortune_year가 태깅된 대화 안에서도, Router의 saju_fields가
 * annual_periods/major_periods "이외의" 일반 원국 필드(day_master, pillars 등)를 추가로
 * 요구하면 SAJU_DETAIL도 함께 필요하다고 판단한다(새 LLM 호출 없이 기존 Router 출력만 사용).
 *
 * §Phase6 §7~9 구독 — access(위에서 확인)가 전부 있어도, 그 entitlement 자체의 잔여 수량이
 * 0이면 같은 도메인 그�1룹의 구독 quota로 대체 가능한지 확인한다. 구독은 access를 만들지
 * 않고 오직 quota만 보충한다 — 그래서 access 확인이 실패하면(entitlement 자체가 아예 없음)
 * 구독이 있어도 즉시 거부한다.
 *
 * @returns {{ authorized: boolean, entitlementId?: string, message?: string, missingAnalysisType?: string }}
 */
export async function authorizeAnalysisQuestion({ userId, routerResult = {}, conversationContext = {} }) {
  const { fortuneYear, chartId, childProfileId, dateSelectionScopeId } = conversationContext;

  const requiredAnalysisTypes = [];
  if (fortuneYear) {
    requiredAnalysisTypes.push(ANALYSIS_TYPES.YEARLY_FORTUNE);
    const sajuFields = routerResult.saju_fields ?? [];
    const generalFieldsNeeded = sajuFields.some((f) => f !== 'annual_periods' && f !== 'major_periods');
    if (generalFieldsNeeded) requiredAnalysisTypes.push(ANALYSIS_TYPES.SAJU_DETAIL);
  } else if (dateSelectionScopeId) {
    // §출생일 택일 — fortuneYear와 동일한 원칙: 이 conversation이 어느 analysis_scope에
    // 태깅되어 있는가로 구조적으로 결정한다(질문 텍스트나 Router category로 판정하지 않음).
    requiredAnalysisTypes.push(ANALYSIS_TYPES.DATE_SELECTION);
  } else {
    requiredAnalysisTypes.push(...mapRouterCategoriesToAnalysisTypes(routerResult));
  }

  // §14 — 필요한 모든 analysis_type에 access가 있어야 한다. 하나라도 없으면 전체를 즉시 차단한다
  // (부분 답변 금지 — required scopes ⊆ owned scopes일 때만 진행).
  const matched = [];
  for (const analysisType of requiredAnalysisTypes) {
    const entitlement = await findAccessEntitlement(userId, analysisType, { chartId, childProfileId, fortuneYear, dateSelectionScopeId });
    if (!entitlement) {
      return { authorized: false, missingAnalysisType: analysisType, message: buildDenialMessage(analysisType) };
    }
    matched.push({ analysisType, entitlement });
  }

  // access는 전부 확인됐다. 이제 실제로 이번 질문에 소비할 quota를 찾는다 — 자기 entitlement에
  // 남은 게 있으면 그걸 쓰고, 없으면(0) 같은 도메인 그룹의 구독 quota로 대체한다.
  for (const { entitlement } of matched) {
    if (entitlement.remaining_quantity > 0) {
      return { authorized: true, entitlementId: entitlement.id };
    }
  }
  const subscriptionGroup = SUBSCRIPTION_GROUP_FOR_ANALYSIS_TYPE[requiredAnalysisTypes[0]];
  const subscription = subscriptionGroup ? await findActiveSubscriptionQuota(userId, subscriptionGroup) : null;
  if (subscription) {
    return { authorized: true, entitlementId: subscription.id };
  }

  return {
    authorized: false,
    missingAnalysisType: requiredAnalysisTypes[0],
    message: '이용 가능한 채팅 횟수가 없어요. 명리 구독을 이용하면 계속 질문할 수 있어요.',
  };
}
