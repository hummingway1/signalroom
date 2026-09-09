// tests/55-subscription-fallback-access-bug-fix.test.mjs
//
// 실제 Supabase 통합 검증(test:live-db 시나리오17)에서 발견한 진짜 버그의 회귀 테스트.
// findActiveEntitlementByAnalysisType이 access 판정과 quota 판정을 혼동해서, 자기 자신의
// remaining_quantity가 0이면 "이 analysis_type을 산 적이 없다"고 취급해버렸다 — 그 결과
// MINGRI_SUBSCRIPTION으로 quota만 보충하는 로직(Phase6 핵심 설계)에 아예 도달하지 못해서,
// 구독 상품을 사도 계속 채팅이 막히는 심각한 버그였다.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

test('findActiveEntitlementByAnalysisType의 WHERE절에 remaining_quantity > 0 필터가 없다(access와 quota를 혼동하지 않음)', async () => {
  const source = await readFile('./apps/api/src/repositories/payment-repository.mjs', 'utf-8');
  const fnBody = source.slice(
    source.indexOf('export async function findActiveEntitlementByAnalysisType'),
    source.indexOf('export async function findActiveYearlyFortuneChatEntitlement')
  );
  assert.ok(!fnBody.includes('and remaining_quantity > 0'), '이 함수는 access 판정 전용이므로 remaining_quantity 필터가 있으면 안 됨(구독 fallback을 무력화시킴)');
  assert.ok(fnBody.includes('expires_at is null or expires_at > now()'), '만료 여부는 여전히 확인해야 함(access의 정당한 조건)');
});

test('quota 소진 여부 판단은 여전히 호출부(entitlement-authorization-service.mjs)에서 entitlement.remaining_quantity로 이루어진다(구독 fallback 경로 보존)', async () => {
  const source = await readFile('./apps/api/src/services/entitlement-authorization-service.mjs', 'utf-8');
  assert.ok(source.includes('entitlement.remaining_quantity > 0'), 'quota 존재 여부는 여기서 확인해야 구독 fallback으로 넘어갈 수 있음');
  assert.ok(source.includes('findActiveSubscriptionQuota(userId, subscriptionGroup)'), '자기 quota가 0이면 구독으로 대체 조회하는 경로가 있어야 함');
});
