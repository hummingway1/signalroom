// apps/api/src/repositories/auth-repository.mjs
//
// STEP 3 — users/auth_accounts/sessions를 다루는 Postgres 리포지토리. 기존
// apps/api/src/repositories/user-repository.mjs(닉네임 전용, JsonStore 기반)는 건드리지
// 않는다 — 완전히 새로운 서브시스템으로 병행 운영하고, 기존 라우트가 여기 의존하지 않게 한다.
import { randomUUID } from 'node:crypto';
import { getPool } from '../../../../packages/shared/postgres-client.mjs';

const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30일

/** (provider, providerUserId)로 기존 계정을 찾거나, 없으면 새 User+AuthAccount를 만든다.
 * §C 원칙 — 서로 다른 provider의 동일 이메일을 자동 병합하지 않는다: 오직 (provider,
 * provider_user_id) 조합으로만 조회한다, 이메일로는 절대 매칭하지 않는다. */
export async function findOrCreateUserByAuthAccount({ provider, providerUserId, nickname, email = null }) {
  const pool = getPool();
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const existing = await client.query('select user_id from auth_accounts where provider = $1 and provider_user_id = $2', [provider, providerUserId]);
    if (existing.rows.length > 0) {
      const userId = existing.rows[0].user_id;
      const userResult = await client.query('select id, email, nickname from users where id = $1', [userId]);
      await client.query('COMMIT');
      return { user: userResult.rows[0], isNewUser: false };
    }

    const userId = randomUUID();
    await client.query('insert into users (id, email, nickname) values ($1, $2, $3)', [userId, email, nickname]);
    const authAccountId = randomUUID();
    await client.query('insert into auth_accounts (id, user_id, provider, provider_user_id) values ($1, $2, $3, $4)', [authAccountId, userId, provider, providerUserId]);

    await client.query('COMMIT');
    return { user: { id: userId, email, nickname }, isNewUser: true };
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

/** 이메일 회원가입 전용 — provider='email'은 provider_user_id로 이메일 주소 자체를 쓴다. */
export async function createEmailAccount({ email, nickname, passwordHash }) {
  const pool = getPool();
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const dup = await client.query("select 1 from auth_accounts where provider = 'email' and provider_user_id = $1", [email]);
    if (dup.rows.length > 0) {
      await client.query('ROLLBACK');
      return { error: 'EMAIL_ALREADY_EXISTS' };
    }
    const userId = randomUUID();
    await client.query('insert into users (id, email, nickname) values ($1, $2, $3)', [userId, email, nickname]);
    const authAccountId = randomUUID();
    await client.query("insert into auth_accounts (id, user_id, provider, provider_user_id, password_hash) values ($1, $2, 'email', $3, $4)", [authAccountId, userId, email, passwordHash]);
    await client.query('COMMIT');
    return { user: { id: userId, email, nickname } };
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

export async function findEmailAuthAccount(email) {
  const pool = getPool();
  const result = await pool.query("select aa.user_id, aa.password_hash, u.email, u.nickname from auth_accounts aa join users u on u.id = aa.user_id where aa.provider = 'email' and aa.provider_user_id = $1", [email]);
  return result.rows[0] ?? null;
}

export async function createSession(userId) {
  const pool = getPool();
  const id = randomUUID();
  const expiresAt = new Date(Date.now() + SESSION_TTL_MS);
  await pool.query('insert into sessions (id, user_id, expires_at) values ($1, $2, $3)', [id, userId, expiresAt]);
  return { id, expiresAt };
}

export async function getSessionUser(sessionId) {
  const pool = getPool();
  const result = await pool.query(
    `select u.id, u.email, u.nickname from sessions s
     join users u on u.id = s.user_id
     where s.id = $1 and s.expires_at > now()`,
    [sessionId]
  );
  return result.rows[0] ?? null;
}

export async function deleteSession(sessionId) {
  const pool = getPool();
  await pool.query('delete from sessions where id = $1', [sessionId]);
}

/** 사용자가 직접 닉네임을 정한다(가입 직후 카카오/네이버/구글 기본 닉네임 대신 원하는 이름으로
 * 바꿀 수 있게). 본인 것만 바꿀 수 있어야 하므로 반드시 세션에서 얻은 userId로만 호출한다. */
export async function updateNickname(userId, nickname) {
  const pool = getPool();
  const result = await pool.query('update users set nickname = $1, updated_at = now() where id = $2 returning id, email, nickname', [nickname, userId]);
  return result.rows[0] ?? null;
}
