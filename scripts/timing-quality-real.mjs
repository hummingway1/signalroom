// scripts/timing-quality-real.mjs
//
// npm run analyze:timing
//
// 신규 3개 시기 질문(TEST2/3/4)을 실제 OpenAI API로 검증한다. scripts/targeted-quality-real.mjs와
// 완전히 같은 패턴 — 새 provider/새 pipeline 없음, runTargetedQualityEvaluation을 questions만
// 바꿔서 재사용한다. 3개 질문 × (Router 1회 + 분석 1회) = 실제 HTTP 요청 정확히 6회.
import { readFile } from 'node:fs/promises';
import { loadEnvFile } from '../packages/shared/load-env.mjs';
import { OpenAIProvider } from '../packages/ai/providers/openai-provider.mjs';
import { runTargetedQualityEvaluation } from './targeted-quality-runner-core.mjs';
import { TIMING_QUESTIONS } from '../tests/targeted-quality/timing-questions.mjs';

await loadEnvFile();

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const OPENAI_MODEL = process.env.OPENAI_MODEL;

if (!OPENAI_API_KEY || !OPENAI_MODEL) {
  console.log(`
❌ Timing-quality 실제 평가를 실행할 수 없습니다.

  OPENAI_API_KEY   (현재: ${OPENAI_API_KEY ? '설정됨' : '설정 안 됨'})
  OPENAI_MODEL     (현재: ${OPENAI_MODEL ? '설정됨' : '설정 안 됨'})

.env에 두 값을 채우고 다시 실행하세요: npm run analyze:timing
Mock으로 배관만 검증하려면: npm run analyze:timing:dryrun
`);
  process.exit(0);
}

console.log(`Model: ${OPENAI_MODEL}`);
console.log('Fixture: main_quality (data/fixtures/adult-main-quality-chart.json) — 己未 대운/2027=丁未/귀문 존재 확인됨');
console.log('3개 질문 × (Router 1회 + 분석 1회) = 실제 HTTP 요청 정확히 6회 예정.\n');

const canonical = JSON.parse(await readFile('./data/fixtures/adult-main-quality-chart.json', 'utf-8'));
const provider = new OpenAIProvider({ apiKey: OPENAI_API_KEY, model: OPENAI_MODEL });

const { totalUsage, passCount, totalCount } = await runTargetedQualityEvaluation({
  provider,
  canonical,
  model: OPENAI_MODEL,
  outputDir: './tests/real-ai/timing-quality',
  isRealRun: true,
  questions: TIMING_QUESTIONS,
});

console.log('\n' + '='.repeat(60));
console.log(`전체 결과: ${passCount}/${totalCount} PASS`);
console.log('총 토큰 사용량:', JSON.stringify(totalUsage, null, 2));
console.log('='.repeat(60));
console.log('\n✅ 결과 저장 완료: tests/real-ai/timing-quality/*.json');
console.log('\n특히 확인할 것: router 단계에서 annual_periods가 실제로 선택됐는지 — Mock 사전검증(STEP3)');
console.log('에서는 3개 질문 전부 실패했었다. 실제 GPT는 다를 수 있으니 이 결과가 핵심 확인 대상이다.');
