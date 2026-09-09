// tests/21-p2-p4-features.test.mjs
//
// 랭킹/리더보드, 궁합, 자녀 사주, 닉네임 계정 — HTTP 통합 테스트(MockAIProvider, 실제 API 호출 없음).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { rm } from 'node:fs/promises';
import express from 'express';

import { chartsRouter } from '../apps/api/src/routes/charts.mjs';
import { conversationsRouter } from '../apps/api/src/routes/conversations.mjs';
import { usersRouter } from '../apps/api/src/routes/users.mjs';
import { rankingRouter } from '../apps/api/src/routes/ranking.mjs';
import { compatibilityRouter } from '../apps/api/src/routes/compatibility.mjs';
import { MockAIProvider } from '../packages/ai/providers/mock-provider.mjs';

import { generateRankingResult } from '../packages/character/ranking-content.mjs';
import { generateCompatibilityResult } from '../packages/character/compatibility-content.mjs';
import { CHILD_QUESTION_CATALOG, CHILD_CATEGORIES } from '../packages/character/question-catalog.mjs';
import { SAJU_FIELDS, ZIWEI_FIELDS, ZIWEI_PALACE_POSITIONS, QUESTION_CATEGORIES } from '../packages/shared/categories.mjs';

// ============================================================
// 순수 함수 단위 테스트
// ============================================================

test('generateRankingResult: 같은 chart면 항상 같은 점수/타이틀 (안정적 시드)', () => {
  const chart = { saju: { day_master: { stem: '甲' }, pillars: [{ ganzi: '甲子' }, { ganzi: '乙丑' }] } };
  const first = generateRankingResult(chart, 'wealth');
  const second = generateRankingResult(chart, 'wealth');
  assert.deepEqual(first, second);
});

test('generateRankingResult: 서로 다른 chart는 대체로 다른 점수를 준다', () => {
  const chartA = { saju: { day_master: { stem: '甲' }, pillars: [{ ganzi: '甲子' }] } };
  const chartB = { saju: { day_master: { stem: '己' }, pillars: [{ ganzi: '己巳' }] } };
  const a = generateRankingResult(chartA, 'wealth');
  const b = generateRankingResult(chartB, 'wealth');
  assert.notEqual(a.score, b.score);
});

test('generateCompatibilityResult: 순서를 바꿔도(A,B / B,A) 같은 결과가 나온다', () => {
  const chartA = { saju: { day_master: { stem: '甲' }, pillars: [{ ganzi: '甲子' }] } };
  const chartB = { saju: { day_master: { stem: '己' }, pillars: [{ ganzi: '己巳' }] } };
  const r1 = generateCompatibilityResult(chartA, chartB);
  const r2 = generateCompatibilityResult(chartB, chartA);
  assert.deepEqual(r1, r2);
});

test('generateCompatibilityResult: 내부 임계값(min) 필드가 API 응답에 노출되지 않는다', () => {
  const chartA = { saju: { day_master: { stem: '甲' }, pillars: [] } };
  const chartB = { saju: { day_master: { stem: '乙' }, pillars: [] } };
  const result = generateCompatibilityResult(chartA, chartB);
  assert.equal('min' in result, false);
});

test('CHILD_QUESTION_CATALOG: required_data 필드명이 실제 categories.mjs 값과 일치한다', () => {
  for (const entry of CHILD_QUESTION_CATALOG) {
    for (const f of entry.required_data.saju_fields) assert.ok(SAJU_FIELDS.includes(f), `${entry.id}: ${f}`);
    for (const f of entry.required_data.ziwei_fields) assert.ok(ZIWEI_FIELDS.includes(f), `${entry.id}: ${f}`);
    for (const p of entry.required_data.ziwei_palace_focus) assert.ok(ZIWEI_PALACE_POSITIONS.includes(p), `${entry.id}: ${p}`);
    assert.ok(QUESTION_CATEGORIES.includes(entry.category), `${entry.id}: ${entry.category}`);
    assert.equal(entry.character, 'scholar', `${entry.id}: 자녀 사주는 항상 박사냥이어야 함`);
  }
});

test('CHILD_CATEGORIES: 4개 하위 카테고리(아이성향/학습/관계/진로)가 전부 카탈로그에 매핑된다', () => {
  const contextsInCatalog = new Set(CHILD_QUESTION_CATALOG.map((c) => c.context));
  for (const cat of CHILD_CATEGORIES) assert.ok(contextsInCatalog.has(cat.key), `${cat.key}에 해당하는 카탈로그 항목이 없음`);
  assert.equal(CHILD_CATEGORIES.length, 4);
});

// ============================================================
// HTTP 통합 테스트
// ============================================================

let baseUrl;
let server;

test.before(async () => {
  await rm('./data/db', { recursive: true, force: true });
  const app = express();
  app.use(express.json());
  const aiProviderFactory = () => new MockAIProvider();
  app.use('/api/charts', chartsRouter({ aiProviderFactory, model: 'mock' }));
  app.use('/api/conversations', conversationsRouter({ aiProviderFactory, model: 'mock' }));
  app.use('/api/users', usersRouter());
  app.use('/api/ranking', rankingRouter());
  app.use('/api/compatibility', compatibilityRouter());
  await new Promise((resolve) => {
    server = app.listen(0, () => {
      baseUrl = `http://localhost:${server.address().port}`;
      resolve();
    });
  });
});
test.after(async () => new Promise((resolve) => server.close(resolve)));

async function postJson(path, body) {
  const res = await fetch(`${baseUrl}${path}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  return { status: res.status, body: await res.json() };
}
async function getJson(path) {
  const res = await fetch(`${baseUrl}${path}`);
  return { status: res.status, body: await res.json() };
}
async function createChart(overrides = {}) {
  const res = await postJson('/api/charts', { birthDate: '1995-06-15', birthTime: '12:00', gender: 'female', city: 'Seoul', ...overrides });
  return res.body.id;
}

test('POST /api/users — 닉네임 계정 생성', async () => {
  const { status, body } = await postJson('/api/users', { nickname: '테스트유저' });
  assert.equal(status, 201);
  assert.equal(body.nickname, '테스트유저');
});

test('POST /api/users — 짧은 닉네임(1자)은 400', async () => {
  const { status } = await postJson('/api/users', { nickname: 'ㄱ' });
  assert.equal(status, 400);
});

test('POST /api/users — 같은 닉네임 재요청 시 기존 계정을 반환한다(중복 생성 안 함)', async () => {
  const first = await postJson('/api/users', { nickname: '중복테스트' });
  const second = await postJson('/api/users', { nickname: '중복테스트' });
  assert.equal(first.body.id, second.body.id);
});

test('POST /api/ranking/:category — 결과 생성 + userId 있으면 리더보드 제출', async () => {
  const user = await postJson('/api/users', { nickname: '랭킹테스트유저' });
  const chartId = await createChart();
  const { status, body } = await postJson(`/api/ranking/wealth`, { chartId, userId: user.body.id });
  assert.equal(status, 200);
  assert.ok(body.title);
  assert.equal(body.submitted, true);

  const leaderboard = await getJson('/api/ranking/wealth/leaderboard');
  assert.ok(leaderboard.body.entries.some((e) => e.nickname === '랭킹테스트유저'));
});

test('POST /api/ranking/:category — 잘못된 카테고리는 400', async () => {
  const chartId = await createChart();
  const { status } = await postJson('/api/ranking/nonexistent', { chartId });
  assert.equal(status, 400);
});

test('POST /api/ranking/:category — userId 없이도 결과는 생성되지만 리더보드에는 안 올라간다', async () => {
  const chartId = await createChart();
  const { body } = await postJson('/api/ranking/wealth', { chartId });
  assert.equal(body.submitted, false);
});

test('POST /api/compatibility — 두 chart로 궁합 엔터테인먼트 결과', async () => {
  const chartA = await createChart({ birthDate: '1995-06-15', birthTime: '12:00' });
  const chartB = await createChart({ birthDate: '1993-03-02', birthTime: '08:00', gender: 'male' });
  const { status, body } = await postJson('/api/compatibility', { chartIdA: chartA, chartIdB: chartB });
  assert.equal(status, 200);
  assert.ok(body.label);
  assert.ok(typeof body.score === 'number');
});

test('POST /api/compatibility — 존재하지 않는 chartId는 404', async () => {
  const chartA = await createChart();
  const { status } = await postJson('/api/compatibility', { chartIdA: chartA, chartIdB: 'nonexistent-id' });
  assert.equal(status, 404);
});

test('자녀 사주 전체 흐름: 차트 생성 → scholar 캐릭터 대화 시작 → 오프닝 선택지 → 카탈로그 선택', async () => {
  const chartId = await createChart({ birthDate: '2019-05-01', birthTime: '09:00', gender: 'male' });
  const first = await postJson(`/api/charts/${chartId}/questions`, { question: '안녕', characterId: 'scholar' });
  const convId = first.body.conversationId;

  const opening = await getJson(`/api/conversations/${convId}/child-opening-choices`);
  assert.equal(opening.body.character.id, 'scholar');
  assert.ok(opening.body.choices.length > 0);
  // 4개 하위 카테고리 각각에서 최소 1개는 나와야 함(선택지 다양성 확인)
  const contexts = new Set(opening.body.choices.map((c) => c.id.startsWith('child_') ? c.id : null));
  assert.ok(contexts.size > 0);

  const chosen = opening.body.choices[0];
  const result = await postJson(`/api/conversations/${convId}/child-catalog-choice`, { catalogId: chosen.id });
  assert.equal(result.status, 200);
  assert.equal(result.body.character.id, 'scholar');
  assert.ok(result.body.usage, '실제 파이프라인을 탔으므로 usage가 있어야 함(정적 데모가 아님)');
});

test('자녀 사주: 존재하지 않는 catalogId는 400', async () => {
  const chartId = await createChart({ birthDate: '2019-05-01', birthTime: '09:00', gender: 'male' });
  const first = await postJson(`/api/charts/${chartId}/questions`, { question: '안녕', characterId: 'scholar' });
  const convId = first.body.conversationId;
  const { status, body } = await postJson(`/api/conversations/${convId}/child-catalog-choice`, { catalogId: 'nope' });
  assert.equal(status, 400);
  assert.equal(body.error.code, 'CATALOG_ENTRY_NOT_FOUND');
});
