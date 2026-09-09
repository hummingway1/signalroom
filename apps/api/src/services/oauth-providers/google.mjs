// apps/api/src/services/oauth-providers/google.mjs
//
// 구글 로그인(OAuth 2.0 / OIDC) 어댑터. 문서: https://developers.google.com/identity/protocols/oauth2/web-server
const AUTHORIZE_URL = 'https://accounts.google.com/o/oauth2/v2/auth';
const TOKEN_URL = 'https://oauth2.googleapis.com/token';
const USER_INFO_URL = 'https://www.googleapis.com/oauth2/v3/userinfo';

export const googleProvider = {
  name: 'google',

  buildAuthorizeUrl({ clientId, redirectUri, state }) {
    const params = new URLSearchParams({
      client_id: clientId,
      redirect_uri: redirectUri,
      response_type: 'code',
      scope: 'openid email profile',
      state,
    });
    return `${AUTHORIZE_URL}?${params.toString()}`;
  },

  async exchangeCodeForToken({ clientId, clientSecret, redirectUri, code }) {
    const params = new URLSearchParams({ grant_type: 'authorization_code', client_id: clientId, client_secret: clientSecret, redirect_uri: redirectUri, code });
    const res = await fetch(TOKEN_URL, { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: params.toString() });
    const body = await res.json();
    if (!res.ok) throw new Error(`구글 토큰 교환 실패: ${body.error_description ?? body.error ?? res.status}`);
    return body.access_token;
  },

  async fetchProfile(accessToken) {
    const res = await fetch(USER_INFO_URL, { headers: { Authorization: `Bearer ${accessToken}` } });
    const body = await res.json();
    if (!res.ok) throw new Error(`구글 사용자 정보 조회 실패: ${body.error?.message ?? res.status}`);
    return {
      providerUserId: String(body.sub),
      email: body.email ?? null,
      nickname: body.name ?? '구글사용자',
    };
  },
};
