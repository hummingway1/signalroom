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
  people[`P${i+1}`] = buildCanonicalChart(raw, { engineVersion: 'v4' }).saju;
});
const allLabels = Object.keys(people);

const INTENSE = new Set(['偏官','偏財','偏印','傷官','劫財']);
const EXPRESSIVE = new Set(['食神','傷官']);

function indicatorSet(a, b) {
  const r = analyzeCompatibilityFact(people[a], people[b]);
  const f = r.features;
  const mtg = r.raw.mutual_ten_god;
  return {
    attr_D: f.attraction.stem_combine_count + (f.attraction.day_branch_harmony.length>0?1:0) + (INTENSE.has(mtg.personA_to_B)?1:0) + (INTENSE.has(mtg.personB_to_A)?1:0),
    comm_C: (EXPRESSIVE.has(mtg.personA_to_B)?1:0) + (EXPRESSIVE.has(mtg.personB_to_A)?1:0) + f.communication.branch_harmony_count,
    complementarity: f.complementarity.count,
    stimulation: f.stimulation.chung_count,
    conflict_potential: f.conflict_potential.unique_pillar_pair_count,
  };
}

const FEATURES = ['attr_D','comm_C','complementarity','stimulation','conflict_potential'];

function top3For(person, pool, feature) {
  const candidates = pool.filter(p=>p!==person).map(other => ({ other, val: indicatorSet(person, other)[feature] }));
  return candidates.sort((a,b)=>b.val-a.val).slice(0,3).map(c=>c.other);
}

function overlapCount(a, b) { return a.filter(x=>b.includes(x)).length; }

console.log('=== H. Bootstrap/Resampling 순위 안정성 검증 ===');
console.log();

// 1) 전체 28명 기준 TOP3 (baseline)
const baselineTop3 = {};
for (const feature of FEATURES) {
  baselineTop3[feature] = {};
  for (const person of allLabels) baselineTop3[feature][person] = top3For(person, allLabels, feature);
}

// 2) 무작위로 4~5명 제거한 subset(20회 반복) 에서 TOP3 재계산 -> baseline과 overlap
const TRIALS = 20;
const REMOVE_COUNT = 5;

for (const feature of FEATURES) {
  let totalOverlap = 0, totalComparisons = 0;
  let top1RetainedCount = 0, top1TotalCount = 0;

  for (let trial=0; trial<TRIALS; trial++) {
    const shuffled = [...allLabels].sort(()=>Math.random()-0.5);
    const removed = new Set(shuffled.slice(0, REMOVE_COUNT));
    const subsetPool = allLabels.filter(p=>!removed.has(p));

    for (const person of subsetPool) {
      const subsetTop3 = top3For(person, subsetPool, feature);
      // baseline TOP3 중 이번 subset에 실제로 존재하는 사람만 걸러서 비교(공정한 비교)
      const baselineFiltered = baselineTop3[feature][person].filter(p=>subsetPool.includes(p));
      const overlap = overlapCount(subsetTop3, baselineFiltered);
      totalOverlap += overlap;
      totalComparisons++;

      // TOP1 유지 여부(그 사람이 제거되지 않았을 때만 비교)
      const baselineTop1 = baselineTop3[feature][person][0];
      if (subsetPool.includes(baselineTop1)) {
        top1TotalCount++;
        if (subsetTop3[0] === baselineTop1) top1RetainedCount++;
      }
    }
  }
  console.log(feature.padEnd(20), '| 평균 TOP3 overlap(0~3):', (totalOverlap/totalComparisons).toFixed(2), '| TOP1 유지율:', (top1RetainedCount/top1TotalCount*100).toFixed(1)+'%');
}

// 동점 발생률(TOP3 뽑을 때 3위와 4위가 동점이라 순위가 불안정한 비율)
console.log();
console.log('=== 동점(tie) 발생률: 3위와 4위 값이 같은 경우 ===');
for (const feature of FEATURES) {
  let tieCount = 0;
  for (const person of allLabels) {
    const candidates = allLabels.filter(p=>p!==person).map(other => indicatorSet(person, other)[feature]);
    const sorted = [...candidates].sort((a,b)=>b-a);
    if (sorted[2] === sorted[3]) tieCount++;
  }
  console.log(feature.padEnd(20), '| 3위=4위 동점 발생:', tieCount, '/', allLabels.length, `(${(tieCount/allLabels.length*100).toFixed(1)}%)`);
}
