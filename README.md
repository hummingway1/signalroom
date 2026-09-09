# saju-ziwei-ai-app-mvp

생년월일시·출생지를 입력하면 사주팔자·자미두수를 계산하고, 사용자가 자유롭게 질문하면 그 질문에 필요한
데이터만 골라 사주/자미두수 관점으로 해석해서 대화형으로 답하는 서비스의 실행 가능한 MVP다.

**서양 점성술은 이 프로젝트에서 완전히 제외한다.** 웹 UI, 회원가입, 결제, 실제 DB는 아직 없다 — 이 단계의
목표는 "계산 → Canonical JSON → 질문 라우팅 → 데이터 추출 → 사주/자미두수 해석 → 교차분석 → 대화형 응답"
파이프라인이 실제로 동작하는 API로 검증되는 것이다.

## 목차

1. [전체 시스템 구조](#1-전체-시스템-구조)
2. [빠른 시작](#2-빠른-시작)
3. [폴더 구조와 각 폴더의 역할](#3-폴더-구조와-각-폴더의-역할)
4. [원본 프롬프트 vs Runtime Adapter](#4-원본-프롬프트-vs-runtime-adapter)
5. [Canonical JSON의 역할](#5-canonical-json의-역할)
6. [질문 Router의 역할](#6-질문-router의-역할)
7. [Cross Analysis의 역할](#7-cross-analysis의-역할)
8. [대화 메모리 구조](#8-대화-메모리-구조)
9. [AI 비용 구조](#9-ai-비용-구조)
10. [AI Provider 교체 방법](#10-ai-provider-교체-방법)
11. [계산 엔진 교체 방법](#11-계산-엔진-교체-방법)
12. [테스트](#12-테스트)
13. [AGPL-3.0 라이선스 주의사항](#13-agpl-30-라이선스-주의사항)
14. [실제 AI 품질 평가](#14-실제-ai-품질-평가-real-ai-evaluationmd)
15. [현재 상태 / 다음 단계](#15-현재-상태--다음-단계)

---

## 1. 전체 시스템 구조

```
사용자 입력 (생년월일시·성별·출생지)
        │  POST /api/charts
        ▼
[CALCULATION]  packages/chart-engine/compute.mjs  (@orrery/core — 사주+자미두수만, natal 제외)
        ▼
[CANONICAL DATA]  packages/canonical/transform.mjs → schemas/canonical-chart-schema.json으로 검증
        ▼
   (서버에 원본 그대로 저장 — apps/api/src/repositories/chart-repository.mjs)
        │
        │  POST /api/charts/:id/questions  또는  POST /api/conversations/:id/messages
        ▼
[QUESTION ROUTING]      packages/ai/pipeline.mjs Stage 1 — AI 호출 1회
        ▼
[RELEVANT DATA EXTRACTION]  packages/canonical/extract.mjs — 순수 코드, AI 호출 없음
        ▼
[SAJU + ZIWEI + CROSS ANALYSIS + RESPONSE]  packages/ai/pipeline.mjs Stage 3 — AI 호출 1회
   (system prompt = prompts/runtime/safety.md + saju.md[adapter+원본] + ziwei.md[adapter+원본]
                    + cross-analysis.md + conversation.md)
        ▼
[CONVERSATIONAL RESPONSE]  사용자에게 반환 + Conversation/Message/Analysis로 저장
```

한 번의 질문에 AI 호출은 **2번**만 일어난다 (Router 1회 + 통합분석 1회). 자세한 이유는
[§9 AI 비용 구조](#9-ai-비용-구조) 참고.

---

## 2. 빠른 시작

```bash
npm install
cp .env.example .env   # 비워두면 자동으로 MockAIProvider 사용 (API 키 불필요)

npm test                    # 42개 테스트 전체 실행
npm run validate:canonical  # 예시 Canonical JSON 스키마 검증
npm run mock:pipeline       # 질문 4개로 전체 파이프라인 mock 실행 (콘솔 출력)
npm run dev                 # API 서버 기동 (http://localhost:3000)
```

`npm run dev` 실행 후 다른 터미널에서:

```bash
# 1) 차트 생성
curl -X POST http://localhost:3000/api/charts \
  -H "Content-Type: application/json" \
  -d '{"birthDate":"2026-08-06","birthTime":"10:59","gender":"male","city":"Incheon"}'
# → { "id": "...", "canonical": {...} }

# 2) 질문 (위에서 받은 id 사용)
curl -X POST http://localhost:3000/api/charts/<CHART_ID>/questions \
  -H "Content-Type: application/json" \
  -d '{"question":"내가 사업을 하는 게 직장생활보다 맞을까?"}'
# → { "conversationId": "...", "response": "...", ... }

# 3) 후속 질문 (대화 이어가기)
curl -X POST http://localhost:3000/api/conversations/<CONVERSATION_ID>/messages \
  -H "Content-Type: application/json" \
  -d '{"question":"그럼 어떤 사업이 맞을까?"}'
```

`OPENAI_API_KEY`/`OPENAI_MODEL`을 `.env`에 채우면 자동으로 실제 OpenAI Responses API를 쓰는
`OpenAIProvider`로 전환된다 (`packages/ai/create-provider.mjs`). 채우지 않으면 `MockAIProvider`가 응답
전체를 `[MOCK]`으로 채워서 반환한다 — 개발/테스트에 API 비용이 전혀 들지 않는다.

### 웹 UI (채팅 화면) 실행

```bash
# 터미널 1 — 백엔드 (위 npm run dev와 동일)
npm run dev

# 터미널 2 — 프론트엔드
cd apps/web
npm install
npm run dev   # http://localhost:5173
```

브라우저에서 `http://localhost:5173` 접속 → 생년월일시 입력 → 대구/맹구와 채팅 시작. 백엔드가
`http://localhost:3000`이 아닌 다른 주소에 있으면 `apps/web/.env`에 `VITE_API_BASE_URL`을 설정한다.

---

## 3. 폴더 구조와 각 폴더의 역할

```
saju-ziwei-ai-app-mvp/
├── apps/
│   ├── api/src/
│   │   ├── server.mjs              Express 서버 진입점
│   │   ├── routes/                 HTTP 라우트 (charts, conversations)
│   │   ├── services/                비즈니스 로직 (chart-service, conversation-service)
│   │   └── repositories/            엔티티별 데이터 접근 (User/Chart/Conversation/Message/Analysis)
│   └── web/                        (미구현 — README만 존재, §14 참고)
│
├── packages/
│   ├── chart-engine/               @orrery/core 계산 엔진 래퍼 (사주+자미두수만)
│   ├── canonical/                  Canonical JSON 변환 + 스키마 검증
│   ├── ai/                         Question Router, 파이프라인, AI Provider 추상화
│   └── shared/                     여러 패키지가 공유하는 상수/유틸 (카테고리 enum, JSON 저장소)
│
├── prompts/
│   ├── originals/                   원본 프롬프트 정본 — 절대 수정하지 않음 (§4 참고)
│   └── runtime/                     실행 시 시스템 프롬프트를 구성하는 adapter + 서비스 공통 규칙
│
├── schemas/canonical-chart-schema.json   Canonical JSON 표준 스키마 (엔진 독립적)
├── data/                            예시 데이터 + (실행 시 생성되는) JSON 파일 DB
├── tests/                           42개 자동화 테스트
├── scripts/                         CLI 유틸리티 (검증, mock 파이프라인 실행 등)
├── CHANGELOG.md                     구조 변경/판단 기록
└── README.md                        이 문서
```

이 구조는 스펙이 제안한 `apps/web`, `apps/api`, `packages/chart-engine`, `packages/canonical`,
`packages/ai`, `packages/shared`를 그대로 따랐다. 다만 스펙이 예시로 든 npm workspaces 기반 진짜
모노레포(패키지마다 별도 `package.json`) 대신, **루트에 단일 `package.json`**을 두고 폴더로만 관심사를
분리했다 — 이유는 CHANGELOG에 기록:

> 이번 MVP는 웹 UI가 없고 배포 단위가 API 서버 하나뿐이라, 워크스페이스마다 버전을 독립적으로 관리해야
> 할 실익이 없다. `npm install`/`npm test`가 즉시 동작하는 단순함이 지금 단계에서는 더 중요하다고
> 판단했다. 나중에 `apps/web`이 실제로 생기고 별도 배포 파이프라인이 필요해지면 그때 workspaces로
> 전환하는 것을 권장한다 (폴더 구조 자체는 이미 workspaces 전환에 맞게 나뉘어 있다).

---

## 4. 원본 프롬프트 vs Runtime Adapter

**`prompts/originals/`** — 사용자가 제공한 원본 프롬프트 전문을 **한 글자도 수정하지 않고** 보존하는
곳이다.

- `saju-original.md` — "전통 명리학 (사주) 통합 해석 프롬프트" 원문. **반영 완료.**
- `ziwei-original.md` — "AI가 읽는 내 인생의 구조: 전통 자미두수 명반 해석 프롬프트" 원문. **아직
  PENDING.** 이번 요청에는 사주 원본만 업로드되었다. 도착하면 동일한 방식으로 반영한다.

**`prompts/runtime/saju.md` / `ziwei.md`** — 원본을 재작성한 것이 **아니다.** "이미 계산된 Canonical
JSON이 원본이 기대하는 입력 형식의 어디에 대응하는지"만 설명하는 얇은 adapter(배관) 레이어다. 예를 들어
원본은 사용자가 만세력 앱 화면을 보고 손으로 입력하는 것을 전제로 설계되어 있는데, 이 서비스에서는 그
값이 이미 계산되어 Canonical JSON에 들어있다 — adapter는 이 매핑 관계만 명시한다.

`packages/ai/pipeline.mjs`가 실행 시점에 **adapter + 원본 전문을 그대로 이어붙여서** 하나의 system
prompt를 만든다 (`sajuPrompt = adapter + '\n\n' + original`). 원본 파일 자체에는 어떤 텍스트도 추가되지
않는다 — 실제로 두 텍스트가 결합되는 지점은 코드(`pipeline.mjs`)이지 파일이 아니다.

**중요한 데이터 격차 하나**: 원본은 세운(연도별 유년운) 표를 입력으로 기대하지만, 현재 계산 엔진은
대운까지만 계산하고 세운은 계산하지 않는다. 이건 원본을 고쳐서 해결한 게 아니라, 원본이 이미 정의해 둔
"계산된 세운표가 없으면 임의 생성하지 않는다"는 규칙을 adapter가 명시적으로 상기시키는 방식으로
처리했다. 자세한 내용은 `prompts/runtime/saju.md`와 `CHANGELOG.md` 참고.

---

## 5. Canonical JSON의 역할

`schemas/canonical-chart-schema.json`은 **계산 엔진과 무관한 표준 데이터 계약**이다. 이전 프로젝트에서
서양 점성술까지 포함해 설계된 스키마를 그대로 재사용했다 (필드를 임의로 만들지 않기 위해). 이 제품은
`natal`을 쓰지 않으므로, 스키마 파일 자체는 건드리지 않고 검증기(`packages/canonical/validate.mjs`)가
실행 시점에만 `natal`을 `required`에서 제외한다.

계산 엔진(`packages/chart-engine`)과 이 스키마 사이에는 변환 계층(`packages/canonical/transform.mjs`)이
있다. **AI는 항상 이 Canonical JSON만 보고, 원본 계산 엔진의 출력 형식은 절대 보지 않는다.** 이게
[§11 계산 엔진 교체 방법](#11-계산-엔진-교체-방법)이 가능한 이유다.

---

## 6. 질문 Router의 역할

`packages/ai/pipeline.mjs`의 Stage 1. 사용자의 질문 텍스트(+ 이전 대화 요약)만 보고, 이 질문에 답하는 데
실제로 필요한 Canonical JSON 필드만 골라낸다 (`packages/ai/schemas/router-schema.mjs`). Router는 절대
사주/자미두수를 해석하지 않는다 — "무엇이 필요한가"만 판단한다.

Router가 선택하는 필드명은 전부 `packages/shared/categories.mjs`에 정의된 **실제 Canonical 스키마
필드명**이다 (임의로 지어낸 이름 없음). 예: `saju_fields: ["day_master","pillars"]`,
`ziwei_fields: ["palaces"]`, `ziwei_palace_focus: ["career","wealth"]`.

Router의 출력은 곧바로 `packages/canonical/extract.mjs`(순수 함수, AI 호출 없음)에 들어가서 실제
데이터를 추려낸다. `npm run mock:pipeline`을 실행하면 질문마다 얼마나 데이터가 줄어드는지(60~89% 감소)
콘솔에서 직접 확인할 수 있다.

---

## 7. Cross Analysis의 역할

사주 해석과 자미두수 해석을 나란히 비교해서 `[공통 방향] / [차이점] / [종합 판단] / [현실에서 확인할
조건]`으로 정리하는 단계 (`prompts/runtime/cross-analysis.md`). 절대 규칙: 두 체계가 같은 방향을 가리켜도
"증명됐다"고 말하지 않는다 — 서로 다른 독립적 전통 해석 체계라는 점을 항상 유지한다. 두 체계가 다르게
말할 때 어느 쪽이 맞는지 판정하지 않는다.

Structured Output 스키마(`packages/ai/schemas/analysis-response-schema.mjs`)의 `cross_analysis` 필드로
강제된다.

---

## 8. 대화 메모리 구조

```
User (아직 인증 없음, id만 존재)
 └── Chart (1인당 여러 개 가능 — 생년월일시 조합마다)
       └── Conversation (하나의 Chart를 여러 대화에서 재사용 가능)
             └── Message (user/assistant 턴)
             └── summary (누적 대화 요약 — 다음 턴 프롬프트에 포함)
```

전체 메시지 히스토리를 매번 AI에 다시 보내지 않는다. `apps/api/src/services/conversation-service.mjs`가
매 턴마다 "[카테고리] Q: 질문 한 줄"을 누적하는 rolling summary를 관리하고(최대 1200자, 초과 시 앞부분
자르기), 이 요약만 다음 턴의 system/user 프롬프트에 포함시킨다. 원본 메시지 전체는 `Message` 저장소에
그대로 남아 있어서(`GET /api/conversations/:id`로 조회 가능) 감사/디버깅에는 문제가 없다.

이 요약 생성 자체는 **별도 AI 호출을 쓰지 않는다** (매 턴마다 요약을 위해 AI를 한 번 더 부르면 비용이
늘어난다). 요약 품질이 실제로 부족하다고 판단되면, `updateConversationSummary` 호출부만 "주기적으로(매
턴이 아니라 N턴마다) AI가 요약하는" 방식으로 바꾸면 된다 — 인터페이스는 그대로 유지된다.

`Analysis` 저장소(`apps/api/src/repositories/analysis-repository.mjs`)는 질문마다 어떤 데이터가
선택되었는지(`selected_data`), 어떤 모델을 썼는지, 토큰 사용량을 전부 기록한다 — 이게 다음 섹션의
비용 추적 근거다.

---

## 9. AI 비용 구조

스펙이 제시한 개념적 파이프라인은 6단계(Router → Extraction → Saju 분석 → Ziwei 분석 → Cross Analysis →
Response)지만, 실제 구현은 **AI 호출 2번**(Router + "Saju/Ziwei/Cross/Response 통합 1콜")으로 줄였다.
검토한 옵션:

| 옵션 | AI 호출 수 | 장점 | 단점 |
|---|---|---|---|
| A. 6단계 모두 분리 | 5~6회 | 각 단계가 독립적이라 디버깅/프롬프트 튜닝이 쉬움 | 추출된 데이터·이전 대화 요약을 매 호출마다 반복 전송 → 입력 토큰 비용이 호출 수만큼 배로 늘어남. 지연시간도 누적됨(순차 호출 시) |
| **B. Router 1회 + 통합분석 1회 (채택)** | 2회 | Router는 가볍고 독립적이므로 분리 유지(카테고리/필드 선택만 하면 되니 스키마도 작고 저렴). 나머지 4단계는 어차피 같은 추출 데이터·같은 원본 프롬프트를 함께 봐야 서로 참조 가능(Cross Analysis가 Saju/Ziwei 결과를 동시에 봐야 함) → strict JSON Schema로 saju/ziwei/cross_analysis/response를 명확히 분리된 필드로 강제하면 굳이 나눌 이유가 적음 | 하나의 호출이 커서(원본 프롬프트 2개 + 추출 데이터) 이 호출의 지연시간/토큰은 A안의 개별 호출보다 큼 |
| C. Router까지 합쳐서 1회 | 1회 | 가장 저렴/빠름 | Router가 "무엇이 필요한지" 정하기 전에는 무엇을 추출할지 모르므로, 이 방식은 추출을 포기하고 매번 전체 Canonical JSON을 통째로 보내야 함 → Extraction의 존재 이유(비용 절감)가 사라짐 |

**B를 선택한 이유**: Extraction(비용 절감의 핵심)이 성립하려면 Router가 먼저 무엇이 필요한지 알아야
하므로 최소 2회 호출은 불가피하다. 그 이후 4단계(Saju/Ziwei/Cross/Response)를 굳이 나누면, 매 단계가
직전 단계의 결과 + 같은 추출 데이터 + 같은 원본 프롬프트를 반복해서 입력으로 받아야 해서 입력 토큰이
누적된다 — Structured Outputs의 strict schema가 이미 각 관점을 분리된 필드로 강제하므로, 실질적인
"관심사 분리" 효과는 여러 호출 없이도 얻을 수 있다.

**비용이 실제로 발생하는 위치**: `apps/api/src/repositories/analysis-repository.mjs`의 `token_usage`
필드 (질문 1건당 1 레코드). API 응답에도 `usage: {input_tokens, output_tokens, total_tokens}`가 항상
포함된다 (`apps/api/src/routes/charts.mjs`, `conversations.mjs`). 가격표는 코드에 하드코딩하지 않았다
— 모델 가격이 자주 바뀌어서 오래된 값을 박아두면 조용히 틀린 비용을 보여줄 위험이 있기 때문이다.

특정 모델에 지나치게 종속되지 않도록 `OPENAI_MODEL` 환경변수로 모델을 분리했고,
[§10](#10-ai-provider-교체-방법)에 설명한 대로 OpenAI가 아닌 provider로도 교체 가능한 구조다.

---

## 10. AI Provider 교체 방법

```
packages/ai/providers/base-provider.mjs   BaseAIProvider — complete({system,user,jsonSchema,schemaName}) 인터페이스
├── openai-provider.mjs                    OpenAIProvider — 실제 OpenAI Responses API
└── mock-provider.mjs                      MockAIProvider — 테스트/무료 개발용
```

새 provider를 추가하려면 `BaseAIProvider`를 상속해서 `complete()`만 구현하면 된다. 나머지 코드
(`packages/ai/pipeline.mjs`, 라우트, 서비스)는 `provider.complete(...)`만 호출하므로 OpenAI SDK를 직접
알 필요가 없다. 어떤 provider를 쓸지는 `packages/ai/create-provider.mjs`가
`OPENAI_API_KEY`/`OPENAI_MODEL` 존재 여부로 자동 결정한다 — 이 팩토리 함수만 바꾸면 다른 provider로
전면 교체할 수 있다.

---

## 11. 계산 엔진 교체 방법

```
packages/chart-engine/compute.mjs   ← 여기만 계산 엔진(@orrery/core)을 직접 안다
        ↓ 반환: { meta, saju:{...orrery raw...}, ziwei:{...orrery raw...} }
packages/canonical/transform.mjs    ← 이 raw 형태를 Canonical JSON으로 매핑
        ↓
schemas/canonical-chart-schema.json 형태의 Canonical JSON
```

`@orrery/core`를 다른 계산 엔진으로 바꾸려면:
1. `packages/chart-engine/compute.mjs`의 `computeChart()`를 새 엔진 호출로 교체 (반환 형태는 자유 —
   다만 다음 단계가 이걸 소비하므로 문서화 필요).
2. `packages/canonical/transform.mjs`의 `transformSaju`/`transformZiwei`를 새 엔진의 raw 출력 →
   Canonical JSON 필드로 다시 매핑.
3. `packages/canonical/validate.mjs`, `packages/ai/*`, `apps/api/*`는 **전혀 손댈 필요가 없다** — 전부
   Canonical JSON(스키마)만 보고 동작하기 때문이다.

이게 애초에 Canonical JSON 계층을 계산 엔진과 분리한 이유다 (`@orrery/core`가 AGPL-3.0이라 나중에 교체할
가능성이 실제로 있음 — §13 참고).

---

## 12. 테스트

```bash
npm test
```

`node:test` 내장 러너로 42개 테스트를 실행한다 (실제 API 키/네트워크 불필요 — 전부 `MockAIProvider` 또는
순수 함수 테스트). 스펙이 요구한 최소 14개 케이스를 모두 포함한다:

| # | 항목 | 파일 |
|---|---|---|
| 1 | Canonical JSON schema validation | `tests/01-canonical-schema.test.mjs` |
| 2 | Saju data extraction | `tests/02-data-extraction.test.mjs` |
| 3 | Ziwei data extraction | `tests/02-data-extraction.test.mjs` |
| 4 | Question routing | `tests/03-question-routing.test.mjs` |
| 5 | Career question | `tests/03-question-routing.test.mjs` |
| 6 | Money question | `tests/03-question-routing.test.mjs` |
| 7 | Relationship question | `tests/03-question-routing.test.mjs` |
| 8 | General question | `tests/03-question-routing.test.mjs` |
| 9 | Missing data | `tests/04-missing-invalid-data.test.mjs` |
| 10 | Invalid chart | `tests/04-missing-invalid-data.test.mjs` |
| 11 | AI refusal | `tests/05-ai-error-handling.test.mjs` |
| 12 | Malformed JSON | `tests/05-ai-error-handling.test.mjs` |
| 13 | API failure | `tests/05-ai-error-handling.test.mjs` |
| 14 | Conversation continuation | `tests/06-conversation-continuation.test.mjs` |
| + | 전체 HTTP API 통합 테스트 (라우트별 성공/실패 케이스) | `tests/07-api-integration.test.mjs` |

마지막 실행 결과: **42 pass / 0 fail** (ZIP 패키징 직전 재확인 완료).

---

## 13. AGPL-3.0 라이선스 주의사항

`@orrery/core`는 **AGPL-3.0-only**다. 일반 GPL과 달리, 네트워크로 서비스만 제공해도(배포하지 않아도)
소스 공개 의무가 발생할 수 있다. 이 코드를 그대로 비공개 상용 서비스에 넣기 전에 법률 자문이 필요하다.
자세한 대안(전체 공개 / 마이크로서비스 격리 / 저자에게 상업 라이선스 문의 / 직접 재구현)은 이전 단계의
`orrery-test/README.md`에 정리되어 있으며, 이 프로젝트가 계산 엔진을 `packages/chart-engine`
한 곳으로 격리해 둔 것도 이 라이선스 리스크에 대응하기 위함이다 (§11 참고 — 교체가 실제로 쉬움).

---

## 14. 실제 AI 품질 평가 (`REAL-AI-EVALUATION.md`)

`npm run analyze:real`이 고정 테스트 명반(`data/canonical-chart-example.json`)으로 사주 단독 3문항,
자미두수 단독 3문항, 교차 4문항, 대화 연속성 3턴(총 13회 실제 API 호출)을 실행하고
`tests/real-ai/01-*.json` ~ `11-*.json`에 저장한다. 각 파일에는 질문/라우팅/추출 데이터/토큰
사용량/비용/응답/자동 검증 결과가 전부 담긴다.

**API 키가 없으면 이 명령은 아무것도 하지 않고 안내만 출력한다** (Mock으로 대체 실행되지 않음 — 실제
품질을 재는 것이 목적이므로). 하네스 배관만 검증하고 싶다면 `npm run analyze:real:dryrun`
(MockAIProvider, 결과는 `tests/real-ai/_dryrun_mock_verification/`에 별도 저장, 절대 실제 결과와 섞이지
않음).

자동 검증 6종(`tests/real-ai/validators.mjs`): JSON schema 적합성, 필수 필드 비어있지 않음, 금지된
단정 표현("반드시"/"무조건"/"100%"/"운명적으로") 검출, 데이터에 없는 별/간지 언급 휴리스틱(false
positive 가능 — 사람 재검토 필요), 라우팅이 의도한 체계 범위(사주만/자미두수만/둘 다)로 갔는지, 추출
결과가 결정론적으로 재현되는지. **AI가 자기 답변을 스스로 평가하게 하지 않는다** — 전부 기계적 체크이고,
해석의 질/유료 서비스 가치 같은 판단은 사람이 `REAL-AI-EVALUATION.md`에 직접 채운다.

## 15. 현재 상태 / 다음 단계

**완료:**
- 계산 엔진(saju+ziwei) → Canonical JSON → 스키마 검증, 세운(annual_periods)/귀문관살(gwimun) side-car
  통합 (`@orrery/core` 공개 함수만 재사용, 새 만세력 알고리즘 없음)
- Question Router → Extraction → Saju/Ziwei/Cross-analysis/Response 파이프라인, `predefinedRouting`
  옵션으로 Router 호출 스킵 가능(캐릭터 대화 레이어의 비용 절감 경로)
- 사주·자미두수 원본 프롬프트 반영 완료 (MD5 검증, 지금까지 단 한 번도 수정 없음)
- **자동 검증 체계**: `tests/real-ai/validators.mjs`(fabrication/단정표현/도메인혼동 등),
  `tests/targeted-quality/`(세운·귀문관살 실제 활용 검증), `tests/service-quality/`(공감/개인화/
  일관성/과잉긍정방지/캐릭터톤 불변성)
- **실제 API로 검증 완료**: edge_case/main_quality/부산 fixture 등 여러 명반에 대해 실제 OpenAI 호출로
  세운·귀문관살·현재대운이 계산값과 정확히 일치하는 것, 캐릭터 톤이 바뀌어도 사실관계가 안 바뀌는 것
  확인 (자세한 결과는 `REAL-AI-EVALUATION.md` 및 CHANGELOG 5~9차 참고)
- **캐릭터 대화 레이어** (`packages/character/`) — 대구/맹구 페르소나, 18개 시드 question catalog,
  rule-based 다음-선택지 로직, 일상대화/사주질문 분류기. API: `GET /opening-choices`,
  `POST /catalog-choice`, `POST /messages`(intent 자동분기), 기존 `POST /:id/questions` 유지
- **프론트엔드** (`apps/web`, Vite+React) — DM 스타일 채팅 UI, typing indicator(실제 API 시간과 UX
  대기시간 분리), 선택지/직접입력 통합, 캐릭터 전환, 분석 하이라이트 카드(`highlight_card` 스키마 필드)
- **총 180개 백엔드 테스트 + 4개 프론트 유닛 테스트, 전부 통과**

**사람이 결정/제공해야 하는 부분:**
- 실제 서비스 트래픽 없이 만든 catalog priority/시드 데이터 — 실사용 후 조정 필요
- `apps/web`의 실제 브라우저 시각 확인 (이 프로젝트는 헤드리스 환경에서 빌드/curl 스모크테스트까지만
  검증했고, 사람이 직접 화면을 보고 확인한 적은 없음)
- @orrery/core AGPL-3.0 라이선스 문제 최종 해결 방안 결정 (§13)
- "자세히 보기" 상세 콘텐츠 화면, 결제 연동 — 아직 설계/구현 안 됨

**다음 개발 단계 (제안):**
1. 실제 브라우저에서 `apps/web` 확인 (모바일/desktop)
2. catalog 시드 데이터 확장 및 실사용 데이터 기반 priority 조정
3. 상세 콘텐츠 화면 + 결제 흐름 설계
4. PostgreSQL로 repository 교체 (JsonStore 인터페이스로 이미 추상화됨)
5. 사용자 인증
6. AGPL 라이선스 이슈 해결

전체 변경 이력은 `CHANGELOG.md`(1~11차 반영)를 참고.
"# signalroom" 
 
 
