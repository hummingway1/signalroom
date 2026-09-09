// apps/api/src/middleware/rate-limit.mjs
//
// AI 호출이 발생하는 모든 엔드포인트에 공통 적용하는 IP 레벨 rate limit.
//
// 중요: "폭탄 메시지로 과금을 노리는" 위험은 캐주얼 AI(저가 nano 모델, 시간당 1원 미만)보다
// **사주 분석 경로**(원본 프롬프트 2개 통째로 포함, 질문 1개당 5~15센트 수준)가 압도적으로 크다.
// 그래서 이 rate limit은 캐주얼 전용이 아니라 AI를 호출하는 모든 라우트(POST /messages,
// POST /catalog-choice, POST /:id/questions)에 공통으로 건다 — 캐주얼 기능 추가를 계기로 만들지만
// 실질적으로는 전체 시스템의 방어선이다.

import rateLimit from 'express-rate-limit';

// 한 IP가 짧은 시간에 폭탄처럼 연타하는 것을 막는 1차 방어선 (초 단위 버스트 제한).
export const burstLimiter = rateLimit({
  windowMs: 10_000, // 10초
  max: 5, // 10초에 5회 초과 시 차단
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: { code: 'RATE_LIMITED', message: '너무 빠르게 요청하고 있습니다. 잠시 후 다시 시도해주세요.' } },
});

// 분 단위 지속적인 남용을 막는 2차 방어선.
export const sustainedLimiter = rateLimit({
  windowMs: 60_000, // 1분
  max: 20, // 분당 20회 초과 시 차단 — 정상적인 대화 속도(수 초~수십 초당 1메시지)로는 절대 도달하지 않는 값
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: { code: 'RATE_LIMITED', message: '요청이 너무 많습니다. 잠시 후 다시 시도해주세요.' } },
});
