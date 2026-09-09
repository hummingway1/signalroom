// tests/61-cross-domain-session-cookie.test.mjs
//
// §Toss 심사 테스트 계정 준비 — 실제로 발견한 크로스도메인 세션 쿠키 버그의 회귀 테스트.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

process.env.NODE_ENV = 'production';
const { SESSION_COOKIE_OPTIONS } = await import('../apps/api/src/middleware/session.mjs?v=1');

test('1. 프로덕션에서는 sameSite가 none이다(크로스도메인 fetch에서도 쿠키 전송되도록)', () => {
  assert.equal(SESSION_COOKIE_OPTIONS.sameSite, 'none');
});

test('2. sameSite=none일 때 secure도 반드시 true다', () => {
  assert.equal(SESSION_COOKIE_OPTIONS.secure, true);
});

test('3. 개발 환경에서는 여전히 lax를 유지한다', async () => {
  const originalEnv = process.env.NODE_ENV;
  process.env.NODE_ENV = 'development';
  const { SESSION_COOKIE_OPTIONS: devOptions } = await import('../apps/api/src/middleware/session.mjs?v=2');
  assert.equal(devOptions.sameSite, 'lax');
  assert.equal(devOptions.secure, false);
  process.env.NODE_ENV = originalEnv;
});

test('4. 로그아웃 시 clearCookie가 SESSION_COOKIE_OPTIONS를 그대로 전달한다', async () => {
  const source = await readFile('./apps/api/src/routes/auth.mjs', 'utf-8');
  assert.ok(source.includes('res.clearCookie(SESSION_COOKIE_NAME, SESSION_COOKIE_OPTIONS)'));
});
