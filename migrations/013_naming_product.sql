-- migrations/013_naming_product.sql
--
-- §작명소 최종 확정 정책 — 단일 상품(BASIC/CHAT 분리 없음). 89,000원 = 분석 결과 영구 열람 +
-- AI 채팅 100회/30일. 택일(DATE_SELECTION) 구매 이력이 있으면 59,000원 할인 — 할인 적용은
-- 서버(주문 생성 시점)가 결정한다(§가격을 프론트가 결정하지 않는다). MINGRI_SUBSCRIPTION과
-- 완전히 독립(subscription_group = null).
insert into products (code, name, price, analysis_type, description, active, question_quota, validity_hours, tier, subscription_group) values
  ('NAMING', '작명소', 89000, 'NAMING', '입력한 사주 정보를 바탕으로 이름 후보를 비교 분석하고, 결과에 대해 AI 채팅 100회(30일)를 이용할 수 있습니다.', true, 100, 720, 'detail', null)
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
