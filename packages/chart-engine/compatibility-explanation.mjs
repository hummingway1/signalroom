// packages/chart-engine/compatibility-explanation.mjs
//
// RANKING(compatibility-ranking.mjs) → EXPLANATION(이 파일)의 네 번째 계층. 순수 템플릿 함수로만
// 구성되어 있다 — AI 호출이 전혀 없다. 모든 문장은 raw fact(compatibility-analysis.mjs의 결과)를
// 그대로 조회해서 만들어지므로, 구조적으로 "raw fact에 없는 내용"을 생성할 수 없다.
//
// 한자 단독 출력 금지 원칙(승인된 설계 §14)을 지키기 위해 모든 명리 용어를 "한글(한자)" 상수로
// 관리한다 — 이 상수 테이블 밖의 문자열을 직접 이어붙이는 코드가 없으므로 한자 단독 출력이 애초에
// 불가능한 구조다.

const TERM = {
  '천간합': '천간합(天干合)',
  '육합': '육합(六合)',
  '沖': '충(沖)',
  '刑': '형(刑)',
  '破': '파(破)',
  '害': '해(害)',
  '怨嗔': '원진(怨嗔)',
  '鬼門': '귀문(鬼門)',
  '食神': '식신(食神)',
  '傷官': '상관(傷官)',
  '偏印': '편인(偏印)',
  '正印': '정인(正印)',
  '偏官': '편관(偏官)',
  '正官': '정관(正官)',
  '偏財': '편재(偏財)',
  '正財': '정재(正財)',
  '比肩': '비견(比肩)',
  '劫財': '겁재(劫財)',
};

import { eunNeun, iGa, eulReul } from '../shared/korean-particles.mjs';

const ELEMENT_TERM = { wood: '목(木)', fire: '화(火)', earth: '토(土)', metal: '금(金)', water: '수(水)' };
const PILLAR_TERM = { year: '년주', month: '월주', day: '일주', hour: '시주' };

function tenGodTerm(hanja) {
  return TERM[hanja] ?? hanja;
}

function pillarPairLabel(personAPillar, personBPillar) {
  return `${PILLAR_TERM[personAPillar] ?? personAPillar}-${PILLAR_TERM[personBPillar] ?? personBPillar}`;
}

// ============================================================
// why_recommended 후보 생성 — feature별로 실제 raw fact가 있을 때만 문장을 만든다.
// ============================================================

function buildAttractionReason(raw) {
  const stemCombine = raw.cross_pillar_relations.filter((r) => r.kind === 'stem' && r.relation === '合');
  const dayHarmony = raw.day_branch_relation.harmony;
  if (stemCombine.length === 0 && dayHarmony.length === 0) return null;

  const parts = [];
  if (stemCombine.length > 0) {
    const positions = stemCombine.map((r) => pillarPairLabel(r.personA_pillar, r.personB_pillar)).join(', ');
    parts.push(`${TERM['천간합']}이 ${stemCombine.length}곳(${positions})에서 확인되어 결합 신호가 나타납니다.`);
  }
  if (dayHarmony.length > 0) {
    parts.push('일지에서도 조화 관계가 함께 나타납니다.');
  }
  return {
    type: 'attraction',
    fact_ref: ['cross_pillar_relations', 'day_branch_relation'],
    text: parts.join(' '),
  };
}

function buildCommunicationReason(raw) {
  const branchHarmony = raw.cross_pillar_relations.filter((r) => r.kind === 'branch' && r.relation === '合');
  if (branchHarmony.length === 0) return null;
  const positions = branchHarmony.map((r) => pillarPairLabel(r.personA_pillar, r.personB_pillar)).join(', ');
  return {
    type: 'communication',
    fact_ref: ['cross_pillar_relations'],
    text: `${TERM['육합']}이 ${branchHarmony.length}곳(${positions})에서 확인되어 서로 편하게 표현할 수 있는 신호가 나타납니다.`,
  };
}

/** 오행 방향 설명 — 반드시 "누가 누구를 보완하는지" 명시(승인된 설계 §13). */
function buildComplementarityReason(raw, personALabel, personBLabel) {
  const complements = raw.five_element_complementarity.complements;
  if (complements.length === 0) return null;

  const sentences = complements.map((c) => {
    const lackWho = c.lacking_in === 'personA' ? personALabel : personBLabel;
    const supplyWho = c.supplied_by === 'personA' ? personALabel : personBLabel;
    const el = ELEMENT_TERM[c.element] ?? c.element;
    return `${el}${eunNeun(el)} ${lackWho}에게 ${c.lacking_count}개, ${supplyWho}에게 ${c.supplying_count}개라, ${supplyWho}${iGa(supplyWho)} ${lackWho}의 부족한 ${el}${eulReul(el)} 보완하는 방향이 나타납니다.`;
  });
  return {
    type: 'complementarity',
    fact_ref: ['five_element_a', 'five_element_b', 'five_element_complementarity'],
    text: sentences.join(' '),
  };
}

function buildStimulationReason(raw) {
  const chung = raw.cross_pillar_relations.filter((r) => r.kind === 'branch' && r.relation === '沖');
  if (chung.length === 0) return null;
  const positions = chung.map((r) => pillarPairLabel(r.personA_pillar, r.personB_pillar)).join(', ');
  return {
    type: 'stimulation',
    fact_ref: ['cross_pillar_relations'],
    text: `${TERM['沖']}이 ${chung.length}곳(${positions})에서 확인되어, 강한 역동성이 있는 관계로 볼 수 있습니다.`,
  };
}

const REASON_BUILDERS = {
  attraction: (raw) => buildAttractionReason(raw),
  communication: (raw) => buildCommunicationReason(raw),
  complementarity: (raw, a, b) => buildComplementarityReason(raw, a, b),
  stimulation: (raw) => buildStimulationReason(raw),
};

const TIE_BREAK_ORDER = ['attraction', 'communication', 'complementarity', 'stimulation'];

/**
 * 후보의 4개 percentile 중 상위 2~3개를 "주요 추천 이유"로 선택한다(승인된 설계 §12).
 * percentile이 높아도 실제 raw fact가 없으면 그 이유는 건너뛰고 그 다음 feature를 시도한다 —
 * "존재하지 않는 관계를 설명하지 않는다" 원칙.
 */
function selectReasons(featurePercentiles, raw, personALabel, personBLabel, maxCount = 3) {
  const sorted = [...TIE_BREAK_ORDER].sort((a, b) => {
    const diff = featurePercentiles[b] - featurePercentiles[a];
    if (diff !== 0) return diff;
    return TIE_BREAK_ORDER.indexOf(a) - TIE_BREAK_ORDER.indexOf(b); // 동률이면 고정 우선순위
  });

  const reasons = [];
  for (const type of sorted) {
    if (reasons.length >= maxCount) break;
    const reason = REASON_BUILDERS[type](raw, personALabel, personBLabel);
    if (reason) reasons.push(reason);
  }
  return reasons;
}

/** mutual_ten_god 양방향 — 어느 한쪽도 생략하지 않는다(승인된 설계 §15). */
function buildRelationshipStyle(raw, personALabel, personBLabel) {
  const mtg = raw.mutual_ten_god;
  return {
    mutual_ten_god_text: `${personALabel}에게 ${personBLabel}${eunNeun(personBLabel)} ${tenGodTerm(mtg.personA_to_B)} 관계로 나타나고, ${personBLabel}에게 ${personALabel}${eunNeun(personALabel)} ${tenGodTerm(mtg.personB_to_A)} 관계로 나타납니다.`,
    fact_ref: ['mutual_ten_god'],
  };
}

/**
 * caution — 형파해원진귀문을 pillar-pair 단위로 그대로 보존(합치지 않음, 승인된 설계 §7/§18).
 * "나쁜 궁합"/"악연" 등 금지 표현은 이 함수 어디에도 존재하지 않는다.
 */
function buildCaution(result) {
  const pillarPairs = result.features.conflict_potential.pillar_pairs;
  return pillarPairs.map((p) => {
    const relLabel = p.relations.map(tenGodTerm).join('·');
    return {
      fact_ref: ['cross_pillar_relations'],
      pillar_pair: p,
      text: `${pillarPairLabel(p.personA_pillar, p.personB_pillar)} 사이에서 ${relLabel}${iGa(relLabel)} 함께 확인되어, 신경 써볼 부분이 있습니다.`,
    };
  });
}

/**
 * @param {object} rankedEntry - compatibility-ranking.mjs의 rankCandidates() 결과 항목 하나
 * @param {string} [personALabel] - 결과 문장에서 "나"를 가리키는 표현
 * @param {string} [personBLabel] - 결과 문장에서 상대를 가리키는 표현(보통 닉네임)
 * @returns {object} 최종 사용자 응답 JSON (승인된 스키마)
 */
export function buildExplanation(rankedEntry, { personALabel = '당신', personBLabel } = {}) {
  const bLabel = personBLabel ?? rankedEntry.candidate_id;
  const raw = rankedEntry._result.raw;

  return {
    candidate_id: rankedEntry.candidate_id,
    overall_tier: rankedEntry.overall_tier,
    feature_raw: rankedEntry.feature_raw,
    feature_percentiles: rankedEntry.feature_percentiles,
    overall_score: rankedEntry.overall_score,
    rank: rankedEntry.rank,
    why_recommended: selectReasons(rankedEntry.feature_percentiles, raw, personALabel, bLabel),
    relationship_style: buildRelationshipStyle(raw, personALabel, bLabel),
    caution: buildCaution(rankedEntry._result),
  };
}

export const COMPATIBILITY_EXPLANATION_TERMS = TERM;
