// scripts/targeted-quality-runner-core.mjs
//
// Provider-injectable core for the 5 targeted-quality tests (세운/귀문관살 실제 활용 검증).
// Reuses the SAME pipeline (packages/ai/pipeline.mjs) and the SAME base validators
// (tests/real-ai/validators.mjs) as main_quality — no new AI provider, no new pipeline.
// Adds semantic checks on top (tests/targeted-quality/semantic-validators.mjs) that compare
// the AI's response against ground truth derived from the real fixture.

import { writeFile, mkdir } from 'node:fs/promises';
import path from 'node:path';

import { runQuestionPipeline } from '../packages/ai/pipeline.mjs';
import { validateRealAIResult } from '../tests/real-ai/validators.mjs';
import { deriveExpectedValues } from '../tests/targeted-quality/expected-values.mjs';
import {
  checkAnnualYearAccuracy,
  checkAnnualTenGodAndStageConsistency,
  checkGwimunPositionAccuracy,
  checkGwimunExistenceConsistency,
  checkDaewoonAnnualLink,
  checkNoUnnecessaryAnnualExtraction,
  checkTimingProvided,
  checkMultipleYearsCompared,
  checkNotPersonalityOnlyAnswer,
} from '../tests/targeted-quality/semantic-validators.mjs';
import { TARGETED_QUALITY_QUESTIONS } from '../tests/targeted-quality/questions.mjs';

const SEMANTIC_CHECK_FNS = {
  annualYearAccuracy: (text, expected) => checkAnnualYearAccuracy(text, expected),
  annualTenGodAndStage: (text, expected) => checkAnnualTenGodAndStageConsistency(text, expected),
  gwimunPosition: (text, expected) => checkGwimunPositionAccuracy(text, expected),
  gwimunExistence: (text, expected) => checkGwimunExistenceConsistency(text, expected),
  daewoonAnnualLink: (text, expected) => checkDaewoonAnnualLink(text, expected),
  timingProvided: (text) => checkTimingProvided(text),
  multipleYearsCompared: (text) => checkMultipleYearsCompared(text),
  notPersonalityOnlyAnswer: (text) => checkNotPersonalityOnlyAnswer(text),
  // noUnnecessaryAnnualExtraction is handled separately below — it needs extractedSaju, not just text.
};

function computeCost(usage) {
  const inputPrice = Number(process.env.OPENAI_INPUT_PRICE_PER_1M);
  const outputPrice = Number(process.env.OPENAI_OUTPUT_PRICE_PER_1M);
  if (!usage || !Number.isFinite(inputPrice) || !Number.isFinite(outputPrice)) return null;
  const inputCost = (usage.input_tokens / 1_000_000) * inputPrice;
  const outputCost = (usage.output_tokens / 1_000_000) * outputPrice;
  return { input: inputCost, output: outputCost, total: inputCost + outputCost };
}

/**
 * @param {object} params
 * @param {import('../packages/ai/providers/base-provider.mjs').BaseAIProvider} params.provider
 * @param {object} params.canonical - main_quality fixture (실제 계산 엔진 생성)
 * @param {string} params.model
 * @param {string} params.outputDir
 * @param {boolean} params.isRealRun
 */
export async function runTargetedQualityEvaluation({ provider, canonical, model, outputDir, isRealRun, questions = TARGETED_QUALITY_QUESTIONS }) {
  await mkdir(outputDir, { recursive: true });
  const expected = deriveExpectedValues(canonical, { targetYear: 2027 });

  const results = [];

  for (const q of questions) {
    console.log(`\n[${q.file}] ${q.question}`);
    const pipelineResult = await runQuestionPipeline({ provider, canonical, question: q.question });
    const responseText = pipelineResult.response;
    const allText = [
      responseText,
      pipelineResult.analysis?.saju?.interpretation,
      pipelineResult.analysis?.ziwei?.interpretation,
      pipelineResult.analysis?.cross_analysis?.common_direction,
      pipelineResult.analysis?.cross_analysis?.differences,
      pipelineResult.analysis?.cross_analysis?.overall_judgment,
      pipelineResult.analysis?.cross_analysis?.real_world_checks,
    ].filter(Boolean).join('\n');

    // Base validators (재사용 — 새 검증 체계를 따로 만들지 않음)
    const baseValidation = validateRealAIResult({
      analysisData: pipelineResult.analysis,
      routing: pipelineResult.router,
      extracted: pipelineResult.extracted,
      canonical,
      expectedScope: q.scopeCheck,
    });

    // Semantic checks (이 테스트 세트 전용)
    const semanticChecks = {};
    for (const checkName of q.semanticChecks) {
      if (checkName === 'noUnnecessaryAnnualExtraction') {
        semanticChecks[checkName] = checkNoUnnecessaryAnnualExtraction(pipelineResult.extracted.saju, allText);
      } else {
        semanticChecks[checkName] = SEMANTIC_CHECK_FNS[checkName](allText, expected);
      }
    }

    const allSemanticPass = Object.values(semanticChecks).every((c) => c.pass);
    const overallPass = baseValidation.overall_pass && allSemanticPass;

    const usage = pipelineResult.usage;
    const cost = computeCost(usage);

    const toSave = {
      file: q.file,
      question: q.question,
      purpose: q.purpose,
      routing: pipelineResult.router,
      extracted_data: pipelineResult.extracted,
      extraction_stats: pipelineResult.extractionSavings,
      model,
      usage,
      estimated_cost: cost,
      response: responseText,
      full_analysis: pipelineResult.analysis,
      base_validation: baseValidation,
      semantic_validation: { overall_pass: allSemanticPass, checks: semanticChecks },
      overall_pass: overallPass,
      expected_values_used: expected,
      mock_mode: !isRealRun,
      fixture: 'main_quality',
      timestamp: new Date().toISOString(),
    };

    await writeFile(path.join(outputDir, `${q.file}.json`), JSON.stringify(toSave, null, 2), 'utf-8');
    console.log(`  usage: ${JSON.stringify(usage)}`);
    console.log(`  base_validation: ${baseValidation.overall_pass ? 'PASS' : 'FAIL'}  semantic: ${allSemanticPass ? 'PASS' : 'FAIL'}  overall: ${overallPass ? 'PASS' : 'FAIL'}`);

    results.push(toSave);
  }

  const totalUsage = results.reduce(
    (acc, r) => ({
      input_tokens: acc.input_tokens + (r.usage?.input_tokens ?? 0),
      output_tokens: acc.output_tokens + (r.usage?.output_tokens ?? 0),
      total_tokens: acc.total_tokens + (r.usage?.total_tokens ?? 0),
      cached_input_tokens: acc.cached_input_tokens + (r.usage?.cached_input_tokens ?? 0),
      reasoning_tokens: acc.reasoning_tokens + (r.usage?.reasoning_tokens ?? 0),
    }),
    { input_tokens: 0, output_tokens: 0, total_tokens: 0, cached_input_tokens: 0, reasoning_tokens: 0 }
  );
  const passCount = results.filter((r) => r.overall_pass).length;

  return { results, totalUsage, passCount, totalCount: results.length };
}
