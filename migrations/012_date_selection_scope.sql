-- migrations/012_date_selection_scope.sql
--
-- §출생일 택일 — analysis_scopes/orders 확장. 택일의 대상은 기존 chart_id/child_profile_id
-- (이미 태어난 사람)가 아니라 "아직 태어나지 않은 아이의 출생 가능 조건"이다. 그래서 기존
-- 컬럼으로 표현할 수 없고, 이 상품 전용의 새 jsonb 컬럼이 필요하다(§10 — 새 identifier가
-- 필요한 이유: 기존 chart_id/child_profile_id/fortune_year 중 어느 것도 "날짜/시간 범위
-- 조건 자체"를 표현할 수 없음).
--
-- date_selection_params 구조(예):
--   { "dateRangeStart": "2027-05-01", "dateRangeEnd": "2027-05-13",
--     "timeRangeStart": "00:00", "timeRangeEnd": "23:00",
--     "intervalMinutes": 60, "gender": "female", "city": "Seoul" }
alter table orders add column if not exists subject_date_selection_params jsonb;
alter table analysis_scopes add column if not exists date_selection_params jsonb;
