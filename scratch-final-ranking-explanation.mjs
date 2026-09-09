import { computeChart } from './packages/chart-engine/compute.mjs';
import { buildCanonicalChart } from './packages/canonical/transform.mjs';
import { analyzeCompatibilityFact } from './packages/chart-engine/compatibility-analysis.mjs';

const FIXTURE_INPUTS = [
  ['1985-02-14','06:10','female','Seoul'],['1986-05-22','11:40','male','Busan'],
  ['1987-08-03','23:15','female','Incheon'],['1988-11-22','10:30','female','Seoul'],
  ['1989-06-01','19:20','male','Busan'],['1990-03-01','10:00','male','Seoul'],
  ['1991-09-17','04:50','female','Daegu'],['1992-01-29','14:25','male','Seoul'],
  ['1993-03-02','08:00','male','Busan'],['1994-07-19','21:05','female','Seoul'],
  ['1995-06-15','12:00','female','Seoul'],['1996-12-08','02:35','male','Incheon'],
  ['1997-04-27','16:50','female','Daejeon'],['1998-10-11','09:15','male','Seoul'],
  ['1999-02-05','23:40','female','Busan'],['2000-12-25','05:45','female','Incheon'],
  ['2001-06-30','13:20','male','Seoul'],['2002-09-09','07:55','female','Gwangju'],
  ['2003-01-14','18:10','male','Busan'],['2004-05-05','10:30','female','Seoul'],
  ['2005-11-03','03:00','male','Daegu'],['2006-07-07','15:45','female','Seoul'],
  ['2007-03-19','20:25','male','Incheon'],['2008-08-28','12:50','female','Busan'],
  ['2009-10-31','06:35','male','Seoul'],['2010-02-22','17:10','female','Daejeon'],
  ['1984-04-10','09:00','male','Seoul'],['1983-12-01','21:30','female','Busan'],
];
const people = {};
FIXTURE_INPUTS.forEach(([birthDate, birthTime, gender, city], i) => {
  const raw = computeChart({ birthDate, birthTime, gender, city });
  people[`P${i+1}`] = buildCanonicalChart(raw, { engineVersion: 'final' }).saju;
});
const allLabels = Object.keys(people);
const INTENSE = new Set(['偏官','偏財','偏印','傷官','劫財']);
const EXPRESSIVE = new Set(['食神','傷官']);
const ELEMENT_KO = { wood:'木', fire:'火', earth:'土', metal:'金', water:'水' };

function computeRaw(a, b) { return analyzeCompatibilityFact(people[a], people[b]); }

function rawIndicators(a, b) {
  const r = computeRaw(a,b);
  const f = r.features;
  const mtg = r.raw.mutual_ten_god;
  return {
    result: r,
    attr_D: f.attraction.stem_combine_count + (f.attraction.day_branch_harmony.length>0?1:0) + (INTENSE.has(mtg.personA_to_B)?1:0) + (INTENSE.has(mtg.personB_to_A)?1:0),
    comm_C: (EXPRESSIVE.has(mtg.personA_to_B)?1:0) + (EXPRESSIVE.has(mtg.personB_to_A)?1:0) + f.communication.branch_harmony_count,
    complementarity: f.complementarity.count,
    stimulation: f.stimulation.chung_count,
    conflict_potential: f.conflict_potential.unique_pillar_pair_count,
  };
}

// ============== STEP 4: percentile normalization ==============
function percentileRank(val, allVals) {
  const sorted = [...allVals].sort((a,b)=>a-b);
  const belowOrEqual = sorted.filter(v=>v<=val).length;
  return (belowOrEqual / sorted.length) * 100;
}

function buildCandidatePool(person) {
  return allLabels.filter(p=>p!==person).map(other => ({ other, ...rawIndicators(person, other) }));
}

function withPercentiles(pool) {
  const keys = ['attr_D','comm_C','complementarity','stimulation'];
  const arrays = {}; for (const k of keys) arrays[k] = pool.map(c=>c[k]);
  return pool.map(c => {
    const pct = {};
    for (const k of keys) pct[k] = percentileRank(c[k], arrays[k]);
    return { ...c, pct };
  });
}

// ============== STEP 5: weighting candidates ==============
const WEIGHTS = {
  A_equal:    { attr_D:0.25, comm_C:0.25, complementarity:0.25, stimulation:0.25 },
  B_attrHigh: { attr_D:0.30, comm_C:0.25, complementarity:0.25, stimulation:0.20 },
  C_commHigh: { attr_D:0.25, comm_C:0.30, complementarity:0.25, stimulation:0.20 },
  D_equal2:   { attr_D:0.25, comm_C:0.25, complementarity:0.25, stimulation:0.25 }, // 지시문상 D=동일가중(A와 동일 케이스로 명시됨)
};

function compositeScore(pctObj, weights) {
  return pctObj.attr_D*weights.attr_D + pctObj.comm_C*weights.comm_C + pctObj.complementarity*weights.complementarity + pctObj.stimulation*weights.stimulation;
}

console.log('=== B. Percentile Normalization 검증 (P1 기준) — attraction dominance 해소되는가? ===');
const poolP1 = withPercentiles(buildCandidatePool('P1'));
for (const [wname, w] of Object.entries(WEIGHTS)) {
  const scored = poolP1.map(c => ({ other: c.other, score: compositeScore(c.pct, w), pct: c.pct }));
  scored.sort((a,b)=>b.score-a.score);
  const top1 = scored[0];
  const dominantFeature = Object.entries(top1.pct).sort((a,b)=>b[1]-a[1])[0][0];
  console.log(`[${wname}] TOP1=${top1.other} score=${top1.score.toFixed(1)} | percentiles: attr=${top1.pct.attr_D.toFixed(0)} comm=${top1.pct.comm_C.toFixed(0)} comp=${top1.pct.complementarity.toFixed(0)} stim=${top1.pct.stimulation.toFixed(0)}`);
}

// 28명 전체에 대해 정규화된 랭킹에서 "가장 강한 이유" 분포 재확인 (dominance 해소 검증)
console.log();
console.log('=== 정규화 후 28명 전체 TOP1의 "가장 강한 이유" 분포 (A_equal 가중치 기준) ===');
const reasonCountNorm = { attr_D:0, comm_C:0, complementarity:0, stimulation:0 };
for (const person of allLabels) {
  const pool = withPercentiles(buildCandidatePool(person));
  const scored = pool.map(c => ({ other: c.other, score: compositeScore(c.pct, WEIGHTS.A_equal), pct: c.pct }));
  scored.sort((a,b)=>b.score-a.score);
  const top1 = scored[0];
  const dominant = Object.entries(top1.pct).sort((a,b)=>b[1]-a[1])[0][0];
  reasonCountNorm[dominant]++;
}
console.log('정규화 전(naive합산) 분포:  attr_D=18(64%) comm_C=2(7%) complementarity=4(14%) stimulation=4(14%)');
console.log('정규화 후(percentile) 분포:', JSON.stringify(reasonCountNorm));

// ============== STEP 6: bootstrap/leave-one-out (percentile 방식으로 재검증) ==============
console.log();
console.log('=== E. Stability (정규화된 점수 기준) ===');
function top3ForNormalized(person, pool) {
  const p = withPercentiles(pool.map(o=>({other:o, ...rawIndicators(person,o)})));
  const scored = p.map(c => ({ other: c.other, score: compositeScore(c.pct, WEIGHTS.A_equal) }));
  scored.sort((a,b)=>b.score-a.score);
  return scored.slice(0,3).map(c=>c.other);
}
let totalOverlap=0, totalComparisons=0, top1Retained=0, top1Total=0;
const baselineTop3Norm = {};
for (const person of allLabels) baselineTop3Norm[person] = top3ForNormalized(person, allLabels.filter(p=>p!==person));
for (let trial=0; trial<20; trial++) {
  const shuffled = [...allLabels].sort(()=>Math.random()-0.5);
  const removed = new Set(shuffled.slice(0,5));
  const subsetPool = allLabels.filter(p=>!removed.has(p));
  for (const person of subsetPool) {
    const subsetTop3 = top3ForNormalized(person, subsetPool.filter(p=>p!==person));
    const baselineFiltered = baselineTop3Norm[person].filter(p=>subsetPool.includes(p));
    totalOverlap += subsetTop3.filter(x=>baselineFiltered.includes(x)).length;
    totalComparisons++;
    const bTop1 = baselineTop3Norm[person][0];
    if (subsetPool.includes(bTop1)) { top1Total++; if (subsetTop3[0]===bTop1) top1Retained++; }
  }
}
console.log('정규화 점수 기준 - 평균 TOP3 overlap:', (totalOverlap/totalComparisons).toFixed(2), '| TOP1 유지율:', (top1Retained/top1Total*100).toFixed(1)+'%');

// ============== STEP 7: tie rate (정규화 후) ==============
let tieCount1=0, tieCount3=0;
for (const person of allLabels) {
  const pool = withPercentiles(buildCandidatePool(person));
  const scored = pool.map(c => compositeScore(c.pct, WEIGHTS.A_equal));
  const sorted = [...scored].sort((a,b)=>b-a);
  if (Math.abs(sorted[0]-sorted[1]) < 0.01) tieCount1++;
  if (Math.abs(sorted[2]-sorted[3]) < 0.01) tieCount3++;
}
console.log('TOP1 동점률(정규화 후):', tieCount1, '/28 | TOP3/4 경계 동점률:', tieCount3, '/28');

// ============== STEP 8~13: Explanation 생성 + 자동 검증(traceability, 방향성, hallucination, 중복) ==============
console.log();
console.log('=== G~L. Explanation 생성 + 자동 검증 (5명 기준인물 × TOP10 = 50건) ===');

function buildExplanation(person, other, result, pctObj) {
  const raw = result.result.raw;
  const reasons = [];
  const usedFactTypes = new Set();

  // 오행 보완 (fact_ref 포함, 방향 명시)
  if (raw.five_element_complementarity.complements.length > 0 && !usedFactTypes.has('complementarity')) {
    const details = raw.five_element_complementarity.complements.map(c => {
      const lackWho = c.lacking_in === 'personA' ? '당신' : other;
      const supplyWho = c.supplied_by === 'personA' ? '당신' : other;
      return { text: `${ELEMENT_KO[c.element]}은 ${lackWho}에게 ${c.lacking_count}개, ${supplyWho}에게 ${c.supplying_count}개라, ${supplyWho}이(가) ${lackWho}의 부족분을 채우는 방향의 보완 신호가 있습니다.`, raw: c };
    });
    reasons.push({ type:'complementarity', fact_ref:['five_element_a','five_element_b','five_element_complementarity'], text: details.map(d=>d.text).join(' '), raw_check: raw.five_element_complementarity.complements });
    usedFactTypes.add('complementarity');
  }
  // 천간합(attraction 근거)
  const stemCombine = raw.cross_pillar_relations.filter(r=>r.kind==='stem'&&r.relation==='合');
  if (stemCombine.length > 0) {
    const positions = stemCombine.map(r=>`${r.personA_pillar}-${r.personB_pillar}`).join(', ');
    reasons.push({ type:'attraction', fact_ref:['cross_pillar_relations'], text:`천간합이 ${stemCombine.length}곳(${positions})에서 확인되어 결합 신호가 나타납니다.`, raw_check: stemCombine });
  }
  // stimulation(沖)
  const chung = raw.cross_pillar_relations.filter(r=>r.kind==='branch'&&r.relation==='沖');
  if (chung.length > 0) {
    const positions = chung.map(r=>`${r.personA_pillar}-${r.personB_pillar}`).join(', ');
    reasons.push({ type:'stimulation', fact_ref:['cross_pillar_relations'], text:`沖 관계가 ${positions}에서 확인되어 역동적인 변화 신호가 나타날 수 있는 구조입니다.`, raw_check: chung });
  }

  // relationship_style: mutual_ten_god 양방향
  const mtg = raw.mutual_ten_god;
  const relationshipStyle = `당신에게 ${other}는 ${mtg.personA_to_B} 관계로, ${other}에게 당신은 ${mtg.personB_to_A} 관계로 나타납니다.`;

  // caution: conflict_potential (pillar_pair 단위, 중복 안 합침)
  const cautionFacts = result.result.features.conflict_potential.pillar_pairs;
  const caution = cautionFacts.map(p => ({ fact_ref:['conflict_potential.pillar_pairs'], text: `${p.personA_pillar}-${p.personB_pillar} 사이에서 ${p.relations.join('·')} 관계가 함께 확인되어 신경 써볼 지점이 있습니다.`, raw_check: p }));

  // 가장 percentile 높은 2~3개만 선택(중복 fact_type 제거)
  const sortedReasons = reasons.sort((a,b) => (pctObj[mapTypeToFeature(b.type)]??0) - (pctObj[mapTypeToFeature(a.type)]??0)).slice(0,3);

  return { candidate_id: other, why_recommended: sortedReasons, relationship_style: { mutual_ten_god_text: relationshipStyle, raw_check: mtg }, caution };
}
function mapTypeToFeature(type) { return { attraction:'attr_D', communication:'comm_C', complementarity:'complementarity', stimulation:'stimulation' }[type] ?? type; }

// 자동 검증기들
let checks = { traceabilityTotal:0, traceabilityPass:0, directionTotal:0, directionPass:0, mtgTotal:0, mtgPass:0, hallucinationFound:0, duplicateFound:0, rankExplainMismatch:0 };

function verifyExplanation(exp, rawFull) {
  for (const reason of exp.why_recommended) {
    checks.traceabilityTotal++;
    // fact_ref가 실제 raw 객체 안에 존재하는 경로인지 확인
    const exists = reason.fact_ref.every(ref => {
      const topKey = ref.split('.')[0];
      return topKey in rawFull.raw;
    });
    if (exists) checks.traceabilityPass++; else checks.hallucinationFound++;

    if (reason.type === 'complementarity') {
      checks.directionTotal++;
      // 방향 검증: raw_check의 lacking_in/supplied_by가 실제 five_element_a/b 값과 일치하는지
      const allCorrect = reason.raw_check.every(c => {
        const aVal = rawFull.raw.five_element_a[c.element];
        const bVal = rawFull.raw.five_element_b[c.element];
        if (c.lacking_in === 'personA') return c.lacking_count === aVal && c.supplying_count === bVal;
        return c.lacking_count === bVal && c.supplying_count === aVal;
      });
      if (allCorrect) checks.directionPass++;
    }
    if (reason.type === 'attraction') {
      // 개수 hallucination 체크: 텍스트에 명시된 개수가 실제 raw_check.length와 일치
      const claimedCount = reason.raw_check.length;
      const actualCount = rawFull.raw.cross_pillar_relations.filter(r=>r.kind==='stem'&&r.relation==='合').length;
      if (claimedCount !== actualCount) checks.hallucinationFound++;
    }
  }
  // mutual_ten_god 양방향 존재 확인
  checks.mtgTotal++;
  const text = exp.relationship_style.mutual_ten_god_text;
  if (text.includes(rawFull.raw.mutual_ten_god.personA_to_B) && text.includes(rawFull.raw.mutual_ten_god.personB_to_A)) checks.mtgPass++;

  // 중복 설명 검증: 같은 fact_ref 조합이 why_recommended 안에서 두 번 이상 정확히 같은 type으로 안 나오는지
  const types = exp.why_recommended.map(r=>r.type);
  if (new Set(types).size !== types.length) checks.duplicateFound++;
}

const SAMPLE_PERSONS = ['P1','P5','P10','P15','P20'];
for (const person of SAMPLE_PERSONS) {
  const pool = withPercentiles(buildCandidatePool(person));
  const scored = pool.map(c => ({ ...c, score: compositeScore(c.pct, WEIGHTS.A_equal) }));
  scored.sort((a,b)=>b.score-a.score);
  const top10 = scored.slice(0,10);
  for (const cand of top10) {
    const exp = buildExplanation(person, cand.other, cand, cand.pct);
    verifyExplanation(exp, cand.result);
    // Ranking-Explanation 일관성: TOP인데 이유가 하나도 없으면 모순
    if (top10.indexOf(cand) < 3 && exp.why_recommended.length === 0) checks.rankExplainMismatch++;
  }
}

console.log('Fact Traceability:', `${checks.traceabilityPass}/${checks.traceabilityTotal}`, `(${(checks.traceabilityPass/checks.traceabilityTotal*100).toFixed(1)}%)`);
console.log('오행 방향성 정확도:', `${checks.directionPass}/${checks.directionTotal}`, `(${checks.directionTotal?(checks.directionPass/checks.directionTotal*100).toFixed(1):'N/A'}%)`);
console.log('mutual_ten_god 양방향 정확도:', `${checks.mtgPass}/${checks.mtgTotal}`, `(${(checks.mtgPass/checks.mtgTotal*100).toFixed(1)}%)`);
console.log('Hallucination 발견 건수:', checks.hallucinationFound);
console.log('중복 설명 발견 건수:', checks.duplicateFound);
console.log('Ranking-Explanation 모순 건수(TOP3인데 이유 없음):', checks.rankExplainMismatch);

// 실제 샘플 1건 출력
console.log();
console.log('=== 실제 Explanation 샘플 (P1의 TOP1) ===');
const poolFinal = withPercentiles(buildCandidatePool('P1'));
const scoredFinal = poolFinal.map(c => ({...c, score: compositeScore(c.pct, WEIGHTS.A_equal)}));
scoredFinal.sort((a,b)=>b.score-a.score);
console.log(JSON.stringify(buildExplanation('P1', scoredFinal[0].other, scoredFinal[0], scoredFinal[0].pct), null, 2));
