// apps/api/src/services/child-profile-service.mjs
//
// child-growth-analysis.mjs(순수 계산 함수)를 실제로 실행해서 결과를 저장하는 오케스트레이션
// 레이어. 이번 단계는 결제를 검사하지 않는다 — "분석 생성 API"와 "결제 승인 API"를 의도적으로
// 분리해서, 나중에 결제 시스템이 이 함수 호출 앞단에 승인 검사만 추가하면 되게 설계했다.
import { getChildProfile } from '../repositories/child-profile-repository.mjs';
import { getChart } from '../repositories/chart-repository.mjs';
import { createPurchasedAnalysis, listPurchasedAnalysesForChild, hasUsedFreeChildAnalysis } from '../repositories/purchased-analysis-repository.mjs';
import { upsertAIProfileContext, getAIProfileContextByChildId } from '../repositories/ai-profile-context-repository.mjs';
import { analyzeChildGrowth, CHILD_GROWTH_ANALYSIS_METHOD } from '../../../../packages/chart-engine/child-growth-analysis.mjs';
import { sanitizeUserFacingText } from '../../../../packages/shared/sanitize-output.mjs';

/**
 * child-growth-analysis.mjs의 결과(core_signals/parent_actions/caution)를 AIProfileContext
 * 병합용 patch로 변환한다. v3(태그형): observable_patterns/scene_examples/parent_strategy_examples
 * 각 항목이 이제 {text, concept_tags|situation_tags} 객체다 — 그대로 옮긴다(가공 없음). 태그는
 * casual-chat-prompt.mjs의 relevance/depth 엔진이 1차 필터로 사용한다. why_fact는 여전히
 * parent_approach에 포함하지 않는다(승인된 원칙, evidence_refs 추적에만 사용).
 *
 * §1 "학습환경/학교생활 콘텐츠 아직 없음": 이번 product_type('child_growth')에는 관록궁/교우궁 관련
 * 데이터가 없으므로 learning_context/social_context는 빈 배열로 남긴다(억지로 채우지 않음).
 */
function buildContextPatchFromAnalysis(analysisResult, analysisId) {
  const evidenceRefs = [];
  const parentApproach = analysisResult.parent_actions.map((a) => {
    evidenceRefs.push(...a.fact_ref);
    return {
      category: a.category,
      trait_signal: a.trait_signal,
      observable_patterns: a.observable_patterns, // [{text, concept_tags}]
      scene_examples: a.scene_examples, // [{text, situation_tags}]
      parent_strategy_examples: a.parent_strategy_examples, // [{text, situation_tags}]
      caution_note: a.caution_note,
      signal_kind: a.signal_kind ?? null,
    };
  });
  const cautionPoints = analysisResult.caution.map((c) => {
    evidenceRefs.push(...c.fact_ref);
    return { observable_pattern: c.observable_pattern, concept_tags: c.concept_tags ?? [], fact_ref: c.fact_ref };
  });
  for (const key of ['ten_god_dominance', 'life_palace_stars', 'five_element_distribution']) {
    evidenceRefs.push(...(analysisResult.core_signals[key]?.fact_ref ?? []));
  }

  return {
    core_traits: {
      ten_god_dominance: analysisResult.core_signals.ten_god_dominance.direction,
      life_palace_stars: analysisResult.core_signals.life_palace_stars.names_hangul,
      five_element_distribution: analysisResult.core_signals.five_element_distribution.counts,
    },
    parent_approach: parentApproach,
    learning_context: [], // 학습환경 상품 미구현 — 억지로 채우지 않음
    social_context: [], // 학교생활 상품 미구현 — 억지로 채우지 않음
    caution_points: cautionPoints,
    observation_points: [], // v2에서 폐지된 필드, 하위 호환을 위해 빈 배열 유지
    evidence_refs: evidenceRefs,
    source_analysis_ids: [analysisId],
  };
}

/**
 * child_profile의 chart로 자녀 성장 분석을 실제 실행하고, 결과를 PurchasedAnalysis로 불변 저장한
 * 뒤, AIProfileContext를 생성/병합한다. 결제 승인 여부는 이 함수 호출자(route)가 향후 검사한다 —
 * 이 함수 자체는 결제를 모른다.
 */
export async function generateChildGrowthAnalysis({ childProfileId, userId, tier = 'basic' }) {
  const profile = await getChildProfile(childProfileId);
  if (!profile) {
    const err = new Error(`Child profile not found: ${childProfileId}`);
    err.code = 'CHILD_PROFILE_NOT_FOUND';
    throw err;
  }
  if (profile.user_id !== userId) {
    const err = new Error('이 자녀 프로필에 접근할 권한이 없습니다.');
    err.code = 'FORBIDDEN';
    throw err;
  }

  // §11 — 무료 기본 사주는 사용자 ID당 1회, 서버 측에서 강제(프론트 버튼 숨김만으로 대체하지 않음).
  if (tier === 'basic') {
    const alreadyUsed = await hasUsedFreeChildAnalysis(userId);
    if (alreadyUsed) {
      const err = new Error('무료 기본 사주는 이미 사용하셨습니다.');
      err.code = 'FREE_TIER_EXHAUSTED';
      throw err;
    }
  }

  const chart = await getChart(profile.chart_id);
  if (!chart) {
    const err = new Error(`Chart not found for child profile: ${profile.chart_id}`);
    err.code = 'CHART_NOT_FOUND';
    throw err;
  }

  const analysisResult = analyzeChildGrowth(chart.canonical);

  const purchasedAnalysis = await createPurchasedAnalysis({
    userId,
    childId: childProfileId,
    productType: 'child_growth',
    tier, // 'basic'(무료 1회, gpt-5.6-luna) | 'full'(유료, gpt-5.6-terra) — §12/§20
    purchaseId: null, // 이번 단계는 결제 미구현
    canonicalChartVersion: chart.canonical?.saju?.calculation_provenance?.source ?? null,
    analysisEngineVersion: CHILD_GROWTH_ANALYSIS_METHOD,
    analysisJson: analysisResult, // 원본 그대로, 불변 저장(§1)
  });

  const patch = buildContextPatchFromAnalysis(analysisResult, purchasedAnalysis.id);
  const context = await upsertAIProfileContext(childProfileId, patch);

  return { purchasedAnalysis, context };
}

/**
 * §20 — 기본(무료)은 gpt-5.6-luna, 전체(유료)는 gpt-5.6-terra를 실제로 구분해서 쓰는 지점.
 * child-growth-analysis.mjs의 파편(JSON)을 그대로 화면에 보여주지 않고, LLM 1회 호출로 부모가
 * 읽을 수 있는 자연스러운 요약 텍스트로 바꾼다. §16 출력 새니타이즈도 여기서 적용.
 */
const CATEGORY_LABELS = {
  '선택권부여': '스스로 정하고 싶어하는 부분',
  '표현활동제공': '표현하고 만들어보는 걸 편해하는 부분',
  '구조명확화': '규칙과 순서가 있을 때 편안해하는 부분',
  '결과물제공': '결과가 눈에 보일 때 동기부여되는 부분',
  '준비시간확보': '새로운 상황엔 준비 시간이 필요한 부분',
  '경험다양성': '새로운 경험을 접해보면 좋을 부분',
};

/**
 * §2(가독성) — 결과를 하나로 뭉친 텍스트가 아니라 category별 섹션으로 구조화해서 반환한다.
 * 프론트가 섹션별 제목+본문으로 나눠 보여줄 수 있게 { sections: [{ title, body }] } 형태.
 * '근거보강' 카테고리(슬롯4, 내부 신뢰도 메타데이터라 텍스트 없음)는 사용자 화면에서 제외.
 */
export async function summarizeChildAnalysisForDisplay({ analysisResult, tier, aiProvider }) {
  const sections = analysisResult.parent_actions
    .filter((a) => CATEGORY_LABELS[a.category]) // 근거보강 등 내부 전용 카테고리 제외
    .slice(0, tier === 'full' ? 6 : 2) // 무료(basic)는 짧게, 유료(full)는 더 자세히
    .map((a) => ({
      category: a.category,
      title: CATEGORY_LABELS[a.category],
      fragments: [...(a.observable_patterns ?? []).map((o) => o.text), ...(a.scene_examples ?? []).map((s) => s.text), ...(a.parent_strategy_examples ?? []).map((p) => p.text)],
    }));

  if (!aiProvider) {
    // API 키 미설정 시 MockAIProvider가 대신 처리 — 여기서 임의로 실제 응답을 만들어내지 않는다.
    return sections.map((s) => ({ title: s.title, body: sanitizeUserFacingText(s.fragments.join(' ')) }));
  }

  const system = `너는 아이의 사주 분석 결과를 부모에게 자연스럽게 설명하는 역할이야.
각 섹션의 재료(관찰 포인트, 장면, 대사 예시)를 바탕으로 그 섹션에 해당하는 내용만 ${tier === 'full' ? '조금 더 자세하게' : '짧고 간단하게'} 설명해.
사주가 아이의 행동을 증명한다고 단정하지 않는다. "이 아이는 ~한 성향입니다" 같은 설명형 문장 대신
실제 생활에서 확인할 수 있는 장면으로 풀어서 말한다. 마크다운 기호나 이모지를 쓰지 않는다.
각 섹션은 서로 다른 내용이어야 하고, 같은 말을 반복하지 않는다.
아래 재료 앞에 붙은 "섹션1(제목) 재료" 같은 표시는 너에게 전달하기 위한 내부 구분용일 뿐이다.
"섹션1", "섹션 2" 같은 라벨이나 번호를 답변 본문에 절대 그대로 옮기지 않는다.
각 섹션의 제목도 이미 화면에 별도로 표시되므로, 답변 본문 첫 줄에 제목을 다시 반복하지 않고
바로 내용으로 시작한다.`;
  const user = sections.map((s, i) => `섹션${i + 1}(${s.title}) 재료:\n${s.fragments.join('\n')}`).join('\n\n');
  const jsonSchema = {
    type: 'object',
    additionalProperties: false,
    required: ['sections'],
    properties: {
      sections: {
        type: 'array',
        items: { type: 'object', additionalProperties: false, required: ['body'], properties: { body: { type: 'string' } } },
      },
    },
  };
  const result = await aiProvider.complete({ system, user, jsonSchema, schemaName: 'child_analysis_summary' });
  return sections.map((s, i) => ({ title: s.title, body: sanitizeUserFacingText(result.data.sections[i]?.body ?? s.fragments.join(' ')) }));
}

export async function getChildContext(childProfileId, userId) {
  const profile = await getChildProfile(childProfileId);
  if (!profile) return { error: 'NOT_FOUND' };
  if (profile.user_id !== userId) return { error: 'FORBIDDEN' };
  const context = await getAIProfileContextByChildId(childProfileId);
  return { profile, context };
}

export async function listAnalysesForChild(childProfileId) {
  return listPurchasedAnalysesForChild(childProfileId);
}
