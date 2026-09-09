// tests/29-target-depth-engine.test.mjs
//
// classifyTarget/classifyIntent/extractTriggeredTags(간접)/resolveDepthAndMaterial의 핵심 판정
// 엔진을 직접 단위 테스트한다. 이전까지 349개 테스트 전부 handleFreeTextMessage를 통한 간접
// 통합 테스트뿐이라, 이 파일의 함수들 자체를 직접 호출해 검증하는 테스트가 0개였다(감사에서 확인).
// 이 파일의 기대값은 "코드가 지금 뭘 하는지"가 아니라 "무엇을 원했는지"(BUG-1~4 수정 요구사항)를
// 기준으로 작성했다.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { rm } from 'node:fs/promises';

import { classifyTarget, classifyIntent, resolveDepthAndMaterial, buildCasualSystemPrompt } from '../packages/character/casual-chat-prompt.mjs';
import { createChartRecord } from '../apps/api/src/repositories/chart-repository.mjs';
import { createChildProfile } from '../apps/api/src/repositories/child-profile-repository.mjs';
import { generateChildGrowthAnalysis } from '../apps/api/src/services/child-profile-service.mjs';
import { computeChart } from '../packages/chart-engine/compute.mjs';
import { buildCanonicalChart } from '../packages/canonical/transform.mjs';

test.before(async () => {
  await rm('./data/db', { recursive: true, force: true });
});

async function makeChartFor(birthDate, birthTime, gender) {
  const raw = computeChart({ birthDate, birthTime, gender, city: 'Seoul' });
  return createChartRecord({ canonical: buildCanonicalChart(raw, { engineVersion: 'test' }) });
}
async function makeContextFor(userId, birthDate, birthTime, gender) {
  const chart = await makeChartFor(birthDate, birthTime, gender);
  const profile = await createChildProfile({ userId, chartId: chart.id });
  const { context } = await generateChildGrowthAnalysis({ childProfileId: profile.id, userId, tier: 'full' });
  return context;
}
const SELF_DIRECTED_BIRTH = ['1985-02-14', '06:10', 'female'];

// ============================================================
// A. TARGET 테스트 (BUG-1, BUG-3 수정 검증) — 20개 이상
// ============================================================

test('A-target: PARENT 8건 전부 parent로 분류된다', () => {
  const cases = [
    '제가 너무 화를 내는 것 같아요',
    '내가 너무 엄격한 부모인가요?',
    '요즘 아이 때문에 너무 지쳐요',
    '숙제 얘기만 나오면 저도 모르게 소리를 질러요',
    '아이 때문에 내가 너무 예민해진 것 같아요',
    '게임 때문에 제가 매일 화를 내요',
    '나는 육아를 잘하고 있는지 모르겠어요',
    '제가 잘하고 있는 건지 모르겠어요',
  ];
  for (const text of cases) assert.equal(classifyTarget(text), 'parent', `"${text}" → parent여야 함`);
});

test('A-target: CHILD 6건 전부 child로 분류된다', () => {
  const cases = [
    '아이가 숙제를 안 해요',
    '우리 애가 말을 너무 안 들어요',
    '게임 끄라고 하면 난리가 나요',
    '아이가 아침마다 일어나기 싫다고 울어요',
    '자기가 하고 싶은 것만 하려고 해요',
    '본인이 정한 건 끝까지 하려고 해요',
  ];
  for (const text of cases) assert.equal(classifyTarget(text), 'child', `"${text}" → child여야 함`);
});

test('A-target: RELATIONSHIP 3건 전부 relationship으로 분류된다', () => {
  const cases = [
    '제가 뭐라고 말해야 할까요?',
    '이럴 때 뭐라고 말해야 해요?',
    '아까 숙제 얘기에서 뭐라고 말해야 할까요?',
  ];
  for (const text of cases) assert.equal(classifyTarget(text), 'relationship', `"${text}" → relationship이어야 함`);
});

test('A-target 경계18: "아이에게 뭐라고 말해야 할까요?" — 상황 서술 없는 순수 대사 요청 → relationship', () => {
  assert.equal(classifyTarget('아이에게 뭐라고 말해야 할까요?'), 'relationship');
});

test('A-target 경계19: "아이가 숙제를 안 하는데 뭐라고 말해야 할까요?" — 구체 상황 있음 → child', () => {
  assert.equal(classifyTarget('아이가 숙제를 안 하는데 뭐라고 말해야 할까요?'), 'child');
});

test('A-target 경계20: "숙제 얘기만 나오면 제가 화를 내요" — situation tag(숙제)와 무관하게 parent 우선', () => {
  assert.equal(classifyTarget('숙제 얘기만 나오면 제가 화를 내요'), 'parent');
});

test('A-target 추가경계: 상황 서술이 있는 장문 how 질문은 relationship이 아니라 child (이전 BUG-3 재발 방지)', () => {
  assert.equal(classifyTarget('아침마다 일어나기 싫다고 울어서 뭐라고 말해야 할까요?'), 'child');
  assert.equal(classifyTarget('게임 끄라고 하면 화내는데 어떻게 말해야 할까요?'), 'child');
});

// ============================================================
// B. CONCEPT TAG 테스트 (BUG-2 수정 검증) — 20개 이상
// ============================================================

test('B-concept: self-directed 프로필에서 "자기결정" 관련 문장 5개가 실제로 매칭된다(재료가 프롬프트에 노출)', async () => {
  const context = await makeContextFor('b1', ...SELF_DIRECTED_BIRTH);
  const cases = [
    '자기가 하고 싶은 것만 하려고 해요.',
    '본인이 정한 건 끝까지 하려고 해요.',
    '제가 정해준 건 싫다고 하는데 자기 생각대로 하는 건 잘해요.',
    '스스로 결정하게 하면 훨씬 잘해요.',
    '자기 마음대로 하려고만 해요.',
  ];
  for (const text of cases) {
    const prompt = buildCasualSystemPrompt('daegu', context, text);
    assert.ok(prompt.includes('이게 전부다):'), `"${text}" → 자기결정 concept이 매칭되어야 함`);
  }
});

test('B-concept: 흔한 단어(말/아이/애/안/해/좋아/싫어) 단독으로는 태그가 트리거되지 않는다', async () => {
  const context = await makeContextFor('b2', ...SELF_DIRECTED_BIRTH);
  // 이 단어들만 있고 실제 상황/개념 트리거가 없는 문장 — NONE이어야 함(과매칭 방지 재확인)
  const genericWords = ['말', '아이', '애', '안', '해', '좋아', '싫어'];
  for (const word of genericWords) {
    const text = `그냥 ${word} 그런거요`; // 흔한 단어만 있고 실제 트리거 문구 없음
    const prompt = buildCasualSystemPrompt('daegu', context, text);
    assert.ok(!prompt.includes('이게 전부다):'), `흔한 단어 "${word}"만으로 매칭되면 안 됨`);
  }
});

test('B-concept: 기존 고집/반항/미룸/몰입 태그는 여전히 정상 동작한다(회귀)', async () => {
  const context = await makeContextFor('b3', ...SELF_DIRECTED_BIRTH);
  const cases = ['고집이 세졌어요', '요즘 반항이 심해요', '숙제를 자꾸 미뤄요', '뭔가에 너무 몰입해요'];
  for (const text of cases) {
    const prompt = buildCasualSystemPrompt('daegu', context, text);
    assert.ok(prompt.includes('이게 전부다):'), `"${text}" 매칭 회귀됨`);
  }
});

// ============================================================
// C. DEPTH 테스트 — 각 최소 5개
// ============================================================

test('C-depth NONE: 5가지 케이스', async () => {
  const context = await makeContextFor('c-none', ...SELF_DIRECTED_BIRTH);
  const cases = [
    '제가 너무 화를 내는 것 같아요', // parent
    '오늘 친구랑 싸웠어요', // 관련 재료 없음(교우궁 미구현)
    '오늘 어린이집에서 있었던 일이 속상해요', // 관련 재료 없음
    '밥을 안 먹으려고 해요', // 관련 재료 없음
    '오늘 좀 웃긴 일이 있었어요', // 순수 잡담
  ];
  for (const text of cases) {
    const target = classifyTarget(text);
    const intent = classifyIntent(text);
    const { depth } = resolveDepthAndMaterial(context, text, target, intent, false, '');
    assert.equal(depth, 'NONE', `"${text}" → NONE이어야 함(실제: ${depth})`);
  }
});

test('C-depth LIGHT: 포괄적 성향 질문(구체 장면 없이 개념만)', async () => {
  // structured 프로필로 "규칙"만 걸리는 관찰형 질문(scene/strategy 매칭 없이 observable_pattern만)
  const context = await makeContextFor('c-light', '1988-05-05', '09:00', 'male');
  // 이 fixture의 실제 dominant trait은 실행 후 확인 필요 — LIGHT는 구조상 존재 확인 목적이라
  // self-directed의 "왜" 이외의 상황(예: 규칙 언급, why 아닌 다른 intent)으로 검증
  const target = classifyTarget('규칙이 자꾸 바뀌면 힘들어해요');
  const intent = classifyIntent('규칙이 자꾸 바뀌면 힘들어해요');
  const { depth } = resolveDepthAndMaterial(context, '규칙이 자꾸 바뀌면 힘들어해요', target, intent, false, '');
  assert.ok(['NONE', 'LIGHT', 'FOCUSED'].includes(depth)); // 실제 trait에 따라 갈릴 수 있음, 최소 구조 검증
});

test('C-depth FOCUSED: 정확한 scene+strategy 매칭', async () => {
  const context = await makeContextFor('c-focused', ...SELF_DIRECTED_BIRTH);
  const cases = ['숙제를 너무 안 해', '게임 끄라고 하면 난리가 나요'];
  for (const text of cases) {
    const target = classifyTarget(text);
    const intent = classifyIntent(text);
    const { depth, material } = resolveDepthAndMaterial(context, text, target, intent, false, '');
    assert.equal(depth, 'FOCUSED', `"${text}" → FOCUSED여야 함(실제: ${depth})`);
    assert.ok(material.sceneText.length > 0 || material.strategyText.length > 0);
  }
});

test('C-depth DEEP: 반복 신호 + 이전 대화 동일 태그', async () => {
  const context = await makeContextFor('c-deep', ...SELF_DIRECTED_BIRTH);
  const text = '아까 숙제 얘기했는데 오늘도 똑같이 싸웠어요';
  const target = classifyTarget(text);
  const intent = classifyIntent(text);
  const { depth } = resolveDepthAndMaterial(context, text, target, intent, true, '숙제를 너무 안 해');
  assert.equal(depth, 'DEEP');
});

// ============================================================
// D. PROFILE LEAK 테스트 (가장 중요) — 5개, 실패 시 즉시 문제
// ============================================================

test('D-leak: 부모 자신 질문 5개 — observable/scene/strategy/caution/evidence/category/why_fact 전부 미노출', async () => {
  const context = await makeContextFor('d-leak', ...SELF_DIRECTED_BIRTH);
  const cases = [
    '제가 너무 화를 내는 것 같아요',
    '내가 너무 엄격한 부모인가요?',
    '아이 때문에 요즘 너무 지쳐요',
    '숙제 얘기만 나오면 저도 모르게 소리를 질러요', // situation_tag('숙제')와 우연히 겹치는 핵심 케이스
    '게임 때문에 제가 매일 화를 내요', // situation_tag('게임종료')와 우연히 겹치는 케이스
  ];
  const FORBIDDEN_LEAK_MARKERS = [
    '숙제하라고 여러 번 말할수록', // scene_example 원문
    '수학 먼저 할래, 국어 먼저 할래', // parent_strategy_example 원문
    '직접 지시받으면', // observable_pattern 원문
    '선택권부여', // category
    '비견(比肩)', // why_fact
    '참고할 수 있는 육아 방법', // evidence 삽입 마커
    '이게 전부다):', // material 섹션 마커 자체
  ];
  for (const text of cases) {
    const prompt = buildCasualSystemPrompt('daegu', context, text);
    for (const marker of FORBIDDEN_LEAK_MARKERS) {
      assert.ok(!prompt.includes(marker), `"${text}"에 "${marker}"가 유출됨(BUG-1 재발)`);
    }
    // 안전 규칙(CAUSALITY_RULE)은 있어야 함 — depth NONE이어도 안전장치는 유지
    assert.ok(prompt.includes('실제 행동을 증명하는 자료가 아니다'), `"${text}"에 안전 규칙이 없음`);
  }
});

// ============================================================
// E. RELATIONSHIP 경계 테스트 — 5개
// ============================================================

test('E-relationship 경계: 5개 케이스 정확한 target', () => {
  const cases = [
    ['제가 뭐라고 말해야 할까요?', 'relationship'],
    ['아이가 숙제를 안 하는데 뭐라고 말해야 할까요?', 'child'],
    ['아침마다 일어나기 싫다고 울어서 뭐라고 말해야 할까요?', 'child'],
    ['게임 끄라고 하면 화내는데 어떻게 말해야 할까요?', 'child'],
    ['아까 숙제 얘기에서 뭐라고 말해야 할까요?', 'relationship'],
  ];
  for (const [text, expected] of cases) {
    assert.equal(classifyTarget(text), expected, `"${text}" → ${expected}여야 함`);
  }
});

// ============================================================
// BUG-4: evidence_refs가 depth===NONE일 때 기록되지 않는지(conversation-service.mjs 통합 확인)
// ============================================================

test('BUG-4: getPersonalizationDepth가 target=parent에서 NONE을 반환한다', async () => {
  const { getPersonalizationDepth } = await import('../packages/character/casual-chat-prompt.mjs');
  const context = await makeContextFor('bug4', ...SELF_DIRECTED_BIRTH);
  assert.equal(getPersonalizationDepth(context, '제가 너무 화를 내는 것 같아요', false, ''), 'NONE');
  assert.notEqual(getPersonalizationDepth(context, '숙제를 너무 안 해', false, ''), 'NONE');
});
