// tests/32-free-tier-and-model-routing.test.mjs
//
// §11 무료 기본 사주 1회 제한(서버 강제, 프론트 버튼 숨김 아님) + §20 tier별 모델 라우팅 실연결.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { rm } from 'node:fs/promises';

import { createChartRecord } from '../apps/api/src/repositories/chart-repository.mjs';
import { createChildProfile } from '../apps/api/src/repositories/child-profile-repository.mjs';
import { generateChildGrowthAnalysis, summarizeChildAnalysisForDisplay } from '../apps/api/src/services/child-profile-service.mjs';
import { hasUsedFreeChildAnalysis } from '../apps/api/src/repositories/purchased-analysis-repository.mjs';
import { computeChart } from '../packages/chart-engine/compute.mjs';
import { buildCanonicalChart } from '../packages/canonical/transform.mjs';

test.before(async () => {
  await rm('./data/db', { recursive: true, force: true });
});

async function makeChart() {
  const raw = computeChart({ birthDate: '1985-02-14', birthTime: '06:10', gender: 'female', city: 'Seoul' });
  return createChartRecord({ canonical: buildCanonicalChart(raw, { engineVersion: 'test' }) });
}

test('§11: 첫 무료 기본 분석은 성공하고 tier=basic으로 저장된다', async () => {
  const chart = await makeChart();
  const profile = await createChildProfile({ userId: 'u1', chartId: chart.id });
  const { purchasedAnalysis } = await generateChildGrowthAnalysis({ childProfileId: profile.id, userId: 'u1', tier: 'basic' });
  assert.equal(purchasedAnalysis.tier, 'basic');
  assert.equal(await hasUsedFreeChildAnalysis('u1'), true);
});

test('§11: 같은 사용자가 다른 자녀 프로필로 두 번째 무료 분석을 시도하면 서버가 차단한다', async () => {
  const chart1 = await makeChart();
  const chart2 = await makeChart();
  const profile1 = await createChildProfile({ userId: 'u2', chartId: chart1.id });
  const profile2 = await createChildProfile({ userId: 'u2', chartId: chart2.id });
  await generateChildGrowthAnalysis({ childProfileId: profile1.id, userId: 'u2', tier: 'basic' });
  await assert.rejects(
    () => generateChildGrowthAnalysis({ childProfileId: profile2.id, userId: 'u2', tier: 'basic' }),
    (err) => err.code === 'FREE_TIER_EXHAUSTED'
  );
});

test('§11: 무료를 이미 쓴 사용자도 tier=full(유료)은 정상 진행된다(프론트 버튼 숨김이 아니라 tier로만 게이팅)', async () => {
  const chart1 = await makeChart();
  const chart2 = await makeChart();
  const profile1 = await createChildProfile({ userId: 'u3', chartId: chart1.id });
  const profile2 = await createChildProfile({ userId: 'u3', chartId: chart2.id });
  await generateChildGrowthAnalysis({ childProfileId: profile1.id, userId: 'u3', tier: 'basic' });
  const { purchasedAnalysis } = await generateChildGrowthAnalysis({ childProfileId: profile2.id, userId: 'u3', tier: 'full' });
  assert.equal(purchasedAnalysis.tier, 'full');
});

test('§11: 다른 사용자는 서로의 무료 횟수에 영향받지 않는다', async () => {
  const chart = await makeChart();
  const profile = await createChildProfile({ userId: 'u4-new', chartId: chart.id });
  assert.equal(await hasUsedFreeChildAnalysis('u4-new'), false);
});

test('§20: summarizeChildAnalysisForDisplay가 API 키 없을 때(aiProvider=null)도 안전하게 새니타이즈된 섹션 배열을 반환한다', async () => {
  const chart = await makeChart();
  const profile = await createChildProfile({ userId: 'u5', chartId: chart.id });
  const { purchasedAnalysis } = await generateChildGrowthAnalysis({ childProfileId: profile.id, userId: 'u5', tier: 'basic' });
  const sections = await summarizeChildAnalysisForDisplay({ analysisResult: purchasedAnalysis.analysis_json, tier: 'basic', aiProvider: null });
  assert.ok(Array.isArray(sections), '§2 — 가독성 개선으로 sections 배열을 반환해야 함');
  for (const section of sections) {
    assert.equal(typeof section.title, 'string');
    assert.equal(typeof section.body, 'string');
    // §16 새니타이즈 확인 — 허용되지 않은 기호가 없어야 함
    assert.ok(!/[^가-힣ㄱ-ㅎㅏ-ㅣa-zA-Z0-9\s.,?]/.test(section.body), `허용 안 된 기호 포함: ${section.body}`);
  }
});
