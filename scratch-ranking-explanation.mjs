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
  people[`P${i+1}`] = buildCanonicalChart(raw, { engineVersion: 'v5' }).saju;
});
const allLabels = Object.keys(people);
const INTENSE = new Set(['偏官','偏財','偏印','傷官','劫財']);
const EXPRESSIVE = new Set(['食神','傷官']);

function fullResult(a, b) {
  const r = analyzeCompatibilityFact(people[a], people[b]);
  const f = r.features;
  const mtg = r.raw.mutual_ten_god;
  return {
    raw: r.raw,
    attr_D: f.attraction.stem_combine_count + (f.attraction.day_branch_harmony.length>0?1:0) + (INTENSE.has(mtg.personA_to_B)?1:0) + (INTENSE.has(mtg.personB_to_A)?1:0),
    comm_C: (EXPRESSIVE.has(mtg.personA_to_B)?1:0) + (EXPRESSIVE.has(mtg.personB_to_A)?1:0) + f.communication.branch_harmony_count,
    complementarity: f.complementarity.count,
    complementarityDetail: r.raw.five_element_complementarity.complements,
    stimulation: f.stimulation.chung_count,
    conflict_potential: f.conflict_potential.unique_pillar_pair_count,
    conflictPillarPairs: f.conflict_potential.pillar_pairs,
    stemCombineRelations: f.attraction.stem_combine_relations,
    dayBranchRelation: f.emotional_stability.day_branch_relation,
    mutualTenGod: mtg,
  };
}

// ============== overall(naive baseline 합산) 계산 + 랭킹 ==============
function overallScore(x) { return x.attr_D + x.comm_C + x.complementarity + x.stimulation - x.conflict_potential; }

function rankFor(person) {
  const candidates = allLabels.filter(p=>p!==person).map(other => ({ other, ...fullResult(person, other) }));
  for (const c of candidates) c.overall = overallScore(c);
  candidates.sort((a,b)=>b.overall-a.overall);
  return candidates;
}

console.log('=== B. Feature별 Ranking 기여도 + E. Leave-one-feature-out 민감도 (P1 기준) ===');
const baseRanked = rankFor('P1');
console.log('P1 기준 TOP10 (전체 5개 feature 합산):');
baseRanked.slice(0,10).forEach((c,i)=>console.log(`  #${i+1} ${c.other} overall=${c.overall} (attr${c.attr_D}/comm${c.comm_C}/comp${c.complementarity}/stim${c.stimulation}/confl${c.conflict_potential})`));

function rankWithout(person, excludeFeature) {
  const candidates = allLabels.filter(p=>p!==person).map(other => ({ other, ...fullResult(person, other) }));
  for (const c of candidates) {
    let s = 0;
    if (excludeFeature!=='attr_D') s += c.attr_D;
    if (excludeFeature!=='comm_C') s += c.comm_C;
    if (excludeFeature!=='complementarity') s += c.complementarity;
    if (excludeFeature!=='stimulation') s += c.stimulation;
    if (excludeFeature!=='conflict_potential') s -= c.conflict_potential;
    c.overall = s;
  }
  candidates.sort((a,b)=>b.overall-a.overall);
  return candidates.slice(0,10).map(c=>c.other);
}
console.log();
console.log('-- Leave-one-out: 특정 feature를 빼면 TOP10이 얼마나 바뀌는가 --');
const baseTop10Set = new Set(baseRanked.slice(0,10).map(c=>c.other));
for (const feat of ['attr_D','comm_C','complementarity','stimulation','conflict_potential']) {
  const withoutTop10 = rankWithout('P1', feat);
  const overlap = withoutTop10.filter(x=>baseTop10Set.has(x)).length;
  console.log(`  ${feat} 제외 시 TOP10 중 원래와 겹치는 인원: ${overlap}/10`);
}

// ============== C. 28명 전체에 대해 TOP10 이유 패턴 분석(문제 A/B/C/D/E 확인) ==============
console.log();
console.log('=== C+문제 A/B/C: 28명 전체 TOP1 "가장 강한 이유"가 다양한지 ===');
const reasonCount = { attr_D:0, comm_C:0, complementarity:0, stimulation:0 };
for (const person of allLabels) {
  const ranked = rankFor(person);
  const top1 = ranked[0];
  // top1의 5개 feature 중 그 사람 후보군 내에서 percentile이 가장 높은 것을 "가장 강한 이유"로 선정
  const pool = ranked;
  function percentileOf(val, key) { return pool.filter(c=>c[key]<=val).length/pool.length; }
  const pcts = {
    attr_D: percentileOf(top1.attr_D,'attr_D'),
    comm_C: percentileOf(top1.comm_C,'comm_C'),
    complementarity: percentileOf(top1.complementarity,'complementarity'),
    stimulation: percentileOf(top1.stimulation,'stimulation'),
  };
  const strongest = Object.entries(pcts).sort((a,b)=>b[1]-a[1])[0][0];
  reasonCount[strongest]++;
}
console.log('28명 각각의 TOP1 "가장 강한 추천 이유" 분포:', JSON.stringify(reasonCount));
console.log('(한 이유로 몰리면 문제A/B, 고르게 분산되면 설계가 건강함)');

// conflict 높은데 상위권인 모순 케이스(문제C) 확인
console.log();
console.log('=== 문제 C: conflict_potential이 높은데도 TOP5 안에 든 케이스가 있는가? (28명 전체) ===');
let contradictionCount = 0;
for (const person of allLabels) {
  const ranked = rankFor(person);
  const top5 = ranked.slice(0,5);
  const avgConflict = ranked.reduce((s,c)=>s+c.conflict_potential,0)/ranked.length;
  for (const c of top5) {
    if (c.conflict_potential > avgConflict * 1.5) contradictionCount++;
  }
}
console.log('평균보다 1.5배 이상 높은 conflict를 가지고도 TOP5에 든 케이스:', contradictionCount, '건 (28명×TOP5=140건 중)');

// ============== D. 동점 처리 실측 ==============
console.log();
console.log('=== D. 동점(공동순위) 실측 — P1 기준 overall 점수 동점자 분포 ===');
const overallVals = baseRanked.map(c=>c.overall);
const uniqOverall = new Set(overallVals).size;
console.log('overall 고유값 개수:', uniqOverall, '/ 27명 후보');
const grouped = {};
for (const c of baseRanked) { grouped[c.overall] = grouped[c.overall] || []; grouped[c.overall].push(c.other); }
console.log('상위 5개 점수 그룹:', Object.entries(grouped).sort((a,b)=>b[0]-a[0]).slice(0,5).map(([score,members])=>`score=${score}: [${members.join(',')}]`).join(' | '));

// ============== J. 실제 5명 Fact→Explanation 샘플 ==============
console.log();
console.log('=== J. 실제 Fact → Explanation 샘플 (P1 기준 TOP5) ===');
const STEM_KOR = {wood:'木',fire:'火',earth:'土',metal:'金',water:'水'};
for (let i=0;i<5;i++) {
  const c = baseRanked[i];
  console.log(`\n[Candidate ${c.other}] 종합 순위 #${i+1} (overall=${c.overall})`);
  if (c.complementarityDetail.length>0) {
    const d = c.complementarityDetail[0];
    console.log(`  ① 오행 보완 FACT: ${d.lacking_in==='personA'?'나':c.other}의 ${STEM_KOR[d.element]}=${d.lacking_count}, ${d.supplied_by==='personA'?'나':c.other}의 ${STEM_KOR[d.element]}=${d.supplying_count}`);
  }
  if (c.stemCombineRelations.length>0) {
    console.log(`  ② 천간합 FACT: ${c.stemCombineRelations.length}개 (${c.stemCombineRelations.map(r=>`${r.personA_pillar}-${r.personB_pillar}`).join(', ')})`);
  }
  if (c.dayBranchRelation.harmony.length>0) {
    console.log(`  ③ 일지 관계 FACT: 合 존재`);
  }
  if (c.conflictPillarPairs.length>0) {
    console.log(`  ⚠️ 주의 FACT: ${c.conflictPillarPairs.map(p=>p.relations.join('+')).join(', ')} (${c.conflictPillarPairs.length}개 주 쌍)`);
  }
  console.log(`  상호십신: personA_to_B=${c.mutualTenGod.personA_to_B}, personB_to_A=${c.mutualTenGod.personB_to_A}`);
}
