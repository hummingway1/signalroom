// tests/16-pipeline-predefined-routing.test.mjs
//
// packages/ai/pipeline.mjs의 predefinedRouting 파라미터 — 캐릭터/catalog UX 레이어가 Router AI
// 호출을 건너뛰기 위해 쓴다 (요청된 데이터가 catalog에 이미 정의되어 있으므로 "무슨 데이터가
// 필요한지" 모델에게 다시 물어보는 게 낭비). 기본값(생략)은 기존 동작과 완전히 동일해야 한다.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

import { runQuestionPipeline } from '../packages/ai/pipeline.mjs';
import { MockAIProvider } from '../packages/ai/providers/mock-provider.mjs';

let canonical;
test.before(async () => {
  canonical = JSON.parse(await readFile('./data/fixtures/adult-main-quality-chart.json', 'utf-8'));
});

test('predefinedRouting이 없으면 기존과 동일하게 Router AI 호출이 발생한다', async () => {
  let routerCalls = 0;
  const provider = new MockAIProvider();
  const orig = provider.complete.bind(provider);
  provider.complete = async (args) => {
    if (args.schemaName === 'question_router') routerCalls++;
    return orig(args);
  };
  await runQuestionPipeline({ provider, canonical, question: '내 성격이 어때?' });
  assert.equal(routerCalls, 1);
});

test('predefinedRouting을 주면 Router AI 호출이 완전히 스킵된다', async () => {
  let routerCalls = 0;
  const provider = new MockAIProvider();
  const orig = provider.complete.bind(provider);
  provider.complete = async (args) => {
    if (args.schemaName === 'question_router') routerCalls++;
    return orig(args);
  };
  const predefinedRouting = { categories: ['MONEY'], saju_fields: ['pillars', 'day_master'], ziwei_fields: ['palaces'], ziwei_palace_focus: ['wealth'], reasoning: 'catalog' };
  const result = await runQuestionPipeline({ provider, canonical, question: '그럼 나는 돈을 어떻게 벌어야 해?', predefinedRouting });
  assert.equal(routerCalls, 0);
  assert.deepEqual(result.router, predefinedRouting);
});

test('predefinedRouting 사용 시에도 extraction/분석 파이프라인은 정상 동작한다 (router 값이 그대로 extract에 쓰임)', async () => {
  const provider = new MockAIProvider();
  const predefinedRouting = { categories: ['PERSONALITY'], saju_fields: ['day_master', 'pillars'], ziwei_fields: ['life_palace', 'palaces'], ziwei_palace_focus: ['life'], reasoning: 'catalog' };
  const result = await runQuestionPipeline({ provider, canonical, question: '내 성격이 어때?', predefinedRouting });
  assert.ok('day_master' in result.extracted.saju);
  assert.ok('pillars' in result.extracted.saju);
  assert.ok(result.analysis.response.length > 0);
});

test('predefinedRouting 사용 시 usage에 Router 호출 비용이 포함되지 않는다 (분석 호출 1회분만)', async () => {
  const provider = new MockAIProvider();
  const predefinedRouting = { categories: ['GENERAL'], saju_fields: ['day_master'], ziwei_fields: [], ziwei_palace_focus: [], reasoning: 'catalog' };

  const withRouter = await runQuestionPipeline({ provider, canonical, question: '아무거나' });
  const withoutRouter = await runQuestionPipeline({ provider, canonical, question: '아무거나', predefinedRouting });

  assert.ok(withoutRouter.usage.total_tokens < withRouter.usage.total_tokens, 'Router 호출을 스킵하면 총 토큰이 더 적어야 함');
});
