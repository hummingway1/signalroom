-- migrations/008_yearly_fortune_products.sql
--
-- Phase 5 확정 정책 — 신년운세는 analysis_type=YEARLY_FORTUNE 하나로 통일하고, tier는 상품
-- 레벨(YEARLY_FORTUNE_BASIC vs YEARLY_FORTUNE_CHAT)에서만 구분한다. 990원은 결과 열람 전용
-- (채팅 권한 없음 — tier='basic'이라 authorization에서 자동으로 채팅 불가), 4900원만
-- 채팅 10회/24시간을 제공한다.

insert into products (code, name, price, analysis_type, description, active, question_quota, validity_hours, tier) values
  ('YEARLY_FORTUNE_BASIC', '신년운세 기본', 990, 'YEARLY_FORTUNE', '특정 연도 신년운세 상세 결과 1회 생성(영구 열람, 채팅 권한 없음)', true, 1, null, 'basic'),
  ('YEARLY_FORTUNE_CHAT', '신년운세 채팅형', 4900, 'YEARLY_FORTUNE', '특정 연도 신년운세 상세 결과(영구 열람) + 해당 분석 데이터에 대한 채팅 50회(30일)', true, 50, 720, 'detail')
on conflict (code) do update set
  name = excluded.name,
  price = excluded.price,
  analysis_type = excluded.analysis_type,
  description = excluded.description,
  question_quota = excluded.question_quota,
  validity_hours = excluded.validity_hours,
  tier = excluded.tier;

-- orders가 "이 신년운세 주문이 몇 년도에 대한 것인지" 알아야 confirmPaymentTransaction이
-- analysis_scope.fortune_year를 채울 수 있다. nullable — 기존 주문(신년운세 아닌 것)은 그대로 NULL.
alter table orders add column if not exists subject_fortune_year integer;
