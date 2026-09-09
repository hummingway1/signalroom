// scripts/targeted-quality-dryrun.mjs
//
// npm run analyze:targeted:dryrun
//
// ⚠️ NOT A REAL AI QUALITY EVALUATION. MockAIProvider returns fixed placeholder text that
// doesn't reference the fixture's actual 2027/gwimun/major_period values, so most semantic
// checks will legitimately FAIL here — that's expected and fine. This script only proves the
// harness itself (pipeline wiring, file I/O, base+semantic validator composition) works.

import { readFile } from 'node:fs/promises';
import { MockAIProvider } from '../packages/ai/providers/mock-provider.mjs';
import { runTargetedQualityEvaluation } from './targeted-quality-runner-core.mjs';

console.log('⚠️  DRY RUN — MockAIProvider 사용 중. 실제 품질 평가가 아니라 하네스 배관 검증용입니다.\n');

const canonical = JSON.parse(await readFile('./data/fixtures/adult-main-quality-chart.json', 'utf-8'));
const provider = new MockAIProvider();

const { totalUsage, passCount, totalCount } = await runTargetedQualityEvaluation({
  provider,
  canonical,
  model: 'mock',
  outputDir: './tests/real-ai/targeted-quality/_dryrun_mock_verification',
  isRealRun: false,
});

console.log('\n' + '='.repeat(60));
console.log(`DRY RUN 결과 (하네스 검증용): ${passCount}/${totalCount}`);
console.log('총 토큰(mock 추정치):', JSON.stringify(totalUsage, null, 2));
console.log('='.repeat(60));
console.log('\n✅ 하네스 동작 확인 완료: tests/real-ai/targeted-quality/_dryrun_mock_verification/*.json');
