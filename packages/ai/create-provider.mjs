// packages/ai/create-provider.mjs
//
// Factory: picks MockAIProvider if OPENAI_API_KEY is unset, otherwise
// OpenAIProvider. This lets `npm run dev` and `npm test` work with zero
// setup, while production simply needs the env vars set (spec §17).

import { OpenAIProvider } from './providers/openai-provider.mjs';
import { MockAIProvider } from './providers/mock-provider.mjs';

export function createAIProvider(env = process.env) {
  if (env.OPENAI_API_KEY && env.OPENAI_MODEL) {
    return new OpenAIProvider({ apiKey: env.OPENAI_API_KEY, model: env.OPENAI_MODEL });
  }
  return new MockAIProvider();
}
