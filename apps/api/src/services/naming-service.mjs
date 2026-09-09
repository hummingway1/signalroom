// apps/api/src/services/naming-service.mjs
//
// §작명소 — 기존 chart 계산 엔진(createChart/getChart)을 그대로 재사용한다. 새 사주 계산
// 로직을 만들지 않는다. AI는 한글 이름 후보를 제안하고, 서버는 각 후보의 발음오행을
// 독립적으로 재계산해서 AI 응답을 검증한다.
import { getChart } from '../repositories/chart-repository.mjs';
import { getAnalysisScopeById, verifyAnalysisScopeOwnership, fillAnalysisScopeResultOnce } from '../repositories/analysis-scope-repository.mjs';
import { STEM_ELEMENT } from '../../../../packages/canonical/transform.mjs';
import { computeSoundElementDistribution } from '../../../../packages/shared/korean-sound-element.mjs';
import { buildNamingPrompt, NAMING_RESULT_SCHEMA, NAMING_SAFETY_DISCLOSURE_TEXT } from '../../../../packages/character/naming-prompt.mjs';

export class NamingError extends Error {
  constructor(code, message) {
    super(message);
    this.code = code;
  }
}

export function computeStemElementDistribution(pillars) {
  const distribution = { wood: 0, fire: 0, earth: 0, metal: 0, water: 0 };
  for (const pillar of pillars ?? []) {
    const element = STEM_ELEMENT[pillar.heavenly_stem];
    if (element) distribution[element] += 1;
  }
  return distribution;
}

export async function evaluateNamingCandidates({ surname, gender, stemElementDistribution, aiProvider }) {
  const aiResult = await aiProvider.complete({
    system: buildNamingPrompt(),
    user: `성씨: ${surname}\n성별: ${gender}\n사주 천간 오행 분포(참고용): ${JSON.stringify(stemElementDistribution)}`,
    jsonSchema: NAMING_RESULT_SCHEMA,
    schemaName: 'naming_result',
  });

  const verifiedCandidates = aiResult.data.candidates.map((c) => ({
    ...c,
    verified_sound_element: computeSoundElementDistribution(c.name),
  }));

  return {
    candidates: verifiedCandidates,
    overall_note: aiResult.data.overall_note,
    surname,
    stem_element_distribution: stemElementDistribution,
    safety_disclosure: NAMING_SAFETY_DISCLOSURE_TEXT,
    usage: aiResult.usage,
  };
}

export async function getOrGenerateNamingResult({ analysisScopeId, userId, aiProvider }) {
  const scope = await verifyAnalysisScopeOwnership(analysisScopeId, userId);
  if (scope.analysis_type !== 'NAMING') {
    throw new NamingError('NOT_NAMING_SCOPE', '작명 분석이 아닙니다.');
  }
  if (scope.result_data) {
    return { resultData: scope.result_data, generatedNow: false };
  }
  if (!scope.naming_params?.surname) {
    throw new NamingError('PARAMS_NOT_FOUND', '작명에 필요한 성씨 정보를 찾을 수 없습니다.');
  }
  if (!scope.chart_id) {
    throw new NamingError('SUBJECT_NOT_FOUND', '대상 chart를 찾을 수 없습니다.');
  }
  if (!aiProvider) {
    throw new NamingError('PROVIDER_NOT_CONFIGURED', 'AI 모델이 설정되지 않았습니다.');
  }

  const chart = await getChart(scope.chart_id);
  if (!chart) throw new NamingError('SUBJECT_NOT_FOUND', '대상 chart를 찾을 수 없습니다.');

  const stemElementDistribution = computeStemElementDistribution(chart.canonical.saju?.pillars);
  const gender = chart.canonical.subject?.gender ?? 'unknown';

  const evaluation = await evaluateNamingCandidates({
    surname: scope.naming_params.surname,
    gender,
    stemElementDistribution,
    aiProvider,
  });

  const filled = await fillAnalysisScopeResultOnce(analysisScopeId, evaluation);
  if (!filled) {
    const latest = await getAnalysisScopeById(analysisScopeId);
    return { resultData: latest.result_data, generatedNow: false };
  }
  return { resultData: evaluation, generatedNow: true };
}
