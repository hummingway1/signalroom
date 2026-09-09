-- migrations/010_yearly_fortune_chat_quota_update.sql
--
-- 최종 확정 정책 — YEARLY_FORTUNE_CHAT의 채팅 quota/기간을 50회/30일로 갱신한다(기존 시드값은
-- 10회/24시간이었음 — 이번에 사용자가 명시적으로 확정한 값으로 업데이트, 가격 4900원은 무변경).
update products set question_quota = 50, validity_hours = 720 where code = 'YEARLY_FORTUNE_CHAT';
