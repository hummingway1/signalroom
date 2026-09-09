// apps/api/src/services/conversation-service.mjs
//
// KNOWLEDGE/INTERPRETATION -> QUESTION ROUTING -> RELEVANT DATA EXTRACTION ->
// SAJU+ZIWEI ANALYSIS -> CROSS ANALYSIS -> CONVERSATIONAL RESPONSE
// (spec §5 layer 4-9), plus conversation memory (spec §12).

import { runQuestionPipeline } from '../../../../packages/ai/pipeline.mjs';
import { getChart } from '../repositories/chart-repository.mjs';
import { createConversation, getConversation, updateConversationSummary, updateConversationCharacter, markCatalogEntrySeen, recordAndCheckCasualAiBudget, recordCasualResponse } from '../repositories/conversation-repository.mjs';
import { getAIProfileContextByChildId } from '../repositories/ai-profile-context-repository.mjs';
import { recordTrialUsage } from '../repositories/child-profile-repository.mjs';
import { addMessage, listMessages } from '../repositories/message-repository.mjs';
import { recordAnalysis } from '../repositories/analysis-repository.mjs';
import { getCharacter } from '../../../../packages/character/characters.mjs';
import { getCatalogEntry, QUESTION_CATALOG, CHILD_QUESTION_CATALOG, getChildCatalogEntry } from '../../../../packages/character/question-catalog.mjs';
import { selectNextChoices, selectFallbackTopicSwitch, selectOpeningChoices } from '../../../../packages/character/catalog-selector.mjs';
import { classifyMessage } from '../../../../packages/character/casual-chat-classifier.mjs';
import { authorizeAnalysisQuestion } from './entitlement-authorization-service.mjs';
import { consumeQuestionEntitlement } from '../repositories/payment-repository.mjs';
import { generateCasualResponse } from '../../../../packages/character/casual-response-engine.mjs';
import { sanitizeUserFacingText } from '../../../../packages/shared/sanitize-output.mjs';
import { buildCasualSystemPrompt, CASUAL_RESPONSE_SCHEMA, truncateForCasual, isMedicalOrSafetyTopic, buildCasualUserMessage, getPersonalizationDepth } from '../../../../packages/character/casual-chat-prompt.mjs';
import { getAnalysisScopeById } from '../repositories/analysis-scope-repository.mjs';
import { buildDateSelectionChatPrompt, DATE_SELECTION_CHAT_RESPONSE_SCHEMA } from '../../../../packages/character/birth-selection-prompt.mjs';

// 캐주얼 AI 호출 예산 — 폭탄 메시지 남용 방지 (분당/시간당 상한, 초과 시 무료 고정 반응으로 대체).
// 정상적인 대화 속도로는 절대 도달하지 않는 값 — 실제 사람이 1분에 8번, 1시간에 40번씩 계속 캐주얼
// 메시지만 연타하는 건 봇이 아니면 불가능하다.
const CASUAL_AI_MAX_PER_MINUTE = 8;
const CASUAL_AI_MAX_PER_HOUR = 40;

const MAX_SUMMARY_CHARS = 1200;

export async function startConversation({ chartId = null, userId = null, characterId = 'daegu', childProfileId = null, fortuneYear = null, dateSelectionScopeId = null }) {
  if (dateSelectionScopeId) {
    // §출생일 택일 — chart_id 개념이 없다(여러 후보 chart가 있을 뿐, 단일 대표 chart 없음).
    return createConversation({ userId, characterId, dateSelectionScopeId });
  }
  const chart = await getChart(chartId);
  if (!chart) {
    const err = new Error(`Chart not found: ${chartId}`);
    err.code = 'CHART_NOT_FOUND';
    throw err;
  }
  return createConversation({ userId, chartId, characterId, childProfileId, fortuneYear });
}

/**
 * Handles one user question end-to-end within an existing conversation:
 *   1. load chart (full Canonical JSON, kept server-side — spec §5)
 *   2. load conversation memory (summary, NOT full message replay — spec §12)
 *   3. run the AI pipeline (router -> extract -> analyze+respond)
 *   4. persist: user message, assistant message, Analysis record, updated summary
 */
export async function askQuestion({ conversationId, question, aiProvider, model = 'unknown', extraSystemInstruction = '', predefinedRouting = null, catalogKind = null, authorizeBeforeAnalysis = null }) {
  const conversation = await getConversation(conversationId);
  if (!conversation) {
    const err = new Error(`Conversation not found: ${conversationId}`);
    err.code = 'CONVERSATION_NOT_FOUND';
    throw err;
  }

  const chart = await getChart(conversation.chart_id);
  if (!chart) {
    const err = new Error(`Chart not found for conversation: ${conversation.chart_id}`);
    err.code = 'CHART_NOT_FOUND';
    throw err;
  }

  await addMessage({ conversationId, role: 'user', content: question });

  const pipelineResult = await runQuestionPipeline({
    provider: aiProvider,
    canonical: chart.canonical,
    question,
    conversationSummary: conversation.summary,
    extraSystemInstruction,
    predefinedRouting,
    enableKnowledgeRetrieval: true,
    catalogKind,
    authorizeBeforeAnalysis,
  });

  // §Phase3 — authorization이 거부되면 pipelineResult.analysis가 null이다. 이 경우 recordAnalysis
  // (토큰 비용 집계용)나 summary 누적을 평소처럼 진행하지 않는다 — 실제 분석이 이루어지지 않았기
  // 때문이다. 대화 메시지(안내 문구)만 남기고 즉시 반환한다.
  if (pipelineResult.authorization && !pipelineResult.authorization.authorized) {
    await addMessage({ conversationId, role: 'assistant', content: pipelineResult.response });
    return { response: pipelineResult.response, analysis: null, usage: pipelineResult.usage, authorization: pipelineResult.authorization };
  }

  await addMessage({ conversationId, role: 'assistant', content: pipelineResult.response });

  await recordAnalysis({
    chartId: chart.id,
    conversationId,
    question,
    selectedData: { router: pipelineResult.router, extracted: pipelineResult.extracted },
    model,
    response: pipelineResult.response,
    tokenUsage: pipelineResult.usage,
  });

  const nextSummary = appendToSummary(conversation.summary, question, pipelineResult);
  await updateConversationSummary(conversationId, {
    summary: nextSummary,
    important_context: [...(conversation.important_context ?? []), ...pipelineResult.router.categories].slice(-20),
  });

  return pipelineResult;
}

export async function getConversationHistory(conversationId) {
  return listMessages(conversationId);
}

// ============================================================
// 캐릭터/카탈로그 대화 레이어 (UX 설계 문서 §1~§19)
//
// 아래 3개 함수가 새 UX의 핵심 오케스트레이션이다. 전부 위의 startConversation/askQuestion을
// 그대로 재사용하고, packages/character/*의 순수 함수(rule-based, AI 호출 없음)로 "다음 선택지"를
// 결정한다. runQuestionPipeline 자체는 건드리지 않는다 — ground truth 계산/검증 경로는 완전히 그대로.
// ============================================================

/**
 * 대화 시작 시 보여줄 첫 선택지 세트. AI 호출 없음(§17 — rule-based로 시작) — 순수 카탈로그 필터링.
 * §19 "질문 선택하세요가 아니라 캐릭터가 말을 거는 느낌" — 이 함수는 선택지만 반환하고, 캐릭터의
 * "오프닝 대사"는 프론트엔드가 캐릭터별 고정 인사말 + 선택지 조합으로 렌더링하거나, 원한다면
 * 첫 catalog 선택 이후의 실제 분석 결과를 오프닝으로 쓸 수도 있다(정책 선택 사항, MVP는 전자로 시작).
 */
export function getOpeningChoices({ characterId = 'daegu' } = {}) {
  const choices = selectOpeningChoices({ catalog: QUESTION_CATALOG });
  return { character: getCharacter(characterId), choices: choices.map(toClientChoice) };
}

/**
 * 자녀 사주 전용 오프닝 선택지. 항상 'scholar'(박사냥) 캐릭터, 4개 context(아이성향/학습/관계/진로)
 * 별로 1개씩 — 일반 성인용 QUESTION_CATALOG와 완전히 분리된 카탈로그를 쓴다.
 */
export function getChildOpeningChoices() {
  const choices = selectOpeningChoices({ catalog: CHILD_QUESTION_CATALOG, limit: 4 });
  return { character: getCharacter('scholar'), choices: choices.map(toClientChoice) };
}

/**
 * 사용자가 선택지(카탈로그 항목)를 하나 골랐을 때 처리한다.
 *   1. catalog entry에서 실제 분석용 문장(question_text)과 required_data(=predefinedRouting)를 꺼낸다
 *      — 사용자에게 보여준 display_text("그럼 나는 돈을 어떻게 벌어야 해?")와 AI에게 보내는 문장이
 *      다를 수 있다(§8 — 내부는 정형화, 외부는 자연스럽게).
 *   2. predefinedRouting을 넘겨서 Router AI 호출을 스킵한다(§11 비용 절감).
 *   3. 캐릭터 톤 지시문을 extraSystemInstruction으로 얹는다.
 *   4. 응답 후 seen_catalog_ids/current_context 갱신 + 다음 선택지 계산.
 */
export async function pickCatalogChoice({ conversationId, catalogId, aiProvider, model = 'unknown', userId = null }) {
  const entry = getCatalogEntry(catalogId);
  if (!entry) {
    const err = new Error(`Unknown catalog id: ${catalogId}`);
    err.code = 'CATALOG_ENTRY_NOT_FOUND';
    throw err;
  }

  const conversation = await getConversation(conversationId);
  if (!conversation) {
    const err = new Error(`Conversation not found: ${conversationId}`);
    err.code = 'CONVERSATION_NOT_FOUND';
    throw err;
  }

  const character = getCharacter(entry.character ?? conversation.character_id);
  const predefinedRouting = {
    categories: [entry.category],
    saju_fields: entry.required_data.saju_fields,
    ziwei_fields: entry.required_data.ziwei_fields,
    ziwei_palace_focus: entry.required_data.ziwei_palace_focus,
    reasoning: `catalog:${entry.id}`,
  };

  // §Phase3 — 카탈로그 선택도 실질적으로 "사주 상세분석 데이터에 대한 질문"이므로
  // handleFreeTextMessage의 자유입력 경로와 동일한 authorization을 거친다(누락되어 있던 지점 —
  // 실측 테스트로 발견 후 수정).
  const authorizeBeforeAnalysis = async (routerResult) => {
    if (!userId) {
      return { authorized: false, message: '로그인 후 상세분석을 구매하시면 이 내용에 대해 채팅으로 질문할 수 있어요.' };
    }
    return authorizeAnalysisQuestion({
      userId,
      routerResult,
      conversationContext: { fortuneYear: conversation.fortune_year ?? null, chartId: conversation.chart_id ?? null, childProfileId: conversation.child_profile_id ?? null },
    });
  };

  // askQuestion에는 사용자가 "실제로 본" display_text를 메시지 기록으로 남기고, AI에게 보내는 분석
  // 요청 문장은 question_text를 쓴다 — 채팅 로그에는 자연스러운 문장이, 분석 파이프라인에는 정형화된
  // 문장이 들어가는 구조(§8).
  const pipelineResult = await askQuestion({
    conversationId,
    question: entry.question_text,
    aiProvider,
    model,
    extraSystemInstruction: character.toneInstruction,
    predefinedRouting,
    catalogKind: entry.kind,
    authorizeBeforeAnalysis,
  });

  if (pipelineResult.authorization?.authorized && pipelineResult.authorization.entitlementId) {
    try {
      await consumeQuestionEntitlement(pipelineResult.authorization.entitlementId, userId);
    } catch (err) {
      console.error('[entitlement 차감 실패]', err.message);
    }
  }

  await markCatalogEntrySeen(conversationId, { catalogId: entry.id, nextContext: entry.next_context });
  if (character.id !== conversation.character_id) {
    // 캐릭터가 바뀌었으면 대화 레코드에 영구 반영 — 그렇지 않으면 다음 자유 입력(handleFreeTextMessage)
    // 이 여전히 이전 character_id를 조회해서 방금 등장한 캐릭터가 한 턴 만에 사라져버린다.
    await updateConversationCharacter(conversationId, character.id);
  }

  const updatedConversation = await getConversation(conversationId);
  const nextChoices = resolveNextChoices({
    currentContext: entry.next_context,
    seenIds: updatedConversation.seen_catalog_ids,
  });

  return {
    displayText: entry.display_text, // 사용자가 실제로 눌렀던 문장(채팅 UI에 사용자 발화로 표시)
    response: pipelineResult.response,
    character,
    nextChoices: nextChoices.map(toClientChoice),
    usage: pipelineResult.usage,
    sources: pipelineResult.analysis?.sources ?? null,
    highlightCard: pipelineResult.analysis?.highlight_card ?? null,
  };
}

/**
 * 자녀 사주 전용 catalog-choice — pickCatalogChoice와 동일한 로직(predefinedRouting으로 Router
 * 스킵, 실제 파이프라인 그대로 호출)이지만 CHILD_QUESTION_CATALOG를 쓴다. 캐릭터 전환이 없다(항상
 * 'scholar' 고정)는 점만 다르다.
 */
export async function pickChildCatalogChoice({ conversationId, catalogId, aiProvider, model = 'unknown' }) {
  const entry = getChildCatalogEntry(catalogId);
  if (!entry) {
    const err = new Error(`Unknown child catalog id: ${catalogId}`);
    err.code = 'CATALOG_ENTRY_NOT_FOUND';
    throw err;
  }

  const conversation = await getConversation(conversationId);
  if (!conversation) {
    const err = new Error(`Conversation not found: ${conversationId}`);
    err.code = 'CONVERSATION_NOT_FOUND';
    throw err;
  }

  const character = getCharacter('scholar');
  const predefinedRouting = {
    categories: [entry.category],
    saju_fields: entry.required_data.saju_fields,
    ziwei_fields: entry.required_data.ziwei_fields,
    ziwei_palace_focus: entry.required_data.ziwei_palace_focus,
    reasoning: `child_catalog:${entry.id}`,
  };

  const pipelineResult = await askQuestion({
    conversationId,
    question: entry.question_text,
    aiProvider,
    model,
    extraSystemInstruction: character.toneInstruction,
    predefinedRouting,
    catalogKind: entry.kind,
  });

  await markCatalogEntrySeen(conversationId, { catalogId: entry.id, nextContext: entry.next_context });

  const updatedConversation = await getConversation(conversationId);
  const nextChoices = selectNextChoices({ catalog: CHILD_QUESTION_CATALOG, currentContext: entry.next_context, seenIds: updatedConversation.seen_catalog_ids, limit: 3 });

  return {
    displayText: entry.display_text,
    response: pipelineResult.response,
    character,
    nextChoices: nextChoices.map(toClientChoice),
    usage: pipelineResult.usage,
    highlightCard: pipelineResult.analysis.highlight_card ?? null,
  };
}

/**
 * 자유 입력 처리(§13 — 자유 입력도 반드시 제공). 일상 대화면 저가 모델(casualAiProvider)로 짧은
 * 리액션을 생성한다. 사주 판단 요청이면 기존 askQuestion(자유 텍스트 경로, Router AI 호출 포함)으로
 * 넘긴다.
 *
 * 남용 방지 3중 장치:
 *   1. 대화별 분당/시간당 호출 예산(recordAndCheckCasualAiBudget) — 초과 시 무료 고정 반응으로 대체.
 *   2. 메시지 길이 상한(truncateForCasual) — 긴 텍스트를 반복 전송해 토큰을 부풀리는 것 방지.
 *   3. casualAiProvider가 없거나(모델 미설정) 호출이 실패하면 항상 무료 고정 반응으로 안전하게 대체
 *      — 캐주얼 리액션은 부가 기능이라 실패해도 사용자 경험이 끊기면 안 된다.
 * 이 외에 apps/api/src/middleware/rate-limit.mjs가 IP 레벨에서 전체 요청 자체를 먼저 막는다(더 큰
 * 위험인 사주 분석 경로 포함).
 */
/** §출생일 택일 채팅 — DATE_SELECTION analysis_scope에 태깅된 conversation 전용 경로.
 * classifyMessage(casual/saju_question 분류)와 무관하게 항상 이 경로로 처리된다(호출부에서
 * 이미 date_selection_scope_id 존재로 구조적으로 라우팅됨). 이미 생성/저장된 평가 결과
 * (result_data — top1/top2to5/candidate_comparison)를 그대로 AI 컨텍스트로 쓴다 — AI가
 * 생년월일시나 후보를 다시 계산하지 않는다(§3 원칙). */
async function handleDateSelectionChatMessage({ conversationId, conversation, text, aiProvider, userId }) {
  const character = getCharacter(conversation?.character_id);
  await addMessage({ conversationId, role: 'user', content: text });

  if (!userId) {
    const response = '로그인 후 출생일 택일 결과를 구매하시면 이 내용에 대해 채팅으로 질문할 수 있어요.';
    await addMessage({ conversationId, role: 'assistant', content: response });
    return { intent: 'saju_question', response, character, usage: null, sources: null, cross_analysis: null, highlightCard: null };
  }

  const authResult = await authorizeAnalysisQuestion({
    userId,
    routerResult: {},
    conversationContext: { dateSelectionScopeId: conversation.date_selection_scope_id },
  });

  if (!authResult.authorized) {
    await addMessage({ conversationId, role: 'assistant', content: authResult.message });
    return { intent: 'saju_question', response: authResult.message, character, usage: null, sources: null, cross_analysis: null, highlightCard: null };
  }

  const scope = await getAnalysisScopeById(conversation.date_selection_scope_id);
  if (!scope?.result_data) {
    const response = '아직 분석 결과가 준비되지 않았어요. 결과를 먼저 확인한 뒤 다시 질문해주세요.';
    await addMessage({ conversationId, role: 'assistant', content: response });
    return { intent: 'saju_question', response, character, usage: null, sources: null, cross_analysis: null, highlightCard: null };
  }

  const aiResult = await aiProvider.complete({
    system: buildDateSelectionChatPrompt(),
    user: `이미 생성된 출생일 택일 분석 결과:\n${JSON.stringify(scope.result_data)}\n\n사용자 질문: ${text}`,
    jsonSchema: DATE_SELECTION_CHAT_RESPONSE_SCHEMA,
    schemaName: 'date_selection_chat',
  });
  const response = sanitizeUserFacingText(aiResult.data.response);

  // §14/§20과 동일 원칙 — AI 호출이 실제로 성공했을 때만 서버가 authorization 단계에서 찾은
  // entitlement를 차감한다(클라이언트가 보낸 entitlementId는 여기서도 전혀 쓰이지 않음).
  try {
    await consumeQuestionEntitlement(authResult.entitlementId, userId);
  } catch (err) {
    console.error('[출생일 택일 entitlement 차감 실패]', err.message);
  }

  await addMessage({ conversationId, role: 'assistant', content: response, metadata: { analysis_scope_id: conversation.date_selection_scope_id } });
  return { intent: 'saju_question', response, character, usage: aiResult.usage ?? null, sources: scope.result_data, cross_analysis: null, highlightCard: null };
}

export async function handleFreeTextMessage({ conversationId, text, aiProvider, model = 'unknown', casualAiProvider = null, casualModel = 'unknown', childCoachAiProvider = null, userId = null }) {
  // §출생일 택일 채팅 — 이 conversation이 DATE_SELECTION analysis_scope에 태깅되어 있으면,
  // classifyMessage(casual/saju_question 분류) 결과와 무관하게 항상 이 전용 경로를 탄다.
  // "왜 1위가 좋아?" 같은 자연스러운 후속 질문은 사주 키워드가 없어서 classifyMessage가
  // casual로 오분류할 수 있는데, 이 conversation의 도메인은 애초에 date_selection_scope_id로
  // 구조적으로 고정되어 있으므로(fortune_year/child_profile_id와 동일한 원칙) 텍스트 분류에
  // 의존할 필요가 없다 — 오히려 의존하면 실제로 캐주얼 응답으로 새버리는 버그가 된다(실측 확인).
  const earlyConversation = await getConversation(conversationId);
  if (earlyConversation?.date_selection_scope_id) {
    return handleDateSelectionChatMessage({ conversationId, conversation: earlyConversation, text, aiProvider, userId });
  }

  const intent = classifyMessage(text);

  if (intent === 'casual') {
    await addMessage({ conversationId, role: 'user', content: text });
    const conversation = await getConversation(conversationId);
    const character = getCharacter(conversation?.character_id);

    let reaction = null;
    let usage = null;
    let usedEvidenceRefs = null; // §11 — child context를 실제로 썼을 때만 채워짐, 서버 내부 추적용
    let suggestedQuestions = []; // 자녀 코치 전용 — 캐주얼 응답과 같은 호출에서 생성(추가 API 호출 없음)

    // 24시간 5회 체험 게이팅(§10) — child_profile_id가 있는 대화에서만 적용. 일반 캐주얼 대화는
    // 영향 없음.
    let trialBlocked = false;
    if (conversation?.child_profile_id) {
      const trial = await recordTrialUsage(conversation.child_profile_id);
      if (!trial.allowed) trialBlocked = true;
    }

    if (trialBlocked) {
      // 체험 종료 — AI 호출 자체를 하지 않는다(과금 방지). 판매 문구를 과도하게 쓰지 않는 안내로 대체.
      reaction = '오늘은 여기까지 같이 살펴볼 수 있어요. 지금까지 아이의 성향에 맞춰 몇 가지 상황을 같이 봤다면, 계속 이어서 이야기하면서 숙제·친구관계·감정표현처럼 실제 생활에서 부딪히는 문제도 하나씩 같이 살펴볼 수 있어요.';
    } else {
      // 모델 routing(§12): child_profile_id가 있으면 CHILD_COACH_MODEL(있을 때만) 우선 사용,
      // 없으면 기존 CASUAL_MODEL. childCoachAiProvider가 없으면(env 미설정) casualAiProvider로 폴백.
      const effectiveProvider = (conversation?.child_profile_id && childCoachAiProvider) ? childCoachAiProvider : casualAiProvider;

      if (effectiveProvider) {
        const budget = await recordAndCheckCasualAiBudget(conversationId, { maxPerMinute: CASUAL_AI_MAX_PER_MINUTE, maxPerHour: CASUAL_AI_MAX_PER_HOUR });
        if (budget.allowed) {
          try {
            // 관련성 게이팅(§9/§10): 의료/응급 주제면 child context를 이번 답변에서 빼고 일반 안전
            // 원칙만 따르게 한다. child_profile_id가 있어도 "모든 질문에 사주를 억지로 연결"하지 않음.
            const useChildContext = conversation?.child_profile_id && !isMedicalOrSafetyTopic(text);
            const childContext = useChildContext ? await getAIProfileContextByChildId(conversation.child_profile_id) : null;

            // conversation history(§8): 최근 대화 맥락 + child context + 현재 질문을 함께 사용한다.
            const recentMessages = await listMessages(conversationId);
            const userMessage = buildCasualUserMessage(text, recentMessages.slice(0, -1)); // 방금 추가한 이번 사용자 메시지는 제외(중복 방지)

            const priorMessages = recentMessages.slice(0, -1);
            const lastUserMessage = [...priorMessages].reverse().find((m) => m.role === 'user');
            const result = await effectiveProvider.complete({
              system: buildCasualSystemPrompt(character.id, childContext, text, priorMessages.length > 0, lastUserMessage?.content ?? ''), // history 유무 + 직전 사용자 발화(DEEP 반복맥락 판정용)
              user: userMessage,
              jsonSchema: CASUAL_RESPONSE_SCHEMA,
              schemaName: 'casual_reaction',
            });
            reaction = result.data.reaction;
            suggestedQuestions = (result.data.suggestedQuestions ?? []).slice(0, 3).map((q) => sanitizeUserFacingText(q)).filter(Boolean);
            usage = result.usage;
            // evidence_refs 추적(§11, BUG-4 수정): 이전엔 childContext가 조회되기만 하면(즉
            // useChildContext=true) 무조건 기록했는데, 이건 depth=NONE(실제로 프로필 재료를 하나도
            // 안 쓴 경우)에도 "사용했다"고 잘못 기록하는 결함이었다. getPersonalizationDepth로 실제
            // depth를 재확인해서, NONE이 아닐 때만 기록한다.
            if (childContext && getPersonalizationDepth(childContext, text, priorMessages.length > 0, lastUserMessage?.content ?? '') !== 'NONE') {
              usedEvidenceRefs = childContext.evidence_refs;
            }
          } catch (err) {
            // 이전엔 catch{}로 에러를 완전히 삭제해서, 실제 API 호출이 왜 실패하는지 진단할 방법이
            // 없었다(401/404/429/network error 전부 구분 불가). 이제 최소한의 정보(코드, 메시지,
            // HTTP status)만 서버 콘솔에 남긴다 — API 키 등 민감정보는 절대 로그하지 않는다.
            console.error('[casual chat AI 호출 실패]', {
              code: err.code ?? 'UNKNOWN',
              message: err.message,
              status: err.details?.status ?? err.status ?? null,
              model: effectiveProvider?.model ?? 'unknown',
            });
            reaction = null; // 아래에서 규칙 기반 엔진으로 대체
          }
        }
      }
    }

    if (!reaction) {
      if (conversation?.child_profile_id) {
        // 자녀 성장 코치 대화는 casual-response-engine(ㅋㅋ/ㅎㅎ 대량 포함, 성인 캐릭터 잡담용)을
        // 절대 쓰지 않는다 — API 실패/미설정 시에도 안전한 고정 문구로만 대체.
        reaction = '지금은 답을 준비하지 못했어요. 잠시 후 다시 물어봐 주세요.';
      } else {
        // casual-response-engine.mjs — intent × character × tone × timeContext 기반, API 호출 없음.
        // 최근 응답(최대 3개)과 겹치지 않도록 recent_casual_responses를 넘겨서 반복을 피한다.
        const generated = generateCasualResponse({
          characterId: character.id,
          userText: text,
          recentResponses: conversation?.recent_casual_responses ?? [],
        });
        reaction = generated.text;
      }
      suggestedQuestions = []; // fallback 경로는 LLM이 안 만들었으므로 추천 질문 없음(억지로 채우지 않음)
    }

    reaction = sanitizeUserFacingText(reaction);
    await recordCasualResponse(conversationId, reaction);
    await addMessage({ conversationId, role: 'assistant', content: reaction, metadata: usedEvidenceRefs ? { evidence_refs: usedEvidenceRefs } : null });
    return { intent, response: reaction, character, usage, highlightCard: null, suggestedQuestions };
  }

  const conversation = await getConversation(conversationId);
  const character = getCharacter(conversation?.character_id);

  // §출생일 택일 채팅 — 이 conversation이 특정 DATE_SELECTION analysis_scope에 태깅되어
  // §Phase3 — 클라이언트가 보낸 entitlementId는 여기 어디에도 등장하지 않는다. 서버가 로그인
  // 사용자(userId)만으로 유효한 entitlement를 직접 찾는다(entitlement-authorization-service.mjs).
  // userId가 없으면(비로그인) 개인 분석 권한을 가질 수 없으므로 Router 결과와 무관하게 즉시 거부한다.
  const authorizeBeforeAnalysis = async (routerResult) => {
    if (!userId) {
      return { authorized: false, message: '로그인 후 상세분석을 구매하시면 이 내용에 대해 채팅으로 질문할 수 있어요.' };
    }
    return authorizeAnalysisQuestion({
      userId,
      routerResult,
      conversationContext: { fortuneYear: conversation.fortune_year ?? null, chartId: conversation.chart_id ?? null, childProfileId: conversation.child_profile_id ?? null },
    });
  };

  const pipelineResult = await askQuestion({
    conversationId,
    question: text,
    aiProvider,
    model,
    extraSystemInstruction: character.toneInstruction,
    authorizeBeforeAnalysis,
  });

  if (pipelineResult.authorization && !pipelineResult.authorization.authorized) {
    // §14/§20 — 권한 없음 = 분석 호출 자체가 없었다는 뜻이므로 당연히 차감도 하지 않는다.
    return {
      intent,
      response: pipelineResult.response,
      character,
      usage: pipelineResult.usage,
      sources: null,
      cross_analysis: null,
      highlightCard: null,
    };
  }

  // §14/§20 — LLM(분석) 호출이 실제로 성공했을 때만, 서버가 authorization 단계에서 직접 찾아낸
  // entitlement를 차감한다(클라이언트가 요청에 실어 보낸 entitlementId는 여기서도 전혀 쓰이지
  // 않는다 — authResult.entitlementId만 신뢰).
  if (pipelineResult.authorization?.authorized && pipelineResult.authorization.entitlementId) {
    try {
      await consumeQuestionEntitlement(pipelineResult.authorization.entitlementId, userId);
    } catch (err) {
      // 이미 응답은 생성됐고 사용자에게 보여줘야 하므로, 차감 실패 자체로 응답을 취소하지 않는다
      // (동시 요청으로 인한 경합 등 — 서버 로그로만 남긴다).
      console.error('[entitlement 차감 실패]', err.message);
    }
  }

  return {
    intent,
    response: pipelineResult.response,
    character,
    usage: pipelineResult.usage,
    sources: pipelineResult.analysis.sources,
    cross_analysis: pipelineResult.analysis.cross_analysis,
    highlightCard: pipelineResult.analysis.highlight_card ?? null,
  };
}

function resolveNextChoices({ currentContext, seenIds }) {
  const primary = selectNextChoices({ catalog: QUESTION_CATALOG, currentContext, seenIds });
  if (primary.length > 0) return primary;
  return selectFallbackTopicSwitch({ catalog: QUESTION_CATALOG, excludeContext: currentContext, seenIds });
}

function toClientChoice(entry) {
  // 클라이언트에는 표시에 필요한 것만 노출 — question_text/required_data 등 내부 정형화 정보는
  // 서버에만 남긴다(§8 — 내부 시스템과 사용자 경험 분리). context는 자녀 사주 화면에서 카테고리
  // 라벨(아이성향/학습/관계/진로)을 붙이는 데 필요해서 추가로 노출한다.
  return { id: entry.id, displayText: entry.display_text, character: entry.character, free: entry.free, productLink: entry.product_link ?? null, context: entry.context };
}

/**
 * Naive rolling summary — deliberately NOT an extra AI call (that would add
 * cost/latency on every single turn just to keep memory). Keeps a capped
 * plain-text trail of "카테고리: 한줄질문" so the next turn's router/analysis
 * call has enough context for follow-ups like "그럼 사업은?" without
 * replaying full message history. If summary quality becomes a problem in
 * practice, swap this for a periodic (not per-turn) AI summarization call —
 * the interface (updateConversationSummary) doesn't need to change.
 */
/**
 * 대화 요약에 질문뿐 아니라 AI가 실제로 뭐라고 답했는지도 함께 남긴다.
 *
 * 이전 구현은 질문 카테고리+한줄요약만 저장하고 AI의 실제 답변은 전혀 저장하지 않았다 — 그래서
 * 다음 턴에서 AI가 "직전에 무슨 카테고리 질문이 있었다"만 알고 "내가 뭐라고 답했는지"는 몰라,
 * 사용자 발화를 받아서 자연스럽게 이어가지 못하거나 같은 질문을 반복하는 문제(요청 문서 §5/§6)의
 * 구조적 원인이었다. AI 응답을 다시 요약하는 별도 AI 호출은 만들지 않고(비용 증가 방지), response
 * 텍스트의 첫 문장(또는 앞부분)만 잘라 쓰는 rule-based 방식을 쓴다.
 */
function extractResponseGist(responseText, maxLength = 70) {
  if (!responseText) return '';
  const firstSentenceMatch = responseText.match(/^[^.!?\n]+[.!?]/);
  const candidate = firstSentenceMatch ? firstSentenceMatch[0] : responseText;
  return candidate.length > maxLength ? `${candidate.slice(0, maxLength)}...` : candidate;
}

export function appendToSummary(existingSummary, question, pipelineResult) {
  const categories = pipelineResult.router.categories.join(',');
  const oneLiner = question.length > 80 ? `${question.slice(0, 80)}...` : question;
  const responseGist = extractResponseGist(pipelineResult.response);
  const entry = responseGist ? `[${categories}] Q: ${oneLiner} / A: ${responseGist}` : `[${categories}] Q: ${oneLiner}`;
  const combined = existingSummary ? `${existingSummary}\n${entry}` : entry;
  return combined.length > MAX_SUMMARY_CHARS ? combined.slice(combined.length - MAX_SUMMARY_CHARS) : combined;
}
