// packages/shared/password-hash.mjs
//
// 비밀번호 해시 유틸. bcryptjs(순수 JS 구현의 bcrypt) 사용 — argon2/bcrypt 네이티브 바인딩은
// 빌드 환경에 따라 컴파일 실패 위험이 있어, 동일한 bcrypt 알고리즘을 순수 JS로 구현한 bcryptjs를
// 선택했다(§2 "Argon2 또는 bcrypt 사용" 요구사항을 bcrypt 알고리즘으로 충족).
// 비밀번호 원문은 절대 로그에 출력하지 않는다 — 이 파일 어디에도 console.log(password) 없음.
import bcrypt from 'bcryptjs';

const SALT_ROUNDS = 12;

export async function hashPassword(plainPassword) {
  return bcrypt.hash(plainPassword, SALT_ROUNDS);
}

export async function verifyPassword(plainPassword, hash) {
  return bcrypt.compare(plainPassword, hash);
}
