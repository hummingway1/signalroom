-- migrations/007_order_subject_link.sql
--
-- Phase 4 — 결제 시점에 "이 주문이 정확히 어떤 chart/child_profile에 대한 것인지" 알아야
-- analysis_scope를 생성해서 entitlement에 연결할 수 있다. orders에 nullable 컬럼을 추가한다.
-- (JsonStore 기반 id라 text, Postgres FK 불가 — analysis_scopes와 동일한 이유, §17 원칙 재사용)
alter table orders add column if not exists subject_chart_id text;
alter table orders add column if not exists subject_child_profile_id text;
