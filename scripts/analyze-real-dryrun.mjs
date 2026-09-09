// scripts/analyze-real-dryrun.mjs
//
// npm run analyze:real:dryrun
//
// ⚠️ THIS IS NOT A REAL AI QUALITY EVALUATION. ⚠️
//
// Runs the exact same harness as scripts/analyze-real.mjs (same 10 questions
// + conversation continuation, same validators, same file-writing logic),
// but with MockAIProvider instead of a real OpenAI call. Its only purpose is
// to prove the harness itself works correctly — file I/O, routing/extraction
// wiring, the automated validators, cost/token aggregation — WITHOUT
// spending any API budget or requiring a key.
//
// Output goes to tests/real-ai/_dryrun_mock_verification/ (never overwrites
// the real results in tests/real-ai/), and every file has "mock_mode": true.
// Do not use these results to judge answer quality — MockAIProvider always
// returns fixed "[MOCK]" placeholder text (packages/ai/providers/mock-provider.mjs).

import { readFile } from 'node:fs/promises';
import { MockAIProvider } from '../packages/ai/providers/mock-provider.mjs';
import { runFullEvaluation } from './real-ai-runner-core.mjs';
import { resolveFixture } from '../tests/real-ai/fixtures.mjs';

const fixture = resolveFixture(process.argv[2]);

console.log('⚠️  DRY RUN — MockAIProvider 사용 중. 이건 실제 AI 품질 평가가 아니라 하네스(harness) 자체의');
console.log('   동작 검증(파일 저장, 라우팅/추출 배관, 자동 검증 로직, 비용 집계)만을 위한 것입니다.');
console.log(`   fixture: ${fixture.id} — ${fixture.label}\n`);

const canonical = JSON.parse(await readFile(fixture.path, 'utf-8'));
const provider = new MockAIProvider();

const { stats } = await runFullEvaluation({
  provider,
  canonical,
  model: 'mock',
  outputDir: `./tests/real-ai/_dryrun_mock_verification/${fixture.outputSubdir}`,
  isRealRun: false,
  fixtureId: fixture.id,
});

console.log('\n' + '='.repeat(60));
console.log('DRY RUN 결과 (하네스 검증용, 실제 품질 평가 아님):');
console.log(JSON.stringify(stats, null, 2));
console.log('='.repeat(60));
console.log(`\n✅ 하네스 동작 확인 완료: tests/real-ai/_dryrun_mock_verification/${fixture.outputSubdir}/*.json`);
console.log('실제 평가를 하려면 OPENAI_API_KEY/OPENAI_MODEL을 설정하고 `npm run analyze:real`을 실행하세요.');
