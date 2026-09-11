// tests/69-critical-flow-post-auth.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { startConversation, resumeAfterAuth, confirmBirthData, claimFreeTrial } from '../apps/api/src/services/conversation-service.mjs';
import { createChartRecord } from '../apps/api/src/repositories/chart-repository.mjs';
import { computeChart } from '../packages/chart-engine/compute.mjs';
import { buildCanonicalChart } from '../packages/canonical/transform.mjs';

async function makeConvForUser(userId) {
  const raw = computeChart({ birthDate: '1990-05-15', birthTime: '14:30', gender: 'male', city: 'Seoul' });
  const canonical = buildCanonicalChart(raw, { engineVersion: '0.4.2' });
  const chart = await createChartRecord({ userId, canonical, rawEngineOutput: raw });
  const conv = await startConversation({ chartId: chart.id, characterId: 'daegu' });
  return { conv, chart };
}

test('1. resumeAfterAuth — chart 없는 사용자는 생년월일을 요청한다(다시 물어봐야 하는 케이스)', async () => {
  const { conv } = await makeConvForUser(null);
  const r = await resumeAfterAuth({ conversationId: conv.id, userId: 'brand-new-user-no-chart' });
  assert.equal(r.highlightCard?.type, 'birth_form_needed');
  assert.ok(r.response.includes('생년월일'));
});

test('2. resumeAfterAuth — chart 있는 사용자는 저장된 실제 생년월일/시간을 정확히 보여주고 절대 다시 묻지 않는다(ROOT CAUSE 핵심 검증)', async () => {
  const userId = 'existing-user-1';
  const { conv } = await makeConvForUser(userId);
  const r = await resumeAfterAuth({ conversationId: conv.id, userId });
  assert.equal(r.highlightCard?.type, 'birth_confirm');
  assert.equal(r.highlightCard.birthDate, '1990-05-15');
  assert.equal(r.highlightCard.birthTime, '14:30');
  assert.ok(!r.response.includes('생년월일이랑'), '이미 있는 생년월일을 다시 물어보면 안 됨');
});

test('3. confirmBirthData(confirmed=false) — DB 없이도 안전하게 "다시 입력" 카드를 반환한다', async () => {
  const { conv, chart } = await makeConvForUser('u2');
  const r = await confirmBirthData({ conversationId: conv.id, userId: 'u2', chartId: chart.id, confirmed: false });
  assert.equal(r.highlightCard?.type, 'birth_form_needed');
});

test('4. confirmBirthData(confirmed=true) — 실제 entitlement DB 조회를 시도한다(가짜로 통과 안 시킴)', async () => {
  const { conv, chart } = await makeConvForUser('u3');
  await assert.rejects(
    () => confirmBirthData({ conversationId: conv.id, userId: 'u3', chartId: chart.id, confirmed: true }),
    /DATABASE_URL/
  );
});

test('5. claimFreeTrial — 실제 캠페인/product DB 조회를 시도한다(가짜 무료 지급 없음)', async () => {
  const { conv } = await makeConvForUser('u4');
  await assert.rejects(
    () => claimFreeTrial({ conversationId: conv.id, userId: 'u4' }),
    /DATABASE_URL/
  );
});

test('6. 캠페인 원자적 claim 로직이 UPDATE...WHERE used_count<limit_count RETURNING 패턴을 사용한다(동시성 보장 확인)', async () => {
  const source = await readFile('./apps/api/src/repositories/campaign-repository.mjs', 'utf-8');
  assert.ok(source.includes('update campaigns set used_count = used_count + 1'));
  assert.ok(source.includes('where campaign_code = $1 and used_count < limit_count and active = true'));
});

test('7. 무료 캠페인 entitlement는 기존 orders/entitlements 테이블을 그대로 재사용한다(새 스키마 없음)', async () => {
  const source = await readFile('./apps/api/src/repositories/campaign-repository.mjs', 'utf-8');
  assert.ok(source.includes('insert into orders'));
  assert.ok(source.includes('insert into entitlements'));
  assert.ok(source.includes("'PAID'"));
});

test('8. 로그인 성공 콜백(handleNicknameSubmit/handleEmailAuthSuccess)이 chat.resumeAfterAuth를 호출한다(ROOT CAUSE 수정 확인)', async () => {
  const source = await readFile('./apps/web/src/App.jsx', 'utf-8');
  const occurrences = (source.match(/await chat\.resumeAfterAuth\(user\.id\)/g) ?? []).length;
  assert.equal(occurrences, 2, 'handleNicknameSubmit와 handleEmailAuthSuccess 둘 다 호출해야 함');
});

test('9. products.price는 캠페인과 무관하게 그대로 유지된다(영구 무료로 DB를 바꾸지 않음)', async () => {
  const migrationSql = await readFile('./migrations/015_free_campaign.sql', 'utf-8');
  assert.ok(!migrationSql.includes('update products set price'), '캠페인 마이그레이션이 상품 가격 자체를 건드리면 안 됨');
});
