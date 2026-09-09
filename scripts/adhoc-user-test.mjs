// scripts/adhoc-user-test.mjs
//
// npm run analyze:user-test
//
// 사용자가 직접 요청한 실제 테스트: 1989-06-01 19:20 부산 남성, 5개 커스텀 질문.
// 기존 파이프라인(packages/ai/pipeline.mjs)과 기존 base validator(tests/real-ai/validators.mjs),
// 기존 세운/귀문관살 semantic validator(tests/targeted-quality/semantic-validators.mjs — 특정
// fixture 전용이 아니라 범용으로 설계되어 있어 그대로 재사용됨)를 그대로 사용한다. 새 AI provider나
// 새 검증 체계를 만들지 않는다.
//
// 5개 질문은 사용자가 명시한 그대로, 순서대로 "독립된 질문"으로 실행한다(하나의 대화로 묶지 않음 —
// 각 질문이 서로 다른 진단 목적을 갖고 있어 독립적으로 채점하는 게 더 명확하기 때문).

import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { loadEnvFile } from '../packages/shared/load-env.mjs';
import { OpenAIProvider } from '../packages/ai/providers/openai-provider.mjs';
import { runQuestionPipeline } from '../packages/ai/pipeline.mjs';
import { validateRealAIResult } from '../tests/real-ai/validators.mjs';
import { deriveExpectedValues } from '../tests/targeted-quality/expected-values.mjs';
import {
  checkAnnualYearAccuracy,
  checkAnnualTenGodAndStageConsistency,
  checkGwimunPositionAccuracy,
  checkGwimunExistenceConsistency,
  checkDaewoonAnnualLink,
} from '../tests/targeted-quality/semantic-validators.mjs';

const FIXTURE_PATH = './data/fixtures/user-test-1989-busan.json';
const OUTPUT_DIR = './tests/real-ai/user-test-1989-busan';

const QUESTIONS = [
  {
    file: 'q1-essence-personality',
    question:
      '내 사주와 자미두수 명반을 종합해서 내가 어떤 사람인지 분석해줘. 두 체계에서 공통적으로 나타나는 특징과 서로 다르게 나타나는 특징을 구분해서 설명해줘.',
    scopeCheck: 'both',
    note: '사주/자미두수 용어를 억지로 섞는지 확인 — 자동 검증 없음, 사람이 직접 [사주 관점]/[자미두수 관점] 용어 분리 여부 확인 필요',
  },
  {
    file: 'q2-current-major-period',
    question:
      '현재 내 대운은 무엇이고, 사주에서 현재 대운이 원국과 어떤 관계를 만드는지 설명해줘. 자미두수에서는 현재 시기의 명반 구조와 어떻게 연결되는지도 구분해서 설명해줘.',
    scopeCheck: 'both',
    note: '현재 대운(丙寅, 29~38세) 정확성 확인. 단, Canonical JSON에는 major_periods용 relations_to_natal 필드가 없어(annual_periods만 있음) 대운-원국 관계 주장은 자동 대조 불가 — 사람이 직접 십신/오행 논리로 타당한지 확인 필요',
  },
  {
    file: 'q3-annual-2027',
    question:
      '2027년의 세운을 내 사주 원국 및 현재 대운과 함께 분석해줘. 2027년의 천간·지지, 십신, 관계를 실제 계산된 데이터에 근거해서 설명해줘.',
    scopeCheck: 'unconstrained',
    semanticChecks: ['annualYearAccuracy', 'annualTenGodAndStage', 'daewoonAnnualLink'],
    note: '2027=丁未(정재/정관, 養, 공망) + 현재대운 丙寅과의 관계(寅未 귀문 실제 존재!) 정확성 확인',
  },
  {
    file: 'q4-gwimun',
    question:
      '내 명반에 귀문관살이 있다면 정확히 어느 지지 조합에서 발생하는지 설명하고, 그것을 성격이나 사고방식의 특징으로 어떻게 해석할 수 있는지 설명해줘. 계산된 귀문관살이 없는 경우에는 없다고 말해줘.',
    scopeCheck: 'saju_only',
    semanticChecks: ['gwimunPosition', 'gwimunExistence'],
    note: '이 fixture는 원국 내부(natal-natal) 귀문관살이 없음(special_stars.gwimun=[]) — AI가 "없다"고 정확히 말하는지가 핵심 검증 포인트',
  },
  {
    file: 'q5-integration-multi-year',
    question:
      '내 사주와 자미두수를 종합해서 앞으로 몇 년간 어떤 흐름이 나타나는지 분석해줘. 사주에서 나온 판단과 자미두수에서 나온 판단을 각각 구분한 뒤, 두 체계에서 공통적으로 겹치는 부분과 서로 다른 부분을 설명해줘.',
    scopeCheck: 'both',
    note: '장기 통합 분석 — annual_periods가 선택/활용되는지, 도메인 혼동 없는지 사람이 직접 확인 필요',
  },
];

await loadEnvFile();
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const OPENAI_MODEL = process.env.OPENAI_MODEL;

if (!OPENAI_API_KEY || !OPENAI_MODEL) {
  console.log(`
❌ 실행할 수 없습니다.
  OPENAI_API_KEY   (현재: ${OPENAI_API_KEY ? '설정됨' : '설정 안 됨'})
  OPENAI_MODEL     (현재: ${OPENAI_MODEL ? '설정됨' : '설정 안 됨'})
.env에 채우고 다시 실행하세요: npm run analyze:user-test
`);
  process.exit(0);
}

console.log(`Model: ${OPENAI_MODEL}`);
console.log(`Fixture: ${FIXTURE_PATH} (1989-06-01 19:20, 남성, 부산 — 실제 계산 엔진 생성)`);
console.log(`${QUESTIONS.length}개 질문 × (Router 1회 + 분석 1회) = 실제 HTTP 요청 ${QUESTIONS.length * 2}회 예정.\n`);

const canonical = JSON.parse(await readFile(FIXTURE_PATH, 'utf-8'));
const expected = deriveExpectedValues(canonical, { targetYear: 2027 });
const provider = new OpenAIProvider({ apiKey: OPENAI_API_KEY, model: OPENAI_MODEL });

await mkdir(OUTPUT_DIR, { recursive: true });

const SEMANTIC_FNS = {
  annualYearAccuracy: checkAnnualYearAccuracy,
  annualTenGodAndStage: checkAnnualTenGodAndStageConsistency,
  gwimunPosition: checkGwimunPositionAccuracy,
  gwimunExistence: checkGwimunExistenceConsistency,
  daewoonAnnualLink: checkDaewoonAnnualLink,
};

const totalUsage = { input_tokens: 0, output_tokens: 0, total_tokens: 0, cached_input_tokens: 0, reasoning_tokens: 0 };

for (const q of QUESTIONS) {
  console.log(`\n[${q.file}] ${q.question}`);
  const result = await runQuestionPipeline({ provider, canonical, question: q.question });

  const allText = [
    result.response,
    result.analysis?.saju?.interpretation,
    result.analysis?.ziwei?.interpretation,
    result.analysis?.cross_analysis?.common_direction,
    result.analysis?.cross_analysis?.differences,
    result.analysis?.cross_analysis?.overall_judgment,
    result.analysis?.cross_analysis?.real_world_checks,
  ].filter(Boolean).join('\n');

  const baseValidation = validateRealAIResult({
    analysisData: result.analysis,
    routing: result.router,
    extracted: result.extracted,
    canonical,
    expectedScope: q.scopeCheck,
  });

  const semanticChecks = {};
  for (const name of q.semanticChecks ?? []) {
    semanticChecks[name] = SEMANTIC_FNS[name](allText, expected);
  }
  const semanticPass = Object.values(semanticChecks).every((c) => c.pass);
  const overallPass = baseValidation.overall_pass && semanticPass;

  for (const k of Object.keys(totalUsage)) totalUsage[k] += result.usage[k] ?? 0;

  await writeFile(
    `${OUTPUT_DIR}/${q.file}.json`,
    JSON.stringify(
      {
        file: q.file,
        question: q.question,
        note: q.note,
        routing: result.router,
        extracted_data: result.extracted,
        model: OPENAI_MODEL,
        usage: result.usage,
        response: result.response,
        full_analysis: result.analysis,
        base_validation: baseValidation,
        semantic_validation: Object.keys(semanticChecks).length ? { overall_pass: semanticPass, checks: semanticChecks } : null,
        overall_pass: overallPass,
        expected_values_used: q.semanticChecks?.length ? expected : undefined,
        fixture: 'user-test-1989-busan',
        timestamp: new Date().toISOString(),
      },
      null,
      2
    ),
    'utf-8'
  );

  console.log(`  usage: ${JSON.stringify(result.usage)}`);
  console.log(`  base_validation: ${baseValidation.overall_pass ? 'PASS' : 'FAIL'}${q.semanticChecks ? `  semantic: ${semanticPass ? 'PASS' : 'FAIL'}` : ''}  overall: ${overallPass ? 'PASS' : 'FAIL'}`);
}

console.log('\n' + '='.repeat(60));
console.log('총 토큰 사용량:', JSON.stringify(totalUsage, null, 2));
console.log('='.repeat(60));
console.log(`\n✅ 결과 저장 완료: ${OUTPUT_DIR}/*.json`);
