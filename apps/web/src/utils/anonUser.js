// apps/web/src/utils/anonUser.js
//
// 자녀 성장 코치는 닉네임 가입을 강제하지 않지만, §11(사용자 ID당 무료 1회)을 서버가 추적하려면
// 어떤 형태로든 안정적인 userId가 필요하다. 이미 닉네임 가입한 사용자는 그 ID를 재사용하고,
// 없으면 브라우저에 익명 ID를 하나 만들어 localStorage에 고정한다(로그아웃/재설치 전까지 유지).
const NICKNAME_USER_ID_KEY = 'saju_nickname_user_id';
const ANON_USER_ID_KEY = 'saju_anon_user_id';

export function getOrCreateUserId() {
  const nicknameId = localStorage.getItem(NICKNAME_USER_ID_KEY);
  if (nicknameId) return nicknameId;

  let anonId = localStorage.getItem(ANON_USER_ID_KEY);
  if (!anonId) {
    anonId = `anon-${crypto.randomUUID()}`;
    localStorage.setItem(ANON_USER_ID_KEY, anonId);
  }
  return anonId;
}

/** 닉네임으로 로그인/가입한 사용자인지 판별한다 — 익명 사용자는 기기가 바뀌면 이력을 잃으므로,
 * "결제한 상세 분석을 기억"하는 기능은 로그인 사용자에게만 완전하게 보장할 수 있다. */
export function isLoggedIn() {
  return !!localStorage.getItem(NICKNAME_USER_ID_KEY);
}
