-- migrations/003_seed_products.sql
--
-- 초기 상품 시드. ON CONFLICT로 재실행해도 안전(멱등) — code가 UNIQUE라 이미 있으면 건드리지 않음.
-- 가격은 여기서만 관리한다 — 코드에 하드코딩하지 않는다(§원칙).

insert into products (code, name, price, analysis_type, description, active) values
  ('SAJU_BASIC', '나의 시그널 (본인 사주 기본)', 990, 'saju_basic', '사주 원국/성격/재물/직업 기본 분석', true),
  ('CHILD_BASIC', '아이시그널 (자녀 성향 코칭)', 990, 'child_basic', '자녀 성향/고민 코칭 기본 분석', true),
  ('RELATIONSHIP_BASIC', '관계 시그널 (궁합)', 990, 'compatibility_basic', '두 사람의 궁합/관계 흐름 분석', true)
on conflict (code) do nothing;
