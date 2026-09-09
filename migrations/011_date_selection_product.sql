-- migrations/011_date_selection_product.sql
--
-- §출생일 택일 최종 확정 정책 — 단일 상품(BASIC/CHAT 분리 없음). 29,000원 = 분석 결과 영구
-- 열람 + AI 채팅 50회/30일. MINGRI_SUBSCRIPTION과 완전히 독립(subscription_group = null).
insert into products (code, name, price, analysis_type, description, active, question_quota, validity_hours, tier, subscription_group) values
  ('DATE_SELECTION', '출생일 택일', 29000, 'DATE_SELECTION', '입력한 날짜/시간 범위 안에서 후보들을 비교 분석하고, 결과에 대해 AI 채팅 50회(30일)를 이용할 수 있습니다.', true, 50, 720, 'detail', null)
on conflict (code) do update set
  name = excluded.name,
  price = excluded.price,
  analysis_type = excluded.analysis_type,
  description = excluded.description,
  active = excluded.active,
  question_quota = excluded.question_quota,
  validity_hours = excluded.validity_hours,
  tier = excluded.tier,
  subscription_group = excluded.subscription_group;
