// tests/30-precision-improvements.test.mjs
//
// 3개 정밀도 개선(relationship 판정, observable 랭킹, 장문+how 가이드)에 대한 직접 유닛 테스트.
// 기대값은 요구사항 기준으로 먼저 정의했고, 코드 출력에 맞춰 바꾸지 않았다.
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
// A. RELATIONSHIP 정밀도 — positive 5 + child false-positive 방지 5
// ============================================================

test('A-relationship positive 5건: 아이와의 상호작용/관계가 중심인 질문', () => {
  const cases = [
    '아이랑 매일 싸워요',
    '아이와 자꾸 부딪혀요',
    '요즘 아이랑 관계가 너무 힘들어요',
    '아이와 계속 갈등이 생겨요',
    '아이랑 대화가 잘 안 돼요',
  ];
  for (const text of cases) assert.equal(classifyTarget(text), 'relationship', `"${text}" → relationship이어야 함`);
});

test('A-relationship false-positive 방지 5건: 구체적 아이 행동 질문은 child 유지', () => {
  const cases = [
    '아이가 숙제를 안 해요',
    '아이가 게임을 안 끄려고 해요',
    '아이가 아침마다 울어요',
    '아이가 밥을 안 먹어요',
    '아이가 친구와 싸웠어요',
  ];
  for (const text of cases) assert.equal(classifyTarget(text), 'child', `"${text}" → child여야 함`);
});

test('A-relationship: 기존 5개 경계 테스트 회귀 없음(29번 테스트와 동일 기대값)', () => {
  const cases = [
    ['제가 뭐라고 말해야 할까요?', 'relationship'],
    ['아이가 숙제를 안 하는데 뭐라고 말해야 할까요?', 'child'],
    ['아침마다 일어나기 싫다고 울어서 뭐라고 말해야 할까요?', 'child'],
    ['게임 끄라고 하면 화내는데 어떻게 말해야 할까요?', 'child'],
    ['아까 숙제 얘기에서 뭐라고 말해야 할까요?', 'relationship'],
  ];
  for (const [text, expected] of cases) assert.equal(classifyTarget(text), expected);
});

test('A-relationship: 기존 8개 parent 테스트 회귀 없음', () => {
  const cases = [
    '제가 너무 화를 내는 것 같아요', '내가 너무 엄격한 부모인가요?', '요즘 아이 때문에 너무 지쳐요',
    '숙제 얘기만 나오면 저도 모르게 소리를 질러요', '아이 때문에 내가 너무 예민해진 것 같아요',
    '게임 때문에 제가 매일 화를 내요', '나는 육아를 잘하고 있는지 모르겠어요', '제가 잘하고 있는 건지 모르겠어요',
  ];
  for (const text of cases) assert.equal(classifyTarget(text), 'parent', `"${text}" 회귀됨`);
});

// ============================================================
// B. OBSERVABLE 랭킹 — self-directed 6개 + 강한매치 우선 3개 + 동점 결정론 1개
// ============================================================

test('B-observable: self-directed 6개 질문 전부 매칭 유지(회귀 없음)', async () => {
  const context = await makeContextFor('b-obs-1', ...SELF_DIRECTED_BIRTH);
  const cases = [
    '숙제를 죽어도 안 해요', '게임 끄라고 하면 난리가 나요', '왜 이렇게 고집이 센 걸까요?',
    '자기가 하고 싶은 것만 하려고 해요', '제가 정해준 건 싫다고 하는데 자기 생각대로 하는 건 잘해요',
    '본인이 선택한 건 오래 붙잡고 해요',
  ];
  for (const text of cases) {
    const prompt = buildCasualSystemPrompt('daegu', context, text);
    assert.ok(prompt.includes('이게 전부다):'), `"${text}" 매칭 회귀됨`);
  }
});

test('B-observable: "본인이 선택한 건 오래 붙잡고 해요"는 몰입 관련 observable을 선택한다(정밀도 개선 핵심 케이스)', async () => {
  const context = await makeContextFor('b-obs-2', ...SELF_DIRECTED_BIRTH);
  const target = classifyTarget('본인이 선택한 건 오래 붙잡고 해요');
  const intent = classifyIntent('본인이 선택한 건 오래 붙잡고 해요');
  const { material } = resolveDepthAndMaterial(context, '본인이 선택한 건 오래 붙잡고 해요', target, intent, false, '');
  assert.equal(material.observableText, '본인이 먼저 하겠다고 한 일에는 상대적으로 잘 몰입할 가능성', '더 적합한 observable(몰입 관련)이 선택되어야 함');
});

test('B-observable: "왜 이렇게 고집이 센 걸까요?"는 여전히 통제/고집 관련 observable을 선택한다(강한 매치 우선, 회귀 없음)', async () => {
  const context = await makeContextFor('b-obs-3', ...SELF_DIRECTED_BIRTH);
  const target = classifyTarget('왜 이렇게 고집이 센 걸까요?');
  const intent = classifyIntent('왜 이렇게 고집이 센 걸까요?');
  const { material } = resolveDepthAndMaterial(context, '왜 이렇게 고집이 센 걸까요?', target, intent, false, '');
  assert.equal(material.observableText, '직접 지시받으면 오히려 늦게 시작하거나 버틸 가능성');
});

test('B-observable: 동점 상황에서 결정론적으로 동일한 결과가 반복 재현된다', async () => {
  const context = await makeContextFor('b-obs-4', ...SELF_DIRECTED_BIRTH);
  const text = '자기가 하고 싶은 것만 하려고 해요';
  const target = classifyTarget(text);
  const intent = classifyIntent(text);
  const results = new Set();
  for (let i = 0; i < 5; i++) {
    const { material } = resolveDepthAndMaterial(context, text, target, intent, false, '');
    results.add(material.observableText);
  }
  assert.equal(results.size, 1, '동일 입력에 대해 매번 동일한 observable이 선택되어야 함(결정론적)');
});

// ============================================================
// C. LONG+HOW 가이드 — 5개 조건 조합
// ============================================================

test('C-longhow: long+how+child situation → 가이드 활성화 + material 있음', async () => {
  const context = await makeContextFor('c-lh-1', ...SELF_DIRECTED_BIRTH);
  const text = '요즘 숙제를 너무 안 하고 게임만 하려고 해서 매일 싸우는데 제가 어떻게 해야 할까요?';
  const prompt = buildCasualSystemPrompt('daegu', context, text);
  assert.ok(prompt.includes('장문으로 설명된 상황에 대한 질문이니'));
  assert.ok(prompt.includes('이게 전부다):'));
});

test('C-longhow: short+how → 가이드 비활성화', async () => {
  const context = await makeContextFor('c-lh-2', ...SELF_DIRECTED_BIRTH);
  const prompt = buildCasualSystemPrompt('daegu', context, '어떻게 해야 해요?');
  assert.ok(!prompt.includes('장문으로 설명된 상황에 대한 질문이니'));
});

test('C-longhow: long+sharing(how 아님) → 가이드 비활성화', async () => {
  const context = await makeContextFor('c-lh-3', ...SELF_DIRECTED_BIRTH);
  const prompt = buildCasualSystemPrompt('daegu', context, '오늘 학교 다녀와서 밥도 잘 먹고 기분 좋게 하루를 보냈어요');
  assert.ok(!prompt.includes('장문으로 설명된 상황에 대한 질문이니'));
});

test('C-longhow: long+how+parent → 가이드는 있어도 child profile material은 재활성화되지 않는다', async () => {
  const context = await makeContextFor('c-lh-4', ...SELF_DIRECTED_BIRTH);
  const text = '아이가 숙제를 안 해서 제가 너무 심하게 잔소리를 하는 것 같아 걱정돼요, 어떻게 하면 좋을까요';
  assert.equal(classifyTarget(text), 'parent');
  const prompt = buildCasualSystemPrompt('daegu', context, text);
  assert.ok(prompt.includes('장문으로 설명된 상황에 대한 질문이니'), '가이드는 있어야 함');
  assert.ok(!prompt.includes('이게 전부다):'), 'parent이므로 material은 절대 없어야 함(안전 규칙 유지)');
});

test('C-longhow: long+how+프로필무관 아이주제 → 가이드는 있지만 profile material 없음', async () => {
  const context = await makeContextFor('c-lh-5', ...SELF_DIRECTED_BIRTH);
  const text = '아이가 요즘 친구들이랑 잘 못 어울리는 것 같아서 계속 신경 쓰이는데 제가 어떻게 도와줘야 할까요?';
  const prompt = buildCasualSystemPrompt('daegu', context, text);
  assert.ok(prompt.includes('장문으로 설명된 상황에 대한 질문이니'), '장문 상황 서술 자체는 인정되어야 함');
  assert.ok(!prompt.includes('이게 전부다):'), '프로필에 없는 주제라 material은 없어야 함(억지 개인화 금지)');
});

// ============================================================
// 안전 규칙 회귀 확인 (모든 개선 이후에도 유지되는지)
// ============================================================

test('안전규칙 회귀: profile leak 5건 여전히 미노출', async () => {
  const context = await makeContextFor('safety-1', ...SELF_DIRECTED_BIRTH);
  const cases = [
    '제가 너무 화를 내는 것 같아요',
    '내가 너무 엄격한 부모인가요?',
    '아이 때문에 요즘 너무 지쳐요',
    '숙제 얘기만 나오면 저도 모르게 소리를 질러요',
    '게임 때문에 제가 매일 화를 내요',
  ];
  for (const text of cases) {
    const prompt = buildCasualSystemPrompt('daegu', context, text);
    assert.ok(!prompt.includes('이게 전부다):'), `"${text}"에서 profile leak 발생`);
    assert.ok(prompt.includes('실제 행동을 증명하는 자료가 아니다'), `"${text}"에 안전 규칙 없음`);
  }
});
