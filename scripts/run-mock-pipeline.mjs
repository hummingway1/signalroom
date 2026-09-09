// scripts/run-mock-pipeline.mjs
//
// End-to-end dry run: Canonical JSON -> Question Router -> Extraction ->
// Saju+Ziwei+Cross-analysis+Response, using MockAIProvider (no API key or
// network needed). Demonstrates the full conversational architecture and
// prints token/extraction-savings stats for a few different question types.

import { readFile } from 'node:fs/promises';
import { runQuestionPipeline } from '../packages/ai/pipeline.mjs';
import { MockAIProvider } from '../packages/ai/providers/mock-provider.mjs';

const canonical = JSON.parse(await readFile('./data/canonical-chart-example.json', 'utf-8'));
const provider = new MockAIProvider();

const questions = [
  '내가 사업을 하는 게 직장생활보다 맞을까?',
  '나는 왜 일을 시작하면 초반에는 잘하는데 오래 유지하는 게 힘들까?',
  '올해 이직해도 될까?',
  '내 성격의 가장 큰 문제는 뭐야?',
];

let conversationSummary = '';

for (const question of questions) {
  console.log(`\n${'='.repeat(60)}`);
  console.log(`Q: ${question}`);
  console.log('='.repeat(60));

  const result = await runQuestionPipeline({ provider, canonical, question, conversationSummary });

  console.log('Router categories:', result.router.categories);
  console.log('Router saju_fields:', result.router.saju_fields);
  console.log('Router ziwei_fields:', result.router.ziwei_fields, 'palace_focus:', result.router.ziwei_palace_focus);
  console.log('Extraction savings:', `${(result.extractionSavings.reduction_ratio * 100).toFixed(1)}% smaller (approx ${result.extractionSavings.approx_full_tokens} -> ${result.extractionSavings.approx_extracted_tokens} tokens)`);
  console.log('Token usage (this turn):', result.usage);
  console.log('Response:', result.response);

  conversationSummary += `\n[${result.router.categories.join(',')}] Q: ${question}`;
}

console.log(`\n${'='.repeat(60)}`);
console.log('✅ Mock pipeline run complete — no real API calls were made.');
