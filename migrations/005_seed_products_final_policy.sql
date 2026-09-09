-- migrations/005_seed_products_final_policy.sql
--
-- §최종 상품 구조 확정(사용자 승인) — 기존 003_seed_products.sql의 3개 단일 상품을
-- basic/detail 쌍으로 재구성한다. 가격은 확정 정책 그대로: 기본 990원, 상세 4900원.
-- 기존 003이 만든 SAJU_BASIC/CHILD_BASIC/RELATIONSHIP_BASIC 코드는 재사용하고(하위 호환),
-- 새로 DETAIL 상품과 question_quota/validity_hours/tier를 채워 넣는다.

-- 기존 003 시드가 만든 basic 상품들의 tier/quota를 정책에 맞게 명시(quota=1, 만료 없음 — 분석
-- 결과 열람권일 뿐 후속 채팅 권한은 포함하지 않는다는 §1/§2/§3 정책 그대로).
update products set tier = 'basic', question_quota = 1, validity_hours = null
where code in ('SAJU_BASIC', 'CHILD_BASIC', 'RELATIONSHIP_BASIC');

-- 상세 상품 신규 추가. 4,900원 / Terra / 채팅 10회 / 24시간(§1/§2/§3 정책 그대로).
insert into products (code, name, price, analysis_type, description, active, tier, question_quota, validity_hours) values
  ('SAJU_DETAIL', '나의 시그널 상세 분석', 4900, 'saju_detail', '사주+자미두수 상세 분석, 결과에 대해 24시간 동안 10회 질문 가능', true, 'detail', 10, 24),
  ('CHILD_DETAIL', '아이시그널 상세 분석', 4900, 'child_detail', '아이 사주+자미두수 종합 상세 분석, 24시간 동안 10회 질문 가능', true, 'detail', 10, 24),
  ('RELATIONSHIP_DETAIL', '관계 시그널 상세 궁합', 4900, 'compatibility_detail', '상세 궁합 분석, 24시간 동안 10회 질문 가능', true, 'detail', 10, 24)
on conflict (code) do nothing;
