// packages/ai/providers/mock-provider.mjs
//
// Deterministic mock provider — no network calls. Used for:
//   - all automated tests (spec §16 "실제 OpenAI API 키가 없어도 테스트할 수
//     있도록 mock provider를 만든다")
//   - local `npm run dev` when OPENAI_API_KEY is not set (see
//     packages/ai/create-provider.mjs)
//
// Supports injectable failure modes so error-handling paths (refusal,
// malformed JSON, simulated network/API failure) can be tested without a
// real API.

import { BaseAIProvider } from './base-provider.mjs';
import { AIProviderError } from './openai-provider.mjs';
import { QUESTION_CATEGORIES } from '../../shared/categories.mjs';

/**
 * Very small keyword -> category/fields mapping so mock routing behaves
 * sensibly in tests without needing a real model. Not meant to be a real
 * classifier — see prompts/runtime/question-router.md for the real logic
 * an actual model call follows.
 */
const KEYWORD_RULES = [
  { keywords: ['사업', '창업', '자영업'], categories: ['BUSINESS', 'CAREER', 'MONEY', 'DECISION'], saju: ['day_master', 'pillars', 'major_periods'], ziwei: ['palaces', 'major_periods'], palaces: ['career', 'wealth', 'travel', 'friends'] },
  { keywords: ['돈', '재물', '재테크', '투자'], categories: ['MONEY'], saju: ['pillars', 'day_master'], ziwei: ['palaces'], palaces: ['wealth', 'property', 'fortune'] },
  { keywords: ['직장', '이직', '커리어', '취업', '직업'], categories: ['CAREER', 'DECISION'], saju: ['pillars', 'major_periods'], ziwei: ['palaces', 'major_periods'], palaces: ['career', 'travel'] },
  { keywords: ['결혼', '배우자', '연애', '남자친구', '여자친구'], categories: ['LOVE', 'MARRIAGE'], saju: ['pillars', 'relations'], ziwei: ['palaces'], palaces: ['spouse'] },
  { keywords: ['인간관계', '친구', '대인관계'], categories: ['RELATIONSHIP', 'PERSONALITY'], saju: ['pillars', 'special_stars'], ziwei: ['palaces'], palaces: ['friends', 'siblings', 'fortune'] },
  { keywords: ['성격', '기질'], categories: ['PERSONALITY'], saju: ['day_master', 'pillars', 'special_stars'], ziwei: ['life_palace', 'body_palace', 'palaces'], palaces: ['life', 'fortune'] },
  { keywords: ['건강', '몸'], categories: ['HEALTH_LIFESTYLE'], saju: ['pillars', 'relations'], ziwei: ['palaces'], palaces: ['health'] },
  { keywords: ['대운', '올해', '이번 해', '내년'], categories: ['MAJOR_PERIOD', 'ANNUAL_PERIOD'], saju: ['major_periods', 'annual_periods'], ziwei: ['major_periods'], palaces: [] },
  { keywords: ['귀문관살', '귀문'], categories: ['PERSONALITY', 'RELATIONSHIP'], saju: ['pillars', 'special_stars'], ziwei: [], palaces: [] },
];

// "2027년" 같은 명시적 연도 언급도 세운(annual_periods) 트리거로 인식 — targeted-quality
// TEST1/TEST3처럼 특정 연도를 직접 지목하는 질문의 mock 라우팅 미리보기를 더 유용하게 만든다.
// (실제 GPT 라우터는 이 정규식 없이도 question-router.md 프롬프트만으로 판단하므로, 이건 어디까지나
// mock 미리보기 정확도를 높이기 위한 보조 규칙이지 실제 모델 행동을 흉내내려는 시도는 아니다.)
const EXPLICIT_YEAR_PATTERN = /20[2-4]\d년/;

// System-scope detection: does the question explicitly name one or both
// interpretive systems, or ask for a comparison between them? This lets the
// mock provider exercise (and tests verify) the three routing modes the
// spec requires (§8-10 of the latest request):
//   사주만 필요한 질문 -> saju만 추출 / 자미두수만 필요한 질문 -> ziwei만 추출 /
//   비교·교차 질문 -> 둘 다 추출.
const SAJU_NAME_WORDS = ['사주', '팔자', '명리'];
const ZIWEI_NAME_WORDS = ['자미두수', '자미', '명궁', '신궁'];
const COMPARISON_WORDS = ['비교', '각각', '둘 다', '둘다', '동시에', '차이가', '같은 결과', '다르니', '다를까', '다른지'];

function detectSystemScope(questionText) {
  const mentionsSaju = SAJU_NAME_WORDS.some((w) => questionText.includes(w));
  const mentionsZiwei = ZIWEI_NAME_WORDS.some((w) => questionText.includes(w));
  const mentionsComparison = COMPARISON_WORDS.some((w) => questionText.includes(w));

  if (mentionsComparison) return 'both'; // explicit comparison always pulls both
  if (mentionsSaju && !mentionsZiwei) return 'saju_only';
  if (mentionsZiwei && !mentionsSaju) return 'ziwei_only';
  if (mentionsSaju && mentionsZiwei) return 'both';
  return null; // no explicit system named — fall through to topic-based defaults (both, as today)
}

function classify(questionText) {
  const matched = KEYWORD_RULES.filter((rule) => rule.keywords.some((kw) => questionText.includes(kw)));
  const scope = detectSystemScope(questionText);
  const mentionsExplicitYear = EXPLICIT_YEAR_PATTERN.test(questionText);

  if (matched.length === 0 && !mentionsExplicitYear) {
    const base = { categories: ['GENERAL'], saju_fields: ['day_master', 'pillars'], ziwei_fields: ['life_palace', 'palaces'], ziwei_palace_focus: ['life'] };
    return applyScope(base, scope);
  }
  const categories = [...new Set(matched.flatMap((r) => r.categories))].filter((c) => QUESTION_CATEGORIES.includes(c));
  const saju_fields = [...new Set(matched.flatMap((r) => r.saju))];
  const ziwei_fields = [...new Set(matched.flatMap((r) => r.ziwei))];
  const ziwei_palace_focus = [...new Set(matched.flatMap((r) => r.palaces))];

  if (mentionsExplicitYear) {
    if (!categories.includes('ANNUAL_PERIOD')) categories.push('ANNUAL_PERIOD');
    if (!saju_fields.includes('annual_periods')) saju_fields.push('annual_periods');
    if (!saju_fields.includes('major_periods')) saju_fields.push('major_periods');
  }

  return applyScope({ categories, saju_fields, ziwei_fields, ziwei_palace_focus }, scope);
}

function applyScope(routed, scope) {
  if (scope === 'saju_only') return { ...routed, ziwei_fields: [], ziwei_palace_focus: [] };
  if (scope === 'ziwei_only') return { ...routed, saju_fields: [] };
  // 'both' or null (topic-based default already includes both when relevant) — no change needed.
  return routed;
}

export class MockAIProvider extends BaseAIProvider {
  /**
   * @param {object} opts
   * @param {'default'|'refusal'|'malformed'|'network_error'|'api_error'} [opts.failureMode]
   */
  constructor({ failureMode = 'default' } = {}) {
    super();
    this.failureMode = failureMode;
    this.callLog = [];
  }

  async complete({ system, user, jsonSchema, schemaName }) {
    this.callLog.push({ schemaName, userLength: user.length });

    if (this.failureMode === 'network_error') {
      throw new AIProviderError('NETWORK_ERROR', 'MOCK: simulated network failure');
    }
    if (this.failureMode === 'api_error') {
      throw new AIProviderError('API_ERROR', 'MOCK: simulated API error (HTTP 500)', { status: 500 });
    }
    if (this.failureMode === 'refusal') {
      throw new AIProviderError('REFUSAL', 'MOCK: model declined to answer this request');
    }
    if (this.failureMode === 'malformed') {
      throw new AIProviderError('MALFORMED_JSON', 'MOCK: response was not valid JSON');
    }

    const usage = { input_tokens: Math.ceil(user.length / 4), output_tokens: 200, total_tokens: Math.ceil(user.length / 4) + 200, cached_input_tokens: 0, reasoning_tokens: 0 };

    if (schemaName === 'question_router') {
      // Extract the raw question text from the user prompt (mock convention:
      // pipeline puts it after "QUESTION:" — see pipeline.mjs).
      const match = user.match(/QUESTION:\s*([\s\S]*?)(\n\n|$)/);
      const questionText = match ? match[1] : user;
      const routed = classify(questionText);
      return {
        data: { ...routed, reasoning: 'MOCK: keyword-based classification for testing.' },
        usage,
        raw: { mock: true },
      };
    }

    if (schemaName === 'saju_ziwei_cross_response') {
      return {
        data: {
          saju: { relevant_structure: '[MOCK] 추출된 사주 필드 기반 구조 요약.', interpretation: '[MOCK] 사주 관점 해석 텍스트.' },
          ziwei: { relevant_structure: '[MOCK] 추출된 자미두수 필드 기반 구조 요약.', interpretation: '[MOCK] 자미두수 관점 해석 텍스트.' },
          cross_analysis: {
            common_direction: '[MOCK] 두 체계가 공통적으로 가리키는 방향.',
            differences: '[MOCK] 두 체계 간 차이.',
            overall_judgment: '[MOCK] 종합 판단 (단정적 예언 아님).',
            real_world_checks: '[MOCK] 현실에서 확인할 조건.',
          },
          response: '[MOCK RESPONSE] 이것은 MockAIProvider가 생성한 테스트용 답변입니다. 실제 OpenAI API 키를 설정하면 진짜 분석으로 대체됩니다.',
          sources: { saju: ['pillars'], ziwei: ['palaces'] },
          highlight_card: null,
        },
        usage,
        raw: { mock: true },
      };
    }

    if (schemaName === 'casual_reaction') {
      const MOCK_CASUAL_REACTIONS = ['오, 그렇구나 🐱 (mock)', 'ㅋㅋㅋ 그건 좀 웃기다 (mock)', '헐 진짜? (mock)'];
      return {
        data: { reaction: MOCK_CASUAL_REACTIONS[Math.floor(Math.random() * MOCK_CASUAL_REACTIONS.length)] },
        usage,
        raw: { mock: true },
      };
    }

    if (schemaName === 'birth_selection_first_pass') {
      // user 프롬프트 안에 실제 후보 데이터(JSON 배열, candidate_id 포함)가 박혀있다 — 그걸
      // 파싱해서 실제로 존재하는 candidate_id만 갖고 결정론적 tier를 배분한다(전체의 대략
      // 앞쪽 25%를 A로, 나머지를 B/C로 — 실제 관계형 데이터의 개수 등으로 살짝 변주해서
      // "전부 같은 값"이 되는 뻔한 Mock을 피한다).
      const jsonMatch = user.match(/\[.*\]/s);
      const candidates = jsonMatch ? JSON.parse(jsonMatch[0]) : [];
      const cutoff = Math.max(1, Math.ceil(candidates.length * 0.25));
      const evaluations = candidates.map((c, i) => {
        const relationCount = (c.saju?.relations?.pillar_pairs?.length ?? 0) + (c.saju?.relations?.triple_combinations?.length ?? 0);
        const tier = i < cutoff ? 'A' : relationCount > 0 ? 'B' : 'C';
        return {
          candidate_id: c.candidate_id,
          relative_tier: tier,
          strengths: ['[MOCK] 상대적으로 안정적인 구성'],
          concerns: relationCount > 0 ? ['[MOCK] 일부 합충 관계 존재'] : [],
          comparison_signals: ['[MOCK] 비교 신호'],
        };
      });
      return { data: { evaluations }, usage, raw: { mock: true } };
    }

    if (schemaName === 'birth_selection_second_pass') {
      const jsonMatch = user.match(/\[.*\]/s);
      const candidates = jsonMatch ? JSON.parse(jsonMatch[0]) : [];
      const top1 = candidates[0];
      const rest = candidates.slice(1, 5);
      return {
        data: {
          top1: { candidate_id: top1.candidate_id, final_reason: '[MOCK] 다른 후보에 비해 상대적으로 균형 잡힌 구조로 볼 수 있습니다.', strengths: ['[MOCK] 강점1'], concerns: [] },
          top2to5: rest.map((c, i) => ({ candidate_id: c.candidate_id, relative_rank: i + 2, strengths: ['[MOCK] 강점'], concerns: [], how_it_differs_from_top1: '[MOCK] 1위와의 차이점' })),
          candidate_comparison: candidates.map((c) => ({ candidate_id: c.candidate_id, vs_top1_summary: '[MOCK] 1위 대비 요약' })),
        },
        usage,
        raw: { mock: true },
      };
    }

    if (schemaName === 'date_selection_chat') {
      return { data: { response: '[MOCK] 제공된 분석 결과를 바탕으로 답변드립니다. 자세한 내용은 실제 분석 결과를 참고해주세요.' }, usage, raw: { mock: true } };
    }

    // Unknown schema name — still return something schema-shaped-ish for safety.
    return { data: {}, usage, raw: { mock: true } };
  }
}
