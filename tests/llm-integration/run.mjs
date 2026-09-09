// tests/llm-integration/run.mjs
//
// 실제 OpenAI API를 호출하는 통합 테스트 러너. Mock provider를 절대 쓰지 않는다 —
// OPENAI_API_KEY가 없으면 즉시 실패하고 종료한다(가짜 결과를 만들지 않는다).
//
// 이 스크립트는 실제 서비스와 동일한 backend HTTP API(server.mjs)를 별도 포트로 띄워서 그대로
// 호출한다 — 서비스 코드를 흉내내거나 재구현하지 않는다. target/intent/depth 값은 서버 응답에
// 없으므로(내부 계산이라 API로 노출 안 됨), 기존에 이미 export되어 있는 순수 함수
// (classifyTarget/classifyIntent/resolveDepthAndMaterial)를 그대로 import해서 진단용으로만
// 재계산한다 — 서비스 코드를 1바이트도 수정하지 않는다.
//
// 실행: npm run test:llm  (프로젝트 루트의 .env에서 OPENAI_API_KEY 등을 읽는다)

import { spawn } from 'node:child_process';
import { writeFile, mkdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { loadEnvFile } from '../../packages/shared/load-env.mjs';
import { classifyTarget, classifyIntent, resolveDepthAndMaterial } from '../../packages/character/casual-chat-prompt.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '../..');
const TEST_PORT = 3999; // 실제 dev 서버(3000)와 충돌하지 않도록 별도 포트 사용
const BASE_URL = `http://localhost:${TEST_PORT}`;

// ============================================================
// 0. 환경 확인 — API 키가 없으면 여기서 즉시 중단한다. Mock으로 대체하지 않는다.
// ============================================================
async function assertRealApiKeyPresent() {
  await loadEnvFile();
  if (!process.env.OPENAI_API_KEY) {
    console.error('OPENAI_API_KEY가 없습니다. 프로젝트 루트의 .env 파일에 실제 키를 설정한 뒤 다시 실행하세요.');
    console.error('필요한 환경변수: OPENAI_API_KEY, OPENAI_MODEL, OPENAI_CASUAL_MODEL, OPENAI_CHILD_COACH_MODEL');
    console.error('이 테스트는 Mock provider를 쓰지 않습니다 — 실제 API 호출 없이는 실행하지 않습니다.');
    process.exit(1);
  }
  // 키 값 자체는 어떤 로그에도 출력하지 않는다. 존재 여부만 확인한다.
}

// ============================================================
// 1. 서버를 별도 포트로 기동하고 준비될 때까지 대기
// ============================================================
function startServer() {
  const child = spawn('node', ['apps/api/src/server.mjs'], {
    cwd: ROOT,
    env: { ...process.env, PORT: String(TEST_PORT) },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  let bootLog = '';
  // §버그 수정: 이전엔 서버의 stdout/stderr(console.error로 찍는 실제 API 에러 포함)를
  // bootLog 문자열에만 저장하고 사용자 화면에는 전혀 안 보여줬다 — 그래서 서버가 아무리 에러를
  // 로그해도 사용자는 절대 볼 수 없었다. 이제 그대로 이 프로세스의 콘솔에도 실시간으로 흘려보낸다.
  child.stdout.on('data', (d) => {
    bootLog += d.toString();
    process.stdout.write(`[server] ${d}`);
  });
  child.stderr.on('data', (d) => {
    bootLog += d.toString();
    process.stderr.write(`[server:err] ${d}`);
  });
  return { child, getBootLog: () => bootLog };
}

async function waitForServerReady(maxWaitMs = 8000) {
  const start = Date.now();
  while (Date.now() - start < maxWaitMs) {
    try {
      const res = await fetch(`${BASE_URL}/api/users`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ nickname: '__healthcheck__' }) });
      if (res.status < 500) return true;
    } catch {
      // 아직 안 떴음, 재시도
    }
    await new Promise((r) => setTimeout(r, 300));
  }
  return false;
}

// ============================================================
// 2. HTTP 헬퍼
// ============================================================
async function apiPost(pathname, body) {
  const startedAt = performance.now();
  const res = await fetch(`${BASE_URL}${pathname}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  const latencyMs = Math.round(performance.now() - startedAt);
  const json = await res.json().catch(() => ({}));
  return { status: res.status, ok: res.ok, json, latencyMs };
}
async function apiGet(pathname) {
  const startedAt = performance.now();
  const res = await fetch(`${BASE_URL}${pathname}`);
  const latencyMs = Math.round(performance.now() - startedAt);
  const json = await res.json().catch(() => ({}));
  return { status: res.status, ok: res.ok, json, latencyMs };
}

// ============================================================
// 3. Profile Leak 등 자동 스캔 가능한 항목만 기계적으로 판정한다. 답변 자연스러움/교육 근거 품질
// 등은 사람이 읽고 판단해야 하므로 REVIEW로 남긴다 — 억지로 자동 PASS/FAIL을 매기지 않는다.
// ============================================================
const LEAK_MARKERS = ['confidence:', '참고할 수 있는 육아 방법', '한계:', '출처(', '이게 전부다', 'selection', 'observable_pattern', 'trait_signal'];
function scanForLeak(text) {
  if (!text) return [];
  return LEAK_MARKERS.filter((m) => text.includes(m));
}

// ============================================================
// 4. 메인 실행
// ============================================================
// 서버의 실제 rate limiter(§middleware/rate-limit.mjs): /api/conversations/:id/messages와
// /api/charts/:id/questions에 burst(10초당 5회) + sustained(60초당 20회)가 걸려있다. 질문마다
// "안녕"(부팅) + 실제 메시지, 2번의 rate-limited 호출이 발생하므로 7초 간격을 둔다
// (2콜/7초 ≈ 60초당 17콜, sustained 20 이내로 안전 — 실측으로 보정된 값).
const RATE_LIMIT_SAFE_DELAY_MS = 7000;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function main() {
  await assertRealApiKeyPresent();

  const children = JSON.parse(await readFile(path.join(__dirname, 'fixtures/children.json'), 'utf-8'));
  const questions = JSON.parse(await readFile(path.join(__dirname, 'fixtures/questions.json'), 'utf-8'));

  console.log(`서버를 포트 ${TEST_PORT}에서 기동합니다...`);
  const { child: serverProcess, getBootLog } = startServer();
  const ready = await waitForServerReady();
  if (!ready) {
    console.error('서버가 제시간에 기동되지 않았습니다. 부팅 로그:');
    console.error(getBootLog());
    serverProcess.kill();
    process.exit(1);
  }

  // 실제로 real provider(Mock 아님)로 떴는지 부팅 로그에서 확인 — 여기서도 키 값 자체는 출력 안 함.
  const bootLog = getBootLog();
  if (bootLog.includes('MockAIProvider')) {
    console.error('서버가 MockAIProvider로 기동됐습니다 — 실제 API 키가 로드되지 않았습니다.');
    console.error('.env 파일과 OPENAI_MODEL/OPENAI_CASUAL_MODEL/OPENAI_CHILD_COACH_MODEL 설정을 확인하세요.');
    serverProcess.kill();
    process.exit(1);
  }
  console.log('서버 기동 확인됨(실제 provider). 테스트를 시작합니다.\n');

  const results = [];
  const runStartedAt = new Date().toISOString();

  for (const fixture of children) {
    await sleep(5000); // fixture 전환 시에도 안전 마진(직전 fixture의 sustained 카운터 여유 확보)
    console.log(`=== fixture: ${fixture.key} ===`);
    const userId = `llm-test-${fixture.key}-${Date.now()}`;

    // 1) chart 생성(fixture당 1번 — 사주 계산 자체는 매번 동일하므로 재사용해도 됨)
    const chart = await apiPost('/api/charts', { birthDate: fixture.birthDate, birthTime: fixture.birthTime, gender: fixture.gender, city: fixture.city });
    const chartId = chart.json.id;

    // 2) child profile 하나로 무료 기본 분석(§11 사용자당 1회 제한 실측 확인용)
    const sharedProfile = await apiPost('/api/child-profiles', { userId, chartId, name: fixture.name });
    const basicAnalysis = await apiPost(`/api/child-profiles/${sharedProfile.json.id}/analyses`, { userId, tier: 'basic' });
    const fullAnalysis = await apiPost(`/api/child-profiles/${sharedProfile.json.id}/analyses`, { userId, tier: 'full' });
    results.push({
      fixture: fixture.key, questionId: 'BASIC_ANALYSIS', category: 'analysis', question: '(기본 분석 요청)',
      target: null, intent: null, depth: null, modelUsed: process.env.OPENAI_CHILD_COACH_MODEL ?? 'unknown',
      httpStatus: basicAnalysis.status, latencyMs: basicAnalysis.latencyMs, response: JSON.stringify(basicAnalysis.json.summary ?? null),
      suggestedQuestions: null, usage: null, leakMarkersFound: [], autoFlags: basicAnalysis.ok ? [] : ['HTTP_ERROR'],
    });
    results.push({
      fixture: fixture.key, questionId: 'FULL_ANALYSIS', category: 'analysis', question: '(전체 분석 요청)',
      target: null, intent: null, depth: null, modelUsed: process.env.OPENAI_MODEL ?? 'unknown',
      httpStatus: fullAnalysis.status, latencyMs: fullAnalysis.latencyMs, response: JSON.stringify(fullAnalysis.json.summary ?? null),
      suggestedQuestions: null, usage: null, leakMarkersFound: [], autoFlags: fullAnalysis.ok ? [] : ['HTTP_ERROR'],
    });

    // 3) 캐주얼 대화 질문들 — §중요 수정: 실제 서비스에 "child profile당 24시간 5질문 무료 체험
    // 제한"이 있다(child-profile-repository.mjs recordTrialUsage). 한 profile에 30개 질문을 다
    // 보내면 6번째부터는 API 호출 자체를 안 하고 고정 문구만 나온다(실측으로 확인된 문제 — 이전
    // 실행에서 93개 중 75개가 이 이유로 테스트가 안 됐음). 질문마다 새 chart+profile을 만들어서
    // 매번 "체험 1회차"로 취급되게 한다 — 실제 사용자가 여러 날에 걸쳐 쓰는 것과 유사한 조건.
    for (const q of questions) {
      await sleep(RATE_LIMIT_SAFE_DELAY_MS); // rate limit 회피 — 매 질문 전송 전에 대기

      const perQProfile = await apiPost('/api/child-profiles', { userId: `${userId}-${q.id}`, chartId, name: fixture.name });
      const perQProfileId = perQProfile.json.id;
      // context 확보를 위해 이 프로필에도 기본 분석을 미리 태워둔다(실제 사용 흐름과 동일 — 대화
      // 전에 분석이 먼저 존재해야 target/depth 엔진이 재료를 쓸 수 있다).
      await apiPost(`/api/child-profiles/${perQProfileId}/analyses`, { userId: `${userId}-${q.id}`, tier: 'basic' });
      const contextResult = await apiGet(`/api/child-profiles/${perQProfileId}/context?userId=${userId}-${q.id}`);
      const childContext = contextResult.json.context;

      const first = await apiPost(`/api/charts/${chartId}/questions`, { question: '안녕', characterId: 'daegu', childProfileId: perQProfileId });
      const conversationId = first.json.conversationId;

      const target = childContext ? classifyTarget(q.text) : null;
      const intent = childContext ? classifyIntent(q.text) : null;
      const depthInfo = childContext ? resolveDepthAndMaterial(childContext, q.text, target, intent, false, '') : null;

      const msg = await apiPost(`/api/conversations/${conversationId}/messages`, { question: q.text });

      const record = {
        fixture: fixture.key,
        questionId: q.id,
        category: q.category,
        question: q.text,
        note: q.note,
        target,
        intent,
        depth: depthInfo?.depth ?? null,
        modelUsed: process.env.OPENAI_CHILD_COACH_MODEL ?? 'unknown', // 이 경로는 항상 child coach provider(Luna)
        httpStatus: msg.status,
        latencyMs: msg.latencyMs,
        response: msg.json.response ?? null,
        suggestedQuestions: msg.json.suggestedQuestions ?? null, // null이면 §알려진 버그(라우트 누락) 재확인용
        usage: msg.json.usage ?? null,
        leakMarkersFound: scanForLeak(msg.json.response ?? ''),
        autoFlags: [],
      };

      if (!msg.ok) record.autoFlags.push('HTTP_ERROR');
      if (record.leakMarkersFound.length > 0) record.autoFlags.push('POSSIBLE_LEAK');
      if (record.suggestedQuestions === null || record.suggestedQuestions === undefined) record.autoFlags.push('SUGGESTED_QUESTIONS_MISSING_FROM_RESPONSE');
      if (q.category === 'parent' && depthInfo && depthInfo.depth !== 'NONE') record.autoFlags.push('UNEXPECTED_NON_NONE_DEPTH_FOR_PARENT_TARGET');

      results.push(record);
      console.log(`  [${fixture.key}] ${q.id} target=${target} depth=${depthInfo?.depth} latency=${msg.latencyMs}ms flags=${record.autoFlags.join(',') || '-'}`);
    }
  }

  serverProcess.kill();

  const runEndedAt = new Date().toISOString();
  await mkdir(path.join(__dirname, 'results'), { recursive: true });
  const stamp = runStartedAt.replace(/[:.]/g, '-');
  const jsonPath = path.join(__dirname, `results/llm-test-${stamp}.json`);
  const mdPath = path.join(__dirname, `results/llm-test-${stamp}.md`);

  const summary = {
    runStartedAt,
    runEndedAt,
    totalCalls: results.length,
    httpErrors: results.filter((r) => r.autoFlags.includes('HTTP_ERROR')).length,
    possibleLeaks: results.filter((r) => r.autoFlags.includes('POSSIBLE_LEAK')).length,
    suggestedQuestionsMissing: results.filter((r) => r.autoFlags.includes('SUGGESTED_QUESTIONS_MISSING_FROM_RESPONSE')).length,
    unexpectedParentDepth: results.filter((r) => r.autoFlags.includes('UNEXPECTED_NON_NONE_DEPTH_FOR_PARENT_TARGET')).length,
  };

  await writeFile(jsonPath, JSON.stringify({ summary, results }, null, 2), 'utf-8');
  await writeFile(mdPath, buildMarkdownReport(summary, results), 'utf-8');

  console.log('\n=== 완료 ===');
  console.log(JSON.stringify(summary, null, 2));
  console.log(`\nJSON: ${jsonPath}`);
  console.log(`Markdown: ${mdPath}`);
}

function buildMarkdownReport(summary, results) {
  const lines = [];
  lines.push('# LLM 통합 테스트 결과');
  lines.push('');
  lines.push(`실행 시각: ${summary.runStartedAt} ~ ${summary.runEndedAt}`);
  lines.push('');
  lines.push('## 요약');
  lines.push('');
  lines.push(`- 총 호출 수: ${summary.totalCalls}`);
  lines.push(`- HTTP 에러: ${summary.httpErrors}`);
  lines.push(`- Leak 의심(자동 스캔): ${summary.possibleLeaks}`);
  lines.push(`- suggestedQuestions 누락(알려진 라우트 버그 재확인): ${summary.suggestedQuestionsMissing}`);
  lines.push(`- parent target인데 depth!=NONE(예상치 못한 경우): ${summary.unexpectedParentDepth}`);
  lines.push('');

  const flagged = results.filter((r) => r.autoFlags.length > 0);
  if (flagged.length > 0) {
    lines.push('## 자동 플래그가 붙은 항목 (우선 검토)');
    lines.push('');
    lines.push('| fixture | id | category | target | depth | flags | latency |');
    lines.push('|---|---|---|---|---|---|---|');
    for (const r of flagged) {
      lines.push(`| ${r.fixture} | ${r.questionId} | ${r.category} | ${r.target ?? '-'} | ${r.depth ?? '-'} | ${r.autoFlags.join(', ')} | ${r.latencyMs}ms |`);
    }
    lines.push('');
  }

  lines.push('## 전체 결과');
  lines.push('');
  for (const r of results) {
    lines.push(`### [${r.fixture}] ${r.questionId} (${r.category})`);
    lines.push('');
    lines.push(`질문: ${r.question}`);
    if (r.note) lines.push(`검증 포인트: ${r.note}`);
    lines.push(`target=${r.target ?? '-'} intent=${r.intent ?? '-'} depth=${r.depth ?? '-'} model=${r.modelUsed} latency=${r.latencyMs}ms http=${r.httpStatus}`);
    lines.push('');
    lines.push('응답:');
    lines.push('');
    lines.push('```');
    lines.push(r.response ?? '(없음)');
    lines.push('```');
    if (r.suggestedQuestions) {
      lines.push('');
      lines.push(`추천 질문: ${JSON.stringify(r.suggestedQuestions)}`);
    }
    if (r.autoFlags.length > 0) {
      lines.push('');
      lines.push(`자동 플래그: ${r.autoFlags.join(', ')}`);
    }
    lines.push('');
    lines.push('---');
    lines.push('');
  }
  return lines.join('\n');
}

main().catch((err) => {
  console.error('테스트 실행 중 오류:', err.message);
  process.exit(1);
});
