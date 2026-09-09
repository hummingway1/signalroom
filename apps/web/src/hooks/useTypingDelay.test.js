// apps/web/src/hooks/useTypingDelay.test.js
import { describe, it, expect } from 'vitest';
import { computeTypingDelay } from './useTypingDelay.js';

describe('computeTypingDelay', () => {
  it('API가 매우 빨랐으면(0ms) MIN_DELAY만큼 대기시킨다', () => {
    const delay = computeTypingDelay({ elapsedMs: 0, responseLength: 0 });
    expect(delay).toBeGreaterThanOrEqual(800);
    expect(delay).toBeLessThanOrEqual(1000);
  });

  it('API가 이미 MIN_DELAY 이상 걸렸으면 추가 대기 없이 즉시 표시(0)한다', () => {
    const delay = computeTypingDelay({ elapsedMs: 5000, responseLength: 0 });
    expect(delay).toBe(0);
  });

  it('긴 답변일수록 타이핑 시간이 살짝 길어지되 MAX_DELAY를 넘기지 않는다', () => {
    const shortDelay = computeTypingDelay({ elapsedMs: 0, responseLength: 50 });
    const longDelay = computeTypingDelay({ elapsedMs: 0, responseLength: 2000 });
    expect(longDelay).toBeGreaterThanOrEqual(shortDelay);
    expect(longDelay).toBeLessThanOrEqual(2000);
  });

  it('절대 음수를 반환하지 않는다', () => {
    const delay = computeTypingDelay({ elapsedMs: 999999, responseLength: 5000 });
    expect(delay).toBeGreaterThanOrEqual(0);
  });
});
