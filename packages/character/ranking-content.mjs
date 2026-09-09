// packages/character/ranking-content.mjs
//
// ⚠️ 게임화된 엔터테인먼트 콘텐츠 — 실제 명리학적 판단이 아니다. 기존 funContentData.js(사주
// 세계관 탐험)와 동일한 원칙: "실제 사람을 진지하게 서열화하는 느낌보다는 재미로 설계"
// (Signalroom V2 문서 §12). 원본 saju-original.md/ziwei-original.md 파이프라인을 거치지 않는다.
//
// 단, 완전 무작위가 아니라 사용자의 실제 canonical chart(계산 엔진이 만든 진짜 데이터)를 시드로 써서
// **같은 사람은 항상 같은 결과**가 나오게 만들었다 — 이건 "사주 판단"이 아니라 "그 사람 고유의
// 시드로 재미 콘텐츠를 안정적으로 생성"하는 것뿐이다. 새로운 명리학적 알고리즘을 만든 게 아니다.

const WEALTH_TITLES = [
  { min: 90, title: '재물왕', emoji: '👑' },
  { min: 70, title: '금수저 기질', emoji: '💰' },
  { min: 50, title: '축재형', emoji: '💵' },
  { min: 30, title: '알뜰 관리형', emoji: '🪙' },
  { min: 0, title: '느긋한 소비형', emoji: '🌱' },
];

const BUSINESS_TITLES = [
  { min: 90, title: '사업가형', emoji: '🚀' },
  { min: 70, title: '창업가형', emoji: '💡' },
  { min: 50, title: '전략가형', emoji: '♟️' },
  { min: 30, title: '실무형', emoji: '🛠️' },
  { min: 0, title: '안정 추구형', emoji: '🏡' },
];

export const RANKING_CATEGORIES = [
  { key: 'wealth', label: '재물운', titles: WEALTH_TITLES },
  { key: 'business', label: '사업운', titles: BUSINESS_TITLES },
];

/** 문자열을 0~99 사이 안정적인 숫자로 변환(간단한 해시) — 같은 입력이면 항상 같은 출력. */
function stableScore(seed) {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    hash = (hash * 31 + seed.charCodeAt(i)) >>> 0;
  }
  return hash % 100;
}

function pickTitle(titles, score) {
  return titles.find((t) => score >= t.min) ?? titles.at(-1);
}

/**
 * @param {object} canonical - 실제 Canonical Chart JSON (계산 엔진 결과, 시드로만 사용)
 * @param {string} categoryKey - 'wealth' | 'business'
 * @returns {{ score: number, percentile: number, title: string, emoji: string }}
 */
export function generateRankingResult(canonical, categoryKey) {
  const category = RANKING_CATEGORIES.find((c) => c.key === categoryKey) ?? RANKING_CATEGORIES[0];
  // 일간(day_master)+4주 간지를 시드 문자열로 사용 — 실제 계산된 값이라 사람마다 자연히 달라진다.
  const pillars = canonical?.saju?.pillars ?? [];
  const seed = `${categoryKey}:${canonical?.saju?.day_master?.stem ?? ''}:${pillars.map((p) => p.ganzi).join('')}`;
  const score = stableScore(seed);
  const picked = pickTitle(category.titles, score);
  return { score, percentile: 100 - score, title: picked.title, emoji: picked.emoji, categoryLabel: category.label };
}
