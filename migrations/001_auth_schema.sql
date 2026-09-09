-- migrations/001_auth_schema.sql
--
-- STEP 3 범위: users / auth_accounts / sessions만 생성한다.
-- products / orders / payments / entitlements는 STEP 6에서 별도 마이그레이션으로 추가한다
-- (§B 설계 문서의 스키마와 동일).
--
-- 이 파일은 Supabase SQL Editor에 그대로 붙여넣어 실행하거나,
-- `psql "$DATABASE_URL" -f migrations/001_auth_schema.sql`로 실행한다.

create extension if not exists pgcrypto; -- gen_random_uuid() 사용을 위해 필요

create table if not exists users (
  id uuid primary key default gen_random_uuid(),
  email text unique,
  nickname text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists auth_accounts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  provider text not null check (provider in ('kakao', 'naver', 'google', 'email')),
  provider_user_id text not null,
  password_hash text,
  created_at timestamptz not null default now(),
  unique (provider, provider_user_id)
);

create index if not exists idx_auth_accounts_user_id on auth_accounts(user_id);

-- 세션 저장 — 서버 재시작에도 로그인이 유지되도록 DB에 저장한다(§E 설계).
create table if not exists sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null
);

create index if not exists idx_sessions_user_id on sessions(user_id);
create index if not exists idx_sessions_expires_at on sessions(expires_at);
