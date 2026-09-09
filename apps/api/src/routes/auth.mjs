// apps/api/src/routes/auth.mjs
//
// STEP 3(카카오) → STEP 4(공통화). /:provider/start, /:provider/callback 라우트 하나로
// kakao/naver/google 전부 처리한다 — provider별 실제 차이는 auth-service.mjs가 provider
// 어댑터(oauth-providers/*.mjs)에 위임하고, 이 라우트 파일은 provider 이름과 무관하다.
import { Router } from 'express';
import { randomUUID } from 'node:crypto';
import { buildOAuthAuthorizeUrl, handleOAuthCallback, OAUTH_PROVIDERS, signupWithEmail, loginWithEmail, AuthValidationError } from '../services/auth-service.mjs';
import { deleteSession, updateNickname } from '../repositories/auth-repository.mjs';
import { SESSION_COOKIE_NAME, SESSION_COOKIE_OPTIONS, requireAuth } from '../middleware/session.mjs';

// provider별 환경변수 이름 규칙(예: KAKAO_CLIENT_ID, NAVER_CLIENT_ID, GOOGLE_CLIENT_ID) — 이
// 부분만 provider마다 다르고, 나머지 로직은 완전히 동일하다.
function envVarsFor(providerName) {
  const prefix = providerName.toUpperCase();
  return {
    clientId: process.env[`${prefix}_CLIENT_ID`],
    clientSecret: process.env[`${prefix}_CLIENT_SECRET`],
    redirectUri: process.env[`${prefix}_REDIRECT_URI`],
  };
}

export function authRouter({ frontendBaseUrl = 'http://localhost:5173' } = {}) {
  const router = Router();

  // GET /api/auth/:provider/start — 프론트는 이 URL로 그냥 이동(location.href)시키면 된다.
  router.get('/:provider/start', (req, res) => {
    const providerName = req.params.provider;
    if (!OAUTH_PROVIDERS[providerName]) {
      return res.status(404).json({ error: { code: 'UNKNOWN_PROVIDER', message: `지원하지 않는 로그인 방식: ${providerName}` } });
    }
    const { clientId, redirectUri } = envVarsFor(providerName);
    if (!clientId || !redirectUri) {
      return res.status(501).json({ error: { code: `${providerName.toUpperCase()}_NOT_CONFIGURED`, message: `${providerName.toUpperCase()}_CLIENT_ID/${providerName.toUpperCase()}_REDIRECT_URI가 설정되지 않았습니다.` } });
    }
    // CSRF 방지용 state — 익명 사용자 데이터 연결을 위해 현재 익명 userId도 state에 함께 실어
    // 보낸다(state는 provider가 콜백에 그대로 돌려주므로, 별도 서버 세션 저장 없이 왕복 가능).
    const anonymousUserId = typeof req.query.anonymousUserId === 'string' ? req.query.anonymousUserId : '';
    const csrfToken = randomUUID();
    const state = Buffer.from(JSON.stringify({ csrfToken, anonymousUserId })).toString('base64url');
    const url = buildOAuthAuthorizeUrl(providerName, { clientId, redirectUri, state });
    return res.redirect(url);
  });

  // GET /api/auth/:provider/callback — provider가 code와 state를 붙여서 호출.
  router.get('/:provider/callback', async (req, res) => {
    const providerName = req.params.provider;
    if (!OAUTH_PROVIDERS[providerName]) {
      return res.status(404).json({ error: { code: 'UNKNOWN_PROVIDER', message: `지원하지 않는 로그인 방식: ${providerName}` } });
    }
    const { code, state, error } = req.query;
    if (error) {
      return res.redirect(`${frontendBaseUrl}/?login_error=${encodeURIComponent(String(error))}`);
    }
    if (!code || typeof code !== 'string') {
      return res.status(400).json({ error: { code: 'INVALID_INPUT', message: 'code가 없습니다.' } });
    }
    let anonymousUserId = null;
    try {
      const decoded = JSON.parse(Buffer.from(String(state ?? ''), 'base64url').toString('utf-8'));
      anonymousUserId = decoded.anonymousUserId || null;
    } catch {
      // state 파싱 실패해도 로그인 자체는 계속 진행 — 익명 데이터 연결만 건너뛴다.
    }

    const { clientId, clientSecret, redirectUri } = envVarsFor(providerName);
    try {
      const { session, isNewUser } = await handleOAuthCallback({
        providerName,
        clientId,
        clientSecret,
        redirectUri,
        code,
        state,
        anonymousUserId,
      });
      res.cookie(SESSION_COOKIE_NAME, session.id, SESSION_COOKIE_OPTIONS);
      // isNewUser=1이면 프론트가 "닉네임을 직접 정할지" 물어보는 화면을 보여준다(신규 가입
      // 시에만, 재로그인 시에는 안 나옴) — 지금까지는 카카오/네이버/구글 기본 닉네임이 그대로
      // 서비스 닉네임이 돼서 사용자가 정할 기회가 없었다.
      return res.redirect(`${frontendBaseUrl}/?login=success${isNewUser ? '&new=1' : ''}`);
    } catch (err) {
      console.error(`[${providerName} 로그인 실패]`, err.message);
      return res.redirect(`${frontendBaseUrl}/?login_error=${providerName}_failed`);
    }
  });

  // POST /api/auth/signup — 이메일/비밀번호 회원가입. 인증정보(이메일/비밀번호)만 다루고,
  // 이름/성별/생년월일/출생시간 같은 서비스 프로필 정보는 여기서 받지 않는다(§역할 분리
  // 원칙) — 회원가입 성공 후 프론트가 기존 POST /api/charts로 별도 처리한다.
  router.post('/signup', async (req, res) => {
    const { email, password, nickname, anonymousUserId } = req.body ?? {};
    try {
      const { session, user, isNewUser } = await signupWithEmail({ email, password, nickname, anonymousUserId: typeof anonymousUserId === 'string' ? anonymousUserId : null });
      res.cookie(SESSION_COOKIE_NAME, session.id, SESSION_COOKIE_OPTIONS);
      return res.status(201).json({ user, isNewUser });
    } catch (err) {
      if (err instanceof AuthValidationError) {
        const status = err.code === 'EMAIL_ALREADY_EXISTS' ? 409 : 400;
        return res.status(status).json({ error: { code: err.code, message: err.message } });
      }
      console.error('[이메일 회원가입 실패]', err.message);
      return res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: '회원가입 중 문제가 발생했습니다.' } });
    }
  });

  // POST /api/auth/login — 이메일/비밀번호 로그인. 성공 시 기존 OAuth 로그인과 동일한
  // 세션/쿠키 체계를 그대로 사용한다(별도 인증 경로 아님).
  router.post('/login', async (req, res) => {
    const { email, password } = req.body ?? {};
    try {
      const { session, user } = await loginWithEmail({ email, password });
      res.cookie(SESSION_COOKIE_NAME, session.id, SESSION_COOKIE_OPTIONS);
      return res.json({ user });
    } catch (err) {
      if (err instanceof AuthValidationError) {
        return res.status(401).json({ error: { code: err.code, message: err.message } });
      }
      console.error('[이메일 로그인 실패]', err.message);
      return res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: '로그인 중 문제가 발생했습니다.' } });
    }
  });

  // GET /api/auth/me — 현재 로그인 상태 확인(프론트가 앱 시작 시 호출).
  router.get('/me', (req, res) => {
    if (!req.user) return res.json({ user: null });
    return res.json({ user: { id: req.user.id, nickname: req.user.nickname, email: req.user.email } });
  });

  // PATCH /api/auth/nickname — 로그인한 본인의 닉네임만 바꿀 수 있다. userId는 body가 아니라
  // 반드시 세션(req.user)에서만 가져온다 — 다른 사용자의 닉네임을 바꾸는 걸 원천 차단.
  router.patch('/nickname', requireAuth, async (req, res) => {
    const { nickname } = req.body ?? {};
    if (typeof nickname !== 'string' || nickname.trim().length < 2 || nickname.trim().length > 20) {
      return res.status(400).json({ error: { code: 'INVALID_INPUT', message: '닉네임은 2~20자여야 합니다.' } });
    }
    const updated = await updateNickname(req.user.id, nickname.trim());
    return res.json({ user: updated });
  });

  // POST /api/auth/logout
  router.post('/logout', async (req, res) => {
    const sid = req.cookies?.[SESSION_COOKIE_NAME];
    if (sid) {
      try {
        await deleteSession(sid);
      } catch {
        // 세션 삭제 실패해도 쿠키는 지워서 클라이언트 쪽에서는 로그아웃된 것처럼 처리
      }
    }
    res.clearCookie(SESSION_COOKIE_NAME, SESSION_COOKIE_OPTIONS);
    return res.json({ ok: true });
  });

  return router;
}
