// scripts/timing-quality-dryrun.mjs
//
// npm run analyze:timing:dryrun
//
// ⚠️ 실제 품질 평가 아님. MockAIProvider는 fixture 값을 참조하지 않는 고정 텍스트를 반환하므로
// 대부분의 semantic check가 정상적으로 FAIL한다 — 이건 하네스(파이프라인 배관) 자체가 에러 없이
// 도는지만 확인하는 용도다.

import { readFile } from 'node:fs/promises';
import { MockAIProvider } from '../packages/ai/providers/mock-provider.mjs';
import { runTargetedQualityEvaluation } from './targeted-quality-runner-core.mjs';
import { TIMING_QUESTIONS } from '../tests/targeted-quality/timing-questions.mjs';

console.log('⚠️  DRY RUN — MockAIProvider 사용 중. 실제 품질 평가가 아니라 하네스 배관 검증용입니다.\n');

const canonical = JSON.parse(await readFile('./data/fixtures/adult-main-quality-chart.json', 'utf-8'));
const provider = new MockAIProvider();

const { totalUsage, passCount, totalCount } = await runTargetedQualityEvaluation({
  provider,
  canonical,
  model: 'mock',
  outputDir: './tests/real-ai/timing-quality/_dryrun_mock_verification',
  isRealRun: false,
  questions: TIMING_QUESTIONS,
});

console.log('\n' + '='.repeat(60));
console.log(`DRY RUN 결과 (하네스 검증용): ${passCount}/${totalCount}`);
console.log('총 토큰(mock 추정치):', JSON.stringify(totalUsage, null, 2));
console.log('='.repeat(60));
console.log('\n✅ 하네스 동작 확인 완료: tests/real-ai/timing-quality/_dryrun_mock_verification/*.json');
