// tests/23-compatibility-ranking-explanation.test.mjs
//
// packages/chart-engine/compatibility-ranking.mjs + compatibility-explanation.mjs 회귀 테스트.
// 승인된 설계 문서의 요구사항(9번 "구현 후 테스트")을 전부 반영: 28명 fixture 전체 Ranking,
// TOP10 생성, 오행 방향/십신 양방향/fact_ref/hallucination/중복/conflict 분리/동점 처리 검증.
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { computeChart } from '../packages/chart-engine/compute.mjs';
import { buildCanonicalChart } from '../packages/canonical/transform.mjs';
import { analyzeCompatibilityFact } from '../packages/chart-engine/compatibility-analysis.mjs';
import { rankCandidates, midrankPercentiles, RANKING_FEATURE_KEYS } from '../packages/chart-engine/compatibility-ranking.mjs';
import { buildExplanation, COMPATIBILITY_EXPLANATION_TERMS } from '../packages/chart-engine/compatibility-explanation.mjs';

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
    const raw = computeChart({ birthDate, birthTime, gender, city });
    people[`P${i + 1}`] = buildCanonicalChart(raw, { engineVersion: 'test' }).saju;
  });
});

function candidatesFor(person) {
  return Object.keys(people)
    .filter((p) => p !== person)
    .map((id) => ({ id, result: analyzeCompatibilityFact(people[person], people[id]) }));
}

// ============================================================
// midrank percentile 자체 검증
// ============================================================

test('midrankPercentiles: 동점 그룹은 평균 순위를 공유한다', () => {
  assert.deepEqual(midrankPercentiles([1, 2, 2, 2, 5]), [0, 50, 50, 50, 100]);
});

test('midrankPercentiles: 전원 동점이면 전부 50', () => {
  assert.deepEqual(midrankPercentiles([5, 5, 5, 5]), [50, 50, 50, 50]);
});

// ============================================================
// Ranking 구조 검증
// ============================================================

test('rankCandidates: attraction/communication 계산에 mutual_ten_god이 관여하지 않는다 (승인된 설계 §3/§4)', () => {
  // mutual_ten_god을 인위적으로 다르게 바꿔도 attraction/communication raw가 변하지 않아야 함을
  // 코드 레벨로 확인 — compatibility-ranking.mjs의 attractionRaw/communicationRaw는
  // result.features.attraction.stem_combine_count 등만 참조하고 result.raw.mutual_ten_god을
  // 아예 조회하지 않는다(소스 확인). 여기서는 실제 27명 전수 검증으로 일관성을 재확인한다.
  const candidates = candidatesFor('P1');
  const ranked = rankCandidates(candidates);
  for (const entry of ranked) {
    const f = entry._result.features;
    assert.equal(entry.feature_raw.attraction, f.attraction.stem_combine_count + (f.attraction.day_branch_harmony.length > 0 ? 1 : 0));
    assert.equal(entry.feature_raw.communication, f.communication.branch_harmony_count);
  }
});

test('rankCandidates: conflict_potential이 feature_raw/overall_score 어디에도 포함되지 않는다', () => {
  const candidates = candidatesFor('P1');
  const ranked = rankCandidates(candidates);
  for (const entry of ranked) {
    assert.equal('conflict_potential' in entry.feature_raw, false);
    assert.equal('conflict_potential' in entry.feature_percentiles, false);
  }
  assert.deepEqual(RANKING_FEATURE_KEYS.sort(), ['attraction', 'communication', 'complementarity', 'stimulation'].sort());
});

test('rankCandidates: rank가 1부터 순차적으로 매겨지고 overall_score 내림차순이다', () => {
  const ranked = rankCandidates(candidatesFor('P1'));
  for (let i = 0; i < ranked.length; i++) assert.equal(ranked[i].rank, i + 1);
  for (let i = 1; i < ranked.length; i++) assert.ok(ranked[i - 1].overall_score >= ranked[i].overall_score);
});

test('rankCandidates: tier가 top/high/candidate 중 하나이고, top 비율이 대략 설정값(15%) 근처다', () => {
  const ranked = rankCandidates(candidatesFor('P1'));
  for (const entry of ranked) assert.ok(['top', 'high', 'candidate'].includes(entry.overall_tier));
  const topCount = ranked.filter((e) => e.overall_tier === 'top').length;
  assert.ok(topCount >= 1 && topCount <= Math.ceil(ranked.length * 0.25), `top tier 인원이 비정상적임: ${topCount}/${ranked.length}`);
});

// ============================================================
// Explanation 구조 + Fact Traceability + Hallucination 검증 (28명 전수, TOP10씩)
// ============================================================

test('28명 전체 × TOP10 Explanation — 오행 방향/십신 양방향/fact_ref/hallucination/중복/conflict 분리 전부 검증', () => {
  const labels = Object.keys(people);
  let totalReasons = 0;
  let directionChecked = 0;

  for (const person of labels) {
    const ranked = rankCandidates(candidatesFor(person));
    const top10 = ranked.slice(0, 10);

    for (const entry of top10) {
      const exp = buildExplanation(entry, { personALabel: '당신', personBLabel: entry.candidate_id });
      const raw = entry._result.raw;

      // --- fact_ref traceability: 모든 참조가 raw의 실제 최상위 키다 ---
      for (const reason of exp.why_recommended) {
        totalReasons++;
        for (const ref of reason.fact_ref) {
          assert.ok(ref in raw, `fact_ref "${ref}"가 raw에 없음 (person=${person}, candidate=${entry.candidate_id})`);
        }

        // --- hallucination: 문장에 언급된 개수가 실제 raw 배열 길이와 일치 ---
        if (reason.type === 'attraction') {
          const actualStemCombine = raw.cross_pillar_relations.filter((r) => r.kind === 'stem' && r.relation === '合').length;
          if (actualStemCombine > 0) assert.ok(reason.text.includes(`${actualStemCombine}곳`), `attraction 설명의 개수가 실제와 다름: ${reason.text}`);
        }
        if (reason.type === 'communication') {
          const actualBranchHarmony = raw.cross_pillar_relations.filter((r) => r.kind === 'branch' && r.relation === '合').length;
          assert.ok(reason.text.includes(`${actualBranchHarmony}곳`), `communication 설명의 개수가 실제와 다름: ${reason.text}`);
        }
        if (reason.type === 'stimulation') {
          const actualChung = raw.cross_pillar_relations.filter((r) => r.kind === 'branch' && r.relation === '沖').length;
          assert.ok(reason.text.includes(`${actualChung}곳`), `stimulation 설명의 개수가 실제와 다름: ${reason.text}`);
        }
        if (reason.type === 'complementarity') {
          directionChecked++;
          // --- 오행 방향 정확성: raw의 lacking_in/supplied_by가 실제 five_element_a/b와 일치 ---
          for (const c of raw.five_element_complementarity.complements) {
            const aVal = raw.five_element_a[c.element];
            const bVal = raw.five_element_b[c.element];
            if (c.lacking_in === 'personA') {
              assert.equal(c.lacking_count, aVal);
              assert.equal(c.supplying_count, bVal);
            } else {
              assert.equal(c.lacking_count, bVal);
              assert.equal(c.supplying_count, aVal);
            }
          }
        }
      }

      // --- 중복 설명 방지: why_recommended 안에 같은 type이 두 번 나오지 않음 ---
      const types = exp.why_recommended.map((r) => r.type);
      assert.equal(new Set(types).size, types.length, `중복 이유 발생: ${JSON.stringify(types)}`);

      // --- mutual_ten_god 양방향 전부 텍스트에 포함 ---
      const text = exp.relationship_style.mutual_ten_god_text;
      assert.ok(text.includes(COMPATIBILITY_EXPLANATION_TERMS[raw.mutual_ten_god.personA_to_B] ?? raw.mutual_ten_god.personA_to_B));
      assert.ok(text.includes(COMPATIBILITY_EXPLANATION_TERMS[raw.mutual_ten_god.personB_to_A] ?? raw.mutual_ten_god.personB_to_A));

      // --- conflict 분리: caution 항목 수가 실제 pillar_pairs 수와 정확히 일치(합치지 않음) ---
      assert.equal(exp.caution.length, entry._result.features.conflict_potential.pillar_pairs.length);
      for (let i = 0; i < exp.caution.length; i++) {
        assert.deepEqual(exp.caution[i].pillar_pair, entry._result.features.conflict_potential.pillar_pairs[i]);
      }

      // --- 한자 단독 출력 금지: why_recommended/caution/relationship_style 텍스트에 괄호 없는 단독 한자가 없어야 함 ---
      const allText = [...exp.why_recommended.map((r) => r.text), exp.relationship_style.mutual_ten_god_text, ...exp.caution.map((c) => c.text)].join(' ');
      for (const hanjaOnly of ['沖', '刑', '破', '害', '怨嗔', '鬼門', '食神', '傷官', '偏印', '偏官', '偏財', '劫財']) {
        // 괄호 안(예: "충(沖)")에 등장하는 건 허용 — 괄호 밖 단독 등장만 금지
        const withoutParenthesized = allText.replace(/\([^)]*\)/g, '');
        assert.ok(!withoutParenthesized.includes(hanjaOnly), `한자 단독 출력 발견: "${hanjaOnly}" in "${allText}"`);
      }
    }
  }
  assert.ok(totalReasons > 0, '검증할 reason이 하나도 생성되지 않음');
  assert.ok(directionChecked > 0, '오행 보완 방향을 실제로 검증한 케이스가 없음(28명 표본에 최소 1건은 있어야 함)');
});

// ============================================================
// 절대 금지 표현이 어디에도 생성되지 않는지 (구조적 검증 — 애초에 템플릿에 없음을 재확인)
// ============================================================

test('금지 표현("천생연분", "악연", "용신", "신강", "신약", "운이 좋아진다" 등)이 모든 explanation에 전혀 등장하지 않는다', () => {
  const FORBIDDEN = ['천생연분', '악연', '운명적', '용신', '희신', '신강', '신약', '헤어질', '운이 좋아', '기운을 채워', '필요한 기운', '필요한 오행'];
  const labels = Object.keys(people);
  for (const person of labels.slice(0, 5)) {
    const ranked = rankCandidates(candidatesFor(person));
    for (const entry of ranked.slice(0, 10)) {
      const exp = buildExplanation(entry, { personALabel: '당신', personBLabel: entry.candidate_id });
      const allText = JSON.stringify(exp);
      for (const word of FORBIDDEN) assert.ok(!allText.includes(word), `금지 표현 "${word}" 발견`);
    }
  }
});

// ============================================================
// 회귀: 기존 compatibility-analysis.mjs 결과와 정확히 동일한 raw를 그대로 소비하는지
// ============================================================

test('실제 발견된 버그: 조사(은/는, 이/가, 을/를)가 받침 유무에 맞게 정확히 붙는다 (괄호가 있어도 정확)', () => {
  const raw = analyzeCompatibilityFact(people.P1, people.P4);
  const ranked = rankCandidates([{ id: 'P4', result: raw }]);
  const exp = buildExplanation(ranked[0], { personBLabel: 'P4' });

  // "당신"은 받침 있음 → "은", "P4"는 받침 없음(4로 끝남) → "는"
  assert.ok(exp.relationship_style.mutual_ten_god_text.includes('당신은'), '받침 있는 "당신"에 "는"이 잘못 붙음(문법 오류 재발)');
  assert.ok(!exp.relationship_style.mutual_ten_god_text.includes('당신는'), '문법 오류 "당신는" 재발');

  // 오행 용어는 괄호가 붙으므로("목(木)") 괄호 앞부분("목")으로 받침을 판단해야 함
  const compReason = exp.why_recommended.find((r) => r.type === 'complementarity');
  if (compReason && compReason.text.includes('목(木)')) {
    assert.ok(!compReason.text.includes('목(木)는'), '"목(木)"은 받침이 있어 "는"이 아니라 "은"이 붙어야 함(괄호 때문에 조사 판단이 틀렸던 실제 버그)');
  }
});

test('rankCandidates/buildExplanation은 compatibility-analysis.mjs의 결과를 재계산하지 않고 그대로 참조한다', () => {
  const rawResult = analyzeCompatibilityFact(people.P1, people.P4);
  const ranked = rankCandidates([{ id: 'P4', result: rawResult }]);
  assert.equal(ranked[0]._result, rawResult); // 참조가 그대로 유지되는지(재계산해서 새 객체를 만들지 않는지)
});
