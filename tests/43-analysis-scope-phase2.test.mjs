// tests/43-analysis-scope-phase2.test.mjs
//
// Phase 2 — Analysis/Entitlement 연결. 이 환경엔 실제 Supabase Postgres 접근이 없으므로,
// DB가 필요한 §20 Test A~F(실제 소유권 조회/차단)는 이 파일로 검증할 수 없다 — 로컬에서 실제
// DB로 사용자가 직접 확인해야 한다(보고서에 명시). 여기서는 이 환경에서 실제로 실행 가능한
// 것만 검증한다: canonical type 검증(DB 호출 전에 걸러지는지), 하위 호환(기존 entitlement 흐름
// 무변경), migration 안전성(강제 FK 없음, nullable).
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { ANALYSIS_TYPES, VALID_ANALYSIS_TYPES, isValidAnalysisType } from '../packages/shared/analysis-types.mjs';
import { createAnalysisScope, AnalysisScopeError } from '../apps/api/src/repositories/analysis-scope-repository.mjs';

test('§3 A1: canonical analysis_type이 문서가 요구한 7개 도메인을 전부 포함한다', () => {
  const required = ['SAJU_DETAIL', 'ZIWEI_DETAIL', 'YEARLY_FORTUNE', 'CHILD_DETAIL', 'RELATIONSHIP_DETAIL', 'DATE_SELECTION', 'NAMING'];
  for (const type of required) {
    assert.ok(VALID_ANALYSIS_TYPES.includes(type), `${type}이 canonical 목록에 있어야 함`);
  }
});

test('§3 A2: 같은 개념이 여러 문자열로 중복 정의되지 않는다(대소문자/네이밍 일관성)', () => {
  for (const value of VALID_ANALYSIS_TYPES) {
    assert.equal(value, value.toUpperCase(), `${value}는 대문자 canonical 형식이어야 함`);
    assert.ok(!value.includes(' '));
  }
  // 중복 값 없음(예: 'SAJU'와 'SAJU_DETAIL'을 둘 다 만들어서 혼동을 유발하지 않는지)
  assert.equal(new Set(VALID_ANALYSIS_TYPES).size, VALID_ANALYSIS_TYPES.length);
});

test('isValidAnalysisType: 정의되지 않은 값은 거부한다', () => {
  assert.equal(isValidAnalysisType('SAJU'), false); // 'SAJU_DETAIL'만 유효, 'SAJU' 단독은 무효
  assert.equal(isValidAnalysisType('saju_detail'), false); // 소문자는 canonical 아님
  assert.equal(isValidAnalysisType(ANALYSIS_TYPES.SAJU_DETAIL), true);
});

test('§20 사전검증: createAnalysisScope는 잘못된 analysis_type을 DB 호출 전에 거부한다(비용/부작용 없이 즉시 실패)', async () => {
  await assert.rejects(
    () => createAnalysisScope({ userId: 'u1', analysisType: 'NOT_A_REAL_TYPE' }),
    (err) => {
      assert.ok(err instanceof AnalysisScopeError);
      assert.equal(err.code, 'INVALID_ANALYSIS_TYPE');
      return true;
    }
  );
});

test('§17 실측: DB 연결이 없는 이 환경에서는(실제 Supabase 없음) 명확한 DATABASE_URL 에러로 실패한다 — 가짜로 성공하지 않음', async () => {
  await assert.rejects(
    () => createAnalysisScope({ userId: 'u1', analysisType: ANALYSIS_TYPES.SAJU_DETAIL }),
    /DATABASE_URL/
  );
});

test('§10 migration 안전성: 마이그레이션 SQL이 entitlements.analysis_id/analysis_type을 nullable로 추가한다(기존 행 강제 변환 없음)', async () => {
  const { readFile } = await import('node:fs/promises');
  const sql = await readFile('./migrations/006_analysis_entitlement_link.sql', 'utf-8');
  assert.ok(sql.includes('add column if not exists analysis_id'));
  assert.ok(sql.includes('add column if not exists analysis_type'));
  // "not null" 강제가 없어야 한다(기존 entitlement가 NULL로 남을 수 있어야 하위호환 유지)
  const analysisIdLine = sql.split('\n').find((l) => l.includes('add column if not exists analysis_id'));
  assert.ok(!analysisIdLine.toLowerCase().includes('not null'));
});

test('§17 실측: analysis_scopes.chart_id/child_profile_id는 Postgres FK가 아니다(charts/child_profiles가 JSON 저장소이므로 cross-store FK 불가능함을 코드로 확정)', async () => {
  const { readFile } = await import('node:fs/promises');
  const sql = await readFile('./migrations/006_analysis_entitlement_link.sql', 'utf-8');
  const chartIdLine = sql.split('\n').find((l) => l.trim().startsWith('chart_id'));
  assert.ok(!chartIdLine.includes('references'), 'chart_id는 FK가 아니어야 함(JsonStore 대상이라 불가능)');
});

test('§18 하위호환: consumeQuestionEntitlement(기존 API)는 Phase 2 신규 컬럼과 무관하게 그대로 동작한다(소스 레벨 확인 — 시그니처 변경 없음)', async () => {
  const { readFile } = await import('node:fs/promises');
  const source = await readFile('./apps/api/src/repositories/payment-repository.mjs', 'utf-8');
  assert.ok(source.includes('export async function consumeQuestionEntitlement(entitlementId, userId)'), '기존 함수 시그니처가 그대로 유지되어야 함(하위 호환)');
});

test('§7 이름 충돌 방지: 기존 analysis-repository.mjs(질문별 로그, 다른 개념)는 이번 작업으로 수정되지 않았다', async () => {
  const { readFile } = await import('node:fs/promises');
  const source = await readFile('./apps/api/src/repositories/analysis-repository.mjs', 'utf-8');
  assert.ok(source.includes('recordAnalysis'), '기존 analysis-repository.mjs가 그대로 있어야 함(이름 충돌 방지를 위해 새 파일을 analysis-scope-repository.mjs로 분리했음)');
});
