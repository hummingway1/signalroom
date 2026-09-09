// packages/chart-engine/child-growth-analysis.mjs
//
// "자녀 성장 설계" PREMIUM 상품의 계산 기반. 이미 계산된 canonical chart(한 아이의 saju+ziwei)만
// 소비하는 side-car — 새로운 명리학적 계산을 전혀 만들지 않는다.
//
// 절대 원칙(승인된 설계):
//   1. LEVEL 3(십신 우세 + 자미두수 명궁 주성 + 오행 분포)를 최소 개인화 기준으로 사용.
//   2. caution/관찰포인트는 오직 special_stars.gwimun(귀문)만 사용한다. relations.pillar_pairs는
//      이 엔진에서 원국 내부(4주끼리) 값을 채워주지 않는다는 게 28명 fixture 전수 조사로 확인됐다
//      (0/28) — 그래서 형(刑)·충(沖)·파(破)·해(害)·원진(怨嗔)은 이번 구현에서 아예 다루지 않는다.
//      이 데이터를 새로 계산하는 side-car도 만들지 않는다(범위 밖, 승인된 제한).
//   3. 재성(財星)=동기부여 같은 weak confidence 연결은 핵심 추천에서 제외.
//   4. 모든 문장은 fact_ref로 추적 가능.
//   5. "공부를 잘한다/성공한다/용신이다/운이 좋아진다" 등 금지 표현은 템플릿 어디에도 없어 구조적으로
//      생성 불가.
//   6. 귀문(鬼門)은 성향 확정/부정적 진단이 아니라 순수 관찰 포인트로만 표현 — "예민하다/집착한다/
//      문제가 있다" 같은 단정 금지, "관찰해볼 수 있다" 형태만 허용.

import { iGa, gwaWa } from '../shared/korean-particles.mjs';

const TEN_GOD_HANGUL = {
  '食神': '식신(食神)', '傷官': '상관(傷官)', '正印': '정인(正印)', '偏印': '편인(偏印)',
  '正官': '정관(正官)', '偏官': '편관(偏官)', '正財': '정재(正財)', '偏財': '편재(偏財)',
  '比肩': '비견(比肩)', '劫財': '겁재(劫財)',
};
const TEN_GOD_GROUP = {
  '食神': 'expressive', '傷官': 'expressive', '正印': 'receptive', '偏印': 'receptive',
  '正官': 'structured', '偏官': 'structured', '正財': 'practical', '偏財': 'practical',
  '比肩': 'self-directed', '劫財': 'self-directed',
};
const STAR_HANGUL = {
  '紫微': '자미(紫微)', '天機': '천기(天機)', '太陽': '태양(太陽)', '武曲': '무곡(武曲)',
  '天同': '천동(天同)', '廉貞': '염정(廉貞)', '天府': '천부(天府)', '太陰': '태음(太陰)',
  '貪狼': '탐랑(貪狼)', '巨門': '거문(巨門)', '天相': '천상(天相)', '天梁': '천량(天梁)',
  '七殺': '칠살(七殺)', '破軍': '파군(破軍)',
};
// 명궁 주성의 방향성 태그 — 전통적으로 비교적 널리 통용되는 대략적 축만(불확실하면 매핑 없음).
const STAR_DIRECTION = {
  '紫微': 'self-directed', '武曲': 'practical', '破軍': 'self-directed', '天機': 'receptive',
  '太陽': 'expressive', '天同': 'receptive', '廉貞': 'expressive', '天府': 'structured',
  '太陰': 'receptive', '貪狼': 'expressive', '巨門': 'expressive', '天相': 'structured',
  '天梁': 'structured', '七殺': 'self-directed',
};
const STEM_ELEMENT = { '甲': 'wood', '乙': 'wood', '丙': 'fire', '丁': 'fire', '戊': 'earth', '己': 'earth', '庚': 'metal', '辛': 'metal', '壬': 'water', '癸': 'water' };
const BRANCH_ELEMENT = { '寅': 'wood', '卯': 'wood', '巳': 'fire', '午': 'fire', '辰': 'earth', '戌': 'earth', '丑': 'earth', '未': 'earth', '申': 'metal', '酉': 'metal', '亥': 'water', '子': 'water' };
const ELEMENT_HANGUL = { wood: '목(木)', fire: '화(火)', earth: '토(土)', metal: '금(金)', water: '수(水)' };
const PILLAR_HANGUL = { year: '년주(年柱)', month: '월주(月柱)', day: '일주(日柱)', hour: '시주(時柱)' };

// v3 재설계(승인된 설계): 각 파편에 사람이 직접 큐레이션한 태그를 붙인다.
//   - observable_patterns: concept_tags — "고집/반항/미룸" 같은 개념 묶음(단어 일치가 아니라
//     의미 묶음이라, "고집"이라는 단어가 프로필 원문에 없어도 매칭 가능해짐)
//   - scene_examples/parent_strategy_examples: situation_tags — "숙제/게임종료/지시/선택권" 같은
//     구체 상황 태그. 흔한 단어("말","아이","안","해")는 태그 후보에 절대 넣지 않는다.
// 이 태그는 casual-chat-prompt.mjs의 relevance/depth 엔진이 "이 재료가 지금 질문에 실제로 도움이
// 되는가"를 판정하는 1차 필터로만 쓰인다(질문의 target/intent 판정과 결합돼야 최종 depth가 정해짐).
const TRAIT_PROFILES = {
  expressive: {
    category: '표현활동제공',
    why_fact: '식신(食神)·상관(傷官) 계열의 십신(十神)이 원국에서 상대적으로 우세하게 나타납니다.',
    observable_patterns: [
      { text: '정답만 바로 요구받으면 오히려 위축되거나 대충 답할 가능성', concept_tags: ['표현', '평가', '위축'] },
      { text: '직접 설명하거나 만들어볼 기회가 있으면 더 적극적으로 참여할 가능성', concept_tags: ['표현', '참여'] },
    ],
    scene_examples: [
      { text: '숙제 답이 맞았는지만 확인할 때보다, "어떻게 풀었어?"라고 물었을 때 더 신나서 얘기하는 모습', situation_tags: ['숙제', '표현'] },
    ],
    parent_strategy_examples: [
      { text: '정답부터 확인하지 말고 "어떻게 생각했어?"부터 물어보기', situation_tags: ['숙제', '표현'] },
      { text: '결과물을 보여줄 때 바로 고치지 말고 먼저 설명을 들어보기', situation_tags: ['표현', '평가'] },
    ],
    caution_note: '설명 중간에 끊고 정답만 요구하면 위축될 수 있음',
  },
  receptive: {
    category: '준비시간확보',
    why_fact: '정인(正印)·편인(偏印) 계열의 십신(十神)이 원국에서 상대적으로 우세하게 나타납니다.',
    observable_patterns: [
      { text: '새로운 상황에 바로 뛰어들기보다 먼저 지켜보는 시간이 필요할 가능성', concept_tags: ['새로운상황', '준비시간'] },
      { text: '준비 시간 없이 바로 참여시키면 부담스러워할 가능성', concept_tags: ['새로운상황', '부담'] },
    ],
    scene_examples: [
      { text: '새 학원이나 활동 첫날, 다른 아이들은 바로 뛰어드는데 이 아이만 한쪽에서 지켜보는 모습', situation_tags: ['새로운환경', '학원'] },
    ],
    parent_strategy_examples: [
      { text: '"지금 바로 해봐" 대신 "먼저 좀 보고 있어도 돼"라고 여지를 주기', situation_tags: ['새로운환경', '준비시간'] },
      { text: '새로운 걸 시작하기 며칠 전에 미리 얘기해주기', situation_tags: ['새로운환경'] },
    ],
    caution_note: '준비 시간 없이 바로 밀어붙이면 위축될 수 있음',
  },
  structured: {
    category: '구조명확화',
    why_fact: '정관(正官)·편관(偏官) 계열의 십신(十神)이 원국에서 상대적으로 우세하게 나타납니다.',
    observable_patterns: [
      { text: '규칙이 명확할 때 더 편안해할 가능성', concept_tags: ['규칙', '예측가능성'] },
      { text: '규칙이 자주 바뀌거나 예측하기 어려우면 스트레스를 받을 가능성', concept_tags: ['규칙', '예측가능성', '변화'] },
    ],
    scene_examples: [
      { text: '정해진 순서대로 하는 날은 순조로운데, 갑자기 일정이 바뀐 날은 유독 짜증을 내는 모습', situation_tags: ['루틴', '일정변경'] },
    ],
    parent_strategy_examples: [
      { text: '"오늘은 그냥 이렇게 하자" 대신 미리 정한 순서를 지켜주기', situation_tags: ['루틴', '규칙'] },
      { text: '규칙을 바꿔야 할 땐 이유를 먼저 설명해주기', situation_tags: ['규칙', '일정변경'] },
    ],
    caution_note: '예측 불가능한 상황이 반복되면 부담을 느낄 수 있음',
  },
  practical: {
    category: '결과물제공',
    why_fact: '정재(正財)·편재(偏財) 계열의 십신(十神)이 원국에서 상대적으로 우세하게 나타납니다.',
    observable_patterns: [
      { text: '눈에 보이는 결과물이 있을 때 동기부여가 더 잘될 가능성', concept_tags: ['동기', '결과물'] },
      { text: '추상적인 목표만 반복되면 흥미를 잃을 가능성', concept_tags: ['동기', '목표'] },
    ],
    scene_examples: [
      { text: '"열심히 해"라는 말보다, 끝나면 뭐가 남는지 알려줬을 때 더 열심히 하는 모습', situation_tags: ['동기', '결과물'] },
    ],
    parent_strategy_examples: [
      { text: '"열심히 해봐" 대신 "다 하면 이런 게 완성돼"라고 결과물을 먼저 보여주기', situation_tags: ['동기', '결과물'] },
    ],
    caution_note: null,
    confidence: 'weak', // 재성=동기부여 연결은 근거가 상대적으로 약함(승인된 원칙, 핵심 추천에서 제외 대상)
  },
  'self-directed': {
    category: '선택권부여',
    why_fact: '비견(比肩)·겁재(劫財) 계열의 십신(十神)이 원국에서 상대적으로 우세하게 나타납니다.',
    observable_patterns: [
      { text: '직접 지시받으면 오히려 늦게 시작하거나 버틸 가능성', concept_tags: ['자기결정', '통제', '고집', '반항', '미룸'] },
      { text: '본인이 먼저 하겠다고 한 일에는 상대적으로 잘 몰입할 가능성', concept_tags: ['자기결정', '몰입'] },
    ],
    scene_examples: [
      { text: '숙제하라고 여러 번 말할수록 더 늦게 시작하는 모습', situation_tags: ['숙제', '지시'] },
      { text: '게임 끄라고 하면 반발하지만, 언제까지 할지 먼저 정하게 하면 순순히 따르는 모습', situation_tags: ['게임종료', '선택권'] },
    ],
    parent_strategy_examples: [
      { text: '"숙제해" 대신 "수학 먼저 할래, 국어 먼저 할래?"처럼 둘 중 하나 고르게 하기', situation_tags: ['숙제', '선택권'] },
      { text: '"지금 해" 대신 "지금 할래, 조금 있다 할래?"로 물어보기', situation_tags: ['지시', '선택권'] },
    ],
    caution_note: '형제·친구와 직접 비교하는 표현에 유독 민감하게 반응할 수 있음',
  },
};

function tenGodDominance(pillars) {
  const groupCounts = { expressive: 0, receptive: 0, structured: 0, practical: 0, 'self-directed': 0 };
  for (const p of pillars) {
    if (p.ten_god.stem && TEN_GOD_GROUP[p.ten_god.stem]) groupCounts[TEN_GOD_GROUP[p.ten_god.stem]]++;
    if (p.ten_god.branch && TEN_GOD_GROUP[p.ten_god.branch]) groupCounts[TEN_GOD_GROUP[p.ten_god.branch]]++;
  }
  const [direction, count] = Object.entries(groupCounts).sort((a, b) => b[1] - a[1])[0];
  return { direction, count, groupCounts };
}

function fiveElementDistribution(pillars) {
  const counts = { wood: 0, fire: 0, earth: 0, metal: 0, water: 0 };
  for (const p of pillars) {
    if (STEM_ELEMENT[p.heavenly_stem]) counts[STEM_ELEMENT[p.heavenly_stem]]++;
    if (BRANCH_ELEMENT[p.earthly_branch]) counts[BRANCH_ELEMENT[p.earthly_branch]]++;
  }
  const missing = Object.entries(counts).filter(([, c]) => c === 0).map(([el]) => el);
  return { counts, missing };
}

function lifePalaceStars(ziwei) {
  const lifePalace = ziwei.palaces.find((p) => p.position === 'life');
  if (!lifePalace) return [];
  return lifePalace.stars.filter((s) => s.category === 'main_star').map((s) => s.name);
}

/**
 * 슬롯4 — 명궁 주성 방향과 십신 우세 방향을 비교. 일치/불일치는 내부 신뢰도 가산용 메타데이터로만
 * 쓴다(v2, 승인된 설계 §2) — "명궁 주성에서도 신호가 확인됩니다" 같은 완성 문장을 사용자에게 직접
 * 노출하지 않는다. casual-chat-prompt.mjs는 이 결과를 "확신을 갖고 말해도 되는 조각인지" 판단하는
 * 용도로만 참조한다.
 */
function buildStarSignal(dominantDirection, stars) {
  const starDirections = stars.map((s) => STAR_DIRECTION[s]).filter(Boolean);
  if (starDirections.length === 0) return null; // 매핑 없는 주성이면 신호 생성 안 함(추측 금지)
  const matches = starDirections.includes(dominantDirection);
  return {
    kind: matches ? 'supporting_signal' : 'contrasting_signal',
    stars_hangul: stars.map((s) => STAR_HANGUL[s] ?? s),
    fact_ref: ['ziwei.life_palace'],
  };
}

/**
 * 슬롯5 — 귀문(鬼門)만 사용. 없으면 아무것도 생성하지 않는다. 완성 문장이 아니라 짧은 관찰 항목
 * (observable_pattern)만 저장 — "예민하다/집착한다/문제가 있다" 같은 단정 표현은 애초에 없음.
 */
function buildCaution(gwimun) {
  if (!gwimun || gwimun.length === 0) return [];
  return gwimun.map((g) => {
    const posA = PILLAR_HANGUL[g.positions[0]] ?? g.positions[0];
    const posB = PILLAR_HANGUL[g.positions[1]] ?? g.positions[1];
    return {
      observable_pattern: `특정 상황이나 관심사에 유독 강하게 몰입하는 모습`,
      concept_tags: ['몰입', '집중'],
      fact_ref: ['special_stars.gwimun'],
      positions: g.positions,
      _internal_note: `${posA}${gwaWa(posA)} ${posB} 사이에서 귀문(鬼門)에 해당하는 부분이 확인됨(내부 근거 추적용, 사용자 대화에 직접 노출 안 함)`,
    };
  });
}

/**
 * 5-slot parent action 생성 — 승인된 우선순위 규칙 그대로.
 *   슬롯1(필수): 십신 우세 → 주 반응방식
 *   슬롯2(조건부): 비겁 count>=2 이고 슬롯1과 다른 카테고리일 때만 → 선택권 보강
 *   슬롯3(조건부): 오행 결핍 있을 때만 → 경험다양성 (없으면 슬롯 자체 미생성)
 *   슬롯4(조건부): 명궁 주성에 방향 매핑이 있을 때만 → supporting/contrasting
 *   슬롯5(조건부): 귀문이 실제로 있을 때만 → 관찰포인트(caution)
 */
export function analyzeChildGrowth(canonical) {
  const pillars = canonical.saju.pillars;
  const { direction: dominantDirection, groupCounts } = tenGodDominance(pillars);
  const { counts: elementCounts, missing: missingElements } = fiveElementDistribution(pillars);
  const stars = lifePalaceStars(canonical.ziwei);
  const gwimun = canonical.saju.special_stars.gwimun;

  const core_signals = {
    ten_god_dominance: { direction: dominantDirection, group_counts: groupCounts, fact_ref: ['saju.pillars'] },
    life_palace_stars: { names: stars, names_hangul: stars.map((s) => STAR_HANGUL[s] ?? s), fact_ref: ['ziwei.life_palace'] },
    five_element_distribution: { counts: elementCounts, missing: missingElements.map((e) => ELEMENT_HANGUL[e]), fact_ref: ['saju.pillars'] },
  };

  const parent_actions = [];
  const profile = TRAIT_PROFILES[dominantDirection];

  // 슬롯1 (필수) — 파편(observable_patterns/scene_examples/parent_strategy_examples) 그대로 보존.
  // why_fact는 내부 근거 추적용(fact_ref와 함께)이며 사용자 대화 프롬프트에는 노출하지 않는다.
  parent_actions.push({
    slot: 1,
    category: profile.category,
    trait_signal: dominantDirection,
    observable_patterns: profile.observable_patterns,
    scene_examples: profile.scene_examples,
    parent_strategy_examples: profile.parent_strategy_examples,
    caution_note: profile.caution_note,
    why_fact: profile.why_fact,
    fact_ref: ['saju.pillars'],
    confidence: profile.confidence ?? 'moderate',
  });

  // 슬롯2 (조건부 — 비겁 우세가 아닌데 count>=2)
  if (dominantDirection !== 'self-directed' && groupCounts['self-directed'] >= 2) {
    parent_actions.push({
      slot: 2,
      category: '선택권부여',
      trait_signal: 'self-directed-secondary',
      observable_patterns: [{ text: '비교당하는 상황에서 유독 예민하게 반응할 가능성', concept_tags: ['비교', '통제'] }],
      scene_examples: [{ text: '형제나 친구 얘기가 나오면 표정이 확 굳는 모습', situation_tags: ['비교', '형제'] }],
      parent_strategy_examples: [{ text: '"형은 안 그러는데" 같은 비교 표현을 빼고 말해보기', situation_tags: ['비교', '형제'] }],
      caution_note: null,
      why_fact: '비견(比肩)·겁재(劫財) 계열의 십신(十神)도 함께 상대적으로 자주 나타납니다.',
      fact_ref: ['saju.pillars'],
      confidence: 'moderate',
    });
  }

  // 슬롯3 (조건부 — 오행 결핍 있을 때만)
  if (missingElements.length > 0) {
    const elNames = missingElements.map((e) => ELEMENT_HANGUL[e]).join(', ');
    const lastElName = ELEMENT_HANGUL[missingElements.at(-1)];
    parent_actions.push({
      slot: 3,
      category: '경험다양성',
      trait_signal: 'element_missing',
      observable_patterns: [{ text: `${elNames}${gwaWa(lastElName)} 관련된 경험을 상대적으로 덜 접했을 가능성`, concept_tags: ['새로운경험'] }],
      scene_examples: [],
      parent_strategy_examples: [{ text: `평소 안 하던 활동을 하나 새로 접해보고 반응을 지켜보기`, situation_tags: ['새로운경험'] }],
      caution_note: null,
      why_fact: `사주(四柱) 원국의 오행(五行) 분포에서 ${elNames}${iGa(lastElName)} 확인되지 않습니다.`,
      fact_ref: ['saju.pillars'],
      confidence: 'moderate',
    });
  }

  // 슬롯4 (조건부 — 명궁 주성에 방향 매핑이 있을 때만) — 내부 신뢰도 가산 메타데이터, 텍스트 없음
  const starSignal = buildStarSignal(dominantDirection, stars);
  if (starSignal) {
    parent_actions.push({
      slot: 4,
      category: '근거보강',
      trait_signal: `${dominantDirection}-${starSignal.kind}`,
      observable_patterns: [],
      scene_examples: [],
      parent_strategy_examples: [],
      caution_note: null,
      why_fact: null,
      fact_ref: starSignal.fact_ref,
      confidence: 'moderate',
      signal_kind: starSignal.kind, // 'supporting_signal' | 'contrasting_signal' — 내부 판단용
    });
  }

  // 슬롯5 — caution은 parent_actions와 분리된 별도 배열
  const caution = buildCaution(gwimun);

  return { core_signals, parent_actions: parent_actions.slice(0, 5), caution };
}

export const CHILD_GROWTH_ANALYSIS_METHOD = 'canonical-chart-consumer-v3'; // v2: 파편형 구조로 재설계(완성 문장 제거)
