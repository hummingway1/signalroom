// tests/64-order-field-name-bug.test.mjs
//
// §실제로 발견한 결제 차단 버그 — 백엔드는 항상 camelCase(orderName)로 응답하는데, 5개
// 구매 화면 전부가 order.order_name(snake_case)을 참조해서 Toss에 orderName: undefined가
// 전달되고 있었다. 실제 Toss 에러: "잘못된 요청입니다. - 상품 명은 필수 입니다."
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const SCREENS = [
  'apps/web/src/components/ProductsScreen.jsx',
  'apps/web/src/components/YearlyFortuneScreen.jsx',
  'apps/web/src/components/MembershipScreen.jsx',
  'apps/web/src/components/BirthSelectionScreen.jsx',
  'apps/web/src/components/NamingScreen.jsx',
];

test('1. 백엔드 POST /api/orders는 order를 항상 camelCase(orderName)로 응답한다', async () => {
  const routeSource = await readFile('./apps/api/src/routes/orders.mjs', 'utf-8');
  assert.ok(routeSource.includes('return res.status(201).json({ order });'));
  const repoSource = await readFile('./apps/api/src/repositories/order-repository.mjs', 'utf-8');
  assert.ok(repoSource.includes('return { id, userId, productId, orderName, amount'));
});

for (const screen of SCREENS) {
  test(`2. ${screen}는 order.orderName(camelCase)을 참조한다`, async () => {
    const source = await readFile(`./${screen}`, 'utf-8');
    assert.ok(!source.includes('order.order_name'), `${screen}에 order.order_name(snake_case) 참조가 남아있으면 안 됨`);
    assert.ok(source.includes('orderName: order.orderName'));
  });
}
