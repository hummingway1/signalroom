// tests/06-conversation-continuation.test.mjs
// Spec §16 test #14: conversation continuation
//
// Tests the service layer directly (not over HTTP) so this suite has no
// port/network dependency and can't flake due to port collisions. Full
// HTTP-level API testing lives in tests/07-api-integration.test.mjs.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { readFile, rm } from 'node:fs/promises';

import { createChartRecord } from '../apps/api/src/repositories/chart-repository.mjs';
import { startConversation, askQuestion, getConversationHistory } from '../apps/api/src/services/conversation-service.mjs';
import { MockAIProvider } from '../packages/ai/providers/mock-provider.mjs';

test.before(async () => {
  await rm('./data/db', { recursive: true, force: true });
});

test('#14 conversation continuation: follow-up question reuses the same conversation and accumulates messages', async () => {
  const canonical = JSON.parse(await readFile('./data/canonical-chart-example.json', 'utf-8'));
  const chart = await createChartRecord({ userId: null, canonical, rawEngineOutput: null });
  const conversation = await startConversation({ chartId: chart.id });

  const provider = new MockAIProvider();

  const first = await askQuestion({ conversationId: conversation.id, question: '이직을 고민하고 있어', aiProvider: provider, model: 'mock' });
  assert.ok(first.response.length > 0);

  const afterFirst = await getConversationHistory(conversation.id);
  assert.equal(afterFirst.length, 2); // user + assistant

  const second = await askQuestion({ conversationId: conversation.id, question: '그럼 사업은 어때?', aiProvider: provider, model: 'mock' });
  assert.ok(second.response.length > 0);

  const afterSecond = await getConversationHistory(conversation.id);
  assert.equal(afterSecond.length, 4); // 2 more messages appended, not replaced
  assert.equal(afterSecond[0].content, '이직을 고민하고 있어');
  assert.equal(afterSecond[2].content, '그럼 사업은 어때?');
});

test('#14 conversation continuation: conversation summary grows across turns (context carried forward)', async () => {
  const canonical = JSON.parse(await readFile('./data/canonical-chart-example.json', 'utf-8'));
  const chart = await createChartRecord({ userId: null, canonical, rawEngineOutput: null });
  const conversation = await startConversation({ chartId: chart.id });
  const provider = new MockAIProvider();

  await askQuestion({ conversationId: conversation.id, question: '내 성격이 어때?', aiProvider: provider, model: 'mock' });
  await askQuestion({ conversationId: conversation.id, question: '그럼 연애는 어떻게 해야 해?', aiProvider: provider, model: 'mock' });

  const { getConversation } = await import('../apps/api/src/repositories/conversation-repository.mjs');
  const updated = await getConversation(conversation.id);
  assert.ok(updated.summary.includes('내 성격이 어때?'));
  assert.ok(updated.summary.includes('그럼 연애는 어떻게 해야 해?'));
});

test('askQuestion throws a typed error for a nonexistent conversation', async () => {
  const provider = new MockAIProvider();
  await assert.rejects(
    () => askQuestion({ conversationId: randomUUID(), question: '아무거나', aiProvider: provider, model: 'mock' }),
    (err) => err.code === 'CONVERSATION_NOT_FOUND'
  );
});

test('startConversation throws a typed error for a nonexistent chart', async () => {
  await assert.rejects(
    () => startConversation({ chartId: randomUUID() }),
    (err) => err.code === 'CHART_NOT_FOUND'
  );
});
