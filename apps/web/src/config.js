// apps/web/src/config.js
//
// UX 튜닝 상수. "실제 서비스에서 데이터를 보고 조정할 수 있도록" 한 곳에 모아둔다.

export const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:3000';

// Toss Payments 클라이언트 키 — secret key와 달리 프론트에 노출되어도 안전한 공개 키다.
export const TOSS_CLIENT_KEY = import.meta.env.VITE_TOSS_CLIENT_KEY ?? '';

// 캐릭터 응답을 typing indicator로 감춰두는 최소/최대 시간.
// response_time < MIN_DELAY  -> MIN_DELAY까지 채워서 표시
// response_time >= MIN_DELAY -> 즉시 표시 (단, MAX_DELAY는 절대 넘기지 않음)
export const CHARACTER_RESPONSE_MIN_DELAY_MS = 900;
export const CHARACTER_RESPONSE_MAX_DELAY_MS = 2000;

// 긴 답변일수록 타이핑 시간이 살짝 길게 느껴지도록 하는 보정치 (상한은 MAX_DELAY로 항상 clamp됨).
export const TYPING_DELAY_PER_100_CHARS_MS = 60;

// 한 번에 보여줄 선택지(quick reply chip) 최대 개수.
// 원본 기획서(ai-fortune-telling-ui-ux.md) §6: "질문 선택지는 최대 2~3개 정도만 보여준다."
export const MAX_QUICK_REPLIES = 3;
