// scripts/service-quality-real.mjs
//
// npm run analyze:service-quality
//
// Q6~Q10 (자기인식/개인화/일관성/과잉긍정방지/캐릭터톤 불변성) 실제 API 실행.
// 기존 OpenAIProvider/pipeline 재사용 — 새 provider 없음.

import { loadEnvFile } from '../packages/shared/load-env.mjs';
import { OpenAIProvider } from '../packages/ai/providers/openai-provider.mjs';
import { runServiceQualityEvaluation } from './service-quality-runner-core.mjs';

await loadEnvFile();
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const OPENAI_MODEL = process.env.OPENAI_MODEL;

if (!OPENAI_API_KEY || !OPENAI_MODEL) {
  console.log(`
❌ 실행할 수 없습니다.
  OPENAI_API_KEY   (현재: ${OPENAI_API_KEY ? '설정됨' : '설정 안 됨'})
  OPENAI_MODEL     (현재: ${OPENAI_MODEL ? '설정됨' : '설정 안 됨'})
.env에 채우고 다시 실행하세요: npm run analyze:service-quality
Mock으로 배관만 검증하려면: npm run analyze:service-quality:dryrun
`);
  process.exit(0);
}

console.log(`Model: ${OPENAI_MODEL}`);
console.log('Q6~Q10 실행 — 예상 HTTP 요청: Q6(2) + Q7(4) + Q8(6) + Q9(2) + Q10(4) = 18회\n');

const provider = new OpenAIProvider({ apiKey: OPENAI_API_KEY, model: OPENAI_MODEL });
const { summary, totalUsage, passCount, totalCount } = await runServiceQualityEvaluation({
  provider,
  model: OPENAI_MODEL,
  outputDir: './tests/real-ai/service-quality',
  isRealRun: true,
});

console.log('\n' + '='.repeat(60));
console.log(`전체 결과: ${passCount}/${totalCount} PASS`);
console.log('요약:', JSON.stringify(summary, null, 2));
console.log('총 토큰 사용량:', JSON.stringify(totalUsage, null, 2));
console.log('='.repeat(60));
console.log('\n✅ 결과 저장 완료: tests/real-ai/service-quality/*.json');
console.log('⚠️  자동 PASS는 최소 안전망일 뿐입니다 — human_review_required 필드를 반드시 사람이 확인하세요.');
