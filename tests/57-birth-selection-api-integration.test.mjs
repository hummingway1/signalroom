// tests/57-birth-selection-api-integration.test.mjs
//
// §다음 미완료 Phase(상품/entitlement/analysis_scope/API) — 결제->analysis_scope->API 조회까지의
// 실제 연결 검증. getOrGenerateBirthSelectionResult는 실제 Postgres(getPool())를 필요로 하므로,
// 이 환경(DB 없음)에서는 yearly-fortune-service 테스트와 동일한 패턴으로 소스 레벨 검증 +
// DATABASE_URL 에러로 정상 차단되는지만 확인한다.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

import { getOrGenerateBirthSelectionResult, BirthSelectionError } from '../apps/api/src/services/birth-selection-service.mjs';

test('1. getOrGenerateBirthSelectionResult는 result_data가 이미 있으면 LLM 호출 없이 즉시 반환한다(소스 레벨)', async () => {
  const source = await readFile('./apps/api/src/services/birth-selection-service.mjs', 'utf-8');
  const earlyReturnIdx = source.indexOf('if (scope.result_data)');
  const evaluateCallIdx = source.indexOf('await evaluateCandidates(');
  assert.ok(earlyReturnIdx > -1 && earlyReturnIdx < evaluateCallIdx, 'result_data 존재 체크가 AI 평가 호출보다 먼저 실행되어야 함');
});

test('2. 이 환경엔 실제 DB가 없어 소유권 검증 단계에서 DATABASE_URL 에러로 정상 차단된다', async () => {
  await assert.rejects(
    () => getOrGenerateBirthSelectionResult({ analysisScopeId: 'nonexistent', userId: 'u1', aiProvider: null }),
    /DATABASE_URL/
  );
});

test('3. analysis_type이 DATE_SELECTION이 아니면 명확한 에러 코드로 거부하는 분기가 소스에 존재한다', async () => {
  const source = await readFile('./apps/api/src/services/birth-selection-service.mjs', 'utf-8');
  assert.ok(source.includes("scope.analysis_type !== 'DATE_SELECTION'"));
  assert.ok(source.includes('NOT_DATE_SELECTION_SCOPE'));
});

test('4. date_selection_params가 없으면 PARAMS_NOT_FOUND로 명확히 실패한다(소스 확인)', async () => {
  const source = await readFile('./apps/api/src/services/birth-selection-service.mjs', 'utf-8');
  assert.ok(source.includes('PARAMS_NOT_FOUND'));
});

test('5. BirthSelectionError 클래스가 code를 보존한다', () => {
  const err = new BirthSelectionError('TEST_CODE', '테스트 메시지');
  assert.equal(err.code, 'TEST_CODE');
  assert.equal(err.message, '테스트 메시지');
});

test('6. GET /api/birth-selection/:analysisScopeId 라우트는 requireAuth가 적용되어 있다', async () => {
  const source = await readFile('./apps/api/src/routes/birth-selection.mjs', 'utf-8');
  assert.ok(source.includes("router.get('/:analysisScopeId', requireAuth"));
});

test('7. 소유권 검증은 요청 body/params의 userId가 아니라 req.user.id(세션)로만 이루어진다', async () => {
  const source = await readFile('./apps/api/src/routes/birth-selection.mjs', 'utf-8');
  assert.ok(source.includes('userId: req.user.id'));
});

test('8. DATE_SELECTION 상품이 29,000원/50회/30일/subscription_group=null/단일 tier로 시드된다', async () => {
  const sql = await readFile('./migrations/011_date_selection_product.sql', 'utf-8');
  assert.ok(sql.includes("'DATE_SELECTION', '출생일 택일', 29000"));
  assert.ok(sql.includes(", true, 50, 720, 'detail', null)"));
});

test('9. analysis_scopes/orders에 date_selection_params 컬럼이 추가된다(스키마 확장)', async () => {
  const sql = await readFile('./migrations/012_date_selection_scope.sql', 'utf-8');
  assert.ok(sql.includes('alter table orders add column if not exists subject_date_selection_params jsonb'));
  assert.ok(sql.includes('alter table analysis_scopes add column if not exists date_selection_params jsonb'));
});

test('10. DATE_SELECTION은 SUBSCRIPTION_GROUP_FOR_ANALYSIS_TYPE 매핑에 없다(MINGRI 구독과 완전 독립 확인)', async () => {
  const source = await readFile('./apps/api/src/services/entitlement-authorization-service.mjs', 'utf-8');
  const mapBlock = source.slice(source.indexOf('const SUBSCRIPTION_GROUP_FOR_ANALYSIS_TYPE'), source.indexOf('function buildDenialMessage'));
  assert.ok(!mapBlock.includes('DATE_SELECTION'), 'DATE_SELECTION이 이 매핑에 있으면 MINGRI 구독 fallback이 의도치 않게 적용됨');
});

test('11. confirmPaymentTransaction이 DATE_SELECTION용 analysis_scope 생성 분기를 갖는다(소스 확인)', async () => {
  const source = await readFile('./apps/api/src/repositories/payment-repository.mjs', 'utf-8');
  assert.ok(source.includes("analysisType === 'DATE_SELECTION' && order.subject_date_selection_params"));
  assert.ok(source.includes('date_selection_params'));
});

test('12. confirmPaymentTransaction의 트랜잭션 내부 order 조회 쿼리가 subject_date_selection_params를 select한다(실제 live DB에서 발견한 버그 회귀 방지 — 이 컬럼이 빠지면 order.subject_date_selection_params가 항상 undefined가 되어 DATE_SELECTION analysis_scope가 절대 생성되지 않는다)', async () => {
  const source = await readFile('./apps/api/src/repositories/payment-repository.mjs', 'utf-8');
  const queryLine = source.split('\n').find((line) => line.includes("from orders where id = $1 for update"));
  assert.ok(queryLine, 'orders를 for update로 조회하는 쿼리를 찾을 수 없음');
  assert.ok(queryLine.includes('subject_date_selection_params'), 'getOrderById(일반 조회)에만 추가하고 confirmPaymentTransaction 내부의 별도 쿼리에는 빠뜨리는 실수가 실제로 있었다 — 두 쿼리 모두 이 컬럼을 select해야 함');
});
