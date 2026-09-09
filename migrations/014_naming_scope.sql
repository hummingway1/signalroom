-- migrations/014_naming_scope.sql
--
-- §작명소 — analysis_scopes/orders 확장. 작명 대상은 chart_id(이미 계산된 사주)를 그대로
-- 재사용하되(§3 — 기존 birth data 재사용), 여기에 "성씨" 등 작명 전용 조건이 추가로 필요하다.
-- DATE_SELECTION의 date_selection_params와 동일한 원칙으로 별도 컬럼을 추가한다.
--
-- naming_params 구조(예): { "surname": "김" }  (chart_id로 이미 성별/출생정보는 연결됨)
alter table orders add column if not exists subject_naming_params jsonb;
alter table analysis_scopes add column if not exists naming_params jsonb;
