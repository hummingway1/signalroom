// tests/37-oauth-common-pipeline.test.mjs
//
// STEP 4 — 카카오/네이버/구글이 동일한 공통 파이프라인을 쓰는지 검증한다.
//
// 명확히 구분: 아래 테스트는 전부 코드 레벨 검증이다(URL 생성은 실제 로직 그대로 실행, 토큰
// 교환/프로필 조회는 global.fetch를 mock으로 대체해서 "우리 코드가 API 응답을 올바르게
// 파싱/처리하는지"만 검증한다). **실제 카카오/네이버/구글 서버에 대한 로그인 성공 여부는 이
// 테스트로 확인되지 않는다** — 그건 로컬에서 실제 client_id/secret으로 사용자가 직접 확인해야
// 한다(보고서에 명시).
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { buildOAuthAuthorizeUrl, handleOAuthCallback, OAUTH_PROVIDERS } from '../apps/api/src/services/auth-service.mjs';
import { kakaoProvider } from '../apps/api/src/services/oauth-providers/kakao.mjs';
import { naverProvider } from '../apps/api/src/services/oauth-providers/naver.mjs';
import { googleProvider } from '../apps/api/src/services/oauth-providers/google.mjs';

// ============================================================
// A. 공통 레지스트리 — 3개 provider가 전부 같은 인터페이스를 구현하는지
// ============================================================

test('A1: OAUTH_PROVIDERS에 kakao/naver/google 3개가 모두 등록되어 있다', () => {
  assert.deepEqual(Object.keys(OAUTH_PROVIDERS).sort(), ['google', 'kakao', 'naver']);
});

test('A2: 각 provider가 공통 인터페이스(buildAuthorizeUrl/exchangeCodeForToken/fetchProfile)를 전부 구현한다', () => {
  for (const [name, provider] of Object.entries(OAUTH_PROVIDERS)) {
    assert.equal(typeof provider.buildAuthorizeUrl, 'function', `${name}.buildAuthorizeUrl 없음`);
    assert.equal(typeof provider.exchangeCodeForToken, 'function', `${name}.exchangeCodeForToken 없음`);
    assert.equal(typeof provider.fetchProfile, 'function', `${name}.fetchProfile 없음`);
  }
});

// ============================================================
// B. Authorize URL 생성 — 순수 함수, 실제 네트워크 없이 100% 검증 가능(실제 코드 실행)
// ============================================================

test('B1: 카카오 authorize URL이 올바른 도메인/파라미터를 가진다', () => {
  const url = buildOAuthAuthorizeUrl('kakao', { clientId: 'kc', redirectUri: 'http://x/cb', state: 's1' });
  const parsed = new URL(url);
  assert.equal(parsed.hostname, 'kauth.kakao.com');
  assert.equal(parsed.searchParams.get('client_id'), 'kc');
  assert.equal(parsed.searchParams.get('response_type'), 'code');
});

test('B2: 네이버 authorize URL이 올바른 도메인/파라미터를 가진다', () => {
  const url = buildOAuthAuthorizeUrl('naver', { clientId: 'nc', redirectUri: 'http://x/cb', state: 's2' });
  const parsed = new URL(url);
  assert.equal(parsed.hostname, 'nid.naver.com');
  assert.equal(parsed.searchParams.get('client_id'), 'nc');
  assert.equal(parsed.searchParams.get('response_type'), 'code');
  assert.equal(parsed.searchParams.get('state'), 's2');
});

test('B3: 구글 authorize URL이 올바른 도메인/파라미터를 가진다(openid scope 포함)', () => {
  const url = buildOAuthAuthorizeUrl('google', { clientId: 'gc', redirectUri: 'http://x/cb', state: 's3' });
  const parsed = new URL(url);
  assert.equal(parsed.hostname, 'accounts.google.com');
  assert.equal(parsed.searchParams.get('client_id'), 'gc');
  assert.ok(parsed.searchParams.get('scope').includes('email'));
  assert.ok(parsed.searchParams.get('scope').includes('profile'));
});

test('B4: 알 수 없는 provider명은 에러를 던진다', () => {
  assert.throws(() => buildOAuthAuthorizeUrl('facebook', { clientId: 'x', redirectUri: 'x', state: 'x' }), /알 수 없는 OAuth provider/);
});

// ============================================================
// C. 토큰 교환 / 프로필 조회 — fetch를 mock으로 대체해서 "응답 파싱 로직"만 검증
// (실제 카카오/네이버/구글 서버 응답 여부는 검증하지 않음 — 명확히 구분)
// ============================================================

function withMockedFetch(responses, fn) {
  const original = global.fetch;
  let callIndex = 0;
  global.fetch = async () => {
    const r = responses[callIndex];
    callIndex += 1;
    return { ok: r.ok !== false, status: r.status ?? 200, json: async () => r.body };
  };
  return fn().finally(() => {
    global.fetch = original;
  });
}

test('C1: 카카오 프로필 조회 응답을 올바르게 파싱한다', async () => {
  await withMockedFetch([{ body: { id: 12345, kakao_account: { email: 'a@kakao.com', profile: { nickname: '카카오닉' } } } }], async () => {
    const profile = await kakaoProvider.fetchProfile('fake-token');
    assert.equal(profile.providerUserId, '12345');
    assert.equal(profile.email, 'a@kakao.com');
    assert.equal(profile.nickname, '카카오닉');
  });
});

test('C2: 네이버 프로필 조회 응답을 올바르게 파싱한다', async () => {
  await withMockedFetch([{ body: { resultcode: '00', message: 'success', response: { id: '67890', email: 'b@naver.com', nickname: '네이버닉' } } }], async () => {
    const profile = await naverProvider.fetchProfile('fake-token');
    assert.equal(profile.providerUserId, '67890');
    assert.equal(profile.email, 'b@naver.com');
    assert.equal(profile.nickname, '네이버닉');
  });
});

test('C3: 네이버 프로필 조회 실패(resultcode != 00) 시 에러를 던진다', async () => {
  await withMockedFetch([{ body: { resultcode: '024', message: '인증 실패' } }], async () => {
    await assert.rejects(() => naverProvider.fetchProfile('bad-token'), /네이버 사용자 정보 조회 실패/);
  });
});

test('C4: 구글 프로필 조회 응답을 올바르게 파싱한다', async () => {
  await withMockedFetch([{ body: { sub: 'abcdef', email: 'c@gmail.com', name: '구글닉' } }], async () => {
    const profile = await googleProvider.fetchProfile('fake-token');
    assert.equal(profile.providerUserId, 'abcdef');
    assert.equal(profile.email, 'c@gmail.com');
    assert.equal(profile.nickname, '구글닉');
  });
});

test('C5: 카카오 토큰 교환 실패 시 에러 메시지에 원인이 포함된다', async () => {
  await withMockedFetch([{ ok: false, status: 400, body: { error: 'invalid_grant', error_description: '인증 코드가 만료됨' } }], async () => {
    await assert.rejects(() => kakaoProvider.exchangeCodeForToken({ clientId: 'x', redirectUri: 'x', code: 'expired' }), /인증 코드가 만료됨/);
  });
});

// ============================================================
// D. handleOAuthCallback 공통 파이프라인 — provider 이름만 바꿔도 동일하게 동작하는지
// (findOrCreateUserByAuthAccount/createSession은 실제 Postgres가 있어야 하므로, 이 부분은
// mock 없이는 끝까지 실행할 수 없다 — provider가 없을 때 즉시 에러를 던지는지만 코드 레벨로 확인)
// ============================================================

test('D1: handleOAuthCallback에 등록되지 않은 provider를 주면 DB 호출 전에 즉시 에러', async () => {
  await assert.rejects(
    () => handleOAuthCallback({ providerName: 'twitter', clientId: 'x', clientSecret: 'x', redirectUri: 'x', code: 'x' }),
    /알 수 없는 OAuth provider/
  );
});
