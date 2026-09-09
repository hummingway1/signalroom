-- migrations/002_payment_schema.sql
--
-- STEP2 설계 문서(§B)에서 이미 승인받은 스키마를 그대로 구현. products/orders/payments/
-- entitlements — 001_auth_schema.sql(users/auth_accounts/sessions)에 이어서 실행한다.

create table if not exists products (
  id uuid primary key default gen_random_uuid(),
  code text unique not null,              -- 예: SAJU_BASIC, SAJU_DEEP, ZIWEI, CHILD_ANALYSIS
  name text not null,                     -- 사용자 표시용
  price integer not null,                 -- 원 단위(KRW, 소수점 없음)
  analysis_type text not null,            -- 내부적으로 어떤 분석 파이프라인에 연결되는지
  description text,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists orders (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id),
  product_id uuid not null references products(id),
  order_name text not null,               -- 생성 시점의 product.name 스냅샷(Toss 결제창 표시용)
  amount integer not null,                -- 생성 시점의 product.price 스냅샷(가격 변동과 무관)
  status text not null default 'PENDING' check (status in ('PENDING','PAID','FAILED','CANCELLED','REFUNDED')),
  created_at timestamptz not null default now(),
  paid_at timestamptz
);

create index if not exists idx_orders_user_id on orders(user_id);
create index if not exists idx_orders_status on orders(status);

create table if not exists payments (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references orders(id),
  provider text not null default 'tosspayments',
  payment_key text unique,                -- Toss가 승인 성공 후 발급. UNIQUE 제약이 이중 승인 방지의 최종 방어선.
  method text,                            -- 'card','kakaopay','naverpay','tosspay' 등 Toss 응답값 그대로
  amount integer not null,
  status text not null default 'REQUESTED' check (status in ('REQUESTED','APPROVED','FAILED','CANCELLED')),
  approved_at timestamptz,
  raw_response jsonb,                     -- Toss 승인 API 원본 응답 전체(분쟁/디버깅 대비)
  created_at timestamptz not null default now()
);

create index if not exists idx_payments_order_id on payments(order_id);

create table if not exists entitlements (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id),
  product_id uuid not null references products(id),
  order_id uuid not null unique references orders(id),  -- UNIQUE — 같은 주문으로 이중 지급 원천 차단
  quantity integer not null default 1,
  remaining_quantity integer not null,
  expires_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists idx_entitlements_user_id on entitlements(user_id);
create index if not exists idx_entitlements_product_id on entitlements(product_id);
