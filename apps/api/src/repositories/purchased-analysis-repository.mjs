// PurchasedAnalysis entity — 결제된(이번 단계는 결제 미구현이라 purchase_id는 항상 null) 심층 분석
// 결과의 불변 저장소. 이름을 기존 analysis-repository.mjs(질문-답변 로그, 목적이 다름)와 명확히
// 구분하기 위해 purchased_analyses로 명명했다.
//
// 원칙: immutable. update 함수를 의도적으로 만들지 않는다 — 코드 구조 자체로 "수정 불가"를 보장한다.
// 엔진 버전이 바뀌어도 과거에 저장된 analysis_json은 절대 재생성/덮어쓰기하지 않는다.
import { randomUUID } from 'node:crypto';
import { storeFor } from './base.mjs';

const store = storeFor('purchased_analyses');

export async function createPurchasedAnalysis({ userId, childId = null, productType, purchaseId = null, canonicalChartVersion, analysisEngineVersion, analysisJson, tier = 'basic' }) {
  const record = {
    id: randomUUID(),
    user_id: userId,
    child_id: childId,
    product_type: productType,
    tier, // 'basic'(무료 1회) | 'full'(유료, §12) — 계산 결과 자체는 동일 파이프라인, 상품 구분만
    purchase_id: purchaseId,
    canonical_chart_version: canonicalChartVersion,
    analysis_engine_version: analysisEngineVersion,
    analysis_json: analysisJson,
    created_at: new Date().toISOString(),
  };
  return store.insert(record);
  // 의도적으로 update()/delete() 함수를 export하지 않는다 — immutable 원칙을 코드 구조로 강제.
}

export async function getPurchasedAnalysis(id) {
  return store.find((a) => a.id === id);
}

export async function listPurchasedAnalysesForChild(childId) {
  return store.filter((a) => a.child_id === childId);
}

export async function listPurchasedAnalysesForUser(userId) {
  return store.filter((a) => a.user_id === userId);
}

/**
 * §STEP3-fix(익명→회원 데이터 승계) 전용 예외. 위의 "update()/delete() 미제공" 원칙은 여전히
 * 유효하다 — analysis_json/tier/product_type 등 분석 결과 자체는 이 함수로도 절대 바꿀 수 없다.
 * 오직 user_id 재할당(계정 소유권 이전)만 허용하는 좁은 예외이며, 반드시
 * apps/api/src/services/auth-service.mjs의 linkAnonymousData()를 통해서만 호출되어야 한다.
 * 실패 시 호출자가 되돌릴 수 있도록 이전 user_id를 함께 반환한다.
 */
export async function reassignOwnerForAccountLinking(analysisId, newUserId) {
  const record = await getPurchasedAnalysis(analysisId);
  if (!record) return null;
  const previousUserId = record.user_id;
  const updated = await store.update(analysisId, { user_id: newUserId });
  return { updated, previousUserId };
}

/**
 * §11 — 사용자 ID당 무료 기본 사주 1회 제한(서버 측 강제, 프론트 버튼 숨김만으로 대체하지 않음).
 * 결제 시스템이 아직 없으므로 "이 사용자가 child_growth 분석을 이미 한 번이라도 받았는가"로 판정한다.
 */
export async function hasUsedFreeChildAnalysis(userId) {
  const matches = await store.filter((a) => a.user_id === userId && a.product_type === 'child_growth' && a.tier === 'basic');
  return matches.length > 0;
}
