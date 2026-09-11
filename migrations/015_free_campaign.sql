-- migrations/015_free_campaign.sql
--
-- §10,000명 한정 무료 캠페인 — 상품(products.price)은 그대로 990원 유지한다(영구 무료로
-- 바꾸지 않음). campaign 레이어를 상품 위에 얹어서, 캠페인이 끝나면 자동으로 정상가로
-- 돌아간다. 무료 entitlement는 amount=0인 특수 order를 통해 기존 orders→entitlements
-- 파이프라인을 그대로 재사용해서 발급한다(entitlements.order_id가 not null unique라서,
-- 이 제약을 건드리지 않고 기존 감사 추적을 그대로 유지하기 위한 선택).
create table if not exists campaigns (
  id uuid primary key default gen_random_uuid(),
  campaign_code text unique not null,
  product_code text not null references products(code),
  limit_count integer not null,
  used_count integer not null default 0,
  starts_at timestamptz not null default now(),
  ends_at timestamptz,
  active boolean not null default true
);

-- §원자적 선착순 보장 — used_count 증가는 반드시
-- `UPDATE campaigns SET used_count = used_count + 1 WHERE campaign_code = $1 AND
-- used_count < limit_count AND active = true RETURNING used_count` 형태로만 수행한다.
-- 이 UPDATE 자체가 Postgres에서 행 잠금을 거는 원자적 연산이라, 동시에 여러 요청이 와도
-- limit_count를 절대 초과하지 않는다.

insert into campaigns (campaign_code, product_code, limit_count, active)
values ('SAJU_BASIC_FREE_10K', 'SAJU_BASIC', 10000, true)
on conflict (campaign_code) do nothing;
