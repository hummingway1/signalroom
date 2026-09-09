// tests/49-authorization-success-path-bug-fix.test.mjs
//
// 실제 Supabase 통합 검증(Phase8)에서 발견한 진짜 버그의 회귀 테스트. runQuestionPipeline이
// authorization을 통과(허용)한 성공 경로에서 authorization 필드 자체를 반환값에서 빼먹고
// 있었다 — 그 결과 conversation-service.mjs의 quota 차감 조건이 항상 false가 되어, 유료
// 분석이 실제로 성공했는데도 단 한 번도 차감이 실행되지 않는 과금 버그였다.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { runQuestionPipeline } from '../packages/ai/pipeline.mjs';
import { MockAIProvider } from '../packages/ai/providers/mock-provider.mjs';

test('허용된(authorized:true) 경로의 최종 반환값에도 authorization 필드가 포함된다(성공 경로에서 빠뜨리지 않음)', async () => {
  const provider = new MockAIProvider();
  const canonical = {
    saju: { day_master: '甲', pillars: {} },
    ziwei: {},
  };

  const result = await runQuestionPipeline({
    provider,
    canonical,
    question: '내 성격이 궁금해',
    authorizeBeforeAnalysis: async () => ({ authorized: true, entitlementId: 'test-entitlement-id' }),
  });

  assert.ok(result.authorization, 'authorization 필드 자체가 있어야 함(이전 버그: undefined였음)');
  assert.equal(result.authorization.authorized, true);
  assert.equal(result.authorization.entitlementId, 'test-entitlement-id', '호출자가 이 값으로 실제 차감을 수행해야 하므로 반드시 전달되어야 함');
  assert.ok(result.analysis, '분석 자체는 정상적으로 실행되어야 함');
});

test('거부된(authorized:false) 경로는 기존과 동일하게 authorization 필드를 포함한다(회귀 없음)', async () => {
  const provider = new MockAIProvider();
  const canonical = { saju: { day_master: '甲', pillars: {} }, ziwei: {} };

  const result = await runQuestionPipeline({
    provider,
    canonical,
    question: '내 성격이 궁금해',
    authorizeBeforeAnalysis: async () => ({ authorized: false, message: '권한이 없어요' }),
  });

  assert.equal(result.authorization.authorized, false);
  assert.equal(result.analysis, null, '거부됐으면 분석 자체가 없어야 함');
});

test('authorizeBeforeAnalysis를 아예 안 쓰는 기존 호출부는 authorization이 null이다(하위호환)', async () => {
  const provider = new MockAIProvider();
  const canonical = { saju: { day_master: '甲', pillars: {} }, ziwei: {} };

  const result = await runQuestionPipeline({ provider, canonical, question: '내 성격이 궁금해' });

  assert.equal(result.authorization, null);
  assert.ok(result.analysis, '기존 호출부는 authorization 개념 자체가 없으므로 항상 분석이 실행되어야 함');
});
