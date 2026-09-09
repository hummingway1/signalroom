// scripts/analyze-real.mjs
//
// npm run analyze:real
//
// Runs the full real-AI evaluation (spec §3-§7) against the REAL OpenAI
// Responses API. Requires OPENAI_API_KEY + OPENAI_MODEL. If either is
// missing, this prints clear guidance and exits WITHOUT running anything
// (spec §1: "API key가 없으면 실행하지 않고 명확한 안내를 출력한다") —
// it does not fall back to MockAIProvider (that's what
// `npm run analyze:real:dryrun` is for — see that file).
//
// Uses the FIXED test chart at data/canonical-chart-example.json (spec §2:
// "새로운 생년월일을 임의로 계산해서 만들지 않는다") — the same chart
// already validated earlier in this project.

import { readFile } from 'node:fs/promises';
import { loadEnvFile } from '../packages/shared/load-env.mjs';
import { OpenAIProvider } from '../packages/ai/providers/openai-provider.mjs';
import { runFullEvaluation } from './real-ai-runner-core.mjs';
import { resolveFixture, FIXTURES } from '../tests/real-ai/fixtures.mjs';

await loadEnvFile();

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const OPENAI_MODEL = process.env.OPENAI_MODEL;

// npm run analyze:real [edge_case|main_quality]  (defaults to edge_case —
// the chart used in the original 2026-08-17 run — for backward compatibility)
let fixture;
try {
  fixture = resolveFixture(process.argv[2]);
} catch (err) {
  console.log(`❌ ${err.message}`);
  process.exit(1);
}

if (!OPENAI_API_KEY || !OPENAI_MODEL) {
  console.log(`
❌ 실제 AI 평가를 실행할 수 없습니다.

이 명령은 실제 OpenAI API를 호출하므로 다음 환경변수가 반드시 필요합니다:
  OPENAI_API_KEY   (현재: ${OPENAI_API_KEY ? '설정됨' : '설정 안 됨'})
  OPENAI_MODEL     (현재: ${OPENAI_MODEL ? '설정됨' : '설정 안 됨'})

설정 방법:
  1) 프로젝트 루트에 .env 파일을 만들고 (.env.example 참고):
       OPENAI_API_KEY=sk-...
       OPENAI_MODEL=gpt-5   (Responses API를 지원하는 모델)
  2) 다시 실행: npm run analyze:real

이 명령은 Mock으로 대체 실행되지 않습니다 — 실제 모델 품질을 검증하는 것이 이 단계의 목적이기
때문입니다. 코드 구조/배관만 검증하고 싶다면 대신 다음을 실행하세요 (비용 없음, 실제 평가 아님):
  npm run analyze:real:dryrun

사용 가능한 명반 그룹 (인자로 지정, 기본값 edge_case):
${Object.entries(FIXTURES).map(([id, f]) => `  npm run analyze:real -- ${id}   (${f.label})`).join('\n')}
`);
  process.exit(0);
}

console.log(`Model: ${OPENAI_MODEL}`);
console.log(`Fixture: ${fixture.id} — ${fixture.label}`);
console.log(`Loading fixed test chart: ${fixture.path} (spec §2 — 새로 계산하지 않음)`);

const canonical = JSON.parse(await readFile(fixture.path, 'utf-8'));
const provider = new OpenAIProvider({ apiKey: OPENAI_API_KEY, model: OPENAI_MODEL });

console.log('\n실제 OpenAI API 호출 시작 — 10개 단일 질문 + 대화 연속성 3턴 = 총 13개 질문.');
console.log('(질문 1개당 Router 1회 + 분석 1회 = 실제 HTTP 요청 총 26회 예정)\n');

const { stats } = await runFullEvaluation({
  provider,
  canonical,
  model: OPENAI_MODEL,
  outputDir: `./tests/real-ai/${fixture.outputSubdir}`,
  isRealRun: true,
  fixtureId: fixture.id,
});

console.log('\n' + '='.repeat(60));
console.log(`카테고리별 평균 비용/토큰 (spec §6) — fixture: ${fixture.id}`);
console.log(JSON.stringify(stats, null, 2));
console.log('='.repeat(60));
console.log(`\n✅ 결과 저장 완료: tests/real-ai/${fixture.outputSubdir}/*.json`);
console.log('다음 단계: REAL-AI-EVALUATION.md를 이 결과를 바탕으로 작성/갱신하세요.');
