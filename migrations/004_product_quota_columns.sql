-- migrations/004_product_quota_columns.sql
--
-- §정책 확정 — 상품마다 "채팅 질문 몇 회, 며칠간 유효한지"가 다르다(기본=1회성 열람만, 상세=10회/
-- 24시간, 구독=50회/48시간). 이걸 코드에 상품코드별로 하드코딩하지 않고 Product 설정으로 관리한다.
alter table products add column if not exists question_quota integer not null default 1;
alter table products add column if not exists validity_hours integer; -- null = 만료 없음(기본 분석 열람권)
alter table products add column if not exists tier text not null default 'basic' check (tier in ('basic','detail','subscription'));
