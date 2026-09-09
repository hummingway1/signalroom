// apps/api/src/services/yearly-fortune-service.mjs
//
// §Phase9 확정 정책 — 990원(BASIC)/4900원(CHAT) 둘 다 "생성 1회 + 영구 열람"이다. 재접속 시
// result_data가 이미 있으면 LLM을 다시 호출하지 않는다. 이 함수가 그 지연 생성(lazy generation)
// + 캐시 반환의 유일한 진입점이다.
import { getAnalysisScopeById, verifyAnalysisScopeOwnership, fillAnalysisScopeResultOnce } from '../repositories/analysis-scope-repository.mjs';
import { findEntitlementByAnalysisScopeId } from '../repositories/payment-repository.mjs';
import { getChart } from '../repositories/chart-repository.mjs';
import { getChildProfile } from '../repositories/child-profile-repository.mjs';
import { buildYearlyFortuneBasicPrompt, buildYearlyFortuneChatPrompt, YEARLY_FORTUNE_RESULT_SCHEMA } from '../../../../packages/character/yearly-fortune-prompt.mjs';
import { calculateAgeBand, AGE_BANDS } from '../../../../packages/shared/age-band.mjs';

export class YearlyFortuneError extends Error {
  constructor(code, message) {
    super(message);
    this.code = code;
  }
}

/** annual_periods 전체를 AI에게 주지 않는다 — 이 scope가 가리키는 fortune_year 항목 하나만
 * 추출한다(기존 extraction 원칙: 필요한 데이터만, AI가 스스로 다른 연도를 볼 방법이 없게). */
function extractYearData(canonical, fortuneYear) {
  const annualPeriods = canonical?.saju?.annual_periods ?? [];
  const yearEntry = annualPeriods.find((p) => p.year === fortuneYear);
  if (!yearEntry) {
    throw new YearlyFortuneError('YEAR_DATA_NOT_FOUND', `${fortuneYear}년 세운 데이터가 원국 계산 결과에 없습니다.`);
  }
  return {
    day_master: canonical?.saju?.day_master ?? null,
    pillars: canonical?.saju?.pillars ?? null,
    major_period: yearEntry.related_major_period ?? null,
    year_entry: yearEntry,
  };
}

/**
 * @param {object} params
 * @param {string} params.analysisScopeId
 * @param {string} params.userId - 세션에서만 옴, 클라이언트가 주장하는 값이 아님
 * @param {object} params.basicAiProvider - tier=basic일 때 쓸 provider(Luna)
 * @param {object} params.detailAiProvider - tier=detail일 때 쓸 provider(Terra)
 */
export async function getOrGenerateYearlyFortuneResult({ analysisScopeId, userId, basicAiProvider, detailAiProvider }) {
  const scope = await verifyAnalysisScopeOwnership(analysisScopeId, userId);
  if (scope.analysis_type !== 'YEARLY_FORTUNE') {
    throw new YearlyFortuneError('NOT_YEARLY_FORTUNE_SCOPE', '신년운세 분석이 아닙니다.');
  }

  // §Phase9 — 이미 생성된 결과가 있으면 LLM을 절대 다시 호출하지 않는다(영구 열람 원칙).
  if (scope.result_data) {
    return { resultData: scope.result_data, generatedNow: false };
  }

  // 이 scope가 어떤 tier(basic/detail)의 상품으로 구매됐는지 서버가 직접 조회한다(클라이언트
  // 신뢰 안 함).
  const entitlement = await findEntitlementByAnalysisScopeId(analysisScopeId);
  if (!entitlement) {
    throw new YearlyFortuneError('ENTITLEMENT_NOT_FOUND', '이 분석 결과에 연결된 구매 내역을 찾을 수 없습니다.');
  }
  const tier = entitlement.tier;

  const chart = scope.chart_id ? await getChart(scope.chart_id) : null;
  const childProfile = scope.child_profile_id ? await getChildProfile(scope.child_profile_id) : null;
  const targetChart = chart ?? (childProfile ? await getChart(childProfile.chart_id) : null);
  if (!targetChart) throw new YearlyFortuneError('SUBJECT_NOT_FOUND', '대상 chart를 찾을 수 없습니다.');

  const yearData = extractYearData(targetChart.canonical, scope.fortune_year);

  // §확정 정책 — 본인(chart_id) 신년운세는 항상 ageBand=null(성인 프롬프트 그대로, 완전 무변경).
  // 자녀(child_profile_id)일 때만 birth_date로 나이 밴드를 계산한다. 19세 이상(adult)은 자녀용
  // 특별 콘텐츠 지시를 적용하지 않는다(§확정 정책 — "성인과 동일 취급"이 아니라 "분기 없음"으로
  // 명시적으로 처리).
  let ageBand = null;
  if (scope.child_profile_id) {
    const birthDate = targetChart.canonical?.subject?.birth_date;
    if (birthDate) {
      const computed = calculateAgeBand(birthDate, scope.fortune_year);
      ageBand = computed === AGE_BANDS.ADULT ? null : computed;
    }
  }

  const provider = tier === 'detail' ? detailAiProvider : basicAiProvider;
  if (!provider) {
    throw new YearlyFortuneError('PROVIDER_NOT_CONFIGURED', 'AI 모델이 설정되지 않았습니다.');
  }
  const systemPrompt = tier === 'detail' ? buildYearlyFortuneChatPrompt(ageBand) : buildYearlyFortuneBasicPrompt(ageBand);

  const aiResult = await provider.complete({
    system: systemPrompt,
    user: `대상 연도: ${scope.fortune_year}\n실제 계산된 원국/세운 데이터:\n${JSON.stringify(yearData)}`,
    jsonSchema: YEARLY_FORTUNE_RESULT_SCHEMA,
    schemaName: 'yearly_fortune_result',
  });

  const resultData = { ...aiResult.data, analysis_type: 'YEARLY_FORTUNE', tier, fortune_year: scope.fortune_year, age_band: ageBand, generated_at: new Date().toISOString() };

  const filled = await fillAnalysisScopeResultOnce(analysisScopeId, resultData);
  // filled가 false면 동시 요청 경쟁에서 다른 요청이 먼저 채웠다는 뜻 — 그 저장된 값을 다시 읽어서 반환(중복 생성/중복 LLM 낭비 방지).
  if (!filled) {
    const latest = await getAnalysisScopeById(analysisScopeId);
    return { resultData: latest.result_data, generatedNow: false };
  }

  return { resultData, generatedNow: true, usage: aiResult.usage };
}
