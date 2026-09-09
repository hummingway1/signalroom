// apps/api/src/middleware/session.mjs
//
// §E/§L 설계 — HttpOnly+Secure+SameSite 쿠키 기반 세션. 기존 라우트가 클라이언트가 보낸 userId를
// 신뢰하던 방식(§L의 문제)을 대체하기 위한 새 인프라. 이번 STEP 3에서는 이 미들웨어와 카카오 로그인
// 라우트만 추가하고, 기존 라우트를 세션 기반으로 전환하는 작업(§K)은 이후 별도 STEP에서 진행한다
// (한 번에 다 바꾸면 기존 기능이 깨질 위험이 커서, 지시사항대로 단계적으로 진행).
import { getSessionUser } from '../repositories/auth-repository.mjs';

export const SESSION_COOKIE_NAME = 'sid';

export const SESSION_COOKIE_OPTIONS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production', // 로컬 http 개발 환경 고려 — 운영(https)에서만 secure 강제
  // §Toss 심사 준비 — 프론트(Vercel)와 백엔드가 서로 다른 도메인으로 배포되는 크로스도메인
  // 구조를 실제로 확인했다. SameSite=Lax는 top-level GET navigation(예: OAuth 콜백 리다이렉트)
  // 에는 쿠키를 보내지만, 그 이후 프론트 JS가 fetch()로 백엔드를 호출하는 크로스사이트 요청에는
  // 쿠키를 전송하지 않는다 — 즉 로그인 리다이렉트는 성공해도 로그인 이후 모든 API 호출이
  // 비로그인으로 처리되는 심각한 버그가 될 수 있었다(로컬 개발처럼 같은 origin이면 드러나지
  // 않는 문제). SameSite=None(+secure 필수, 이미 위에서 강제됨)으로 바꿔서 크로스도메인
  // fetch에서도 쿠키가 정상 전송되게 한다. CSRF는 기존 OAuth state 파라미터로 이미 방지되고
  // 있고, 세션 쿠키 자체는 여전히 httpOnly라 이 변경이 새로운 인증 취약점을 만들지 않는다.
  sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
  maxAge: 30 * 24 * 60 * 60 * 1000, // 30일, sessions.expires_at과 맞춘다
};

/** 세션이 있으면 req.user를 채우고, 없어도 통과시킨다(비로그인 익명 이용 허용 — 결정사항 §1). */
export function attachSession() {
  return async (req, res, next) => {
    const sid = req.cookies?.[SESSION_COOKIE_NAME];
    if (!sid) return next();
    try {
      const user = await getSessionUser(sid);
      if (user) req.user = user;
    } catch {
      // DB 연결 문제 등으로 세션 조회가 실패해도 비로그인 상태로 계속 진행시킨다(서비스 전체가
      // 죽지 않게) — 단, requireAuth가 걸린 라우트는 아래에서 별도로 차단된다.
    }
    next();
  };
}

/** 로그인이 반드시 필요한 라우트(결제 등)에 붙인다. */
export function requireAuth(req, res, next) {
  if (!req.user) {
    return res.status(401).json({ error: { code: 'AUTH_REQUIRED', message: '로그인이 필요합니다.' } });
  }
  next();
}
