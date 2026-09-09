// tests/service-quality/semantic-validators.mjs
//
// Q6~Q10 전용 신규 검증기. tests/real-ai/validators.mjs, tests/targeted-quality/semantic-validators.mjs
// 등 기존 파일은 import만 하고 절대 수정하지 않는다(Q10에서 gwimun 관련 기존 함수 재사용).
//
// 이 5개는 "정답이 있는" 검증(세운/귀문관살 정확성)과 근본적으로 다르다 — 공감/개인화/일관성/과잉긍정
// 방지는 전부 정성적 판단이 핵심이므로, 여기 있는 자동 체크는 전부 "명백한 실패만 걸러내는 최소
// 안전망"이다. 진짜 판단은 사람이 한다 (README/보고서에서 항상 "자동 vs 사람" 구분해서 표기할 것).

const QUOTE_CHARS = ['\u2018', '\u2019', '\u201c', '\u201d', '"', "'", '「', '『'];
function isWithinQuotedSpan(text, idx, window = 40) {
  if (idx === -1) return false;
  const before = text.slice(Math.max(0, idx - window), idx);
  const after = text.slice(idx, idx + window);
  return QUOTE_CHARS.some((q) => before.includes(q)) && QUOTE_CHARS.some((q) => after.includes(q));
}

// ============================================================
// Q6 — 자기인식/공감도 (최소 안전망만 — 진짜 판단은 사람)
// ============================================================

const COLD_OPENING_PATTERNS = [/^\[Fact\]/, /^데이터에\s*따르면/, /^다음과\s*같습니다/, /^분석\s*결과/];

/**
 * "[해석 안내]" 블록은 원본 프롬프트(saju-original.md/ziwei-original.md)가 요구하는 **필수 안전
 * 고지문**이다 — 2026-08-17 실행에서 실제 발견된 버그: 이 필수 문구를 "차가운 시작"으로 오인해서,
 * 원본 규칙을 정확히 지킨 응답이 오히려 FAIL 처리됐다. 이 블록이 있으면 건너뛰고 그 다음 실제
 * 해석 내용이 시작되는 지점부터 "공감적으로 시작하는지"를 검사해야 한다.
 */
function skipMandatoryDisclosureBlock(text) {
  const trimmed = text.trim();
  const disclosureMatch = trimmed.match(/^\[해석\s*안내\][^]*?\n\n/);
  return disclosureMatch ? trimmed.slice(disclosureMatch[0].length).trim() : trimmed;
}

/**
 * "명백히 실패한" 공감 결여만 걸러낸다: 응답이 곧바로 사무적 정형 문구나 한자 밀도가 매우 높은
 * 문장으로 시작하는 경우. 이걸 통과했다고 "공감을 잘했다"는 뜻은 아니다 — 사람이 봐야 한다.
 */
export function checkEmpathyOpeningStructure(text) {
  const contentStart = skipMandatoryDisclosureBlock(text);
  const startsCold = COLD_OPENING_PATTERNS.some((p) => p.test(contentStart));
  const opening = contentStart.slice(0, 40);
  const hanjaCount = (opening.match(/[\u4e00-\u9fff]/g) || []).length;
  const hanjaDenseOpening = hanjaCount >= 6;
  return {
    pass: !startsCold && !hanjaDenseOpening,
    details: {
      starts_with_cold_formula: startsCold,
      hanja_dense_opening: hanjaDenseOpening,
      hanja_count_in_first_40_chars: hanjaCount,
      opening_excerpt: opening,
      skipped_mandatory_disclosure: contentStart !== text.trim(),
      note: '이 체크는 최소 안전망일 뿐 — 통과해도 공감 품질 자체는 사람이 평가해야 함. [해석 안내] 필수 고지문은 건너뛰고 그 다음 실제 내용을 검사함.',
    },
  };
}

// ============================================================
// Q7 — 구체성/개인화
// ============================================================

const ALL_STEMS = ['甲', '乙', '丙', '丁', '戊', '己', '庚', '辛', '壬', '癸'];
const ALL_BRANCHES = ['子', '丑', '寅', '卯', '辰', '巳', '午', '未', '申', '酉', '戌', '亥'];
// 자미두수 주성도 한자/한글 둘 다 인식 (2026-08-17 실행에서 실제 발견: "거문", "천량"처럼 한글로만
// 쓰인 주성이 전혀 카운트되지 않았다). 보조성/살성과 12궁 이름도 실제 개인화 신호이므로 추가.
const ZIWEI_MAIN_STAR_FORMS = {
  '紫微': ['紫微', '자미'], '天機': ['天機', '천기'], '太陽': ['太陽', '태양'], '武曲': ['武曲', '무곡'],
  '天同': ['天同', '천동'], '廉貞': ['廉貞', '염정'], '天府': ['天府', '천부'], '太陰': ['太陰', '태음'],
  '貪狼': ['貪狼', '탐랑'], '巨門': ['巨門', '거문'], '天相': ['天相', '천상'], '天梁': ['天梁', '천량'],
  '七殺': ['七殺', '칠살'], '破軍': ['破軍', '파군'],
};
const ZIWEI_AUX_STAR_FORMS = {
  '左輔': ['左輔', '좌보'], '右弼': ['右弼', '우필'], '天魁': ['天魁', '천괴'], '天鉞': ['天鉞', '천월'],
  '文昌': ['文昌', '문창'], '文曲': ['文曲', '문곡'], '祿存': ['祿存', '녹존'], '天馬': ['天馬', '천마'],
  '擎羊': ['擎羊', '경양'], '陀羅': ['陀羅', '타라'], '火星': ['火星', '화성'], '鈴星': ['鈴星', '영성'],
  '地空': ['地空', '지공'], '地劫': ['地劫', '지겁'],
};
const ZIWEI_PALACE_NAMES = ['명궁', '형제궁', '부처궁', '자녀궁', '재백궁', '질액궁', '천이궁', '교우궁', '관록궁', '전택궁', '복덕궁', '부모궁', '신궁'];
const TEN_GOD_FORMS = {
  '比肩': ['比肩', '비견'], '劫財': ['劫財', '겁재'], '食神': ['食神', '식신'], '傷官': ['傷官', '상관'],
  '偏財': ['偏財', '편재'], '正財': ['正財', '정재'], '偏官': ['偏官', '편관'], '正官': ['正官', '정관'],
  '偏印': ['偏印', '편인'], '正印': ['正印', '정인'],
};

function findGanziTokens(text) {
  const tokens = [];
  for (let i = 0; i < text.length - 1; i++) {
    if (ALL_STEMS.includes(text[i]) && ALL_BRANCHES.includes(text[i + 1])) tokens.push(text[i] + text[i + 1]);
  }
  return tokens;
}

function findStandaloneDayMasterMentions(text) {
  const found = new Set();
  for (const stem of ALL_STEMS) {
    if (text.includes(`${stem} 일간`) || text.includes(`일간 ${stem}`)) found.add(`${stem}(일간)`);
  }
  return found;
}

function findDistinctiveCitations(text) {
  const found = new Set();
  for (const g of findGanziTokens(text)) found.add(g);
  for (const [hanja, forms] of Object.entries(ZIWEI_MAIN_STAR_FORMS)) {
    if (forms.some((f) => text.includes(f))) found.add(hanja);
  }
  for (const [hanja, forms] of Object.entries(ZIWEI_AUX_STAR_FORMS)) {
    if (forms.some((f) => text.includes(f))) found.add(hanja);
  }
  for (const [hanja, forms] of Object.entries(TEN_GOD_FORMS)) {
    if (forms.some((f) => text.includes(f))) found.add(hanja);
  }
  for (const p of ZIWEI_PALACE_NAMES) if (text.includes(p)) found.add(p);
  for (const m of findStandaloneDayMasterMentions(text)) found.add(m);
  return found;
}

/** 응답에 실제 개인 데이터(간지/주성/십신)가 최소 개수 이상 등장하는지 — "누구에게나 적용 가능한
 * 일반론"만으로는 이 임계치를 넘기기 어렵다. 통과해도 진짜 통찰력이 있는지는 사람이 판단해야 함. */
export function checkCitationDensity(text, minCitations = 5) {
  const citations = findDistinctiveCitations(text);
  return {
    pass: citations.size >= minCitations,
    details: { citation_count: citations.size, citations: [...citations], min_required: minCitations },
  };
}

/** 서로 다른 두 사람에게 같은 질문을 던졌을 때 응답이 표면적으로 거의 동일하면(=템플릿 재사용
 * 가능성) FAIL. Jaccard 유사도(단어 집합 기준)로 측정 — 정교한 임베딩 비교는 하지 않음(과설계 방지). */
export function checkCrossPersonSimilarity(textA, textB, maxSimilarity = 0.5) {
  const tokenize = (t) =>
    new Set(
      t
        .replace(/[^\p{L}\p{N}]/gu, ' ')
        .split(/\s+/)
        .filter((w) => w.length > 1)
    );
  const setA = tokenize(textA);
  const setB = tokenize(textB);
  const intersection = [...setA].filter((x) => setB.has(x)).length;
  const union = new Set([...setA, ...setB]).size;
  const jaccard = union === 0 ? 0 : intersection / union;
  return {
    pass: jaccard <= maxSimilarity,
    details: { jaccard_similarity: Number(jaccard.toFixed(3)), max_allowed: maxSimilarity, note: '단어 집합 기준 근사치 — 정교한 의미 유사도 아님' },
  };
}

// ============================================================
// Q8 — 동일 사주 반복 생성 시 핵심 판단 일관성
// ============================================================

const ORG_KEYWORDS = ['조직', '직장', '회사', '소속'];
const INDEPENDENT_KEYWORDS = ['독립', '프리랜서', '자영업', '1인', '단독 창업', '창업'];
const NEGATION_AFTER_MARKERS = ['도 아닌', '도 아니', '은 아니', '는 아니', '라기보다', '아니라', '아니고'];

/** 키워드 바로 뒤(15자 이내)에 부정 표지가 있으면 그 등장은 카운트하지 않는다. 2026-08-17 실행에서
 * 실제 발견된 버그: "완전히 통제받는 조직원도, 모든 것을 혼자 책임지는 1인 독립도 아닌 '조직의
 * 기반을 활용하되...'"라는, 실질적으로는 조직 쪽으로 결론 내리는 문장에서 부정된 "1인 독립"이 그대로
 * independent 쪽으로 카운트되어 반대 결론이 나왔다. */
function countUnnegated(text, keyword) {
  let count = 0;
  let searchFrom = 0;
  while (true) {
    const idx = text.indexOf(keyword, searchFrom);
    if (idx === -1) break;
    const after = text.slice(idx + keyword.length, idx + keyword.length + 15);
    if (!NEGATION_AFTER_MARKERS.some((m) => after.startsWith(m) || after.includes(m.slice(0, 4)))) count++;
    searchFrom = idx + keyword.length;
  }
  return count;
}

const CONCLUSION_MARKERS = ['한 줄 결론', '결론부터', '결론적으로', '정리하면', '종합하면', '한마디로'];

/** 명시적 결론 문장이 있으면 그 문장(다음 줄바꿈/마침표까지)만 우선 분석 대상으로 삼는다 — 본문 전체에
 * 산발적으로 나오는 단어보다 저자가 스스로 "이게 결론"이라고 표시한 문장이 훨씬 신뢰도 높은 신호다.
 * 없으면 전체 텍스트를 그대로 사용(fallback). */
function extractConclusionSentence(text) {
  for (const marker of CONCLUSION_MARKERS) {
    const idx = text.indexOf(marker);
    if (idx === -1) continue;
    const rest = text.slice(idx);
    const end = rest.search(/\n\n|(?<=[.!?])\s/);
    return end === -1 ? rest : rest.slice(0, end);
  }
  return null;
}

/** 응답이 "조직"과 "독립" 중 어느 쪽으로 더 기우는지 분류 (정교한 논조 분석 아님 — 사실관계 자체가
 * 흔들리는지는 기존 base validator 재실행으로 별도 확인, 이건 방향성만 본다). */
export function classifyOrgVsIndependentLean(text) {
  const conclusion = extractConclusionSentence(text);
  const target = conclusion ?? text;
  let orgScore = 0;
  let indepScore = 0;
  for (const k of ORG_KEYWORDS) orgScore += countUnnegated(target, k);
  for (const k of INDEPENDENT_KEYWORDS) indepScore += countUnnegated(target, k);
  if (orgScore === indepScore) return 'balanced';
  return orgScore > indepScore ? 'organization' : 'independent';
}

/** N회 반복 실행에서 나온 lean 배열이 과반 이상 같은 방향인지. */
export function checkLeanConsistency(leans, minAgreement = 2) {
  const counts = {};
  for (const l of leans) counts[l] = (counts[l] ?? 0) + 1;
  const maxCount = Math.max(...Object.values(counts));
  const majorityLean = Object.entries(counts).find(([, c]) => c === maxCount)?.[0];
  return {
    pass: maxCount >= minAgreement,
    details: { leans, counts, majority_lean: majorityLean, min_agreement_required: minAgreement, total_runs: leans.length },
  };
}

// ============================================================
// Q9 — 과잉 긍정/근거 없는 희망적 표현 방지
// ============================================================

// forbidden_certainty_phrases(반드시/무조건/100%/운명적으로)와는 다른 축 — "단정"은 아니지만
// "근거 없는 낙관"인 표현들. 기존 파일을 건드리지 않고 별도 목록으로 관리.
const OVERLY_POSITIVE_MARKERS = ['무조건 잘됩니다', '무조건 잘될', '분명 잘 될', '분명히 잘 될', '걱정 마세요', '걱정하지 마세요', '틀림없이 좋아', '확실히 잘 풀', '반드시 좋아질', '아무 문제 없'];
const BALANCE_MARKERS = ['다만', '그러나', '단,', '유의', '주의', '확정은 아니', '신중', '점검', '늦어질', '불확실', '한계', '제한적'];

/** 위 마커가 인용/부정 없이 등장하면 FAIL. */
export function checkOverlyPositiveLanguage(text) {
  const flagged = OVERLY_POSITIVE_MARKERS.filter((m) => {
    const idx = text.indexOf(m);
    return idx !== -1 && !isWithinQuotedSpan(text, idx);
  });
  return { pass: flagged.length === 0, details: { flagged } };
}

/** 추출된 데이터에 공망/충/해/원진처럼 "유보해야 할 신호"가 실제로 있는데, 응답에 균형 잡힌 표현이
 * 전혀 없으면 FAIL. 신호가 없으면 해당 없음(N/A). */
export function checkBalanceGivenTensionSignal(text, extractedSaju) {
  const TENSION_RELATION_TYPES = ['沖', '刑', '破', '害', '怨嗔'];
  let hasTensionSignal = false;

  for (const p of extractedSaju?.major_periods ?? []) if (p.is_void) hasTensionSignal = true;
  for (const p of extractedSaju?.annual_periods ?? []) {
    if (p.is_void) hasTensionSignal = true;
    for (const rel of p.relations_to_natal ?? []) {
      if (rel.stem_relations?.some((r) => TENSION_RELATION_TYPES.includes(r.type))) hasTensionSignal = true;
      if (rel.branch_relations?.some((r) => TENSION_RELATION_TYPES.includes(r.type))) hasTensionSignal = true;
    }
  }
  for (const rel of extractedSaju?.relations?.pillar_pairs ?? []) {
    if (rel.stem_relations?.some((r) => TENSION_RELATION_TYPES.includes(r.type))) hasTensionSignal = true;
    if (rel.branch_relations?.some((r) => TENSION_RELATION_TYPES.includes(r.type))) hasTensionSignal = true;
  }

  if (!hasTensionSignal) {
    return { pass: true, details: { has_tension_signal: false, note: '추출 데이터에 유보 신호(공망/충형해원진) 없음 — 해당 없음(N/A)' } };
  }
  const hasBalance = BALANCE_MARKERS.some((m) => text.includes(m));
  return { pass: hasBalance, details: { has_tension_signal: true, has_balance_language: hasBalance } };
}

// ============================================================
// Q10 — 캐릭터 톤 개입 시 ground truth 불변성
// ============================================================

// 정중체 종결 표지가 뚜렷이 줄어드는지로 판정한다 — 특정 반말 어미 문자열 목록(예: "거야","줄래")만
// 찾는 방식은 2026-08-17 실행에서 실제로 실패했다: 모델이 "확인되지 않아"/"나와 있어"/"조합이야"처럼
// 목록에 없는 다른 반말 종결을 썼는데도 전부 놓쳤다. 반말 어미는 형태가 매우 다양해서 특정 문자열을
// 나열하는 접근 자체가 근본적으로 깨지기 쉽다 — 대신 "정중체 표지가 있었다가 없어졌는지"를 본다.
const FORMAL_ENDING_MARKERS = ['습니다', '니다', '세요', '어요', '아요', '예요', '이에요', '해요'];

function countFormalEndings(text) {
  return FORMAL_ENDING_MARKERS.reduce((sum, m) => sum + (text.split(m).length - 1), 0);
}

/** 캐릭터 지시가 실제로 반영됐는지(=테스트 자체가 유효한지) 확인 — baseline은 정중체 종결이 여러 번
 * 나오고, character 버전은 그게 뚜렷이 줄어들어야 "톤이 실제로 달라졌다"고 볼 수 있다. */
export function checkToneActuallyApplied(baselineText, characterText) {
  const baselineFormalCount = countFormalEndings(baselineText);
  const characterFormalCount = countFormalEndings(characterText);
  const toneChanged = baselineFormalCount >= 2 && characterFormalCount <= Math.max(1, Math.floor(baselineFormalCount * 0.3));
  return {
    pass: toneChanged,
    details: { baseline_formal_ending_count: baselineFormalCount, character_formal_ending_count: characterFormalCount },
  };
}
