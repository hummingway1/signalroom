// tests/70-free-trial-real-analysis.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { startConversation, claimFreeTrial } from '../apps/api/src/services/conversation-service.mjs';
import { createChartRecord } from '../apps/api/src/repositories/chart-repository.mjs';
import { computeChart } from '../packages/chart-engine/compute.mjs';
import { buildCanonicalChart } from '../packages/canonical/transform.mjs';
import { MockAIProvider } from '../packages/ai/providers/mock-provider.mjs';

test('1. claimFreeTrial은 campaign claim이 DB를 필요로 하므로 정상 차단된다', async () => {
  const raw = computeChart({ birthDate: '1990-05-15', birthTime: '14:30', gender: 'male', city: 'Seoul' });
  const canonical = buildCanonicalChart(raw, { engineVersion: '0.4.2' });
  const chart = await createChartRecord({ userId: 'u1', canonical, rawEngineOutput: raw });
  const conv = await startConversation({ chartId: chart.id, characterId: 'daegu' });
  await assert.rejects(
    () => claimFreeTrial({ conversationId: conv.id, userId: 'u1', aiProvider: new MockAIProvider(), model: 'mock' }),
    /DATABASE_URL/
  );
});

test('2. claimFreeTrial이 askQuestion(실제 분석 파이프라인)을 호출한다', async () => {
  const source = await readFile('./apps/api/src/services/conversation-service.mjs', 'utf-8');
  const fnStart = source.indexOf('export async function claimFreeTrial');
  const fnBody = source.slice(fnStart, fnStart + 3000);
  assert.ok(fnBody.includes('await askQuestion({'));
  assert.ok(fnBody.includes('authorizeBeforeAnalysis: null'));
});

test('3. claimFreeTrial은 기존 QUESTION_CATALOG 항목을 재사용한다(새 파이프라인 없음)', async () => {
  const source = await readFile('./apps/api/src/services/conversation-service.mjs', 'utf-8');
  const fnStart = source.indexOf('export async function claimFreeTrial');
  const fnBody = source.slice(fnStart, fnStart + 3000);
  assert.ok(fnBody.includes('QUESTION_CATALOG.find'));
});

test('4. 무료체험 응답에 실제 분석 결과 텍스트가 포함된다', async () => {
  const source = await readFile('./apps/api/src/services/conversation-service.mjs', 'utf-8');
  const fnStart = source.indexOf('export async function claimFreeTrial');
  const fnBody = source.slice(fnStart, fnStart + 3000);
  assert.ok(fnBody.includes('pipelineResult.response'));
  assert.ok(!fnBody.includes("'좋아, 무료로 받았어!\\n이제 궁금한 거 편하게 물어봐.'"));
});

test('5. claim-free-trial 라우트가 aiProvider를 전달한다', async () => {
  const source = await readFile('./apps/api/src/routes/conversations.mjs', 'utf-8');
  const routeStart = source.indexOf("router.post('/:id/claim-free-trial'");
  const routeBody = source.slice(routeStart, routeStart + 800);
  assert.ok(routeBody.includes('const aiProvider = aiProviderFactory();'));
  assert.ok(routeBody.includes('aiProvider, model'));
});

test('6. SAJU_BASIC/SAJU_DETAIL 상품명이 통일된다(가격 무변경)', async () => {
  const migrationSql = await readFile('./migrations/016_rename_saju_products.sql', 'utf-8');
  assert.ok(migrationSql.includes("name = '사주 기본 분석'"));
  assert.ok(migrationSql.includes("name = '사주 상세 분석'"));
  assert.ok(!migrationSql.includes('set price'), '가격(price 컬럼)은 이 마이그레이션에서 건드리지 않아야 함');
});
