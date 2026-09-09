// packages/shared/korean-sound-element.mjs
//
// §작명소 — 발음오행(소리오행) 계산. 한글 초성(첫 자음)을 오행에 대응시키는 표준 국어
// 음운학 규칙(작고 고정된 19개 매핑 테이블) — 이건 "대량 외부 한자 데이터"가 아니라
// 결정론적 규칙표다. 획수/자원오행(한자 기반 수리격)은 신뢰할 수 있는 인명용 한자
// 사전이 이 프로젝트에 없으므로 계산하지 않는다(§작명 지시 — 대량 한자 데이터 신규
// 반입 금지, 가장 작은 범위로 구현).
//
// 초성 -> 오행 매핑(표준 훈민정음 발음오행 이론):
//   ㄱ,ㅋ -> 목(wood)      ㄴ,ㄷ,ㄹ,ㅌ -> 화(fire)
//   ㅁ,ㅂ,ㅍ -> 수(water)   ㅅ,ㅈ,ㅊ -> 금(metal)
//   ㅇ,ㅎ -> 토(earth)
const CHOSUNG_TO_ELEMENT = {
  ㄱ: 'wood', ㅋ: 'wood',
  ㄴ: 'fire', ㄷ: 'fire', ㄹ: 'fire', ㅌ: 'fire',
  ㅁ: 'water', ㅂ: 'water', ㅍ: 'water',
  ㅅ: 'metal', ㅈ: 'metal', ㅊ: 'metal',
  ㅇ: 'earth', ㅎ: 'earth',
};

const CHOSUNG_LIST = ['ㄱ', 'ㄲ', 'ㄴ', 'ㄷ', 'ㄸ', 'ㄹ', 'ㅁ', 'ㅂ', 'ㅃ', 'ㅅ', 'ㅆ', 'ㅇ', 'ㅈ', 'ㅉ', 'ㅊ', 'ㅋ', 'ㅌ', 'ㅍ', 'ㅎ'];
const DOUBLED_TO_BASE = { ㄲ: 'ㄱ', ㄸ: 'ㄷ', ㅃ: 'ㅂ', ㅆ: 'ㅅ', ㅉ: 'ㅈ' };

function extractChosung(char) {
  const code = char.codePointAt(0);
  if (code < 0xAC00 || code > 0xD7A3) return null;
  const chosungIndex = Math.floor((code - 0xAC00) / (21 * 28));
  return CHOSUNG_LIST[chosungIndex] ?? null;
}

export function computeSoundElementDistribution(nameText) {
  const distribution = { wood: 0, fire: 0, earth: 0, metal: 0, water: 0 };
  for (const char of nameText) {
    let chosung = extractChosung(char);
    if (!chosung) continue;
    if (DOUBLED_TO_BASE[chosung]) chosung = DOUBLED_TO_BASE[chosung];
    const element = CHOSUNG_TO_ELEMENT[chosung];
    if (element) distribution[element] += 1;
  }
  return distribution;
}

export function computeSoundElementSequence(fullNameText) {
  const sequence = [];
  for (const char of fullNameText) {
    let chosung = extractChosung(char);
    if (!chosung) continue;
    if (DOUBLED_TO_BASE[chosung]) chosung = DOUBLED_TO_BASE[chosung];
    const element = CHOSUNG_TO_ELEMENT[chosung];
    if (element) sequence.push({ syllable: char, element });
  }
  return sequence;
}
