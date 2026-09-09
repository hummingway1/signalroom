-- migrations/006_analysis_entitlement_link.sql
--
-- Phase 2 — Entitlement가 "무엇을 샀는지"뿐 아니라 "정확히 어떤 분석 결과에 대한 권한인지"를
-- 알 수 있도록 analyses 테이블을 신설하고 entitlements에 연결 컬럼을 추가한다.
--
-- §10(migration 원칙) — 기존 entitlement를 추측으로 특정 analysis에 연결하지 않는다. 새 컬럼은
-- nullable로 추가하고, 기존 행은 전부 NULL로 남는다(= "레거시, 아직 특정 분석과 연결 안 됨").
-- 애플리케이션 코드는 analysis_id가 NULL인 entitlement를 기존 방식(user_id+product_id 기준)
-- 그대로 처리해서 하위 호환을 보장한다 — 강제 마이그레이션도, 삭제도 하지 않는다.

-- Analysis: 실제 "누구의 어떤 분석 결과인가"의 canonical source. 생성 후 result_data는 불변
-- (child-profile-service의 purchased_analyses immutable 원칙과 동일선상).
--
-- §17(DB constraint 검토) — chart_id/child_profile_id는 Postgres FK로 걸 수 없다: charts와
-- child_profiles는 아직 Postgres 테이블이 아니라 JSON 파일 저장소(packages/shared/json-store.mjs
-- 기반, apps/api/src/repositories/base.mjs storeFor())다. 두 저장소를 걸친 FK는 기술적으로
-- 불가능하므로, 대신 애플리케이션 레벨에서 analysis-repository.mjs가 생성 시점에 실제로 그
-- chart/child_profile이 존재하고 해당 user_id 소유인지 확인한다(§6 소유권 검증과 동일 원칙을
-- cross-store 참조에도 적용). charts/child_profiles가 나중에 Postgres로 옮겨지면(STEP6 계획에
-- 있던 전환) 이 시점에 진짜 FK로 강화하는 걸 권장한다.
create table if not exists analysis_scopes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id),
  analysis_type text not null,
  chart_id text,          -- JsonStore 저장소의 chart id(문자열) — Postgres FK 불가(위 설명)
  child_profile_id text,  -- 마찬가지로 JsonStore 저장소의 id
  fortune_year integer, -- YEARLY_FORTUNE_DETAIL 전용(§15 — 연도가 다르면 별개의 analysis)
  result_data jsonb,
  version integer not null default 1,
  created_at timestamptz not null default now()
);

create index if not exists idx_analysis_scopes_user_id on analysis_scopes(user_id);
create index if not exists idx_analysis_scopes_type on analysis_scopes(analysis_type);

-- Entitlement ↔ Analysis 연결. nullable — 기존 행은 NULL로 남아 레거시로 처리된다.
alter table entitlements add column if not exists analysis_id uuid references analysis_scopes(id);
alter table entitlements add column if not exists analysis_type text;

create index if not exists idx_entitlements_analysis_id on entitlements(analysis_id);

-- §3 — products.analysis_type을 canonical 대문자 enum으로 통일한다(기존 소문자 snake_case
-- 값은 어디서도 실제 분기 로직에 쓰이지 않는 것을 코드 전수 조사로 확인했음 — 값만 바꿔도 안전).
update products set analysis_type = 'SAJU_BASIC' where code = 'SAJU_BASIC';
update products set analysis_type = 'SAJU_DETAIL' where code = 'SAJU_DETAIL';
update products set analysis_type = 'CHILD_BASIC' where code = 'CHILD_BASIC';
update products set analysis_type = 'CHILD_DETAIL' where code = 'CHILD_DETAIL';
update products set analysis_type = 'RELATIONSHIP_BASIC' where code in ('RELATIONSHIP_BASIC', 'COMPATIBILITY_BASIC');
update products set analysis_type = 'RELATIONSHIP_DETAIL' where code in ('RELATIONSHIP_DETAIL', 'COMPATIBILITY_DETAIL');
