// apps/api/src/server.mjs
import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import { chartsRouter } from './routes/charts.mjs';
import { conversationsRouter } from './routes/conversations.mjs';
import { usersRouter } from './routes/users.mjs';
import { rankingRouter } from './routes/ranking.mjs';
import { compatibilityRouter } from './routes/compatibility.mjs';
import { yearlyFortuneRouter } from './routes/yearly-fortune.mjs';
import { birthSelectionRouter } from './routes/birth-selection.mjs';
import { childProfilesRouter } from './routes/child-profiles.mjs';
import { authRouter } from './routes/auth.mjs';
import { productsRouter } from './routes/products.mjs';
import { ordersRouter } from './routes/orders.mjs';
import { paymentsRouter } from './routes/payments.mjs';
import { attachSession } from './middleware/session.mjs';
import { createAIProvider } from '../../../packages/ai/create-provider.mjs';
import { OpenAIProvider } from '../../../packages/ai/providers/openai-provider.mjs';
import { burstLimiter, sustainedLimiter } from './middleware/rate-limit.mjs';
import { loadEnvFile } from '../../../packages/shared/load-env.mjs';

// .env 파일을 process.env로 로드한다 — 아래 MODEL/CASUAL_MODEL/CHILD_COACH_MODEL이 이 값들을
// process.env에서 읽기 "이전"에 반드시 먼저 실행되어야 한다. 이 호출이 빠지면 .env에 값이 있어도
// 전부 MockAIProvider로 폴백된다(실사용자 리포트로 여러 차례 확인된 문제 — 다시는 누락되지 않도록
// 이 파일 자체에 영구 반영. 이전엔 로컬에서만 수동으로 추가됐다가 새 배포본에 계속 유실됐었음).
await loadEnvFile();

const PORT = process.env.PORT ?? 3000;
const MODEL = process.env.OPENAI_MODEL ?? 'mock';
const CASUAL_MODEL = process.env.OPENAI_CASUAL_MODEL ?? null;
// "우리 아이 성장 코치" 전용 모델. §12 — 최저가 모델을 무조건 쓰지 않는다. env 미설정이면
// casualAiProviderFactory로 폴백(conversation-service.mjs가 처리) — 하드코딩된 모델명 없음.
const CHILD_COACH_MODEL = process.env.OPENAI_CHILD_COACH_MODEL ?? null;

const app = express();
app.use(cors({ origin: true, credentials: true })); // credentials:true 필요 — 세션 쿠키를 프론트로 주고받으려면 CORS가 특정 origin을 반영해야 한다(origin:true는 요청 origin을 그대로 echo).
app.use(express.json({ limit: '2mb' }));
app.use(cookieParser());
app.use(attachSession()); // STEP 3 신규 — 쿠키에 세션이 있으면 req.user를 채운다(없어도 통과, 비로그인 익명 이용 허용)

// AI를 호출하는 모든 라우트에 공통 rate limit — 폭탄 메시지로 과금을 유도하는 남용의 1차 방어선.
// 캐주얼 리액션(저가 모델, 시간당 1원 미만)보다 사주 분석 경로(질문당 5~15센트 수준)가 실질적으로
// 훨씬 위험하므로, 캐주얼 전용이 아니라 이 셋 전부에 건다.
app.use('/api/conversations/:id/messages', burstLimiter, sustainedLimiter);
app.use('/api/conversations/:id/catalog-choice', burstLimiter, sustainedLimiter);
app.use('/api/conversations/:id/child-catalog-choice', burstLimiter, sustainedLimiter);
app.use('/api/charts/:id/questions', burstLimiter, sustainedLimiter);

// Provider is created per-request (not a shared singleton) so a MockAIProvider's
// callLog stays clean per call and API-key rotation works without a restart.
const aiProviderFactory = () => createAIProvider(process.env);

// 캐주얼 리액션 전용 저가 모델 provider. OPENAI_API_KEY와 OPENAI_CASUAL_MODEL을 **둘 다** 명시적으로
// 설정한 경우에만 실제 AI를 쓴다. 그 외(키 없음/모델 미설정)에는 항상 null을 반환해서
// packages/character/casual-response-engine.mjs(규칙 기반, API 호출 0회)가 담당하게 한다.
// 2026-08-22 발견: 이전에는 "키가 없으면 MockAIProvider"로 폴백했는데, 그러면 로컬 개발/무키 환경에서
// 항상 MockAIProvider의 고정 mock 텍스트만 나오고 실제로 개선한 규칙 기반 엔진이 전혀 안 보였다 —
// 실사용(키+모델 둘 다 설정)과 무키 개발 환경 둘 다에서 일관되게 새 엔진이 기본으로 동작하도록 수정.
function casualAiProviderFactory() {
  if (!process.env.OPENAI_API_KEY || !CASUAL_MODEL) return null;
  return new OpenAIProvider({ apiKey: process.env.OPENAI_API_KEY, model: CASUAL_MODEL });
}

// 성장 코치 전용 provider. 미설정이면 null 반환 → conversation-service.mjs가 casualAiProvider로
// 자동 폴백(하위 호환, "우리 아이 성장 코치" 전용 모델 없이도 서비스는 계속 동작).
function childCoachAiProviderFactory() {
  if (!process.env.OPENAI_API_KEY || !CHILD_COACH_MODEL) return null;
  return new OpenAIProvider({ apiKey: process.env.OPENAI_API_KEY, model: CHILD_COACH_MODEL });
}

app.get('/health', (req, res) => {
  const usingMock = !(process.env.OPENAI_API_KEY && process.env.OPENAI_MODEL);
  res.json({
    ok: true,
    aiProvider: usingMock ? 'mock' : 'openai',
    model: usingMock ? null : MODEL,
    casualModel: process.env.OPENAI_API_KEY && CASUAL_MODEL ? CASUAL_MODEL : 'disabled — using casual-response-engine (rule-based, no API calls)',
  });
});

app.use('/api/charts', chartsRouter({ aiProviderFactory, model: MODEL, basicAiProviderFactory: childCoachAiProviderFactory, basicModel: CHILD_COACH_MODEL ?? 'unknown' }));
app.use('/api/conversations', conversationsRouter({ aiProviderFactory, model: MODEL, casualAiProviderFactory, casualModel: CASUAL_MODEL ?? 'mock', childCoachAiProviderFactory, childCoachModel: CHILD_COACH_MODEL ?? 'fallback-to-casual' }));
app.use('/api/users', usersRouter());
app.use('/api/ranking', rankingRouter());
app.use('/api/compatibility', compatibilityRouter({ basicAiProviderFactory: childCoachAiProviderFactory, fullAiProviderFactory: aiProviderFactory }));
app.use('/api/yearly-fortune', yearlyFortuneRouter({ basicAiProviderFactory: childCoachAiProviderFactory, detailAiProviderFactory: aiProviderFactory }));
app.use('/api/birth-selection', birthSelectionRouter({ aiProviderFactory }));
app.use('/api/child-profiles', childProfilesRouter({ basicAiProviderFactory: childCoachAiProviderFactory, fullAiProviderFactory: aiProviderFactory }));
app.use('/api/auth', authRouter({ frontendBaseUrl: process.env.FRONTEND_BASE_URL ?? 'http://localhost:5173' }));
app.use('/api/products', productsRouter());
app.use('/api/orders', ordersRouter());
app.use('/api/payments', paymentsRouter());

app.use((err, req, res, _next) => {
  console.error(err);
  res.status(500).json({ error: { code: 'UNHANDLED_ERROR', message: err.message } });
});

app.listen(PORT, () => {
  const usingMock = !(process.env.OPENAI_API_KEY && process.env.OPENAI_MODEL);
  console.log(`saju-ziwei-ai-app-mvp API listening on http://localhost:${PORT}`);
  console.log(`AI provider: ${usingMock ? 'MockAIProvider (OPENAI_API_KEY/OPENAI_MODEL not set)' : `OpenAIProvider (${MODEL})`}`);
  console.log(`Casual AI: ${process.env.OPENAI_API_KEY && CASUAL_MODEL ? `OpenAIProvider (${CASUAL_MODEL})` : 'casual-response-engine (rule-based, no API calls — set OPENAI_CASUAL_MODEL to use a real cheap model instead)'}`);
});
