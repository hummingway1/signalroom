// tests/35-auth-step3-kakao-login.test.mjs
//
// STEP 3(카카오 로그인) 중 이 샌드박스에서 실제로 실행 가능한 부분만 테스트한다:
// - 비밀번호 해시(네트워크/DB 불필요, bcryptjs 순수 JS)
// - 카카오 authorize URL 빌더(순수 함수, 네트워크 호출 없음)
// - 세션 쿠키 옵션(상수 검증)
//
// 실제 Postgres 연결이 필요한 함수(findOrCreateUserByAuthAccount, createSession,
// getSessionUser 등)와 실제 카카오 토큰 교환/사용자 정보 조회(handleKakaoCallback)는 이
// 환경에 DATABASE_URL도 카카오 API 접근도 없어서 테스트할 수 없다 — 로컬에서 실제 Supabase
// DATABASE_URL과 카카오 REST API 키로 별도 검증이 필요하다(보고서에 명시).
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { hashPassword, verifyPassword } from '../packages/shared/password-hash.mjs';
import { buildKakaoAuthorizeUrl } from '../apps/api/src/services/auth-service.mjs';
import { SESSION_COOKIE_NAME, SESSION_COOKIE_OPTIONS } from '../apps/api/src/middleware/session.mjs';

test('A1: 비밀번호 해시 후 원문으로 검증 성공', async () => {
  const hash = await hashPassword('my-secret-password-123');
  assert.ok(hash.length > 0);
  assert.notEqual(hash, 'my-secret-password-123', '해시가 원문 그대로면 안 됨');
  const ok = await verifyPassword('my-secret-password-123', hash);
  assert.equal(ok, true);
});

test('A2: 틀린 비밀번호는 검증 실패', async () => {
  const hash = await hashPassword('correct-password');
  const ok = await verifyPassword('wrong-password', hash);
  assert.equal(ok, false);
});

test('A3: 같은 비밀번호를 두 번 해시해도 매번 다른 값(salt 적용 확인)', async () => {
  const hash1 = await hashPassword('same-password');
  const hash2 = await hashPassword('same-password');
  assert.notEqual(hash1, hash2, 'salt가 적용되면 매번 다른 해시가 나와야 함');
  assert.equal(await verifyPassword('same-password', hash1), true);
  assert.equal(await verifyPassword('same-password', hash2), true);
});

test('B1: 카카오 authorize URL이 필수 파라미터를 전부 포함한다', () => {
  const url = buildKakaoAuthorizeUrl({ clientId: 'test-client-id', redirectUri: 'http://localhost:3000/api/auth/kakao/callback', state: 'abc123' });
  assert.ok(url.startsWith('https://kauth.kakao.com/oauth/authorize?'));
  const parsed = new URL(url);
  assert.equal(parsed.searchParams.get('client_id'), 'test-client-id');
  assert.equal(parsed.searchParams.get('redirect_uri'), 'http://localhost:3000/api/auth/kakao/callback');
  assert.equal(parsed.searchParams.get('response_type'), 'code');
  assert.equal(parsed.searchParams.get('state'), 'abc123');
});

test('B2: state 값이 다르면 URL도 다르다(CSRF 토큰이 실제로 반영되는지)', () => {
  const url1 = buildKakaoAuthorizeUrl({ clientId: 'c', redirectUri: 'http://x', state: 'state-1' });
  const url2 = buildKakaoAuthorizeUrl({ clientId: 'c', redirectUri: 'http://x', state: 'state-2' });
  assert.notEqual(url1, url2);
});

test('C1: 세션 쿠키가 HttpOnly로 설정된다(§7 요구사항)', () => {
  assert.equal(SESSION_COOKIE_OPTIONS.httpOnly, true);
});

test('C2: 세션 쿠키가 SameSite=lax로 설정된다', () => {
  assert.equal(SESSION_COOKIE_OPTIONS.sameSite, 'lax');
});

test('C3: 세션 쿠키 이름이 정의되어 있다', () => {
  assert.equal(typeof SESSION_COOKIE_NAME, 'string');
  assert.ok(SESSION_COOKIE_NAME.length > 0);
});
