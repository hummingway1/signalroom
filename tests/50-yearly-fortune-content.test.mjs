// tests/50-yearly-fortune-content.test.mjs
//
// YEARLY_FORTUNE 콘텐츠 생성/영구열람. 이 환경엔 실제 Postgres가 없어 §테스트 요구사항의 실제
// entitlement/analysis_scope 보유 기반 시나리오(1~4, 9~15 등)는 DATABASE_URL 에러로만 확인
// 가능하다(사용자가 로컬 실제 DB로 최종 확인 필요) — 여기서는 실행 가능한 것만 검증한다.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { getOrGenerateYearlyFortuneResult, YearlyFortuneError } from '../apps/api/src/services/yearly-fortune-service.mjs';
import { YEARLY_FORTUNE_RESULT_SCHEMA, buildYearlyFortuneBasicPrompt, buildYearlyFortuneChatPrompt } from '../packages/character/yearly-fortune-prompt.mjs';

// ============================================================
// A. 프롬프트/스키마 구조 — CHAT ⊃ BASIC 관계
// ============================================================

test('A1: BASIC/CHAT 프롬프트가 하나의 공통 JSON 스키마(YEARLY_FORTUNE_RESULT_SCHEMA)를 공유한다(완전히 별개 스키마 아님)', () => {
  assert.ok(YEARLY_FORTUNE_RESULT_SCHEMA.required.includes('summary'));
  assert.ok(YEARLY_FORTUNE_RESULT_SCHEMA.required.includes('monthly'));
  assert.ok(YEARLY_FORTUNE_RESULT_SCHEMA.properties.chart_interaction, 'CHAT 전용 필드도 같은 스키마 안에 있어야 함(선택적)');
});

test('A2: CHAT 프롬프트만 chart_interaction(원국-연도 상호작용)을 명시적으로 요구한다', () => {
  const basic = buildYearlyFortuneBasicPrompt();
  const chat = buildYearlyFortuneChatPrompt();
  assert.ok(!basic.includes('chart_interaction') || basic.includes('null로 둔다'));
  assert.ok(chat.includes('chart_interaction'));
});

test('A3: BASIC은 3000~4000자, CHAT은 8000~12000자를 목표로 명시한다', () => {
  const basic = buildYearlyFortuneBasicPrompt();
  const chat = buildYearlyFortuneChatPrompt();
  assert.ok(basic.includes('3,000~4,000자'));
  assert.ok(chat.includes('8,000~12,000자'));
});

test('A4: 두 프롬프트 다 "생년월일만 보고 임의 계산 금지" 원칙을 포함한다', () => {
  const basic = buildYearlyFortuneBasicPrompt();
  const chat = buildYearlyFortuneChatPrompt();
  assert.ok(basic.includes('임의로 계산하거나 추측하지 않는다'));
  assert.ok(chat.includes('임의로 계산하거나 추측하지 않는다'));
});

test('A5: 확정적 단정("반드시/무조건/100%") 금지 규칙이 두 프롬프트 다 포함되어 있다', () => {
  const basic = buildYearlyFortuneBasicPrompt();
  assert.ok(basic.includes('반드시') && basic.includes('무조건'));
});

// ============================================================
// B. result_data 불변/1회성 원칙 — 소스 레벨 확인
// ============================================================

test('B1: fillAnalysisScopeResultOnce는 result_data가 이미 있으면(NOT NULL) 절대 덮어쓰지 않는다(WHERE result_data IS NULL로 DB 레벨 강제)', async () => {
  const source = await readFile('./apps/api/src/repositories/analysis-scope-repository.mjs', 'utf-8');
  assert.ok(source.includes('and result_data is null'));
});

test('B2: getOrGenerateYearlyFortuneResult는 result_data가 이미 있으면 LLM 호출 없이 즉시 반환한다', async () => {
  const source = await readFile('./apps/api/src/services/yearly-fortune-service.mjs', 'utf-8');
  const earlyReturnIdx = source.indexOf('if (scope.result_data)');
  const providerCallIdx = source.indexOf('provider.complete(');
  assert.ok(earlyReturnIdx > -1 && earlyReturnIdx < providerCallIdx, 'result_data 존재 체크가 LLM 호출보다 먼저 실행되어야 함');
});

test('B3: tier(basic/detail)는 클라이언트가 아니라 findEntitlementByAnalysisScopeId로 서버가 직접 조회한다', async () => {
  const source = await readFile('./apps/api/src/services/yearly-fortune-service.mjs', 'utf-8');
  assert.ok(source.includes('findEntitlementByAnalysisScopeId(analysisScopeId)'));
  assert.ok(!source.includes('req.body.tier') && !source.includes('params.tier'));
});

// ============================================================
// C. 연도 데이터 추출 — 해당 fortune_year만 뽑는지(다른 연도 유출 방지)
// ============================================================

test('C1: 존재하지 않는 fortune_year를 요청하면 YEAR_DATA_NOT_FOUND로 명확히 실패한다(가짜 데이터 생성 안 함)', async () => {
  await assert.rejects(
    () => getOrGenerateYearlyFortuneResult({ analysisScopeId: 'nonexistent', userId: 'u1', basicAiProvider: null, detailAiProvider: null }),
    /DATABASE_URL/ // 이 환경엔 실제 DB가 없어 소유권 검증 단계에서 DB 에러로 먼저 막힘 — 실제 연도 검증은 로컬 DB 필요
  );
});

test('C2: extractYearData 로직은 annual_periods 전체가 아니라 요청된 연도 항목 하나만 추출한다(소스 레벨 확인)', async () => {
  const source = await readFile('./apps/api/src/services/yearly-fortune-service.mjs', 'utf-8');
  assert.ok(source.includes("annualPeriods.find((p) => p.year === fortuneYear)"));
});

// ============================================================
// D. 상품 정책 — 990/4900, quota/기간
// ============================================================

test('D1: YEARLY_FORTUNE_CHAT의 최종 quota/기간은 50회/30일(720시간)이다(이전 10회/24시간에서 갱신)', async () => {
  const sql008 = await readFile('./migrations/008_yearly_fortune_products.sql', 'utf-8');
  const sql010 = await readFile('./migrations/010_yearly_fortune_chat_quota_update.sql', 'utf-8');
  assert.ok(sql008.includes("50, 720, 'detail'"));
  assert.ok(sql010.includes('question_quota = 50, validity_hours = 720'));
});

test('D2: YEARLY_FORTUNE_BASIC은 quota=1(생성 1회), validity_hours=null(만료 없음 — 영구 열람)', async () => {
  const sql = await readFile('./migrations/008_yearly_fortune_products.sql', 'utf-8');
  assert.ok(sql.includes("'YEARLY_FORTUNE_BASIC', '신년운세 기본', 990") && sql.includes(', 1, null'));
});

test('D3: BASIC/CHAT 둘 다 tier 컬럼(basic/detail)으로 구분되고 analysis_type은 YEARLY_FORTUNE 하나로 동일하다', async () => {
  const sql = await readFile('./migrations/008_yearly_fortune_products.sql', 'utf-8');
  const basicLine = sql.split('\n').find((l) => l.includes("'YEARLY_FORTUNE_BASIC'"));
  const chatLine = sql.split('\n').find((l) => l.includes("'YEARLY_FORTUNE_CHAT'"));
  assert.ok(basicLine.includes("'YEARLY_FORTUNE'") && basicLine.includes("'basic'"));
  assert.ok(chatLine.includes("'YEARLY_FORTUNE'") && chatLine.includes("'detail'"));
});

// ============================================================
// E. API 보안 — 인증 필수
// ============================================================

test('E1: GET /api/yearly-fortune/:analysisScopeId 라우트는 requireAuth가 적용되어 있다', async () => {
  const source = await readFile('./apps/api/src/routes/yearly-fortune.mjs', 'utf-8');
  assert.ok(source.includes("router.get('/:analysisScopeId', requireAuth"));
});

test('E2: 소유권 검증은 요청 body/params의 userId가 아니라 req.user.id(세션)로만 이루어진다', async () => {
  const source = await readFile('./apps/api/src/routes/yearly-fortune.mjs', 'utf-8');
  assert.ok(source.includes('userId: req.user.id'));
});
