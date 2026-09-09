// tests/31-final-precision-fixes.test.mjs
//
// 마지막 라운드(TASK1: scene/strategy relevance, TASK2: target parent self-state 최소 보완)에
// 대한 회귀 테스트. 독립 감사에서 실제로 실패했던 문장을 그대로 사용한다. 기대값은 요구사항
// 기준으로 먼저 정의했고, 코드 출력에 맞춰 바꾸지 않았다.
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

async function makeContextFor(userId, birthDate, birthTime, gender) {
  const raw = computeChart({ birthDate, birthTime, gender, city: 'Seoul' });
  const chart = await createChartRecord({ canonical: buildCanonicalChart(raw, { engineVersion: 'test' }) });
  const profile = await createChildProfile({ userId, chartId: chart.id });
  const { context } = await generateChildGrowthAnalysis({ childProfileId: profile.id, userId, tier: 'full' });
  return context;
}
const SELF_DIRECTED_BIRTH = ['1985-02-14', '06:10', 'female'];

// ============================================================
// TARGET (TASK2) — 독립 감사에서 실제로 실패했던 5개 문장
// ============================================================

test('TASK2-1: "아이가 말을 안 들어서 너무 힘들어요" → child (parent 오분류 수정 확인)', () => {
  assert.equal(classifyTarget('아이가 말을 안 들어서 너무 힘들어요'), 'child');
});

test('TASK2-2: "제가 요즘 육아 때문에 너무 지치고 화도 자주 내게 되는데 제가 어떻게 하면 좋을까요?" → parent', () => {
  assert.equal(classifyTarget('제가 요즘 육아 때문에 너무 지치고 화도 자주 내게 되는데 제가 어떻게 하면 좋을까요?'), 'parent');
});

test('TASK2-3: "내가 부모로서 잘하고 있는지 자신이 없어요" → parent', () => {
  assert.equal(classifyTarget('내가 부모로서 잘하고 있는지 자신이 없어요'), 'parent');
});

test('TASK2-4: "요즘 육아가 너무 버거워요" → parent', () => {
  assert.equal(classifyTarget('요즘 육아가 너무 버거워요'), 'parent');
});

test('TASK2-5: "아이가 숙제를 안 해서 너무 힘들어요" → child (parent 오분류 방지 확인)', () => {
  assert.equal(classifyTarget('아이가 숙제를 안 해서 너무 힘들어요'), 'child');
});

test('TASK2 회귀: 기존 parent 8개 + relationship/child 4개 재확인', () => {
  const parentCases = [
    '제가 너무 화를 내는 것 같아요', '내가 너무 엄격한 부모인가요?', '요즘 아이 때문에 너무 지쳐요',
    '숙제 얘기만 나오면 저도 모르게 소리를 질러요', '아이 때문에 내가 너무 예민해진 것 같아요',
    '게임 때문에 제가 매일 화를 내요', '나는 육아를 잘하고 있는지 모르겠어요', '제가 잘하고 있는 건지 모르겠어요',
  ];
  for (const text of parentCases) assert.equal(classifyTarget(text), 'parent', `"${text}" 회귀됨`);

  const others = [
    ['제가 뭐라고 말해야 할까요?', 'relationship'],
    ['아이가 숙제를 안 하는데 뭐라고 말해야 할까요?', 'child'],
    ['아이랑 매일 싸워요', 'relationship'],
    ['아이가 친구와 싸웠어요', 'child'],
  ];
  for (const [text, expected] of others) assert.equal(classifyTarget(text), expected, `"${text}" 회귀됨`);
});

// ============================================================
// SCENE/STRATEGY (TASK1) — 독립 감사에서 실제로 실패했던 문장
// ============================================================

test('TASK1-6: "시키면 미루는데 자기가 고른 건 잘해요." → 숙제 scene이 선택되면 안 됨', async () => {
  const context = await makeContextFor('t1-6', ...SELF_DIRECTED_BIRTH);
  const text = '시키면 미루는데 자기가 고른 건 잘해요.';
  const target = classifyTarget(text);
  const intent = classifyIntent(text);
  const { material } = resolveDepthAndMaterial(context, text, target, intent, false, '');
  assert.ok(!JSON.stringify(material.sceneText).includes('숙제'), '무관한 숙제 scene이 노출됨');
});

test('TASK1-7: "자기가 하고 싶은 일은 오래 붙잡고 해요." → unrelated 숙제 scene이 선택되면 안 됨', async () => {
  const context = await makeContextFor('t1-7', ...SELF_DIRECTED_BIRTH);
  const text = '자기가 하고 싶은 일은 오래 붙잡고 해요.';
  const target = classifyTarget(text);
  const intent = classifyIntent(text);
  const { material } = resolveDepthAndMaterial(context, text, target, intent, false, '');
  assert.ok(!JSON.stringify(material.sceneText).includes('숙제'), '무관한 숙제 scene이 노출됨');
});

test('TASK1-8: "게임을 끄라고 하면 난리가 나요." → game-ending 관련 material은 유지되어야 함', async () => {
  const context = await makeContextFor('t1-8', ...SELF_DIRECTED_BIRTH);
  const text = '게임을 끄라고 하면 난리가 나요.';
  const target = classifyTarget(text);
  const intent = classifyIntent(text);
  const { depth, material } = resolveDepthAndMaterial(context, text, target, intent, false, '');
  assert.equal(depth, 'FOCUSED');
  assert.ok(JSON.stringify(material.sceneText).includes('게임'), '게임 관련 material이 유지되어야 함');
});

test('TASK1 회귀: "숙제를 죽어도 안 해요"는 여전히 숙제 scene+strategy를 정상 사용한다', async () => {
  const context = await makeContextFor('t1-reg1', ...SELF_DIRECTED_BIRTH);
  const text = '숙제를 죽어도 안 해요';
  const target = classifyTarget(text);
  const intent = classifyIntent(text);
  const { depth, material } = resolveDepthAndMaterial(context, text, target, intent, false, '');
  assert.equal(depth, 'FOCUSED');
  assert.ok(material.sceneText.length > 0 && material.strategyText.length > 0);
});

test('TASK1 회귀: observable 랭킹 목표 케이스("본인이 선택한 건...")는 계속 정확히 선택된다', async () => {
  const context = await makeContextFor('t1-reg2', ...SELF_DIRECTED_BIRTH);
  const text = '본인이 선택한 건 오래 붙잡고 해요';
  const target = classifyTarget(text);
  const intent = classifyIntent(text);
  const { material } = resolveDepthAndMaterial(context, text, target, intent, false, '');
  assert.equal(material.observableText, '본인이 먼저 하겠다고 한 일에는 상대적으로 잘 몰입할 가능성');
});

// ============================================================
// PROFILE LEAK 재확인 (9, 10)
// ============================================================

test('TASK-9: parent self-state 질문에 child profile material이 들어가지 않는다', async () => {
  const context = await makeContextFor('leak-9', ...SELF_DIRECTED_BIRTH);
  const cases = [
    '제가 요즘 육아 때문에 너무 지치고 화도 자주 내게 되는데 제가 어떻게 하면 좋을까요?',
    '내가 부모로서 잘하고 있는지 자신이 없어요',
    '요즘 육아가 너무 버거워요',
  ];
  for (const text of cases) {
    const prompt = buildCasualSystemPrompt('daegu', context, text);
    assert.ok(!prompt.includes('이게 전부다):'), `"${text}"에서 profile leak 발생`);
    assert.ok(prompt.includes('실제 행동을 증명하는 자료가 아니다'), `"${text}"에 안전 규칙 없음`);
  }
});

test('TASK-10: parent 질문 + child-related keyword가 동시에 있어도 leak되지 않는다', async () => {
  const context = await makeContextFor('leak-10', ...SELF_DIRECTED_BIRTH);
  // "숙제"/"게임" 등 child situation 키워드가 있어도 명시적 부모 자기서술이면 parent로 확정되고
  // material은 절대 노출되면 안 된다(§BUG-1 재검증).
  const cases = [
    '숙제 얘기만 나오면 저도 모르게 소리를 질러요',
    '게임 때문에 제가 매일 화를 내요',
    '아이가 말을 안 들어서 너무 힘들어요 같은 상황이 아니라 제가 요즘 너무 지쳐서 화를 내요',
  ];
  for (const text of cases) {
    const target = classifyTarget(text);
    assert.equal(target, 'parent', `"${text}"는 parent여야 함`);
    const prompt = buildCasualSystemPrompt('daegu', context, text);
    assert.ok(!prompt.includes('이게 전부다):'), `"${text}"에서 profile leak 발생`);
  }
});
