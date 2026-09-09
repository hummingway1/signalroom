// apps/web/src/utils/splitIntoBubbles.js
//
// §17 — 긴 AI 응답(30자 초과)을 여러 채팅 bubble로 나눈다. API 호출은 이미 끝난 뒤 받은 텍스트
// "하나"를 프론트에서만 쪼개는 것이지, 추가 API 호출을 하지 않는다.
// 우선순위: 줄바꿈이 있으면 줄바꿈 기준. 없으면 문장(마침표/물음표) 기준으로 나누되, 너무 잘게
// 쪼개진 조각은 다음 조각과 합쳐서 20자 미만짜리 bubble이 남발되지 않게 한다.
export function splitIntoBubbles(text) {
  if (!text || text.length <= 30) return [text];

  const byNewline = text
    .split(/\n+/)
    .map((s) => s.trim())
    .filter(Boolean);
  if (byNewline.length > 1) return byNewline;

  const sentences = text
    .split(/(?<=[.?])\s+/)
    .map((s) => s.trim())
    .filter(Boolean);
  if (sentences.length <= 1) return [text];

  const merged = [];
  let buf = '';
  for (const s of sentences) {
    buf = buf ? `${buf} ${s}` : s;
    if (buf.length >= 20) {
      merged.push(buf);
      buf = '';
    }
  }
  if (buf) merged.push(buf);
  return merged.length > 0 ? merged : [text];
}
