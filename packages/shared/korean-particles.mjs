// packages/shared/korean-particles.mjs
//
// 한국어 조사(은/는, 이/가, 을/를, 와/과) 자동 선택 유틸 — 여러 모듈(compatibility-explanation.mjs,
// child-growth-analysis.mjs)에서 공통으로 쓰기 위해 분리했다. 로직 자체는 원래
// compatibility-explanation.mjs에 있던 것을 그대로 옮긴 것이며(동작 변경 없음), 여기에 이번에
// child-growth-analysis.mjs가 필요로 하는 와/과(gwaWa)만 추가했다.
//
// "목(木)"처럼 괄호가 붙은 용어는 괄호 앞부분("목")만 보고 받침을 판단해야 한다 — 괄호까지 포함해서
// 보면 마지막 글자가 ")"가 되어 항상 "받침 없음"으로 잘못 판정되는 버그가 실제로 있었다(예:
// "목(木)는"이 되어야 할 게 아니라 "목(木)은"이 맞는데 거꾸로 나왔던 사례, compatibility-explanation
// 구현 중 실측으로 발견).

export function coreTextForParticle(text) {
  const parenIdx = text.indexOf('(');
  return parenIdx === -1 ? text.trim() : text.slice(0, parenIdx).trim();
}

export function hasFinalConsonant(text) {
  const core = coreTextForParticle(text);
  const lastChar = core.at(-1);
  if (!lastChar) return false;
  const code = lastChar.charCodeAt(0);
  if (code < 0xac00 || code > 0xd7a3) return false; // 한글 완성형 범위 밖(숫자/영문 등)이면 받침 없다고 간주
  return (code - 0xac00) % 28 !== 0;
}

export function eunNeun(text) { return hasFinalConsonant(text) ? '은' : '는'; }
export function iGa(text) { return hasFinalConsonant(text) ? '이' : '가'; }
export function eulReul(text) { return hasFinalConsonant(text) ? '을' : '를'; }
// 신규 — child-growth-analysis.mjs가 필요로 함("~과(와) 관련된" 표현).
export function gwaWa(text) { return hasFinalConsonant(text) ? '과' : '와'; }
