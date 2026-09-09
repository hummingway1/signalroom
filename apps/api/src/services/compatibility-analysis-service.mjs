// apps/api/src/services/compatibility-analysis-service.mjs
//
// §최종 상품 정책 §2 — 기본 궁합(990원, Luna) / 상세 궁합(4900원, Terra). 기존
// `/api/compatibility`(엔터테인먼트 콘텐츠, AI 없음, 무료 유지)와는 완전히 별개의 새 AI 기반
// 분석이다. packages/chart-engine/compatibility-analysis.mjs의 analyzeCompatibilityFact가
// 이미 계산해둔 실제 사실(raw/features)만 AI에게 넘긴다 — AI는 이 데이터 밖의 관계(합충형파해,
// 십신 등)를 임의로 만들어내지 않는다. child-profile-service.mjs의 tier 분기 패턴을 그대로 재사용.
import { analyzeCompatibilityFact } from '../../../../packages/chart-engine/compatibility-analysis.mjs';

function buildSystemPrompt(tier) {
  return `너는 두 사람의 사주 궁합을 설명하는 역할이야.
아래에 주어진 실제 계산 데이터(원국 관계, 오행 보완도 등)에 있는 내용만 사용해서 설명해.
데이터에 없는 합/충/형/파/해, 십신 관계, 오행 정보를 절대 지어내지 않는다.
"천생연분", "악연", "용신", "신강", "신약" 같은 전문 용어나 과도하게 단정적인 표현을 쓰지 않는다.
"반드시 잘 맞는다", "무조건 헤어진다" 같은 확정적 예언을 하지 않는다 — "~한 경향이 있다",
"~부분을 살펴볼 수 있다" 같은 명리학적 가능성/경향으로 표현한다.
${tier === 'full'
    ? '이건 상세 분석이니, 제공된 데이터의 여러 항목(끌림/소통/정서적 안정/보완도/자극/마찰가능성/로맨스 케미)을 골고루 참고해서 조금 더 자세하게 설명해.'
    : '이건 기본 분석이니, 제공된 데이터 중 가장 특징적인 부분 위주로 짧고 간단하게 설명해.'}
마크다운 기호나 이모지를 쓰지 않는다.`;
}

function buildUserPrompt(features) {
  return `두 사람의 실제 계산된 궁합 데이터:\n${JSON.stringify(features)}`;
}

const RESPONSE_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['summary'],
  properties: {
    summary: { type: 'string', description: '두 사람의 궁합에 대한 설명' },
  },
};

/**
 * @param {object} chartA - Canonical Chart(§saju 포함)
 * @param {object} chartB - Canonical Chart(§saju 포함)
 * @param {'basic'|'full'} tier
 * @param {object} aiProvider - tier에 맞는 provider(basic=Luna, full=Terra)를 호출부가 이미 선택해서 넘긴다
 */
export async function generateCompatibilityAnalysis({ chartA, chartB, tier, aiProvider }) {
  const { raw, features } = analyzeCompatibilityFact(chartA.saju, chartB.saju);

  if (!aiProvider) {
    // API 키 미설정 시 MockAIProvider가 대신 처리 — 여기서 임의로 실제 응답을 만들어내지 않는다.
    return { summary: null, raw, features };
  }

  const result = await aiProvider.complete({
    system: buildSystemPrompt(tier),
    user: buildUserPrompt(features),
    jsonSchema: RESPONSE_SCHEMA,
    schemaName: 'compatibility_analysis',
  });

  return { summary: result.data.summary, raw, features, usage: result.usage };
}
