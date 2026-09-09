import { computeChart } from './packages/chart-engine/compute.mjs';
import { buildCanonicalChart } from './packages/canonical/transform.mjs';
import { analyzeCompatibilityFact } from './packages/chart-engine/compatibility-analysis.mjs';
import { getRelation } from '@orrery/core/pillars';

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
  const canonical = buildCanonicalChart(raw, { engineVersion: 'v2' });
  people[`P${i+1}`] = canonical.saju;
});
const labels = Object.keys(people);

// ============== 섹션 1: mutual_ten_god 방향성 검증 ==============
console.log('=== 섹션 1: A→B / B→A 십신 분포 + 역방향 결정성 검증 ===');
const allPairs = [];
for (const a of labels) for (const b of labels) {
  if (a===b) continue;
  const r = analyzeCompatibilityFact(people[a], people[b]);
  allPairs.push({ from:a, to:b, ab: r.raw.mutual_ten_god.personA_to_B, ba: r.raw.mutual_ten_god.personB_to_A });
}
const distAB = {};
for (const p of allPairs) distAB[p.ab] = (distAB[p.ab]||0)+1;
console.log('A→B 분포(756건):', JSON.stringify(distAB));

// 역방향 결정성: "A→B가 X면 B→A는 항상 같은 Y인가?"
const mapping = {}; // ab -> Set of ba observed
for (const p of allPairs) {
  if (!mapping[p.ab]) mapping[p.ab] = new Set();
  mapping[p.ab].add(p.ba);
}
console.log();
console.log('역방향 결정성 (A→B별로 B→A가 항상 고정되는지):');
for (const [ab, baSet] of Object.entries(mapping)) {
  console.log(`  A→B=${ab} 일 때 B→A는:`, [...baSet].join(', '), baSet.size===1 ? '(완전 고정)' : '(비고정 — 다른 요인에 좌우됨)');
}

// 같은 두 십신 조합이 방향만 반대인 경우(A→B=X,B→A=Y)와 (A→B=Y,B→A=X)가 둘 다 나타나는지
console.log();
console.log('=== "조합 자체"가 방향 무관하게 대칭인지, 아니면 항상 특정 방향에서만 나오는지 ===');
const comboSeen = new Set();
let symmetricComboCount = 0, asymmetricOnlyCount = 0;
for (const [ab, baSet] of Object.entries(mapping)) {
  for (const ba of baSet) {
    const key1 = `${ab}|${ba}`, key2 = `${ba}|${ab}`;
    if (comboSeen.has(key2)) { symmetricComboCount++; }
    comboSeen.add(key1);
  }
}
console.log('양방향으로 다 관측된 조합 수:', symmetricComboCount, '(예: A→B=傷官,B→A=正印 도 있고 그 반대도 있음)');

// ============== 섹션 4: emotional_stability 재설계 실험 (여러 후보) ==============
console.log();
console.log('=== 섹션 4: emotional_stability 재설계 후보 비교 (갈등 데이터 완전 배제) ===');

function summarizeCandidates(result) {
  const dayRel = result.raw.day_branch_relation;
  return {
    // 후보 1: 일지 조화 여부만 (0 또는 1)
    cand1_dayHarmonyBinary: dayRel.harmony.length > 0 ? 1 : 0,
    // 후보 2: 일지 조화 관계 개수(중복 유형 있으면 여러개)
    cand2_dayHarmonyCount: dayRel.harmony.length,
    // 후보 3: 일지 관계 "존재" 여부(조화든 갈등이든 상관없이 뭔가 있으면 1) — 무관계 대비
    cand3_dayAnyRelation: dayRel.relations.length > 0 ? 1 : 0,
    // 후보 4: 일지 천간+지지 합 여부 구분(천간합/지지합 따로)
    cand4_dayStemHarmony: dayRel.harmony.filter(r=>r.kind==='stem').length,
    cand4_dayBranchHarmony: dayRel.harmony.filter(r=>r.kind==='branch').length,
  };
}

const allSummaries = [];
for (const a of labels) for (const b of labels) {
  if (a===b) continue;
  const r = analyzeCompatibilityFact(people[a], people[b]);
  allSummaries.push({ from:a, to:b, ...summarizeCandidates(r) });
}

const CAND_KEYS = ['cand1_dayHarmonyBinary','cand2_dayHarmonyCount','cand3_dayAnyRelation','cand4_dayStemHarmony','cand4_dayBranchHarmony'];
function stats(vals) {
  const n = vals.length;
  const mean = vals.reduce((a,b)=>a+b,0)/n;
  const std = Math.sqrt(vals.reduce((s,v)=>s+(v-mean)**2,0)/n);
  const uniq = new Set(vals).size;
  const tieRate = 1 - uniq/n; // 대략적인 동점 정도 추정용(엄밀한 정의 아님, 참고용)
  return { unique: uniq, mean: mean.toFixed(3), std: std.toFixed(3), max: Math.max(...vals), nonZeroRate: (vals.filter(v=>v>0).length/n*100).toFixed(1)+'%' };
}
for (const key of CAND_KEYS) {
  const vals = allSummaries.map(r=>r[key]);
  console.log(key, JSON.stringify(stats(vals)));
}

// 다른 feature와의 상관관계(재검증용 요약치 재사용)
function otherFeatureSummaries(result) {
  const f = result.features;
  return {
    attraction: f.attraction.stem_combine_count,
    communication: f.communication.branch_harmony_count,
    stimulation: f.stimulation.chung_count,
    conflict_potential: f.conflict_potential.unique_pillar_pair_count,
    complementarity: f.complementarity.count,
  };
}
const withOthers = [];
for (const a of labels) for (const b of labels) {
  if (a===b) continue;
  const r = analyzeCompatibilityFact(people[a], people[b]);
  withOthers.push({ ...summarizeCandidates(r), ...otherFeatureSummaries(r) });
}
function pearson(x,y){const n=x.length;const mx=x.reduce((a,b)=>a+b,0)/n,my=y.reduce((a,b)=>a+b,0)/n;let cov=0,vx=0,vy=0;for(let i=0;i<n;i++){cov+=(x[i]-mx)*(y[i]-my);vx+=(x[i]-mx)**2;vy+=(y[i]-my)**2;}return cov/Math.sqrt(vx*vy);}

console.log();
console.log('=== 각 후보 vs conflict_potential/attraction/communication/stimulation/complementarity 상관관계 ===');
for (const cand of CAND_KEYS) {
  const cvals = withOthers.map(r=>r[cand]);
  for (const other of ['attraction','communication','stimulation','conflict_potential','complementarity']) {
    const ovals = withOthers.map(r=>r[other]);
    const corr = pearson(cvals, ovals);
    if (Math.abs(corr) > 0.3) console.log(`  ⚠️ ${cand} ↔ ${other}: ${corr.toFixed(3)} (주목할 상관)`);
  }
}
console.log('(0.3 이상인 것만 출력됨 — 안 뜨면 전부 낮은 상관)');

// TOP3 변별력(28명 기준, cand2 예시로 확인 — 조화 개수 기반)
console.log();
console.log('=== cand2(일지 조화 개수) TOP3 변별력 샘플 (P1 기준) ===');
const asP1 = allSummaries.filter(r=>r.from==='P1');
const top3 = [...asP1].sort((a,b)=>b.cand2_dayHarmonyCount - a.cand2_dayHarmonyCount).slice(0,5);
console.log(top3.map(r=>`${r.to}(${r.cand2_dayHarmonyCount})`).join(', '));
const nonZeroP1 = asP1.filter(r=>r.cand2_dayHarmonyCount>0).length;
console.log('P1 기준 일지조화 있는 상대 수:', nonZeroP1, '/', asP1.length);
