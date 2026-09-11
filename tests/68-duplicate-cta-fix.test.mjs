// tests/68-duplicate-cta-fix.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

test('1. ChatScreen은 마지막 메시지에 product_selection/signup_cta 카드가 있으면 fallback 배너를 숨긴다', async () => {
  const source = await readFile('./apps/web/src/components/ChatScreen.jsx', 'utf-8');
  assert.ok(source.includes("lastMessage?.card?.type === 'product_selection' || lastMessage?.card?.type === 'signup_cta'"));
  assert.ok(source.includes('!lastMessageHasCard'));
});

test('2. 카드가 없는 경우(기존 authorization 거부 경로)에는 배너가 여전히 조건부로 표시될 수 있다(완전히 제거되지 않음)', async () => {
  const source = await readFile('./apps/web/src/components/ChatScreen.jsx', 'utf-8');
  assert.ok(source.includes('const showPurchaseBanner = purchaseRequired && (purchaseRequired.loginRequired || purchaseRequired.productCode) && !lastMessageHasCard;'));
});
