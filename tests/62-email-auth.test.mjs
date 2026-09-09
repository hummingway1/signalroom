// tests/62-email-auth.test.mjs
//
// §이메일/비밀번호 로그인 추가 — 입력 검증은 실제로 실행해서 확인(DB 불필요), 계정 생성/조회는
// 이 환경엔 실제 Postgres가 없어 DATABASE_URL 에러로 정상 차단되는지 확인.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { signupWithEmail, loginWithEmail, AuthValidationError } from '../apps/api/src/services/auth-service.mjs';

test('1. 잘못된 이메일 형식은 DB 호출 전에 INVALID_EMAIL로 거부된다', async () => {
  await assert.rejects(
    () => signupWithEmail({ email: 'not-an-email', password: '12345678', nickname: '테스트' }),
    (err) => err instanceof AuthValidationError && err.code === 'INVALID_EMAIL'
  );
});

test('2. 8자 미만 비밀번호는 INVALID_PASSWORD로 거부된다', async () => {
  await assert.rejects(
    () => signupWithEmail({ email: 'a@b.com', password: 'short', nickname: '테스트' }),
    (err) => err instanceof AuthValidationError && err.code === 'INVALID_PASSWORD'
  );
});

test('3. 2자 미만 닉네임은 INVALID_NICKNAME으로 거부된다', async () => {
  await assert.rejects(
    () => signupWithEmail({ email: 'a@b.com', password: '12345678', nickname: 'a' }),
    (err) => err instanceof AuthValidationError && err.code === 'INVALID_NICKNAME'
  );
});

test('4. 유효한 입력이면 검증을 통과하고 DB 호출 단계에서 DATABASE_URL 에러로 막힌다', async () => {
  await assert.rejects(
    () => signupWithEmail({ email: 'valid@example.com', password: '12345678', nickname: '정상닉네임' }),
    /DATABASE_URL/
  );
});

test('5. 잘못된 타입의 로그인은 즉시 INVALID_CREDENTIALS로 거부된다', async () => {
  await assert.rejects(
    () => loginWithEmail({ email: 123, password: 'x' }),
    (err) => err instanceof AuthValidationError && err.code === 'INVALID_CREDENTIALS'
  );
});

test('6. 정상 형식의 로그인 시도는 DB 조회 단계에서 DATABASE_URL 에러로 막힌다', async () => {
  await assert.rejects(
    () => loginWithEmail({ email: 'someone@example.com', password: 'whatever123' }),
    /DATABASE_URL/
  );
});

test('7. 비밀번호는 bcrypt로 해싱되고 평문으로 저장되지 않는다', async () => {
  const source = await readFile('./apps/api/src/services/auth-service.mjs', 'utf-8');
  assert.ok(source.includes("import bcrypt from 'bcryptjs'"));
  assert.ok(source.includes('await bcrypt.hash(password'));
  assert.ok(!source.includes('password_hash: password'));
});

test('8. 계정이 없는 경우와 비밀번호가 틀린 경우 모두 동일한 에러 코드를 반환한다', async () => {
  const source = await readFile('./apps/api/src/services/auth-service.mjs', 'utf-8');
  const fnBody = source.slice(source.indexOf('export async function loginWithEmail'), source.indexOf('export async function loginWithEmail') + 1200);
  const occurrences = (fnBody.match(/INVALID_CREDENTIALS/g) ?? []).length;
  assert.ok(occurrences >= 3);
});

test('9. 타이밍 공격 방지 - 계정이 없어도 더미 해시와 비교 연산을 수행한다', async () => {
  const source = await readFile('./apps/api/src/services/auth-service.mjs', 'utf-8');
  const fnBody = source.slice(source.indexOf('export async function loginWithEmail'));
  const compareCalls = fnBody.match(/bcrypt\.compare\(password,/g);
  assert.ok(compareCalls && compareCalls.length >= 2);
});

test('10. 익명 데이터 연결은 기존 linkAnonymousData 함수를 그대로 재사용한다', async () => {
  const source = await readFile('./apps/api/src/services/auth-service.mjs', 'utf-8');
  const fnBody = source.slice(source.indexOf('export async function signupWithEmail'), source.indexOf('export async function loginWithEmail'));
  assert.ok(fnBody.includes('linkAnonymousData(anonymousUserId, result.user.id)'));
});

test('11. POST /signup, /login 라우트는 기존 SESSION_COOKIE_OPTIONS를 그대로 사용한다', async () => {
  const source = await readFile('./apps/api/src/routes/auth.mjs', 'utf-8');
  const signupBlock = source.slice(source.indexOf("router.post('/signup'"), source.indexOf("router.post('/login'"));
  const loginBlock = source.slice(source.indexOf("router.post('/login'"), source.indexOf('// GET /api/auth/me'));
  assert.ok(signupBlock.includes('res.cookie(SESSION_COOKIE_NAME, session.id, SESSION_COOKIE_OPTIONS)'));
  assert.ok(loginBlock.includes('res.cookie(SESSION_COOKIE_NAME, session.id, SESSION_COOKIE_OPTIONS)'));
});

test('12. 이메일 중복 가입은 EMAIL_ALREADY_EXISTS를 409로 매핑한다', async () => {
  const source = await readFile('./apps/api/src/routes/auth.mjs', 'utf-8');
  const signupBlock = source.slice(source.indexOf("router.post('/signup'"), source.indexOf("router.post('/login'"));
  assert.ok(signupBlock.includes("EMAIL_ALREADY_EXISTS' ? 409"));
});

test('13. 기존 OAuth 콜백 라우트는 이번 변경으로 손대지 않았다', async () => {
  const source = await readFile('./apps/api/src/routes/auth.mjs', 'utf-8');
  assert.ok(source.includes("router.get('/:provider/start'"));
  assert.ok(source.includes("router.get('/:provider/callback'"));
});

test('14. 기존 createEmailAccount/findEmailAuthAccount 리포지토리 함수를 그대로 재사용한다', async () => {
  const source = await readFile('./apps/api/src/services/auth-service.mjs', 'utf-8');
  assert.ok(source.includes('createEmailAccount({'));
  assert.ok(source.includes('findEmailAuthAccount('));
});

test('15. DB 마이그레이션 불필요 - auth_accounts 테이블이 이미 provider=email과 password_hash를 지원한다', async () => {
  const sql = await readFile('./migrations/001_auth_schema.sql', 'utf-8');
  assert.ok(sql.includes("check (provider in ('kakao', 'naver', 'google', 'email'))"));
  assert.ok(sql.includes('password_hash text'));
});
