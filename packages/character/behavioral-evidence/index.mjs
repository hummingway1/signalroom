// packages/character/behavioral-evidence/index.mjs
//
// 12개 정적 evidence를 모아서 matching 함수를 제공한다. 매 대화마다 검색/추가 LLM 호출을 하지
// 않는다 — child context의 trait(dominant ten_god_dominance)와 사용자 질문 텍스트의 키워드로만
// 매칭한다. 단순 키워드 하나만으로 과도하게 매칭하지 않도록, trait 일치 시 가중치를 더 준다.

import { AUTONOMY_SUPPORT } from './autonomy-support.mjs';
import { EMOTION_COACHING } from './emotion-coaching.mjs';
import { POSITIVE_REINFORCEMENT } from './positive-reinforcement.mjs';
import { AUTHORITATIVE_PARENTING } from './authoritative-parenting.mjs';
import { PARENTAL_RESPONSIVENESS } from './parental-responsiveness.mjs';
import { SCAFFOLDING } from './scaffolding.mjs';
import { GROWTH_MINDSET } from './growth-mindset.mjs';
import { PSYCHOLOGICAL_CONTROL } from './psychological-control.mjs';
import { INTRINSIC_MOTIVATION } from './intrinsic-motivation.mjs';
import { PEER_RELATIONS } from './peer-relations.mjs';
import { COMPARISON_CONTROL } from './comparison-control.mjs';
import { FAILURE_FRUSTRATION } from './failure-frustration.mjs';

export const BEHAVIORAL_EVIDENCE_LIST = [
  AUTONOMY_SUPPORT, EMOTION_COACHING, POSITIVE_REINFORCEMENT, AUTHORITATIVE_PARENTING,
  PARENTAL_RESPONSIVENESS, SCAFFOLDING, GROWTH_MINDSET, PSYCHOLOGICAL_CONTROL,
  INTRINSIC_MOTIVATION, PEER_RELATIONS, COMPARISON_CONTROL, FAILURE_FRUSTRATION,
];

/**
 * child의 우세 성향(dominantTrait, 예: 'self-directed')과 부모의 질문 텍스트로 관련 evidence를
 * 찾는다. 키워드 일치 개수 + trait 일치 보너스로 점수를 매겨 가장 높은 것 하나만 반환한다.
 * 매칭되는 게 없으면 null(=이번 답변엔 행동과학 근거를 억지로 붙이지 않음, §8 원칙).
 *
 * @param {string} questionText
 * @param {string|null} dominantTrait
 * @returns {object|null}
 */
export function matchBehavioralEvidence(questionText, dominantTrait) {
  let best = null;
  let bestScore = 0;
  for (const evidence of BEHAVIORAL_EVIDENCE_LIST) {
    const keywordHits = evidence.match_keywords.filter((kw) => questionText.includes(kw)).length;
    if (keywordHits === 0) continue; // 키워드가 하나도 안 맞으면 후보에서 제외(과매칭 방지)
    const traitBonus = dominantTrait && evidence.match_traits.includes(dominantTrait) ? 1 : 0;
    const score = keywordHits + traitBonus;
    if (score > bestScore) {
      bestScore = score;
      best = evidence;
    }
  }
  return best;
}

export function getEvidenceById(id) {
  return BEHAVIORAL_EVIDENCE_LIST.find((e) => e.id === id) ?? null;
}
