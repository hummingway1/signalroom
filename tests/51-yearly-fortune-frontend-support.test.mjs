// tests/51-yearly-fortune-frontend-support.test.mjs
//
// §23 요구 테스트 항목 중 이 환경(실제 Postgres 없음)에서 실행 가능한 것들 — 실제 entitlement
// 보유 기반 렌더링(1~15)은 result_data 실제 값이 필요해서 로컬 실제 DB로 최종 확인해야 한다.
// 여기서는 API 보안/라우트 순서/기존 화면 회귀 보호를 검증한다.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';

// ============================================================
// 18. 기존 SAJU/CHILD/RELATIONSHIP 화면 회귀 보호
// ============================================================

test('18-1. ProductsScreen.jsx는 이번 작업으로 수정되지 않았다(기존 flat list 유지)', async () => {
  const source = await readFile('./apps/web/src/components/ProductsScreen.jsx', 'utf-8');
  assert.ok(!source.includes('YearlyFortune'), 'ProductsScreen 자체는 신년운세 전용 UI를 포함하지 않아야 함 — 별도 화면(YearlyFortuneScreen)으로 분리됨');
});

test('18-2. CompatibilityScreen 라우팅은 App.jsx에서 그대로 유지된다', async () => {
  const source = await readFile('./apps/web/src/App.jsx', 'utf-8');
  assert.ok(source.includes("screen === 'compatibility' && <CompatibilityScreen"));
});

// ============================================================
// 16. 기존 API 재사용 원칙 — 새 API는 꼭 필요한 것만
// ============================================================

test('16-1. 신규 API는 lookup/chat/조회 3개뿐이다(결제는 기존 orders API 재사용)', async () => {
  const source = await readFile('./apps/api/src/routes/yearly-fortune.mjs', 'utf-8');
  const routeCount = (source.match(/router\.(get|post)\(/g) ?? []).length;
  assert.equal(routeCount, 3);
});

test('16-2. 결제는 기존 POST /api/orders를 그대로 쓴다(새 결제 로직 없음)', async () => {
  const source = await readFile('./apps/web/src/components/YearlyFortuneScreen.jsx', 'utf-8');
  assert.ok(source.includes('api.createOrder('));
  assert.ok(!source.includes('confirmPayment'));
});

// ============================================================
// 15. 대상 격리 — 프론트가 analysisScopeId를 서버 응답에서만 받는지
// ============================================================

test('15-1. YearlyFortuneScreen은 analysisScopeId를 하드코딩하거나 URL에서 직접 파싱하지 않는다(lookup 응답에서만 옴)', async () => {
  const source = await readFile('./apps/web/src/components/YearlyFortuneScreen.jsx', 'utf-8');
  assert.ok(source.includes('found[0].id'));
  assert.ok(!source.includes('location.search'));
});

test('15-2. 최종 권한 판단은 서버가 하고, 프론트는 서버 응답을 그대로 표시만 한다(권한 계산 로직 없음)', async () => {
  const source = await readFile('./apps/web/src/components/YearlyFortuneResult.jsx', 'utf-8');
  assert.ok(!source.includes('authorized'));
});

// ============================================================
// 12. quota/만료 표시 — 서버 값만 사용
// ============================================================

test('12-1. quota/만료일은 서버 응답 필드를 그대로 표시한다(프론트에서 날짜 계산 안 함)', async () => {
  const source = await readFile('./apps/web/src/components/YearlyFortuneResult.jsx', 'utf-8');
  assert.ok(source.includes('chatScope?.remaining_quantity'));
  assert.ok(source.includes('chatScope?.expires_at'));
  assert.ok(!source.includes('setDate(') && !source.includes('addDays'));
});

// ============================================================
// 13. 만료 UX — 결과와 채팅을 혼동하지 않음
// ============================================================

test('13-1. 채팅 만료 여부와 무관하게 결과 섹션 렌더링 코드는 항상 실행된다', async () => {
  const source = await readFile('./apps/web/src/components/YearlyFortuneResult.jsx', 'utf-8');
  const summaryRenderIdx = source.indexOf('data.summary &&');
  const chatSectionIdx = source.indexOf('{isDetail && (');
  assert.ok(summaryRenderIdx > -1 && summaryRenderIdx < chatSectionIdx, '결과 섹션 렌더링은 만료 조건보다 먼저, 그와 무관하게 실행되어야 함');
});

// ============================================================
// 14. 자녀 UI 재사용 — 별도 화면 복제 금지
// ============================================================

test('14-1. 본인/자녀 전용 결과 화면이 따로 만들어지지 않았다(YearlyFortuneResult 하나만 공용으로 사용)', async () => {
  const files = await readdir('./apps/web/src/components');
  const yearlyFortuneFiles = files.filter((f) => f.toLowerCase().includes('yearlyfortune'));
  assert.equal(yearlyFortuneFiles.length, 2, 'YearlyFortuneScreen.jsx + YearlyFortuneResult.jsx 딱 2개여야 함');
});

test('14-2. MoreMenu에 신년운세 진입점 하나만 추가됐다(본인/자녀용 별도 메뉴 항목 없음)', async () => {
  const source = await readFile('./apps/web/src/components/MoreMenu.jsx', 'utf-8');
  const matches = (source.match(/yearlyFortune/g) ?? []).length;
  assert.equal(matches, 1);
});
