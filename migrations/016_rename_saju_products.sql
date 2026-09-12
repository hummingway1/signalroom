-- migrations/016_rename_saju_products.sql
--
-- §상품명 통일 — 사주 ROOM의 타이틀은 "사주"인데 상품 카드에는 "나의 시그널"이라고
-- 나와서 서비스 정체성이 흔들리던 문제. price/quota/analysis_type 등은 전혀 건드리지
-- 않고 name 컬럼만 수정한다.
update products set name = '사주 기본 분석' where code = 'SAJU_BASIC';
update products set name = '사주 상세 분석' where code = 'SAJU_DETAIL';
