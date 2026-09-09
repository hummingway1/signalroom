// scripts/real-ai-runner-core.mjs
//
// Provider-injectable core logic for the real-AI evaluation (spec §3-§7).
// Kept separate from scripts/analyze-real.mjs (the "only runs with a real
// key" CLI entrypoint) so the exact same code path can also be exercised in
// scripts/analyze-real-dryrun.mjs (MockAIProvider, infra verification only,
// clearly labeled — see that file's header).

import { writeFile, mkdir } from 'node:fs/promises';
import path from 'node:path';

import { runQuestionPipeline } from '../packages/ai/pipeline.mjs';
import { appendToSummary } from '../apps/api/src/services/conversation-service.mjs';
import { validateRealAIResult } from '../tests/real-ai/validators.mjs';
import { SINGLE_TURN_QUESTIONS, CONVERSATION_TEST } from '../tests/real-ai/questions.mjs';

function computeCost(usage) {
  const inputPrice = Number(process.env.OPENAI_INPUT_PRICE_PER_1M);
  const outputPrice = Number(process.env.OPENAI_OUTPUT_PRICE_PER_1M);
  if (!usage || !Number.isFinite(inputPrice) || !Number.isFinite(outputPrice)) return null;
  const inputCost = (usage.input_tokens / 1_000_000) * inputPrice;
  const outputCost = (usage.output_tokens / 1_000_000) * outputPrice;
  return { input: inputCost, output: outputCost, total: inputCost + outputCost };
}

async function runOneQuestion({ provider, canonical, question, category, scopeCheck, model, conversationSummary = '' }) {
  const result = await runQuestionPipeline({ provider, canonical, question, conversationSummary });
  const validation = validateRealAIResult({
    analysisData: result.analysis,
    routing: result.router,
    extracted: result.extracted,
    canonical,
    expectedScope: scopeCheck,
  });
  const estimated_cost = computeCost(result.usage);

  return {
    question,
    category,
    routing: result.router,
    extracted_data: result.extracted,
    extraction_stats: result.extractionSavings,
    model,
    usage: result.usage,
    estimated_cost,
    response: result.response,
    full_analysis: result.analysis,
    validation,
    timestamp: new Date().toISOString(),
    _pipelineResult: result, // not serialized (stripped before writeFile) — used internally to build next-turn summary
  };
}

/**
 * @param {object} params
 * @param {import('../packages/ai/providers/base-provider.mjs').BaseAIProvider} params.provider
 * @param {object} params.canonical - the FIXED test canonical chart (spec §2: 새로 계산하지 않는다)
 * @param {string} params.model - model label to record in each result (informational only)
 * @param {string} params.outputDir - where to write NN-*.json files
 * @param {boolean} [params.isRealRun] - true for the real OpenAI run, false for mock/dry-run verification
 * @param {string} [params.fixtureId] - which tests/real-ai/fixtures.mjs entry this canonical came from (stamped into each result so rescore-real-ai-results.mjs knows which chart to re-extract against)
 */
export async function runFullEvaluation({ provider, canonical, model, outputDir, isRealRun, fixtureId = 'edge_case' }) {
  await mkdir(outputDir, { recursive: true });

  const results = [];

  for (const q of SINGLE_TURN_QUESTIONS) {
    console.log(`\n[${q.file}] ${q.question}`);
    const result = await runOneQuestion({ provider, canonical, question: q.question, category: q.category, scopeCheck: q.scope_check, model });
    const { _pipelineResult, ...toSave } = result;
    toSave.mock_mode = !isRealRun;
    toSave.fixture = fixtureId;
    await writeFile(path.join(outputDir, `${q.file}.json`), JSON.stringify(toSave, null, 2), 'utf-8');
    console.log(`  usage: ${JSON.stringify(result.usage)}  validation: ${result.validation.overall_pass ? 'PASS' : 'FAIL'}`);
    results.push({ file: q.file, category: q.category, ...toSave });
  }

  // --- Conversation continuation test (§5) ---
  console.log(`\n[${CONVERSATION_TEST.file}] conversation continuation (${CONVERSATION_TEST.turns.length} turns)`);
  let conversationSummary = '';
  const turnResults = [];
  for (const [i, turnQuestion] of CONVERSATION_TEST.turns.entries()) {
    console.log(`  turn ${i + 1}: ${turnQuestion}`);
    const result = await runOneQuestion({
      provider,
      canonical,
      question: turnQuestion,
      category: CONVERSATION_TEST.category,
      scopeCheck: CONVERSATION_TEST.scope_check,
      model,
      conversationSummary,
    });
    conversationSummary = appendToSummary(conversationSummary, turnQuestion, result._pipelineResult);
    const { _pipelineResult, ...toSave } = result;
    toSave.turn = i + 1;
    toSave.conversation_summary_after_this_turn = conversationSummary;
    toSave.mock_mode = !isRealRun;
    toSave.fixture = fixtureId;
    turnResults.push(toSave);
    console.log(`    usage: ${JSON.stringify(result.usage)}  validation: ${result.validation.overall_pass ? 'PASS' : 'FAIL'}`);
  }
  const conversationOutput = { file: CONVERSATION_TEST.file, turns: turnResults, mock_mode: !isRealRun, fixture: fixtureId };
  await writeFile(path.join(outputDir, `${CONVERSATION_TEST.file}.json`), JSON.stringify(conversationOutput, null, 2), 'utf-8');
  results.push({ file: CONVERSATION_TEST.file, category: 'conversation', turns: turnResults });

  return summarize(results);
}

function summarize(results) {
  const byCategory = { saju_only: [], ziwei_only: [], cross: [], conversation: [] };
  for (const r of results) {
    if (r.file === CONVERSATION_TEST.file) {
      byCategory.conversation.push(...r.turns);
    } else {
      byCategory[r.category].push(r);
    }
  }

  const stats = {};
  for (const [cat, items] of Object.entries(byCategory)) {
    if (items.length === 0) {
      stats[cat] = null;
      continue;
    }
    const totalInput = items.reduce((s, r) => s + (r.usage?.input_tokens ?? 0), 0);
    const totalOutput = items.reduce((s, r) => s + (r.usage?.output_tokens ?? 0), 0);
    const totalTokens = items.reduce((s, r) => s + (r.usage?.total_tokens ?? 0), 0);
    const costs = items.map((r) => r.estimated_cost?.total).filter((c) => c != null);
    const passCount = items.filter((r) => r.validation?.overall_pass).length;
    stats[cat] = {
      count: items.length,
      avg_input_tokens: Math.round(totalInput / items.length),
      avg_output_tokens: Math.round(totalOutput / items.length),
      avg_total_tokens: Math.round(totalTokens / items.length),
      avg_cost_usd: costs.length > 0 ? Number((costs.reduce((s, c) => s + c, 0) / costs.length).toFixed(6)) : null,
      validation_pass_rate: `${passCount}/${items.length}`,
    };
  }

  return { byCategory, stats, allResults: results };
}
