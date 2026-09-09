// tests/targeted-quality/semantic-validators.mjs
//
// "키워드 검사 수준으로 만들지 마라" — AI가 "2027년"이라는 단어를 썼다고 PASS시키지 않고, AI가
// 계산값을 다른 표현으로 설명했다고 FAIL시키지도 않는다. 각 체크는 다음 원칙을 따른다:
//   1. fixture의 실제 값(간지/십신/12운성/관계)을 기준으로 삼는다 (임의 정답 없음).
//   2. 텍스트에서 "같은 값을 가리키는 서로 다른 표현"까지 허용하되, 명백히 다른/모순되는 값이
//      등장하면 FAIL로 잡는다.
//   3. 확실히 판단하기 어려운 뉘앙스(예: "십신을 언급은 안 했지만 개념적으로는 맞는 서술")는
//      자동 PASS로 두되 사람이 재검토할 수 있게 세부 근거를 details에 남긴다.

const QUOTE_CHARS = ['\u2018', '\u2019', '\u201c', '\u201d', '"', "'", '「', '『'];
function isWithinQuotedSpan(text, idx, window = 40) {
  const before = text.slice(Math.max(0, idx - window), idx);
  const after = text.slice(idx, idx + window);
  return QUOTE_CHARS.some((q) => before.includes(q)) && QUOTE_CHARS.some((q) => after.includes(q));
}

const ALL_STEMS = ['甲', '乙', '丙', '丁', '戊', '己', '庚', '辛', '壬', '癸'];
const ALL_BRANCHES = ['子', '丑', '寅', '卯', '辰', '巳', '午', '未', '申', '酉', '戌', '亥'];

function findGanziTokens(text) {
  const tokens = [];
  for (let i = 0; i < text.length - 1; i++) {
    if (ALL_STEMS.includes(text[i]) && ALL_BRANCHES.includes(text[i + 1])) {
      tokens.push({ ganzi: text[i] + text[i + 1], index: i });
    }
  }
  return tokens;
}

const YEAR_MENTION_WINDOW = 80; // "2027" 언급 주변에서 관련 간지/십신을 찾는 범위

/**
 * TEST 1 — 특정 연도 세운 직접 질문.
 * 2027년이 텍스트에 언급된 지점 주변에서, 실제 계산된 간지(丁未)와 다른 간지가 등장하는지,
 * 실제 간지 자체는 최소 한 번 언급되는지 확인한다.
 *
 * 2026-08-17 실행에서 실제 오탐 발견: "2027년은 丁未년으로, 현재의 己未 대운 안에 있습니다"처럼
 * 세운을 설명하며 그 세운이 속한 대운(己未)을 정당하게 함께 언급하는 문장에서, 己未가 "다른 간지"라는
 * 이유만으로 wrong_ganzi로 잘못 판정됐다. 대상 연도가 속한 대운/원국 4주 간지는 정당한 교차 참조로
 * 인정해야 한다 — 진짜 지어낸 간지(예: 다른 해의 간지를 착각해서 제시)만 걸러야 한다.
 */
export function checkAnnualYearAccuracy(text, expected) {
  const { targetYear, targetAnnual, currentMajorPeriod, pillars } = expected;
  const yearStr = String(targetYear);
  const yearMentions = [];
  let searchFrom = 0;
  while (true) {
    const idx = text.indexOf(yearStr, searchFrom);
    if (idx === -1) break;
    yearMentions.push(idx);
    searchFrom = idx + yearStr.length;
  }

  if (yearMentions.length === 0) {
    return { pass: false, details: { reason: `"${targetYear}"이 응답에 전혀 언급되지 않음 — 질문에 직접 답하지 않은 것으로 보임` } };
  }

  // 대상 연도 세운 자체 외에, 그 세운이 속한 대운이나 원국 4주 간지를 함께 언급하는 것은 정당한
  // 교차 참조다 (오히려 원본 adapter가 권장하는 방식) — "다른 간지"로 오탐하지 않도록 허용 목록에 포함.
  const allowedGanzi = new Set([targetAnnual.ganzi]);
  if (currentMajorPeriod?.ganzi) allowedGanzi.add(currentMajorPeriod.ganzi);
  for (const p of pillars ?? []) if (p.ganzi) allowedGanzi.add(p.ganzi);

  const wrongGanziNearby = [];
  let correctGanziMentioned = false;

  for (const idx of yearMentions) {
    const windowStart = Math.max(0, idx - 10);
    const windowEnd = Math.min(text.length, idx + YEAR_MENTION_WINDOW);
    const localTokens = findGanziTokens(text.slice(windowStart, windowEnd));
    for (const t of localTokens) {
      if (t.ganzi === targetAnnual.ganzi) correctGanziMentioned = true;
      else if (!allowedGanzi.has(t.ganzi)) wrongGanziNearby.push({ ganzi: t.ganzi, context: text.slice(windowStart, windowEnd) });
    }
  }

  return {
    pass: wrongGanziNearby.length === 0,
    details: {
      expected_ganzi: targetAnnual.ganzi,
      allowed_ganzi_for_cross_reference: [...allowedGanzi],
      correct_ganzi_mentioned: correctGanziMentioned,
      wrong_ganzi_nearby: wrongGanziNearby,
      note: correctGanziMentioned
        ? '실제 간지가 명시적으로 언급됨 (강한 근거)'
        : '간지를 명시적으로 언급하지 않고 풀어서 설명했을 수 있음 — 틀린 간지만 없으면 PASS, 사람이 서술 내용을 재확인 권장',
    },
  };
}

const TEN_GOD_FORMS = {
  '比肩': ['比肩', '비견'], '劫財': ['劫財', '겁재'], '食神': ['食神', '식신'], '傷官': ['傷官', '상관'],
  '偏財': ['偏財', '편재'], '正財': ['正財', '정재'], '偏官': ['偏官', '편관'], '正官': ['正官', '정관'],
  '偏印': ['偏印', '편인'], '正印': ['正印', '정인'],
};
// 12운성은 한자만 인식한다 (한글 단일 음절 매칭 제외). 死(사)/病(병)/養(양)/絶(절)/墓(묘) 같은 단일
// 음절은 "사건", "문제", "다양", "적절", "기묘" 등 완전히 무관한 일반 단어에도 흔히 등장해서 오탐이
// 매우 잦다 (2026-08-17 실행에서 "특정 사건의 예고가 아니라"의 "사"를 死로 오인한 실제 사례 발견).
// 실제 AI 응답도 12운성을 설명할 때는 한자 표기를 쓰는 경향이 있어(예: "衰에 해당"), 한자만 봐도
// 탐지력 손실이 크지 않다.
const TWELVE_STAGE_FORMS = {
  '長生': ['長生'], '沐浴': ['沐浴'], '冠帶': ['冠帶'], '乾祿': ['乾祿', '建祿'],
  '帝旺': ['帝旺'], '衰': ['衰'], '病': ['病'], '死': ['死'],
  '墓': ['墓'], '絶': ['絶'], '胎': ['胎'], '養': ['養'],
};

/**
 * TEST 1 — 세운 십신/12운성이 언급된 경우, 실제 값과 모순되지 않는지.
 * "언급 안 함"은 통과(강제하지 않음) — "언급했는데 틀림"만 FAIL. 한자/한글 표기 둘 다 인식한다
 * (실제 AI 응답이 "正財"가 아니라 "정재"처럼 한글로 쓸 가능성이 높음).
 */
export function checkAnnualTenGodAndStageConsistency(text, expected) {
  const { targetAnnual } = expected;

  const yearStr = String(expected.targetYear);
  const yearIdx = text.indexOf(yearStr);
  if (yearIdx === -1) return { pass: true, details: { note: '연도 자체가 언급되지 않아 이 체크는 해당 없음(N/A) — checkAnnualYearAccuracy에서 별도로 실패 처리됨' } };

  const windowStart = Math.max(0, yearIdx - 10);
  const windowEnd = Math.min(text.length, yearIdx + YEAR_MENTION_WINDOW * 2);
  const window = text.slice(windowStart, windowEnd);

  function findMentioned(formsMap) {
    const mentioned = [];
    for (const [hanja, forms] of Object.entries(formsMap)) {
      for (const form of forms) {
        const idx = window.indexOf(form);
        if (idx !== -1 && !isWithinQuotedSpan(window, idx)) {
          mentioned.push(hanja);
          break;
        }
      }
    }
    return mentioned;
  }

  const mentionedTenGods = findMentioned(TEN_GOD_FORMS);
  const mentionedStages = findMentioned(TWELVE_STAGE_FORMS);

  const expectedTenGods = [targetAnnual.ten_god.stem, targetAnnual.ten_god.branch].filter(Boolean);
  const wrongTenGods = mentionedTenGods.filter((tg) => !expectedTenGods.includes(tg));
  const wrongStages = mentionedStages.filter((s) => s !== targetAnnual.twelve_stage);

  return {
    pass: wrongTenGods.length === 0 && wrongStages.length === 0,
    details: {
      expected_ten_gods: expectedTenGods,
      expected_stage: targetAnnual.twelve_stage,
      mentioned_ten_gods: mentionedTenGods,
      mentioned_stages: mentionedStages,
      wrong_ten_gods: wrongTenGods,
      wrong_stages: wrongStages,
    },
  };
}

/**
 * TEST 2 / TEST 5 — 귀문관살 위치 정확성.
 * 응답이 귀문관살을 언급하면서 구체적 위치(년주/월주/일주/시주)를 댄 경우, 실제
 * special_stars.gwimun의 positions와 일치하는지 확인한다.
 */
export function checkGwimunPositionAccuracy(text, expected) {
  const { gwimun, positionLabelKo } = expected;
  const expectedPositions = new Set(gwimun.flatMap((g) => g.positions));

  // gwimun이 실제로 없는 fixture라면, AI가 "없다"고 설명하며 원국 4주 지지를 전부 나열하는 것은
  // 정상적이고 바람직한 서술이다(2026-08-17 실행에서 실제로 이런 좋은 응답이 오탐으로 FAIL 처리된
  // 사례 발견) — expected_positions가 원래 비어 있으므로 "언급한 위치가 전부 wrong"이 되어버리는
  // 구조적 결함이었다. gwimun이 없으면 이 체크 자체를 해당 없음(N/A)으로 둔다 — 존재 여부 판정은
  // checkGwimunExistenceConsistency가 담당한다.
  if (expectedPositions.size === 0) {
    return { pass: true, details: { note: '이 fixture는 귀문관살이 없음 — 위치 정확성 체크는 해당 없음(N/A). 존재 여부 판정은 gwimunExistence 체크가 담당.' } };
  }

  if (!text.includes('귀문')) {
    return { pass: true, details: { note: '귀문관살을 아예 언급하지 않음 — 이 체크는 해당 없음(N/A)' } };
  }

  const allPositions = ['year', 'month', 'day', 'hour'];

  const idx = text.indexOf('귀문');
  const windowStart = Math.max(0, idx - 60);
  const windowEnd = Math.min(text.length, idx + 200);
  const window = text.slice(windowStart, windowEnd);

  const mentionedPositions = allPositions.filter((pos) => {
    const label = positionLabelKo[pos];
    return window.includes(`${label}주`) || window.includes(`${label}지`);
  });

  const wrongPositions = mentionedPositions.filter((p) => !expectedPositions.has(p));
  const missingExpectedPositions = [...expectedPositions].filter((p) => !mentionedPositions.includes(p));

  return {
    pass: wrongPositions.length === 0,
    details: {
      expected_positions: [...expectedPositions],
      mentioned_positions: mentionedPositions,
      wrong_positions: wrongPositions,
      missing_expected_positions: missingExpectedPositions,
      window_excerpt: window,
    },
  };
}

/**
 * TEST 2 — 존재하지 않는 귀문관살을 실제로 "존재한다"고 단정하지 않는지 (또는 그 반대: 실제로
 * 존재하는데 없다고 부정하지 않는지).
 */
/**
 * "~수 있습니다"(가능성 표현)를 "귀문관살이 있다"(존재 단정)와 구분한다. 2026-08-17 실행에서 실제
 * 오탐 발견: "귀문관살은 유파에 따라 판정 범위가 달라질 수 있습니다"(순수 caveat 문장)가 존재
 * 단정으로 오인되어, 실제로는 정확히 "없다"고 답한 응답이 FAIL 처리된 사례.
 */
function textAssertsGwimunExistence(text) {
  let searchFrom = 0;
  while (true) {
    const idx = text.indexOf('귀문관살', searchFrom);
    if (idx === -1) return false;
    const afterStart = idx + 4;
    const boundaryMatch = text.slice(afterStart, afterStart + 40).search(/[.!?\n]/);
    const windowEnd = afterStart + (boundaryMatch === -1 ? 40 : boundaryMatch);
    const window = text.slice(afterStart, windowEnd);
    if (/해당|나타/.test(window)) return true;
    let iIdx = window.indexOf('있');
    while (iIdx !== -1) {
      const before = window.slice(Math.max(0, iIdx - 2), iIdx);
      if (!/수\s?$/.test(before)) return true; // "~수 있" 이 아니면 진짜 존재 단정으로 인정
      iIdx = window.indexOf('있', iIdx + 1);
    }
    searchFrom = idx + 4;
  }
}

export function checkGwimunExistenceConsistency(text, expected) {
  const actuallyExists = expected.gwimun.length > 0;
  const deniesExistence = /귀문관살[^.!?]{0,30}(없|아니)/.test(text) || /(없|아니)[^.!?]{0,10}귀문관살/.test(text);
  const assertsExistence = textAssertsGwimunExistence(text);

  // 명시적 부정("없습니다" 등)이 있으면, 다소 모호할 수 있는 assertsExistence 매칭보다 우선한다 —
  // 응답이 앞뒤가 안 맞게 동시에 긍정+부정을 단정할 가능성은 낮고, 대부분 검증기 쪽의 오탐이다.
  if (!actuallyExists && deniesExistence) {
    return { pass: true, details: { actually_exists: false, denies_existence: true, asserts_existence: assertsExistence, note: '명시적 부정 서술을 우선 인정함' } };
  }

  if (actuallyExists && deniesExistence && !assertsExistence) {
    return { pass: false, details: { reason: '실제로 귀문관살이 존재하는데(년지辰-월지亥) 없다고 서술함', actually_exists: true } };
  }
  if (!actuallyExists && assertsExistence && !isWithinQuotedSpan(text, text.indexOf('귀문'))) {
    return { pass: false, details: { reason: '실제로 귀문관살이 없는데 있다고 서술함', actually_exists: false } };
  }
  return { pass: true, details: { actually_exists: actuallyExists, denies_existence: deniesExistence, asserts_existence: assertsExistence } };
}

// 관계어(합/충/형/파/해/원진/귀문)는 한 글자만 보면 무관한 일반 단어와 자주 충돌한다.
// 2026-08-17 실행에서 실제 오탐 발견: "편인이 다시 결합합니다"의 "합"을 관계 유형 合으로 오인
// (실제로는 "결합하다"라는 일반 동사의 어미 "-합니다"였음). 아래 두 가지를 제외한다:
//   1. 관계어 바로 뒤에 "니다"/"니"가 붙는 경우 (동사 활용 어미 "-합니다"/"-합니" 패턴)
//   2. 관계어 바로 앞이 흔한 합성어 형성 글자인 경우 (결합/통합/종합/부합/적합/복합/화합/배합/융합 등)
const RELATION_WORD_VERB_ENDING_SUFFIXES = ['니다', '니'];
const RELATION_WORD_COMPOUND_PREFIXES = { 합: ['결', '통', '종', '부', '적', '복', '화', '배', '융', '연'] };

function isLikelyGenericWord(text, idx, word) {
  const after = text.slice(idx + word.length, idx + word.length + 2);
  if (RELATION_WORD_VERB_ENDING_SUFFIXES.some((suf) => after.startsWith(suf))) return true;
  const before = text.slice(Math.max(0, idx - 1), idx);
  const prefixes = RELATION_WORD_COMPOUND_PREFIXES[word];
  if (prefixes && prefixes.includes(before)) return true;
  return false;
}

/**
 * TEST 3 — 대운+세운 연결. 현재 대운 간지와 대상 연도 세운 간지가 둘 다 정확하게 언급되는지,
 * 그리고 실제로는 존재하지 않는(relations_to_major_period가 비어 있는) 대운-세운 간 형충합회
 * 관계를 지어내지 않는지 확인한다.
 */
export function checkDaewoonAnnualLink(text, expected) {
  const { currentMajorPeriod, targetAnnual } = expected;
  const majorGanziMentioned = text.includes(currentMajorPeriod.ganzi);
  const annualGanziMentioned = text.includes(targetAnnual.ganzi);

  const actualMajorAnnualRelations = [
    ...(targetAnnual.relations_to_major_period?.stem_relations ?? []),
    ...(targetAnnual.relations_to_major_period?.branch_relations ?? []),
  ];
  const hasRealRelation = actualMajorAnnualRelations.length > 0;

  const RELATION_WORDS = ['합', '충', '형', '파', '해', '원진', '귀문'];
  let claimedRelationWithoutBasis = null;
  if (!hasRealRelation) {
    for (const word of RELATION_WORDS) {
      let searchFrom = 0;
      while (true) {
        const idx = text.indexOf(word, searchFrom);
        if (idx === -1) break;
        if (isLikelyGenericWord(text, idx, word)) {
          searchFrom = idx + word.length;
          continue;
        }
        const windowStart = Math.max(0, idx - 60);
        const windowEnd = Math.min(text.length, idx + 60);
        const window = text.slice(windowStart, windowEnd);
        if (window.includes(currentMajorPeriod.ganzi) && window.includes(targetAnnual.ganzi)) {
          claimedRelationWithoutBasis = { word, context: window };
          break;
        }
        searchFrom = idx + word.length;
      }
      if (claimedRelationWithoutBasis) break;
    }
  }

  return {
    pass: majorGanziMentioned && annualGanziMentioned && !claimedRelationWithoutBasis,
    details: {
      expected_major_ganzi: currentMajorPeriod.ganzi,
      expected_annual_ganzi: targetAnnual.ganzi,
      major_ganzi_mentioned: majorGanziMentioned,
      annual_ganzi_mentioned: annualGanziMentioned,
      has_real_major_annual_relation: hasRealRelation,
      claimed_relation_without_basis: claimedRelationWithoutBasis,
    },
  };
}

/**
 * TEST 4 — 세운이 필요 없는(성격) 질문에서 라우팅/추출 단계가 annual_periods를 억지로 끌어오지
 * 않는지. 근본적으로 라우팅 문제이므로 텍스트가 아니라 실제 extracted_data를 기준으로 판단한다.
 */
export function checkNoUnnecessaryAnnualExtraction(extractedSaju, responseText) {
  const annualExtracted = Array.isArray(extractedSaju?.annual_periods) && extractedSaju.annual_periods.length > 0;
  const specificYearMentioned = /20[2-4]\d년/.test(responseText);

  return {
    pass: !annualExtracted,
    details: {
      annual_periods_extracted: annualExtracted,
      extracted_count: extractedSaju?.annual_periods?.length ?? 0,
      specific_year_mentioned_in_response: specificYearMentioned,
      note: annualExtracted
        ? '성격 질문에 annual_periods가 추출됨 — 라우터가 불필요하게 세운 데이터를 끌어온 것으로 판단'
        : '성격 질문에 annual_periods가 추출되지 않음 — 올바른 라우팅',
    },
  };
}

/**
 * TIMING TEST — "시기가 언제인지" 묻는 질문에 실제로 구체적 시점(연도 또는 나이)을 제시했는지.
 * 시기를 묻는 질문에 시기 없이 성향 설명만 하고 끝나면 FAIL.
 */
export function checkTimingProvided(text) {
  const hasYear = /20[2-4]\d년/.test(text);
  const hasAge = /\d{1,2}\s*(살|세)/.test(text);
  const pass = hasYear || hasAge;
  return { pass, details: { hasYear, hasAge, note: pass ? '구체적 시점(연도/나이)이 제시됨' : '시기를 묻는 질문인데 구체적 시점이 전혀 없음' } };
}

/**
 * TIMING TEST — "장기 변화 시기"처럼 비교가 필요한 질문에서 서로 다른 연도 2개 이상을 실제로
 * 비교했는지. 한 해만 언급하고 "우선순위/비교" 자체를 안 했으면 FAIL.
 */
export function checkMultipleYearsCompared(text) {
  const years = [...new Set((text.match(/20[2-4]\d년/g) ?? []))];
  const pass = years.length >= 2;
  return { pass, details: { distinctYearsMentioned: years, note: pass ? `${years.length}개의 서로 다른 연도를 비교함` : '서로 다른 연도가 2개 미만 — 비교가 이루어지지 않음' } };
}

/**
 * TIMING TEST — 영역(직업/돈 등)+시기 결합 질문에서, 시기 데이터 없이 성격/성향 설명으로만
 * 답을 채우고 끝나지 않았는지(회피 패턴 탐지).
 */
export function checkNotPersonalityOnlyAnswer(text) {
  const hasTimingSignal = /20[2-4]\d년|\d{1,2}\s*(살|세)|대운|세운/.test(text);
  return { pass: hasTimingSignal, details: { hasTimingSignal, note: hasTimingSignal ? '시기 관련 신호가 포함됨' : '시기 언급 없이 성격/성향 설명으로만 답변 — 질문 회피 의심' } };
}

