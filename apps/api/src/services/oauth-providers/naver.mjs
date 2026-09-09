// apps/api/src/services/oauth-providers/naver.mjs
//
// 네이버 로그인(OAuth 2.0) 어댑터. 공식 스펙: 인가 코드 발급 → 토큰 발급 → 프로필 조회.
// 문서: https://developers.naver.com/docs/login/api/api.md
const AUTHORIZE_URL = 'https://nid.naver.com/oauth2.0/authorize';
const TOKEN_URL = 'https://nid.naver.com/oauth2.0/token';
const USER_INFO_URL = 'https://openapi.naver.com/v1/nid/me';

export const naverProvider = {
  name: 'naver',

  buildAuthorizeUrl({ clientId, redirectUri, state }) {
    const params = new URLSearchParams({ response_type: 'code', client_id: clientId, redirect_uri: redirectUri, state });
    return `${AUTHORIZE_URL}?${params.toString()}`;
  },

  async exchangeCodeForToken({ clientId, clientSecret, redirectUri, code, state }) {
    // 네이버는 CSRF 방지를 위해 토큰 교환 시에도 state를 함께 검증한다(카카오/구글과의 차이점).
    const params = new URLSearchParams({ grant_type: 'authorization_code', client_id: clientId, client_secret: clientSecret, code, state, redirect_uri: redirectUri });
    const res = await fetch(`${TOKEN_URL}?${params.toString()}`, { method: 'GET' });
    const body = await res.json();
    if (!res.ok || body.error) throw new Error(`네이버 토큰 교환 실패: ${body.error_description ?? body.error ?? res.status}`);
    return body.access_token;
  },

  async fetchProfile(accessToken) {
    const res = await fetch(USER_INFO_URL, { headers: { Authorization: `Bearer ${accessToken}` } });
    const body = await res.json();
    if (!res.ok || body.resultcode !== '00') throw new Error(`네이버 사용자 정보 조회 실패: ${body.message ?? res.status}`);
    return {
      providerUserId: String(body.response.id),
      email: body.response.email ?? null,
      nickname: body.response.nickname ?? body.response.name ?? '네이버사용자',
    };
  },
};
