// scripts/sample-yearly-fortune-quality.mjs
//
// Phase 11 — YEARLY_FORTUNE_BASIC/CHAT 실제 품질 샘플링. 이 샌드박스는 실제 OpenAI API에
// 접속할 수 없어서, 사용자가 로컬에서 직접 실행해야 한다.
//
//   node scripts/sample-yearly-fortune-quality.mjs
//
// .env에 실제 OPENAI_API_KEY/OPENAI_MODEL(Terra)/OPENAI_CHILD_COACH_MODEL(Luna)이 있어야 한다.
// DB/결제 없이 순수하게 "실제 fixture + 실제 프롬프트 → 실제 AI 결과"만 뽑는다(비용 최소화 —
// 기존 fixture 3개 × tier 2개 + 추가 연도 조합 몇 개로 6~10개 샘플).
//
// 결과는 콘솔에 출력되고 output/yearly-fortune-samples.json 파일로도 저장된다 — 그 파일
// 내용(또는 콘솔 출력)을 그대로 Claude에게 붙여넣으면 품질 평가를 진행할 수 있다.

import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { loadEnvFile } from '../packages/shared/load-env.mjs';

await loadEnvFile();

const { createAIProvider } = await import('../packages/ai/create-provider.mjs');
const { buildYearlyFortuneBasicPrompt, buildYearlyFortuneChatPrompt, YEARLY_FORTUNE_RESULT_SCHEMA } = await import('../packages/character/yearly-fortune-prompt.mjs');
const { calculateAgeBand, AGE_BANDS } = await import('../packages/shared/age-band.mjs');

if (!process.env.OPENAI_API_KEY) {
  console.log('❌ OPENAI_API_KEY가 설정되어 있지 않습니다. .env를 확인하세요.');
  process.exit(1);
}

// yearly-fortune-service.mjs의 extractYearData와 동일한 로직(코드 수정 금지 원칙에 따라 원본
// 파일을 건드리지 않고, 조사/평가 스크립트 안에서 동일 로직을 그대로 복제).
function extractYearData(canonical, fortuneYear) {
  const annualPeriods = canonical?.saju?.annual_periods ?? [];
  const yearEntry = annualPeriods.find((p) => p.year === fortuneYear);
  if (!yearEntry) throw new Error(`${fortuneYear}년 데이터 없음`);
  return {
    day_master: canonical?.saju?.day_master ?? null,
    pillars: canonical?.saju?.pillars ?? null,
    major_period: yearEntry.related_major_period ?? null,
    year_entry: yearEntry,
  };
}

const FIXTURES = [
  { file: 'adult-main-quality-chart.json', label: '성인(품질검증용 메인 fixture)', isChild: false },
  { file: 'edge-case-infant-chart.json', label: '영유아(자녀 대표 샘플)', isChild: true },
  { file: 'user-test-1989-busan.json', label: '1989년생 부산', isChild: false },
];
const FORTUNE_YEAR = 2027;

const PLAN = [
  ...FIXTURES.flatMap((f) => [
    { ...f, tier: 'basic', year: FORTUNE_YEAR },
    { ...f, tier: 'detail', year: FORTUNE_YEAR },
  ]),
  { file: 'adult-main-quality-chart.json', label: '성인(다른 연도 비교용)', isChild: false, tier: 'basic', year: 2030 },
  { file: 'adult-main-quality-chart.json', label: '성인(다른 연도 비교용)', isChild: false, tier: 'detail', year: 2030 },
];

const aiProviderFactory = () => createAIProvider(process.env);
const childCoachProviderFactory = () => createAIProvider({ ...process.env, OPENAI_MODEL: process.env.OPENAI_CHILD_COACH_MODEL ?? process.env.OPENAI_MODEL });

const results = [];

for (const plan of PLAN) {
  const raw = await readFile(`./data/fixtures/${plan.file}`, 'utf-8');
  const fixture = JSON.parse(raw);
  const canonical = fixture.saju ? fixture : { saju: fixture };

  let yearData;
  try {
    yearData = extractYearData(canonical, plan.year);
  } catch (err) {
    console.log(`스킵: ${plan.file} / ${plan.year}: ${err.message}`);
    continue;
  }

  const provider = plan.tier === 'detail' ? aiProviderFactory() : childCoachProviderFactory();
  let ageBand = null;
  if (plan.isChild) {
    const birthDate = canonical?.subject?.birth_date;
    if (birthDate) {
      const computed = calculateAgeBand(birthDate, plan.year);
      ageBand = computed === AGE_BANDS.ADULT ? null : computed;
    }
  }
  const systemPrompt = plan.tier === 'detail' ? buildYearlyFortuneChatPrompt(ageBand) : buildYearlyFortuneBasicPrompt(ageBand);

  console.log(`\n=== 생성 중: ${plan.label} / ${plan.year}년 / ${plan.tier}${ageBand ? ` / age_band=${ageBand}` : ''} ===`);
  const start = Date.now();
  try {
    const aiResult = await provider.complete({
      system: systemPrompt,
      user: `대상 연도: ${plan.year}\n실제 계산된 원국/세운 데이터:\n${JSON.stringify(yearData)}`,
      jsonSchema: YEARLY_FORTUNE_RESULT_SCHEMA,
      schemaName: 'yearly_fortune_result',
    });
    const elapsed = ((Date.now() - start) / 1000).toFixed(1);
    const charCount = JSON.stringify(aiResult.data).length;
    console.log(`완료(${elapsed}s, 결과 약 ${charCount}자 상당)`);
    results.push({
      sample_id: results.length + 1,
      fixture: plan.file,
      label: plan.label,
      fortune_year: plan.year,
      tier: plan.tier,
      age_band: ageBand,
      input_year_data: yearData,
      result: aiResult.data,
      usage: aiResult.usage,
    });
  } catch (err) {
    console.log(`실패: ${err.message}`);
    results.push({ sample_id: results.length + 1, fixture: plan.file, label: plan.label, fortune_year: plan.year, tier: plan.tier, error: err.message });
  }
}

await mkdir('./output', { recursive: true });
await writeFile('./output/yearly-fortune-samples.json', JSON.stringify(results, null, 2));

console.log(`\n${'='.repeat(50)}`);
console.log(`총 ${results.length}개 샘플 생성 완료 -> ./output/yearly-fortune-samples.json`);
console.log('이 파일 내용을 Claude에게 붙여넣어 품질 평가를 요청하세요.');
console.log('='.repeat(50));
