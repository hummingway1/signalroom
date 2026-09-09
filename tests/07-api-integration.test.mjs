// tests/07-api-integration.test.mjs
//
// Full HTTP-level integration test. Builds the Express app in-process
// (no separate server process / no fixed port — avoids flakiness) and
// exercises every route in apps/api/src/routes/*.mjs with supertest-less
// plain `http` requests via a listening ephemeral port.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { rm } from 'node:fs/promises';
import express from 'express';

import { chartsRouter } from '../apps/api/src/routes/charts.mjs';
import { conversationsRouter } from '../apps/api/src/routes/conversations.mjs';
import { MockAIProvider } from '../packages/ai/providers/mock-provider.mjs';

let server;
let baseUrl;

test.before(async () => {
  await rm('./data/db', { recursive: true, force: true });

  const app = express();
  app.use(express.json());
  const aiProviderFactory = () => new MockAIProvider();
  app.use('/api/charts', chartsRouter({ aiProviderFactory, model: 'mock' }));
  app.use('/api/conversations', conversationsRouter({ aiProviderFactory, model: 'mock' }));

  await new Promise((resolve) => {
    server = app.listen(0, () => {
      baseUrl = `http://localhost:${server.address().port}`;
      resolve();
    });
  });
});

test.after(async () => {
  await new Promise((resolve) => server.close(resolve));
});

async function postJson(path, body) {
  const res = await fetch(`${baseUrl}${path}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  return { status: res.status, body: await res.json() };
}
async function getJson(path) {
  const res = await fetch(`${baseUrl}${path}`);
  return { status: res.status, body: await res.json() };
}

test('POST /api/charts creates a chart and returns valid canonical data', async () => {
  const { status, body } = await postJson('/api/charts', { birthDate: '2026-08-06', birthTime: '10:59', gender: 'male', city: 'Incheon' });
  assert.equal(status, 201);
  assert.ok(body.id);
  assert.ok(body.canonical.saju.day_master);
  assert.ok(body.canonical.ziwei.life_palace);
  assert.equal(body.canonical.natal, undefined);
});

test('POST /api/charts with missing fields returns 400', async () => {
  const { status, body } = await postJson('/api/charts', { gender: 'male' });
  assert.equal(status, 400);
  assert.equal(body.error.code, 'INVALID_INPUT');
});

test('POST /api/charts with unsupported timezone returns 400 with typed error code', async () => {
  const { status, body } = await postJson('/api/charts', { birthDate: '2026-08-06', birthTime: '10:59', gender: 'male', city: 'NYC', timezone: 'America/New_York' });
  assert.equal(status, 400);
  assert.equal(body.error.code, 'UNSUPPORTED_TIMEZONE');
});

test('GET /api/charts/:id returns the created chart', async () => {
  const created = await postJson('/api/charts', { birthDate: '2026-08-06', birthTime: '10:59', gender: 'female', city: 'Seoul' });
  const { status, body } = await getJson(`/api/charts/${created.body.id}`);
  assert.equal(status, 200);
  assert.equal(body.id, created.body.id);
});

test('GET /api/charts/:id with unknown id returns 404', async () => {
  const { status, body } = await getJson('/api/charts/00000000-0000-0000-0000-000000000000');
  assert.equal(status, 404);
  assert.equal(body.error.code, 'NOT_FOUND');
});

test('POST /api/charts/:id/questions answers a question and returns a new conversationId', async () => {
  const created = await postJson('/api/charts', { birthDate: '2026-08-06', birthTime: '10:59', gender: 'male', city: 'Incheon' });
  const { status, body } = await postJson(`/api/charts/${created.body.id}/questions`, { question: '내 성격이 궁금해' });
  assert.equal(status, 200);
  assert.ok(body.conversationId);
  assert.ok(body.response.length > 0);
  assert.ok(body.usage.total_tokens > 0);
});

test('POST /api/charts/:id/questions with missing question returns 400', async () => {
  const created = await postJson('/api/charts', { birthDate: '2026-08-06', birthTime: '10:59', gender: 'male', city: 'Incheon' });
  const { status, body } = await postJson(`/api/charts/${created.body.id}/questions`, {});
  assert.equal(status, 400);
  assert.equal(body.error.code, 'INVALID_INPUT');
});

test('POST /api/charts/:id/questions for unknown chart returns 404', async () => {
  const { status } = await postJson('/api/charts/00000000-0000-0000-0000-000000000000/questions', { question: '질문' });
  assert.equal(status, 404);
});

test('conversation continuation over HTTP: POST /api/conversations/:id/messages reuses the conversation', async () => {
  const created = await postJson('/api/charts', { birthDate: '2026-08-06', birthTime: '10:59', gender: 'male', city: 'Incheon' });
  const first = await postJson(`/api/charts/${created.body.id}/questions`, { question: '이직 고민' });
  const convId = first.body.conversationId;

  const second = await postJson(`/api/conversations/${convId}/messages`, { question: '그럼 사업은?' });
  assert.equal(second.status, 200);
  assert.equal(second.body.conversationId, convId);

  const history = await getJson(`/api/conversations/${convId}`);
  assert.equal(history.status, 200);
  assert.equal(history.body.messages.length, 4);
});

test('GET /api/conversations/:id/messages with missing question returns 400', async () => {
  const created = await postJson('/api/charts', { birthDate: '2026-08-06', birthTime: '10:59', gender: 'male', city: 'Incheon' });
  const first = await postJson(`/api/charts/${created.body.id}/questions`, { question: '질문1' });
  const { status, body } = await postJson(`/api/conversations/${first.body.conversationId}/messages`, {});
  assert.equal(status, 400);
  assert.equal(body.error.code, 'INVALID_INPUT');
});
