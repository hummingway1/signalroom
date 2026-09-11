// apps/web/src/api/client.js
//
// 백엔드 API의 얇은 래퍼. 프론트엔드는 여기서 나온 데이터를 그대로 화면에 반영할 뿐,
// 새로운 사주 판단이나 선택지를 만들어내지 않는다.

import { API_BASE_URL } from '../config.js';

async function request(path, options = {}) {
  const res = await fetch(`${API_BASE_URL}${path}`, {
    ...options,
    credentials: 'include', // 세션 쿠키(sid)를 요청에 포함시킨다 — 없으면 로그인 상태를 서버가 절대 인식 못함
    headers: { 'Content-Type': 'application/json', ...(options.headers ?? {}) },
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    const message = body?.error?.message ?? `요청이 실패했습니다 (${res.status})`;
    const err = new Error(message);
    err.status = res.status;
    err.code = body?.error?.code;
    throw err;
  }
  return body;
}

export function createChart({ birthDate, birthTime, gender, city, timezone }) {
  return request('/api/charts', { method: 'POST', body: JSON.stringify({ birthDate, birthTime, gender, city, timezone }) });
}

// 현재 세션 쿠키로 로그인된 사용자 정보를 조회한다. 비로그인이면 { user: null }을 반환한다.
export function getCurrentUser() {
  return request('/api/auth/me');
}

export function logout() {
  return request('/api/auth/logout', { method: 'POST' });
}

// 로그인한 본인의 닉네임을 변경한다.
export function updateNickname(nickname) {
  return request('/api/auth/nickname', { method: 'PATCH', body: JSON.stringify({ nickname }) });
}

export function startFirstQuestion(chartId, question, characterId, childProfileId) {
  return request(`/api/charts/${chartId}/questions`, { method: 'POST', body: JSON.stringify({ question, characterId, childProfileId }) });
}

export function createChildProfile({ userId, chartId, name }) {
  return request('/api/child-profiles', { method: 'POST', body: JSON.stringify({ userId, chartId, name }) });
}

export function listChildProfiles(userId) {
  return request(`/api/child-profiles?userId=${encodeURIComponent(userId)}`);
}

export function generateChildAnalysis(childProfileId, userId, tier) {
  return request(`/api/child-profiles/${childProfileId}/analyses`, { method: 'POST', body: JSON.stringify({ userId, tier }) });
}

export function getOpeningChoices(conversationId) {
  return request(`/api/conversations/${conversationId}/opening-choices`);
}

export function pickCatalogChoice(conversationId, catalogId) {
  return request(`/api/conversations/${conversationId}/catalog-choice`, { method: 'POST', body: JSON.stringify({ catalogId }) });
}

export function sendMessage(conversationId, question) {
  return request(`/api/conversations/${conversationId}/messages`, { method: 'POST', body: JSON.stringify({ question }) });
}

// §Critical Flow — 로그인/회원가입 성공 직후, birth 확인, 무료 캠페인 claim.
export function resumeAfterAuth(conversationId, userId) {
  return request(`/api/conversations/${conversationId}/resume-after-auth`, { method: 'POST', body: JSON.stringify({ userId }) });
}

export function confirmBirth(conversationId, userId, chartId, confirmed) {
  return request(`/api/conversations/${conversationId}/confirm-birth`, { method: 'POST', body: JSON.stringify({ userId, chartId, confirmed }) });
}

export function claimFreeTrial(conversationId, userId) {
  return request(`/api/conversations/${conversationId}/claim-free-trial`, { method: 'POST', body: JSON.stringify({ userId }) });
}

export function getConversationHistory(conversationId) {
  return request(`/api/conversations/${conversationId}`);
}

export function getChildOpeningChoices(conversationId) {
  return request(`/api/conversations/${conversationId}/child-opening-choices`);
}

export function pickChildCatalogChoice(conversationId, catalogId) {
  return request(`/api/conversations/${conversationId}/child-catalog-choice`, { method: 'POST', body: JSON.stringify({ catalogId }) });
}

export function signUpWithNickname(nickname) {
  return request('/api/users', { method: 'POST', body: JSON.stringify({ nickname }) });
}

// §이메일/비밀번호 회원가입/로그인 — 기존 OAuth와 동일한 세션 쿠키 체계를 그대로 사용한다
// (signUpWithNickname의 localStorage 기반 경량 계정과는 별개의, requireAuth가 적용되는
// 정식 인증 경로).
export function signupWithEmail({ email, password, nickname, anonymousUserId }) {
  return request('/api/auth/signup', { method: 'POST', body: JSON.stringify({ email, password, nickname, anonymousUserId }) });
}

export function loginWithEmail({ email, password }) {
  return request('/api/auth/login', { method: 'POST', body: JSON.stringify({ email, password }) });
}

export function generateRanking(category, chartId, userId) {
  return request(`/api/ranking/${category}`, { method: 'POST', body: JSON.stringify({ chartId, userId }) });
}

export function getLeaderboard(category) {
  return request(`/api/ranking/${category}/leaderboard`);
}

export function getCompatibility(chartIdA, chartIdB) {
  return request('/api/compatibility', { method: 'POST', body: JSON.stringify({ chartIdA, chartIdB }) });
}

// === 결제 ===
export function listProducts() {
  return request('/api/products');
}

export function createOrder(productCodeOrOptions) {
  const body = typeof productCodeOrOptions === 'string' ? { productCode: productCodeOrOptions } : productCodeOrOptions;
  return request('/api/orders', { method: 'POST', body: JSON.stringify(body) });
}

export function confirmPayment({ orderId, paymentKey, amount }) {
  return request('/api/payments/confirm', { method: 'POST', body: JSON.stringify({ orderId, paymentKey, amount }) });
}

export function listEntitlements() {
  return request('/api/payments/entitlements');
}

// 신년운세 결과 조회/최초 생성(재조회 시 LLM 재호출 없음, 서버가 캐시된 결과 반환)
export function getYearlyFortuneResult(analysisScopeId) {
  return request(`/api/yearly-fortune/${analysisScopeId}`);
}

// 특정 대상(본인 chartId 또는 자녀 childProfileId)+연도로 이미 구매한 신년운세가 있는지 확인
export function lookupYearlyFortune({ chartId, childProfileId, fortuneYear }) {
  const params = new URLSearchParams();
  if (chartId) params.set('chartId', chartId);
  if (childProfileId) params.set('childProfileId', childProfileId);
  params.set('fortuneYear', fortuneYear);
  return request(`/api/yearly-fortune/lookup?${params.toString()}`);
}

export function startYearlyFortuneChat(analysisScopeId) {
  return request(`/api/yearly-fortune/${analysisScopeId}/chat`, { method: 'POST' });
}

// 출생일 택일 결과 조회/최초 생성(재조회 시 LLM 재호출 없음, 서버가 캐시된 결과 반환)
export function getBirthSelectionResult(analysisScopeId) {
  return request(`/api/birth-selection/${analysisScopeId}`);
}

export function startBirthSelectionChat(analysisScopeId) {
  return request(`/api/birth-selection/${analysisScopeId}/chat`, { method: 'POST' });
}
