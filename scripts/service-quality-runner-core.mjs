// scripts/service-quality-runner-core.mjs
//
// Provider-injectable core for Q6~Q10. Reuses:
//   - packages/ai/pipeline.mjs (same pipeline, no new AI provider)
//   - tests/real-ai/validators.mjs (base validators, unmodified)
//   - tests/targeted-quality/semantic-validators.mjs (gwimun checks, reused as-is for Q10)
//   - tests/service-quality/semantic-validators.mjs (new Q6-Q10-specific checks)

import { writeFile, mkdir, readFile } from 'node:fs/promises';
import path from 'node:path';

import { runQuestionPipeline } from '../packages/ai/pipeline.mjs';
import { validateRealAIResult } from '../tests/real-ai/validators.mjs';
import { checkGwimunExistenceConsistency, checkGwimunPositionAccuracy } from '../tests/targeted-quality/semantic-validators.mjs';
import { deriveExpectedValues } from '../tests/targeted-quality/expected-values.mjs';
import { resolveFixture } from '../tests/real-ai/fixtures.mjs';
import {
  checkEmpathyOpeningStructure,
  checkCitationDensity,
  checkCrossPersonSimilarity,
  classifyOrgVsIndependentLean,
  checkLeanConsistency,
  checkOverlyPositiveLanguage,
  checkBalanceGivenTensionSignal,
  checkToneActuallyApplied,
} from '../tests/service-quality/semantic-validators.mjs';
import { SERVICE_QUALITY_QUESTIONS, CHARACTER_TONE_INSTRUCTION } from '../tests/service-quality/questions.mjs';

async function loadFixture(fixtureId) {
  if (fixtureId === 'user-test-1989-busan') {
    return JSON.parse(await readFile('./data/fixtures/user-test-1989-busan.json', 'utf-8'));
  }
  const fixture = resolveFixture(fixtureId);
  return JSON.parse(await readFile(fixture.path, 'utf-8'));
}

function allTextOf(pipelineResult) {
  return [
    pipelineResult.response,
    pipelineResult.analysis?.saju?.interpretation,
    pipelineResult.analysis?.ziwei?.interpretation,
    pipelineResult.analysis?.cross_analysis?.common_direction,
    pipelineResult.analysis?.cross_analysis?.differences,
    pipelineResult.analysis?.cross_analysis?.overall_judgment,
    pipelineResult.analysis?.cross_analysis?.real_world_checks,
  ]
    .filter(Boolean)
    .join('\n');
}

async function runOnce({ provider, canonical, question, scopeCheck, extraSystemInstruction = '' }) {
  const result = await runQuestionPipeline({ provider, canonical, question, extraSystemInstruction });
  const text = allTextOf(result);
  const baseValidation = validateRealAIResult({
    analysisData: result.analysis,
    routing: result.router,
    extracted: result.extracted,
    canonical,
    expectedScope: scopeCheck,
  });
  return { result, text, baseValidation };
}

function saveResult(outputDir, file, payload) {
  return writeFile(path.join(outputDir, `${file}.json`), JSON.stringify(payload, null, 2), 'utf-8');
}

function sumUsage(target, usage) {
  for (const k of ['input_tokens', 'output_tokens', 'total_tokens', 'cached_input_tokens', 'reasoning_tokens']) {
    target[k] = (target[k] ?? 0) + (usage?.[k] ?? 0);
  }
}

export async function runServiceQualityEvaluation({ provider, model, outputDir, isRealRun }) {
  await mkdir(outputDir, { recursive: true });
  const totalUsage = {};
  const summary = {};

  // --- Q6: 자기인식/공감도 ---
  {
    const q = SERVICE_QUALITY_QUESTIONS.q6;
    console.log(`\n[${q.file}] ${q.question}`);
    const canonical = await loadFixture(q.fixture);
    const { result, text, baseValidation } = await runOnce({ provider, canonical, question: q.question, scopeCheck: q.scopeCheck });
    const empathyCheck = checkEmpathyOpeningStructure(text);
    sumUsage(totalUsage, result.usage);
    const payload = {
      file: q.file, question: q.question, fixture: q.fixture,
      routing: result.router, extracted_data: result.extracted, usage: result.usage,
      response: result.response, full_analysis: result.analysis,
      base_validation: baseValidation,
      semantic_validation: { overall_pass: empathyCheck.pass, checks: { empathyOpeningStructure: empathyCheck } },
      overall_pass: baseValidation.overall_pass && empathyCheck.pass,
      model, mock_mode: !isRealRun, timestamp: new Date().toISOString(),
      human_review_required: ['공감의 질(형식적인지 실질적인지)', '위로가 근거 없는 낙관으로 새는지'],
    };
    await saveResult(outputDir, q.file, payload);
    console.log(`  base: ${baseValidation.overall_pass ? 'PASS' : 'FAIL'}  empathy_structure(안전망): ${empathyCheck.pass ? 'PASS' : 'FAIL'}`);
    summary.q6 = payload.overall_pass;
  }

  // --- Q7: 구체성/개인화 (두 fixture 비교) ---
  {
    const q = SERVICE_QUALITY_QUESTIONS.q7;
    console.log(`\n[${q.file}] ${q.question} (${q.fixtures.join(' vs ')})`);
    const runs = [];
    for (const fixtureId of q.fixtures) {
      const canonical = await loadFixture(fixtureId);
      const { result, text, baseValidation } = await runOnce({ provider, canonical, question: q.question, scopeCheck: q.scopeCheck });
      sumUsage(totalUsage, result.usage);
      const density = checkCitationDensity(text);
      runs.push({ fixtureId, result, text, baseValidation, density });
      console.log(`  [${fixtureId}] base: ${baseValidation.overall_pass ? 'PASS' : 'FAIL'}  citation_density: ${density.pass ? 'PASS' : 'FAIL'} (${density.details.citation_count})`);
    }
    const similarity = checkCrossPersonSimilarity(runs[0].text, runs[1].text);
    console.log(`  cross_person_similarity: ${similarity.pass ? 'PASS' : 'FAIL'} (jaccard=${similarity.details.jaccard_similarity})`);
    const overallPass = runs.every((r) => r.baseValidation.overall_pass && r.density.pass) && similarity.pass;
    const payload = {
      file: q.file, question: q.question,
      runs: runs.map((r) => ({
        fixture: r.fixtureId, routing: r.result.router, extracted_data: r.result.extracted, usage: r.result.usage,
        response: r.result.response, full_analysis: r.result.analysis, base_validation: r.baseValidation,
        citation_density: r.density,
      })),
      semantic_validation: { overall_pass: runs.every((r) => r.density.pass) && similarity.pass, cross_person_similarity: similarity },
      overall_pass: overallPass,
      model, mock_mode: !isRealRun, timestamp: new Date().toISOString(),
      human_review_required: ['개인화가 피상적인지 실질적 통찰인지'],
    };
    await saveResult(outputDir, q.file, payload);
    summary.q7 = overallPass;
  }

  // --- Q8: 반복 일관성 (3회) ---
  {
    const q = SERVICE_QUALITY_QUESTIONS.q8;
    console.log(`\n[${q.file}] ${q.question} (${q.runs}회 반복)`);
    const canonical = await loadFixture(q.fixture);
    const runs = [];
    for (let i = 0; i < q.runs; i++) {
      const { result, text, baseValidation } = await runOnce({ provider, canonical, question: q.question, scopeCheck: q.scopeCheck });
      sumUsage(totalUsage, result.usage);
      const lean = classifyOrgVsIndependentLean(text);
      runs.push({ run: i + 1, result, text, baseValidation, lean });
      console.log(`  run ${i + 1}: base=${baseValidation.overall_pass ? 'PASS' : 'FAIL'}  lean=${lean}`);
    }
    const leanConsistency = checkLeanConsistency(runs.map((r) => r.lean));
    console.log(`  lean_consistency: ${leanConsistency.pass ? 'PASS' : 'FAIL'} (${JSON.stringify(leanConsistency.details.counts)})`);
    const allBasePass = runs.every((r) => r.baseValidation.overall_pass);
    const overallPass = allBasePass && leanConsistency.pass;
    const payload = {
      file: q.file, question: q.question, fixture: q.fixture,
      runs: runs.map((r) => ({
        run: r.run, routing: r.result.router, extracted_data: r.result.extracted, usage: r.result.usage,
        response: r.result.response, full_analysis: r.result.analysis, base_validation: r.baseValidation, lean: r.lean,
      })),
      semantic_validation: { overall_pass: leanConsistency.pass, lean_consistency: leanConsistency },
      overall_pass: overallPass,
      model, mock_mode: !isRealRun, timestamp: new Date().toISOString(),
      human_review_required: ['근거(강조한 궁/십신)가 매번 바뀌는 게 자연스러운 변주인지, 논리 자체가 흔들리는지'],
    };
    await saveResult(outputDir, q.file, payload);
    summary.q8 = overallPass;
  }

  // --- Q9: 과잉 긍정 방지 ---
  {
    const q = SERVICE_QUALITY_QUESTIONS.q9;
    console.log(`\n[${q.file}] ${q.question}`);
    const canonical = await loadFixture(q.fixture);
    const { result, text, baseValidation } = await runOnce({ provider, canonical, question: q.question, scopeCheck: q.scopeCheck });
    sumUsage(totalUsage, result.usage);
    const overlyPositive = checkOverlyPositiveLanguage(text);
    const balance = checkBalanceGivenTensionSignal(text, result.extracted.saju);
    const semanticPass = overlyPositive.pass && balance.pass;
    const payload = {
      file: q.file, question: q.question, fixture: q.fixture,
      routing: result.router, extracted_data: result.extracted, usage: result.usage,
      response: result.response, full_analysis: result.analysis, base_validation: baseValidation,
      semantic_validation: { overall_pass: semanticPass, checks: { overlyPositiveLanguage: overlyPositive, balanceGivenTensionSignal: balance } },
      overall_pass: baseValidation.overall_pass && semanticPass,
      model, mock_mode: !isRealRun, timestamp: new Date().toISOString(),
      human_review_required: ['균형 표현이 형식적("다만" 한 번)인지 실질적 근거 기반인지'],
    };
    await saveResult(outputDir, q.file, payload);
    console.log(`  base: ${baseValidation.overall_pass ? 'PASS' : 'FAIL'}  overly_positive: ${overlyPositive.pass ? 'PASS' : 'FAIL'}  balance: ${balance.pass ? 'PASS' : 'FAIL'}`);
    summary.q9 = payload.overall_pass;
  }

  // --- Q10: 캐릭터 톤 불변성 (baseline vs character) ---
  {
    const q = SERVICE_QUALITY_QUESTIONS.q10;
    console.log(`\n[${q.file}] ${q.question} (baseline vs character)`);
    const canonical = await loadFixture(q.fixture);
    const expected = deriveExpectedValues(canonical, { targetYear: 2027 });

    const baseline = await runOnce({ provider, canonical, question: q.question, scopeCheck: q.scopeCheck });
    sumUsage(totalUsage, baseline.result.usage);
    const character = await runOnce({ provider, canonical, question: q.question, scopeCheck: q.scopeCheck, extraSystemInstruction: CHARACTER_TONE_INSTRUCTION });
    sumUsage(totalUsage, character.result.usage);

    const baselineExistence = checkGwimunExistenceConsistency(baseline.text, expected);
    const characterExistence = checkGwimunExistenceConsistency(character.text, expected);
    const baselinePosition = checkGwimunPositionAccuracy(baseline.text, expected);
    const characterPosition = checkGwimunPositionAccuracy(character.text, expected);
    const toneApplied = checkToneActuallyApplied(baseline.text, character.text);

    const factsUnchanged = baselineExistence.pass && characterExistence.pass && baselinePosition.pass && characterPosition.pass
      && baselineExistence.details.actually_exists === characterExistence.details.actually_exists;

    console.log(`  baseline base_validation: ${baseline.baseValidation.overall_pass ? 'PASS' : 'FAIL'}  gwimun existence/position: ${baselineExistence.pass && baselinePosition.pass ? 'PASS' : 'FAIL'}`);
    console.log(`  character base_validation: ${character.baseValidation.overall_pass ? 'PASS' : 'FAIL'}  gwimun existence/position: ${characterExistence.pass && characterPosition.pass ? 'PASS' : 'FAIL'}`);
    console.log(`  tone_actually_applied: ${toneApplied.pass ? 'PASS' : 'FAIL'}  facts_unchanged_across_tone: ${factsUnchanged ? 'PASS' : 'FAIL'}`);

    const overallPass = baseline.baseValidation.overall_pass && character.baseValidation.overall_pass && factsUnchanged && toneApplied.pass;
    const payload = {
      file: q.file, question: q.question, fixture: q.fixture,
      baseline: {
        routing: baseline.result.router, extracted_data: baseline.result.extracted, usage: baseline.result.usage,
        response: baseline.result.response, full_analysis: baseline.result.analysis, base_validation: baseline.baseValidation,
        gwimun_existence: baselineExistence, gwimun_position: baselinePosition,
      },
      character: {
        routing: character.result.router, extracted_data: character.result.extracted, usage: character.result.usage,
        response: character.result.response, full_analysis: character.result.analysis, base_validation: character.baseValidation,
        gwimun_existence: characterExistence, gwimun_position: characterPosition,
      },
      character_tone_instruction: CHARACTER_TONE_INSTRUCTION,
      semantic_validation: { overall_pass: factsUnchanged && toneApplied.pass, facts_unchanged_across_tone: factsUnchanged, tone_actually_applied: toneApplied },
      overall_pass: overallPass,
      model, mock_mode: !isRealRun, timestamp: new Date().toISOString(),
      human_review_required: ['톤이 실제로 차별화되는지', '캐릭터 톤이 안전 문구(단정 금지/유파 고지)를 실수로 생략하게 만드는지'],
    };
    await saveResult(outputDir, q.file, payload);
    summary.q10 = overallPass;
  }

  const passCount = Object.values(summary).filter(Boolean).length;
  return { summary, totalUsage, passCount, totalCount: Object.keys(summary).length };
}
