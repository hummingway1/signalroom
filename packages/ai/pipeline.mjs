// packages/ai/pipeline.mjs
//
// Orchestrates the "질문 → 관련 데이터 검색/선별 → 사주 해석 → 자미두수
// 해석 → 교차분석 → 대화형 답변" flow (spec §1/§5) as TWO AI calls:
//
//   Stage 1 (AI call):  Question Router
//   Stage 2 (code only): Relevant Data Extraction  [packages/canonical/extract.mjs]
//   Stage 3 (AI call):  combined Saju + Ziwei + Cross-analysis + Response
//
// See README "AI 비용 구조" for why stages 3-6 of the spec's conceptual
// pipeline are merged into a single call here.

import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { sanitizeUserFacingText } from '../shared/sanitize-output.mjs';

import { ROUTER_JSON_SCHEMA } from './schemas/router-schema.mjs';
import { ANALYSIS_RESPONSE_JSON_SCHEMA } from './schemas/analysis-response-schema.mjs';
import { extractRelevantData, estimateExtractionSavings } from '../canonical/extract.mjs';
import { computeCurrentAge } from '../shared/date-utils.mjs';
import { retrieveKnowledge, formatKnowledgeContext } from '../knowledge/index.mjs';

const PROMPTS_DIR = path.resolve('./prompts/runtime');
const ORIGINALS_DIR = path.resolve('./prompts/originals');

let cachedPrompts = null;
async function loadRuntimePrompts() {
  if (cachedPrompts) return cachedPrompts;
  const [
    questionRouter, sajuAdapter, ziweiAdapter, crossAnalysis, conversation, safety,
    sajuOriginal, ziweiOriginal,
  ] = await Promise.all([
    readFile(path.join(PROMPTS_DIR, 'question-router.md'), 'utf-8'),
    readFile(path.join(PROMPTS_DIR, 'saju.md'), 'utf-8'),
    readFile(path.join(PROMPTS_DIR, 'ziwei.md'), 'utf-8'),
    readFile(path.join(PROMPTS_DIR, 'cross-analysis.md'), 'utf-8'),
    readFile(path.join(PROMPTS_DIR, 'conversation.md'), 'utf-8'),
    readFile(path.join(PROMPTS_DIR, 'safety.md'), 'utf-8'),
    // Originals are loaded and appended VERBATIM — never edited, never
    // summarized. If a given original is still PENDING (placeholder),
    // that placeholder text is what gets sent, which is intentional: it
    // makes the pending state visible in the actual prompt rather than
    // silently falling back to something fabricated.
    readFile(path.join(ORIGINALS_DIR, 'saju-original.md'), 'utf-8'),
    readFile(path.join(ORIGINALS_DIR, 'ziwei-original.md'), 'utf-8'),
  ]);
  // saju.md / ziwei.md are adapters (plumbing only) that get the real
  // original appended after them, unmodified, at call time — see each
  // adapter file's own "§ 아래부터 원본 전문" section for why the original
  // text itself is not duplicated into the adapter file.
  const sajuPrompt = `${sajuAdapter}\n\n${sajuOriginal}`;
  const ziweiPrompt = `${ziweiAdapter}\n\n${ziweiOriginal}`;
  cachedPrompts = { questionRouter, sajuPrompt, ziweiPrompt, crossAnalysis, conversation, safety };
  return cachedPrompts;
}

/**
 * @param {object} params
 * @param {import('./providers/base-provider.mjs').BaseAIProvider} params.provider
 * @param {object} params.canonical - full Canonical Chart JSON for this user's chart
 * @param {string} params.question - the user's latest question (raw text)
 * @param {string} [params.conversationSummary] - short summary of prior turns, if any
 * @param {string} [params.extraSystemInstruction] - optional additional system-prompt text appended
 *   AFTER all existing prompts (adapter + originals + safety + conversation). Default: none — when
 *   omitted, behavior is byte-for-byte identical to before this parameter existed. Added specifically
 *   for tests/service-quality Q10 (캐릭터 톤이 명리학적 ground truth를 바꾸지 않는지 검증) — this is
 *   NOT a production persona feature, just a test harness hook. It is appended, never inserted before
 *   or mixed into, the safety/original-prompt rules, so those rules always take precedence.
 * @param {object} [params.predefinedRouting] - optional pre-built router result
 *   ({categories, saju_fields, ziwei_fields, ziwei_palace_focus, reasoning}). When provided, Stage 1's
 *   AI call is SKIPPED entirely and this object is used as-is — used by the character/catalog UX layer
 *   (packages/character/) where a catalog entry already encodes required_data, so re-asking the model
 *   "what data do you need?" would be redundant AI spend. Default: none — omitted means identical
 *   behavior to before this parameter existed (always calls the router).
 */
export async function runQuestionPipeline({
  provider,
  canonical,
  question,
  conversationSummary = '',
  extraSystemInstruction = '',
  predefinedRouting = null,
  knowledgeContext = '',
  enableKnowledgeRetrieval = false,
  catalogKind = null,
  authorizeBeforeAnalysis = null, // §Phase3 — (routerResult) => Promise<{authorized, message?, entitlementId?}>. null이면 기존과 완전히 동일(하위호환).
}) {
  const prompts = await loadRuntimePrompts();
  const usageTotals = { input_tokens: 0, output_tokens: 0, total_tokens: 0, cached_input_tokens: 0, reasoning_tokens: 0 };

  // --- Stage 1: Question Router (skipped entirely if predefinedRouting is supplied) ---
  let routerResult;
  if (predefinedRouting) {
    routerResult = { data: predefinedRouting, usage: null, raw: null };
  } else {
    const routerUser = [
      conversationSummary ? `PRIOR_CONTEXT_SUMMARY:\n${conversationSummary}\n\n` : '',
      `QUESTION:\n${question}\n\n`,
      `(카테고리/필드 선택 시 packages/shared/categories.mjs에 정의된 실제 값만 사용할 것.)`,
    ].join('');

    routerResult = await provider.complete({
      system: prompts.questionRouter,
      user: routerUser,
      jsonSchema: ROUTER_JSON_SCHEMA,
      schemaName: 'question_router',
    });
    addUsage(usageTotals, routerResult.usage);
  }

  // --- §Phase3 Stage 1.5: Authorization gate ---
  // Router는 이미 항상 실행되던 기존 비용이다(§2 "새 LLM 호출을 추가하지 않는다" — Router 자체를
  // 새로 추가하는 게 아니라 원래 있던 호출 뒤에 판정만 끼워넣음). 여기서 거부되면 훨씬 비싸고
  // 실제 개인 데이터를 해석하는 Stage 3(분석 호출)를 아예 실행하지 않는다 — 이게 실질적인 비용
  // 절감 지점이다.
  //
  // §실측 버그 수정(Phase8 실제 Supabase 검증에서 발견) — authResult를 함수 스코프로 끌어올려서
  // "허용"된 경우에도 최종 반환값에 포함시킨다. 이전에는 거부(authorized:false)됐을 때만
  // authorization 필드를 반환값에 넣었고, 성공(허용) 경로의 최종 return에는 이 필드 자체가
  // 없었다 — 그 결과 conversation-service.mjs가 `pipelineResult.authorization?.authorized`를
  // 체크할 때 항상 undefined라서, 실제로 유료 분석이 성공했는데도 quota 차감이 단 한 번도
  // 실행되지 않는 심각한 과금 버그였다(실제 Supabase 통합 테스트로 실측 확인됨).
  let authResult = null;
  if (authorizeBeforeAnalysis) {
    authResult = await authorizeBeforeAnalysis(routerResult.data);
    if (!authResult.authorized) {
      return {
        router: routerResult.data,
        analysis: null,
        response: authResult.message,
        usage: usageTotals, // Router 비용만 집계됨(분석 호출 없었음)
        raw: { router: routerResult.raw, analysis: null },
        authorization: authResult,
      };
    }
  }

  // --- Stage 2: Relevant Data Extraction (pure code, no AI call) ---
  const extracted = extractRelevantData(canonical, routerResult.data);
  const savings = estimateExtractionSavings(canonical, extracted);

  // --- Stage 2.5: Knowledge retrieval (pure code, no AI call — opt-in via enableKnowledgeRetrieval) ---
  const resolvedKnowledgeContext = knowledgeContext
    ? knowledgeContext
    : enableKnowledgeRetrieval
      ? formatKnowledgeContext(retrieveKnowledge({ questionText: question, extracted, catalogKind }))
      : '';

  // --- Stage 3: combined Saju + Ziwei + Cross-analysis + Response ---
  const combinedSystem = [
    prompts.safety,
    '\n\n---\n\n',
    prompts.sajuPrompt,
    '\n\n---\n\n',
    prompts.ziweiPrompt,
    '\n\n---\n\n',
    prompts.crossAnalysis,
    '\n\n---\n\n',
    prompts.conversation,
    extraSystemInstruction ? '\n\n---\n\n' + extraSystemInstruction : '',
  ].join('');

  const currentAge = canonical.subject?.birth_date ? computeCurrentAge(canonical.subject.birth_date) : null;

  const analysisUser = [
    conversationSummary ? `PRIOR_CONTEXT_SUMMARY:\n${conversationSummary}\n\n` : '',
    `USER_QUESTION:\n${question}\n\n`,
    currentAge !== null
      ? `CURRENT_AGE_CONTEXT (서버가 subject.birth_date와 오늘 날짜로 계산한 만 나이 — 순수 달력 계산이며 명반/사주 계산이 아님. 두 원본 프롬프트가 요구하는 "현재 나이" 입력으로 사용할 것):\n만 ${currentAge}세\n\n`
      : '',
    `QUESTION_ROUTING (참고용 — 이미 이 라우팅에 따라 데이터가 추출되어 아래에 주어짐):\n${JSON.stringify(routerResult.data, null, 2)}\n\n`,
    `EXTRACTED_CANONICAL_DATA (이 데이터에 있는 값만 근거로 사용할 것. 재계산 금지, 없는 값 추정 금지):\n`,
    '```json\n',
    JSON.stringify(extracted, null, 2),
    '\n```',
    resolvedKnowledgeContext ? '\n\n' + resolvedKnowledgeContext : '',
  ].join('');

  const analysisResult = await provider.complete({
    system: combinedSystem,
    user: analysisUser,
    jsonSchema: ANALYSIS_RESPONSE_JSON_SCHEMA,
    schemaName: 'saju_ziwei_cross_response',
  });
  addUsage(usageTotals, analysisResult.usage);

  return {
    router: routerResult.data,
    extracted,
    extractionSavings: savings,
    analysis: analysisResult.data,
    response: sanitizeUserFacingText(analysisResult.data.response), // §16 — 사용자 출력 직전 기호 정규화(단일 원천, 모든 분석 경로 공통 적용)
    usage: usageTotals,
    raw: { router: routerResult.raw, analysis: analysisResult.raw },
    authorization: authResult, // §실측 버그 수정 — 성공 경로에도 포함(null 또는 { authorized: true, entitlementId }), 하위호환: authorizeBeforeAnalysis를 안 쓴 기존 호출부는 계속 null을 받음
  };
}

function addUsage(totals, usage) {
  totals.input_tokens += usage?.input_tokens ?? 0;
  totals.output_tokens += usage?.output_tokens ?? 0;
  totals.total_tokens += usage?.total_tokens ?? 0;
  totals.cached_input_tokens += usage?.cached_input_tokens ?? 0;
  totals.reasoning_tokens += usage?.reasoning_tokens ?? 0;
}
