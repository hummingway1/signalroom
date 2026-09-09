// packages/knowledge/index.mjs
//
// 지식베이스 통합 + rule-based retrieval. 임베딩/벡터DB 없음(§17 원칙 — 처음부터 복잡한 시스템을
// 만들지 않는다) — 키워드 직접 매칭 + Canonical 데이터에 실제로 존재하는 값 매칭 두 가지로 충분히
// 정확한 검색이 가능하다(십신/신살/주성 이름이 Canonical JSON에 이미 정확한 한자로 들어있으므로).
//
// 중요한 안전 원칙: retrieveKnowledge()는 "명반에 실제로 존재하는 것"과 "질문에 직접 언급된 것"만
// 반환한다. 계산 엔진이 애초에 계산하지 않는 항목(canonical_field: null인 신살류)은 명반 존재 여부를
// 확인할 방법이 없으므로, 질문에 직접 언급된 경우에만 검색되고 — 그 청크 자체의 content가 이미
// "이건 성향 지표일 뿐 단정 근거가 아니다"는 톤을 갖고 있어 safety.md/원본의 "계산 안 된 데이터는
// 지어내지 않는다" 원칙과 자연스럽게 맞물린다.

import { SAJU_TEN_GOD_CHUNKS } from './saju-ten-gods.mjs';
import { SAJU_SINSAL_CHUNKS } from './saju-sinsal.mjs';
import { ZIWEI_MAIN_STAR_CHUNKS } from './ziwei-main-stars.mjs';
import { ZIWEI_AUXILIARY_STAR_CHUNKS } from './ziwei-auxiliary-stars.mjs';

export const ALL_KNOWLEDGE_CHUNKS = [
  ...SAJU_TEN_GOD_CHUNKS,
  ...SAJU_SINSAL_CHUNKS,
  ...ZIWEI_MAIN_STAR_CHUNKS,
  ...ZIWEI_AUXILIARY_STAR_CHUNKS,
];

const MAX_CHUNKS_RETURNED = 3; // 비용 관리 — 관련도 높은 것만. 질문 1건당 대략 300~700 토큰 증가 예상.

// 카탈로그 kind가 이 목록에 있으면 검색 자체를 스킵한다 — 단순 동의/확인 turn에 지식 청크를 끼워
//넣는 건 대화 흐름에 도움이 안 되고 토큰만 늘린다(§10 비용 최적화, §17 원칙).
const SKIP_KNOWLEDGE_FOR_KINDS = new Set(['confirmation', 'agreement']);

function isSpecialStarPresent(specialStars, canonicalField) {
  if (!specialStars || !canonicalField) return false;
  const value = specialStars[canonicalField];
  if (typeof value === 'boolean') return value;
  if (Array.isArray(value)) return value.length > 0; // yangin/dohwa/[...]/gwimun(객체 배열) 전부 커버
  return false;
}

/** 추출된 Canonical 데이터에 실제로 등장하는 한자 용어(십신/주성 이름) 전부 수집 — "명반에 실제로
 * 있는 것"만 청크 매칭에 쓰기 위함(지어내지 않기 위한 안전장치). */
function collectPresentHanjaTerms(extracted) {
  const terms = new Set();
  for (const p of extracted?.saju?.pillars ?? []) {
    if (p.ten_god?.stem) terms.add(p.ten_god.stem);
    if (p.ten_god?.branch) terms.add(p.ten_god.branch);
  }
  for (const mp of extracted?.saju?.major_periods ?? []) {
    if (mp.ten_god?.stem) terms.add(mp.ten_god.stem);
    if (mp.ten_god?.branch) terms.add(mp.ten_god.branch);
  }
  for (const ap of extracted?.saju?.annual_periods ?? []) {
    if (ap.ten_god?.stem) terms.add(ap.ten_god.stem);
    if (ap.ten_god?.branch) terms.add(ap.ten_god.branch);
  }
  for (const p of extracted?.ziwei?.palaces ?? []) {
    for (const s of p.stars ?? []) if (s.name) terms.add(s.name);
  }
  return terms;
}

/**
 * @param {object} params
 * @param {string} params.questionText - 사용자 질문(자유 입력) 또는 catalog의 question_text
 * @param {object} params.extracted - runQuestionPipeline이 이미 추출한 canonical 데이터 (재계산 없음)
 * @param {string} [params.catalogKind] - catalog 선택인 경우 entry.kind (자유 입력이면 undefined)
 * @returns {Array} 관련도순 정렬된 지식 청크 (최대 MAX_CHUNKS_RETURNED개, 없으면 빈 배열)
 */
export function retrieveKnowledge({ questionText = '', extracted = {}, catalogKind } = {}) {
  if (catalogKind && SKIP_KNOWLEDGE_FOR_KINDS.has(catalogKind)) return [];

  const presentHanjaTerms = collectPresentHanjaTerms(extracted);
  const specialStars = extracted?.saju?.special_stars;

  const directMentions = [];
  const canonicalFieldMatches = []; // 명반에 실제로 존재하는 특수 신살(귀문관살 등) — 드물고 정보 가치가 높음
  const hanjaTermMatches = []; // 십신/주성 이름 매칭 — 4주마다 항상 존재해서 매우 흔함
  for (const chunk of ALL_KNOWLEDGE_CHUNKS) {
    if (chunk.match_terms.some((t) => questionText.includes(t))) {
      directMentions.push(chunk);
      continue;
    }
    if (chunk.canonical_field && isSpecialStarPresent(specialStars, chunk.canonical_field)) {
      canonicalFieldMatches.push(chunk);
    } else if (chunk.match_terms.some((t) => presentHanjaTerms.has(t))) {
      hanjaTermMatches.push(chunk);
    }
  }

  // 질문에 직접 언급된 개념이 있으면 그것만 우선 반환(노이즈 감소 — "귀문관살 있어?"에 무관한 십신
  // 청크가 딸려오지 않도록). 직접 언급이 없을 때는 명반 존재 기반으로 보충하되, 흔한 십신보다
  // 드물고 특별한 신살(canonical_field 매칭)을 먼저 채운다 — 안 그러면 항상 존재하는 십신 3개가
  // 배열 순서상 먼저 슬라이스되어, 실제로 있는 귀문관살 같은 중요한 정보가 밀려나는 버그가 있었다
  // (실사용 리포트로 발견: 귀문관살이 실제로 있는 명반인데도 검색 결과에 전혀 안 나옴).
  const prioritized = directMentions.length > 0 ? directMentions : [...canonicalFieldMatches, ...hanjaTermMatches];
  return prioritized.slice(0, MAX_CHUNKS_RETURNED);
}

/** 검색된 청크를 analysisUser 프롬프트에 넣을 텍스트 블록으로 변환. */
export function formatKnowledgeContext(chunks) {
  if (!chunks || chunks.length === 0) return '';
  const lines = chunks.map((c) => `- [${c.concept}] ${c.content}${c.school_dependent ? ' (유파에 따라 기준이 다를 수 있음)' : ''}`);
  return [
    'RELEVANT_KNOWLEDGE (참고 근거 — 그대로 인용하지 말고 사용자 상황과 명반에 맞게 재구성해서 쓸 것. ',
    '이 자료 자체가 계산 결과를 대체하지 않는다 — 위 EXTRACTED_CANONICAL_DATA에 있는 값만 사실로 취급할 것):\n',
    lines.join('\n'),
  ].join('');
}
