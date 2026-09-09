// scripts/service-quality-dryrun.mjs
//
// npm run analyze:service-quality:dryrun
//
// ⚠️ NOT A REAL QUALITY EVALUATION. MockAIProvider text won't reflect real
// empathy/personalization/tone — most semantic checks will legitimately FAIL.
// This only proves the harness wiring (pipeline, file I/O, validator composition) works.

import { MockAIProvider } from '../packages/ai/providers/mock-provider.mjs';
import { runServiceQualityEvaluation } from './service-quality-runner-core.mjs';

console.log('⚠️  DRY RUN — MockAIProvider 사용 중. 실제 품질 평가가 아니라 하네스 배관 검증용입니다.\n');

const provider = new MockAIProvider();
const { summary, totalUsage, passCount, totalCount } = await runServiceQualityEvaluation({
  provider,
  model: 'mock',
  outputDir: './tests/real-ai/service-quality/_dryrun_mock_verification',
  isRealRun: false,
});

console.log('\n' + '='.repeat(60));
console.log(`DRY RUN 결과: ${passCount}/${totalCount}`);
console.log('요약:', JSON.stringify(summary, null, 2));
console.log('총 토큰(mock 추정치):', JSON.stringify(totalUsage, null, 2));
console.log('='.repeat(60));
console.log('\n✅ 하네스 동작 확인 완료: tests/real-ai/service-quality/_dryrun_mock_verification/*.json');
