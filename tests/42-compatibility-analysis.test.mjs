// tests/42-compatibility-analysis.test.mjs
//
// §최종 상품 정책 §2 — 궁합 기본(990/Luna)/상세(4900/Terra) AI 분석. 기존 무료 엔터테인먼트
// 라우트(/api/compatibility)는 이 테스트 대상이 아니다(무변경 확인은 기존 21번 테스트가 계속 함).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { rm } from 'node:fs/promises';

import { generateCompatibilityAnalysis } from '../apps/api/src/services/compatibility-analysis-service.mjs';
import { createChartRecord } from '../apps/api/src/repositories/chart-repository.mjs';
import { computeChart } from '../packages/chart-engine/compute.mjs';
import { buildCanonicalChart } from '../packages/canonical/transform.mjs';

test.before(async () => {
  await rm('./data/db', { recursive: true, force: true });
});

async function makeChart(birthDate, birthTime, gender) {
  const raw = computeChart({ birthDate, birthTime, gender, city: 'Seoul' });
  const record = await createChartRecord({ canonical: buildCanonicalChart(raw, { engineVersion: 'test' }) });
  return record.canonical;
}

test('A1: aiProvider가 없으면(API 키 미설정) summary는 null — 가짜 응답을 만들지 않는다', async () => {
  const chartA = await makeChart('1990-01-01', '10:00', 'male');
  const chartB = await makeChart('1992-05-05', '14:00', 'female');
  const result = await generateCompatibilityAnalysis({ chartA, chartB, tier: 'basic', aiProvider: null });
  assert.equal(result.summary, null);
  assert.ok(result.raw, 'raw 계산 데이터는 aiProvider 유무와 무관하게 항상 있어야 함');
  assert.ok(result.features, 'features도 마찬가지');
});

test('A2: raw/features는 기존 analyzeCompatibilityFact와 동일한 실제 계산 결과다(새로 계산 로직을 만들지 않음)', async () => {
  const { analyzeCompatibilityFact } = await import('../packages/chart-engine/compatibility-analysis.mjs');
  const chartA = await makeChart('1990-01-01', '10:00', 'male');
  const chartB = await makeChart('1992-05-05', '14:00', 'female');
  const direct = analyzeCompatibilityFact(chartA.saju, chartB.saju);
  const viaService = await generateCompatibilityAnalysis({ chartA, chartB, tier: 'basic', aiProvider: null });
  assert.deepEqual(viaService.raw, direct.raw);
  assert.deepEqual(viaService.features, direct.features);
});

test('B1: MockAIProvider로 실제 분석 호출 시 tier에 따라 다른 시스템 프롬프트가 쓰인다(basic=짧게, full=자세히 지시)', async () => {
  const { MockAIProvider } = await import('../packages/ai/providers/mock-provider.mjs');
  let capturedSystemBasic, capturedSystemFull;
  const chartA = await makeChart('1990-01-01', '10:00', 'male');
  const chartB = await makeChart('1992-05-05', '14:00', 'female');

  const spyProvider = {
    complete: async ({ system }) => {
      capturedSystemBasic = system;
      return { data: { summary: 'test' }, usage: {} };
    },
  };
  await generateCompatibilityAnalysis({ chartA, chartB, tier: 'basic', aiProvider: spyProvider });
  assert.ok(capturedSystemBasic.includes('짧고 간단하게'));

  const spyProviderFull = {
    complete: async ({ system }) => {
      capturedSystemFull = system;
      return { data: { summary: 'test' }, usage: {} };
    },
  };
  await generateCompatibilityAnalysis({ chartA, chartB, tier: 'full', aiProvider: spyProviderFull });
  assert.ok(capturedSystemFull.includes('자세하게'));
});

test('C1: 시스템 프롬프트가 금지 표현 원칙(천생연분/악연/용신/신강/신약, 확정적 예언 금지)을 명시한다', async () => {
  const chartA = await makeChart('1990-01-01', '10:00', 'male');
  const chartB = await makeChart('1992-05-05', '14:00', 'female');
  let capturedSystem;
  const spyProvider = { complete: async ({ system }) => { capturedSystem = system; return { data: { summary: 'x' }, usage: {} }; } };
  await generateCompatibilityAnalysis({ chartA, chartB, tier: 'basic', aiProvider: spyProvider });
  for (const forbidden of ['천생연분', '악연', '용신', '신강', '신약']) {
    assert.ok(capturedSystem.includes(forbidden), `금지 목록에 "${forbidden}"이 명시되어야 함`);
  }
  assert.ok(capturedSystem.includes('확정적') || capturedSystem.includes('반드시'));
});

test('D1: 라우트 소스에 잘못된 tier 값을 400으로 거부하는 검증이 있다(코드 레벨 확인)', async () => {
  const { readFile } = await import('node:fs/promises');
  const source = await readFile('./apps/api/src/routes/compatibility.mjs', 'utf-8');
  assert.ok(source.includes("tier !== 'basic' && tier !== 'full'"));
});

test("D2: server.mjs가 궁합 분석에 기존 childCoachAiProviderFactory(Luna)/aiProviderFactory(Terra)를 재사용한다(새 모델 안 만듦)", async () => {
  const { readFile } = await import('node:fs/promises');
  const source = await readFile('./apps/api/src/server.mjs', 'utf-8');
  assert.ok(source.includes('compatibilityRouter({ basicAiProviderFactory: childCoachAiProviderFactory, fullAiProviderFactory: aiProviderFactory })'));
});
