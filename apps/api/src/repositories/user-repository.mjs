// User entity. 실제 소셜 로그인(네이버/구글/카카오)은 각 플랫폼 개발자센터에서 발급받는 실제
// client ID/secret이 있어야 동작하므로, 이 프로젝트 코드만으로는 진짜로 구현할 수 없다 — 그런
// 척 가짜 버튼을 만들지 않는다. 대신 **닉네임 기반의 실제로 동작하는 경량 계정**을 만들고,
// 나중에 실제 OAuth 키가 주어지면 provider/provider_user_id 필드에 연결할 수 있도록 스키마를
// 미리 준비해뒀다.
import { randomUUID } from 'node:crypto';
import { storeFor } from './base.mjs';

const store = storeFor('users');

export async function createUser({ nickname, provider = 'nickname', providerUserId = null }) {
  const user = {
    id: randomUUID(),
    nickname,
    provider, // 'nickname' | 'google' | 'naver' | 'kakao' (뒤 3개는 실제 OAuth 키 연결 전까지는 미사용)
    provider_user_id: providerUserId,
    created_at: new Date().toISOString(),
  };
  return store.insert(user);
}

export async function getUser(id) {
  return store.find((u) => u.id === id);
}

export async function findUserByNickname(nickname) {
  const matches = await store.filter((u) => u.nickname === nickname);
  return matches[0] ?? null;
}
