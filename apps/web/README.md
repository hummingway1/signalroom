# apps/web — TODO (이번 MVP 범위 밖)

이번 단계의 목표는 API/AI 파이프라인 검증이며, 웹 UI는 아직 구현하지 않는다 (요청 스펙에서 반복적으로
명시됨: "아직 웹 UI를 만들지 않는다").

폴더만 미리 만들어 두는 이유: `apps/api`와 프론트엔드를 분리하는 구조를 처음부터 잡아두면, 나중에 웹
UI를 붙일 때 API 계약(`apps/api/src/routes/*.mjs`)을 변경할 필요가 없다.

## 나중에 웹 UI를 붙이는 방법 (README 최상위 문서에도 동일 내용 있음)

1. 이 폴더에 프론트엔드 프로젝트를 생성한다 (예: Vite + React, Next.js 등 — 특정 프레임워크에 종속되지
   않도록 API가 순수 REST/JSON으로 설계되어 있다).
2. `apps/api`가 이미 제공하는 4개 엔드포인트만 호출하면 된다:
   - `POST /api/charts` — 생년월일시 입력 폼 제출
   - `GET /api/charts/:id` — 저장된 차트 조회
   - `POST /api/charts/:id/questions` — 첫 질문 (새 대화 시작)
   - `POST /api/conversations/:id/messages` — 후속 질문 (대화 이어가기)
   - `GET /api/conversations/:id` — 대화 히스토리 조회
3. 개발 중에는 `apps/api`를 `npm run dev`로 띄우고, 프론트엔드에서 `http://localhost:3000`으로 프록시하면
   된다 (CORS 설정은 아직 추가되어 있지 않음 — 웹 UI 작업 시 `apps/api/src/server.mjs`에
   `cors` 미들웨어를 추가해야 한다).
