// packages/character/compatibility-content.mjs
//
// ⚠️ 게임화된 엔터테인먼트 콘텐츠 — 실제 두 사람의 명리학적 궁합 계산이 아니다. 두 사람의 canonical
// chart(실제 계산 엔진 결과)를 시드로만 사용해 안정적인(같은 두 사람이면 항상 같은) 재미 콘텐츠를
// 생성한다. 진짜 궁합 계산(십신/오행 상생상극 기반)은 packages/canonical/*, packages/chart-engine/*에
// 구현되어 있지 않으므로, 이걸 만든 척 새 명리학적 판단 로직을 지어내지 않는다 — 대신 명확히
// "재미 콘텐츠"로 라벨링한다(Signalroom V2 문서 §13/§12 원칙과 동일).

const COMPAT_MESSAGES = [
  { min: 85, label: '천생연분?', emoji: '💞', note: '서로 다른 부분마저 잘 맞물리는 조합이에요. 대화가 잘 통할 가능성이 높아요.' },
  { min: 65, label: '케미 좋음', emoji: '✨', note: '비슷한 리듬을 가진 편이라 편하게 지낼 수 있는 조합이에요.' },
  { min: 45, label: '노력형 궁합', emoji: '🌱', note: '서로 다른 스타일이라 이해하려는 노력이 필요하지만, 그만큼 배울 게 많은 조합이에요.' },
  { min: 25, label: '반전 매력', emoji: '🎭', note: '정반대라 부딪힐 수도 있지만, 그게 오히려 재미있는 케미가 될 수도 있어요.' },
  { min: 0, label: '개성 폭발', emoji: '🌀', note: '둘 다 자기 색이 뚜렷한 편이라 서로의 공간을 존중하는 게 중요한 조합이에요.' },
];

function stableScore(seed) {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) hash = (hash * 31 + seed.charCodeAt(i)) >>> 0;
  return hash % 100;
}

/**
 * @param {object} canonicalA
 * @param {object} canonicalB
 * @returns {{ score: number, label: string, emoji: string, note: string }}
 */
export function generateCompatibilityResult(canonicalA, canonicalB) {
  const seedOf = (c) => `${c?.saju?.day_master?.stem ?? ''}:${(c?.saju?.pillars ?? []).map((p) => p.ganzi).join('')}`;
  // 순서에 상관없이 항상 같은 점수가 나오도록 두 시드를 정렬해서 합친다.
  const seeds = [seedOf(canonicalA), seedOf(canonicalB)].sort();
  const score = stableScore(seeds.join('|'));
  const matched = COMPAT_MESSAGES.find((m) => score >= m.min) ?? COMPAT_MESSAGES.at(-1);
  return { score, label: matched.label, emoji: matched.emoji, note: matched.note };
}
