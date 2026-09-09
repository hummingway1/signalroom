// apps/api/src/services/oauth-providers/kakao.mjs
//
// 공통 인터페이스(§STEP4): { buildAuthorizeUrl, exchangeCodeForToken, fetchProfile }.
// auth-service.mjs가 provider와 무관하게 이 세 함수만 호출한다 — 카카오/네이버/구글의 차이는
// 오직 이 파일 안에만 있어야 한다.
const AUTHORIZE_URL = 'https://kauth.kakao.com/oauth/authorize';
const TOKEN_URL = 'https://kauth.kakao.com/oauth/token';
const USER_INFO_URL = 'https://kapi.kakao.com/v2/user/me';

export const kakaoProvider = {
  name: 'kakao',

  buildAuthorizeUrl({ clientId, redirectUri, state }) {
    const params = new URLSearchParams({ client_id: clientId, redirect_uri: redirectUri, response_type: 'code', state });
    return `${AUTHORIZE_URL}?${params.toString()}`;
  },

  async exchangeCodeForToken({ clientId, clientSecret, redirectUri, code }) {
    const params = new URLSearchParams({ grant_type: 'authorization_code', client_id: clientId, redirect_uri: redirectUri, code });
    if (clientSecret) params.set('client_secret', clientSecret);
    const res = await fetch(TOKEN_URL, { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: params.toString() });
    const body = await res.json();
    if (!res.ok) throw new Error(`카카오 토큰 교환 실패: ${body.error_description ?? body.error ?? res.status}`);
    return body.access_token;
  },

  async fetchProfile(accessToken) {
    const res = await fetch(USER_INFO_URL, { headers: { Authorization: `Bearer ${accessToken}` } });
    const body = await res.json();
    if (!res.ok) throw new Error(`카카오 사용자 정보 조회 실패: ${body.msg ?? res.status}`);
    return {
      providerUserId: String(body.id),
      email: body.kakao_account?.email ?? null,
      nickname: body.kakao_account?.profile?.nickname ?? body.properties?.nickname ?? '카카오사용자',
    };
  },
};
