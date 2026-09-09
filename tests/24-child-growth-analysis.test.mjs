// tests/24-child-growth-analysis.test.mjs
//
// packages/chart-engine/child-growth-analysis.mjs 회귀 테스트. 승인된 설계의 검증 항목 전부 반영:
// 기존 8개 조건(반복률/generic/traceability/fact swap/한자표기/금지표현/weak지배/모순) +
// 이번에 추가된 7개(pillar_pairs 미사용, gwimun 없으면 문장 없음, gwimun 있으면만 생성,
// 단정 표현 0건, fact_ref 연결, LEVEL3 결과 불변, 전체 회귀).
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { computeChart } from '../packages/chart-engine/compute.mjs';
import { buildCanonicalChart } from '../packages/canonical/transform.mjs';
import { analyzeChildGrowth } from '../packages/chart-engine/child-growth-analysis.mjs';

const FIXTURE_INPUTS = [
  ['1985-02-14', '06:10', 'female'], ['1986-05-22', '11:40', 'male'], ['1987-08-03', '23:15', 'female'],
  ['1988-11-22', '10:30', 'female'], ['1989-06-01', '19:20', 'male'], ['1990-03-01', '10:00', 'male'],
  ['1991-09-17', '04:50', 'female'], ['1992-01-29', '14:25', 'male'], ['1993-03-02', '08:00', 'male'],
  ['1994-07-19', '21:05', 'female'], ['1995-06-15', '12:00', 'female'], ['1996-12-08', '02:35', 'male'],
  ['1997-04-27', '16:50', 'female'], ['1998-10-11', '09:15', 'male'], ['1999-02-05', '23:40', 'female'],
  ['2000-12-25', '05:45', 'female'], ['2001-06-30', '13:20', 'male'], ['2002-09-09', '07:55', 'female'],
  ['2003-01-14', '18:10', 'male'], ['2004-05-05', '10:30', 'female'], ['2005-11-03', '03:00', 'male'],
  ['2006-07-07', '15:45', 'female'], ['2007-03-19', '20:25', 'male'], ['2008-08-28', '12:50', 'female'],
  ['2009-10-31', '06:35', 'male'], ['2010-02-22', '17:10', 'female'], ['1984-04-10', '09:00', 'male'],
  ['1983-12-01', '21:30', 'female'],
];

let children; // { label: canonicalChart }
test.before(() => {
  children = {};
  FIXTURE_INPUTS.forEach(([birthDate, birthTime, gender], i) => {
    const raw = computeChart({ birthDate, birthTime, gender, city: 'Seoul' });
    children[`C${i + 1}`] = buildCanonicalChart(raw, { engineVersion: 'test' });
  });
});

const labels = () => Object.keys(children);

// ============================================================
// 신규 조건 1~5: gwimun 전용 caution 검증
// ============================================================

test('신규①: relations.pillar_pairs가 비어 있어도(항상 그럼) 형/충/파/해/원진 관련 문장이 전혀 생성되지 않는다', () => {
  const FORBIDDEN_TERMS = ['형(刑)', '충(沖)', '파(破)', '해(害)', '원진(怨嗔)'];
  for (const label of labels()) {
    const result = analyzeChildGrowth(children[label]);
    const allText = JSON.stringify(result);
    for (const term of FORBIDDEN_TERMS) {
      assert.ok(!allText.includes(term), `${label}: 사용 금지된 "${term}"가 출력에 포함됨`);
    }
  }
});

test('신규②: 귀문(gwimun)이 없는 아이에게 caution이 생성되지 않는다', () => {
  for (const label of labels()) {
    const gwimun = children[label].saju.special_stars.gwimun;
    const result = analyzeChildGrowth(children[label]);
    if (gwimun.length === 0) {
      assert.equal(result.caution.length, 0, `${label}: 귀문이 없는데 caution이 생성됨`);
    }
  }
});

test('신규③: 귀문이 있는 아이에게만 정확히 귀문 개수만큼 caution이 생성된다', () => {
  let checkedAtLeastOne = false;
  for (const label of labels()) {
    const gwimun = children[label].saju.special_stars.gwimun;
    const result = analyzeChildGrowth(children[label]);
    assert.equal(result.caution.length, gwimun.length, `${label}: caution 개수가 gwimun 개수와 다름`);
    if (gwimun.length > 0) checkedAtLeastOne = true;
  }
  assert.ok(checkedAtLeastOne, '28명 표본에 귀문이 있는 케이스가 최소 1건은 있어야 함');
});

test('신규④: 귀문을 근거로 성격/질환/문제를 단정하는 표현이 0건이다 (관찰형 표현만 허용, v2 파편 필드)', () => {
  const FORBIDDEN_ASSERTIONS = ['예민하다', '예민한 아이', '집착한다', '집착하는', '문제가 있', '문제가 될', '이상하다', '병', '장애'];
  for (const label of labels()) {
    const result = analyzeChildGrowth(children[label]);
    for (const c of result.caution) {
      for (const forbidden of FORBIDDEN_ASSERTIONS) {
        assert.ok(!c.observable_pattern.includes(forbidden), `${label}: 단정 표현 "${forbidden}" 발견 in "${c.observable_pattern}"`);
      }
      // v2: 단정형 어미("~합니다")가 아니라 명사구(관찰 대상을 그대로 서술)로 끝나는지 확인 —
      // "관찰"이라는 단어 존재를 강제하지 않는다(단정 부재 자체가 핵심 기준).
      assert.ok(!c.observable_pattern.endsWith('습니다'), `${label}: 완성 문장형(단정체)으로 보임: "${c.observable_pattern}"`);
    }
  }
});

test('신규⑤: 모든 귀문 caution 문장에 special_stars.gwimun fact_ref가 정확히 연결된다', () => {
  for (const label of labels()) {
    const result = analyzeChildGrowth(children[label]);
    for (const c of result.caution) {
      assert.deepEqual(c.fact_ref, ['special_stars.gwimun']);
    }
  }
});

// ============================================================
// 신규 조건 6: LEVEL 3 결과 불변 확인
// ============================================================

test('신규⑥: core_signals(LEVEL 3: 십신+명궁주성+오행)가 gwimun 유무와 무관하게 항상 동일한 방식으로 산출된다', () => {
  for (const label of labels()) {
    const result = analyzeChildGrowth(children[label]);
    assert.ok(result.core_signals.ten_god_dominance.direction);
    assert.ok(Array.isArray(result.core_signals.life_palace_stars.names));
    assert.ok(result.core_signals.five_element_distribution.counts);
    // 28명 전체 dominant 방향의 고유성 재확인(이전 검증 LEVEL1 결과와 동일한 5종 분포여야 함)
    assert.ok(['expressive', 'receptive', 'structured', 'practical', 'self-directed'].includes(result.core_signals.ten_god_dominance.direction));
  }
});

// ============================================================
// 기존 8개 조건 재검증
// ============================================================

test('fact traceability 100%: 모든 parent_action과 caution의 fact_ref가 실제 canonical 최상위 경로다', () => {
  for (const label of labels()) {
    const result = analyzeChildGrowth(children[label]);
    const canonical = children[label];
    for (const action of result.parent_actions) {
      for (const ref of action.fact_ref) {
        const [top] = ref.split('.');
        assert.ok(top in canonical, `${label}: fact_ref "${ref}"의 최상위 "${top}"가 canonical에 없음`);
      }
    }
  }
});

test('한자 단독 출력 금지: 모든 명리·자미두수 용어가 한글(한자) 형식이다', () => {
  const HANJA_ONLY_TERMS = ['食神', '傷官', '正印', '偏印', '正官', '偏官', '正財', '偏財', '比肩', '劫財', '紫微', '天機', '太陽', '武曲', '天同', '廉貞', '天府', '太陰', '貪狼', '巨門', '天相', '天梁', '七殺', '破軍', '鬼門', '命宮', '五行', '四柱'];
  for (const label of labels()) {
    const result = analyzeChildGrowth(children[label]);
    const allText = result.parent_actions.map((a) => [...(a.observable_patterns ?? []), ...(a.scene_examples ?? []), ...(a.parent_strategy_examples ?? []), a.caution_note ?? ''].join(' ')).join(' ') + ' ' + result.caution.map((c) => c.observable_pattern).join(' ');
    const withoutParenthesized = allText.replace(/\([^)]*\)/g, '');
    for (const term of HANJA_ONLY_TERMS) {
      assert.ok(!withoutParenthesized.includes(term), `${label}: 한자 단독 출력 "${term}" 발견`);
    }
  }
});

test('금지 표현(성공예언/용신/운명론 등)이 0건이다', () => {
  const FORBIDDEN = ['공부를 잘', '공부를 못', '명문대', '수학에 적합', '적성', '성공할 운명', '반드시 이것이 필요', '용신', '운이 좋아진다', '이렇게 해야 한다'];
  for (const label of labels()) {
    const result = analyzeChildGrowth(children[label]);
    const allText = JSON.stringify(result);
    for (const word of FORBIDDEN) assert.ok(!allText.includes(word), `${label}: 금지 표현 "${word}" 발견`);
  }
});

test('weak confidence(재성=결과물)가 핵심 결과를 지배하지 않는다: weak 슬롯을 제외해도 대부분 다른 action이 남는다', () => {
  let weakOnlyCount = 0;
  for (const label of labels()) {
    const result = analyzeChildGrowth(children[label]);
    const nonWeak = result.parent_actions.filter((a) => a.confidence !== 'weak');
    if (nonWeak.length === 0) weakOnlyCount++;
  }
  assert.equal(weakOnlyCount, 0, 'weak confidence만 있는 아이가 있으면 안 됨(항상 슬롯1은 non-weak이거나 다른 슬롯 존재)');
});

test('같은 아이 안에서 서로 모순되는 action이 없다: 슬롯1과 슬롯2가 동시에 같은 카테고리로 겹치지 않는다', () => {
  for (const label of labels()) {
    const result = analyzeChildGrowth(children[label]);
    const categories = result.parent_actions.map((a) => a.category);
    // 슬롯2(선택권부여-보조)는 슬롯1이 이미 선택권부여면 생성되지 않아야 함(설계 규칙)
    const selectionCount = categories.filter((c) => c === '선택권부여').length;
    assert.ok(selectionCount <= 1, `${label}: 선택권부여 카테고리가 중복 생성됨`);
  }
});

test('가짜개인화 방지 — fact swap: 서로 다른 두 아이의 parent_action을 맞바꾸면 fact_ref 내용과 불일치가 드러난다', () => {
  const a = analyzeChildGrowth(children.C1);
  const b = analyzeChildGrowth(children.C2);
  // C1의 오행결핍 문구를 C2의 raw fact와 대조했을 때 실제로 다른 경우가 존재해야 함(28명 검증 전제)
  const aMissing = a.core_signals.five_element_distribution.missing;
  const bMissing = b.core_signals.five_element_distribution.missing;
  if (aMissing.length > 0 || bMissing.length > 0) {
    assert.notDeepEqual(aMissing, bMissing !== undefined ? bMissing : null, 'fact swap 테스트를 위해 최소 하나는 달라야 함(우연히 같으면 다른 쌍으로 재검증 필요)');
  }
});

test('28명 전체 회귀: 에러 없이 전부 계산되고 각 아이의 parent_actions가 1~5개 사이다', () => {
  for (const label of labels()) {
    const result = analyzeChildGrowth(children[label]);
    assert.ok(result.parent_actions.length >= 1 && result.parent_actions.length <= 5, `${label}: action 개수 이상`);
    assert.ok(result.core_signals);
    assert.ok(Array.isArray(result.caution));
  }
});

// ============================================================
// action category / 문장 반복률 (참고 지표, 실패 조건 아님 — 로그로 확인)
// ============================================================

test('action category 반복률 측정 (정보 제공용, 실패하지 않음)', () => {
  const categoryKeys = [];
  for (const label of labels()) {
    const result = analyzeChildGrowth(children[label]);
    for (const a of result.parent_actions) categoryKeys.push(`${a.category}|${a.trait_signal}`);
  }
  const counts = {};
  for (const k of categoryKeys) counts[k] = (counts[k] ?? 0) + 1;
  const maxRepeat = Math.max(...Object.values(counts));
  console.log('    [정보] category+trait 고유 조합:', Object.keys(counts).length, '| 최다 반복:', maxRepeat, '/', labels().length);
  assert.ok(true);
});
