# LLM 통합 테스트 러너

실제 OpenAI API를 호출해서 아이시그널(자녀 코치)의 실제 응답 품질을 확인하는 도구다.
Mock provider를 절대 쓰지 않는다 — API 키가 없으면 즉시 실패하고 종료한다.

## 실행 방법

1. 프로젝트 루트에 `.env` 파일을 준비한다(이미 있다면 그대로 사용).

```
OPENAI_API_KEY=sk-실제키
OPENAI_MODEL=gpt-5.6-terra
OPENAI_CASUAL_MODEL=gpt-5-nano
OPENAI_CHILD_COACH_MODEL=gpt-5.6-luna
```

2. 딱 한 줄로 실행한다.

```
npm run test:llm
```

이 명령이 하는 일:
- 프로젝트의 실제 backend 서버(`apps/api/src/server.mjs`)를 별도 포트(3999)로 자동으로 띄운다
  (평소 쓰는 `npm run dev`의 3000번 포트와 겹치지 않는다 — 두 개를 동시에 켜둬도 된다).
- self-directed / receptive / expressive 3개 fixture 각각에 대해 실제 chart 생성 → 자녀
  프로필 생성 → 무료 기본 분석(Luna) → 유료 전체 분석(Terra) → 대화 시작 → 질문 28개를 실제
  `/api/conversations/:id/messages`로 순차 전송한다.
- 모든 호출이 끝나면 서버를 종료하고, 결과를 `tests/llm-integration/results/` 아래
  JSON과 Markdown 두 가지 형식으로 저장한다.

## 소요 시간과 비용

**중요(실측으로 발견해서 반영한 수정사항)**: 실제 서비스에는 "자녀 프로필당 24시간 5질문 무료
체험 제한"이 있다. 처음엔 fixture당 하나의 프로필로 30개 질문을 다 보냈더니, 6번째 질문부터는
체험이 소진되어 API 호출 자체를 안 하고 고정 문구만 나오는 문제가 실측으로 발견됐다(93개 호출
중 75개가 이 이유로 테스트가 안 됨). 이제 질문마다 새 프로필을 만들어서 이 제한을 우회한다 —
실제 사용자가 여러 날에 걸쳐 쓰는 것과 비슷한 조건이다.

이 때문에 질문 1개당 API 호출이 3번(기본 분석 1 + 대화 시작 "안녕" 1 + 실제 메시지 1)으로
늘었다. 3 fixture × (공유 프로필 분석 2 + 질문 30개 × 3) = 약 276회의 실제 API 호출이 발생한다.
비용은 이전 실측 기준(전체 분석 1회당 약 0.10 USD)을 참고하되, 이번엔 호출 수가 늘어난 만큼
더 클 수 있다.

**중요**: 질문마다 2번의 rate-limited 호출(안녕 + 실제 메시지)이 발생하므로 7초씩 대기한다.
fixture당 30개 질문 × 7초 = 약 3.5분의 대기 시간만 있고, 실제 API 응답 시간까지 더하면 총
실행 시간은 대략 20~30분 정도로 예상하면 된다.

## 결과 파일

- `results/llm-test-<타임스탬프>.json` — 기계가 읽는 원본 데이터(전체 필드 포함).
- `results/llm-test-<타임스탬프>.md` — 사람이 읽는 요약 + 자동 플래그가 붙은 항목을 상단에
  모아서 보여준다.

각 결과 항목에는 다음이 들어있다: fixture, 질문 카테고리, target/intent/depth(실제 판정 로직을
그대로 재사용해서 계산 — 서비스 코드 수정 없음), 실제 사용 모델, HTTP status, latency, 최종
응답 전문, suggestedQuestions, 자동 플래그.

## 자동으로 판정되는 것 / 사람이 봐야 하는 것

기계적으로 판정 가능한 것만 자동 플래그를 붙인다:
- `HTTP_ERROR` — API 호출 자체가 실패함
- `POSSIBLE_LEAK` — 응답 텍스트에 내부 전용 마커(confidence:, 참고할 수 있는 육아 방법 등)가
  그대로 노출됨(진짜 leak인지는 사람이 최종 확인 필요 — 오탐 가능성 있음)
- `SUGGESTED_QUESTIONS_MISSING_FROM_RESPONSE` — 현재 알려진 문제(35차 반영에서 만든 추천 질문
  기능이 실제 HTTP 응답 라우트에서 누락되어 있음, 이 러너가 그 사실을 매번 재확인해준다)
- `UNEXPECTED_NON_NONE_DEPTH_FOR_PARENT_TARGET` — parent 질문인데 depth가 NONE이 아님(있으면 안
  되는 조합)

**답변의 자연스러움, 교육 근거의 실제 품질, 학습유형 비분류 준수 여부, 추천 질문의 실제 관련성**
등은 자동 판정하지 않는다 — Markdown 리포트를 사람이 직접 읽고 판단해야 한다.

## 결과를 다시 Claude에게 전달하기

생성된 `.md` 파일(또는 `.json`)을 그대로 업로드하면, Claude가 각 항목을 실제 요구사항 기준으로
분석할 수 있다. 파일 하나에 fixture 3개 × 질문 30개 분량이 전부 들어있으므로 별도로 나눠 보낼
필요는 없다.
