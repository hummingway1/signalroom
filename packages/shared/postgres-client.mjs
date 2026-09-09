// packages/shared/postgres-client.mjs
//
// Supabase Postgres 연결 풀. 기존 packages/shared/json-store.mjs와 마찬가지로 "swap 가능한
// 얇은 계층"으로만 존재 — 이 파일 위(리포지토리/서비스)는 이 모듈의 pool.query()만 알면 된다.
//
// 중요: DATABASE_URL이 없으면 조용히 mock으로 대체하지 않는다. 인증/결제처럼 데이터 정합성이
// 중요한 영역에서 "가짜로 동작하는 척"은 카카오/네이버/구글 OAuth를 가짜 버튼으로 만들지 않는다는
// 기존 프로젝트 원칙(user-repository.mjs 주석 참고)과 동일한 이유로 금지한다 — DATABASE_URL이
// 없으면 명확한 에러를 던진다.
import pg from 'pg';

let pool = null;

export function getPool() {
  if (pool) return pool;
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error(
      'DATABASE_URL이 설정되지 않았습니다. Supabase Postgres의 Connection string을 .env에 설정하세요. ' +
        '(인증/결제 기능은 이 값 없이는 동작하지 않습니다 — 가짜로 대체하지 않습니다.)'
    );
  }
  pool = new pg.Pool({
    connectionString,
    // Supabase는 기본적으로 SSL을 요구한다. 로컬 개발에서 자체 서명 인증서 체인 검증 문제를
    // 피하기 위해 rejectUnauthorized:false를 쓴다(Supabase 공식 가이드에서도 흔히 권장되는 설정) —
    // 운영에서 더 엄격한 검증이 필요하면 CA 인증서를 별도로 설정한다.
    ssl: { rejectUnauthorized: false },
  });
  return pool;
}

/** 테스트에서 풀을 재설정할 때 사용(연결 문자열이 바뀌는 경우 등). */
export async function closePool() {
  if (pool) {
    await pool.end();
    pool = null;
  }
}
