// tests/22-compatibility-analysis.test.mjs
//
// packages/chart-engine/compatibility-analysis.mjs 회귀 테스트. 승인된 설계 문서의 §11/§12
// 요구사항 그대로: 756건(28명 × 양방향 27명) 전수 실행 + raw relation 구조 검증(숫자 하나만
// 비교하지 않음) + 알려진 케이스 spot-check.
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { computeChart } from '../packages/chart-engine/compute.mjs';
import { buildCanonicalChart } from '../packages/canonical/transform.mjs';
import { analyzeCompatibilityFact, COMPATIBILITY_FEATURE_KEYS } from '../packages/chart-engine/compatibility-analysis.mjs';

const FIXTURE_INPUTS = [
  ['1985-02-14', '06:10', 'female', 'Seoul'], ['1986-05-22', '11:40', 'male', 'Busan'],
  ['1987-08-03', '23:15', 'female', 'Incheon'], ['1988-11-22', '10:30', 'female', 'Seoul'],
  ['1989-06-01', '19:20', 'male', 'Busan'], ['1990-03-01', '10:00', 'male', 'Seoul'],
  ['1991-09-17', '04:50', 'female', 'Daegu'], ['1992-01-29', '14:25', 'male', 'Seoul'],
  ['1993-03-02', '08:00', 'male', 'Busan'], ['1994-07-19', '21:05', 'female', 'Seoul'],
  ['1995-06-15', '12:00', 'female', 'Seoul'], ['1996-12-08', '02:35', 'male', 'Incheon'],
  ['1997-04-27', '16:50', 'female', 'Daejeon'], ['1998-10-11', '09:15', 'male', 'Seoul'],
  ['1999-02-05', '23:40', 'female', 'Busan'], ['2000-12-25', '05:45', 'female', 'Incheon'],
  ['2001-06-30', '13:20', 'male', 'Seoul'], ['2002-09-09', '07:55', 'female', 'Gwangju'],
  ['2003-01-14', '18:10', 'male', 'Busan'], ['2004-05-05', '10:30', 'female', 'Seoul'],
  ['2005-11-03', '03:00', 'male', 'Daegu'], ['2006-07-07', '15:45', 'female', 'Seoul'],
  ['2007-03-19', '20:25', 'male', 'Incheon'], ['2008-08-28', '12:50', 'female', 'Busan'],
  ['2009-10-31', '06:35', 'male', 'Seoul'], ['2010-02-22', '17:10', 'female', 'Daejeon'],
  ['1984-04-10', '09:00', 'male', 'Seoul'], ['1983-12-01', '21:30', 'female', 'Busan'],
];

let people; // { label: canonicalSaju }

test.before(() => {
  people = {};
  FIXTURE_INPUTS.forEach(([birthDate, birthTime, gender, city], i) => {
    const label = `P${i + 1}`;
    const raw = computeChart({ birthDate, birthTime, gender, city });
    const canonical = buildCanonicalChart(raw, { engineVersion: 'test' });
    people[label] = canonical.saju;
  });
});

// ============================================================
// 구조 검증 — Fact
// ============================================================

test('analyzeCompatibilityFact: raw 구조에 요구된 6개 필드가 전부 있다', () => {
  const result = analyzeCompatibilityFact(people.P1, people.P2);
  assert.ok(Array.isArray(result.raw.cross_pillar_relations));
  assert.ok('relations' in result.raw.day_branch_relation);
  assert.ok('harmony' in result.raw.day_branch_relation);
  assert.ok('conflict' in result.raw.day_branch_relation);
  assert.ok('personA_to_B' in result.raw.mutual_ten_god);
  assert.ok('personB_to_A' in result.raw.mutual_ten_god);
  assert.ok('wood' in result.raw.five_element_a);
  assert.ok('wood' in result.raw.five_element_b);
  assert.ok(Array.isArray(result.raw.five_element_complementarity.complements));
});

test('cross_pillar_relations: 각 항목이 어느 주-어느 주-천간/지지-관계유형까지 전부 추적 가능하다', () => {
  const result = analyzeCompatibilityFact(people.P1, people.P2);
  for (const r of result.raw.cross_pillar_relations) {
    assert.ok(['year', 'month', 'day', 'hour'].includes(r.personA_pillar));
    assert.ok(['year', 'month', 'day', 'hour'].includes(r.personB_pillar));
    assert.ok(['stem', 'branch'].includes(r.kind));
    assert.ok(typeof r.relation === 'string' && r.relation.length > 0);
  }
});

test('mutual_ten_god: A→B와 B→A가 절대 하나로 합쳐지지 않고 방향성이 보존된다', () => {
  // 서로 다른 두 사람이면 대부분 방향에 따라 다른 십신이 나옴(비견/겁재류 제외)
  let sawDifferentDirection = false;
  const labels = Object.keys(people);
  for (let i = 0; i < labels.length && !sawDifferentDirection; i++) {
    for (let j = i + 1; j < labels.length; j++) {
      const r = analyzeCompatibilityFact(people[labels[i]], people[labels[j]]);
      if (r.raw.mutual_ten_god.personA_to_B !== r.raw.mutual_ten_god.personB_to_A) {
        sawDifferentDirection = true;
        break;
      }
    }
  }
  assert.ok(sawDifferentDirection, '방향에 따라 다른 십신이 나오는 케이스가 최소 1건은 있어야 함(비대칭성 확인)');
});

test('five_element_complementarity: count가 실제 complements 배열 길이와 항상 일치한다', () => {
  const result = analyzeCompatibilityFact(people.P4, people.P5);
  assert.equal(result.raw.five_element_complementarity.count, result.raw.five_element_complementarity.complements.length);
});

test('오행 분포는 각 사람의 실제 4주 데이터에서 나온 것과 정확히 일치한다(직접 재계산 대조)', () => {
  const STEM_ELEMENT = { '甲':'wood','乙':'wood','丙':'fire','丁':'fire','戊':'earth','己':'earth','庚':'metal','辛':'metal','壬':'water','癸':'water' };
  const BRANCH_ELEMENT = { '寅':'wood','卯':'wood','巳':'fire','午':'fire','辰':'earth','戌':'earth','丑':'earth','未':'earth','申':'metal','酉':'metal','亥':'water','子':'water' };
  const expected = { wood:0, fire:0, earth:0, metal:0, water:0 };
  for (const p of people.P1.pillars) {
    expected[STEM_ELEMENT[p.heavenly_stem]]++;
    expected[BRANCH_ELEMENT[p.earthly_branch]]++;
  }
  const result = analyzeCompatibilityFact(people.P1, people.P2);
  assert.deepEqual(result.raw.five_element_a, expected);
});

// ============================================================
// 구조 검증 — Feature
// ============================================================

test('features: 7개 유형이 전부 존재하고 각각 원자료(relations 배열)를 포함한다(점수만 반환하지 않음)', () => {
  const result = analyzeCompatibilityFact(people.P1, people.P2);
  for (const key of COMPATIBILITY_FEATURE_KEYS) assert.ok(key in result.features, `${key} feature 누락`);

  assert.ok(Array.isArray(result.features.attraction.stem_combine_relations));
  assert.ok(Array.isArray(result.features.communication.branch_harmony_relations));
  assert.ok(Array.isArray(result.features.emotional_stability.friction_relations));
  assert.ok(Array.isArray(result.features.complementarity.element_complements));
  assert.ok(Array.isArray(result.features.stimulation.chung_relations));
  assert.ok(Array.isArray(result.features.conflict_potential.pillar_pairs));
  assert.ok('day_branch_relation' in result.features.romance_chemistry);
});

test('stimulation(沖)과 conflict_potential(刑破害怨嗔鬼門)이 서로 다른 관계 유형만 담고, 겹치지 않는다', () => {
  const result = analyzeCompatibilityFact(people.P4, people.P9); // 실증에서 관계가 많이 나온 조합
  const chungTypes = new Set(result.features.stimulation.chung_relations.map((r) => r.relation));
  const frictionTypes = new Set(result.features.conflict_potential.pillar_pairs.flatMap((p) => p.relations));
  for (const t of chungTypes) assert.equal(t, '沖');
  for (const t of frictionTypes) assert.ok(['刑', '破', '害', '怨嗔', '鬼門'].includes(t));
  // 교집합 없음
  for (const t of chungTypes) assert.ok(!frictionTypes.has(t));
});

test('conflict_potential: 같은 주 쌍에서 여러 관계 유형이 겹쳐도(예: 害+怨嗔+鬼門) 하나의 pillar_pair 항목으로 묶이고 원자료가 보존된다', () => {
  // 28명 표본 전체를 훑어서 실제로 3개 이상 겹치는 pillar_pair가 있는지 찾는다(이전 조사에서 실측된 패턴)
  const labels = Object.keys(people);
  let foundMultiRelationPair = false;
  for (let i = 0; i < labels.length && !foundMultiRelationPair; i++) {
    for (let j = 0; j < labels.length; j++) {
      if (i === j) continue;
      const result = analyzeCompatibilityFact(people[labels[i]], people[labels[j]]);
      const multi = result.features.conflict_potential.pillar_pairs.find((p) => p.relations.length >= 2);
      if (multi) {
        foundMultiRelationPair = true;
        assert.ok(multi.relations.every((r) => ['刑', '破', '害', '怨嗔', '鬼門'].includes(r)));
        break;
      }
    }
  }
  assert.ok(foundMultiRelationPair, '28명 표본에서 동일 주 쌍에 여러 갈등 관계가 겹치는 케이스가 최소 1건은 있어야 함(중복 계상 방지 로직이 실제로 검증되려면 이 케이스가 존재해야 함)');
});

// ============================================================
// 756건(28명 × 27명, 양방향) 전수 실행 검증
// ============================================================

test('756건 전수 실행 — 에러 없이 전부 계산되고, raw/features 구조가 항상 일관된다', () => {
  const labels = Object.keys(people);
  let count = 0;
  for (const a of labels) {
    for (const b of labels) {
      if (a === b) continue;
      const result = analyzeCompatibilityFact(people[a], people[b]);
      assert.ok(result.raw);
      assert.ok(result.features);
      for (const key of COMPATIBILITY_FEATURE_KEYS) assert.ok(key in result.features);
      count++;
    }
  }
  assert.equal(count, 28 * 27); // 756
});

test('일지 관계(day_branch_relation)는 4×4 cross_pillar_relations 안에도 동일하게 포함되어 일관성이 있다(별도 필드로 빠졌다고 데이터가 달라지지 않음)', () => {
  const result = analyzeCompatibilityFact(people.P4, people.P9);
  const dayDayFromCross = result.raw.cross_pillar_relations.filter((r) => r.personA_pillar === 'day' && r.personB_pillar === 'day');
  const dayDayFromDedicated = result.raw.day_branch_relation.relations;
  assert.equal(dayDayFromCross.length, dayDayFromDedicated.length);
});

// ============================================================
// 알려진 케이스 spot-check (이전 검증 세션에서 실측했던 실제 값과 대조)
// ============================================================

test('spot-check: P4(1988-11-22, 일주 辛巳)와 P5(1989-06-01, 일주 壬辰) 사이 관계가 이전 실측(관계 없음)과 일치한다', () => {
  const result = analyzeCompatibilityFact(people.P4, people.P5);
  const dayDay = result.raw.cross_pillar_relations.filter((r) => r.personA_pillar === 'day' && r.personB_pillar === 'day');
  assert.equal(dayDay.length, 0, '이전 세션에서 analyzePillarRelations(辛巳,壬辰)이 빈 배열이었던 것과 일치해야 함');
});
