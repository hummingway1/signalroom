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
  const label = `P${i+1}`;
  const raw = computeChart({ birthDate, birthTime, gender, city });
  const canonical = buildCanonicalChart(raw, { engineVersion: 'validate' });
  people[label] = canonical.saju;
});

const labels = Object.keys(people);

// 실제 모듈 결과에서 각 feature의 "요약 지표"(raw 배열을 그대로 보존한 채, 통계 검증용으로만
// 파생시킨 단일 수치) 추출 — 이건 서비스 점수가 아니라 순수 통계 분석용 임시 요약값.
function summarize(result) {
  const f = result.features;
  return {
    attraction: f.attraction.stem_combine_count,
    communication: f.communication.branch_harmony_count,
    emotional_stability: (f.emotional_stability.day_branch_relation.harmony.length) - (f.emotional_stability.friction_count),
    complementarity: f.complementarity.count,
    stimulation: f.stimulation.chung_count,
    conflict_potential: f.conflict_potential.unique_pillar_pair_count,
    romance_chemistry: (f.romance_chemistry.day_branch_relation.harmony.length) + f.romance_chemistry.day_stem_combine.length,
  };
}

const TYPES = ['attraction','communication','emotional_stability','complementarity','stimulation','conflict_potential','romance_chemistry'];

// 756건(양방향) 전체 계산
const allDirectional = []; // { from, to, ...summary }
for (const a of labels) for (const b of labels) {
  if (a===b) continue;
  const result = analyzeCompatibilityFact(people[a], people[b]);
  allDirectional.push({ from:a, to:b, ...summarize(result) });
}
console.log('총 방향성 쌍 개수:', allDirectional.length);

// ============== 섹션 2: 상관관계 (Pearson + Spearman) ==============
function pearson(x, y) {
  const n = x.length;
  const mx = x.reduce((a,b)=>a+b,0)/n, my = y.reduce((a,b)=>a+b,0)/n;
  let cov=0, vx=0, vy=0;
  for (let i=0;i<n;i++){ cov+=(x[i]-mx)*(y[i]-my); vx+=(x[i]-mx)**2; vy+=(y[i]-my)**2; }
  return cov/Math.sqrt(vx*vy);
}
function rank(arr) {
  const idx = arr.map((v,i)=>i).sort((a,b)=>arr[a]-arr[b]);
  const ranks = new Array(arr.length);
  idx.forEach((originalIdx, rankPos) => { ranks[originalIdx] = rankPos; });
  return ranks;
}
function spearman(x, y) { return pearson(rank(x), rank(y)); }

console.log();
console.log('=== 섹션 2: Feature 간 상관관계 (Pearson / Spearman, n=756) ===');
const pairs = [
  ['attraction','romance_chemistry'], ['attraction','communication'], ['attraction','stimulation'],
  ['communication','emotional_stability'], ['emotional_stability','conflict_potential'],
  ['stimulation','conflict_potential'],
  ['complementarity','attraction'], ['complementarity','communication'], ['complementarity','emotional_stability'],
  ['complementarity','stimulation'], ['complementarity','conflict_potential'], ['complementarity','romance_chemistry'],
];
for (const [a,b] of pairs) {
  const xa = allDirectional.map(r=>r[a]);
  const xb = allDirectional.map(r=>r[b]);
  console.log(`${a} ↔ ${b}`.padEnd(35), '| Pearson:', pearson(xa,xb).toFixed(3), '| Spearman:', spearman(xa,xb).toFixed(3));
}

// ============== 섹션 3: 변별력 (표준편차/CV/percentile) ==============
console.log();
console.log('=== 섹션 3: Feature별 변별력 상세 ===');
function percentile(sorted, p) { const idx = (p/100)*(sorted.length-1); const lo=Math.floor(idx), hi=Math.ceil(idx); return sorted[lo] + (sorted[hi]-sorted[lo])*(idx-lo); }
for (const type of TYPES) {
  const vals = allDirectional.map(r=>r[type]);
  const n = vals.length;
  const mean = vals.reduce((a,b)=>a+b,0)/n;
  const variance = vals.reduce((s,v)=>s+(v-mean)**2,0)/n;
  const std = Math.sqrt(variance);
  const cv = mean !== 0 ? (std/Math.abs(mean)) : Infinity;
  const sorted = [...vals].sort((a,b)=>a-b);
  const uniq = new Set(vals.map(v=>v.toFixed(2))).size;
  console.log(`--- ${type} ---`);
  console.log('  unique:', uniq, '| min:', sorted[0].toFixed(1), 'max:', sorted.at(-1).toFixed(1), '| mean:', mean.toFixed(2), '| std:', std.toFixed(2), '| CV:', cv.toFixed(2));
  console.log('  p10:', percentile(sorted,10).toFixed(1), 'p25:', percentile(sorted,25).toFixed(1), 'p50:', percentile(sorted,50).toFixed(1), 'p75:', percentile(sorted,75).toFixed(1), 'p90:', percentile(sorted,90).toFixed(1));
}

// ============== 섹션 4: 유형별 TOP3 overlap (28명 각각 기준) ==============
console.log();
console.log('=== 섹션 4: 사람별 유형 TOP3 overlap 검증 (28명 전체 평균) ===');
let totalOverlapPairs = 0, totalComparisons = 0;
const winnerDominanceCounts = {}; // 한 사람이 특정 person 기준으로 몇 개 유형에서 1위인지
for (const person of labels) {
  const asSource = allDirectional.filter(r=>r.from===person);
  const top3ByType = {};
  const top1ByType = {};
  for (const type of TYPES) {
    const sorted = [...asSource].sort((a,b)=>b[type]-a[type]);
    top3ByType[type] = sorted.slice(0,3).map(r=>r.to);
    top1ByType[type] = sorted[0].to;
  }
  // TOP3 overlap: 모든 유형쌍에 대해 교집합 비율
  for (let i=0;i<TYPES.length;i++) for (let j=i+1;j<TYPES.length;j++) {
    const setA = new Set(top3ByType[TYPES[i]]);
    const setB = new Set(top3ByType[TYPES[j]]);
    const overlap = [...setA].filter(x=>setB.has(x)).length;
    totalOverlapPairs += overlap;
    totalComparisons++;
  }
  // 1위 독점 카운트
  const counts = {};
  for (const w of Object.values(top1ByType)) counts[w]=(counts[w]||0)+1;
  const maxDominance = Math.max(...Object.values(counts));
  winnerDominanceCounts[person] = maxDominance;
}
console.log('평균 TOP3 overlap(교집합 개수, 0~3, 유형쌍마다):', (totalOverlapPairs/totalComparisons).toFixed(2));
const dominanceVals = Object.values(winnerDominanceCounts);
console.log('사람별 "1위 독점 유형 개수" 분포:', JSON.stringify({
  min: Math.min(...dominanceVals), max: Math.max(...dominanceVals),
  mean: (dominanceVals.reduce((a,b)=>a+b,0)/dominanceVals.length).toFixed(2),
  '독점4개이상인사람수': dominanceVals.filter(v=>v>=4).length,
}));

// attraction과 romance_chemistry가 거의 같은 TOP을 내는지 구체 검증
console.log();
console.log('=== attraction vs romance_chemistry TOP1 일치율 (28명 기준) ===');
let sameTop1Count = 0;
for (const person of labels) {
  const asSource = allDirectional.filter(r=>r.from===person);
  const attrTop1 = [...asSource].sort((a,b)=>b.attraction-a.attraction)[0].to;
  const romTop1 = [...asSource].sort((a,b)=>b.romance_chemistry-a.romance_chemistry)[0].to;
  if (attrTop1 === romTop1) sameTop1Count++;
}
console.log('TOP1이 일치하는 사람 수:', sameTop1Count, '/', labels.length, `(${(sameTop1Count/labels.length*100).toFixed(1)}%)`);

// ============== 섹션 5: 양방향성(대칭성) 검증 ==============
console.log();
console.log('=== 섹션 5: feature(A,B) vs feature(B,A) 대칭성 검증 ===');
let asymCounts = {};
for (const type of TYPES) asymCounts[type] = 0;
let checkedPairCount = 0;
for (let i=0;i<labels.length;i++) for (let j=i+1;j<labels.length;j++) {
  const ab = allDirectional.find(r=>r.from===labels[i]&&r.to===labels[j]);
  const ba = allDirectional.find(r=>r.from===labels[j]&&r.to===labels[i]);
  for (const type of TYPES) {
    if (ab[type] !== ba[type]) asymCounts[type]++;
  }
  checkedPairCount++;
}
console.log('전체 무순서쌍 개수:', checkedPairCount);
for (const type of TYPES) console.log(`  ${type}: 비대칭 발생 ${asymCounts[type]}/${checkedPairCount}건`);
