// apps/web/src/hooks/useTypingDelay.js
import { CHARACTER_RESPONSE_MIN_DELAY_MS, CHARACTER_RESPONSE_MAX_DELAY_MS, TYPING_DELAY_PER_100_CHARS_MS } from '../config.js';

/**
 * 실제 API 응답 시간과 별개로, 사용자에게 "타이핑 중"으로 보여줄 시간을 계산한다.
 *   - API가 이미 MIN_DELAY 이상 걸렸으면 추가 대기 없이 즉시 표시.
 *   - API가 더 빨랐으면 MIN_DELAY까지만 채운다.
 *   - 긴 답변은 살짝 더 길게(단, MAX_DELAY 상한 고정).
 */
export function computeTypingDelay({ elapsedMs, responseLength = 0 }) {
  const lengthBonus = Math.floor((responseLength / 100) * TYPING_DELAY_PER_100_CHARS_MS);
  const target = Math.min(CHARACTER_RESPONSE_MIN_DELAY_MS + lengthBonus, CHARACTER_RESPONSE_MAX_DELAY_MS);
  return Math.max(0, target - elapsedMs);
}

export function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
