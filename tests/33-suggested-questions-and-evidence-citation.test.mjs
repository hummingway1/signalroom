// tests/33-suggested-questions-and-evidence-citation.test.mjs
//
// 이번 반영(추천 질문 자동완성, 교육 근거 짧은 인용, 학습유형 비분류 원칙)에 대한 회귀 테스트.
// 기존 Profile Leak/Evidence 게이팅/Target·Intent·Depth 엔진은 전혀 건드리지 않았음을 이 파일이
// 직접 재확인한다 — "기존 테스트를 고쳐서 통과시키는" 방식이 아니라 새 기능이 기존 안전장치를
// 깨지 않는지 별도로 검증.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { rm } from 'node:fs/promises';

import { classifyTarget, classifyIntent, resolveDepthAndMaterial, buildCasualSystemPrompt, CASUAL_RESPONSE_SCHEMA } from '../packages/character/casual-chat-prompt.mjs';
import { createChartRecord } from '../apps/api/src/repositories/chart-repository.mjs';
import { createChildProfile } from '../apps/api/src/repositories/child-profile-repository.mjs';
import { generateChildGrowthAnalysis } from '../apps/api/src/services/child-profile-service.mjs';
import { computeChart } from '../packages/chart-engine/compute.mjs';
import { buildCanonicalChart } from '../packages/canonical/transform.mjs';

test.before(async () => {
  await rm('./data/db', { recursive: true, force: true });
});

async function makeContextFor(userId, birthDate, birthTime, gender) {
  const raw = computeChart({ birthDate, birthTime, gender, city: 'Seoul' });
  const chart = await createChartRecord({ canonical: buildCanonicalChart(raw, { engineVersion: 'test' }) });
  const profile = await createChildProfile({ userId, chartId: chart.id });
  const { context } = await generateChildGrowthAnalysis({ childProfileId: profile.id, userId });
  return context;
}
const SELF_DIRECTED_BIRTH = ['1985-02-14', '06:10', 'female'];

// ============================================================
// A. 추천 질문 스키마/지시문 구조 검증
// ============================================================

test('A1: CASUAL_RESPONSE_SCHEMA에 suggestedQuestions가 최대 3개로 정의되어 있다', () => {
  const prop = CASUAL_RESPONSE_SCHEMA.properties.suggestedQuestions;
  assert.ok(prop, 'suggestedQuestions 필드가 스키마에 없음');
  assert.equal(prop.maxItems, 3);
  assert.equal(prop.type, 'array');
  // §버그수정(실제 OpenAI API 호출로 확정): strict:true 모드는 properties의 모든 키가 required
  // 에도 포함되어야 한다. 이전엔 "필수 아님"을 검증했었는데, 이게 정확히 HTTP 400
  // ("'required' is required to be supplied and to be an array including every key in
  // properties. Missing 'suggestedQuestions'.")을 유발한 원인이었다. 값 자체는 빈 배열([])을
  // 반환하는 것으로 "선택적" 의미를 유지한다(필드 존재 자체는 항상 필수).
  assert.ok(CASUAL_RESPONSE_SCHEMA.required.includes('suggestedQuestions'), 'OpenAI strict 모드 제약상 required에 포함되어야 함(HTTP 400 재발 방지)');
});

test('A2: FOCUSED depth 프롬프트에 "무관한 고정 질문 끼워넣지 않는다" 지시가 있다', async () => {
  const context = await makeContextFor('a2', ...SELF_DIRECTED_BIRTH);
  const prompt = buildCasualSystemPrompt('daegu', context, '숙제를 죽어도 안 해요');
  assert.ok(prompt.includes('지금 화제와 무관한'), '무관 화제 배제 지시가 없음');
  assert.ok(prompt.includes('딱 3개까지'), '3개 제한 지시가 없음');
});

test('A3: NONE depth(부모 질문)에서도 추천 질문 지시 자체는 존재한다(빈 배열 허용 문구 포함)', async () => {
  const context = await makeContextFor('a3', ...SELF_DIRECTED_BIRTH);
  const prompt = buildCasualSystemPrompt('daegu', context, '제가 너무 화를 내는 것 같아요');
  assert.ok(prompt.includes('빈 배열로'), 'NONE에서도 추천 질문 관련 지시가 있어야 함(강제 생성 아님)');
});

// ============================================================
// B. 교육 근거 인용 — confidence/sources 노출 검증 (게이팅 조건 무변경 확인)
// ============================================================

test('B1: FOCUSED depth에서 evidence의 confidence/sources/limitations가 실제로 노출된다', async () => {
  const context = await makeContextFor('b1', ...SELF_DIRECTED_BIRTH);
  const prompt = buildCasualSystemPrompt('daegu', context, '숙제를 죽어도 안 해요');
  assert.ok(prompt.includes('confidence:'), 'confidence가 노출되어야 함(§2/§3/§9)');
  assert.ok(prompt.includes('한계:'), 'limitations가 노출되어야 함');
  assert.ok(prompt.includes('출처'), 'sources가 노출되어야 함');
  assert.ok(!prompt.includes('출처나 이론 이름을 언급하지 말고'), '이전의 출처 숨김 지시는 제거되어야 함');
});

test('B2: evidence 게이팅 조건은 그대로다 — target=parent(NONE)에서는 여전히 evidence 자체가 노출되지 않는다', async () => {
  const context = await makeContextFor('b2', ...SELF_DIRECTED_BIRTH);
  const prompt = buildCasualSystemPrompt('daegu', context, '제가 너무 화를 내는 것 같아요');
  assert.ok(!prompt.includes('confidence:'), 'parent target에서 evidence가 노출되면 안 됨(기존 게이팅 위반)');
  assert.ok(!prompt.includes('참고할 수 있는 육아 방법'), 'parent target에서 evidence 삽입 마커가 있으면 안 됨');
});

test('B3: LIGHT depth에서도 evidence는 여전히 노출되지 않는다(기존 게이팅 — FOCUSED/DEEP 전용)', async () => {
  const context = await makeContextFor('b3', ...SELF_DIRECTED_BIRTH);
  const target = classifyTarget('자기가 하고 싶은 것만 하려고 해요');
  const intent = classifyIntent('자기가 하고 싶은 것만 하려고 해요');
  const { depth } = resolveDepthAndMaterial(context, '자기가 하고 싶은 것만 하려고 해요', target, intent, false, '');
  assert.equal(depth, 'LIGHT');
  const prompt = buildCasualSystemPrompt('daegu', context, '자기가 하고 싶은 것만 하려고 해요');
  assert.ok(!prompt.includes('confidence:'), 'LIGHT depth에서 evidence가 노출되면 안 됨');
});

// ============================================================
// C. Profile Leak 재확인 — 이번 확장이 leak을 유발하지 않는지
// ============================================================

test('C1: 부모 질문 5개 — evidence 확장 이후에도 observable/scene/category/why_fact 전부 미노출', async () => {
  const context = await makeContextFor('c1', ...SELF_DIRECTED_BIRTH);
  const cases = [
    '제가 너무 화를 내는 것 같아요',
    '내가 너무 엄격한 부모인가요?',
    '아이 때문에 요즘 너무 지쳐요',
    '숙제 얘기만 나오면 저도 모르게 소리를 질러요',
    '게임 때문에 제가 매일 화를 내요',
  ];
  const FORBIDDEN = ['숙제하라고 여러 번 말할수록', '선택권부여', '비견(比肩)', 'confidence:', '참고할 수 있는 육아 방법', '이게 전부다):'];
  for (const text of cases) {
    const prompt = buildCasualSystemPrompt('daegu', context, text);
    for (const marker of FORBIDDEN) {
      assert.ok(!prompt.includes(marker), `"${text}"에 "${marker}" 유출됨`);
    }
    assert.ok(prompt.includes('실제 행동을 증명하는 자료가 아니다'), `"${text}"에 안전 규칙 없음`);
  }
});

// ============================================================
// D. 학습유형 비분류 원칙 — 모든 depth에 존재
// ============================================================

test('D1: NONE/LIGHT/FOCUSED 전부 학습유형 비분류 원칙을 포함한다', async () => {
  const context = await makeContextFor('d1', ...SELF_DIRECTED_BIRTH);
  const cases = ['제가 너무 화를 내는 것 같아요', '자기가 하고 싶은 것만 하려고 해요', '숙제를 죽어도 안 해요'];
  for (const text of cases) {
    const prompt = buildCasualSystemPrompt('daegu', context, text);
    assert.ok(prompt.includes('시각 기억형') || prompt.includes('학습 유형 단정 금지'), `"${text}"에 학습유형 비분류 원칙 없음`);
  }
});

test('D2: 사주 인과관계 단정 금지 규칙 회귀 없음(기존 CAUSALITY_RULE 그대로 유지)', async () => {
  const context = await makeContextFor('d2', ...SELF_DIRECTED_BIRTH);
  const prompt = buildCasualSystemPrompt('daegu', context, '숙제를 죽어도 안 해요');
  assert.ok(prompt.includes('귀문관살 때문에 예민합니다'));
  assert.ok(prompt.includes('사주상 ADHD 성향이 있습니다'));
});

// ============================================================
// E. Target/Intent/Depth 엔진 자체 회귀 없음 (이번 작업에서 절대 손대지 않은 부분 재확인)
// ============================================================

test('E1: 기존 target 분류 결과 회귀 없음(대표 8개 재확인)', () => {
  const cases = [
    ['제가 너무 화를 내는 것 같아요', 'parent'],
    ['아이가 숙제를 안 해요', 'child'],
    ['아이랑 매일 싸워요', 'relationship'],
    ['내가 너무 엄격한 부모인가요?', 'parent'],
    ['왜 이렇게 고집이 센 걸까요?', 'child'],
    ['제가 뭐라고 말해야 할까요?', 'relationship'],
    ['아이가 친구와 싸웠어요', 'child'],
    ['요즘 육아가 너무 버거워요', 'parent'],
  ];
  for (const [text, expected] of cases) assert.equal(classifyTarget(text), expected, `"${text}" 회귀됨`);
});
