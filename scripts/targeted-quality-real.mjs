// scripts/targeted-quality-real.mjs
//
// npm run analyze:targeted
//
// Runs the 5 targeted-quality tests (세운/귀문관살/대운+세운 실제 활용 검증) against the REAL
// OpenAI Responses API. Reuses the exact same OpenAIProvider/pipeline as scripts/analyze-real.mjs
// — no new AI provider, no new HTTP client. Always uses the main_quality fixture (the only one
// with real annual_periods/gwimun data to actually verify against).
//
// Requires OPENAI_API_KEY + OPENAI_MODEL (read from .env / process.env, never hardcoded). If
// either is missing, prints guidance and exits without calling anything — same contract as
// scripts/analyze-real.mjs.

import { readFile } from 'node:fs/promises';
import { loadEnvFile } from '../packages/shared/load-env.mjs';
import { OpenAIProvider } from '../packages/ai/providers/openai-provider.mjs';
import { runTargetedQualityEvaluation } from './targeted-quality-runner-core.mjs';

await loadEnvFile();

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const OPENAI_MODEL = process.env.OPENAI_MODEL;

if (!OPENAI_API_KEY || !OPENAI_MODEL) {
  console.log(`
❌ Targeted-quality 실제 평가를 실행할 수 없습니다.

  OPENAI_API_KEY   (현재: ${OPENAI_API_KEY ? '설정됨' : '설정 안 됨'})
  OPENAI_MODEL     (현재: ${OPENAI_MODEL ? '설정됨' : '설정 안 됨'})

.env에 두 값을 채우고 다시 실행하세요: npm run analyze:targeted
Mock으로 배관만 검증하려면: npm run analyze:targeted:dryrun
`);
  process.exit(0);
}

console.log(`Model: ${OPENAI_MODEL}`);
console.log('Fixture: main_quality (data/fixtures/adult-main-quality-chart.json)');
console.log('5개 질문 × (Router 1회 + 분석 1회) = 실제 HTTP 요청 10회 예정.\n');

const canonical = JSON.parse(await readFile('./data/fixtures/adult-main-quality-chart.json', 'utf-8'));
const provider = new OpenAIProvider({ apiKey: OPENAI_API_KEY, model: OPENAI_MODEL });

const { totalUsage, passCount, totalCount } = await runTargetedQualityEvaluation({
  provider,
  canonical,
  model: OPENAI_MODEL,
  outputDir: './tests/real-ai/targeted-quality',
  isRealRun: true,
});

console.log('\n' + '='.repeat(60));
console.log(`전체 결과: ${passCount}/${totalCount} PASS`);
console.log('총 토큰 사용량:', JSON.stringify(totalUsage, null, 2));
console.log('='.repeat(60));
console.log('\n✅ 결과 저장 완료: tests/real-ai/targeted-quality/*.json');
