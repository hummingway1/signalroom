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
  people[`P${i+1}`] = buildCanonicalChart(raw, { engineVersion: 'v3' }).saju;
});
const labels = Object.keys(people);

const INTENSE = new Set(['偏官','偏財','偏印','傷官','劫財']);
const EXPRESSIVE = new Set(['食神','傷官']);

function candidates(result) {
  const f = result.features;
  const stemCombine = f.attraction.stem_combine_count;
  const dayHarmonyBinary = f.attraction.day_branch_harmony.length > 0 ? 1 : 0;
  const mtg = result.raw.mutual_ten_god;
  const intenseBonus = (INTENSE.has(mtg.personA_to_B)?1:0) + (INTENSE.has(mtg.personB_to_A)?1:0);
  const branchHarmony = f.communication.branch_harmony_count;
  const expressiveBonus = (EXPRESSIVE.has(mtg.personA_to_B)?1:0) + (EXPRESSIVE.has(mtg.personB_to_A)?1:0);
  const expressiveDirA = EXPRESSIVE.has(mtg.personA_to_B)?1:0;
  const expressiveDirB = EXPRESSIVE.has(mtg.personB_to_A)?1:0;

  return {
    // attraction 후보
    attr_A: stemCombine,
    attr_B: stemCombine + dayHarmonyBinary,
    attr_C: stemCombine + intenseBonus,
    attr_D: stemCombine + dayHarmonyBinary + intenseBonus,
    // communication 후보
    comm_A: expressiveBonus,
    comm_B: branchHarmony,
    comm_C: expressiveBonus + branchHarmony,
    comm_D_dirA: expressiveDirA,
    comm_D_dirB: expressiveDirB,
    // 참고용 기존 feature
    complementarity: f.complementarity.count,
    stimulation: f.stimulation.chung_count,
    conflict_potential: f.conflict_potential.unique_pillar_pair_count,
  };
}

const all = [];
for (const a of labels) for (const b of labels) {
  if (a===b) continue;
  all.push({ from:a, to:b, ...candidates(analyzeCompatibilityFact(people[a], people[b])) });
}

function stats(vals) {
  const n = vals.length;
  const mean = vals.reduce((a,b)=>a+b,0)/n;
  const std = Math.sqrt(vals.reduce((s,v)=>s+(v-mean)**2,0)/n);
  const uniq = new Set(vals).size;
  const zeroRate = vals.filter(v=>v===0).length/n;
  const sorted = [...vals].sort((a,b)=>a-b);
  function pct(p){ const idx=(p/100)*(sorted.length-1); const lo=Math.floor(idx),hi=Math.ceil(idx); return sorted[lo]+(sorted[hi]-sorted[lo])*(idx-lo); }
  return { unique: uniq, mean: mean.toFixed(2), std: std.toFixed(2), cv: (std/mean).toFixed(2), zeroRate: (zeroRate*100).toFixed(1)+'%', p10:pct(10),p25:pct(25),p50:pct(50),p75:pct(75),p90:pct(90) };
}
function pearson(x,y){const n=x.length;const mx=x.reduce((a,b)=>a+b,0)/n,my=y.reduce((a,b)=>a+b,0)/n;let cov=0,vx=0,vy=0;for(let i=0;i<n;i++){cov+=(x[i]-mx)*(y[i]-my);vx+=(x[i]-mx)**2;vy+=(y[i]-my)**2;}return cov/Math.sqrt(vx*vy);}

console.log('=== B. attraction 후보 비교 (A~D, E는 A와 수치상 동일) ===');
for (const cand of ['attr_A','attr_B','attr_C','attr_D']) {
  console.log(cand, JSON.stringify(stats(all.map(r=>r[cand]))));
}
console.log();
console.log('-- 후보별 다른 feature와 상관관계 --');
for (const cand of ['attr_A','attr_B','attr_C','attr_D']) {
  const cvals = all.map(r=>r[cand]);
  const corrs = ['complementarity','stimulation','conflict_potential'].map(o => `${o}:${pearson(cvals, all.map(r=>r[o])).toFixed(2)}`);
  console.log(cand, corrs.join(' | '));
}

console.log();
console.log('-- TOP3 변별력/TOP1 독점도 (28명 평균) --');
for (const cand of ['attr_A','attr_B','attr_C','attr_D']) {
  let totalTop1Dominance = {};
  for (const person of labels) {
    const asSource = all.filter(r=>r.from===person);
    const top1 = [...asSource].sort((a,b)=>b[cand]-a[cand])[0].to;
    totalTop1Dominance[top1] = (totalTop1Dominance[top1]||0)+1;
  }
  const maxDom = Math.max(...Object.values(totalTop1Dominance));
  console.log(cand, '| 특정 인물이 여러 사람의 TOP1을 독점한 최대 횟수:', maxDom, '/', labels.length);
}

console.log();
console.log('=== C. communication 후보 비교 ===');
for (const cand of ['comm_A','comm_B','comm_C']) {
  console.log(cand, JSON.stringify(stats(all.map(r=>r[cand]))));
}
console.log();
console.log('-- comm_D 방향성 배타성 검증: dirA=1이면서 dirB=1인 경우가 있는가? --');
const bothDirActive = all.filter(r=>r.comm_D_dirA===1 && r.comm_D_dirB===1).length;
console.log('dirA=1 AND dirB=1 동시발생:', bothDirActive, '/', all.length, '(0이면 구조적으로 상호배타적)');
console.log('dirA=1 인 경우 수:', all.filter(r=>r.comm_D_dirA===1).length);
console.log('dirB=1 인 경우 수:', all.filter(r=>r.comm_D_dirB===1).length);
