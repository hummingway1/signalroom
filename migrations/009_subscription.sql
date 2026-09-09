-- migrations/009_subscription.sql
--
-- Phase 6 — 명리 구독 + 아이시그널 구독. §7/§31 원칙: 구독은 "분석 데이터 접근권"이 아니라
-- "채팅 질문 횟수"만 제공한다. 따라서 하나의 특정 analysis_type에 매핑되지 않으므로
-- products.analysis_type을 nullable로 완화하고, 대신 subscription_group(어느 도메인 그룹의
-- quota를 제공하는지: 'MINGRI' | 'CHILD_SIGNAL')으로 관리한다.

alter table products alter column analysis_type drop not null;
alter table products add column if not exists subscription_group text; -- tier='subscription'일 때만 사용
alter table entitlements add column if not exists subscription_group text; -- 결제 시 product에서 그대로 복사

insert into products (code, name, price, analysis_type, description, active, question_quota, validity_hours, tier, subscription_group) values
  ('MINGRI_SUBSCRIPTION', '명리 채팅 구독', 4900, null, '사주/자미두수/신년운세 중 실제로 구매한 상세분석 데이터에 대해 매달 채팅 50회 제공(구독 자체는 분석 데이터 접근권을 주지 않음)', true, 50, 720, 'subscription', 'MINGRI'),
  ('CHILD_SIGNAL_SUBSCRIPTION', '아이시그널 채팅 구독', 4900, null, '아이 성장 코치 상세분석 데이터에 대해 매달 채팅 50회 제공(명리 구독과 완전히 분리)', true, 50, 720, 'subscription', 'CHILD_SIGNAL')
on conflict (code) do update set
  name = excluded.name,
  price = excluded.price,
  description = excluded.description,
  question_quota = excluded.question_quota,
  validity_hours = excluded.validity_hours,
  tier = excluded.tier,
  subscription_group = excluded.subscription_group;
