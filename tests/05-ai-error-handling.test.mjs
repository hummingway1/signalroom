// tests/05-ai-error-handling.test.mjs
// Spec §16 test #11: AI refusal
// Spec §16 test #12: malformed JSON
// Spec §16 test #13: API failure
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { runQuestionPipeline } from '../packages/ai/pipeline.mjs';
import { MockAIProvider } from '../packages/ai/providers/mock-provider.mjs';
import { AIProviderError } from '../packages/ai/providers/openai-provider.mjs';

let canonical;
test.before(async () => {
  canonical = JSON.parse(await readFile('./data/canonical-chart-example.json', 'utf-8'));
});

test('#11 AI refusal: pipeline propagates a typed AIProviderError with code REFUSAL', async () => {
  const provider = new MockAIProvider({ failureMode: 'refusal' });
  await assert.rejects(
    () => runQuestionPipeline({ provider, canonical, question: '아무 질문' }),
    (err) => err instanceof AIProviderError && err.code === 'REFUSAL'
  );
});

test('#12 malformed JSON: pipeline propagates a typed AIProviderError with code MALFORMED_JSON', async () => {
  const provider = new MockAIProvider({ failureMode: 'malformed' });
  await assert.rejects(
    () => runQuestionPipeline({ provider, canonical, question: '아무 질문' }),
    (err) => err instanceof AIProviderError && err.code === 'MALFORMED_JSON'
  );
});

test('#13 API failure (network): pipeline propagates a typed AIProviderError with code NETWORK_ERROR', async () => {
  const provider = new MockAIProvider({ failureMode: 'network_error' });
  await assert.rejects(
    () => runQuestionPipeline({ provider, canonical, question: '아무 질문' }),
    (err) => err instanceof AIProviderError && err.code === 'NETWORK_ERROR'
  );
});

test('#13 API failure (HTTP error): pipeline propagates a typed AIProviderError with code API_ERROR', async () => {
  const provider = new MockAIProvider({ failureMode: 'api_error' });
  await assert.rejects(
    () => runQuestionPipeline({ provider, canonical, question: '아무 질문' }),
    (err) => err instanceof AIProviderError && err.code === 'API_ERROR'
  );
});

test('OpenAIProvider constructor throws immediately if API key is missing (fails fast, no network call attempted)', async () => {
  const { OpenAIProvider } = await import('../packages/ai/providers/openai-provider.mjs');
  assert.throws(() => new OpenAIProvider({ apiKey: undefined, model: 'gpt-5' }), /OPENAI_API_KEY/);
});

test('OpenAIProvider constructor throws immediately if model is missing', async () => {
  const { OpenAIProvider } = await import('../packages/ai/providers/openai-provider.mjs');
  assert.throws(() => new OpenAIProvider({ apiKey: 'sk-test', model: undefined }), /OPENAI_MODEL/);
});
