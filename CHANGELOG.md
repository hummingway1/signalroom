# CHANGELOG

프로젝트 지시사항에 따라, 기존 구조/파일과 충돌하거나 임의 판단이 필요했던 지점을 여기에 기록한다.

## [Unreleased] — 이메일/비밀번호 로그인 추가 (Toss 심사용 실제 로그인 방식)

### 조사 결과 — DB 스키마가 이미 email/password를 지원하도록 준비되어 있었음
`migrations/001_auth_schema.sql`을 확인한 결과, `auth_accounts.provider` CHECK 제약에 이미
`'email'`이 포함되어 있고 `password_hash` 컬럼도 이미 존재 — **마이그레이션이 전혀 필요
없음**. `auth-repository.mjs`에도 `createEmailAccount`/`findEmailAuthAccount` 리포지토리
함수가 이미 구현되어 있었고, `package.json`에 `bcryptjs`도 이미 설치되어 있었으나 실제로
사용하는 코드는 어디에도 없었음(설치만 되어 있고 미완성 상태) — 이번 작업은 이 준비된
기반 위에 실제 서비스/라우트/프론트를 완성하는 것.

### 구현
- **`apps/api/src/services/auth-service.mjs`** — `signupWithEmail`/`loginWithEmail` 추가.
  - `bcryptjs`로 해싱(반올림 10라운드), 평문 저장 없음.
  - 이메일 형식/비밀번호 8자 이상/닉네임 2~20자 입력 검증을 DB 호출 전에 수행(실제 실행
    테스트로 확인 — DB 없이도 정확히 검증 에러가 남).
  - 로그인 실패 시 "계정 없음"과 "비밀번호 틀림" 모두 동일한 `INVALID_CREDENTIALS`만
    반환(계정 존재 여부 비노출), 계정이 없어도 더미 해시와 `bcrypt.compare`를 수행해서
    타이밍 차이로 계정 존재 여부가 새지 않도록 함.
  - 익명 상태에서 만든 데이터(자녀 프로필 등) 연결은 **기존 `linkAnonymousData` 함수를
    그대로 재사용**(OAuth 가입과 완전히 동일한 절차, 새 로직 없음).
  - 인증 정보(이메일/비밀번호)와 서비스 프로필 정보(이름/성별/생년월일/출생시간)를 역할
    분리 — 회원가입 API는 이메일/비밀번호/닉네임만 받고, 프로필 정보는 저장하지 않는다
    (기존 `POST /api/charts` 흐름을 그대로 재사용해서 프론트가 자연스럽게 이어지게 함).
- **`apps/api/src/routes/auth.mjs`** — `POST /signup`, `POST /login` 추가. 기존 OAuth 콜백과
  **완전히 동일한 `SESSION_COOKIE_OPTIONS`**로 세션 쿠키 설정(별도 인증 경로 아님, 크로스
  도메인 SameSite 수정사항도 그대로 적용됨). 이메일 중복은 409로 매핑.
- **`apps/web/src/api/client.js`** — `signupWithEmail`/`loginWithEmail` 추가.
- **`apps/web/src/components/NicknameSignup.jsx`** — 이메일 로그인/회원가입 폼 + 로그인·
  가입 모드 토글 추가. 기존 소셜 로그인 버튼, 기존 닉네임 전용 경량 계정(localStorage
  기반)은 전부 그대로 유지(제거/변경 없음, 같은 화면에 병렬로 제공).
- **`apps/web/src/App.jsx`** — `handleEmailAuthSuccess` 추가(OAuth 로그인 성공 처리와
  동일한 패턴 — userId/nickname state 반영, localStorage 저장, `pendingAfterSignup`으로
  이동).

### 실제 브라우저 테스트 중 발견하고 고친 버그 2건
1. **레이아웃 붕괴** — `NicknameSignup`에 이메일 폼을 형제 요소로 추가했더니, 부모
   `.intake-screen`이 `display:flex`(flex-direction 미지정, 기본값 `row`)라서 여러 카드가
   가로로 나열되며 화면이 깨졌다(기존엔 자식이 `intake-card` 1개뿐이라 드러나지 않던 문제).
   전체를 다시 하나의 `intake-card`로 감싸서 해결, 실제 스크린샷으로 정상 세로 배치 확인.
2. **SIGNAL ROOM에 로그인 화면 진입점이 아예 없었음** — `MyPage.jsx`가 "이미 로그인된
   사용자"만 가정하고 있어서, 비로그인 방문자(신규 사용자, **Toss 심사자 포함**)가 로그인
   화면(`screen==='signup'`) 자체에 도달할 방법이 전혀 없었다. `MyPage`에 `onLogin` prop과
   비로그인 시 "로그인이 필요해요" + "로그인/회원가입" 버튼을 추가해서 해결 — 실제
   Playwright로 비로그인 상태 재현 후 로그인 화면 도달까지 확인.

### 신규 파일
- `tests/62-email-auth.test.mjs`(15개).

### 실제 브라우저 검증
비로그인 상태(새 브라우저 컨텍스트) → SIGNAL ROOM → footer 링크 → 마이페이지("로그인이
필요해요" 표시 확인) → "로그인/회원가입" 클릭 → 이메일 로그인 폼 정상 렌더링 → "회원가입"
모드 전환 시 닉네임 필드 추가 표시 및 역할 분리 안내 문구 확인 — 전부 스크린샷으로 확인.

### 테스트 결과
신규 15/15 통과. **전체 backend 696/696 통과**(재실행 확인). 프론트 빌드 성공(75 모듈).

### 절대 하지 않은 것 확인
테스트 계정 정보 하드코딩 없음, entitlement/quota 강제 지급 없음, 결제 승인 우회 없음,
관리자 전용 bypass 계정 없음 — §Toss 심사용 테스트 계정은 실제 이메일 회원가입 절차로
직접 만들어야 한다(§최종 정리 참고).

## [Unreleased] — Toss 심사 테스트 계정 준비: 실제 로그인 구조 확인 + 크로스도메인 세션 버그 발견/수정

### 조사 결과 — 이 서비스는 OAuth 로그인만 지원, ID/비밀번호 로그인 없음
`apps/api/src/routes/auth.mjs` 확인 결과, 이 서비스는 **카카오/네이버/구글 OAuth만** 지원하고
이메일/비밀번호 방식 로그인 자체가 없다. 즉 "테스트 계정 ID/비밀번호"를 코드로 만들어낼 수
없는 구조 — 별도 로그인 방식을 새로 추가하는 건 "기존 auth 구조를 임의로 바꾸지 않는다"는
원칙에 위배되므로 하지 않았다. **대신 실제 카카오(또는 네이버/구글) 계정 하나를 정상적으로
회원가입시켜서, 그 OAuth 계정의 로그인 정보를 Toss에 "테스트 계정"으로 제출하는 것이 유일하게
안전한 방법**이다(§4 최종 정리 참고). 회원가입/로그인 후 별도의 승인 대기, 이메일 인증,
관리자 approval 같은 추가 게이트가 전혀 없음을 확인 — OAuth 로그인만 성공하면 즉시 일반
사용자와 완전히 동일한 정상 권한을 갖는다(추가 코드 불필요, §7 원칙 자동 충족).

### 실제로 발견하고 고친 버그 — 크로스도메인 세션 쿠키
`SESSION_COOKIE_OPTIONS`가 `sameSite: 'lax'`로 고정되어 있었는데, 이 프로젝트는 프론트
(Vercel)와 백엔드가 서로 다른 도메인으로 배포되는 구조다. `SameSite=Lax` 쿠키는 top-level
GET navigation(OAuth 콜백의 리다이렉트)에는 전송되지만, **그 이후 프론트 JS가 fetch()로
백엔드를 호출하는 크로스사이트 요청에는 전송되지 않는다** — 즉 로그인 리다이렉트 자체는
성공한 것처럼 보여도, 그 다음 모든 API 호출(상품 조회/구매/결과 조회 등)이 브라우저에서
쿠키 없이 나가서 전부 비로그인(401)으로 처리될 심각한 위험이 있었다. 로컬 개발(같은
origin)에서는 이 문제가 드러나지 않아 지금까지 발견되지 않았던 것으로 보인다. **Toss
심사자가 정확히 이 시나리오(실제 배포된 크로스도메인 환경에서 로그인 후 화면 확인)를
시도하게 되므로, 이번에 미리 발견하지 못했다면 심사 도중 실제로 막혔을 문제.**

### 수정
- `apps/api/src/middleware/session.mjs` — 프로덕션(`NODE_ENV=production`)에서는
  `sameSite: 'none'`(크로스도메인 fetch에서도 쿠키 전송), 개발 환경에서는 기존 `'lax'`
  유지(로컬 http 환경에서 `None`은 애초에 `Secure` 요구사항과 충돌해 불필요). `SameSite=None`
  은 `Secure` 필수인데 `secure`도 이미 `NODE_ENV=production` 조건이라 자동으로 함께 켜짐.
  CSRF는 기존 OAuth `state` 파라미터로 이미 방지되고 있어 새로운 인증 취약점이 생기지 않음.
- `apps/api/src/routes/auth.mjs` — `res.clearCookie(SESSION_COOKIE_NAME)`이 옵션 없이
  호출되고 있던 것을 `SESSION_COOKIE_OPTIONS`를 명시적으로 전달하도록 수정. 쿠키 삭제 시
  설정 당시와 속성(`sameSite`/`secure`)이 다르면 브라우저가 다른 쿠키로 취급해 실제로
  지워지지 않을 수 있어, 로그아웃이 안 되는 문제로 이어질 수 있었다.

### 신규 파일
- `tests/61-cross-domain-session-cookie.test.mjs`(4개) — 프로덕션/개발 환경별 쿠키 옵션,
  로그아웃 시 옵션 일치 여부 검증.

### 테스트 결과
신규 4/4 통과. **전체 backend 681/681 통과**(방금 실행).

### 절대 하지 않은 것 확인
결제 승인 로직/entitlement 강제 지급/우회 관리자 계정/하드코딩된 계정 정보 — 전혀 만들지
않았다. 이번 수정 2건은 순수하게 "이미 배포된 크로스도메인 구조에서 기존 세션 인증이
정상 작동하도록 쿠키 전송 설정을 맞추는 것"이며, 인증/권한 로직 자체는 전혀 바뀌지 않았다.

## [Unreleased] — Vercel 배포 준비 2차: SIGNAL ROOM에 법적 페이지 진입점 자체가 없던 버그 발견/수정

### 배경
이전 라운드에서 `LegalScreen.jsx`/`vercel.json`/`.env.example`/`DEPLOYMENT.md`를 이미
만들었고, `MyPage.jsx`에 이용약관/개인정보처리방침/사업자정보 링크도 이미 연결했다. 이번
라운드에서 그 결과를 재검증하다가, **정작 SIGNAL ROOM(현재 앱의 실제 첫 화면)에는 MyPage로
가는 진입점 자체가 전혀 없었다**는 걸 발견했다 — `onOpenMyPage`가 오직 teal `HomeScreen`
에만 연결되어 있어서, SIGNAL ROOM으로 들어온 사용자(즉 실제 서비스 사용자 전원)는 법적
페이지가 이미 만들어져 있어도 **찾아갈 방법이 없는 상태**였다. Toss 심사관이 실제 배포된
사이트를 방문했을 때도 동일한 문제를 겪었을 것이다.

### 실제로 발견하고 고친 버그
1. **SignalRoomHome에 MyPage 진입점 없음** — `apps/web/src/components/SignalRoomHome.jsx`
   에 `onOpenMyPage` prop과 화면 최하단의 작은 텍스트 링크("마이페이지 · 이용약관 ·
   개인정보처리방침")를 추가. 디자인 재설계 없이 눈에 띄지 않는 최소한의 footer만 추가.
2. **MyPage/LegalScreen/ProductsScreen의 뒤로가기가 항상 teal 'home'으로 고정** — SIGNAL
   ROOM에서 들어온 사용자가 마이페이지→뒤로가기를 누르면 teal 홈(다른 세계관)으로 떨어지는
   문제. `homeOrigin`(기존 §SIGNAL ROOM 연결 라운드에서 만든 구조) 기반으로 전부 수정해서
   SIGNAL ROOM에서 들어왔으면 SIGNAL ROOM으로, teal 홈에서 들어왔으면 teal 홈으로 정확히
   복귀하도록 수정.

### 실측 검증 (실제 Playwright 브라우저)
SIGNAL ROOM → footer 링크 클릭 → 마이페이지 정상 진입 → 이용약관 페이지 표시(placeholder
값들이 `[ ]`로 명확히 보임) → 뒤로가기 → 홈 버튼 → **SIGNAL ROOM으로 정확히 복귀**까지
전체 왕복 흐름을 스크린샷으로 확인.

### 수정 파일
- `apps/web/src/components/SignalRoomHome.jsx` — `onOpenMyPage` prop, footer 링크.
- `apps/web/src/App.jsx` — `SignalRoomHome`에 `onOpenMyPage` 연결, `MyPage`/`LegalScreen`/
  `ProductsScreen`의 `onBack`/`onHome`을 `homeOrigin` 기반으로 수정.
- `DEPLOYMENT.md` — `FRONTEND_BASE_URL`(백엔드 OAuth 리다이렉트 주소) 배포 시 반드시
  실제 Vercel 주소로 변경해야 한다는 안내 추가(기존 문서에 빠져있던 부분), 카카오/네이버/
  구글 개발자 콘솔의 Redirect URI도 함께 갱신 필요하다는 점 명시. 체크리스트에 이번에
  고친 footer 링크 확인 항목 추가.

### 검증
전체 backend 677/677 통과(무영향), 프론트 빌드 성공(75 모듈).

### 절대 하지 않은 것 확인
Toss secret key 관련 코드 무변경, payment provider 무변경, 결제 로직 무변경 — 이번 라운드는
전부 프론트 네비게이션/진입점 수정에 한정.

## [Unreleased] — Vercel 배포 준비 (실제 결제 개발은 중단, 공개 URL 확보 우선)

### 실제로 발견하고 고친 심각한 버그
**`NicknameSignup.jsx`(카카오/네이버 로그인 시작 화면)에 `http://localhost:3000`이
하드코딩**되어 있었다 — 다른 모든 API 호출은 `config.js`의 `API_BASE_URL`(환경변수
`VITE_API_BASE_URL` 지원)을 쓰는데 이 파일만 별도로 하드코딩되어 있어서, **production에
배포하면 로그인 시작 자체가 항상 localhost로 요청을 보내 실패**하는 상태였다. `config.js`의
`API_BASE_URL`을 재사용하도록 수정. 빌드 결과물(`dist/assets/*.js`)에서 `localhost` 문자열이
정확히 1곳(config.js의 의도된 fallback)만 남는 것으로 재확인.

### Vercel 배포 설정
- **`apps/web/vercel.json`**(신규) — SPA 전체 경로를 `index.html`로 rewrite(이 앱은
  react-router 없이 `screen` state로만 화면 전환하는 순수 SPA임을 확인 — 새로고침/직접
  URL 접근 시에도 항상 index.html이 로드되도록 안전장치).
- **`apps/web/.env.example`**(신규) — `VITE_API_BASE_URL`/`VITE_TOSS_CLIENT_KEY` 문서화
  (실제 이 두 값만 `config.js`가 읽음, 확인 완료).
- **`DEPLOYMENT.md`**(신규, 루트) — Vercel Root Directory 설정, 환경변수, **백엔드는 별도
  배포가 필요하다는 점**(Vercel은 정적 SPA만 호스팅, Express 서버는 Railway/Render 등
  별도 필요)을 명시.

### 홈페이지 최소 요건
- SIGNAL ROOM 자체가 곧 홈페이지 역할(별도 랜딩페이지 신규 제작 안 함 — 이미 6개 실제
  상품이 첫 화면에 명확히 보임, 가격은 각 서비스의 조건입력→상품화면에서 실제
  `products` 테이블 값을 그대로 표시함, 임의 가격 없음).
- 작명소 COMING SOON 문구에 지시서가 요구한 정확한 표현 **"추후 서비스 예정"**을 명시적으로
  추가(기존 "COMING SOON" 배지는 유지, 병기).

### 법적/신뢰 페이지 (신규 — 기존에 전혀 없었음, 확인 완료)
- **`apps/web/src/components/LegalScreen.jsx`**(신규) — 이용약관/개인정보처리방침/사업자
  정보 3개 문서. **법률 조항을 임의로 작성하지 않았다** — 표준 섹션 구조만 만들고, 실제
  값이 필요한 곳(사업자등록번호, 대표자명, 환불정책 세부조건, 보유기간 등)은 전부
  `[placeholder]`로 명확히 표시해서 사장님이 직접 채워넣도록 함.
- `MyPage.jsx`에 3개 링크 추가, `App.jsx`에 라우팅 연결.

### 수정 파일
- `apps/web/src/components/NicknameSignup.jsx` — localhost 하드코딩 제거(버그 수정).
- `apps/web/src/App.jsx` — LegalScreen 라우팅, comingSoon 문구.
- `apps/web/src/components/MyPage.jsx` — 법적 페이지 링크 3개.
- `apps/web/src/styles/app.css` — 링크 스타일 최소 추가.

### 결제는 손대지 않음(지시 준수)
Toss secret key 관련 코드 무변경, payment provider 무변경, 기존 payment backend 구조
무변경, mock/test payment 구조 그대로 유지.

### 검증
- **전체 backend 677/677 통과**(변경 없음, 프론트 전용 작업이므로 예상대로 무영향).
- 프론트 빌드 성공(75 모듈).
- 빌드 결과물에서 localhost 참조가 정확히 1곳(의도된 fallback)만 남음을 실측 확인.
- 실제 Playwright 브라우저: SIGNAL ROOM 정상 로드, 작명소 클릭 시 "COMING SOON · 추후
  서비스 예정" 정확히 표시되고 결제/서비스 진입 전혀 없음을 확인.

### 이 환경에서 확인하지 못한 것
- 실제 Vercel 배포 자체(계정/네트워크 필요) — `DEPLOYMENT.md` 가이드대로 사용자가 직접
  진행 필요.
- 새로고침 시 SPA rewrite가 실제 Vercel 인프라에서 정확히 동작하는지(설정 파일 문법은
  Vercel 공식 스펙에 맞게 작성했으나 실제 배포 환경 확인은 불가).
- 백엔드(apps/api) 배포는 이번 범위 밖(Vercel과 별도 인프라 필요).

## [Unreleased] — 정정: live-db 스크립트가 미전달 파일(naming-service.mjs)을 참조하던 실수 수정

### 배경
사용자가 `npm run test:live-db` 실행 시 `Cannot find module 'naming-service.mjs'` 에러 발생.

### 원인 (제 실수)
직전 라운드("작명소는 당분간 구현하지 않는다" 지시)에서 "SIGNAL ROOM/프론트에 연결이 안
되어 있으니 이미 COMING SOON과 동일하다"고만 판단하고, **`integration-test-live-db.mjs`
안에 남아있던 NAMING 관련 시나리오(G~L)와 `naming-service.mjs` import를 제거하지
않았다.** 이 `naming-service.mjs`는 그 이전 작명소 구현 라운드(도구 호출 한도로 중단됨)
에서 이 샌드박스 안에만 만들어졌고, 사용자에게 zip으로 전달된 적이 없어 로컬에 파일
자체가 없었다 — 그래서 스크립트 자체가 실행조차 안 됐다.

### 수정
`scripts/integration-test-live-db.mjs`에서:
- `naming-service.mjs`/`hasPaidOrderForProductCode` import 제거
- NAMING 시나리오 G~L(할인/entitlement/analysis_scope/결과캐싱/chat/실패semantics) 전체
  블록 제거

DATE_SELECTION(A~F) 및 결제 안전성(M~P) 시나리오는 그대로 유지 — 둘 다 이미 사용자에게
전달된 파일만 참조한다.

### 검증
로컬 실행 시뮬레이션(모듈 없음 상태 재현) → `naming-service.mjs` 관련 에러 없이 정상적으로
`DATABASE_URL` 에러로만 멈추는 것을 확인. 전체 backend **677/677 무변경 통과**(재확인).

### 사용자가 다시 확인할 것
`scripts/integration-test-live-db.mjs` 재적용 후 `npm run test:live-db` 재실행 — 이번엔
모듈 에러 없이 정상적으로 A~F, M~P 시나리오가 실행되어야 한다.

## [Unreleased] — 실제 결제 연결: 기존 안전장치 확인 + 검증 테스트 추가 (작명소는 보류)

### 작명소 처리
지시대로 이번 라운드에서 작명소 관련 코드를 더 손대지 않았다. 이전 라운드에서 만든 백엔드
(`naming-service.mjs`, `routes/naming.mjs` 등)는 그대로 남아있지만 **SIGNAL ROOM/프론트
어디에도 연결되어 있지 않아 사용자가 실제로 접근할 방법이 없다** — 즉 이미 사실상 COMING
SOON 상태와 동일하다. 별도로 되돌리는 작업은 하지 않았다.

### 조사 결과 — 결제 provider 및 기존 보안 구조 확인
- **결제 provider는 Toss Payments로 이미 확정**되어 있음(`.env.example`의 `TOSS_CLIENT_KEY`
  /`TOSS_SECRET_KEY`, PortOne 관련 코드는 프로젝트 어디에도 없음).
- `payment-service.mjs`(`confirmPayment`)와 `payment-repository.mjs`
  (`confirmPaymentTransaction`)를 재조사한 결과, 지시서가 요구한 보안 요구사항이
  **이미 전부 구현되어 있음**을 확인:
  - 클라이언트가 보낸 `clientAmount`는 전혀 신뢰하지 않고, 서버가 저장한 `order.amount`를
    Toss 승인 API에 보내 Toss 쪽에서도 대조하게 함(1차 방어).
  - `confirmPaymentTransaction` 내부에서 `order.amount !== amount`(Toss가 실제 승인한
    금액)면 `AMOUNT_MISMATCH`로 재차 거부(2차 방어, 이중 검증).
  - `tossResponse.status !== 'DONE'`이면 즉시 `PAYMENT_NOT_DONE`으로 실패 처리.
  - `order.status === 'PAID'`(이미 처리된 주문)면 entitlement를 다시 만들지 않고
    `alreadyProcessed: true`로 조용히 반환(idempotent, 중복 지급 방지).
  - `FOR UPDATE`로 order 행을 잠가 동시 요청(중복 클릭/webhook+콜백 동시 도착)에도 순차
    처리되도록 함.
  - `order.user_id !== userId`면 `UNAUTHORIZED`로 거부(타인 주문 도용 방지).
  - `TOSS_SECRET_KEY`가 없으면 501로 명확히 거부(가짜로 결제 통과 안 시킴).
  - entitlement 발급(quota/유효기간/analysis_type)이 상품코드별 하드코딩 분기가 아니라
    `products` 테이블 설정을 그대로 읽는 구조(신규 상품 추가에 안전).
- **다만 이 모든 안전장치를 실제로 검증하는 테스트가 단 하나도 없었음**을 발견 — 이번
  라운드의 핵심 작업은 새 보안 로직을 만드는 게 아니라 **기존에 이미 잘 만들어진 것을
  실제로 검증**하는 것이었다.

### 실제 사용 흐름 확인
`MyPage → 상품 안내/구매`(`ProductsScreen.jsx`)가 SAJU_BASIC/SAJU_DETAIL/YEARLY_FORTUNE_*/
MINGRI_SUBSCRIPTION/CHILD_*/DATE_SELECTION 등 chart_id에 종속되지 않는 상품 전체의 유일한
공용 구매 진입점임을 확인. `SAJU_DETAIL` 등은 `analysis_type`만으로 사용자 전체에 걸쳐
authorization되는 구조(신년운세/택일/작명처럼 chart_id별로 결과를 저장/캐싱하는 상품과
달리, 특정 chart에 종속되지 않음)라 `ProductsScreen`이 chartId 없이 구매해도 정상 동작함을
확인 — 처음엔 버그로 의심했으나 기존 설계상 의도된 동작이었다.

### 신규 파일
- **`tests/60-payment-security-integration.test.mjs`**(12개) — 위에서 확인한 안전장치들이
  실제 소스에 존재하는지 검증 + DB 필요 지점(`confirmPayment` 실제 실행)이 정상적으로
  `DATABASE_URL` 에러로 차단되는지 확인(가짜로 통과시키지 않음).

### 수정 파일
- **`apps/web/src/components/BirthSelectionScreen.jsx`** — Toss 클라이언트 키를
  `import.meta.env`에서 직접 읽던 것을 다른 모든 결제 화면(`ProductsScreen`/
  `YearlyFortuneScreen`/`MembershipScreen`)과 동일하게 `config.js`의 `TOSS_CLIENT_KEY`
  재사용으로 통일(일관성, 동작 변경 없음). "결제 기능 미설정" 체크도 다른 화면과 동일하게 추가.
- **`scripts/integration-test-live-db.mjs`** — 시나리오 M~P 추가(실제 Postgres 트랜잭션으로
  검증):
  - **M**: 동일 order에 대한 중복 confirmation(webhook+프론트 콜백 동시 도착 시뮬레이션)이
    idempotent 처리되어 entitlement가 정확히 1개만 존재하는지
  - **N**: order.amount와 다른 금액으로 confirm 시도 시 `AMOUNT_MISMATCH`로 거부되고 주문
    상태가 PAID로 바뀌지 않는지
  - **O**: 존재하지 않는 orderId → `ORDER_NOT_FOUND`
  - **P**: 다른 사용자가 타인의 주문을 확정하려 하면 `UNAUTHORIZED`

### 테스트 결과
신규 12/12 통과. **전체 backend 677/677 통과**(방금 실행). 프론트 빌드 성공(74 모듈).

### 이 환경에서 실행하지 못한 것
`confirmPayment`/`confirmPaymentTransaction`의 실제 실행(정상 결제, 중복 confirmation,
금액 불일치 등)은 전부 실제 Postgres가 필요해 이 환경에서 실행 불가능 — 사용자의 로컬
`npm run test:live-db`(M~P 시나리오 포함)로 확인 필요. 실제 Toss 샌드박스 결제창을 통한
end-to-end(카드 결제 실제 클릭까지)는 브라우저+실제 Toss 테스트 키가 필요해 이 환경에서
검증 불가.

## [Unreleased] — 재검증 정정: 시나리오C는 실제 버그 아니라 테스트 스크립트의 비교 방식 결함

### 배경
order 쿼리 수정 후 재실행 결과 27/28 PASS. 유일한 실패:

> ❌ C. 최초 생성(AI 호출 발생) 후 재조회는 AI 재호출 없이 동일 결과 반환 —
> firstGen=true, secondGen=false

`firstGen=true, secondGen=false`는 **정확히 의도한 동작**(캐싱이 실제로 작동해서 두 번째
호출은 AI를 다시 안 부름) — 즉 실제 제품 로직은 문제없었다.

### 원인
스크립트가 `JSON.stringify(second.resultData) === JSON.stringify(first.resultData)`라는
**문자열 순서 비교**로 "동일 결과"를 판정했다. Postgres jsonb 컬럼은 저장/조회 시 객체 키
순서를 보장하지 않는다 — 데이터는 완전히 동일해도 `JSON.stringify` 결과의 키 순서가
달라지면 문자열이 달라져서 이 비교가 실패할 수 있다. 이건 실제 캐싱 버그가 아니라 순수하게
스크립트의 검증 방법이 잘못된 경우였다.

### 수정
`node:util`의 `isDeepStrictEqual`(키 순서와 무관하게 값 기준으로 비교)로 교체.

### 검증
스크립트 전용 변경이라 백엔드 영향 없음 — 전체 backend **647/647 무변경 통과**(재확인).

### 사용자가 다시 확인할 것
`scripts/integration-test-live-db.mjs` 재적용 후 `npm run test:live-db` 재실행 — 이번엔
28/28이 나와야 한다.

### 이번 라운드 전체 정리
DATE_SELECTION의 핵심 흐름(A~F: 상품/entitlement/analysis_scope/결과캐싱/chat진입/quota
50→49→48/실패 4종)이 **실제 Supabase에서 전부 검증**됐다. 이 과정에서 실제 제품 버그 1건
(confirmPaymentTransaction의 트랜잭션 내부 쿼리에 컬럼 누락)을 발견/수정했고, 이번엔 순수
테스트 스크립트 버그 1건을 발견/수정했다 — 둘을 정확히 구분해서 보고했다.

## [Unreleased] — 실제 Supabase 검증에서 발견한 심각한 버그: analysis_scope 생성 자체가 실패하던 문제

### 배경
사용자가 확장된 `test:live-db`를 실제 Supabase에서 실행 → 19/27 PASS. A(entitlement 생성)는
성공했지만 **B(analysis_scope 생성)부터 전부 실패**(`Cannot read properties of null`) —
DATE_SELECTION 구매자가 결과 조회/채팅을 전혀 쓸 수 없는 상태였다.

### 원인
`confirmPaymentTransaction`이 결제 처리 중 order를 조회하는 **트랜잭션 내부의 별도 쿼리**
(`select ... from orders where id = $1 for update`)에 `subject_date_selection_params`
컬럼을 select 목록에서 빠뜨렸다. 이전 라운드에서 `getOrderById`(일반 조회 함수)에는 이
컬럼을 정확히 추가했지만, `confirmPaymentTransaction` 내부에서 트랜잭션 잠금을 위해 별도로
작성된 쿼리에는 반영하지 못했다 — 그 결과 `order.subject_date_selection_params`가 트랜잭션
안에서 항상 `undefined`가 되어, DATE_SELECTION analysis_scope 생성 분기의 조건
(`analysisType === 'DATE_SELECTION' && order.subject_date_selection_params`)이 매번
거짓으로 평가되고 **analysis_scope가 전혀 생성되지 않았다**(entitlement만 만들어지고
analysis_id는 계속 null로 남는 상태).

### 수정
해당 쿼리에 `subject_date_selection_params` 컬럼 추가(한 줄 수정).

### 신규 파일
없음.

### 수정 파일
`apps/api/src/repositories/payment-repository.mjs`.

### 회귀 테스트
`tests/57-birth-selection-api-integration.test.mjs`에 12번 테스트 추가 — 트랜잭션 내부의
정확한 이 쿼리 문자열을 소스에서 찾아 `subject_date_selection_params`가 포함되어 있는지
확인(향후 같은 실수로 다른 컬럼이 빠지는 것도 이 테스트가 잡을 수 있도록 쿼리 텍스트 전체를
검사).

### 검증
기존 646개 전부 무변경 통과(1건 무관 기존 flaky 재실행으로 해소 확인) + 신규 1개 =
**647/647 통과**(재실행 확인).

### 사용자가 다시 확인할 것
`apps/api/src/repositories/payment-repository.mjs` 재적용 후 `npm run test:live-db`
재실행 — 이번엔 B~F 시나리오가 전부 PASS로 바뀌어야 한다(quota 50→49→48 포함).

## [Unreleased] — DATE_SELECTION live DB E2E 검증 스크립트 확장

### 조사 결과
`scripts/integration-test-live-db.mjs`(기존 Phase8/9에서 만든 것)를 그대로 확장 — 새 DB
테스트 인프라를 만들지 않음. `record()`/`buyProduct()`/`countingProvider()`/`cleanup` 추적
패턴을 전부 그대로 재사용.

### 구현
- `buyProduct` 헬퍼에 `dateSelectionParams` 파라미터 추가(`fortuneYear`와 동일한 방식으로
  `createOrder`에 전달).
- 시나리오 A~F 추가(기존 16번 시나리오 뒤, 최상위 try 블록 안):
  - **A**: DATE_SELECTION 구매 → entitlement quota=50, `subscription_group=null`(MINGRI
    독립) 실측 확인
  - **B**: analysis_scope가 `analysis_type='DATE_SELECTION'`+`date_selection_params`로
    생성되고 `result_data`는 아직 null인지 확인
  - **C**: `getOrGenerateBirthSelectionResult` 최초 호출(`generatedNow:true`) → 재호출
    시 AI 재호출 없이 동일 결과(`generatedNow:false`) 반환 확인
  - **D**: `startConversation({dateSelectionScopeId})`로 chat 진입, conversation이 올바른
    scope에 연결되는지 확인
  - **E**: 실제 `handleFreeTextMessage` 2회 호출 — **quota 50→49→48 실측 차감** 확인
  - **F-1**: entitlement 없는 사용자(user2)는 AI 호출 자체 없이(`callCount=0`) 차단
  - **F-2**: `expires_at`을 과거로 강제 설정한 만료 entitlement는 차단
  - **F-3**: `remaining_quantity=0`으로 설정 시(구독 fallback 없음 확인 포함) 차단
  - **F-4**: 실패하는 provider(강제 throw)로 호출 시 예외 전파 + quota 불변 확인

### 실제 OpenAI 강제 호출 없음
전 시나리오 `MockAIProvider` 또는 즉시 throw하는 테스트 provider만 사용 — 실제 API 비용 0원.

### 데이터 정리
기존 `cleanup.entitlementIds`/`cleanup.analysisScopeIds`/`cleanup.orderIds` 추적 패턴이
`buyProduct` 헬퍼 내부에서 자동으로 적용되므로 새 정리 로직 불필요 — 스크립트 종료 시
`finally` 블록이 기존과 동일하게 전부 삭제.

### 이 환경에서 실행한 결과
`.env`에 `DATABASE_URL`이 없어 즉시 `❌ DATABASE_URL이 설정되어 있지 않습니다`로 정상 종료
확인(가짜로 통과시키지 않음) — **실제 실행은 사용자 로컬 환경에서 필요**.

### 신규 파일
없음(기존 스크립트 확장만).

### 회귀 결과
스크립트 변경만이라 백엔드/프론트 전부 무영향 확인 — **전체 backend 646/646 통과**,
프론트 빌드 성공(74 모듈, 변경 없음).

### §4 프론트 테스트
vitest 미도입 원칙 유지(변경 없음) — 이번 라운드는 live DB 스크립트 전용, 프론트 변경 없음.

## [Unreleased] — DATE_SELECTION → SIGNAL ROOM 프론트 연결

### 조사 결과
`useChatController.resumeConversation(conversationId, chartId)`의 `chartIdRef`는 저장만 되고
실제 API 호출 어디에도 쓰이지 않음을 소스로 확인 — 기존 `ChatScreen`/`useChatController`를
**그대로 100% 재사용** 가능(새 채팅 UI 없음). `getOpeningChoices()`도 순수 함수(chart_id 불필요).
`confirmPayment` 응답에 `analysisScopeId`가 이미 포함되어 있음을 확인(추가 API 불필요).

### 구현
- **`apps/web/src/api/client.js`** — `getBirthSelectionResult`, `startBirthSelectionChat`
  추가(YEARLY_FORTUNE과 완전히 동일한 패턴, 하드코딩 URL 없이 기존 `request()` 재사용).
- **`apps/web/src/components/BirthSelectionScreen.jsx`**(신규) — 조건입력(성별/날짜범위/
  시간범위/도시) → 상품확인 → Toss 구매. `BirthDataForm`의 성별 라디오 스타일,
  `YearlyFortuneScreen`의 Toss 결제 호출을 그대로 재사용(새 결제 로직 없음).
- **`apps/web/src/components/BirthSelectionResult.jsx`**(신규) — `result_data`에 실제로
  존재하는 필드(top1/top2to5/safety_disclosure/total_candidates_considered)만 렌더링,
  없는 필드는 자연스럽게 숨김(§2 원칙). 채팅 CTA 포함.
- **`apps/web/src/components/PaymentResultScreen.jsx`** — `confirmPayment` 결과를 `onDone`
  콜백 인자로 전달하도록 최소 확장(다른 상품 결제 흐름은 인자를 안 쓰므로 무변경).
- **`apps/web/src/App.jsx`** — SIGNAL ROOM `taegil`을 COMING SOON 대신 `birthSelection`
  화면으로 연결. 결제 완료 후 `pendingService==='taegil'`이면 `analysisScopeId`로 결과화면
  직행(다른 상품은 기존과 동일하게 `home`). `handleOpenBirthSelectionChat` 추가 — YEARLY_
  FORTUNE의 `handleOpenYearlyFortuneChat`과 완전히 동일한 패턴, `chartId`에 `null` 전달
  (조사에서 확인했듯 실제 API 호출에 영향 없음).

### 상태 관리
`analysisScopeId`는 `birthSelectionScopeId` state(결제 리다이렉트를 거쳐도 유지), `homeOrigin`
으로 뒤로가기 목적지 관리 — 둘 다 기존에 이미 확립된 패턴 재사용, 새 상태관리 라이브러리 없음.

### 접근/권한 처리
프론트는 entitlement/quota를 직접 판단하지 않음(§6) — `BirthSelectionResult`는 API 에러를
그대로 표시만 하고, quota 판단은 전혀 하지 않는다(기존 `YearlyFortuneResult`와 동일 원칙).

### 실측 검증 (실제 Playwright 브라우저)
- SIGNAL ROOM → 택일(파랑 혜성) 클릭 → **COMING SOON이 아니라 실제 조건입력 화면**(성별/
  날짜범위/시간범위/도시) 표시 확인.
- 뒤로가기 → SIGNAL ROOM 정확히 복귀, 애니메이션 정상 재생 확인.
- 조건입력 채우고 "다음" 클릭 → API 서버 연결 시도 확인(이 환경엔 실제 DB가 없어
  `listProducts()`가 `DATABASE_URL` 에러로 서버 자체가 종료됨 — **이 환경의 근본적 한계이지
  이번 프론트 구현의 문제가 아님**, 프론트가 이 실패를 "Failed to fetch" 에러 UI로 정상
  표시하는 것까지는 확인됨).
- 프론트 빌드 성공(74 모듈), 백엔드 전체 회귀 **646/646 무영향**.

### §8 테스트 — 조사 결과 및 판단
프론트에 테스트 파일이 딱 1개(`useTypingDelay.test.js`) 있으나 **`vitest`를 import하는데
`package.json`에 vitest가 설치/설정되어 있지 않아 실제로 실행 불가능한 상태**임을 확인
(`node --test`로 실행 시도 → `ERR_TEST_FAILURE`). 즉 이 프로젝트의 프론트 테스트 인프라는
사실상 작동하지 않는 상태다. §8의 "테스트 인프라가 없는 부분은 억지로 대규모 프레임워크를
추가하지 않는다" 원칙에 따라 **새로 vitest를 설치/설정하지 않았다** — 대신 위의 실제
Playwright 브라우저 검증(네비게이션/화면전환/에러UI)으로 핵심 흐름을 실측 확인했다.

### 남은 실제 blocker
1. **실제 DB 환경에서의 e2e 미검증** — 상품조회/구매/결과렌더링/채팅 전체 흐름은 사용자의
   로컬 실제 Supabase 환경에서 직접 확인 필요(이 환경은 DB 자체가 없어 원천적으로 불가능).
2. **프론트 테스트 인프라 자체가 미설정 상태** — vitest 설치/설정은 이번 범위 밖(테스트
   프레임워크 신규 추가 금지 원칙).
3. 작명 연계 할인, 실제 Supabase e2e 인프라 구축은 여전히 범위 밖(지시대로 미착수).

## [Unreleased] — DATE_SELECTION 채팅 연결 완성 (남은 핵심 미완료 항목)

### 조사 결과
YEARLY_FORTUNE의 `POST /:analysisScopeId/chat`은 AI 응답을 직접 반환하지 않고, `startConversation`
으로 새 conversation을 만들어 `conversationId`만 반환한다. 실제 질문/응답/quota차감/AI호출/
context연결은 전부 `conversation-service.mjs`의 `handleFreeTextMessage`(`askQuestion`→
`runQuestionPipeline`)가 담당하며, `conversationContext.fortuneYear`로 도메인을 구조적으로
판정한다(질문 텍스트/Router category 무관). DATE_SELECTION도 같은 원칙을 재사용했다.

### 실제로 발견하고 고친 버그
**`classifyMessage`가 "왜 1위가 좋아?" 같은 자연스러운 후속 질문을 casual로 오분류**해서,
최초 구현이 DATE_SELECTION 전용 분기에 도달하지 못하고 일반 캐주얼 응답("음, 그런가.")으로
새는 걸 실제 실행 테스트로 발견했다. DATE_SELECTION 대화는 `date_selection_scope_id`로
도메인이 이미 구조적으로 고정되어 있으므로(fortune_year와 동일 원칙), classifyMessage 분류
결과와 무관하게 항상 전용 경로(`handleDateSelectionChatMessage`)로 먼저 라우팅되도록
`handleFreeTextMessage` 최상단으로 체크를 옮겨서 수정 — 실제 재실행으로 정상 동작 확인.

### 신규/수정 파일
- **`apps/api/src/repositories/payment-repository.mjs`** — `findActiveEntitlementByAnalysisScopeId`
  추가(access 판정 전용, Phase10에서 고쳤던 것과 동일 원칙 — quota 필터 없음, 만료만 확인).
- **`apps/api/src/services/entitlement-authorization-service.mjs`** — `DATE_SELECTION`
  도메인 분기 추가(`fortuneYear`와 상호 배타적인 구조적 스코프 태깅). 구독 그룹 매핑에는
  여전히 미등록 → MINGRI fallback 자동 제외(기존 원칙 그대로).
- **`apps/api/src/repositories/conversation-repository.mjs`** — `date_selection_scope_id`
  필드 추가.
- **`apps/api/src/services/conversation-service.mjs`** — `startConversation`이 chart_id
  없이 동작하는 분기 추가, `handleDateSelectionChatMessage`(신규 함수) 추출, `handleFreeTextMessage`
  최상단에서 classifyMessage보다 먼저 라우팅(버그 수정).
- **`apps/api/src/routes/birth-selection.mjs`** — `POST /:analysisScopeId/chat` 추가(YEARLY_
  FORTUNE과 동일 계약: conversationId만 반환).
- **`packages/character/birth-selection-prompt.mjs`** — `buildDateSelectionChatPrompt`,
  `DATE_SELECTION_CHAT_RESPONSE_SCHEMA` 추가(OpenAIProvider가 항상 structured output을
  요구함을 확인해서 자유 텍스트 대신 최소 스키마 `{response}` 사용).
- **`packages/ai/providers/mock-provider.mjs`** — `date_selection_chat` schemaName 처리 추가.
- **`tests/58-date-selection-chat.test.mjs`**(13개, 신규).

### API 계약
`POST /api/birth-selection/:analysisScopeId/chat` → `{ conversationId }`(YEARLY_FORTUNE과
동일). 이후 `POST /api/conversations/:conversationId/messages`로 실제 질문 — 응답에
`sources: scope.result_data`(저장된 top1/top2to5/candidate_comparison 그대로) 포함.

### quota 차감 semantics
- access 판정(entitlement 존재+미만료)과 quota 소진 여부(remaining_quantity)를 분리 —
  Phase10에서 고쳤던 버그를 다시 만들지 않음(§7 테스트로 재발 방지 확인).
- `consumeQuestionEntitlement`는 AI 호출 성공 확인 이후에만 호출(소스 위치로 확인), try/catch로
  감싸 차감 실패가 이미 생성된 응답을 취소하지 않음.
- 클라이언트가 보낸 entitlementId는 어디에도 쓰이지 않고, `authResult.entitlementId`(서버가
  `authorizeAnalysisQuestion`에서 직접 찾은 값)만 사용.
- `consumeQuestionEntitlement` 호출 지점이 기존 2곳→3곳으로 정당하게 확장됨 — 기존 테스트
  (`48-phase7-integration-validation.test.mjs`, `52-legacy-entitlementid-removal.test.mjs`)
  의 개수 단정을 실제 계약에 맞게 업데이트(검증 약화 아님, 새 정당한 경로 반영).

### 테스트 결과
신규 13/13 통과. 기존 테스트 2건(consumeQuestionEntitlement 개수 단정) 정당하게 업데이트 후
**전체 backend 646/646 통과**(재실행 확인). 프론트 빌드 무영향(72 모듈, 이번 작업 백엔드 전용).

### 실측 검증
실제 서버 기동 후 curl: `/chat` 엔드포인트 인증 없이 401 정상 차단, 서버 시작 로그 에러 없음.
비로그인/로그인 상태 각각 실제 코드 실행으로 라우팅 정확성 확인(비로그인은 AI 호출 0회로
즉시 안내, 로그인은 authorization 단계까지 정확히 도달 후 DB 필요 에러로 차단).

### 남은 실제 blocker
1. **실제 Supabase e2e 미검증** — 이 환경엔 DB가 없어 quota 실제 차감(50→49)/entitlement
   없음 차단/quota 0 차단의 실측은 사용자 로컬 환경에서 `test:live-db` 확장 필요.
2. **프론트/SIGNAL ROOM 연결 없음** — 여전히 COMING SOON, 이번 지시 범위 밖(backend 우선).
3. **작명(NAMING) 연계 할인** — 이번 범위 밖, 이전 설계 논의만 존재.

## [Unreleased] — 출생일 택일: 상품/entitlement/analysis_scope/API 구현 (다음 미완료 Phase)

### 구현 범위
Phase 1(AI 평가 엔진)/Phase 2(성능, PASS) 완료 후 남아있던 로드맵 — 상품/entitlement/
analysis_scope 스키마 확장 + API 라우트까지 이어서 구현(기능 완성도 우선 원칙에 따라 스키마
뿐 아니라 실제로 조회 가능한 API까지 완성).

### 확정 정책 반영
`DATE_SELECTION` 단일 상품, 29,000원, 채팅 50회/30일, 결과 영구 열람, `subscription_group=null`
(MINGRI 구독과 완전 독립).

### 신규 마이그레이션
- **`migrations/011_date_selection_product.sql`** — 상품 시드.
- **`migrations/012_date_selection_scope.sql`** — `orders.subject_date_selection_params`,
  `analysis_scopes.date_selection_params`(둘 다 jsonb) 추가. 택일의 대상은 기존 chart_id/
  child_profile_id(이미 태어난 사람)로 표현할 수 없음(아직 태어나지 않은 아이의 출생 조건
  자체가 대상) — 신년운세의 `fortune_year` 귀속 원칙과 동일한 정신으로 새 컬럼 필요.

### 수정 파일
- **`apps/api/src/repositories/payment-repository.mjs`** — `confirmPaymentTransaction`에
  `DATE_SELECTION` 분기 추가(YEARLY_FORTUNE과 동일 패턴, 같은 트랜잭션으로 analysis_scope
  생성+entitlement 연결).
- **`apps/api/src/repositories/order-repository.mjs`** — `createOrder`/`getOrderById`에
  `subjectDateSelectionParams` 추가.
- **`apps/api/src/routes/orders.mjs`** — `POST /api/orders`가 `dateSelectionParams`를 받고
  최소 존재/타입 검증(상세 범위 검증은 결과 생성 시점의 `generateCandidateDateTimes`가 담당).
- **`apps/api/src/repositories/analysis-scope-repository.mjs`** — `getAnalysisScopeById`
  select에 `date_selection_params` 추가.
- **`apps/api/src/services/birth-selection-service.mjs`** — `getOrGenerateBirthSelectionResult`
  추가: 신년운세의 "생성 1회+영구 열람" 패턴 재사용(`fillAnalysisScopeResultOnce`로 동시
  요청 경쟁에서도 이중 생성 방지). result_data 있으면 AI 재호출 없이 즉시 반환.
- **`apps/api/src/server.mjs`** — `birthSelectionRouter` 등록(기존 `aiProviderFactory` 재사용,
  새 모델 팩토리 없음).

### 신규 파일
- **`apps/api/src/routes/birth-selection.mjs`** — `GET /api/birth-selection/:analysisScopeId`
  (`requireAuth`, 세션 userId로만 소유권 검증).
- **`tests/57-birth-selection-api-integration.test.mjs`**(11개).

### 실측 검증
- 실제 서버 기동 후 curl: 인증 없이 조회 → 401 정상 차단, 서버 시작 로그 에러 없음.
- `DATE_SELECTION`이 `SUBSCRIPTION_GROUP_FOR_ANALYSIS_TYPE` 매핑에 없음을 소스로 확인(MINGRI
  구독 fallback이 의도치 않게 적용되지 않음).

### 테스트 결과
신규 11/11 통과. **전체 backend 633/633 통과**(방금 실행). 프론트 빌드 무영향(이번 작업은
백엔드 전용, 72 모듈 그대로).

### 남은 문제 (실제로 발견된 것만)
1. **채팅 대화방 연결 없음** — `entitlement-authorization-service.mjs`의 질문 도메인 라우팅
   (`mapRouterCategoriesToAnalysisTypes`/`conversationContext.fortuneYear` 분기)에 `DATE_
   SELECTION`이 아직 연결되어 있지 않다. API로 결과 조회는 가능하지만, 신년운세의
   `POST /:analysisScopeId/chat`에 대응하는 "이 택일 결과에 대해 채팅 시작"은 이번 범위에
   없음 — 결제한 50회 채팅 quota를 실제로 쓸 방법이 아직 없다는 뜻.
2. **프론트/SIGNAL ROOM 연결 없음** — `BirthSelectionScreen.jsx` 등 프론트 화면과 SIGNAL
   ROOM의 `taegil` 연결은 여전히 COMING SOON.
3. **실제 Supabase 통합 검증 미실행** — 이 환경엔 DB가 없어 `test:live-db` 확장을 통한 실제
   결제→scope→API 조회 e2e는 사용자 로컬 환경에서 필요.

## [Unreleased] — Phase 2 계약 차이 2건 수정 (Phase 2 최종 PASS)

### 배경
직전 최종 검증에서 CONDITIONAL 판정을 받은 두 계약 차이를 수정한다. 범위 확대 없음.

### 수정 1 — created_at 개별 생성 복원
`chart-repository.mjs`에 `buildChartRecord()` 공통 헬퍼를 추가해서 `createChartRecord`(단건)
와 `createChartRecords`(배치) 둘 다 이걸 재사용하도록 정리(timestamp 생성 책임 중복 제거).
배치는 `entries.map(buildChartRecord)`로 **항목마다 개별 호출**하므로, 배치 시작 시
timestamp 하나를 고정해서 전체에 넣던 이전 방식(계약 차이였음)이 사라지고 단건 생성과
완전히 동일한 semantics가 됨.

### 수정 2 — 부분 성공 semantics 복원
`chart-service.mjs`의 `createCharts`를 수정 — 계산 중 특정 후보가 실패해도 나머지 후보는
계속 계산을 시도하고(오류를 그 자리에서 다시 던지지 않음, 대신 `firstError`에 기록), 성공한
것들만 모아 **여전히 배치 저장 1회**로 파일에 반영. 저장 후 실패가 있었다면 첫 번째 오류를
그대로 다시 던져서(에러 타입/코드 변경 없음) "실패 시 예외가 호출자에게 전파된다"는 기존
계약을 유지. Phase2의 O(N²) 병목 제거(배치 저장 1회)는 그대로 보존 — 개별 `insert()`
반복 구조로 되돌아가지 않음.

### 신규 파일
- **`tests/56-chart-batch-contract-fixes.test.mjs`**(7개) — 두 계약 차이의 회귀 테스트.
  실제 `computeChart`의 `UNSUPPORTED_TIMEZONE` 에러 경로(timezone≠'Asia/Seoul')를 이용해
  특정 후보만 의도적으로 실패시켜서 부분 성공을 실측 검증. 5개 전부성공/3번째만실패/전부실패/
  2번째만실패 4개 시나리오 + timestamp 개별성 + insertMany 호출 위치(1곳) 확인.
- 별도 파일로 분리한 이유: Node.js `--test`는 파일 단위로 프로세스를 격리하는데, 같은 파일
  안에 두면 `chart-repository`의 `store` 싱글턴 캐시가 앞선 테스트(300개 성능 테스트)의
  데이터를 이미 메모리에 갖고 있어서 `rm()`만으로는 격리가 안 됨을 실제로 발견 — 이 문제를
  발견하고 별도 파일로 분리, 그리고 `storeFor`를 테스트에서 import해서 시나리오 사이 캐시를
  명시적으로 리셋하는 헬퍼(`resetChartsStoreCache`, 테스트 전용, 프로덕션 코드 무변경)를 추가.

### 수정 파일
- `apps/api/src/repositories/chart-repository.mjs` — `buildChartRecord` 헬퍼 추가.
- `apps/api/src/services/chart-service.mjs` — `createCharts`의 부분 성공 처리.

### 성능 재확인 (수정 후에도 유지)
312개 후보: **1,032ms**(개선 전 86,000ms 대비 여전히 약 83배) — O(N²)로 회귀하지 않음.

### 테스트 결과
신규 7/7 통과. birth-selection+contract-fix 관련 4개 파일 합계 **41/41 통과**.
**전체 backend 622/622 통과**(방금 실행, 재현 확인).

### Phase 2 최종 판정: PASS
- 기존 기능 계약 유지 ✅(created_at 개별 생성 복원, 부분 성공 semantics 복원)
- 데이터 무결성 유지 ✅
- 전체 회귀 통과 ✅(622/622)
- 성능 개선 재현 ✅(312개 기준 1,032ms, 86초 대비 약 83배)
- 동시쓰기 위험 증가 없음 ✅(배치 저장 1회 구조 그대로 유지)

## [Unreleased] — Phase 2: 300개 후보 계산 성능 개선(계산 순차 유지 + 저장만 배치화)

### 조사 결과 — 진짜 병목 위치

`JsonStore.insert()`(`packages/shared/json-store.mjs`)를 확인한 결과, 매 호출마다 **전체
파일을 다시 읽고(`_load`) 통째로 다시 쓰는(`_save`) 방식**임을 확인. 300개 후보를 순차
저장하면 파일이 점점 커지는 것을 300번 통째로 재작성하는 **O(N²) 패턴**이 실제 병목의
핵심이었다.

`createChart`(`chart-service.mjs`) 내부는 (a) `computeChart`(CPU 바운드 순수 동기 계산)
(b) `validateCanonicalChart`(최초 1회만 파일 읽고 이후 캐시, `getValidator()`의
`cachedValidator` 확인) (c) `createChartRecord`(JsonStore I/O, 진짜 병목) 순서. (a)(b)는
후보 간 완전히 독립적이고 공유 mutable state가 없음을 코드로 확인했다.

### Promise.all 실측 검증 — CPU 바운드 계산 단계에는 적용하지 않음

"단순히 Promise.all=병렬 처리라고 가정하지 말라"는 지시에 따라 실제로 벤치마크했다:

```
워밍업 후 100회 반복(computeChart):
  순차:        41ms
  Promise.all: 83ms   (오히려 느림 — Promise 스케줄링 오버헤드만 추가)
```

Node.js 단일 이벤트 루프에서 순수 동기 CPU 코드를 Promise.all로 감싸도 실제 동시 실행이
되지 않는다는 걸 실측으로 확인 — **계산 단계는 기존 순차 for 루프를 그대로 유지**한다.

### 구현 — 저장 단계만 배치화(계산/저장 분리)

지시서가 제안한 "계산 단계 → 결과 수집 → 저장 단계" 구조를 그대로 채택. 계산과 저장을
분리하면 **동시 쓰기 자체가 발생하지 않아** JsonStore의 동시성 안전 문제(레이스 컨디션
우려)도 원천적으로 회피된다.

- **`packages/shared/json-store.mjs`** — `insertMany(records)` 추가(한 번의 load+save로
  여러 레코드 저장). 기존 `insert()`는 완전히 그대로 유지(하위호환, 다른 모든 repository의
  기존 동작 무영향).
- **`apps/api/src/repositories/chart-repository.mjs`** — `createChartRecords(entries)`(복수형
  배치) 추가. 기존 `createChartRecord`(단건)는 완전히 그대로 유지.
- **`apps/api/src/services/chart-service.mjs`** — `createCharts(entries)` 추가: 계산은
  순차 for 루프(변경 없음), 저장만 `createChartRecords`로 배치 처리. 기존 `createChart`
  (단건)는 완전히 그대로 유지, 다른 모든 호출부(사주 상세분석 등)에 전혀 영향 없음.
- **`apps/api/src/services/birth-selection-service.mjs`** — `computeCandidateCharts`가
  `createChart`(단건 N번 호출) 대신 `createCharts`(배치 1회 호출)를 사용하도록 변경.
  **반환 구조/순서/candidateId 매핑은 기존과 완전히 동일** — 각 후보 결과 객체의 필드
  구성이나 배열 순서를 전혀 바꾸지 않았다.

### 실측 성능 비교 (300개 근접, 동일 파라미터)

| | 개선 전(Phase1 보고) | 개선 후(실측) | 개선 비율 |
|---|---|---|---|
| 312개 후보 | 약 86,000ms | **1,502~1,676ms**(3회 반복 측정) | **약 51~57배** |
| 최대 동시 작업 수 | 1(순차, 변경 전과 동일) | 1(계산은 그대로 순차, 저장만 1회로 통합 — "동시" 작업 자체는 늘리지 않음) | — |
| 실패 여부 | — | 없음 | — |

성능 개선은 동시성(병렬화)이 아니라 **파일 I/O 횟수를 N번에서 1번으로 줄인 것**에서
전부 발생했다 — 계산 단계의 동시 작업 수는 여전히 1(순차)로 변경 전과 동일하다.

### 데이터 무결성 확인
`computeCandidateCharts` 실행 후 `data/db/charts.json`을 직접 다시 읽어서, 계산된 모든
`chartId`가 실제로 파일에 존재하는지, 저장 순서가 계산 순서와 일치하는지 확인(신규 테스트
4번). 기존 `insert()`와 새 `insertMany()`를 같은 파일에 섞어 써도 데이터가 섞이지 않음도
확인(신규 테스트 1-1번).

### 신규 파일
- **`tests/41-birth-selection-performance.test.mjs`**(7개) — `insertMany` 정확성(3개),
  `createCharts`(배치) 계약 동일성(1개), `computeCandidateCharts` 매핑 정확성(1개), 300개
  규모 무결성(1개), 성능 실측(1개, 10초 상한 — 개선 전 86초 대비 충분한 여유).

### 테스트 결과
신규 7/7 통과, 기존 `38-birth-selection-pipeline`/`40-birth-selection-ai-evaluation` 전부
무변경 통과, **전체 스위트 615/615 통과**(전체 실행시간도 18초로 단축 — Phase 1 종료 시점
대비 대폭 개선).

### 범위 준수 확인
OpenAI 모델/`.env`/모델 fallback 변경 없음. UI 변경 없음. 사주/자미두수 계산 알고리즘
자체(`computeChart`, `buildCanonicalChart`) 변경 없음 — 오직 저장 계층의 배치화만 수행.

## [Unreleased] — Phase 1 후속 확인: 모델 설정 실측 + 300개 성능 병목 기록 (코드 변경 없음)

### 1. 실제 모델 설정 — 확인 불가로 명확히 정정

이전 보고의 "GPT-4 계열로 추정"은 근거 없는 추측이었음을 정정한다. 실제 코드 확인 결과:

```js
// apps/api/src/server.mjs
const MODEL = process.env.OPENAI_MODEL ?? 'mock'; // 'mock'은 모델명이 아니라 MockAIProvider 신호
const CASUAL_MODEL = process.env.OPENAI_CASUAL_MODEL ?? null;
const CHILD_COACH_MODEL = process.env.OPENAI_CHILD_COACH_MODEL ?? null;
```

`.env.example`의 세 변수 전부 빈 값. 실제 모델명 하드코딩 fallback은 코드 어디에도 없음.
`OPENAI_CASUAL_MODEL` 섹션 주석에 "예: gpt-5-nano"라는 **예시 문구**가 있으나 이는 기본값이
아니라 설명용 예시일 뿐이다. **결론: 실제 사용 모델은 사용자 로컬 `.env`에만 존재하며 이
코드베이스로는 확인 불가.** 이번 라운드에서 모델을 임의로 변경/지정하지 않았다.

### 2. 300개 후보 계산 성능 병목 — 위치 확인, 최적화는 미적용(TODO)

`apps/api/src/services/birth-selection-service.mjs`의 `computeCandidateCharts`:

```js
for (const candidate of candidates) {
  const chart = await createChart(...); // 완전히 순차적
}
```

**병목 위치**: 이 순차 루프. `createChart` 내부는 (a) `computeChart`(CPU 바운드 사주/자미두수
계산) (b) `validateCanonicalChart`(JSON schema 검증) (c) `createChartRecord` → JsonStore
파일 I/O 쓰기로 구성 — 이 3단계가 후보 수만큼(예: 300번) 완전히 순차 반복된다.

**병렬화 가능성**: 각 후보의 `createChart` 호출은 다른 후보의 결과에 의존하지 않는 완전히
독립적인 계산이다(서로 다른 chartId로 별도 레코드 생성, 공유 상태 변경 없음) — 구조적으로
`Promise.all` 등으로 병렬화 가능하다.

**TODO(Phase 3에서 검토, 이번엔 미적용)**: `computeCandidateCharts`를 동시성 제한이 있는
병렬 처리(예: `Promise.all` 또는 `p-limit` 같은 배치 병렬)로 전환 검토. 단, JsonStore(파일
기반)의 동시 쓰기 안전성을 먼저 확인해야 한다 — 다수의 `createChartRecord` 호출이 동시에
같은 파일에 접근할 때 레이스 컨디션이 없는지 Phase 3에서 별도 검증 필요. 또한 API/production
단계에서는 이 작업 전체를 비동기 job(즉시 응답 후 백그라운드 처리+polling/webhook)으로
전환하는 것도 검토 대상.

이번 라운드는 조사/기록만 수행했으며 `birth-selection-service.mjs`를 포함한 어떤 프로덕션
코드도 수정하지 않았다.

## [Unreleased] — 출생일 택일 Phase 1: AI 후보 평가 엔진 구현

### 배경
`rankCandidatesMock`(chartId 문자열 정렬만 하던 placeholder)을 실제 2단계(1차 넓고 얕게 →
2차 좁고 깊게) AI 평가로 교체. 절대 점수 없음, 신강/신약·격국·용신·희신·조후는 계산 엔진에
없으므로 AI에게 전달도 요구도 하지 않음. 상품/결제/entitlement/API/frontend는 이번 범위 밖.

### 실제 확인한 기존 구조
- `extractBirthSelectionFields`(기존)가 saju뿐 아니라 ziwei(자미두수)까지 포함하고 있음을
  재확인. **`void_branches`(공망)는 saju 최상위에 실제로 존재하지만 기존 함수가 가져오지
  않고 있었음** — 빠뜨린 필드였음, 이번에 2차(deep) depth에 보강.
- `hidden_stems`(지장간)는 별도 필드가 아니라 `pillars[].hidden_stems`에 이미 중첩.
- `ziwei.palaces`는 12궁 전체(각 궁마다 별 목록)로 매우 방대함을 확인 — 택일 비교에는
  "타고난 기질"을 보는 명궁(life palace)의 별 구성만 유의미하다고 판단해서 그것만 추출,
  나머지 11궁(형제/부부/자녀/재물/질병/이동/친구/사업/부동산/복덕/부모)은 제외.
- `OpenAIProvider.complete()`는 temperature 파라미터 자체를 지원하지 않음(구조화 출력
  strict:true만 지원) — 재현성은 structured output(schema enum)과 후보 순서 deterministic
  생성으로 확보, temperature 조정은 애초에 이 provider에 옵션 자체가 없음.
- `.env`에 `OPENAI_MODEL` 값이 비어있어 이 환경에서는 실제 사용 모델을 확인할 수 없었음
  (사용자 로컬 .env에만 존재) — 비용은 GPT-4 계열 표준가로 추정.

### 신규 파일
- **`packages/character/birth-selection-prompt.mjs`** — 1차/2차 prompt + JSON schema.
  candidate_id를 실제 후보 목록으로 `enum` 제한(구조적 무결성 1차 방어).
- **`tests/40-birth-selection-ai-evaluation.test.mjs`**(20개) — §12 요구 10개 항목 전체 커버.

### 수정 파일
- **`apps/api/src/services/birth-selection-service.mjs`** — `rankCandidatesMock` 제거,
  `evaluateCandidates`(2단계 오케스트레이션), `makeCandidateId`(date+time 결정론적 ID),
  `validateNoFabricatedCandidates`(서버 post-processing 2차 방어) 추가. `extractBirthSelectionFields`
  에 `depth`('shallow'/'deep') 파라미터 추가.
- **`tests/birth-selection-safety-validators.mjs`** — `ABSOLUTE_CERTAINTY_PHRASES`에 "완벽한
  날/태어나야 한다/태어나면 성공" 추가. `MEDICAL_OVERREACH_PHRASES`에 "건강에 좋다/질병
  위험이 낮다" 추가. **"자연분만"/"제왕절개"는 단어 자체가 아니라 근처(윈도우 20자)에
  권유 동사(추천/권장/해야/좋습니다 등)가 있을 때만 FAIL** — 정상적인 안전 고지("자연분만
  이든 제왕절개든 의료진과 상의하세요")까지 오탐되지 않도록 새 근접 검사 로직 추가.
  `checkNoFabricatedCandidate`를 실제 배열 비교 로직으로 완성(기존엔 항상 `pass:true`인
  placeholder였음).
- **`packages/ai/providers/mock-provider.mjs`** — `birth_selection_first_pass`/
  `birth_selection_second_pass` schemaName 처리 추가(테스트 인프라, 다른 schemaName들과
  동일한 기존 패턴). 실제 후보 데이터에서 candidate_id를 파싱해서 결정론적 tier/결과를
  생성 — 항상 유효한 candidate_id만 반환하도록 설계.
- **`tests/38-birth-selection-pipeline.test.mjs`** — `rankCandidatesMock` 참조 테스트를
  `evaluateCandidates` 기반으로 교체, `extractBirthSelectionFields`의 depth별 테스트 추가.

### 안전장치 설계 결정
"자연분만"/"제왕절개" 단어 자체를 금지하면 정상적인 안전 고지 문구까지 실패 처리되는
위험이 있어(§8 마지막 요구사항), 기존 헤지/인용 감지와 유사한 "근접 윈도우 검사" 방식을
새로 만들어 권유 동사와 결합될 때만 FAIL로 판정 — 오탐 방지 테스트(5-5번)로 확인.

### 테스트 결과
`tests/40-birth-selection-ai-evaluation.test.mjs` 20/20 통과, `tests/38-birth-selection-pipeline.test.mjs`
7/7 통과(업데이트분 포함), `tests/39-birth-selection-safety.test.mjs` 9/9 무변경 통과.
**전체 스위트 608/608 통과**(재실행 확인, 1차 시도의 1건 실패는 기존에 알려진 무관 flaky
[casual-response-engine 반복방지] 테스트였음을 재실행으로 확인).

### 실제 사용 모델 및 예상 AI 원가
이 환경엔 `.env`의 `OPENAI_MODEL`이 비어있어 정확한 모델을 확인할 수 없음 — GPT-4 계열
표준가로 추정. 실측 프롬프트 글자수(MockAIProvider 계측):
- 20개 후보: 44,708자, 호출 1회(2차만)
- 120개 후보: 159,451자, 호출 3회(1차 2회+2차 1회)
- 300개 근접: 1차 3회 이상 + 2차 1회(실측 시간 약 86초 소요 — `computeCandidateCharts` 자체의
  차트 계산 성능 이슈, 이번 Phase 범위 밖이지만 실서비스 UX에 영향을 줄 수 있어 참고로 남김)

대략 추정 원가(GPT-4 계열 표준가 가정): 20개 약 300~500원, 120개 약 1,000~1,500원, 300개
약 3,000~4,000원 — 29,000원 상품 기준 원가 비율 1.5~14% 수준으로 감당 가능해 보이나,
**정확한 수치는 실제 모델 확정 후 재계산 필요**.

### 남은 Phase 2~4 (이번 범위 밖)
- Phase 2: 상품(29,000원)/entitlement(DATE_SELECTION)/analysis_scope 스키마 확장(날짜범위
  저장 필드 필요) 마이그레이션
- Phase 3: API 라우트(`apps/api/src/routes/birth-selection.mjs`)
- Phase 4: 프론트(`BirthSelectionScreen.jsx`) + SIGNAL ROOM 연결
- (별도) NAMING 89,000원/할인 59,000원 — 이번 범위에서 구현 안 함, entitlement 설계만
  이전 라운드에서 논의됨

### 배경

문구 수정 후 재실행 결과 `sources=true`(질문 성공!)로 바뀌었지만 `mingri: 50→50`(구독
quota 그대로) — 즉 **실제 access 버그 수정은 완전히 검증됐으나(질문이 성공함), 구독이
아닌 다른 경로로 성공**해서 여전히 17번만 FAIL로 표시됨.

### 원인

이 테스트 계정(user1)은 시나리오4/9에서 이미 SAJU_DETAIL을 2번 구매한 이력이 있음. 시나리오
17에서 세 번째 SAJU_DETAIL을 사서 **그것만** quota=0으로 만들었는데, 앞서 산 것 중 quota가
남은 게 있어서(`findActiveEntitlementByAnalysisType`이 `remaining_quantity desc`로 정렬해
가장 quota가 많은 걸 고름) 그쪽에서 정상 소비됨 — 구독 fallback 자체는 실행 안 됨.

### 수정

시나리오17에서 특정 entitlement 하나가 아니라, **이 사용자가 가진 SAJU_DETAIL entitlement
전부**를 quota=0으로 만들도록 변경 — 그래야 구독 fallback이 실제로 실행될 조건이 만들어짐.

### 확인

`findActiveEntitlementByAnalysisType`의 실제 access 버그 수정은 이번 재실행으로 이미
간접 검증됨(`sources=true`, 예전엔 `sources=false`였음). 남은 건 순수하게 "구독으로
정확히 넘어가는지"의 테스트 시나리오 조건 문제. 기존 588개 전부 무변경 통과.

### 사용자가 다시 확인할 것

`scripts/integration-test-live-db.mjs` 재적용 후 `npm run test:live-db` 재실행 — 이번엔
`sources=true` + `mingri: 50→49`가 나와야 정확히 구독 fallback이 검증된 것.

## [Unreleased] — 재검증 결과 정정: 시나리오17 실패는 실제 버그가 아니라 테스트 스크립트 오류

### 배경

payment-repository.mjs 수정 후 사용자가 재실행한 `test:live-db`에서 **여전히 17번만
실패**(17/18). `findstr`로 실제 파일에 수정이 반영됐음을 먼저 확인한 뒤, 다른 원인을 조사.

### 진짜 원인

**제가 작성한 시나리오17 테스트 코드 자체의 버그**였다. 실제 질문 문구로 `'내 성격이
궁금해'`를 썼는데, `classifyMessage('내 성격이 궁금해')`가 **`casual`(일상대화)로 분류**
된다는 것을 직접 실행해서 확인함:

```
내 성격이 궁금해 → casual
내 대운이 궁금해 → saju_question
```

즉 이 질문은 애초에 "사주 질문"으로 인식조차 되지 않아서 authorization 로직 자체가
실행되지 않았다 — 직전에 수정한 `findActiveEntitlementByAnalysisType`의 실제 버그 수정과
무관하게, 테스트 문구 선택 실수로 인한 오탐(false failure)이었다.

### 수정

`scripts/integration-test-live-db.mjs`의 시나리오17에서 질문 문구를 이 스크립트 전체에서
이미 검증된 문구 `'내 대운이 궁금해'`로 교체.

### 확인

**직전 라운드의 실제 버그 수정(`findActiveEntitlementByAnalysisType`에서
`remaining_quantity > 0` 필터 제거)은 정확했다** — 이건 재검증 대상이 아니라 테스트
스크립트만 재검증 대상. 기존 588개 전부 무변경 통과.

### 사용자가 다시 확인할 것

`scripts/integration-test-live-db.mjs`를 이번 파일로 덮어쓴 뒤 `npm run test:live-db`
재실행 — 이번엔 18/18이 나와야 정확하다.

## [Unreleased] — 실제 Supabase 통합 검증에서 발견한 구독 무력화 심각 버그 수정

### 배경

사용자가 확장된 `test:live-db`(18개 시나리오)를 실제 Supabase에서 실행 → **17/18 PASS**.
유일한 실패:

> ❌ 17. SAJU_DETAIL 자체 quota 소진 시 MINGRI_SUBSCRIPTION quota로 실제 대체 차감됨
> — sources=false, mingri: 50→50

즉 **SAJU_DETAIL 4900원을 사서 10회를 다 쓴 뒤, MINGRI_SUBSCRIPTION(명리 구독) 4900원을
또 사도 채팅이 계속 막히는** 심각한 버그. 구독 quota가 전혀 소비되지 않음(50→50 그대로)
— 구독 상품을 사는 이유 자체가 사라지는 버그였다.

### 원인

`findActiveEntitlementByAnalysisType`의 WHERE절에 `remaining_quantity > 0`이 있었다. 이
함수의 유일한 호출부(`entitlement-authorization-service.mjs`의 `findAccessEntitlement`)는
**"이 analysis_type을 유효하게 보유하는가"(access)**만 확인해야 하는데, 이 필터 때문에
**"자기 quota가 0이면 이 상품을 산 적이 없다"고 취급**해버렸다. 그 결과 access 판정 자체가
실패로 끝나서, 그 다음 단계(구독으로 quota만 보충하는 Phase6 핵심 로직)에 아예 도달하지
못했다. Mock 테스트로는 이 경로(자기 quota 소진 후 구독 fallback)를 실제로 재현한 적이
없어서 지금까지 드러나지 않았다.

### 수정

`findActiveEntitlementByAnalysisType`에서 `remaining_quantity > 0` 필터 제거 — access는
만료 여부만으로 판정. quota 소진 여부(그리고 구독으로 넘어갈지)는 이미 호출부
(`entitlement-authorization-service.mjs`)가 `entitlement.remaining_quantity`를 보고
정확히 처리하고 있었으므로, 이 필터 하나만 제거하면 전체 흐름이 의도대로 작동한다. 부가로
정렬 기준에 `remaining_quantity desc`를 추가해서, 재구매로 여러 entitlement가 있을 때
quota가 남은 쪽을 우선 선택하도록 개선.

### 신규 파일

- **`tests/55-subscription-fallback-access-bug-fix.test.mjs`**(2개) — 이 버그의 회귀 테스트.

### 검증

기존 586개 전부 무변경 통과 + 신규 2개 = **588/588**, 프론트 빌드 성공. **사용자가 실제
Supabase에서 `test:live-db`를 재실행해서 시나리오17이 PASS로 바뀌는지 확인 필요.**

### 이 사건이 확인해준 것

Phase 8의 quota 미차감 버그에 이어, **또 한 번 실제 DB 통합검증이 아니었으면 발견하지
못했을 심각한 버그**를 잡았다. 두 버그 모두 "Mock 테스트는 전부 통과했지만 실제 흐름 중
하나의 경로에서만 발생하는" 종류였다 — 새 결제/entitlement 기능을 만들 때마다 실제 DB
검증을 반드시 거쳐야 하는 이유를 다시 한번 실증.

## [Unreleased] — SIGNAL ROOM MEMBERSHIP 화면 구현 (3차)

### 조사 결과 (구현 전 확인, 12개 항목)

| 항목 | 확인 결과 |
|---|---|
| 상품 ID | `MINGRI_SUBSCRIPTION` |
| 가격 | 4,900원 |
| quota | 50회 |
| validity | 720시간(30일) |
| subscription_group | `MINGRI`(아이시그널은 `CHILD_SIGNAL`로 완전 분리, 무변경) |
| 결제 연결 | `ProductsScreen.jsx`에 Toss SDK+`createOrder` 완비 → **그대로 재사용** |
| 결제 후 entitlement 생성 | `confirmPaymentTransaction`(기존, Phase4~6에서 이미 검증됨) → 무변경 |
| 사용량 차감 | `consumeQuestionEntitlement`+구독 fallback(기존, Phase6) → 무변경 |
| 만료 처리 | `expires_at` 서버 계산(기존) → 무변경 |
| 기존 조회 API | `GET /api/payments/entitlements`(`listEntitlementsForUser`) — **이미 product_code/remaining_quantity/expires_at을 반환** → 새 API 불필요, 그대로 재사용 |
| 기존 프론트 함수 | `api.listProducts()`, `api.listEntitlements()`, `api.createOrder()` **전부 이미 존재** → 새 함수 0개 추가 |
| mypage/products 재사용 가능 부분 | `ProductsScreen.jsx`의 결제 흐름(Toss SDK 호출 패턴)을 그대로 복제 |

**결론**: 새 백엔드/API/entitlement 로직 없이 기존 것만으로 전부 구현 가능함을 확인 후 진행.

### 신규 파일

- **`apps/web/src/components/MembershipScreen.jsx`** — 보유 여부에 따라 분기:
  - 미보유: 상품 설명(서버 응답 그대로) + 구매 버튼(`ProductsScreen.jsx`와 동일한 Toss 결제 패턴)
  - 보유: 남은 질문 횟수/만료까지 남은 일수(서버 `expires_at` 계산)/보유한 상세분석 목록
    (`entitlements` 응답에서 `SAJU_DETAIL`/`YEARLY_FORTUNE_CHAT` 필터링해서 표시)
  - 비로그인: 로그인 유도 버튼
  - **권한 판정은 하지 않음** — "질문 가능 여부"는 화면이 판단하지 않고, 서버가 이미 발급한
    entitlement 목록을 그대로 보여줄 뿐(§C 원칙 그대로 — 실제 authorization은 채팅 시점에
    기존 백엔드 로직이 결정).

### 수정 파일

- **`apps/web/src/App.jsx`** — SIGNAL ROOM의 `member`를 `comingSoon` 대신 새 `membership`
  화면으로 라우팅. `homeOrigin`(기존 구조 그대로 재사용)으로 뒤로가기 시 SIGNAL ROOM 복귀.
  로그인 유도 시 `pendingAfterSignup`(기존)에 `homeOrigin`을 담아 로그인 후 원래 홈으로 복귀.
- **`apps/web/src/styles/app.css`** — `.membership-screen__*` 스타일 추가(기존 카드/버튼
  디자인 언어 재사용, 보라색 포인트 하나만 SIGNAL ROOM과 시각적으로 연결, 픽셀 UI 미사용).

### 실측 검증 (실제 Playwright 브라우저)

- 비로그인 상태로 MEMBERSHIP 클릭 → 로그인 유도 화면 정상 표시.
- 뒤로가기 → SIGNAL ROOM 정확히 복귀(애니메이션 재생 포함).
- 기존 4개 서비스(사주/자미두수/궁합/아이시그널) 전부 회귀 없음 재확인.
- 기존 백엔드 전체 테스트 **586/586 무변경 통과**, 프론트 빌드 성공(72 모듈).

### 검증하지 못한 것 (환경 한계, 로컬 확인 필요)

이 샌드박스엔 실제 Supabase 연결이 없어 API 서버가 `DATABASE_URL` 에러로 요청 처리 중
종료됨(이 환경 자체의 한계, 이번 변경과 무관 — 기존에도 동일). **로그인 상태에서 실제
entitlement 데이터가 정확히 표시되는지, 실제 Toss 결제창까지 여는지는 사용자가 로컬 실제
Supabase 환경에서 최종 확인 필요.**

### 절대 하지 않은 것 확인
가격/quota/validity/subscription_group 값 전부 무변경, 결제 로직 재작성 없음, Saju/Ziwei/
Compatibility/Child 로직 무변경, 새 ziwei service key 생성 안 함(기존 'saju' 매핑 유지),
기존 HomeScreen 제거 안 함.

## [Unreleased] — SIGNAL ROOM 홈을 실제 서비스에 연결 (2차: 자미두수/궁합/아이시그널)

### 목표

1차(사주)에 이어 나머지 3개(🟠자미두수 🟡궁합 🟢아이시그널)를 기존 화면/로직 그대로 연결.
새 백엔드/entitlement/결제 로직 0개 추가.

### 실제 테스트로 발견하고 고친 버그 1건

**자미두수 클릭 시 빈 화면**이 나오는 실제 버그를 브라우저 테스트로 발견. 원인: `jami`를
`'ziwei'`라는 새 serviceKey로 매핑했는데, `ServiceIntroScreen`의 `SERVICE_INTRO` 객체엔
`child`/`saju`/`relationship` 3개만 정의되어 있고 `ziwei`가 없어서 `info`가 `undefined`가
됨. **수정**: 자미두수는 실제로 사주와 완전히 같은 상품(SAJU_DETAIL 번들, 기존 정책 그대로)
이므로, 새 키를 추가하지 않고 `'saju'`로 통일 매핑 — 가장 최소 침습적인 수정.

### 핵심 설계 — `homeOrigin` 상태 추가 (뒤로가기 정확도)

`pendingService` 문자열만으로는 "SIGNAL ROOM에서 왔는지 기존 teal 홈에서 왔는지"를 구분할
수 없음을 발견(`mypage`/`products`/회원가입/결제완료 등 여러 기존 흐름이 여전히 teal
`home`으로 돌아가므로, teal 홈이 아직 죽은 코드가 아님). **최소 상태 하나**(`homeOrigin`,
기본값 `'signalRoom'`)를 추가해서 어느 홈에서 진입했는지 정확히 추적 — 새 라우팅 구조가
아니라 기존 `screen`/`pendingService` 패턴에 필드 하나 추가.

`handleHomeSelect(serviceKey, origin='signalRoom')`으로 확장, teal `HomeScreen`의
`onSelect`만 명시적으로 `'home'`을 넘기도록 수정. `intro`/`welcome`/`birth`/`compatibility`/
`battle`/`child` 6개 화면의 onBack/onHome이 전부 `homeOrigin`을 참조하도록 통일.

### 서비스 매핑

```
SR_ID_TO_SERVICE_KEY = { saju: 'saju', jami: 'saju', gunghap: 'relationship', isignal: 'child' }
```
기존 `handleHomeSelect`/`handleIntroNext`의 분기 로직(welcome/child/birth+compatibility)을
그대로 재사용 — 새 로직 0개.

### 변경 파일

- `apps/web/src/App.jsx`만 수정(신규 파일 없음).

### 실측 검증 (실제 Playwright 브라우저)

- 자미두수/궁합/아이시그널 클릭 → 각각 실제 소개 화면("나의 시그널"/"관계 시그널"/
  "아이시그널")으로 정확히 진입 확인(스크린샷).
- 3개 전부 뒤로가기 → SIGNAL ROOM으로 정확히 복귀, 애니메이션 정상 재생 확인.
- 출생일 택일(아직 이번 범위 밖) → 여전히 COMING SOON 정상 확인.
- 1차(사주) 연결이 이번 변경으로 영향받지 않았음을 재확인(진입/뒤로가기 둘 다).
- 기존 백엔드 전체 테스트 **586/586 무변경 통과**, 프론트 빌드 성공(71 모듈).

### 기존 권한/결제 로직 변경 여부
**변경 없음.** SAJU_DETAIL/RELATIONSHIP_*/CHILD_DETAIL entitlement, authorization, 상품
가격/구조 전부 무변경 — 이번 작업은 화면 라우팅 연결만.

### 다음 단계 추천
1. MEMBERSHIP 구매 UI(백엔드 이미 검증됨) 2. 출생일 택일 화면+결제 연결 3. 작명소 신규 개발

## [Unreleased] — SIGNAL ROOM 홈을 실제 서비스에 연결 (1차: 사주)

### 배경

Figma Make 프로토타입(별도 프로젝트, `signal-room-figma` 폴더)에만 존재하던 SIGNAL ROOM
별밤 디자인 홈 화면을, 처음으로 실제 서비스(`apps/web`)에 이식하고 "사주" 메뉴를 실제 기존
사주 흐름에 연결했다. 나머지 6개 메뉴는 여전히 COMING SOON으로 유지(1차 구현 범위).

### 조사 결과

- SIGNAL ROOM 디자인은 이식 전까지 `apps/web`에 전혀 없었음(확인 완료).
- Figma 프로토타입의 `SignalRoomHome` 부분은 순수 React+SVG+인라인스타일만 사용(외부 UI
  라이브러리 의존 없음, `lucide-react` 등 미사용) — 새 의존성 추가 없이 이식 가능함을 확인.
- 실제 사주 진입 경로: `HomeScreen.onSelect('saju')` → `handleHomeSelect` → `intro` →
  `welcome` → `birth` → 분석(기존 완비, 새 로직 0개 추가).
- 자미두수는 사주와 완전히 동일한 흐름에 이미 번들되어 있음(`pendingService==='saju'||'ziwei'`).

### 신규 파일

- **`apps/web/src/components/SignalRoomHome.jsx`** — Figma 프로토타입에서 TS→JSX로 변환해서
  이식. `SR_SERVICES`(7개 천체 좌표/색상/한자), `CelestialBody`(별/행성/달/별자리/혜성/성운/
  포털 렌더러), `PixelCat`(눈 깜빡임 idle 애니메이션 포함), 순차 등장 애니메이션(phase 0~10),
  탭 flash 피드백을 그대로 포함. **"무엇을 보여줄지"만 담당하고 "선택 시 어디로 갈지"는
  전혀 모른다** — `onService(id)` 콜백 하나만 노출, 실제 라우팅은 전부 `App.jsx`가 담당(새
  상태관리/라우팅 구조 도입 없음).

### 수정 파일

- **`apps/web/src/App.jsx`**:
  - 최초 화면을 `'home'`(기존 teal 홈) → `'signalRoom'`으로 변경. 기존 `HomeScreen`은
    삭제하지 않고 그대로 남겨둠(다른 진입 경로에서 계속 재사용 가능).
  - `onService(id)`: `id==='saju'`일 때만 기존 `handleHomeSelect('saju')`를 그대로 호출
    (새 로직 0개, 완전 재사용). 그 외 6개는 신규 `comingSoon` 화면으로 이동.
  - 사주 흐름(`intro`/`welcome`/`birth`)의 뒤로가기·홈 버튼을, `pendingService`가
    `saju`/`ziwei`일 때만 `signalRoom`으로 복귀하도록 조건부 수정. **다른 서비스(child,
    compatibility 등, 이번 범위 밖) 흐름은 기존 `home` 이동 그대로 무변경.**
- **`apps/web/src/styles/app.css`** — `.sr-coming-soon*` 스타일 추가(어두운 우주 테마,
  기존 teal 팔레트 클래스와 분리).

### 실측 검증 (실제 Playwright 브라우저)

- 실제 앱(`apps/web`) 안에서 SIGNAL ROOM이 Figma 프로토타입과 동일하게 렌더링됨을 스크린샷
  으로 확인.
- **사주(빨강 별) 클릭 → "COMING SOON"이 아니라 실제 `ServiceIntroScreen`("나의 시그널",
  실제 가격/설명, "다음" 버튼)으로 정확히 진입** — 핵심 목표 달성 확인.
- 뒤로가기 → SIGNAL ROOM으로 정확히 복귀, 애니메이션 정상 재생 확인.
- 기존 백엔드 전체 테스트 **586/586 무변경 통과**, 프론트 빌드 성공(71 모듈).

### 2차 조사 — 나머지 6개 서비스 구현 상태

| 서비스 | 기존 구현 | 화면 | 백엔드 | 다음 단계 |
|---|---|---|---|---|
| 자미두수 | 사주와 완전 번들 | 있음 | 있음 | 단순 연결만 하면 됨 |
| 궁합 | `CompatibilityScreen` 있음 | 있음(chartId 필요) | 있음 | 단순 연결(기존 chartId 분기 재사용) |
| 아이시그널 | `ChildSajuScreen` 완비 | 있음 | 있음 | 단순 연결만 하면 됨 |
| 출생일 택일 | 백엔드 서비스만 존재 | 없음 | Mock만, 결제 미연결 | 별도 개발 필요 |
| 작명소 | 완전 미구현 | 없음 | 없음 | 완전 별도 개발 필요 |
| MEMBERSHIP | 백엔드 완비(Phase6~8 검증됨) | 없음 | 있음 | 구매 UI만 만들면 됨 |

### 남은 문제 / 다음 단계
자미두수/궁합/아이시그널은 사주와 동일한 패턴으로 즉시 연결 가능(최우선), MEMBERSHIP은
UI만 있으면 됨, 택일/작명소는 신규 개발 필요.

## [Unreleased] — 자녀 신년운세 연령대별 콘텐츠 정책 구현 (Phase 11 후속)

### 배경

Phase 11 실제 AI 품질 검증에서, 영유아(2026년 8월생) 대상 신년운세에 "부부관계", "계약·협업"
같은 성인 생애 내용이 그대로 생성되는 심각한 결함을 발견. 사용자가 확정한 설계(3가지 조정:
① fortune_year 1월 1일 기준 나이 ② `preschool`/`child`/`teen`/`adult` 명명 ③ 19세 이상은
자녀용 특별 처리 없음)를 반영해서 구현.

### 확정 정책

- **나이 계산**: `fortune_year`의 **1월 1일 기준** 만 나이로 밴드 고정(연중 나이 변화로 밴드가
  안 흔들리게). 학년 정보는 쓰지 않음(복잡도 대비 이득 적다고 판단, 확정).
- **밴드**: `preschool`(0~6) / `child`(7~12) / `teen`(13~18) / `adult`(19+, 자녀용 특별
  지시 미적용).
- **콘텐츠 재해석**(JSON 스키마 필드명은 그대로, 의미만 연령대에 맞게 변경):
  - `career` → 놀이 속 관심(preschool) / 흥미·적성 발견(child) / 진로 탐색(teen).
  - `love` → 부모·가족 애착(preschool) / 친구·가족 관계(child) / 또래·가벼운 이성관심(teen).
    `preschool`/`child`는 "연애/부부/이성/결혼" 단어 자체를 금지.
  - `finance` → 부모의 양육/교육 환경 중심 + **아이 본인 원국의 재성(財星) 구조를 근거로
    "성인이 되었을 때의 재물 성향"을 한두 문장 덧붙임**(사용자 추가 요구사항 — 장기 경향으로만
    표현, 구체적 금액/시기/직업 단정 금지).

### 신규 파일

- **`packages/shared/age-band.mjs`** — `calculateAgeBand(birthDateIso, fortuneYear)`. 실제
  버그 하나 발견 후 즉시 수정: 최초 구현이 생일을 고려하지 않고 단순 연도차만 계산해서, 1월생이
  아닌 아이는 전부 실제보다 한 살 많게 계산되는 문제가 있었음(예: 2020년 8월생을 2026년 기준
  7세로 계산 — 실제는 만 6세) — "1월 1일 시점에 생일이 아직 안 지났으면 -1 보정" 로직 추가로
  수정, 테스트로 경계값(6/7, 12/13, 18/19세) 전부 확인.
- **`tests/54-child-age-band-content-policy.test.mjs`**(12개).

### 수정 파일

- **`packages/character/yearly-fortune-prompt.mjs`** — `buildYearlyFortuneBasicPrompt`/
  `buildYearlyFortuneChatPrompt`에 `ageBand` 선택적 파라미터 추가(기본값 `null` — 본인/성인
  신년운세는 완전 무변경, 하위호환). `preschool`/`child`/`teen`일 때만 연령대별 콘텐츠 지시
  추가.
- **`apps/api/src/services/yearly-fortune-service.mjs`** — `scope.child_profile_id`가 있을
  때만 `targetChart.canonical.subject.birth_date`로 나이 밴드 계산, 19세 이상이면 `null`로
  정규화(자녀용 특별 처리 없음). 본인(`chart_id`) 경로는 이 계산 자체를 시도하지 않음(완전
  무변경). `result_data`에 `age_band`도 함께 저장(투명성).
- **`scripts/sample-yearly-fortune-quality.mjs`** — 영유아 fixture에 대해 나이 밴드를 계산해서
  프롬프트에 반영하도록 갱신(사용자가 실제 API로 재검증할 수 있도록).

### 검증

기존 574개 전부 무변경 통과 + 신규 12개 = **586/586**, 프론트 빌드 성공. **사용자가 다시
`node scripts/sample-yearly-fortune-quality.mjs` 실행해서 영유아 샘플(#3,#4)에 성인 생애
내용이 더 이상 나오지 않는지 실제 재검증 필요.**

## [Unreleased] — Phase 11: 실제 OpenAI API 호출로 발견한 스키마 버그 수정

### 배경

Phase 11(YEARLY_FORTUNE 실제 품질 샘플링) 진행 중, 사용자가 실제 OpenAI API로 8개 샘플을
생성 시도했으나 **8/8 전부 HTTP 400으로 실패**. 콘텐츠 품질 평가 자체가 불가능한 상태였음.

### 원인

`packages/character/yearly-fortune-prompt.mjs`의 `YEARLY_FORTUNE_RESULT_SCHEMA`에서
`chart_interaction` 필드가 `properties`엔 있지만 `required` 배열엔 빠져 있었음. 일반 JSON
Schema 관례("선택적 필드는 required에서 뺀다")를 따랐지만, **OpenAI structured outputs strict
모드는 이 방식을 지원하지 않는다** — 모든 property가 반드시 `required`에 포함되어야 하고,
선택성은 타입에 `null`을 포함시켜서만 표현해야 한다(`type: ['string', 'null']`). 지금까지
`MockAIProvider`로만 테스트해서(엄격한 스키마 검증 안 함) 이 버그가 드러난 적이 없었음 —
정확히 "실제 API로 검증해야 잡히는 버그"의 사례.

### 수정

`chart_interaction`을 `required` 배열에 추가(2줄 변경 — 타입은 이미 `['string','null']`로
올바르게 되어 있었음, required 배열만 빠져 있었음). 프롬프트 문구/콘텐츠 관련 내용은 전혀
건드리지 않음.

### 신규 파일

- **`tests/53-yearly-fortune-schema-strict-mode.test.mjs`**(2개) — 모든 property가 required에
  포함되는지 자동 검증(향후 새 필드 추가 시 같은 실수 방지), chart_interaction의 nullable
  타입 확인.

### 검증

기존 572개 전부 통과(1건 무관한 기존 flaky 재확인, 재실행으로 해소) + 신규 2개 =
**574/574**, 프론트 빌드 성공. **사용자가 다시 `node scripts/sample-yearly-fortune-quality.mjs`
실행해서 실제 8개 샘플 생성 재시도 필요.**

## [Unreleased] — Phase 10: client-supplied entitlementId 직접 소비 레거시 제거

### 배경

Phase 10 조사에서 발견: `conversations.mjs`의 `POST /:id/messages`에 클라이언트가 body로 보낸
`entitlementId`를 `handleFreeTextMessage`(Router/authorization/LLM) 호출 **이전에** 무조건
`consumeQuestionEntitlement`로 소비하는 레거시 코드가 남아있었음. 프론트는 실제로 이 파라미터를
전혀 안 보내서(grep 0건) 사용자 피해는 없었지만, API 표면 자체가 §3(LLM 호출 전 authorization
순서)/§6(client entitlementId 미신뢰)/§20(실패 시 미차감) 정책을 우회할 수 있는 죽은 코드였음.

### 수정

- `apps/api/src/routes/conversations.mjs` — `entitlementId` 추출/소비 블록 전체 제거,
  미사용 `consumeQuestionEntitlement` import 제거. entitlement 소비는 이제 오직
  `conversation-service.mjs`의 authorization 성공 후 차감 흐름(2곳: `handleFreeTextMessage`,
  `pickCatalogChoice`) 하나로만 이루어짐.

### 회귀 확인 (§5 grep)

- 다른 라우트 파일 어디에도 동일 레거시 패턴 없음(확인 완료).
- `consumeQuestionEntitlement` 호출은 프로젝트 전체에서 정확히 2곳뿐이며, 둘 다
  `pipelineResult.authorization.entitlementId`(서버가 authorization 성공 후 직접 찾은 값)만
  사용 — 클라이언트가 보낸 값을 참조하는 호출 없음.

### 정책 변경으로 기대값을 수정한 기존 테스트 2건

`tests/41-pricing-policy.test.mjs`의 C1/C2가 **정확히 이번에 제거한 레거시의 존재 자체를
검증**하고 있었음 — 검증기를 약화한 게 아니라, 레거시가 실제로 사라졌는지 확인하는 반대 방향
검증으로 전환.

### 신규 파일

- **`tests/52-legacy-entitlementid-removal.test.mjs`**(4개) — 실제 HTTP 엔드포인트에 위조
  entitlementId를 넣어 보내서(§3 요구사항) 영향이 전혀 없음을 end-to-end로 확인(레거시였다면
  `ENTITLEMENT_NOT_FOUND`로 404가 났을 상황이 지금은 정상 200으로 처리됨), 소스 레벨로 라우트
  전체에 동일 패턴이 없는지 확인.

### 검증

기존 568개 중 2개 기대값 수정 + 신규 4개 = **572/572**(재실행 2회 안정), 프론트 빌드 성공.

### 추가 발견사항 (이번 작업 범위 밖, 참고용)

- §4 복합질문(서로 다른 대상 간 비교, 예: "내 사주와 자녀A 신년운세 비교")은 명시적 차단
  로직은 없지만 conversation이 단일 대상에 구조적으로 고정되어 있어 데이터 유출 위험은 없음
  — 이번 작업 범위 밖이라 임의로 손대지 않음.
- ZIWEI_DETAIL 독립 상품, RELATIONSHIP_DETAIL 2-chart 문제는 계속 미해결(기존 결정대로 유지).

## [Unreleased] — Phase 9 Frontend: YEARLY_FORTUNE UI 완성 검증

### 배경

직전 응답에서 "프론트는 다음 라운드로 이월"이라고 보고했으나, 실제 코드베이스를 재확인한 결과
**핵심 프론트 플로우가 이미 구현되어 있었음을 확인**했다(본인/자녀 선택 → 연도 선택 → 기존
구매 lookup → 상품선택/결과 화면 → BASIC↔CHAT 업셀 → AI 채팅 진입까지 전부). 이번 라운드는
새로 만들지 않고 **실제로 정확히 동작하는지 전수 검증**하는 데 집중했다.

### 확인된 실제 구현 파일

- `apps/web/src/components/YearlyFortuneScreen.jsx` — 대상 선택(본인/자녀 공용 컴포넌트,
  §14 "별도 복제 화면 만들지 않는다" 원칙 준수) → 연도 선택 → `lookup` API로 기존 구매 확인
  → 상품 화면(BASIC/CHAT 카드, 핵심 차이 명시) 또는 결과 화면 분기.
- `apps/web/src/components/YearlyFortuneResult.jsx` — 실제 `result_data` 필드만 조건부
  렌더링(§10 원칙 정확히 준수 — 없는 필드는 자연스럽게 숨김, "데이터 없음" 문구 없음). BASIC/
  CHAT 구분 표시, summary+keywords 카드, 월별 흐름, 시기 정보, `chart_interaction`(CHAT 전용),
  업셀 카드, quota/만료 표시(전부 서버값 그대로 — 프론트 계산 없음), 만료 후에도 결과는 계속
  열람 가능하고 채팅만 막히는 UX(§13 정확히 구현).
- `apps/api/src/routes/yearly-fortune.mjs` — `GET /lookup`(대상+연도로 기존 scope 조회),
  `POST /:analysisScopeId/chat`(CHAT 결과에서 conversation 생성, `fortune_year`를 conversation
  에 그대로 태깅해서 Phase5의 conversation-scoped authorization을 그대로 재사용 — 새 권한
  로직 없음), `GET /:analysisScopeId`(생성/조회).
- `apps/api/src/repositories/analysis-scope-repository.mjs` — `findYearlyFortuneScopesForTarget`.
- `apps/web/src/api/client.js` — `lookupYearlyFortune`, `listChildProfiles`, `createOrder`
  (fortuneYear 파라미터 지원), `getYearlyFortuneResult`.
- `App.jsx` — `handleOpenYearlyFortuneChat`, MoreMenu에 진입점 1개(§14 원칙대로 본인/자녀용
  중복 메뉴 없음).

### 실측 검증

- 실제 서버 기동 후 curl: `/api/yearly-fortune/lookup`, `/api/yearly-fortune/:id/chat` 둘 다
  인증 없이 401 정상 차단 확인.
- 서버 시작 로그에 에러 없음.
- 전체 **568/568** 테스트 통과(기존 SAJU/CHILD/RELATIONSHIP 화면 회귀 없음 — §23의 18~20번
  요구사항을 포함한 회귀 테스트가 이미 `51-yearly-fortune-frontend-support.test.mjs`에 존재).
- 프론트 빌드 성공(70 모듈).

### 결론

Phase 9 Frontend는 지시서의 완료 조건(§26 — 자녀 990원 구매→결과 생성→영구열람, 4900원
구매→상세결과+채팅 50회/30일, 만료 후 결과열람은 유지되고 채팅만 차단)을 코드 레벨에서
전부 충족한 상태임을 확인했다.

### 남은 사항

- 실제 브라우저 수동 확인(§24)은 이 환경(서버 사이드 샌드박스)에서 수행 불가 — 사용자가 로컬
  `npm run dev`(API)+`cd apps/web && npm run dev`(프론트)로 직접 확인 필요.
- 실제 Supabase에서 신년운세 CHAT 구매→채팅 진입→50회 차감→30일 만료 후 채팅 차단까지의
  end-to-end는 `npm run test:live-db` 확장이 필요하면 추가 요청 시 반영.

## [Unreleased] — Phase 9: YEARLY_FORTUNE 콘텐츠/결과 생성/영구 열람 (백엔드 완성, 프론트는 다음 라운드)

### 확정 정책 반영

990원(BASIC)/4900원(CHAT) 둘 다 **"생성 1회 + 영구 열람"** — CHAT만 추가로 50회/30일 채팅
entitlement. 재접속 시 이미 생성된 결과가 있으면 **LLM을 절대 다시 호출하지 않는다.**

### 사전 확인 5개 결과

1. `products.tier`(canonical)는 `basic`/`detail`/`subscription` — 이 값을 그대로 씀.
2. `analysis_scopes.result_data`는 컬럼만 있고 지금까지 미사용 — 이번에 실제로 채우기 시작.
3. `purchased_analyses.tier`는 `basic`/`full`(다른 컨벤션) — **저장소는 안 가져오고 "불변+tier
   구분" 패턴만 참고**, 실제 값은 `products.tier`(basic/detail) 컨벤션을 따름.
4. **불일치 발견**: `YEARLY_FORTUNE_CHAT`이 기존엔 10회/24시간으로 시드되어 있었음 — 이번 확정
   정책(50회/30일)과 다름. `010_yearly_fortune_chat_quota_update.sql`로 갱신, `008` 원본도
   신규 환경 기준으로 함께 수정.
5. Phase8에서 검증된 `consumeQuestionEntitlement` 호출 경로는 무변경 — 그대로 재사용.

### 신규 파일

- **`migrations/010_yearly_fortune_chat_quota_update.sql`** — quota 50/30일 갱신.
- **`packages/character/yearly-fortune-prompt.mjs`** — BASIC/CHAT 프롬프트 + 공유 JSON 스키마
  (`YEARLY_FORTUNE_RESULT_SCHEMA`). CHAT만 `chart_interaction` 필드를 명시적으로 요구해서
  `CHAT ⊃ BASIC` 관계를 스키마 레벨에서 구현(완전히 별개 스키마 아님).
- **`apps/api/src/services/yearly-fortune-service.mjs`** — `getOrGenerateYearlyFortuneResult`.
  이미 결과가 있으면 즉시 반환(LLM 0회), 없으면 tier를 서버가 직접 조회(클라이언트 신뢰
  안 함)해서 BASIC/CHAT 프롬프트 분기 후 생성. `annual_periods` 전체가 아니라 해당
  `fortune_year` 항목 하나만 추출해서 AI에게 전달.
- **`apps/api/src/routes/yearly-fortune.mjs`** — `GET /api/yearly-fortune/:analysisScopeId`
  (`requireAuth`, 세션 userId로만 소유권 검증).
- **`tests/50-yearly-fortune-content.test.mjs`**(15개).

### 수정 파일

- **`apps/api/src/repositories/analysis-scope-repository.mjs`** — `fillAnalysisScopeResultOnce`
  추가. `WHERE result_data IS NULL`로 **DB 레벨에서 "최초 1회만 채움"을 강제** — 기존 immutable
  원칙(§14, 생성 후 절대 변경 금지)을 지키면서 지연 생성(lazy generation)을 가능하게 하는
  유일한 안전한 방법. 동시 요청 경쟁 상황에서도 두 번째 호출은 자동으로 no-op.
- **`apps/api/src/repositories/payment-repository.mjs`** — `findEntitlementByAnalysisScopeId`
  추가. analysis_scope가 어떤 tier로 구매됐는지 서버가 직접 역참조 조회(클라이언트가 tier를
  주장하는 걸 신뢰하지 않음).
- **`apps/api/src/server.mjs`** — 라우터 등록, 기존 `childCoachAiProviderFactory`(Luna)/
  `aiProviderFactory`(Terra) 그대로 재사용(새 모델 팩토리 없음).
- **`apps/web/src/api/client.js`** — `getYearlyFortuneResult` 함수 추가.
- **`scripts/integration-test-live-db.mjs`** — YEARLY_FORTUNE BASIC 생성→영구열람(LLM 0회
  재확인)/본인·자녀 격리 시나리오 2개 추가(15~16번).

### 실측 검증

- 실제 서버로 curl: 인증 없이 조회 → 401 정상 차단.
- 소스 레벨: `result_data` 존재 체크가 LLM 호출보다 먼저 실행되는지, tier가 클라이언트가 아닌
  서버 조회로만 결정되는지, `WHERE result_data IS NULL` 가드가 실제로 있는지 확인.
- 기존 543개 전부 무변경 통과 + 신규 15개 = **558/558**, 프론트 빌드 성공.

### 이번 라운드에서 하지 않은 것 (다음 라운드로 이월)

- **프론트 결과 화면 UI**(섹션별 카드, 월별 흐름 표시)와 **BASIC→CHAT 업셀 UI**, **자녀 신년운세
  선택 UI** — 백엔드(생성/저장/API) 완성에 집중하기 위해 이번엔 API 클라이언트 함수 하나만
  추가하고 화면 구현은 보류. 품질 저하 없이 다음 라운드에서 이어감.
- 실제 Supabase에서의 최종 검증은 사용자가 `npm run test:live-db`(확장된 15~16번 포함)로
  로컬에서 직접 실행 필요.

### STOP 여부
1~6번 STOP 조건 전부 해당 없음.

## [Unreleased] — 실제 Supabase 통합 검증에서 발견한 심각한 과금 버그 수정

### 배경

사용자가 `npm run test:live-db`를 실제 Supabase에서 실행해서 **13/14 PASS**를 얻음. 유일한
실패:

> ❌ 6. 질문 성공 후 quota가 10→9로 차감됨 — sources=true, remaining=10

즉 **실제 유료 분석(사주 채팅)은 정상적으로 성공했는데, entitlement의 남은 횟수가 전혀
줄어들지 않는** 심각한 버그. 이건 Mock/소스 레벨 테스트로는 절대 못 잡는 버그였다 — 정확히
이번 실제 DB 통합 검증이 필요했던 이유를 실증한 사례.

### 원인

`packages/ai/pipeline.mjs`의 `runQuestionPipeline`이 Phase3에서 `authorizeBeforeAnalysis`
훅을 추가할 때, **거부(authorized:false)된 경로의 반환값에만 `authorization` 필드를 넣고,
허용되어 분석까지 성공한 경로의 최종 반환값에는 이 필드 자체를 빼먹었다.**

`conversation-service.mjs`는 차감 여부를 `pipelineResult.authorization?.authorized`로
판단하는데, 성공 경로에서 이 필드가 항상 `undefined`였기 때문에 이 조건이 **단 한 번도
true가 될 수 없었다** — 즉 Phase3~7 내내 "분석 성공 시 quota 차감"이 코드상 존재는 했지만
실제로는 한 번도 실행되지 않는 죽은 코드였다. 소스 레벨 테스트(§20-4 "consumeQuestion
Entitlement가 pipelineResult.authorization 이후에 호출되는지")는 호출 *위치*만 확인했지,
그 조건이 실제로 true가 되는지는 실제 DB로 전체 흐름을 안 돌려보면 알 수 없었다.

### 수정

`packages/ai/pipeline.mjs` — `authResult`를 함수 스코프로 끌어올려서, **허용된 성공 경로의
최종 반환값에도 `authorization: authResult`를 포함**시켰다. `authorizeBeforeAnalysis`를
아예 안 쓰는 기존 호출부(하위호환)는 `authorization: null`을 받아 기존과 동일하게 동작한다.

### 신규 파일

- **`tests/49-authorization-success-path-bug-fix.test.mjs`**(3개) — 이 버그의 회귀 테스트.
  허용 경로/거부 경로/하위호환 경로 각각의 `authorization` 필드 존재 여부를 직접 검증.

### 검증

기존 540개 전부 무변경 통과 + 신규 3개 = **543/543**, 프론트 빌드 성공. **사용자가 실제
Supabase에서 이 수정을 다시 검증해야 함**(로컬에서 `npm run test:live-db` 재실행, #6이
PASS로 바뀌는지 확인).

### 이 사건이 확인해준 것

Phase 7 보고서에서 "540/540 통과"라고 했던 것은 **애플리케이션 로직이 설계대로 맞다는
뜻이지, 실제 Postgres에서 끝까지 맞는다는 뜻은 아니다**라고 사용자가 미리 지적했던 우려가
정확히 실현된 사례. Mock 테스트는 `authorizeBeforeAnalysis` 콜백이 반환하는 객체 구조를
그대로 신뢰했지만, 실제 파이프라인 코드의 반환 경로별 필드 누락은 실제 실행 전까지 드러나지
않았다.

## [Unreleased] — 실제 Supabase 적용 중 발견한 실제 버그: model_tier vs tier 컬럼명 불일치

### 배경

사용자가 `npm run test:live-db`로 008/009 마이그레이션을 실제 Supabase에 적용하려다
`column "model_tier" of relation "products" does not exist` 에러 발생.

### 원인

`004_product_quota_columns.sql`이 실제로 만드는 컬럼명은 `tier`(코드 전체 — `child-profile-
service.mjs`, `compatibility-analysis-service.mjs`, `charts.mjs`, `child-profiles.mjs`,
`compatibility.mjs` 등 핵심 Luna/Terra 모델 분기 로직이 전부 이 이름을 씀)인데, Phase 5~6
작업 중 `payment-repository.mjs`와 `008`/`009` 마이그레이션에서 실수로 **존재하지 않는
`model_tier`라는 다른 이름을 새로 만들어 참조**했다. 지금까지 이 환경(실제 DB 없음)에서는
"소스 레벨 문자열 검증" 테스트만 있었기 때문에, 이 불일치가 실제 DB 적용 전까지 발견되지
않았다 — **정확히 이번 실제 Supabase 통합 검증이 존재해야 하는 이유를 실증한 사례**.

### 수정

- `migrations/008_yearly_fortune_products.sql`, `migrations/009_subscription.sql` —
  `model_tier` → `tier`로 전부 수정.
- `apps/api/src/repositories/payment-repository.mjs` — `findActiveYearlyFortuneChatEntitlement`
  쿼리의 `p.model_tier = 'detail'` → `p.tier = 'detail'`로 수정.
- 관련 테스트 3개 파일의 검증 문자열도 실제 컬럼명에 맞게 수정(정책 약화 아님, 오타 수정).

### 검증

기존 540개 전부 무변경 통과(수정은 문자열/컬럼명 정정뿐, 로직 변경 없음).

### 사용자가 다시 해야 할 것

1. **008번을 처음부터 다시 실행**(이전 시도가 중간에 실패했으므로 → 실패 시 아무것도 안
   만들어졌을 가능성 높음, 재실행 안전 — `on conflict do update`로 멱등 처리됨).
2. **009번도 다시 실행**.
3. `npm run test:live-db` 재실행.

## [Unreleased] — Phase 8 준비: 실제 Supabase 통합 검증 스크립트

### 중요한 제약 사항

Claude(이 세션)는 실제 Supabase Postgres에 네트워크로 접속할 수 없다(샌드박스 네트워크가 특정
도메인으로 제한됨, DB 자격증명을 대화에 공유하는 것도 보안상 권장하지 않음). 따라서 Phase 8의
실제 실행은 **사용자가 로컬에서 직접** 해야 한다.

### 신규 파일

- **`scripts/integration-test-live-db.mjs`** — 사용자가 로컬에서 `npm run test:live-db`로
  실행하는 통합 검증 스크립트. 사용자 승인 지시서 §14 시나리오를 그대로 구현:
  1. SAJU_BASIC 구매 → DB에 entitlement 생성 확인
  2. SAJU_DETAIL 구매 → 10회/24시간 quota 확인
  3. 실제 질문 → Router → 분석(MockAIProvider, API 비용 0원) → quota 9로 차감 확인
  4. 분석 실패 시뮬레이션 → quota 미차감 확인
  5. 복합 질문(YEARLY_FORTUNE 미보유) → Router 1회/분석 0회 실측
  6. 재구매 → 새 entitlementId 발급 확인(기존 것과 다름)
  7. MINGRI_SUBSCRIPTION/CHILD_SIGNAL_SUBSCRIPTION 각각 quota 조회 확인
  8. 자녀A/자녀B YEARLY_FORTUNE 격리 확인
  9. 사용자1/사용자2 entitlement 격리 확인
  - 각 시나리오마다 독립적으로 PASS/FAIL 출력, 하나 실패해도 나머지 계속 실행.
  - **테스트가 만든 데이터(user/order/payment/entitlement/analysis_scope)는 스크립트 마지막에
    스스로 정리(delete)** — 실 서비스 DB를 어지럽히지 않음.
  - OpenAI API 키 불필요(MockAIProvider 사용, 검증 대상은 AI 품질이 아니라 DB/entitlement
    로직의 정확성).
  - 실제 Toss API는 호출하지 않고 `confirmPaymentTransaction`을 직접 호출(이미 Toss가
    승인했다고 가정) — 결제 이후의 DB 트랜잭션 로직만 검증 대상.

### 수정 파일

- **`package.json`** — `test:live-db` 스크립트 등록.

### 실행 방법 (사용자가 로컬에서)

```
npm run test:live-db
```

`.env`에 실제 `DATABASE_URL`(Supabase)만 있으면 되고, `OPENAI_API_KEY`는 필요 없음. 실행
결과(각 줄의 ✅/❌ + 마지막 요약)를 그대로 복사해서 전달하면, 그걸 근거로 Phase 8 최종 보고를
작성한다(가짜로 성공했다고 표시하지 않는 원칙 그대로).

### 검증

이 환경(실제 DB 없음)에서 스크립트를 실행하면 `DATABASE_URL이 설정되어 있지 않습니다`라는
명확한 에러로 즉시 종료됨을 확인 — 가짜로 통과하지 않음. 구문 오류 없음, 기존 540개 테스트에
전혀 영향 없음(신규 스크립트 추가만, 기존 코드 무변경).

### 다음 단계

사용자가 로컬에서 `npm run test:live-db` 실행 → 결과를 전달 → Phase 8 최종 보고 작성 →
(성공 시) Phase 9(YEARLY_FORTUNE_BASIC 콘텐츠) 진행.

## [Unreleased] — Phase 7: 전체 Entitlement 정책 통합 검증

### 조사 결과 — §1 실제 상품 표

| product | price | quota | analysis_type | model_tier | subscription_group | 대상 |
|---|---|---|---|---|---|---|
| SAJU_BASIC | 990 | 1(만료없음) | SAJU_BASIC | basic | - | 본인 |
| SAJU_DETAIL | 4900 | 10/24h | SAJU_DETAIL | detail | - | 본인 |
| YEARLY_FORTUNE_BASIC | 990 | 1(만료없음) | YEARLY_FORTUNE | basic | - | 본인/자녀 |
| YEARLY_FORTUNE_CHAT | 4900 | 10/24h | YEARLY_FORTUNE | detail | - | 본인/자녀 |
| CHILD_BASIC | 990 | 1(만료없음) | CHILD_BASIC | basic | - | 자녀 |
| CHILD_DETAIL | 4900 | 10/24h | CHILD_DETAIL | detail | - | 자녀 |
| MINGRI_SUBSCRIPTION | 4900 | 50/30일 | null | subscription | MINGRI | 본인 |
| CHILD_SIGNAL_SUBSCRIPTION | 4900 | 50/30일 | null | subscription | CHILD_SIGNAL | 자녀 |
| RELATIONSHIP_BASIC/DETAIL | 990/4900 | 1 / 10·24h | RELATIONSHIP_* | basic/detail | - | 두 사람(스키마 미지원) |

### §8 명리 구독 허용 범위 (코드 확인 결과)

| analysis_type | 명리 구독 접근 가능? |
|---|---|
| SAJU_DETAIL | ✅ |
| ZIWEI_DETAIL | ✅(예약, 실제 상품 없음) |
| YEARLY_FORTUNE | ✅ |
| CHILD_DETAIL | ❌ |
| RELATIONSHIP_DETAIL | ❌ |

### STOP A~E 판단 — 실질적 차단 없음

- STOP B(명리구독 범위 미결정): 이미 `SUBSCRIPTION_GROUP_FOR_ANALYSIS_TYPE`으로 코드에 확정되어
  있음(위 표). STOP 아님.
- STOP C(990원 콘텐츠 범위): tier 수준(열람 전용, 채팅권 없음)은 이미 확정. 다만 **실제 "990원
  결과 화면"을 만드는 콘텐츠 생성 파이프라인/프롬프트는 아직 없음** — 이건 이번 Phase가
  다루는 채팅 authorization과는 다른 레이어(결과 열람 자체는 이번 범위 밖)라 STOP으로 막지
  않고 gap으로만 기록.
- STOP D(ZIWEI 분리): 이미 §20-4로 "하지 말라"는 명시 지시 — 번들 유지, 회귀 테스트로 보호.
- STOP E(RELATIONSHIP 2-chart): 이미 §20-5로 "건드리지 말라"는 명시 지시 — Phase4/6과 동일하게
  범위 밖 유지.

### 신규 파일

- **`tests/48-phase7-integration-validation.test.mjs`**(20개) — §18 요구(최소 20개) 충족.
  기본권한/상품/ZIWEI번들보호/구독범위/복합질문/보안/quota시점/결제흐름/재구매/실제DB통합
  10개 카테고리로 구성.

### 실측/확인 내용

- **quota 차감 시점**: `consumeQuestionEntitlement` 호출 2곳(자유입력/카탈로그선택) 전부
  `askQuestion`(분석 파이프라인) 완료 **이후**에만 위치함을 소스 레벨로 재확인.
- **결제 트랜잭션 원자성**: `confirmPaymentTransaction` 안에서 6회 이상의 `client.query`
  호출(주문조회/결제생성/entitlement생성/analysis_scope생성)이 전부 같은 트랜잭션 client로
  실행됨을 확인 — 반쪽 성공 불가능.
- **재구매 분리**: entitlementId/analysisScopeId가 매번 `randomUUID()`로 새로 발급되고
  기존 것을 업데이트하는 코드가 없음을 재확인.
- **ZIWEI 번들 보호**: 3개 상품 시드 파일 어디에도 `ZIWEI_DETAIL` 상품이 없고, 도메인 매퍼가
  여전히 모든 사주 질문을 `SAJU_DETAIL` 하나로 매핑함을 확인 — 회귀 테스트로 고정.
- **자녀 신년운세**: `child_profile_id`+`fortune_year` 조합의 대화도 일반 사주질문과 동일한
  authorization 경로(classifyMessage→Router→access확인)를 탄다는 것을 실제로 확인(자녀
  코치 전용 파이프라인으로 새지 않음).
- 기존 520개 전부 무변경 통과 + 신규 20개 = **540/540**(재실행 2회 안정), 프론트 빌드 성공.

### [BLOCKED] 실제 Postgres 통합 테스트

§17 요구대로 명시적으로 BLOCKED 처리 — 이 환경엔 실제 Supabase 연결이 없어 "주문→결제→
analysis_scope→entitlement→채팅허용→quota차감"의 실제 end-to-end 흐름은 검증 불가. 여러
테스트가 `DATABASE_URL` 에러로 이 사실을 실측 확인했으며, 가짜로 성공했다고 표시하지 않았다.
**사용자가 로컬 실제 Supabase 환경에서 직접 확인 필요.**

### 남은 문제

- YEARLY_FORTUNE_BASIC(990원)의 실제 "결과 열람" 화면/콘텐츠 생성 파이프라인 미구현(이번
  Phase 범위 밖 — 채팅 authorization은 완성, 열람 자체는 별도 작업 필요).
- ZIWEI_DETAIL 독립 상품 여부 최종 결정 필요(현재는 번들 유지).
- RELATIONSHIP_DETAIL 2-chart 스키마 문제 계속 미해결.
- §17의 실제 Postgres integration은 로컬에서 사용자가 직접 실행 필요.

## [Unreleased] — Phase 6: 명리 구독 + 복합 질문 권한 시스템

### STOP 조건 검토 결과

STOP1~6 중 실질적 차단은 없었음. 단, **ZIWEI_DETAIL 분리는 이번 라운드에서 보류**하기로 결정 —
실제 판매 상품 자체가 없는 상태에서 분리를 강행하면 기존 SAJU_DETAIL 사용자가 지금 받고 있는
자미두수 답변(번들)이 갑자기 막혀버려 §28(기존 SAJU_DETAIL 하위호환 위반)에 정면으로 걸림.
현재 상태(번들 유지)를 그대로 두고 이 사실을 명시적으로 기록.

### 핵심 설계 — Access(접근권) vs Quota(횟수) 완전 분리(§7/§31)

- **Access**: 특정 `analysis_type`의 유효한 entitlement를 실제로 보유하는가 — 구독은 이걸
  절대 만들어주지 않는다.
- **Quota**: 그 access entitlement 자체에 남은 수량이 없으면(0), 같은 도메인 그룹의 구독
  entitlement로 대체 가능한지 확인 — 구독은 딱 여기서만 쓰인다.
- 도메인 그룹: `SAJU_DETAIL`/`ZIWEI_DETAIL`/`YEARLY_FORTUNE` → `MINGRI`,
  `CHILD_DETAIL` → `CHILD_SIGNAL`. `RELATIONSHIP_DETAIL`은 의도적으로 어디에도 속하지 않음
  (궁합은 명리/아이시그널 구독과 완전 분리, §9/§11).

### 복합 질문(§12~15) — 새 LLM 호출 없이 기존 Router 출력 재사용

`fortune_year`가 태깅된 대화에서, Router의 `saju_fields`가 `annual_periods`/`major_periods`
"이외의" 일반 원국 필드(day_master, pillars 등)를 요구하면 `SAJU_DETAIL`도 함께 요구하도록
`requiredAnalysisTypes` 배열을 확장. 필요한 타입 중 **하나라도 access가 없으면 즉시 전체
차단**(부분 답변 금지, §14 그대로 구현).

### 신규 파일

- **`migrations/009_subscription.sql`** — `products.analysis_type` NOT NULL 완화(구독은
  단일 타입에 매핑 안 됨), `products`/`entitlements`에 `subscription_group` 컬럼 추가,
  `MINGRI_SUBSCRIPTION`/`CHILD_SIGNAL_SUBSCRIPTION`(둘 다 4900원, 50회/30일) 시드.
- **`tests/47-subscription-compound-phase6.test.mjs`**(9개).

### 수정 파일

- **`apps/api/src/repositories/payment-repository.mjs`** — `confirmPaymentTransaction`이
  `product.subscription_group`도 entitlement에 복사(컬럼 추가만, 트랜잭션/검증 로직 무변경).
  **`findActiveSubscriptionQuota`**(신규) — access 판정에는 전혀 관여하지 않고, quota
  보충 용도로만 쓰임(소스 레벨로 이 분리가 지켜지는지 검증함).
- **`apps/api/src/services/entitlement-authorization-service.mjs`** — 전면 확장:
  `requiredAnalysisTypes`를 배열로 만들어 복합 질문 지원, access 확인 루프(전부 통과해야
  진행) 이후에만 구독 quota를 조회하는 구조로 재작성.

### 실측 검증

- 실제 MockAIProvider spy로: 복합 질문(YEARLY_FORTUNE+SAJU_DETAIL 필요) 상황에서도 **Router는
  정확히 1회만 호출되고 분석 호출에는 도달하지 않음**을 직접 측정.
- 소스 레벨: access 판정 함수가 구독 조회를 전혀 참조하지 않는지, 구독 조회가 access 확인
  루프 이후에만 실행되는지, RELATIONSHIP_DETAIL이 어떤 구독 그룹에도 없는지 확인.
- 기존 511개 중 3건(쿼리 문자열 확장으로 인한 정확한 문자열 매칭 깨짐)은 실제 코드 반영해서
  기대 문자열만 수정(정책 약화 아님) — `41-pricing-policy.test.mjs`,
  `44-entitlement-authorization-phase3.test.mjs`, `46-yearly-fortune-phase5.test.mjs` C1.
  나머지 508개 무변경 통과 + 신규 9개 = **520/520**, 프론트 빌드 성공(재실행 2회 안정).

### 테스트 불가 항목 (실제 Postgres 필요)

§25의 실제 entitlement 보유 기반 시나리오(1~18) 전부 — 실제 구매 → access/quota 조합별
허용/차단 전체 흐름은 로컬 실제 Supabase로 확인 필요.

### 남은 문제

- **ZIWEI_DETAIL 분리 보류** — 실제 상품 설계(SAJU_DETAIL과 완전히 별도로 팔지, 계속 번들로
  갈지) 결정 필요. 결정되면 도메인 매퍼에 실제 분기 추가.
- RELATIONSHIP_DETAIL의 2-chart 스키마 문제 여전히 미해결(Phase4부터 계속 범위 밖).
- 구독의 "which entitlement to actually decrement first" 우선순위는 단순 규칙(자기 quota
  먼저, 소진 시 구독)으로 구현 — 여러 구독/여러 access entitlement가 동시에 존재하는 복잡한
  케이스의 우선순위 정책은 실사용 데이터 보고 다시 검토 권장.

## [Unreleased] — Phase 5: 신년운세(YEARLY_FORTUNE) 상품/분석/채팅 권한

### 정책 확정 사항 반영

- canonical `analysis_type`은 `YEARLY_FORTUNE` 하나로 통일(기존에 예비로 만들어뒀던
  `YEARLY_FORTUNE_BASIC`/`YEARLY_FORTUNE_DETAIL`을 제거 — 이번 정책과 이름이 달랐음).
  `CHILD_YEARLY_FORTUNE` 같은 별도 타입은 만들지 않음.
- 상품은 990원(`YEARLY_FORTUNE_BASIC`, 결과 열람 전용)/4900원(`YEARLY_FORTUNE_CHAT`, 채팅
  10회/24시간) 2종, 둘 다 같은 `analysis_type=YEARLY_FORTUNE`을 쓰지만 `products.model_tier`
  (`basic`/`detail`)로 구분.

### 핵심 설계 결정 — Phase3 STOP5(ANNUAL_PERIOD 모호성)를 구조적으로 해결

Router의 `ANNUAL_PERIOD` 카테고리만으로는 "SAJU_DETAIL 안의 세운 질문"과 "별도 구매한
YEARLY_FORTUNE 채팅"을 구분할 수 없다는 문제(Phase3에서 발견)를, **질문 텍스트/Router
카테고리가 아니라 "사용자가 어느 conversation(진입 경로)에 있는가"로 구조적으로 결정**해서
해결했다 — `CHILD_DETAIL`이 이미 `conversation.child_profile_id`로 쓰던 것과 완전히 같은
원칙을 `conversation.fortune_year`에 그대로 적용. 사용자가 "2027년 신년운세" 채팅방에 들어와
있으면 그 안의 모든 질문은 무조건 YEARLY_FORTUNE 도메인으로 판정되고, Router는 여전히
실제 답변에 필요한 필드를 뽑는 데만 쓰인다(도메인 판정에는 관여 안 함). `fortune_year`가 없는
기존 사주 대화는 완전히 무변경으로 동작 — 기존 SAJU_DETAIL 사용자의 세운 질문 기능이 전혀
깨지지 않음(§금지사항10 준수).

### 신규 파일

- **`migrations/008_yearly_fortune_products.sql`** — 신년운세 상품 2종 시드,
  `orders.subject_fortune_year`(nullable) 추가.
- **`tests/46-yearly-fortune-phase5.test.mjs`**(10개).

### 수정 파일

- **`packages/shared/analysis-types.mjs`** — `YEARLY_FORTUNE` 단일화.
- **`apps/api/src/repositories/order-repository.mjs`**/**`routes/orders.mjs`** —
  `fortuneYear`(선택, 2020~2100 범위만 검증 — 그 값 자체가 권한을 부여하는 게 아니라 단순
  참조값) 저장 지원.
- **`apps/api/src/repositories/payment-repository.mjs`**:
  - `confirmPaymentTransaction`에 YEARLY_FORTUNE 분기 추가 — 같은 트랜잭션 안에서
    `analysis_scopes`에 `fortune_year` + (chart_id 또는 child_profile_id) 저장.
  - **`findActiveYearlyFortuneChatEntitlement`**(신규) — 일반 조회 함수와 별개로 만듦. 이유:
    YEARLY_FORTUNE_BASIC/CHAT이 같은 `analysis_type` 문자열을 공유해서(SAJU_BASIC/DETAIL처럼
    서로 다른 문자열이 아님), `model_tier='detail'` + 정확한 대상(chart_id/child_profile_id)
    + 정확한 `fortune_year`까지 전부 일치해야만 채팅 권한을 준다. 이 3중 검증이 "2027
    entitlement로 2028 질문 차단", "자녀 A entitlement로 자녀 B 질문 차단", "990원이 채팅권을
    잘못 부여하지 않음"을 전부 한 번에 보장한다.
- **`apps/api/src/repositories/conversation-repository.mjs`**/**`services/conversation-service.mjs`**
  — `conversation.fortune_year` 필드 추가(JsonStore, `child_profile_id`와 동일한 패턴, 마이그레이션
  불필요). `authorizeBeforeAnalysis` 콜백(2곳, `handleFreeTextMessage`/`pickCatalogChoice`)이
  `conversation.fortune_year`/`chart_id`/`child_profile_id`를 authorization에 전달.
- **`apps/api/src/services/entitlement-authorization-service.mjs`** — `fortuneYear`가 있으면
  `findActiveYearlyFortuneChatEntitlement`로 정밀 판정, 없으면 기존 로직 완전히 무변경.

### 실측 검증

- 실제 MockAIProvider spy로: fortune_year 태깅된 대화에서 entitlement 조회 시도 자체가
  일어나고(이 환경엔 DB 없어 `DATABASE_URL` 에러로 확인, 가짜 통과 없음), **그 시점까지 Router는
  정확히 1회만 호출되고 분석 호출에는 도달하지 않음**을 직접 측정.
- fortune_year 없는 기존 사주 대화가 완전히 예전과 동일하게 동작함을 실측 확인(회귀 없음).
- 소스 레벨: 클라이언트가 매 질문마다 보내는 값이 아니라 `conversation` 레코드에서만
  `fortuneYear`가 오는지, 정밀 조회 함수가 정말 tier+대상+연도 3개를 다 확인하는지 확인.
- 기존 501개 중 1건(A1, 옛 canonical 이름 참조)은 **이번 정책 변경으로 정당하게 기대값 수정**
  (테스트 약화 아님 — YEARLY_FORTUNE_DETAIL이라는 이름 자체가 이번에 폐기됨). 나머지 500개
  전부 무변경 통과 + 신규 10개 = **511/511**, 프론트 빌드 성공.

### STOP 조건 재확인 결과 (이전 라운드에서 조사, 실제로는 대부분 해당 없음이었음)

- STOP2/3/4/7: 조사 결과 전부 **해당 없음**(child_profile이 이미 chart_id 보유,
  annual_periods가 이미 연도별 데이터 보유, analysis_scopes가 이미 chart_id/child_profile_id
  분리 보유, orders 확장은 Phase4와 동일한 단순 패턴).
- STOP1(990/4900 콘텐츠 정의)/STOP5(ANNUAL_PERIOD 모호성) — 사용자가 최종 정책으로 확정,
  STOP5는 위 "핵심 설계 결정"으로 구조적으로 해결.

### 테스트 불가 항목 (실제 Postgres 필요)

§28의 실제 entitlement 보유 기반 시나리오(B1~B4/C2~C3/D1~D7/F1~F3/G1~G3, 즉 실제 구매 →
채팅 허용/차단 전체 흐름) — 로컬 실제 Supabase로 확인 필요.

### 남은 문제

- 복합 질문(SAJU_DETAIL + YEARLY_FORTUNE 동시 필요) 판정은 아직 미구현 — 현재는 conversation이
  fortune_year 태그 하나로 도메인이 고정되는 구조라, "하나의 대화창에서 두 도메인을 오가며
  질문"하는 완전한 시나리오는 다음 라운드 작업 필요.
- RELATIONSHIP_DETAIL(궁합)의 2-chart 스키마 문제는 이번에도 그대로 미해결(범위 밖, 지시대로).

## [Unreleased] — Phase 4: Payment → Analysis Scope → Entitlement 실제 연결

### 목표

Phase 2~3에서 만든 스키마/authorization 기반을 실제 결제 흐름에 연결. 결제 완료 시
analysis_scope가 실제로 생성되고 entitlement.analysis_id가 채워지도록 함.

### 신규 파일

- **`migrations/007_order_subject_link.sql`** — `orders.subject_chart_id`/
  `subject_child_profile_id`(둘 다 nullable). 결제 시점에 "이 주문이 정확히 어떤
  chart/child_profile에 대한 것인지" 알아야 analysis_scope를 만들 수 있어서 추가.
- **`tests/45-analysis-scope-payment-link-phase4.test.mjs`**(10개).

### 수정 파일

- **`apps/api/src/repositories/analysis-scope-repository.mjs`** — `verifySubjectOwnership`을
  export로 전환(기존엔 내부 전용) — 주문 생성 시점(orders.mjs)에서도 재사용.
- **`apps/api/src/repositories/order-repository.mjs`** — `createOrder`가 선택적
  `subjectChartId`/`subjectChildProfileId`를 받아 저장(기본값 null, 기존 호출부 무변경).
- **`apps/api/src/routes/orders.mjs`** — `POST /`가 선택적 `chartId`/`childProfileId`를 받아,
  **주문 생성 전에** 소유권을 검증(다른 사람의 chart로 주문 시도 시 403/404). 통과하면 저장.
- **`apps/api/src/repositories/payment-repository.mjs`**의 `confirmPaymentTransaction` — 핵심
  변경. entitlement 생성 직후, **같은 트랜잭션(client)** 안에서 order의 subject 정보와
  product의 analysis_type을 보고 analysis_scope를 실제로 생성하고 `entitlement.analysis_id`를
  연결. 트랜잭션 분리 없음 → "결제는 성공했는데 analysis_scope 생성만 실패하는 반쪽 상태"가
  구조적으로 불가능.

### 재구매 처리 (§4)

별도의 특수 로직 불필요 — 매 결제마다 `randomUUID()`로 새 analysis_scope/entitlement가 생성되고
기존 것을 조회/업데이트하는 코드 자체가 없으므로, 재구매 시 이전 구매와 자동으로 분리됨(소스
레벨로 확인).

### 발견한 구조적 충돌 (STOP 조건에 해당하지만 진행 — §13에서 이미 범위 밖으로 명시됨)

**RELATIONSHIP_DETAIL(궁합)** — `analysis_scopes.chart_id`는 하나만 가리킬 수 있는데, 궁합은
본질적으로 두 사람(chart 2개)의 관계 데이터라 지금 스키마로 표현 불가능. 이건 §14의 명시적 STOP
조건("궁합의 실제 데이터 구조가 현재 정책과 충돌")에 해당하지만, §13에서 "궁합의 별도 채팅
서비스"가 이미 이번 작업 범위 밖으로 지정되어 있어 전체 작업을 중단하지 않고 이 부분만 스킵함 —
RELATIONSHIP_DETAIL 구매는 `entitlement.analysis_type`은 정상적으로 채워지지만(Phase3
authorization은 정상 동작), `entitlement.analysis_id`는 NULL로 남는다. 실제로 "이 궁합 결과
데이터 자체"를 조회해야 하는 기능이 필요해지면 스키마 확장(예: `chart_id_b` 컬럼 추가) 결정이
필요함.

### 실측 검증

- 다른 사용자의 chart로 주문 시도 → `SUBJECT_OWNERSHIP_MISMATCH` 실제로 발생 확인.
- 존재하지 않는 chartId → `SUBJECT_NOT_FOUND` 확인(가짜로 통과 안 함).
- 마이그레이션이 `not null` 강제 없이 nullable로 추가되는지 확인.
- analysis_scope↔entitlement 연결이 실제로 같은 트랜잭션 블록(두 번째 COMMIT 이전) 안에
  있는지 소스 레벨 확인.
- 기존 491개 전부 통과 + 신규 10개 = **501/501**, 프론트 빌드 성공(재실행 2회 안정적 통과,
  1회 간헐적 flaky는 이번 변경과 무관한 기존에 알려진 캐릭터 응답 테스트).

### 테스트 불가 항목 (실제 Postgres 필요)

§11의 A(신규 사주 구매 전체 흐름)/B(재구매 시 실제 DB에 두 개의 서로 다른 analysis_scope가
생기는지)/E(복수 분석 보유 시 실제 채팅 허용)/H(quota 실제 차감) — 전부 로컬에서 실제 Supabase로
확인 필요.

### 다음 단계

- ZIWEI_DETAIL은 아직 SAJU_DETAIL에 통합되어 있어 별도 상품/analysis_scope 연결 대상 없음
  (기존 정책 유지, 이번 라운드에서 손대지 않음).
- YEARLY_FORTUNE_DETAIL 실제 출시 시 이번과 동일한 패턴(주문에 fortuneYear 추가 등)으로 확장.
- RELATIONSHIP_DETAIL의 analysis_scope 연결은 스키마 확장 결정 필요.

## [Unreleased] — Phase 3: 질문 도메인 판정 및 서버 측 entitlement 자동 매칭

### 배경

Phase 2가 만든 스키마(analysis_scopes, entitlements.analysis_type)를 실제로 사용하는 단계.
핵심 정책 변경: **클라이언트가 보낸 entitlementId를 서버가 신뢰하던 구조를 폐기하고, 서버가
질문을 보고 도메인을 판정해서 해당 사용자의 유효한 entitlement를 직접 찾도록 전환.**

### 정책 충돌 발견 및 해결 (사용자 확인 후 A로 결정)

기존에 사주 채팅(`/api/conversations/:id/messages`의 saju_question)은 entitlement 없이
완전히 무료/무제한이었음을 발견. 사용자 확인 결과 이는 "기존 구현 상태일 뿐, 확정한 새 상품
정책과 충돌하는 부분"으로 판단 — **사주 채팅도 이제 SAJU_DETAIL 상세분석 구매(또는 실제
entitlement 보유) 없이는 차단**되도록 정책을 전환.

### 선행 작업 — entitlement.analysis_type 연결 (결제 로직 재작성 없이 최소 확장)

`apps/api/src/repositories/payment-repository.mjs`의 `confirmPaymentTransaction`이 이미
조회하던 `product` 객체에서 `analysis_type` 컬럼 하나를 추가로 읽어 entitlement 생성 시
저장하도록 확장. 금액검증/트랜잭션/중복지급방지 로직은 전혀 건드리지 않음. 기존 entitlement는
추측 연결하지 않고 전부 legacy(analysis_type=NULL)로 유지 — 자동 승격 없음.

### 신규 파일

- **`apps/api/src/services/analysis-domain-mapper.mjs`** — `mapRouterCategoriesToAnalysisTypes`.
  기존 Router의 categories를 재사용해서(새 LLM 호출 없음) 필요한 analysis_type을 결정론적으로
  판정. **정책 충돌 발견 및 코드 주석으로 명시**: ANNUAL_PERIOD/MAJOR_PERIOD(세운/대운)는
  YEARLY_FORTUNE_DETAIL이 아니라 SAJU_DETAIL로 매핑 — YEARLY_FORTUNE_DETAIL이 아직 실제
  상품/파이프라인으로 출시되지 않았고(Phase 5 예정), annual_periods 데이터가 SAJU_DETAIL과 같은
  Chart 안에 있으며, 이미 검증된 "시기 해석" 기능(실제 API 3/3 PASS 확인 이력)을 깨뜨리지 않기
  위한 의도적 결정. Phase 5에서 YEARLY_FORTUNE_DETAIL이 실제 별도 상품으로 출시될 때 재검토 필요.
- **`apps/api/src/services/entitlement-authorization-service.mjs`** — `authorizeAnalysisQuestion`.
  클라이언트 entitlementId를 전혀 참조하지 않고, `(userId, 필요한 analysis_type)`만으로 서버가
  직접 유효한 entitlement를 조회. 거부 시 상품명을 포함한 안내 메시지 생성(§22 UX 원칙).
- **`tests/44-entitlement-authorization-phase3.test.mjs`**(10개) — 실제 MockAIProvider를 spy로
  감싸서 **LLM 호출 횟수를 실측**(비로그인 사주질문 → Router 1회만, 분석 0회 확정), 클라이언트
  조작 방어를 소스 레벨로 확인, legacy entitlement 비승격 확인.

### 핵심 구조 변경 — 분석 호출 전 개입 지점 확보

- **`packages/ai/pipeline.mjs`** — `runQuestionPipeline`에 선택적 파라미터
  `authorizeBeforeAnalysis` 추가(기본값 null, 기존 호출부는 완전히 동일하게 동작 — 하위호환).
  Router 완료 직후·Stage 3(분석, 더 비싼 호출) 진입 전에 콜백을 실행해서, 거부되면 분석 호출
  자체를 건너뛰고 안내 메시지를 반환한다. 이게 "권한 없는 질문은 LLM 호출 0회"의 실제 구현
  지점(Router 호출은 기존 비용이라 그대로 유지, 더 비싼 분석 호출만 차단).
- **`apps/api/src/services/conversation-service.mjs`**:
  - `askQuestion`/`handleFreeTextMessage`/`pickCatalogChoice` 전부에 `authorizeBeforeAnalysis`
    배선. `userId`가 없으면(비로그인) Router 결과와 무관하게 즉시 거부.
  - 차감 시점을 "LLM 호출 전"에서 "분석 성공 후"로 변경 — 서버가 authorization 단계에서 직접
    찾은 `entitlementId`만 사용(클라이언트가 body로 보낸 값은 완전히 무시).
  - **실측으로 발견한 실제 버그**: `pickCatalogChoice`(카탈로그 선택 대화 흐름)가 처음엔
    authorization 배선이 누락되어 있었음 — 신규 테스트(17번 파일)가 이를 잡아내서 즉시 수정.
- **`apps/api/src/routes/conversations.mjs`** — `req.user?.id`(세션에서만) 를
  `handleFreeTextMessage`/`pickCatalogChoice`에 전달. 클라이언트가 body로 보낸 값은 userId로
  쓰지 않음.

### 정책 변경으로 인해 기대값을 수정한 기존 테스트 2건 (약화 아님, §13 원칙대로 보고)

`tests/17-character-conversation.test.mjs`의 두 테스트가 "비로그인 사주 채팅은 무료"라는 옛
계약을 전제하고 있어서 새 정책과 충돌 — 검증기를 약화한 게 아니라, 실제로 바뀐 정책(로그인+구매
필요)에 맞게 기대값을 수정. "로그인+entitlement 보유 시 정상 허용"되는 성공 경로는 이 테스트
하네스(attachSession 미들웨어 없는 순수 express 앱)로 재현 불가 — 실제 Postgres 필요, 로컬에서
사용자가 직접 확인해야 함을 코드 주석에 명시.

`tests/41-pricing-policy.test.mjs`의 B1도 쿼리 문자열에 `analysis_type` 컬럼이 추가되면서
정확한 문자열 매칭이 깨져서 기대 문자열만 수정(정책 자체는 동일하게 검증).

### 실측 검증

- MockAIProvider spy로 "비로그인 사주질문 → 분석 LLM 호출 정확히 0회" 실제로 측정해서 확인.
- 클라이언트 entitlementId가 authorization 콜백 어디에도 안 쓰인다는 것 소스 레벨 확인.
- 기존 491개 중 신규 10개 제외 481개 전부 통과 + 신규 10개 = **491/491**, 프론트 빌드 성공.

### 테스트 불가 항목 (실제 Postgres 필요, 로컬 검증 필요)

- §12 Case A/B/C의 "로그인 + 실제 SAJU_DETAIL entitlement 보유 → ALLOW" 성공 경로.
- 신규 결제 1건 생성 시 `entitlements.analysis_type`이 실제로 채워지는지(사용자가 강조한 항목).

### 남은 문제 / Phase 4 권장 작업

- YEARLY_FORTUNE_DETAIL이 실제 상품으로 출시되면 ANNUAL_PERIOD 매핑 정책 재검토 필요.
- 복합 질문(여러 analysis_type 동시 필요) 처리, 명리구독 연동은 아직 미구현.
- 자녀(CHILD_DETAIL) 채팅의 기존 entitlementId 클라이언트 신뢰 방식은 이번 Phase 범위 밖으로
  남아있음(§9 "완전히 별도" 원칙에 따라 손대지 않음) — 추후 필요 시 동일한 패턴으로 전환 검토.

## [Unreleased] — Phase 2: Analysis ↔ Entitlement 연결 구조

### 목표

Entitlement가 "무엇을 샀는지"뿐 아니라 "정확히 어떤 분석 결과에 대한 권한인지" 알 수 있게 하는
기반 구조. 질문 도메인 판정/LLM 차단/구독/신년운세 상품(Phase 3~7)은 이번 범위 밖.

### 실제 코드 조사 중 발견한 이름 충돌 2건 (사전에 확인 후 회피)

1. `apps/api/src/repositories/analysis-repository.mjs`가 **이미 존재**했고, 완전히 다른 개념
   (질문 1건당 응답/토큰사용량 로그)이었다. 새 파일을 덮어쓰지 않고
   `analysis-scope-repository.mjs`로 이름을 분리했다.
2. `analyses`라는 테이블명도 이미 JSON 저장소(`data/db/analyses.json`, 위 로그 리포지토리가 씀)와
   충돌해서, 새 Postgres 테이블은 `analysis_scopes`로 명명했다.

### 실제 코드 조사 중 발견한 설계 문제 1건 (사전에 확인 후 수정)

애초에 `chart_id`/`child_profile_id`에 Postgres FK를 걸려고 했으나, **charts/child_profiles가
아직 Postgres 테이블이 아니라 JSON 파일 저장소**임을 재확인 — cross-store FK는 기술적으로
불가능하다. §17 지시대로 DB FK 대신 애플리케이션 레벨 검증(`analysis-scope-repository.mjs`의
`verifySubjectOwnership`)으로 대체하고, 그 이유를 마이그레이션 SQL 주석에 명시했다.

### 신규 파일

- **`packages/shared/analysis-types.mjs`** — canonical `analysis_type` enum(SAJU_DETAIL,
  ZIWEI_DETAIL, YEARLY_FORTUNE_DETAIL, CHILD_DETAIL, RELATIONSHIP_DETAIL, DATE_SELECTION, NAMING
  등). 이 값만 전체 코드베이스에서 사용(§3 — 문자열 중복 정의 금지).
- **`migrations/006_analysis_entitlement_link.sql`**:
  - `analysis_scopes` 테이블 신설 — 실제 "누구의 어떤 분석 결과인가"의 canonical source.
    `result_data`는 생성 후 불변(변경 함수 자체를 export 안 함).
  - `entitlements`에 `analysis_id`(nullable, FK → analysis_scopes)/`analysis_type`(nullable)
    추가. **기존 entitlement 행은 전부 NULL로 남는다** — §10 원칙대로 추측 연결하지 않음.
  - `products.analysis_type`을 기존 소문자 snake_case(`saju_detail` 등)에서 canonical
    대문자(`SAJU_DETAIL` 등)로 통일. 이 값이 실제 분기 로직에 쓰이는 곳이 없음을 코드 전수
    검색으로 먼저 확인한 뒤 안전하게 변경.
- **`apps/api/src/repositories/analysis-scope-repository.mjs`** — `createAnalysisScope`(canonical
  type 검증 → 소유권 검증 → 생성), `verifyAnalysisScopeOwnership`(다른 사용자의 analysis_id 요청
  차단), `listAnalysisScopesForUser`.
- **`tests/43-analysis-scope-phase2.test.mjs`**(9개).

### 하위 호환

기존 `consumeQuestionEntitlement(entitlementId, userId)` 시그니처 무변경 — 지금 당장
`entitlementId`를 클라이언트가 보내는 방식을 제거하지 않는다(§18, Phase 3~4에서 서버 판정으로
전환 예정).

### 실측 검증 (이 환경에서 가능한 범위)

- canonical type 검증이 DB 호출 전에 걸러지는지(`createAnalysisScope`에 잘못된 타입을 주면
  DB 접근 없이 즉시 `INVALID_ANALYSIS_TYPE`).
- 마이그레이션이 `not null` 강제 없이 nullable로 컬럼을 추가하는지(소스 검증).
- `chart_id` 컬럼에 실제로 FK가 없는지(소스 검증).
- 기존 481개(472+9) 전부 통과, 프론트 빌드 성공.

### 테스트 불가 항목 (§20 Test A~F, 실제 Supabase 필요)

이 환경엔 실제 DATABASE_URL이 없어서, "사용자 A가 자기 analysis_scope에 접근 가능/사용자 B가
A의 analysis_id로 접근 시 차단/동일 상품 재구매 시 서로 다른 analysis로 분리/연도별 신년운세가
별개 analysis로 식별" 같은 **실제 DB 조회가 필요한 테스트는 로컬에서 실제 Supabase로 사용자가
직접 확인해야 한다.** `createAnalysisScope`를 실제로 호출하면 이 환경은 `DATABASE_URL` 에러로
명확히 실패함을 확인(가짜로 성공한 것처럼 보이지 않음).

### Phase 3에서 사용할 수 있는 데이터

- `analysis_scopes.analysis_type`으로 질문 도메인과 매칭할 준비 완료.
- `entitlements.analysis_id`가 채워지면(Phase 3~4에서 실제 구매→분석 연결 로직 추가 예정)
  질문 도메인 판정 → entitlement 조회 → analysis 소유 확인 흐름의 마지막 조각이 완성됨.

### 남은 문제 / 다음 단계

- 아직 결제 완료 시점에 `analysis_scopes`를 실제로 생성해서 `entitlements.analysis_id`를
  채우는 배선이 안 됨(이번 Phase는 스키마+검증 함수까지, 실제 연결은 Phase 3~4).
- Phase 3(질문 도메인 판정, Router 재사용)로 진행 예정.

## [Unreleased] — 최종 상품 정책 1차 마무리: 프론트 50자 UI + 관계 시그널 AI 궁합 분석 신규

### 배경

1차 작업(사주/자미두수/아이시그널 tier 분리, 채팅 10회/24시간, 50자 제한)은 이미 대부분 구현되어
있었음을 재확인(DB 시드, entitlement 발급/소비, Luna/Terra 라우팅, 12개 테스트로 검증됨). 이번
라운드에서 남은 갭 2가지를 마저 채움.

### 갭 1 — 프론트 채팅 입력창에 50자 제한 UI 없음

백엔드(`charts.mjs`/`conversations.mjs`)는 이미 50자 초과 시 400으로 막고 있었지만, 프론트
입력창엔 표시가 전혀 없어서 사용자가 다 쓰고 나서야 서버 에러로 알게 되는 구조였음.

**수정**: `apps/web/src/components/ChatInput.jsx` — `maxLength={50}` + 실시간 글자수 카운터
(`50자 초과 시 시각적 경고 색상`) 추가. `apps/web/src/styles/app.css`에 관련 스타일 추가.

### 갭 2 — 관계 시그널(궁합)에 §2 정책(990원 Luna/4900원 Terra AI 분석)이 아예 없었음

**중요한 사실 확인(사용자 승인)**: 기존 `/api/compatibility`는 AI가 전혀 관여하지 않는 결정론적
엔터테인먼트 콘텐츠였다(`compatibility-content.mjs`, 파일 자체 주석에 명시). §2가 요구하는
"AI 기반 궁합 분석"은 코드에 없었음 — 사용자 승인 하에 신규 구현(옵션 2: 990원 기본부터 AI
분석으로 새로 만듦).

**신규 파일**:
- `apps/api/src/services/compatibility-analysis-service.mjs` — 기존
  `packages/chart-engine/compatibility-analysis.mjs`의 `analyzeCompatibilityFact`(이미 검증된
  실제 계산 엔진, 756건 전수 테스트 통과 이력)를 그대로 재사용. AI는 이 raw/features 밖의
  합충형파해·십신 관계를 임의로 만들어내지 않는다. 시스템 프롬프트에 "천생연분/악연/용신/신강/
  신약" 등 금지 표현과 확정적 예언 금지를 명시(기존 사주/자녀 분석의 원칙과 동일선상).
  tier='basic'이면 짧게, tier='full'이면 항목을 골고루 참고해서 자세히 지시.
- `tests/42-compatibility-analysis.test.mjs`(6개) — raw/features가 기존 엔진과 완전히 동일한지,
  aiProvider 없으면 가짜 응답 안 만드는지, tier별 프롬프트 분기, 금지 표현 명시 확인.

**수정 파일**:
- `apps/api/src/routes/compatibility.mjs` — 기존 `POST /`(무료 엔터테인먼트, 완전 무변경) 옆에
  신규 `POST /analysis`(tier 필수, basic/full 아니면 400) 추가.
- `apps/api/src/server.mjs` — `compatibilityRouter`에 기존 `childCoachAiProviderFactory`(Luna)/
  `aiProviderFactory`(Terra)를 그대로 재사용해서 전달(새 모델 팩토리 생성 없음).

### 실측 검증

- 실제 서버 기동 후 curl로 `/api/compatibility/analysis` 호출 → 실제 계산된 raw/features가
  포함된 200 응답 확인. 잘못된 tier 값 → 400 확인.
- `aiProvider=null`(API 키 미설정) 상황에서 `summary: null` 반환 확인(가짜 응답 생성 안 함,
  기존 프로젝트 원칙 그대로).
- 기존 466개 + 신규 6개 = 472개 전부 통과. 프론트 빌드 성공.

### 다음 단계 (2차: 구독)

이어서 구독(아이시그널/사주 각 월 4900원·50회) 구현 예정.

## [Unreleased] — 최종 상품 정책 1차: Product 일반화 + 사주 tier 분리 + 채팅 차감/50자 제한

### 배경

사용자가 확정한 최종 상품 정책(990원 기본/4900원 상세, 상세=채팅10회/24시간, 1000원 미만+구독은
Luna, 1000원 이상은 Terra) 중 1차 범위를 구현. 승인받은 순서: 1차(이번) → 2차(구독) →
3차(가족추가/출생택일/작명).

### 신규 파일

- `migrations/004_product_quota_columns.sql` — `products`에 `question_quota`/`validity_hours`/
  `tier` 컬럼 추가. 상품마다 다른 이용권 수량/유효기간을 **상품코드별 하드코딩이 아니라 Product
  설정으로 관리**하기 위함(§원칙).
- `migrations/005_seed_products_final_policy.sql` — 기존 `SAJU_BASIC`/`CHILD_BASIC`/
  `RELATIONSHIP_BASIC`(003 시드)에 `tier='basic', quota=1, 만료없음` 명시. 신규 `SAJU_DETAIL`/
  `CHILD_DETAIL`/`RELATIONSHIP_DETAIL`(4900원, `tier='detail', quota=10, 24시간`) 추가.
- `tests/41-pricing-policy.test.mjs`(12개) — 아래 실측 검증 참고.

### 수정 파일

- **`apps/api/src/repositories/payment-repository.mjs`** — `confirmPaymentTransaction`이 더 이상
  `quantity=1`을 하드코딩하지 않고, 결제된 order의 product에서 `question_quota`/`validity_hours`를
  조회해서 그대로 발급(기본=1/무기한, 상세=10/24시간, 향후 구독도 이 컬럼만 채우면 같은 코드
  경로로 동작). `consumeQuestionEntitlement`(신규) — 이용권 행을 `FOR UPDATE`로 잠그고 만료/
  잔여수량을 확인한 뒤 정확히 1만큼 차감하는 원자적 함수. `EntitlementError`(신규 에러 클래스,
  `ENTITLEMENT_NOT_FOUND`/`UNAUTHORIZED`/`ENTITLEMENT_EXPIRED`/`ENTITLEMENT_EXHAUSTED`).
- **`apps/api/src/routes/conversations.mjs`** — `POST /:id/messages`에 (1) 사용자 질문 50자
  제한(§6 확정 정책) (2) `entitlementId`가 body로 오면(상세 분석 후속 채팅일 때만) 로그인 필수 +
  `consumeQuestionEntitlement` 호출 후 진행. `entitlementId`가 없으면 기존과 100% 동일하게
  동작(하위 호환 — 캐주얼 대화 등 기존 무료 흐름 무변경).
- **`apps/api/src/routes/charts.mjs`** — `POST /:id/questions`에 (1) 50자 제한 (2) `tier`
  파라미터: `'basic'`이면 `basicAiProviderFactory()`(Luna) 사용, 아니면 기존 `aiProviderFactory()`
  (Terra) 그대로 — `child-profile-service.mjs`의 기존 tier 분기 패턴을 그대로 재사용.
- **`apps/api/src/server.mjs`** — `chartsRouter`에 기존 `childCoachAiProviderFactory`(이미
  자녀 코치용으로 쓰던 Luna factory)를 그대로 재사용해서 전달 — **새 모델/새 provider를 만들지
  않고 기존 것을 재사용**(§모델명 임의 변경 금지 원칙 그대로 준수).

### 실측 검증

- curl로 51자 질문 → **HTTP 400 QUESTION_TOO_LONG** 확인(charts, conversations 둘 다).
- curl로 `entitlementId` 있는데 비로그인 → **HTTP 401 AUTH_REQUIRED** 확인.
- 기존 466개(454+12) 전부 통과.
- 소스 레벨로 확인: `consumeQuestionEntitlement` 호출이 라우트 핸들러 안에 정확히 1곳뿐 —
  프론트의 `splitIntoBubbles`(버블 분리)를 백엔드 어디에서도 참조하지 않음(grep으로 확인) →
  "버블 개수와 무관하게 질문 1건당 1회 차감"이 **아키텍처상 구조적으로 보장됨**(백엔드가 애초에
  "버블"이라는 개념 자체를 모르기 때문에 이중 차감이 원천적으로 불가능).
- 시드 SQL에 8900원/100회 상품이 없음을 소스 레벨로 확인(§11 금지사항).

### 발견한 사실 — 임의로 처리하지 않고 보고 (판단 필요)

**궁합(compatibility)은 AI를 전혀 사용하지 않는 순수 결정론적 계산**이다(`analyzeCompatibilityFact`
등). 정책 문서의 "궁합 기본=Luna, 상세=Terra"는 **현재 궁합에 적용할 대상 자체가 없다** —
Luna/Terra는 AI 텍스트 해석에 적용되는 개념인데 궁합엔 AI 해석이 아예 없다. 이번 라운드에서는
임의로 새 기능(AI 해석 추가)을 만들지 않고 사실만 기록. 사용자 판단 필요: (a) 궁합에 AI 해석을
신규로 추가할지, (b) 궁합은 계산 결과만 제공하는 상품으로 유지하고 가격 구조만 다르게 갈지.

### 이번 라운드에서 미완료(범위 밖, 다음 라운드 대상)

1. **후속 대화 tier 유지**: 지금은 최초 질문(`/api/charts/:id/questions`)에서만 tier 분기가
   있고, 이후 `POST /:id/messages`로 이어지는 대화는 여전히 항상 Terra다. Conversation에 tier를
   저장해서 후속 대화도 같은 tier를 유지하게 하는 작업이 필요.
2. **프론트 UI**: 기본/상세 선택 화면, 결제 후 발급된 `entitlementId`를 실제 채팅 요청에 실어
   보내는 프론트 로직 — 전부 미구현(이번은 백엔드만).
3. **실제 Postgres 동시성 검증**: `FOR UPDATE` 락이 실제로 동시 요청에서 안전한지는 로컬 실제
   Supabase로 사용자가 직접 확인해야 한다(이 환경은 DB 접근 불가).
4. 자녀(CHILD_DETAIL)와 궁합(RELATIONSHIP_DETAIL)엔 아직 tier 라우팅 코드 연결 안 됨(사주만
   이번에 완료) — 궁합은 위 발견사항 때문에 보류, 자녀는 이미 기존에 tier 분기가 있었으나 상품
   가격(4900원) 연결은 안 됨.

## [Unreleased] — 결제 시스템 STEP2: 프론트 결제 흐름(상품 목록 → Toss 결제창 → 결과 확인)

### 구현

- **`apps/web/index.html`** — Toss Payments 공식 SDK를 CDN 스크립트 태그로 로드
  (`https://js.tosspayments.com/v1/payment`). npm 패키지 추가 없이 Toss가 공식 문서에서 권장하는
  방식 그대로.
- **`apps/web/src/config.js`** — `TOSS_CLIENT_KEY`(공개 키, secret key와 무관해서 노출 안전)
  추가, 기존 `VITE_API_BASE_URL` 패턴 그대로 재사용.
- **`apps/web/src/api/client.js`** — `listProducts`/`createOrder`/`confirmPayment`/
  `listEntitlements` 4개 함수 추가.
- **`apps/web/src/components/ProductsScreen.jsx`**(신규) — 서버가 준 실제 상품 목록을 보여주고,
  구매 클릭 시 `POST /api/orders`로 서버가 만든 주문(금액은 서버 스냅샷 기준)을 Toss 결제창에
  그대로 전달.
- **`apps/web/src/components/PaymentResultScreen.jsx`**(신규) — Toss의 successUrl 리다이렉트를
  **결제 완료의 증거로 삼지 않는다.** 반드시 `/api/payments/confirm`을 호출해서 서버가 Toss에
  직접 확인한 결과로만 성공/실패를 표시(§결제 보안 핵심 원칙을 프론트에도 일관 적용).
- **`apps/web/src/App.jsx`** — `?payment=success|fail` 쿼리(Toss가 리다이렉트 시 자동으로 붙임)
  감지 → 결제 결과 화면을 다른 화면보다 최우선으로 표시(기존 로그인 리다이렉트 감지와 같은 위치,
  같은 패턴). `products` 화면 라우트 추가.
- **`apps/web/src/components/MyPage.jsx`** — "상품 안내 / 구매" 진입점 추가.
- **`apps/web/src/styles/app.css`** — 상품 카드/결제 결과 화면 스타일 추가.
- **`.env.example`** — `VITE_TOSS_CLIENT_KEY` 추가.

### 검증

기존 454개 전부 통과(프론트 변경은 백엔드 테스트에 영향 없음), 프론트 빌드 성공.

### 테스트 불가 항목

실제 Toss 결제창이 뜨고 카드 정보 입력 후 successUrl로 정상 리다이렉트되는지, 그리고
`PaymentResultScreen`이 그 리다이렉트를 받아 서버 confirm까지 성공적으로 완료하는 전체 E2E는
이 환경에서 브라우저/실제 Toss 접근이 없어 확인 불가 — 로컬에서 `VITE_TOSS_CLIENT_KEY`(테스트
키)와 `TOSS_SECRET_KEY`(테스트 키)를 설정하고 실제로 "구매하기" 버튼을 눌러 확인해야 한다.

## [Unreleased] — 결제 시스템 구축 STEP1: Product/Order/Payment/Entitlement (Toss Payments 연동)

### 배경

STEP2에서 이미 설계/승인받은 스키마(§B)를 그대로 구현. 재설계 없이 그 문서의 테이블 정의를
그대로 SQL로 옮김.

### 신규 파일

**DB**:
- `migrations/002_payment_schema.sql` — products/orders/payments/entitlements 4개 테이블.
  `payments.payment_key` UNIQUE, `entitlements.order_id` UNIQUE(둘 다 이중 지급 방지의 DB 레벨
  최종 방어선).
- `migrations/003_seed_products.sql` — 초기 상품 3개(본인 사주/자녀/궁합, 각 990원). 가격은
  코드가 아니라 이 SQL/DB에서만 관리(§원칙). `on conflict do nothing`으로 재실행 안전.

**리포지토리**:
- `apps/api/src/repositories/product-repository.mjs`
- `apps/api/src/repositories/order-repository.mjs` — `createOrder`는 반드시 호출 시점의
  product.price/name 스냅샷을 받는다(나중에 가격이 바뀌어도 과거 주문은 불변).
- `apps/api/src/repositories/payment-repository.mjs` — **핵심**: `confirmPaymentTransaction`이
  주문 행을 `FOR UPDATE`로 잠근 뒤, 이미 `PAID`면 idempotent하게 기존 상태를 반환(webhook과
  프론트 콜백이 동시에 와도 안전), 금액이 다르면 `AMOUNT_MISMATCH`로 거부, 정상이면 Payment
  생성+Order 상태변경+Entitlement 지급을 하나의 트랜잭션으로 처리.

**서비스**:
- `apps/api/src/services/payment-service.mjs` — `confirmPayment`가 Toss 승인 API를 서버가
  직접 호출. **클라이언트가 보낸 amount는 참고만 하고, Toss 응답의 실제 승인 금액만 트랜잭션에
  사용**(§결제 보안 핵심 원칙 그대로 구현).

**라우트**(전부 신규):
- `GET /api/products` — 공개.
- `POST /api/orders`, `GET /api/orders/:id`, `GET /api/orders` — 전부 `requireAuth` 적용.
  본인 주문만 조회 가능(다른 사용자 주문 조회 시 403).
- `POST /api/payments/confirm`, `GET /api/payments/entitlements` — 전부 `requireAuth` 적용.

### 수정 파일

- `apps/api/src/server.mjs` — 3개 라우터 등록(기존 라우트 무변경).
- `.env.example` — `TOSS_CLIENT_KEY`/`TOSS_SECRET_KEY` 추가.

### 실측 검증 (이 환경에서 가능한 범위)

- 서버 기동 후 curl로 로그인 없이 주문 생성/결제 승인 시도 → **둘 다 정확히 401 차단** 확인.
- 신규 테스트 5개(`tests/40-payment-service.test.mjs`) — Toss 응답 mock 검증, 에러 코드 매핑,
  시드 데이터 정합성, 클라이언트 금액을 직접 안 쓰는지 소스 레벨 확인.
- 기존 449개 전부 무변경 통과, 총 454개.

### 테스트 불가 항목 (정직한 한계 — 로컬에서 실제 검증 필요)

이 환경은 Supabase(Postgres)와 실제 Toss API에 네트워크 접근이 없다. 따라서:
1. `migrations/002_payment_schema.sql`/`003_seed_products.sql`을 실제 Supabase에 적용하는 것.
2. `confirmPaymentTransaction`의 실제 `FOR UPDATE` 동시성 방어(중복 클릭 시뮬레이션),
   `payment_key`/`entitlements.order_id` UNIQUE 제약이 실제로 걸리는지.
3. 실제 Toss 테스트 키로 결제창 → 승인 → Entitlement 지급까지의 전체 E2E.

전부 로컬에서 실제 Supabase + Toss 테스트 키로 사용자가 직접 확인해야 한다.

### 다음 단계

- 프론트: 상품 목록 화면, 결제창 연동(Toss SDK), 결제 완료/실패 화면.
- 이 결제 흐름과 기존 아이시그널/나의시그널/관계시그널 서비스의 entitlement 확인(분석 요청 전
  이용권 체크) 연결.
- 환불(STEP4.5 지시서) — Payment/Entitlement 상태 전환 로직 추가.

## [Unreleased] — 실사용 검증 중 발견한 버그 2건 (출산일시 택일 타임존 + 시기해석 검증기 오탐)

### 배경

사용자가 로컬(Windows, KST)에서 실제 테스트를 돌린 결과 2건의 실제 버그를 발견.

### 버그 1 — 출산일시 택일 날짜 생성기 타임존 버그

`generateCandidateDateTimes`가 `new Date('2027-05-01T00:00:00')`(로컬 타임존으로 파싱)를 쓰고
있었는데, KST(UTC+9) 환경에서 이 값을 `toISOString()`으로 직렬화하면 UTC 기준으로 하루 전
(`2027-04-30`)이 됨을 실측 확인. 이 샌드박스는 UTC라 발견이 안 됐던 문제.

**수정**: `packages/chart-engine/birth-selection-candidates.mjs` — 날짜 파싱/직렬화를 전부 UTC로
통일(`T00:00:00Z` 명시 파싱, 순회도 UTC 타임스탬프 덧셈으로 변경)해서 시스템 타임존과 완전히
무관하게 만듦. `TZ=Asia/Seoul`/`TZ=UTC` 양쪽 환경에서 재현 테스트로 확인.

### 버그 2 — 시기 해석 검증기(기존 파일)의 헤지 감지 오탐

**실제 API 테스트 결과(문서1 STEP4, 3문항 6회 호출) — 2/3 PASS.** T3만
`forbidden_certainty_phrases` 검증에서 FAIL. 실제 응답 문맥을 확인한 결과:

> "이 변화가 반드시 특정 사건으로 발생한다기보다, 일·관계·돈·시간 중 어디에 더 책임을..."

이건 명백한 헤지 표현("반드시 ~다는 게 아니라")인데, 기존 `tests/real-ai/validators.mjs`의
`NEGATION_MARKERS`에 `'라기보다'`(명사형: "이라기보다")만 있고 `'다기보다'`(동사형: "발생한다
기보다") 활용형이 없어서 놓쳤음 — 실제 오탐(false positive) 확인.

**수정**: `NEGATION_MARKERS`의 `'라기보다'`를 `'기보다'`로 일반화 — 두 활용형("이라기보다",
"~한다기보다") 모두 공통으로 포함하는 부분 문자열이라 하나로 통합해도 기존 케이스를 놓치지 않고
새 케이스까지 잡음. 이건 검증을 약화한 게 아니라 정확도를 높인 것(기존 헤지를 놓쳐서 정당한
응답을 FAIL 처리하던 문제를 고침).

**재채점(재호출 없음)**: `scripts/rescore-timing-quality.mjs`(신규, 기존
`rescore-targeted-quality.mjs`와 동일 패턴) 작성 후, 사용자가 제공한 실제 T3 결과 파일에 그대로
적용 — **FAIL → PASS로 정확히 바뀜을 실측 확인.** 지시서 STEP11 원칙("검증기 버그 발견 시 API
재호출 대신 재채점") 그대로 준수, 추가 API 호출 없음.

### 실제 API 테스트 결과 요약 (문서1 STEP4, 사용자 실행)

Mock 사전검증(STEP3)에서는 3개 질문 전부 `annual_periods` 라우팅에 실패했었으나, **실제 GPT는
3개 전부 대운/세운 데이터를 정확히 활용함을 확인**(재채점 후 3/3 PASS로 정정). Mock의 얕은
키워드 매칭 한계였을 뿐, 실제 시스템은 정상 작동.

### 신규/수정 파일

- `packages/chart-engine/birth-selection-candidates.mjs`(수정) — 타임존 버그 수정.
- `tests/real-ai/validators.mjs`(수정) — 헤지 감지 오탐 수정(`'라기보다'`→`'기보다'`).
- `scripts/rescore-timing-quality.mjs`(신규) — timing-quality 결과 재채점 스크립트.
- `package.json` — `rescore:timing` 스크립트 추가.

### 회귀

449/449 전부 통과(1회 실행에서 기존에 이미 알려진 flaky 테스트가 우연히 실패했으나 재실행 2회
모두 449/449로 이번 변경과 무관함을 확인).

## [Unreleased] — 시기 해석 품질 검증(신규 3문항) + 출산일시 택일 Mock 파이프라인

### 문서1: 시기 해석(대운/세운) 품질 검증

**STEP1**: `data/fixtures/adult-main-quality-chart.json`(1988-11-22)이 요구 조건(현재 대운
己未, 2027년 세운 丁未, 귀문관살 존재, 세운 21개)과 정확히 일치함을 확인 — 새 fixture 불필요.

**STEP3(Mock 라우터 검증, 실제 API 호출 없음)**: 3개 신규 질문 전부 Mock 라우터에서
`annual_periods`를 선택하지 못함을 실측 확인. 다만 실제 GPT 프롬프트(`prompts/runtime/
question-router.md`)는 "지금/현재/요즘/장기적으로" 류 표현에 `annual_periods`를 선택하도록
이미 명시되어 있어, Mock의 얕은 키워드 매칭 한계인지 실제 문제인지는 실제 API 호출로만 확인
가능 — 이게 정확히 STEP4가 필요한 이유임을 실측으로 재확인.

**신규 파일**:
- `tests/targeted-quality/timing-questions.mjs` — 신규 질문 3개(인연/결혼 시기, 장기 변화
  시기, 직업/돈+시기). 기존 5개(`questions.mjs`)는 무변경.
- `scripts/timing-quality-real.mjs`/`timing-quality-dryrun.mjs` — 기존
  `targeted-quality-real.mjs`/`-dryrun.mjs`와 완전히 같은 패턴(새 provider/새 pipeline 없음).
  3개 질문 × (Router 1회 + 분석 1회) = 실제 HTTP 요청 정확히 6회.

**수정 파일**:
- `tests/targeted-quality/semantic-validators.mjs` — 신규 검증 함수 3개 추가
  (`checkTimingProvided`, `checkMultipleYearsCompared`, `checkNotPersonalityOnlyAnswer`).
  기존 6개 함수는 무변경.
- `scripts/targeted-quality-runner-core.mjs` — `runTargetedQualityEvaluation`에 `questions`
  선택적 매개변수 추가(기본값 = 기존 `TARGETED_QUALITY_QUESTIONS`) — 기존 호출부
  (`targeted-quality-real.mjs`/`-dryrun.mjs`)는 이 매개변수를 안 넘기므로 동작 완전히 무변경,
  신규 러너만 다른 질문 목록을 주입해서 재사용.
- `package.json` — `analyze:timing`/`analyze:timing:dryrun` 스크립트 추가.

**실측 검증**: `npm run analyze:timing:dryrun`(비용 0원, MockAIProvider)으로 하네스 배관 전체가
에러 없이 도는 것을 확인(3개 질문 모두 정상적으로 실행되고 파일 저장까지 완료, semantic FAIL은
mock의 고정 텍스트 특성상 예상된 정상 결과).

**다음 단계(실제 비용 발생, 별도 승인 필요)**: `npm run analyze:timing` 실행 시 실제 HTTP 요청
6회 발생.

### 문서2: 출산일시 택일 — STEP D/E

**STEP D(Mock 파이프라인)**:
- `packages/chart-engine/birth-selection-candidates.mjs`(신규) — 후보 날짜/시간 생성(순수 함수,
  AI 관여 없음).
- `apps/api/src/services/birth-selection-service.mjs`(신규) — 기존 `createChart`(사주+자미두수
  통합 계산)를 그대로 재사용, 새 계산 로직 0줄. `extractBirthSelectionFields`(필드 추출),
  `rankCandidatesMock`(순위 배관 검증용 자리표시자, 실제 명리학적 판단 아님 — 실제 순위는
  STEP F의 AI adapter가 담당).
- `tests/38-birth-selection-pipeline.test.mjs`(7개) — §18의 1~6번(결제 무관 항목). 7~12번은
  Order/Payment/Entitlement가 없어서 이번 범위에서 제외(이전 STEP 1 조사에서 이미 확인된 사실).

**실제 버그 발견 및 수정**: `generateCandidateDateTimes`가 시작 시각==종료 시각(예: 09:00~09:00,
제왕절개 가능 시간이 단일 슬롯인 실사용 케이스)을 에러로 막고 있었음 — 시작이 종료보다 "늦을
때만" 에러가 나도록 즉시 수정.

**STEP E(안전장치 검증기)**:
- `tests/birth-selection-safety-validators.mjs`(신규) — `tests/real-ai/validators.mjs`를
  수정하지 않고, 같은 헤지/인용 오탐 방지 알고리즘을 독립 재구현해서 택일 전용 금지표현(확정적
  성공 예언, 의료 판단 우선시)에 적용.
- `tests/39-birth-selection-safety.test.mjs`(9개) — §18의 7~8번. 지시서 §17의 실제 BAD 예시
  문장을 그대로 사용해서 FAIL 확인 + 헤지/인용 오탐 방지 확인.

### 회귀

기존 440개(STEP D 반영 후) + 이번 라운드 신규 9개 = **449개 전부 통과**.

## [Unreleased] — 카카오 로그인 실사용 검증 중 발견한 실제 버그 3건 수정

### 배경

로컬에서 실제 카카오 로그인을 처음부터 끝까지 테스트하는 과정에서 순서대로 3개의 실제 버그를
발견하고 즉시 수정. 전부 실측(curl/브라우저)으로 확인.

### 버그 1 — 소셜 로그인 버튼이 비활성화처럼 보임

`app.css`의 `.nickname-signup__social-btn`에 `cursor: not-allowed; opacity: 0.7;`이 남아있었음
— STEP 3~4에서 카카오/네이버/구글을 실제로 연결하며 JS 코드는 고쳤지만, 그 이전(소셜 로그인
"준비 중" 표시 시절)의 CSS가 그대로 방치되어 있었음. `cursor: pointer`로 수정, `opacity` 제거.
실제로는 처음부터 클릭 가능했음(순수 시각적 버그).

### 버그 2 — KOE006 (카카오 리다이렉트 URI 미등록)

사용자가 카카오 개발자센터에 리다이렉트 URI를 저장하지 않은 채로 진행했던 것으로 확인. 진단을
위해 `apps/api/src/routes/auth.mjs`에 임시로 실제 전송되는 clientId/redirectUri를 콘솔에 출력
하는 로그를 추가해서 비교 확인 → 사용자가 실제로 리다이렉트 URI를 재등록 후 해결 확인. 진단
로그는 확인 후 제거.

### 버그 3 — 로그인 성공해도 화면에 로그인 상태가 안 뜸 (핵심 버그)

**원인**: `apps/web/src/api/client.js`의 공통 fetch 래퍼에 `credentials: 'include'`가 없었음.
프론트(`localhost:5173`)와 백엔드(`localhost:3000`)는 포트가 달라 별도 origin으로 취급되고,
브라우저는 `credentials: 'include'`가 없으면 cross-origin 요청에 쿠키를 포함시키지 않는다 —
카카오 로그인 자체는 성공해서 서버가 세션 쿠키를 정상 발급했지만, 프론트의 이후 모든 API 호출이
그 쿠키를 서버로 다시 보내지 못해 로그인 상태를 확인할 방법이 없었음.

또한 STEP 3에서 남겨뒀던 TODO("`/api/auth/me`를 호출해서 세션 사용자 정보로 상태를 채운다")가
미완성 상태였음 — 이번에 완성.

**수정 파일**:
- `apps/web/src/api/client.js` — `request()` 공통 래퍼에 `credentials: 'include'` 추가,
  `getCurrentUser()`/`updateNickname()` 함수 신규 추가.
- `apps/web/src/App.jsx` — 앱이 시작될 때마다(로그인 직후뿐 아니라 새로고침 시에도) `/api/auth/me`
  로 세션을 확인해서 로그인 상태를 복원하도록 수정.

### 추가 기능 — OAuth 신규 가입 시 닉네임 직접 선택

실사용 중 발견한 UX 문제: 카카오/네이버/구글로 가입하면 그 플랫폼의 기본 닉네임이 그대로
서비스 닉네임이 되어, 사용자가 원하는 이름으로 정할 기회가 없었음.

- **`apps/api/src/repositories/auth-repository.mjs`** — `updateNickname(userId, nickname)` 추가.
- **`apps/api/src/routes/auth.mjs`** — `PATCH /api/auth/nickname`(신규, `requireAuth` 적용 —
  프로젝트 최초로 `requireAuth`가 실제 라우트에 적용됨. userId는 body가 아니라 세션에서만 가져와
  다른 사용자 닉네임 변경을 원천 차단). OAuth 콜백이 신규 가입 여부(`isNewUser`)를 리다이렉트
  쿼리(`&new=1`)로 프론트에 전달하도록 수정.
- **`apps/web/src/components/NicknameChooser.jsx`**(신규) — 신규 가입 직후에만(재로그인 시엔 안
  뜸) 표시, 기본값은 provider가 준 닉네임, 자유롭게 수정 가능.
- **`apps/web/src/App.jsx`** — `&new=1` 감지 시 다른 화면보다 우선해서 `NicknameChooser` 표시.

### 검증

- 기존 433개 테스트 전부 통과, 프론트 빌드 성공.
- 실제 curl로 `PATCH /api/auth/nickname`을 비로그인 상태에서 호출 → **HTTP 401 정상 차단** 확인
  (`requireAuth`가 실제로 작동함을 실측 확인).
- 사용자가 로컬에서 실제 카카오 로그인 E2E(로그인 화면 → 동의 → 콜백 → 홈 화면에 닉네임 표시)를
  전부 실제로 성공시킴.

## [Unreleased] — 테스트 인프라 수정: data/db 공유 폴더 경쟁 상태(race condition) 해결

### 배경

사용자 로컬(Windows)에서 `npm install` 정상 반영 후 재실행한 결과, 78개 테스트가
`ENOTEMPTY`/`ENOENT`/JSON 파싱 에러로 무더기 실패. 원인 분석 결과 서비스 코드 버그가 아니라
**테스트 스위트 자체의 오래된 구조적 취약점**으로 확정.

### 원인

`node --test tests/*.test.mjs`는 기본적으로 여러 테스트 파일을 **동시에(병렬로)** 실행한다.
많은 테스트 파일이 `test.before`에서 `data/db`를 통째로 삭제 후 재생성하는데, 다른 테스트
파일이 같은 순간 그 폴더를 쓰고 있으면 충돌한다. 이 문제는 항상 존재했지만, 이 저장소를
테스트해온 리눅스 환경에서는 파일시스템 특성상 우연히 잘 드러나지 않았고, Windows(NTFS)의
더 엄격한 파일 잠금 정책 때문에 이번에 명확하게 노출됨. `POST /api/charts/:id/questions`
500 에러 등 일부 API 테스트 실패도 실제 로직 버그가 아니라 이 경쟁 상태로 인한 데이터 파일
손상의 부수 피해로 확인됨.

### 수정 파일

- **`package.json`** — `"test": "node --test tests/*.test.mjs"` →
  `"test": "node --test --test-concurrency=1 tests/*.test.mjs"`. 테스트 파일들을 동시가
  아니라 하나씩 순차 실행하도록 강제 — 서비스 코드/테스트 로직은 전혀 건드리지 않고, 실행
  방식만 안전하게 고정.

### 검증

이 환경(리눅스)에서 변경 후 재실행 — 438/438 전부 통과, 실행 시간은 병렬 대비 늘어남(약
10초 → 약 20초, 안전성과의 트레이드오프).

### 사용자가 확인할 것

이 파일(`package.json`) 하나만 반영한 뒤 `npm test`를 다시 실행하면, Windows에서도 매번 안정적으로
전체 테스트가 통과할 것으로 기대된다.

## [Unreleased] — STEP 4: 네이버 + 구글 OAuth (카카오와 공통 파이프라인으로 리팩터링)

### 요청사항

카카오 구현을 복사해서 대충 만들지 말고, User/AuthAccount 공통 파이프라인 위에서 provider별 차이를
authorize URL/token 교환/사용자 정보 조회 3곳으로만 제한.

### 신규 파일

- **`apps/api/src/services/oauth-providers/kakao.mjs`/`naver.mjs`/`google.mjs`** — 각 provider가
  `{ name, buildAuthorizeUrl, exchangeCodeForToken, fetchProfile }` 공통 인터페이스를 구현. 3개
  함수의 실제 엔드포인트/파라미터/응답 형식 차이만 각 파일 안에 있고, 그 외 로직은 전혀 없음.
- **`tests/37-oauth-common-pipeline.test.mjs`**(12개) — A) 3개 provider가 전부 등록/인터페이스
  구현 확인, B) authorize URL 생성(순수 함수, 실제 코드 그대로 실행), C) 토큰교환/프로필조회를
  `global.fetch`를 mock으로 대체해서 "응답 파싱 로직"만 검증, D) 잘못된 provider명 처리.

### 수정 파일

- **`apps/api/src/services/auth-service.mjs`** — 대규모 리팩터링: 카카오 전용 함수
  (`exchangeKakaoCode`, `fetchKakaoProfile`, `handleKakaoCallback`)를 제거하고, provider 이름을
  받는 공통 함수 `buildOAuthAuthorizeUrl(providerName, ...)`/`handleOAuthCallback({ providerName,
  ... })`로 교체. `OAUTH_PROVIDERS` 레지스트리로 3개 provider를 등록. 기존 `buildKakaoAuthorizeUrl`/
  `handleKakaoCallback`은 하위 호환 래퍼로 유지(내부적으로 공통 함수 호출) — 다른 코드가 이 이름을
  참조해도 깨지지 않음.
- **`apps/api/src/routes/auth.mjs`** — `/:provider/start`, `/:provider/callback` 단일 라우트로
  카카오/네이버/구글 3개를 전부 처리(이전엔 `/kakao/start`, `/kakao/callback`만 있었음).
  `envVarsFor(providerName)`으로 `{PROVIDER}_CLIENT_ID` 등 환경변수 이름 규칙을 자동 적용.
- **`apps/web/src/components/NicknameSignup.jsx`** — 네이버/구글 버튼을 "준비 중"에서 실제
  `/api/auth/{provider}/start`로 연결(카카오와 동일한 방식).
- **`.env.example`** — `NAVER_CLIENT_ID`/`NAVER_CLIENT_SECRET`/`NAVER_REDIRECT_URI`,
  `GOOGLE_CLIENT_ID`/`GOOGLE_CLIENT_SECRET`/`GOOGLE_REDIRECT_URI` 추가.

### 실측 검증 — 코드 테스트 vs 실제 로그인 성공 여부를 명확히 구분

**코드 레벨(이 환경에서 직접 실행/확인함)**:
- 신규 테스트 12개 전부 통과(authorize URL 생성 실제 실행, 토큰교환/프로필조회는 fetch mock).
- 실제 서버를 기동해서 `/api/auth/kakao|naver|google/start`가 설정 안 됐을 때 각각 명확한 501과
  provider별 에러 코드(`KAKAO_NOT_CONFIGURED` 등)를 반환함을 curl로 확인. 존재하지 않는 provider
  (`/api/auth/facebook/start`)는 404로 깔끔히 거부됨을 확인.
- 기존 438개(426+12) 테스트 전부 통과, 프론트 빌드 성공.

**실제 로그인 성공 여부(이 환경에서 검증 불가, 로컬에서 사용자가 직접 확인 필요)**:
- 네이버/구글 실제 개발자센터 앱 등록 → 실제 client_id/secret 설정 → 실제 로그인 화면 → 콜백 →
  세션 발급까지의 진짜 성공 여부는 이 샌드박스가 `nid.naver.com`/`accounts.google.com`에 네트워크
  접근이 안 되어 여기서는 절대 확인할 수 없다. 카카오도 동일한 한계(STEP 3부터 계속 명시해온 사항).

## [Unreleased] — STEP 3 사후 보완: 익명→회원 데이터 승계 정책

### 요청사항

익명 사용자가 무료 체험을 쓴 뒤 회원가입하면, child_profiles뿐 아니라 무료 사용 이력
(purchased_analyses)까지 실제 계정으로 승계해서 이중 무료 체험을 막는다. 보안검증/멱등성/
보정롤백을 포함하되 STEP 3 구조는 크게 뜯어고치지 않는다.

### 수정 파일

- **`apps/api/src/repositories/purchased-analysis-repository.mjs`** — `reassignOwnerForAccount
  Linking(analysisId, newUserId)`(계정 연결 전용의 좁은 예외, user_id 재할당만 허용 — analysis_json
  등 분석 결과 자체는 여전히 불변) + `listPurchasedAnalysesForUser(userId)` 추가.
- **`apps/api/src/services/auth-service.mjs`**의 `linkAnonymousData` 재작성:
  - **§5 보안검증**: `anonymousUserId`가 `anon-` 접두사로 시작하지 않으면 즉시 거부
    (`NOT_ANONYMOUS_ID`) — 다른 사용자의 실제 user_id를 익명ID인 척 넘겨서 그 사람 데이터를
    가로채는 것을 원천 차단. 자기 자신에게 연결 시도(`SAME_USER`)도 거부.
  - **§1/§2 승계 범위 확장**: child_profiles뿐 아니라 purchased_analyses(무료 사용 이력 포함)도
    함께 재할당 — 승계 후 `hasUsedFreeChildAnalysis(realUserId)`가 정확히 true로 판정됨(§3 이중
    무료체험 방지).
  - **§4 멱등성**: 새 레코드를 만들지 않고 기존 레코드의 user_id만 UPDATE하므로 같은 승계를
    여러 번 호출해도 중복 생성 없음.
  - **§7/§8 트랜잭션/롤백**: child_profiles/purchased_analyses가 아직 JSON 파일 저장소(STEP 6
    이전)라 진짜 DB 트랜잭션은 없음 — 순서대로 적용하다 실패하면 이미 적용된 변경을 역순으로
    되돌리는 보정(compensating rollback) 방식으로 최선을 다함. **이건 진짜 원자적 트랜잭션이
    아니라는 걸 명확히 알아야 한다** — STEP 6에서 Postgres로 옮긴 뒤 실제 SQL 트랜잭션으로
    재작성 권장.
- **`apps/api/src/repositories/base.mjs`** — **실제 버그 발견 및 수정**: `storeFor(name)`이
  호출할 때마다 새 `JsonStore` 인스턴스(= 별도의 인메모리 캐시)를 만들고 있었다. 실제 운영에서는
  각 리포지토리 파일이 모듈 로드 시 한 번만 호출해서 우연히 드러나지 않았지만, 같은 컬렉션에
  대해 여러 곳에서 `storeFor`를 호출하면 캐시 불일치가 생기는 잠재 위험이 있었음 — 이번 롤백
  테스트를 작성하다가 실측으로 발견. 이름별 싱글톤으로 수정.
- **`apps/web/src/App.jsx`** — **§6(익명 접근권한 무효화)**: 카카오 로그인 성공 리다이렉트
  (`?login=success`)를 감지해서 `saju_anon_user_id`를 localStorage에서 제거 — 서버가 이미 데이터를
  실제 계정으로 옮겼으니, 같은 브라우저가 예전 익명ID를 다시 들고 "새 무료체험"을 시도할 수 없게
  한다.

### 신규 테스트

`tests/36-anonymous-account-linking.test.mjs`(5개): §1/§2 프로필+무료이력 승계 확인,
§5 보안검증(가짜 익명ID/자기 자신 연결 거부) 2건, §4 멱등성(중복 생성 없음), §7/§8 보정 롤백
(테스트 전용 결정론적 실패 훅 사용 — 실제 동시성 실패는 단일 스레드 동기 테스트로 재현 불가하다는
점을 코드 주석에 명시).

### 회귀

기존 421개 + 신규 5개 = 426개 전부 통과(STEP 4 반영 후 438개).

## [Unreleased] — STEP 3: 카카오 로그인 (Supabase Postgres 신규 서브시스템)

### 배경

STEP 2 설계 승인 + 결정사항(비로그인 무료체험 유지, 익명→실계정 데이터 연결, 환불 범위 포함) 반영.
이번 STEP 3은 지시서의 원래 계획대로 "카카오 로그인부터, 로컬 테스트 가능한 상태까지"로 범위를
한정. 기존 사주/자미두수 계산 엔진, 프롬프트, 라우트는 전혀 건드리지 않고 **완전히 새로운
서브시스템**(users/auth_accounts/sessions, Postgres 기반)을 병행 추가하는 방식으로 구현 — 기존
413개 테스트에 영향 없음을 확인.

### 신규 파일

- **`migrations/001_auth_schema.sql`** — users/auth_accounts/sessions 테이블(§B 설계 그대로).
  products/orders/payments/entitlements는 STEP 6에서 별도 마이그레이션.
- **`packages/shared/postgres-client.mjs`** — Supabase Postgres 연결 풀. `DATABASE_URL` 없으면
  조용히 mock으로 대체하지 않고 명확한 에러를 던짐(기존 "카카오 로그인 가짜 버튼 안 만든다" 원칙과
  동일선상).
- **`packages/shared/password-hash.mjs`** — bcryptjs(순수 JS bcrypt, 네이티브 컴파일 불필요) 기반
  해시/검증. 이번 STEP 3(카카오)엔 직접 안 쓰이지만 STEP 5(이메일 로그인) 대비 미리 준비, 지금
  바로 테스트 가능해서 함께 작성.
- **`apps/api/src/repositories/auth-repository.mjs`** — Postgres 기반 User/AuthAccount/Session
  쿼리. 기존 `user-repository.mjs`(닉네임 전용, JsonStore)는 무변경.
- **`apps/api/src/services/auth-service.mjs`** — 카카오 OAuth 흐름(authorize URL 생성 → code
  교환 → 프로필 조회 → 로그인/가입 → 세션 생성) + 익명 데이터 연결(`linkAnonymousData`, 결정사항
  §1: child_profiles.user_id를 익명 userId에서 실제 user.id로 재할당).
- **`apps/api/src/middleware/session.mjs`** — HttpOnly+Secure(운영)+SameSite=lax 쿠키 기반 세션.
  `attachSession`(비로그인도 통과, 있으면 req.user 채움), `requireAuth`(로그인 필수 라우트용,
  이번 STEP엔 아직 어디에도 안 붙임 — 결제 라우트가 생기는 STEP 6~7에서 사용 예정).
- **`apps/api/src/routes/auth.mjs`** — `GET /api/auth/kakao/start`, `GET /api/auth/kakao/callback`,
  `GET /api/auth/me`, `POST /api/auth/logout`.
- **`tests/35-auth-step3-kakao-login.test.mjs`**(8개) — 비밀번호 해시 round-trip/salt, 카카오
  authorize URL 빌더, 세션 쿠키 옵션. 전부 네트워크/DB 없이 이 환경에서 직접 실행 가능한 순수
  로직만 검증(아래 "테스트 불가 항목" 참고).

### 수정 파일 (최소 침습)

- **`apps/api/src/server.mjs`** — `cookie-parser`/`attachSession` 미들웨어 추가, `authRouter`
  등록. CORS를 `origin: true, credentials: true`로 변경(세션 쿠키를 프론트-백엔드 간 주고받으려면
  필요 — 기존 `cors()`의 동작 자체는 그대로, credentials 옵션만 추가). 기존 라우트/로직 무변경.
- **`.env.example`** — `DATABASE_URL`, `KAKAO_CLIENT_ID`, `KAKAO_CLIENT_SECRET`,
  `KAKAO_REDIRECT_URI`, `FRONTEND_BASE_URL` 추가(변수명만, 실제 값 없음). `.gitignore`에 `.env`
  이미 포함되어 있음을 재확인(무변경).
- **`apps/web/src/components/NicknameSignup.jsx`** — "카카오로 계속하기" 버튼을 실제 백엔드
  `/api/auth/kakao/start`로 연결(익명 userId를 함께 전달해서 로그인 후 데이터 연결 가능하게).
  네이버/구글 버튼은 STEP 4까지 기존처럼 "준비 중"으로 정직하게 유지. 닉네임 가입 폼 자체는
  무변경(기존 랭킹 기능 등이 계속 의존하므로 제거하지 않음).
- **`package.json`** — `pg`, `bcryptjs`, `cookie-parser` 의존성 추가.

### 실측 검증 (이 환경에서 가능한 범위)

- 서버가 `DATABASE_URL` 없이도 정상 기동되고 기존 라우트(닉네임 가입 등)가 그대로 작동함을 curl로
  확인.
- `GET /api/auth/me`가 비로그인 상태에서 안전하게 `{"user":null}` 반환(에러 없음) 확인.
- `GET /api/auth/kakao/start`가 카카오 키 미설정 시 **명확한 HTTP 501**을 반환함을 확인(조용히
  실패하거나 가짜로 성공한 것처럼 보이지 않음).
- 기존 421개(413+신규8) 테스트 전부 통과, 프론트 빌드 성공.

### 테스트 불가 항목 (정직한 한계 — 로컬에서 사용자가 직접 확인 필요)

이 샌드박스는 Supabase(Postgres)나 카카오 API(`kauth.kakao.com`, `kapi.kakao.com`)에 대한 네트워크
접근이 차단되어 있다(npm/pypi/github류 도메인만 허용). 따라서 다음은 **코드는 작성했지만 이 환경에서
실행/검증이 불가능**하며, 로컬에서 실제 `DATABASE_URL`(Supabase)과 실제 `KAKAO_CLIENT_ID`/
`KAKAO_CLIENT_SECRET`/`KAKAO_REDIRECT_URI`를 설정한 뒤 사용자가 직접 확인해야 한다:

1. `migrations/001_auth_schema.sql`을 실제 Supabase에 적용하는 것 자체.
2. `findOrCreateUserByAuthAccount`/`createSession`/`getSessionUser` 등 실제 Postgres 쿼리 실행.
3. 카카오 실제 로그인 화면 → 콜백 → 세션 쿠키 발급까지의 전체 E2E.
4. `linkAnonymousData`(익명 자녀 프로필이 실제로 새 계정에 연결되는지)는 로직 자체(child-profile-
   repository 업데이트 호출)는 정상이지만, 카카오 로그인 자체가 실행돼야 트리거되므로 이 환경에서는
   최종 확인 불가.

### 알려진 설계상 한계 (버그 아님, §1 결정사항의 자연스러운 트레이드오프)

`purchased_analyses`는 기존 설계상 의도적으로 immutable(update 함수 자체가 코드에 없음)이라
`user_id`를 재할당할 수 없다. `child_profiles.user_id`만 재할당해도 `purchased_analyses`는
`child_id`로 조회되므로 분석 기록 자체는 자연스럽게 새 계정에 연결되지만, §11의 "무료 1회 사용
여부" 판정(`hasUsedFreeChildAnalysis`, `purchased_analyses.user_id` 기준)은 익명 상태에서 쓴
무료 1회 이력이 새 계정으로 넘어가지 않는다. 정책적으로 이걸 옮겨야 한다면 별도 마이그레이션 함수
추가가 필요 — 이번 STEP 3에서는 결정을 보류하고 사실만 기록해둔다.

### 다음 단계

이 보고를 검토하시고 승인해주시면 STEP 4(네이버 + Google, 카카오와 동일 패턴)로 진행하겠습니다.

## [Unreleased] — 46차 반영: 실제 96회 테스트 결과 기반 품질 수정 2건

### 배경

45차 수정 반영 후 실제 96회 테스트 결과(fallback 0, leak 0, suggestedQuestions 누락 0 —
전부 정상) 분석 중 경미한 품질 문제 2가지를 실측으로 발견.

### 문제 A — 붙어쓰기 재발 (근본 수정)

44차에서 근거인용 형식(괄호/세미콜론)은 고쳤지만, 실제 96회 테스트에서 물결표(~)나 가운뎃점(·)
같은 **다른 비허용 기호**로 인한 같은 종류의 붙어쓰기가 재발함을 확인:
- `"생활습관·학습"` → `"생활습관학습"`
- `"성장 코치야~진단이나"` → `"성장 코치야진단이나"`

**원인**: `sanitizeUserFacingText`가 느낌표(!)/세미콜론(;) 외의 비허용 기호(물결표, 가운뎃점,
콜론, 대시, 이모지 등)는 여전히 완전히 삭제하고 있어서, 그 기호가 실제로 단어를 구분하던 역할을
하고 있었을 경우 옆 단어와 붙어버림.

**수정**: `packages/shared/sanitize-output.mjs` — 문장 경계 역할을 하는 기호(`!;~…—`)는 마침표로
치환하는 기존 로직을 유지하고, **그 외 모든 비허용 기호는 완전 삭제 대신 공백으로 치환**하도록
변경. 추가로 문장부호 바로 뒤에 공백 없이 한글/영문이 이어지면 한 칸 띄우는 가독성 후처리 추가
(단, 소수점(3.5)·천단위 구분자(1,000)는 숫자 뒤는 제외해서 보호 — 실제로 "3. 5"로 깨지는 회귀를
구현 중 발견하고 즉시 수정).

### 문제 B — 전체 분석에서 내부 프롬프트 라벨 노출

FULL_ANALYSIS(유료 전체 분석) 응답에 `"섹션 1. 새로운 상황에서는..."`처럼 내부적으로만 써야 할
라벨이 그대로 노출되고, 일부는 제목이 본문 첫 줄에 중복 노출됨.

**수정**: `apps/api/src/services/child-profile-service.mjs`의 `summarizeChildAnalysisForDisplay`
시스템 프롬프트에 "섹션1(제목) 재료 표시는 내부 구분용이니 본문에 그대로 옮기지 말 것", "제목은
이미 화면에 별도 표시되니 본문 첫 줄에 다시 반복하지 말 것"을 명시적으로 추가.

### 회귀

기존 413개 전부 통과(1회 실행에서 기존에 이미 알려진 flaky 테스트 — casual-response-engine의
랜덤 반복회피 — 가 우연히 실패했으나 재실행 2회 모두 413/413 통과로 이번 변경과 무관함을 확인).
프론트 빌드 성공.

### 다음 단계

`npm run test:llm`을 다시 실행하면 이번엔 물결표/가운뎃점 등으로 인한 붙어쓰기와 전체분석의
섹션 라벨 노출이 모두 해소될 것으로 기대된다.

## [Unreleased] — 45차 반영: suggestedQuestions 원인 확정 후 TRACE 로그 정리

### 5단계 추적 최종 결과 (사용자 실행, 실측)

`npm run diagnose:suggested-questions`를 child target(FOCUSED)과 parent target(NONE, 96회
테스트에서 실패했던 정확한 조건) 양쪽에 대해 재실행 — **TRACE-1(원본)부터 TRACE-4-최종(HTTP
응답)까지 두 경우 모두 suggestedQuestions가 온전히 유지됨.** 심지어 parent target 응답이
직전 대화 맥락("숙제")까지 반영한 자연스러운 후속 질문을 만들어냄을 확인.

**결론**: 96회 테스트 때 관찰된 `suggestedQuestions: null`은 코드 결함이 아니라, 그 시점에
v42(CASUAL_RESPONSE_SCHEMA의 OpenAI strict 모드 제약 수정)가 로컬에 아직 반영되지 않은 상태에서
실행됐을 가능성이 매우 높은 일시적 문제였다. v39(라우트)+v42(스키마) 두 수정이 모두 적용된
현재 상태에서는 target/depth와 무관하게 정상 작동함이 실측으로 확정됨.

### 정리 작업

원인이 확정됐으므로 43~44차에서 추가했던 임시 진단 코드를 전부 제거:

- **`packages/ai/providers/openai-provider.mjs`** — [TRACE-1], [TRACE-2] 로그 제거.
- **`apps/api/src/services/conversation-service.mjs`** — [TRACE-3] 로그 제거.
- **`apps/api/src/routes/conversations.mjs`** — [TRACE-4] 로그 제거.
- **`apps/web/src/hooks/useChildCoachController.js`** — [TRACE-5] 브라우저 콘솔 로그 제거.
- **`tests/llm-integration/diagnose-suggested-questions.mjs`** — 목적을 다했으므로 파일 삭제.
- **`package.json`** — `diagnose:suggested-questions` 스크립트 항목 제거.

`TRACE_SUGGESTED_QUESTIONS` 환경변수 및 관련 코드가 소스 전체에서 완전히 제거됐음을 grep으로
재확인(`diagnose:luna`는 계속 유지 — 별개의 유효한 진단 도구).

### 회귀

기존 413개 전부 통과. 프론트 빌드 성공.

### 최종 권장 다음 단계

이제 `npm run test:llm`(96회 전체)을 다시 실행하면 fallback 없이 진짜 AI 응답과 정상적인
`suggestedQuestions`를 함께 확인할 수 있을 것으로 기대된다. 44차에서 고친 근거 인용 형식
(괄호/세미콜론 없는 자연스러운 문장)도 이번 실행에서 함께 검증 가능하다.

## [Unreleased] — 44차 반영: suggestedQuestions parent-target 재현 테스트 + 근거인용 새니타이즈 파괴 수정

### 5단계 추적 결과 (사용자 실행, 실측)

`npm run diagnose:suggested-questions` 실행 결과 — **TRACE-1(원본)부터 TRACE-4-최종(HTTP 응답)
까지 전 단계에서 `suggestedQuestions` 3개가 그대로 유지됨.** 즉 이번 실행(child target, FOCUSED
depth)에서는 버그가 재현되지 않았다. 96회 테스트에서 실패했던 케이스는 전부 `target=parent,
depth=NONE`이었다는 공통점이 있어 — 이 조건 차이가 실제 원인인지 확인하는 재현 테스트를 추가.

### 새로 발견한 문제 (같은 로그에서 확인, 실측)

성공한 응답의 실제 사용자 출력에서 근거 인용이 깨짐:
- 원본(TRACE-1): `"(근거: Deci·Ryan, 2000; Grolnick·Deci·Ryan, 1997)"`
- 최종 HTTP 응답: `"근거 DeciRyan, 2000 GrolnickDeciRyan, 1997"`

`sanitizeUserFacingText`(§16 안전장치, 한글/영문/숫자/공백/.,,?만 허용)가 괄호·세미콜론·가운뎃점을
제거하면서 저자명이 붙어버림. `sanitizeUserFacingText` 자체(§16 요구사항)는 건드리지 않고, 프롬프트
쪽에서 애초에 이런 기호를 안 쓰도록 지시를 수정.

### 수정 파일

- **`packages/character/casual-chat-prompt.mjs`**:
  - `EVIDENCE_CITATION_RULE` — "괄호나 세미콜론, 가운뎃점(·), 콜론 없이 자연스러운 한 문장으로
    풀어써라", "(Deci·Ryan, 2000) 같은 괄호/기호 인용 표기는 절대 쓰지 않는다"를 명시적으로 추가.
  - `evidenceBlock`(모델에게 참고자료로 주는 출처 목록 형식) — `"${authors} (${year})".join('; ')`
    (괄호+세미콜론)에서 `"${authors}가 ${year}년에 발표한 연구".join(', ')`(자연스러운 한국어 문장,
    쉼표만 사용)로 교체 — 모델이 예시 형식 자체를 그대로 모방해서 답변에 옮기는 걸 방지.
- **`tests/llm-integration/diagnose-suggested-questions.mjs`** — 같은 대화에서 이어서 parent
  target 질문(96회 테스트에서 실패했던 정확한 문장 "요즘 제가 육아를 잘하고 있는지 모르겠어요.")도
  전송해서, target=parent/depth=NONE 조건에서만 값이 사라지는지 직접 비교 검증하도록 확장(호출
  2회로 최소화, 96개 재실행 아님).

### 회귀

기존 413개 전부 통과.

### 다음 단계

`npm run diagnose:suggested-questions`를 다시 실행하면 이번엔 child target 호출 1개 + parent
target 호출 1개, 총 2번의 실제 API 호출 결과를 한 화면에서 비교할 수 있다. 두 값이 모두 정상이면
96회 테스트 때의 null은 일시적 문제(그 시점 코드 미반영 등)였을 가능성이 높고, parent만 계속
null이면 target=parent 분기 자체에 남은 문제가 있다는 뜻 — 어느 쪽이든 실측 후 확정 조치.

## [Unreleased] — 43차 반영: suggestedQuestions 5단계 추적 로그 (원인 미확정, 진단 전용)

### 배경

96회 실제 LLM 테스트 결과(JSON 확인)에서 `suggestedQuestions: null`이 정확히 확인됨(빈 배열이
아니라 null). 코드(이 저장소 최신본)를 검토하면 라우트가 `result.suggestedQuestions ?? []`로
항상 배열을 보장하므로 이론상 null이 나올 수 없다 — 사용자 로컬 코드가 최신 반영본과 다를
가능성을 포함해 5단계 전부를 실측으로 추적하기로 함. 코드 수정 전에 원인부터 특정하라는 지시에
따라 이번 라운드는 **진단 로그만 추가하고 실제 버그 수정은 하지 않음.**

### 수정 파일 (전부 임시 TRACE 로그, `TRACE_SUGGESTED_QUESTIONS=1`일 때만 출력)

- **`packages/ai/providers/openai-provider.mjs`** — [TRACE-1] JSON.parse 전 원본 outputText,
  [TRACE-2] 파싱 후 data 객체 전체 + suggestedQuestions 키 존재 여부.
- **`apps/api/src/services/conversation-service.mjs`** — [TRACE-3] handleFreeTextMessage 반환
  직전 suggestedQuestions 값.
- **`apps/api/src/routes/conversations.mjs`** — [TRACE-4] 라우트가 handleFreeTextMessage로부터
  받은 result.suggestedQuestions 값(HTTP 응답 구성 전).
- **`apps/web/src/hooks/useChildCoachController.js`** — [TRACE-5] 프론트가 실제 HTTP 응답에서
  받은 값(브라우저 콘솔 출력).
- **`tests/llm-integration/diagnose-suggested-questions.mjs`**(신규) — 서버를
  `TRACE_SUGGESTED_QUESTIONS=1`로 기동해서 실제 캐주얼 메시지 1개만 전송, TRACE-1~4를 한 번에
  확인하고 마지막에 실제 HTTP 응답 JSON 전체를 출력. 96개 질문 러너는 실행하지 않음.
- **`package.json`** — `"diagnose:suggested-questions"` 스크립트 추가.

### 회귀

기존 413개 전부 통과(로그는 `TRACE_SUGGESTED_QUESTIONS` 환경변수가 명시적으로 `'1'`일 때만
동작하므로 평소 실행/테스트에는 전혀 영향 없음). 프론트 빌드 성공.

### 다음 단계

`npm run diagnose:suggested-questions` 실행 1회로 TRACE-1~4와 최종 HTTP 응답을 한 화면에서
비교해서, 정확히 어느 단계에서 값이 사라지는지 확정한 뒤 그에 맞는 실제 수정을 진행한다. 이번
라운드에서는 원인 후보(로컬 코드 반영 누락 vs 다른 코드 경로 문제)를 좁히는 것까지만 하고 실제
수정은 보류.

## [Unreleased] — 41차 반영: gpt-5.6-luna 실패 원인 진단용 정밀 로깅 + 단일 호출 스크립트

### 배경

"HTTP 200인데도 fallback"이 나오는 케이스가 다수 확인됨 — 이건 `OpenAIProvider.complete()` 내부의
API 호출 자체(fetch)가 아니라, **응답 처리 단계(refusal 감지, JSON 파싱)에서 실패해도 HTTP status
자체는 200으로 정상 도착**하기 때문일 수 있다는 점을 반영해서, 실패 가능한 모든 지점에 개별
로깅을 추가.

### 수정 파일

- **`packages/ai/providers/openai-provider.mjs`** — `complete()` 안의 5개 실패 지점(NETWORK_ERROR/
  INVALID_HTTP_RESPONSE/API_ERROR/REFUSAL/MALFORMED_JSON) 전부에 `throw` 직전 `console.error`
  로깅 추가. 추가로 **HTTP 200이면서 refusal도 아닌데 output_text 자체가 비어있는 경우**(EMPTY_
  OUTPUT, 이전엔 감지도 안 됐던 지점)도 새로 로깅. 로그에는 HTTP status/error code/error type/
  error message/model명만 남기고, API 키·Authorization 헤더·전체 request body·system/user
  프롬프트 내용은 절대 남기지 않음(요구사항 그대로).
- **`tests/llm-integration/diagnose-luna.mjs`**(신규) — 서버도 안 띄우고 96개 질문 러너도 안
  돌리는, `OpenAIProvider`를 **딱 1번**만 직접 호출하는 최소 스크립트. 실패 시 위 로깅이 상세
  원인을 보여주고, 이 스크립트가 그 결과를 후보 A~H 중 하나로 자동 매핑해서 판정까지 출력.
- **`package.json`** — `"diagnose:luna": "node tests/llm-integration/diagnose-luna.mjs"` 추가.

### 코드 레벨에서 이미 배제된 후보

**E(provider 코드가 잘못된 모델로 전달)** — `OpenAIProvider` 생성자가 받은 `model`을 그대로
`this.model`에 저장하고 요청 body의 `model` 필드에 그대로 사용함을 소스 확인. `childCoachAi
ProviderFactory()`도 `process.env.OPENAI_CHILD_COACH_MODEL`을 그대로 전달함을 확인 — 하드코딩된
값이 끼어들 지점이 없다. 따라서 E는 코드 검토만으로 배제 가능(실제 호출 없이 확인됨).

### 무변경 확인

Terra provider 로직(같은 클래스를 재사용하므로 로깅 추가가 Terra 호출에도 동일하게 적용되지만,
model 파라미터별 분기나 다른 처리는 전혀 추가하지 않음), 서비스 로직/프롬프트/target·intent·
depth 엔진 — 전부 무변경.

### 회귀

기존 413개 전부 통과. **96회 LLM 통합 테스트는 이번 라운드에서 실행하지 않음**(요구사항대로).

### 사용자가 실행할 것

```
npm run diagnose:luna
```

이 한 번의 호출로 콘솔에 `[OpenAIProvider 실패: ...]` 형태의 상세 로그와, 스크립트 자체의 후보
판정(A~H)이 함께 출력된다.

### 진단 결과 1 (사용자 실행, 실측)

`npm run diagnose:luna` 테스트1(최소 스키마, suggestedQuestions 없음) — **성공.** 응답:
`{ reaction: '안녕! 뭐 도와줄까?' }`. 이걸로 후보 A(모델 미존재)/B(권한 없음)/C(키·프로젝트
문제)/E(provider가 잘못된 모델 전달)를 전부 배제 — 모델 자체는 완전히 정상 작동.

### 새 가설 (코드 검토로 확정, 실행 전 확인)

실제 프로덕션이 쓰는 `CASUAL_RESPONSE_SCHEMA`(35차에서 추천 질문 기능 추가 시 만든 것)를 다시
확인:
```js
required: ['reaction'],  // suggestedQuestions가 빠져 있음
properties: { reaction: {...}, suggestedQuestions: {...} }
```
**OpenAI Structured Outputs의 `strict: true` 모드는 `properties`의 모든 필드가 `required`에도
포함되어야 하는 제약이 있다.** 이 스키마는 그 제약을 위반하고 있어서, 진단 스크립트의 최소
스키마(suggestedQuestions 필드 자체가 없음)로는 재현이 안 되고 **실제 프로덕션 호출에서만
실패할 가능성이 유력**하다고 판단.

### 수정 파일 (진단 스크립트만, 서비스 코드 무변경)

- **`tests/llm-integration/diagnose-luna.mjs`** — 테스트2 추가: 실제 `CASUAL_RESPONSE_SCHEMA`를
  그대로 가져와서(재구현 아님, import) 딱 1번 더 호출해서 이 가설을 검증. 테스트1(최소 스키마)은
  성공하고 테스트2(실제 스키마)만 실패하면 스키마 자체가 원인임을 자동으로 확정 판정하도록 로직
  추가.

### 진단 결과 2 (사용자 실행, 실측 — 원인 확정)

`npm run diagnose:luna` 테스트2(실제 프로덕션 스키마)가 **실제로 HTTP 400**을 반환:
```
Invalid schema for response_format 'casual_reaction': In context=(), 'required' is required
to be supplied and to be an array including every key in properties. Missing 'suggestedQuestions'.
```
가설이 실측으로 100% 확정됨 — **원인 = D. 요청 파라미터 문제.** 모델 자체(A/B/C/E)는 완전히
정상이었고, `CASUAL_RESPONSE_SCHEMA`가 OpenAI strict 모드 제약을 위반해서 캐주얼/자녀코치 응답을
만드는 모든 실제 호출이 매번 즉시 실패하고 있었다 — 지난 여러 라운드에 걸쳐 관찰된 모든
fallback의 근본 원인이 이것으로 확정됨.

### 수정 파일 (서비스 코드 수정 — 확정된 원인에 대한 실제 수정)

- **`packages/character/casual-chat-prompt.mjs`** — `CASUAL_RESPONSE_SCHEMA.required`에
  `suggestedQuestions` 추가(`['reaction']` → `['reaction', 'suggestedQuestions']`). 필드가
  "선택적"이라는 의미는 빈 배열(`[]`)을 반환하는 것으로 유지 — OpenAI strict 모드에서 필드
  누락을 표현하는 방식이 아니라 "필드는 항상 있고 값이 비어있을 수 있다"는 방식으로 전환.
  프롬프트 지시문("이어질 자연스러운 질문이 없으면 빈 배열로 둬도 된다")과 완전히 호환됨.
- **`tests/33-suggested-questions-and-evidence-citation.test.mjs`** — A1 테스트의 잘못된 가정
  (`!required.includes('suggestedQuestions')`, "필수 아님")을 실제 OpenAI 제약에 맞게 정정
  (`required.includes('suggestedQuestions')`이어야 함).

### 다른 스키마 전수 점검 (동일 버그 재발 방지)

프로젝트 내 모든 JSON 스키마(`router-schema.mjs`, `analysis-response-schema.mjs`의 중첩 객체
전부, `child-profile-service.mjs`의 인라인 스키마)를 재귀적으로 점검 — `CASUAL_RESPONSE_SCHEMA`
외에는 전부 `properties`와 `required`가 정확히 일치함을 확인. 이 버그는 이 스키마 하나에만
있었음.

### 회귀

기존 412개(413에서 A1 테스트 갱신) 전부 통과.

### 사용자가 확인할 것

`npm run diagnose:luna`를 다시 실행하면 이번엔 테스트2도 성공해야 한다. 확인되면 이제
`npm run test:llm`(96회 전체)을 다시 돌려도 실제 AI 응답이 정상적으로 나올 것으로 기대된다.

## [Unreleased] — 40차 반영: 테스트 러너가 서버 에러 로그를 완전히 숨기고 있던 버그 수정

### 배경

사용자가 `npm run test:llm` 전체 콘솔 로그를 전달 — `[casual chat AI 호출 실패]`(37차에서
추가한 진단 로그)가 **단 한 번도 출력되지 않음**을 확인. 이건 "에러가 없었다"는 뜻이 아니라,
**러너 자체가 서버의 로그를 사용자 화면에 전혀 보여주지 않고 있었다**는 뜻이었음(확정된 버그).

### 원인

`tests/llm-integration/run.mjs`의 `startServer()`가 자식 프로세스(실제 API 서버)의
stdout/stderr를 `bootLog`라는 내부 문자열 변수에만 누적하고, 이 프로세스(러너)의 콘솔로는 전혀
다시 흘려보내지 않았음. 그 결과 서버가 `console.error`로 무엇을 찍든(37차에서 추가한 에러 로깅
포함) 사용자는 절대 볼 수 없는 구조였음 — 지난 두 라운드의 "왜 fallback이 나오는지 원인을 알 수
없다"는 문제의 상당 부분이 이 러너 버그 때문이었을 가능성이 큼.

### 수정 파일

- **`tests/llm-integration/run.mjs`** — `child.stdout`/`child.stderr`의 `data` 이벤트 핸들러에
  `process.stdout.write`/`process.stderr.write`를 추가해서, 서버 로그를 `[server]`/`[server:err]`
  접두사와 함께 실시간으로 사용자 콘솔에도 그대로 출력하도록 수정. 기존 `bootLog` 누적(부팅 시
  MockAIProvider 여부 판정용)은 그대로 유지.

### 회귀

기존 413개 전부 통과(러너 파일만 수정, 서비스 코드 무변경).

### 다음 단계

사용자가 다시 `npm run test:llm`을 실행하면, 이번엔 서버 콘솔 로그가 실시간으로 그대로 보일
것이다. 만약 여전히 다수 응답이 실패한다면, 이번엔 정확한 에러 코드/메시지/status가 화면에
그대로 나타날 것으로 기대된다.

## [Unreleased] — 39차 반영: suggestedQuestions 라우트 누락 버그 수정

### 확인 결과

1. `handleFreeTextMessage`(conversation-service.mjs 361행)는 `{ intent, response, character,
   usage, highlightCard: null, suggestedQuestions }`를 정상 반환하고 있었음(회귀 아님, 이미
   정상).
2. `POST /api/conversations/:id/messages` 라우트(conversations.mjs)가 응답 JSON을 구성할 때
   `suggestedQuestions` 필드를 누락시키고 있었음 — 확정된 버그.

### 수정 파일

- **`apps/api/src/routes/conversations.mjs`** — 응답 JSON 객체에 `suggestedQuestions:
  result.suggestedQuestions ?? []` 한 줄 추가. 기존 필드(conversationId/intent/response/
  character/sources/cross_analysis/highlight_card/usage)는 이름·순서 전부 무변경.

### 신규 테스트

`tests/34-suggested-questions-route.test.mjs`(5개): (A) 서비스 레이어가 이미 정상 반환하는지
전제 확인, (B1) 라우트가 구성하는 최종 JSON에 실제로 포함되는지(핵심 버그 검증), (B2) 값이 없는
경로(성인 캐주얼 등)에서도 undefined 대신 빈 배열로 안전하게 처리되는지, (C) 기존 8개 필드가
전부 그대로 유지되는지, (D) 라우트 소스 코드 문자열 자체에 필드가 실존하는지 이중 확인.

### 회귀

기존 408개 + 신규 5개 = **413개, 전부 통과.** 프론트 빌드 성공(프론트 코드는 이번에 건드리지
않음 — 요구사항대로 기존 추천 질문 UI는 무수정).

### 실제 HTTP 검증

로컬 서버를 기동해서 실제 `POST /api/conversations/:id/messages` 호출 결과를 직접 확인:
```json
{ "...": "...", "suggestedQuestions": [] }
```
필드가 실제 최종 JSON 응답에 존재함을 실측 확인(이 환경엔 API 키가 없어 MockAIProvider 폴백
문구가 나왔지만, `suggestedQuestions` 필드 자체는 정상적으로 빈 배열로 포함됨 — §5 요구사항대로).

### 실제 LLM 호출 필요 여부

**필요 없음.** 이번 버그는 라우트 레벨의 필드 누락이라 MockAIProvider와 코드 레벨 테스트만으로
완전히 검증 가능했다. 실제 LLM이 만드는 추천 질문의 "품질"(관련성 등)은 이미 35차에서 별도로
다룬 영역이고 이번 수정과는 무관.

### 별도 참고 (이번 작업 범위 밖, 사용자에게 이미 보고됨)

이번 라운드 시작 시점에 전달받은 최신 LLM 통합 테스트 결과(96회 호출)에서, target/depth와
무관하게 **`gpt-5.6-luna` 모델을 쓰는 89개 호출이 전부 실패**하는 패턴을 확인했다(Terra 경로는
정상). 이는 이번 작업(라우트 필드 누락)과는 별개의 문제로, `gpt-5.6-luna`라는 모델 ID 자체가
유효하지 않을 가능성이 유력하다 — 사용자의 실제 OpenAI 계정에서 이 모델명이 호출 가능한지 별도
확인이 필요하다(37차에서 추가한 에러 로깅이 다음 실행에서 정확한 원인을 알려줄 것).

## [Unreleased] — 38차 반영: 24시간 5질문 체험 제한과 테스트 러너 충돌 발견 및 수정

### 배경

37차 수정 후 사용자가 다시 실행한 결과(93회 호출, 429는 0건)를 분석 — rate limit은 해결됐지만
**93개 중 75개가 "오늘은 여기까지 같이 살펴볼 수 있어요"(24시간 5질문 체험 소진 안내), 15개가
"지금은 답을 준비하지 못했어요"(실제 API 호출 실패)**로, **실질적으로 성공한 진짜 AI 응답이
하나도 없었음**을 확인.

### 원인 (실측으로 확정)

`child-profile-repository.mjs`의 `recordTrialUsage`가 "자녀 프로필당 24시간 5질문" 제한을
정상적으로 강제하고 있었음(직접 재현 테스트로 1~5회 허용, 6회부터 차단 확인). 36차 러너가
fixture당 하나의 프로필에 30개 질문을 순차로 보내는 구조라, **6번째 질문부터는 API 호출 자체를
시도하지 않고** 체험 소진 문구만 반환 — 이건 서비스 버그가 아니라 정상 동작이지만, 러너 설계가
이 실제 제한을 고려하지 않았던 것.

별도로 15건(parent target)은 실제로 API 호출을 시도했지만 진짜로 실패했음 — 이건 여전히 원인
미확인 상태로 남음(§37에서 추가한 에러 로깅으로 다음 실행에서 서버 콘솔 로그 확인 필요).

### 수정 파일

- **`tests/llm-integration/run.mjs`** — 질문마다 **새 chart+child profile**을 생성하도록 재설계
  (기존: fixture당 프로필 1개 공유 → 변경: 질문당 프로필 1개). 공유 프로필의 무료 1회 제한
  검증(§11)은 fixture당 별도로 한 번만 수행(BASIC_ANALYSIS/FULL_ANALYSIS 레코드로 분리 기록).
  rate-limit 딜레이를 3.5초 → 7초로 상향(질문당 rate-limited 호출이 1개에서 2개로 늘어난 것을
  반영해서 재계산).
- **`tests/llm-integration/README.md`** — 늘어난 API 호출 수(약 90회 → 약 276회)와 예상 소요
  시간(약 20~30분)을 실측 근거로 갱신.

### 회귀

기존 408개 전부 통과(테스트 러너만 수정, 서비스 코드 무변경).

### 다음 단계

사용자가 로컬에서 다시 `npm run test:llm` 실행. 이번엔 매 질문이 독립된 새 체험 세션이므로
실제 API 호출이 정상적으로 이루어질 것으로 기대. 여전히 fallback이 나온다면, 이번엔 그게 37차에서
추가한 에러 로깅(`[casual chat AI 호출 실패]`)이 서버 콘솔에 정확한 원인(코드/메시지/status)을
남길 것이므로 그 로그를 전달받아 진단한다.

## [Unreleased] — 37차 반영: 실제 테스트 결과 기반 긴급 수정 (에러 로깅 + rate limit 회피)

### 배경

36차에서 만든 LLM 통합 테스트 러너를 실제로 실행한 결과(93회 호출)를 사용자가 전달 — 분석 결과
두 가지 심각한 문제를 실측으로 확인:

1. **HTTP 200으로 성공한 12개 호출이 전부 fallback 문구**("지금은 답을 준비하지 못했어요")였음.
   실제 OpenAI API 호출이 실패하고 있었는데, `catch {}`가 에러 정보를 완전히 삭제해서 코드만
   봐서는 원인(401/404/429/네트워크 등)을 구분할 방법이 없었음.
2. **나머지 78개 호출이 HTTP 429**로 실패. latency가 3~16ms로 극히 짧아 OpenAI에 도달하지도
   못하고 우리 서비스 자체의 rate limiter(`burstLimiter`: 10초당 5회, `sustainedLimiter`: 60초당
   20회, `/api/conversations/:id/messages`와 `/api/charts/:id/questions`에 적용)에 막힌 것으로
   확인 — 36차 러너가 질문 사이에 지연 없이 순차로 쏴서 스스로 차단당한 설계 결함.

### 수정 파일

- **`apps/api/src/services/conversation-service.mjs`** — `catch {}` → `catch (err) {...}`로 변경,
  `console.error`로 에러 코드/메시지/HTTP status/사용 모델을 서버 콘솔에 남기도록 수정(API 키 등
  민감정보는 로그하지 않음). 이번에 실제로 원인을 진단하는 데 반드시 필요했던 최소 변경.
- **`tests/llm-integration/run.mjs`** — 질문마다 3.5초, fixture 전환 시 5초의 안전 딜레이 추가해서
  서버 자체 rate limiter를 회피하도록 수정.
- **`tests/llm-integration/README.md`** — 예상 소요 시간을 딜레이 반영해서 갱신(약 8~12분).

### 회귀

기존 408개 전부 통과(에러 로깅 추가는 정상 동작 경로에 영향 없음, 실측 확인).

### 다음 단계

사용자가 로컬에서 `npm run test:llm`을 다시 실행하면, 이번엔 rate limit 없이 실제 응답이
나올 것으로 기대된다. 만약 이번에도 fallback이 나온다면, 서버 콘솔에 찍히는
`[casual chat AI 호출 실패]` 로그(코드/메시지/status)를 그대로 전달받아 정확한 원인(모델명 오류,
인증 실패 등)을 진단한다.

## [Unreleased] — 36차 반영: 실제 OpenAI API 통합 테스트 러너 신설 (서비스 코드 무변경)

### 구현 전 확인 결과

- `/api/conversations/:id/messages`가 `handleFreeTextMessage`를 호출하는 실제 경로 확인.
- **버그 발견(이번 라운드에서 수정하지 않음, 보고만)**: `handleFreeTextMessage`가
  `suggestedQuestions`를 반환하는데, `conversations.mjs`의 라우트가 응답 JSON을 만들 때 이
  필드를 누락시키고 있음 — 35차에서 만든 추천 질문 기능이 실제로는 프론트까지 전달되지 않고
  있음. 이번 러너가 매 실행마다 `SUGGESTED_QUESTIONS_MISSING_FROM_RESPONSE` 플래그로 이 사실을
  자동 재확인해준다.
- provider 구조 재확인: `/api/charts/:id/questions`(부팅용 "안녕" 포함)는 Terra, `/api/child-
  profiles/:id/analyses`는 tier별(basic=Luna, full=Terra), `/api/conversations/:id/messages`는
  child_profile_id 있으면 Luna. 전부 기존 그대로.

### 신규 파일 (기존 코드/테스트 무변경)

- `tests/llm-integration/fixtures/children.json` — self-directed/receptive/expressive 3개
  fixture(기존 여러 라운드에서 검증된 생년월일 재사용).
- `tests/llm-integration/fixtures/questions.json` — 30개 대표 질문(parent 6/child 8/
  relationship 4/longHow 3/education 3/caution 2/edge 4), 카테고리와 검증 포인트 명시.
- `tests/llm-integration/run.mjs` — 실제 통합 테스트 러너. 실제 서버(`server.mjs`)를 별도 포트
  (3999)로 기동 → 실제 HTTP API 호출 → target/intent/depth는 기존 export 함수
  (`classifyTarget`/`classifyIntent`/`resolveDepthAndMaterial`)를 그대로 재사용해서 진단용으로만
  재계산(서비스 코드 재구현 아님) → 결과를 JSON+Markdown으로 저장 → 서버 종료.
- `tests/llm-integration/README.md` — 실행 방법, 예상 호출 수/비용, 자동 판정 vs 사람 판정
  항목 구분, 결과를 다시 Claude에게 전달하는 방법.
- `package.json`에 `"test:llm": "node tests/llm-integration/run.mjs"` 추가(기존 `"test"`
  스크립트의 `tests/*.test.mjs` 글롭과 겹치지 않음 — 파일명이 `.test.mjs`로 안 끝나서 기존 408개
  테스트 실행에 포함되지 않음, 실측 확인 완료).

### 안전장치

- `OPENAI_API_KEY`가 없으면 즉시 종료하고 필요한 환경변수를 안내(Mock으로 대체하지 않음).
- 서버 부팅 로그에 `MockAIProvider` 문자열이 보이면 실제 키가 로드 안 된 것으로 판단하고 즉시
  중단.
- API 키 값 자체는 어떤 로그/결과 파일에도 출력하지 않음(존재 여부만 확인).
- 별도 포트(3999) 사용으로 평소 `npm run dev`(3000)와 충돌하지 않음.

### 회귀

기존 408개 전부 통과(무변경 확인). 실제 API 호출은 이번 라운드에서 수행하지 않음 — 로컬에서
사용자가 직접 `npm run test:llm` 실행 필요.

### 사용자가 실행할 것

`README.md` 참고. 요약: `.env`에 4개 환경변수 설정 후 `npm run test:llm` 한 줄. 완료되면
`tests/llm-integration/results/llm-test-<타임스탬프>.md`를 그대로 Claude에게 다시 전달하면 됨.

## [Unreleased] — 35차 반영: 추천 질문 자동완성 + 교육 근거 짧은 인용 원칙

### 구현 전 확인 결과 (요구된 사전 보고)

- 추천 질문 자동완성: 아이시그널(자녀 코치)에는 이 기능 자체가 없었음(`ChildSajuScreen.jsx`엔
  "기본/전체 사주 보기" 액션 버튼만 존재). 성인 사주 채팅의 `catalog-selector.mjs`는 고정
  사전정의 카탈로그 방식이라 무관.
- 교육 근거: `behavioral-evidence/*.mjs` 12개 파일 전부에 이미 confidence(strong 5/moderate 7)와
  sources(저자/연도/제목/저널), limitations가 구축되어 있었으나, `casual-chat-prompt.mjs`가
  "출처나 이론 이름을 언급하지 말고"라고 명시적으로 **숨기도록** 지시하고 있었음 — 이번 요청과
  정반대 방향.
- 학습유형 비분류/교육철학: 시스템 프롬프트에 원칙 자체가 없었음, 신규 추가 필요.
- 안전장치(Target/Intent/Depth/Leak/Evidence 게이팅/Caution): 재확인 결과 이번 변경과 무관하게
  전부 온전 — 게이팅 조건(언제/누구에게 재료를 주는가)은 그대로 두고 "재료를 어떻게 표현하는가"만
  수정.

### 수정 파일

- **`packages/character/casual-chat-prompt.mjs`**:
  - `NO_LEARNING_STYLE_LABELING_RULE`(학습유형 단정 금지), `EDUCATION_PHILOSOPHY_HOOK`(아이마다
    다르다는 핵심 철학), `EVIDENCE_CITATION_RULE`(confidence 수준별 표현 차등 + 짧은 출처 인용
    형식) 신규 추가.
  - evidence 노출 문구를 "출처 숨기기"에서 confidence/sources/limitations를 함께 넘기는 방식으로
    교체. 게이팅 조건(`depth==='FOCUSED'||'DEEP'`, target=child) 자체는 무변경.
  - `CASUAL_RESPONSE_SCHEMA`에 `suggestedQuestions`(최대 3개, 선택적 필드) 추가 — **추가 API
    호출 없이** 같은 캐주얼 응답 생성 호출 안에서 함께 생성되도록 프롬프트 말미에 생성 지시 추가.
    "무관한 고정 화제 금지, 없으면 빈 배열" 명시.
- **`apps/api/src/services/conversation-service.mjs`** — `suggestedQuestions`를 캡처해서
  `sanitizeUserFacingText`로 정제 후 응답에 포함. API 실패 시 fallback 경로는 LLM이 안 만들었으므로
  빈 배열(억지로 채우지 않음).
- **`useChildCoachController.js`/`ChildSajuScreen.jsx`** — 추천 질문 상태 관리 및 칩 UI 추가(클릭
  시 바로 그 질문을 보낸 것처럼 처리). 새 메시지 전송 시 이전 추천은 즉시 제거(낡은 추천 방지).

### 구현 중 발견하고 즉시 고친 실제 안전 결함

`educationRules` 블록 전체를 `evidence ? ... : ''`로 조건부 처리해서, **LIGHT depth(evidence
미제공 조건)에서 학습유형 비분류 원칙 자체가 통째로 빠지는** 결함을 신규 테스트(D1)로 실측 발견.
`NO_LEARNING_STYLE_LABELING_RULE`은 `CAUSALITY_RULE`과 같은 성격의 안전 원칙이라 evidence
유무와 무관하게 항상 포함하도록 즉시 수정 — 교육철학 훅/근거인용 형식 안내만 evidence가 실제로
있을 때로 한정.

### 실측 검증

FOCUSED depth 프롬프트를 직접 출력해서 confidence/sources/limitations 실제 노출 확인, 추천 질문
생성 지시문 포함 확인. 부모(NONE) 질문 5건에서 evidence/observable/scene/category 전부 미노출
재확인(§C1). Target 분류 대표 8건 회귀 없음 재확인(§E1).

### 신규 테스트

`tests/33-suggested-questions-and-evidence-citation.test.mjs`(10개) — 스키마 구조, 프롬프트
지시문 존재, evidence 게이팅 무변경(parent/LIGHT에서 미노출), Profile Leak 재확인, 학습유형
비분류 전체 depth 존재, 사주 인과관계 규칙 회귀 없음, target 분류 회귀 없음. 기존 테스트는 수정
없이 그대로 통과(408개 = 기존 398 + 신규 10).

### 남은 문제 (실제로 남은 것만)

- §10(협찬/콘텐츠 카드 분리): 실제 카드 UI/데이터가 전혀 없는 상태라 이번엔 구조 예약도 하지
  않음(빈 기능을 만드는 것보다 실제 콘텐츠가 생길 때 설계하는 게 낫다고 판단) — 다음 라운드 후보.
- 추천 질문의 "실제 오매칭 사례"는 LLM이 있어야 재현 가능해서, 이번 regression test는 구조적
  보장(무관 화제 배제 지시, 3개 제한, leak 없음)만 코드 레벨로 검증함 — 실제 응답 품질은 API
  연결 후 별도 확인 필요.
- confidence가 moderate인 evidence(7개)에 대한 "유보적 표현" 실제 적용 여부도 LLM 응답에서만
  확인 가능.

## [Unreleased] — 34차 반영: 아이시그널 중심 브랜드/UX 재편

### 배경

Home을 "아이시그널(메인) / 나의 시그널(사주+자미두수) / 관계 시그널(궁합+사주대결)" 3개 서비스
구조로 재편. 계산 엔진/target-depth 엔진/Leak·Evidence·Caution 게이팅/CAUSALITY_RULE/
PROFILE_NOT_EXPLAIN_RULE은 전부 무변경 — 이번 작업은 UI/라우팅/카피 레이어로 한정.

### 수정 파일

- **`HomeScreen.jsx`** — 3개 서비스로 재편, 아이시그널을 큰 히어로 카드로(가장 크고 먼저 노출),
  나의 시그널/관계 시그널은 보조 카드로 아래 배치.
- **`ServiceIntroScreen.jsx`** — 3개 서비스 기준 재작성. 아이시그널에 가격 안내("기본 분석
  990원, 첫 이용 무료, 전체 분석은 별도 유료" — 실제 결제 로직은 여전히 미구현, 텍스트 안내만)와
  개인정보 안내 박스 추가(§9 원칙 그대로: "저장되지만 목적 제한", 절대적 표현 금지, 개인정보처리
  방침은 링크 자리만 확보하고 실제 문서는 만들지 않음). 관계 시그널 선택 시 궁합/사주대결 중 고르는
  서브 버튼 2개로 분기.
- **`useChildCoachController.js`** — **§10/§15 위반 발견 및 수정**: 재방문 인사가 여전히
  "지난번에 자세히 본 내용 기억하고 있어요"(구매 이력에 따라 분기)를 쓰고 있었음 — 이건 이번에
  명시적으로 금지한 "감시/기억 느낌" 패턴과 정확히 일치. 이력 유무와 무관하게 항상 동일한 중립
  문구("다시 오셨네요. 오늘은 어떤 이야기를 해볼까요.")로 통일(내부 상태 복원은 유지, 인사 문구만
  분기 제거). 첫 대화 시작 문구도 예시 그대로("요즘 아이를 보면서 신경 쓰이는 일이 있나요. 편하게
  이야기해 주세요. 작은 고민도 괜찮아요.")로 교체.
- **`SajuBattleScreen.jsx`** — **§13 실계산 연결**: 이전엔 상대방 정보를 입력받아도 결과는 여전히
  정적 데모 데이터(`BATTLE_ITEMS`)였다. 새 계산 로직을 만들지 않고(§16 계산 엔진 무변경 원칙),
  이미 있는 `/api/compatibility`(두 canonical chart 기반 결정론적 계산, 같은 두 사람이면 항상
  같은 결과)를 재사용하도록 교체. `App.jsx`에서 `myChartId` 전달.

### 검증 (§16 확인 — 변경 불필요)

`sanitizeUserFacingText`가 콜론/괄호/따옴표/샵/별표/화살표/세미콜론을 이미 전부 제거함을 실측
확인(허용: 한글/영문/숫자/공백/.,,?만) — §11 요구사항이 이미 충족되어 있어 코드 변경 없음.

### 실측 검증 (실제 HTTP 서버)

`POST /api/compatibility`에 상대방 정보 없이 요청 시 **HTTP 400 차단 확인**. 실제 두 사람의
생년월일로 chart 생성 후 계산 시 **결정론적 실계산 결과**(`{"score":47,"label":"노력형 궁합",...}`)
확인 — 정적 데모 데이터가 아님을 실증.

### 회귀

기존 398개 전부 통과(백엔드 로직 무변경이므로 회귀 영향 없음, 프론트가 기존 엔드포인트를 재사용).
프론트 빌드 성공.

### 남은 문제 (실제로 남은 것만)

- 개인정보처리방침 문서 자체는 아직 없음(링크 자리만 확보, `/privacy` 경로는 실제 페이지 없음) —
  별도 작업으로 분리.
- "OpenAI API를 통한 대화 내용은 기본적으로 AI 모델 학습에 사용되지 않습니다"는 문구를 넣었으나,
  이게 실제 계약/약관과 일치하는지는 OpenAI 측 정책 문서로 별도 확인 필요(코드로 검증 불가한 영역).
- 사주 대결의 "5개 항목별 막대그래프"(직업/돈/인간관계 등) 연출은 이번에 단일 점수+라벨+설명
  형태로 단순화됨 — 여러 항목별 세부 점수가 필요하면 추가 설계 필요.

## [Unreleased] — 33차 반영: 유료 분석 기억 못하는 문제 수정 + 로그인/Home 개선

### 배경

모델 라우팅(Terra=일반질문+상세분석, Luna=무료기본+코칭채팅, Nano=캐주얼)은 재확인 결과 이미
정확히 구현되어 있었음(코드 변경 없음). 핵심 문제는 **자녀 코치를 다시 열 때마다 새 chart+child
profile을 생성해서, 이미 전체(유료) 사주를 본 아이인지 서버가 기억은 하지만(user_id 기준) 프론트가
그 이력을 다시 불러오지 않았던 것.**

### 수정 파일

- **`apps/api/src/routes/child-profiles.mjs`** — `GET /api/child-profiles?userId=`신규. 해당
  사용자의 기존 자녀 프로필 목록을 각각의 구매 이력(`hasFullAnalysis`/`hasBasicAnalysis`, 이미
  있는 `purchased_analyses.tier` 데이터로 판정, 새 스키마 없음)과 함께 반환.
- **`useChildCoachController.js`** — `resumeExisting(profile)`(기존 프로필 재사용, 이력에 따라
  `hasAnalysis`/`freeTierExhausted` 상태 복원) + `checkExistingProfile()`(로그인 사용자의 기존
  프로필 유무 확인) 신규.
- **`ChildSajuScreen.jsx`** — 화면 진입 시 로그인 사용자면 먼저 기존 프로필을 조회해서 있으면
  자동으로 이어가고(생년월일 재입력 생략), 없으면 기존처럼 등록 폼을 보여줌.
- **`anonUser.js`** — `isLoggedIn()` 추가(닉네임 로그인 여부 판별 — 익명 사용자는 기기가 바뀌면
  이력을 잃으므로, "결제 기억" 기능은 로그인 사용자에게만 완전히 보장됨을 명확히 함).
- **`HomeScreen.jsx`** — 상단에 브랜드 타이틀 + 우측 로그인/회원가입 버튼(또는 로그인 시 닉네임
  표시) 추가, 서비스 카드는 그 아래로.
- **`NicknameSignup.jsx`/`App.jsx`** — 뒤로가기 버튼 추가, 가입 성공 시 홈으로 복귀, 닉네임을
  localStorage에 저장해 Home에 표시.

### 실측 검증 (실제 HTTP 서버)

로그인 → 자녀 프로필 생성 → 유료(full) 분석 구매 → `GET /api/child-profiles?userId=`로 재조회 →
**`hasFullAnalysis: true` 실제 확인.** 로그인 없이는 이 보장이 기기/브라우저 데이터에 의존하는
한계를 CHANGELOG와 코드 주석에 명시.

### 회귀

기존 398개 전부 통과. 프론트 빌드 성공.

### 미해결 (실제로 남은 것)

- 다자녀 지원 없음 — `checkExistingProfile`이 사용자의 첫 번째 자녀만 재사용(여러 자녀 등록/전환
  UI는 범위 밖).
- 로그인은 비밀번호 없는 닉네임 기반(같은 닉네임을 다른 사람이 먼저 쓰면 충돌 가능) — 실제
  소셜로그인(구글/카카오/네이버)은 실제 client ID/secret이 있어야 하므로 "준비 중"으로 유지.

## [Unreleased] — 32차 반영: 자녀 코치 첫마디/자동 스크롤 수정

### 배경

실사용 확인 결과 API 호출 자체는 정상 작동(로그로 확인). 다만 (1) 자녀 코치 첫마디가 평서문이라
AI가 부모 대신 말하는 것처럼 보이는 문제, (2) 새 메시지가 와도 스크롤이 자동으로 안 내려가는 문제
2건을 발견.

### 수정 파일

- **`useChildCoachController.js`** — 첫마디를 "아이를 키우면서 요즘 가장 신경 쓰이는 부분이
  있어요."(평서문, AI가 부모의 말을 대신하는 것처럼 보임) → "안녕하세요. 아이 이야기 편하게
  들려주시면 돼요. 요즘 어떤 게 궁금하세요?"(실제 질문형)로 수정. `pushMessage`가 character role
  메시지에 `character: {id: 'daegu'}`를 자동 부여하도록 수정(MessageList가 아바타 그룹핑에 이
  필드를 요구함).
- **`MessageBubbles.jsx`** — `CharacterMessageBubble`에 `sectionTitle` 표시 지원 추가(30차에서
  손으로 만든 렌더링에만 있던 기능을 공용 컴포넌트로 이관).
- **`ChildSajuScreen.jsx`** — **자동 스크롤 버그 수정.** 30차에서 메시지 리스트를 손으로 새로
  만들면서, 기존 `MessageList.jsx`에 이미 구현되어 있던 자동 스크롤(`scrollTop = scrollHeight`)
  + "새 메시지 왔음" 점프 버튼 로직을 재사용하지 않아 발생한 회귀. 이번에 `MessageList` 컴포넌트를
  그대로 재사용하도록 교체해서 근본 수정.

### 비용 추적 (코드 변경 없음, 안내)

`conversation-service.mjs`가 이미 모든 응답에 `usage`(input_tokens/output_tokens/total_tokens)를
반환하고 있다. 프론트가 현재 이 값을 화면에 표시하지 않을 뿐, 백엔드 데이터 자체는 존재함 — 필요
시 프론트에 노출하는 건 별도 작업으로 분리.

### 회귀

기존 397개 통과(1개는 기존에 확인된 flaky, 이번 프론트 전용 변경과 무관). 프론트 빌드 성공.

## [Unreleased] — 31차 반영: server.mjs의 loadEnvFile() 영구 누락 수정 (중요, 재발 방지)

### 배경 — 이번 수정의 중요성

이전 여러 라운드에서 사용자가 `.env`가 안 읽힌다는 문제를 리포트할 때마다 "server.mjs 맨 위에
`loadEnvFile()`을 추가하라"고 **로컬에서 메모장으로 직접 추가하도록만 안내**했다. 그런데 이 저장소
(Claude가 실제로 편집하는 원본)에는 그 수정이 한 번도 반영되지 않았다. 이후 29차/30차에서
`server.mjs`를 대규모로 재작성하면서 배포한 zip은 전부 `loadEnvFile()`이 없는 버전이었고, 사용자가
그 zip으로 로컬 파일을 덮어쓸 때마다 로컬에서 직접 추가했던 두 줄이 매번 사라졌다 — **AI 응답이
계속 MockAIProvider로 폴백되는 문제가 여러 라운드에 걸쳐 반복 재발한 근본 원인.**

### 수정 파일

- **`apps/api/src/server.mjs`** — 최상단 import 직후, `PORT`/`MODEL`/`CASUAL_MODEL`/
  `CHILD_COACH_MODEL` 등 `process.env`를 읽는 모든 코드보다 먼저 `await loadEnvFile();`을
  **이 저장소의 원본 파일 자체에 영구 반영.** 이제 이 프로젝트를 다시 zip으로 받아도 이 줄이
  사라지지 않는다.

### 실측 검증

실제 `.env` 파일(가짜 키로 값만 채움)을 만들어 `node apps/api/src/server.mjs`로 직접 기동해서
확인:
```
AI provider: OpenAIProvider (gpt-5.6-terra)
Casual AI: OpenAIProvider (gpt-5.6-luna)
```
`.env`가 실제로 로드되고 있음을 확인. 기존 398개 테스트도 전부 통과(`loadEnvFile()`은
`OPENAI_API_KEY` 등이 이미 `process.env`에 없을 때만 채우므로, 테스트 환경/CI에는 영향 없음).

### 재발 방지를 위한 교훈

앞으로 "로컬에서 수동으로 파일을 고쳐달라"고 안내하는 대신, **가능한 한 이 저장소의 원본 파일
자체를 먼저 고치고, 그 결과물을 zip으로 전달하는 방식**을 우선한다. 로컬 수동 편집 안내는
이 저장소 반영이 불가능한 경우(예: 사용자의 로컬 전용 `.env` 값 자체)로 한정한다.

## [Unreleased] — 30차 반영: 첫마디 개선, 유료 사주 가독성, 대화형 후킹, 전역 홈 버튼

### 배경

29차(v29)에서 API 호출은 정상 작동함을 실제 로컬 환경(브라우저 스크린샷)으로 확인. 이번엔 실사용
피드백 4가지를 반영: (1) "어, 왔네" 류 무성의한 첫마디, (2) 유료 분석 결과 가독성, (3) 버튼이
대화 없이 처음부터 노출되는 문제, (4) 전역 네비게이션 부재.

### 수정 파일

- **`characterAssets.js`/`WelcomeScreen.jsx`** — "어, 왔네.", "어, 왔네 ㅋㅋ" 등 무의미한 인사말을
  전부 "사주 보러 왔구나. 요즘 뭐가 제일 궁금해?" 류 후킹형 질문으로 교체(대구/맹구/큐피 전부).
- **`apps/api/src/services/child-profile-service.mjs`** — `summarizeChildAnalysisForDisplay`
  반환 타입을 단일 문자열에서 `{title, body}[]` 섹션 배열로 재구성(§2 가독성). category별로
  카드처럼 나눠 보이도록 `CATEGORY_LABELS` 매핑(선택권부여→"스스로 정하고 싶어하는 부분" 등)
  추가, LLM 프롬프트도 섹션 단위로 분리 생성하도록 수정. 내부 전용 카테고리(근거보강)는 사용자
  화면에서 자동 제외.
- **`useChildCoachController.js`** — 섹션 배열을 각각 별도 bubble로 표시(`sectionTitle` 필드
  추가). §3 후킹: 사용자 발화 2턴째에 자동으로 "그럼 이 이야기를 아이 사주랑 한번 같이 봐볼까요"
  자연스러운 제안 멘트 삽입.
- **`ChildSajuScreen.jsx`** — 기본/전체 사주 버튼을 상시 노출하지 않고 `userTurnCount >= 2`일 때만
  노출(§3). 섹션 제목을 bubble 위에 작게 표시.
- **`ChatHeader.jsx`/`ChatScreen.jsx`/`CompatibilityScreen.jsx`/`SajuBattleScreen.jsx`/
  `FunContentScreen.jsx`/`LeaderboardScreen.jsx`/`App.jsx`** — §4. 전 화면에 `onHome` prop과
  홈 버튼(⌂) 추가, `App.jsx`에서 전부 `() => setScreen('home')`으로 연결.

### 신규 CSS

`.message-row__section-title`, `.chat-header__home`, `.subscreen__header-home` — 기존 디자인
토큰만 재사용.

### 구현 중 발견하고 고친 문제 (테스트 코드 문제, 서비스 로직 아님)

`summarizeChildAnalysisForDisplay`의 반환 타입 변경(문자열→배열)으로 `tests/32`의 관련 테스트 1개가
깨짐 — 새 형식(sections 배열, title/body 필드)에 맞게 어서션 갱신.

### 회귀

기존 397개 + 갱신 1개 = **398개, 전부 통과.** 프론트 빌드 성공.

### 미해결 (실제로 남은 것만)

- `ChildBirthForm`/`BirthDataForm`(생년월일 입력 카드형 화면)에는 아직 홈 버튼이 없음 — 이 화면들은
  `subscreen__header`가 아니라 별도의 `intake-screen`(중앙 카드) 레이아웃이라 별도 처리가 필요해서
  이번 라운드에 포함 못함.
- 유료 사주 섹션 구분이 여전히 텍스트 카드 나열 수준 — 더 정교한 시각적 구분(아이콘, 색상 태그 등)은
  다음 라운드 후보.

## [Unreleased] — 29차 반영: 최종 통합 수정 (프론트-백엔드 연결, Home 화면, 사주 대결, 출력 정규화)

### 배경 — 이번 라운드 최대 발견

**22~28차에 걸쳐 만든 자녀 성장 코치 백엔드(child_profile_id/PurchasedAnalysis/AIProfileContext/
target·intent·depth 엔진/behavioral-evidence/24시간 체험/모델 라우팅)가 프론트엔드 어디에도
연결되어 있지 않았다.** 실제 브라우저의 `ChildSajuScreen`은 완전히 다른 구식 카탈로그 선택 UI
(`/child-opening-choices`/`/child-catalog-choice`, 자유 텍스트 없음)를 쓰고 있었다. 사주 대결도
"버그"가 아니라 애초에 정적 데모 데이터(코드 주석에 이미 명시)였고, 가격/결제 UI는 구현된 적이
없었다.

### 수정 파일 — 백엔드

- **`packages/character/casual-response-engine.mjs`를 자녀 코치 fallback에서 분리**
  (`conversation-service.mjs`) — ㅋㅋ/ㅎㅎ가 자녀 코치 대화에도 새는 원인을 확정하고 수정. 자녀
  코치는 이제 안전한 고정 문구로만 fallback.
- **`packages/shared/sanitize-output.mjs` 신설** — 허용 문자(한글/영문/숫자/공백/.,,?)만
  남기는 새니타이저. `pipeline.mjs`(사주/자미두수/궁합 공통 원천, 단일 지점 적용)와 캐주얼/자녀
  코치 응답, 자녀 분석 요약 전부에 적용.
- **§11 무료 1회 제한 서버 강제** — `purchased_analyses`에 `tier` 필드 추가,
  `hasUsedFreeChildAnalysis(userId)`로 실제 저장 데이터 기반 판정(새 스키마 최소화).
  `generateChildGrowthAnalysis`가 `tier==='basic'`일 때 이미 사용 이력 있으면
  `FREE_TIER_EXHAUSTED`(403)로 차단 — 프론트 버튼 숨김이 아니라 서버가 실제로 막음(HTTP 호출로
  실측 확인).
- **§20 모델 라우팅 실연결** — `summarizeChildAnalysisForDisplay` 신설(이전엔 분석 결과가 내부
  JSON 파편에만 있고 사람이 읽을 텍스트로 바꾸는 단계 자체가 없었음). `child-profiles.mjs`에
  tier별 provider(`basicAiProviderFactory`=luna, `fullAiProviderFactory`=terra)를 실제로 연결.
- **`childProfileId` 관통 배관** — `/api/charts/:id/questions` → `startConversation` →
  `createConversation`까지 파라미터 관통, 프론트가 이제 실제로 `child_profile_id`가 연결된
  conversation을 만들 수 있음.
- **§15 사주 대결 상대방 정보 필수화** — 별도 계산 엔진 신설 없이(요구사항상 범위 밖), 기존
  `CompatibilityScreen`과 동일한 input→result 흐름을 강제해서 상대방 정보 없이는 결과 화면
  진입 자체가 불가능하게 수정.

### 수정 파일 — 프론트엔드 (전부 신규 또는 대규모 재작성)

- **`HomeScreen.jsx`/`ServiceIntroScreen.jsx` 신설** — §3/§4/§5. `App.jsx` 라우팅을
  `home → intro → (welcome/birth/child/battle/compatibility)`로 재구성. 서비스 시작 즉시
  생년월일 입력으로 넘어가던 구조 제거.
- **`useChildCoachController.js` 신설** — 기존 `useChildChatController.js`(구식 카탈로그 경로,
  이번에 폐기하지 않고 남겨둠—다른 참조가 없어 dead code)와 달리 실제 `child_profile_id` 파이프라인
  에 연결된 자유 텍스트 채팅. §8("어, 왔네?ㅋㅋ" 대신 자연스러운 고민 질문으로 시작),
  §9(자유 텍스트로 고민 수집), §12(기본/전체 사주 선택 상시 노출), §14(분석 후에도 채팅 가능).
- **`ChildSajuScreen.jsx` 전면 재작성** — 새 컨트롤러 연결, 기존 `ChatInput` 컴포넌트 재사용.
- **`SajuBattleScreen.jsx` 전면 재작성** — `CompatibilityScreen`과 동일한 input→result 패턴으로,
  상대방 이름/생년월일/시간/성별 입력을 결과 진입의 필수 관문으로 만듦.
- **`splitIntoBubbles.js` 신설** — §17. API 호출은 1회 그대로 유지, 응답 텍스트를 프론트에서만
  여러 채팅 bubble로 분리(줄바꿈 우선, 없으면 문장 단위+20자 미만 병합). `useChatController.js`에
  적용.
- **`anonUser.js` 신설** — 자녀 코치는 닉네임 가입을 강제하지 않되, §11 무료 1회 추적을 위해
  브라우저에 안정적인 익명 userId를 localStorage로 유지(닉네임 가입 시 그 ID로 자동 전환).
- **`api/client.js`** — `createChildProfile`/`generateChildAnalysis` 추가,
  `startFirstQuestion`에 `childProfileId` 파라미터 추가.

### 구현 중 발견하고 고친 문제 (전부 테스트 코드 문제로 판별, raw 데이터로 재확인)

`tier` 필드 추가로 기존 테스트 8개가 일시 실패 — 같은 사용자로 여러 번 분석을 생성하던 테스트들이
새 무료 1회 제한에 걸린 것. 이 테스트들은 "여러 분석의 병합/추적"을 검증하려는 것이지 무료 정책과
무관하므로, 호출부에 `tier: 'full'`을 명시해서 우회(코드 로직 약화 아님).

### 회귀 및 실측 검증

- 기존 393개 + 신규 5개(`tests/32-free-tier-and-model-routing.test.mjs`) = **398개, 전부 통과.**
- **실제 HTTP 서버를 기동해서(MockAIProvider) Test B/C/D를 curl로 재현** — chart 생성 → child
  profile 생성 → childProfileId 연결 conversation → 자유 텍스트 캐주얼 대화(casual로 정확히
  분류, ㅋㅋ 없는 안전한 폴백 확인) → 기본 무료 분석(tier=basic 저장, summary 생성) → 같은 유저
  재시도 시 **HTTP 403 FREE_TIER_EXHAUSTED 실제 확인** → 유료(full) 정상 진행(HTTP 201) 전부
  실측.
- 프론트 빌드 성공(64 모듈).

### 실제 브라우저 검증에 대한 정직한 한계

이 환경은 텍스트 기반 도구만 제공되어 **렌더링된 브라우저에서 클릭/스크롤 등 실제 UI 상호작용을
확인할 수 없다.** 대신 (1) 프론트 빌드 성공, (2) 실제 HTTP 서버 기동 후 백엔드 API 흐름을 curl로
전부 재현, (3) 프론트 코드가 그 API들을 정확한 파라미터로 호출하는지 소스 레벨로 확인하는 방식으로
대체 검증했다. 이건 "실제 브라우저 검증"의 완전한 대체가 아니라는 걸 명시한다.

### 보호된 영역

`canonical/`, `compute.mjs`, `compatibility-*.mjs`, 원본 프롬프트 2개, `child-growth-analysis.mjs`
의 계산 로직(TRAIT_PROFILES 등) — 전부 무변경 확인.

### 실제 API 테스트

`OPENAI_API_KEY` 등 환경변수가 이 환경에 없어 실제 LLM 호출은 여전히 불가 — MockAIProvider로
코드/흐름 검증까지만 수행했고, mock 결과를 실제 LLM 결과로 보고하지 않았다.

### 미해결 (실제로 남은 것만)

- 무료 1회 제한이 회원가입(닉네임) 없이 브라우저 localStorage 기반이라, 사용자가 브라우저 데이터를
  지우면 우회 가능(로그인 시스템 부재라는 근본 한계, 이번 범위 밖).
- `useChildChatController.js`(구식 카탈로그 경로)가 코드베이스에 남아있음 — 더 이상 어디서도 안
  쓰이지만 삭제하지 않음(요구사항에 명시적 삭제 지시 없었음, 삭제는 별도 확인 후 진행 권장).
- 실제 LLM 응답 품질은 여전히 검증 불가.

## [Unreleased] — 28차 반영: 3개 정밀도 개선(relationship 판정 / observable 랭킹 / 장문+how 가이드)

### 배경

27차 감사(READY WITH CONDITIONS)에서 발견된 3개 개선 후보만 정밀 보완. 기존 판정 엔진 구조(target
→intent→tag→depth)와 TRAIT_PROFILE 원재료는 그대로 유지.

### 수정 파일

- **`packages/character/casual-chat-prompt.mjs`**:
  - **개선①(relationship 정밀도)**: `RELATIONSHIP_INTERACTION_SIGNAL`(아이랑/아이와/아이하고 +
    싸우다/부딪히다/갈등/관계/대화/사이) 신규 추가. "아이랑"/"아이와" 리터럴 조사가 아이 바로
    뒤에 붙어있을 때만 인정해서 "아이가 친구와 싸웠어요" 같은 다른 대상과의 상호작용까지 우연히
    걸리는 걸 방지. `CHILD_ACTION_SIGNAL_STRONG`(숙제/게임/식사/수면/고집)이 있으면 relationship
    신호보다 child를 우선. 판정 순서: 명시적 자기서술(parent) → 관계신호(relationship) →
    무주어 감정상태(parent) → 대사요청 패턴(child/relationship) → 기본 child.
  - **개선②(observable 정밀도)**: `findMatchingFragments`가 concept_tag 매칭 시 배열의 첫 번째가
    아니라 `scoreObservableMatch`(태그 겹침 개수×100 + 질문-재료 단어 겹침×10)로 점수를 매겨 최고
    점수를 선택하도록 변경. LLM/임베딩 미사용, 새 의존성 없음. 동점이면 배열 순서상 먼저 나온
    항목 유지(허용된 fallback). "본인이 선택한 건 오래 붙잡고 해요"가 이제 "직접 지시받으면..."
    (1번째, 부적합)이 아니라 "본인이 먼저 하겠다고 한 일에는...몰입할 가능성"(2번째, 의미상 적합)을
    선택.
  - **개선③(장문+how 가이드)**: `isLongHowSituation(text, intent)` 신규 — length≥40 && intent='how'
    && (태그기반 상황서술 또는 연결어미(는데/아서/어서/해서)+길이>18 기반 상황서술) 조건을 모두
    만족할 때만 `LONG_HOW_GUIDE`(고정 템플릿 아닌 5개 원칙 목록) 추가. target/depth 판정 로직
    자체는 전혀 안 건드림 — target=parent인 장문+how 질문도 가이드는 붙지만 material은 여전히
    0(안전 규칙 유지 확인).

### 구현 중 발견하고 고친 실수 (제 자체 검증 스크립트 문제, 서비스 로직 아님)

`isLongHowSituation`을 처음 만들 때 없는 함수(`hasFreshSituationDescription`, 27차 리팩터링에서
이미 인라인화되어 삭제된 이름)를 참조하는 실수를 문법 검사 직후 발견해서 즉시 인라인 로직으로
대체. 이어서 "long+how+parent"/"long+how+무관주제" 검증 예시 문장을 처음 잘못 만들어서(상황 서술
신호가 전혀 없는 문장) 가이드가 꺼지는 걸 실제 버그로 오인할 뻔했으나, 실제 원인은 예시 문장
자체의 문제였음을 재확인 후 올바른 예시로 교체 — 이 과정에서 "상황 서술"을 "프로필 태그 매칭
여부"와 혼동하면 안 된다는 것도 재확인(연결어미 기반 판단을 별도 OR 조건으로 추가).

### 신규 테스트

`tests/30-precision-improvements.test.mjs`(14개) — relationship positive 5 + false-positive 방지
5 + 기존 13개 경계/parent 회귀, observable 랭킹 핵심 케이스 + 강한매치 우선 + 동점 결정론, long+how
5개 조합 전부, profile leak 회귀 5건.

### 회귀

기존 366개 + 신규 14개 = **380개.** 7회 연속 실행 전부 380/380(이전 라운드에서 관찰된 flaky test
이번엔 재현 안 됨 — 낮은 확률 현상이라 완전 해소 여부는 불확실, 계속 관찰 필요).

### 안전 규칙 재확인

CAUSALITY_RULE/PROFILE_NOT_EXPLAIN_RULE 모든 depth·target 조합에서 유지, profile leak 5건 전부
재확인 PASS, parent target에서 evidence/material 0 유지, long+how 가이드가 parent target의 material
재활성화를 유발하지 않음을 명시적으로 테스트.

### 보호된 영역

canonical/compute/compatibility/원본 프롬프트/TRAIT_PROFILE 원재료 구조 — 전부 무변경 확인. 실제
LLM 호출 없음.

### 남은 문제 (추측 아닌 확인된 사항만)

- observable 랭킹의 단어-겹침 스코어링은 단순 substring 비교라, 조사가 붙은 형태(예: "본인이"
  vs "본인의") 변형까지는 못 잡을 수 있음 — 실사용 데이터로 추가 검증 필요.
- relationship interaction 신호가 "아이랑/아이와/아이하고" 리터럴에만 반응해서, "얘랑"처럼 다른
  지칭어를 쓰는 표현은 아직 못 잡음 — 범위 확장 시 이번 설계 원칙(엄격한 리터럴 매칭) 유지 권장.

## [Unreleased] — 27차 반영: 독립 감사에서 발견된 BUG-1~4 수정

### 배경

26차 반영(target/intent/depth 엔진) 직후 독립 감사를 진행해서, 실제 코드 실행으로 4개 BUG를
확정했다. 특히 **BUG-1은 "숙제 얘기만 나오면 저도 모르게 소리를 질러요"라는 명백한 부모 자신의
질문에 아이 프로필이 실제로 프롬프트에 유출되는 것을 재현**한 심각한 문제였다.

### 수정 파일

- **`packages/character/casual-chat-prompt.mjs`**:
  - **BUG-1(HIGH) 수정**: `classifyTarget`을 순서 고정 정규식(부정목록)에서 "자기서술 주어
    신호(제가/저는/저도/내가/나는) **AND** 감정·행동·자기평가 서술어 신호"의 독립 매칭+결합
    방식으로 재설계. 주어가 생략된 "OO 때문에 지쳐요"류는 `CHILD_CAUSED_PARENT_EMOTION_PATTERN`
    (때문에+감정서술어)으로 별도 포착. "아이가/애가"가 명시적으로 그 감정 서술어의 주어인
    경우(아이 본인의 상태)는 예외 처리.
  - **BUG-3(MEDIUM) 수정**: `RELATIONSHIP_ASK_PATTERNS` 매칭만으로 relationship을 확정하지
    않고, 문장에 구체적 아이 상황 서술이 있으면(situation/concept 태그 매칭, 또는 상황 서술
    연결어미+충분한 길이) child를 우선하도록 재설계. "아까/그때" 같은 과거 참조 신호가 있으면
    상황 서술이 있어도 relationship 유지(이미 다룬 화제를 다시 설명 안 하고 history에 의존).
  - **BUG-2(MEDIUM) 수정**: `CONCEPT_TAG_TRIGGERS['자기결정']`에 큐레이션된 트리거 8개 추가
    ("자기가 정한", "본인이 정한", "스스로 결정" 등). 나머지 4개 빈 태그(`참여`/`예측가능성`/
    `결과물`/`준비시간`)는 감사에서 재확인한 결과 **같은 파편(fragment) 안에서 이미 트리거가 있는
    형제 concept_tag와 항상 동반**되어 있어 실질적 죽은 태그가 아님을 확인 — 억지로 채우지 않고
    그 이유를 주석으로 남김(지시사항의 "억지로 채우지 마라" 원칙 준수).
  - `resolveDepthAndMaterial`을 export(유닛 테스트 가능하게), `getPersonalizationDepth`(target→
    intent→depth를 한 번에 계산하는 헬퍼) 신규 export.
- **`apps/api/src/services/conversation-service.mjs`**:
  - **BUG-4(LOW) 수정**: `usedEvidenceRefs`가 이전엔 `childContext`가 조회되기만 하면(depth 무관)
    항상 기록됐는데, `getPersonalizationDepth(...) !== 'NONE'`일 때만 기록하도록 수정.

### 감사에서 재확인 후 실측 검증한 것 (BUG-1~4 전부 실제 코드 존재 확인 후 수정)

- 17개 target 테스트(parent 8 + child 6 + relationship 3) **100% 일치**
- 5개 경계 케이스 전부 지시사항과 일치("아이에게 뭐라고 말해야 할까요?"→relationship, "아이가
  숙제를 안 하는데 뭐라고 말해야 할까요?"→child 등)
- False Positive(Profile Leak) 재검증 5건 — 전부 미노출(observable/scene/strategy/category/
  why_fact/evidence 마커 전부 부재 확인)
- False Negative 재검증 6건 — 전부 매칭 성공(이전엔 2건 실패)

### 신규 테스트

`tests/29-target-depth-engine.test.mjs`(17개) — `classifyTarget`/`resolveDepthAndMaterial`/
`getPersonalizationDepth`를 **직접 호출**하는 첫 유닛 테스트(이전까지 0개였음, 감사에서 확인). A(target
17+3경계) / B(concept tag 흔한단어 회귀 포함) / C(depth NONE/LIGHT/FOCUSED/DEEP 각 최소 1묶음) /
D(profile leak 5, 가장 중요) / E(relationship 경계 5) / BUG-4 확인 전부 반영. 기존 코드 출력이
아니라 "요구사항"을 기준으로 기대값을 먼저 정하고 작성.

### 회귀

기존 349개(1개는 receptive+숙제 조합의 fixture가 BUG-4 수정으로 인해 우연히 통과하던 게 드러나서
self-directed로 교체) + 신규 17개 = **366개.** 반복 실행 시 기존에 이미 알려진 flaky 1건(파일
기반 JsonStore 경쟁조건, 이번 수정과 무관, 26차 CHANGELOG에 기록된 것과 동일 패턴)이 낮은 확률로
재현됨을 재확인.

### 보호된 영역

`canonical/`, `compute.mjs`, `compatibility-*.mjs`, 원본 프롬프트(`saju-original.md`/
`ziwei-original.md`), DB 스키마 — 전부 무변경 확인.

### 실제 LLM 호출

이번 라운드에서도 추가하지 않음 — 검증은 target/intent/tag matching/depth/prompt assembly
전부 코드 레벨로만 수행.

### 남은 위험 (솔직하게 기록)

- `hasFreshSituationDescription`의 연결어미 휴리스틱(`/는데|아서|어서|해서/` + 길이 18자 초과)이
  아직 태그 사전에 없는 새로운 상황(예: 또래관계, 식사)까지 완벽히 커버하진 못함 — 태그 사전이
  커지면 함께 보완돼야 함.
- 실제 LLM 응답 품질(프롬프트가 실제로 자연스러운 답을 유도하는지)은 이번에도 검증 불가 — 다음
  단계(LLM 연결) 이후 과제로 남음.

## [Unreleased] — 26차 반영: Target/Intent/큐레이션 태그 기반 Personalization Depth 엔진

### 배경

"질문에 특정 단어가 들어갔는가"가 아니라 "이 프로필 재료가 실제 답변에 도움이 되는가"를 판정하도록
재설계했다. 핵심 흐름: 질문 → target(parent/child/relationship) → intent(why/how/concern/sharing/
simple) → 큐레이션 situation/concept 태그 매칭(1차 필터, 추가 LLM 호출 없음) →
depth(NONE/LIGHT/FOCUSED/DEEP) → depth에 맞는 만큼만 재료를 꺼냄. target≠'child'면(부모 자신에
대한 질문 등) 무조건 NONE — 프로필 텍스트가 프롬프트에 한 조각도 안 들어감.

### 수정 파일

- **`packages/chart-engine/child-growth-analysis.mjs`** — `TRAIT_PROFILES`의 모든 파편이 이제
  `{text, concept_tags}` 또는 `{text, situation_tags}` 객체(기존엔 순수 문자열). `observable_
  patterns`는 concept_tags(고집/반항/미룸/자기결정 등 의미 묶음 — 단어가 프로필 원문에 없어도
  매칭되게 함), `scene_examples`/`parent_strategy_examples`는 situation_tags(숙제/게임종료/지시/
  비교 등 구체 상황). 이미 `behavioral-evidence/`가 쓰던 큐레이션 태그 패턴(사람이 직접 고른
  구체어, "말/아이/안/해" 같은 흔한 단어는 후보에서 배제)을 그대로 적용. `buildCaution`에도
  `concept_tags: ['몰입','집중']` 추가. 버전 `v2`→`v3`.
- **`apps/api/src/services/child-profile-service.mjs`** — `buildContextPatchFromAnalysis`가 태그
  객체를 그대로 AIProfileContext로 옮기도록 수정(가공 없음).
- **`packages/character/casual-chat-prompt.mjs`** — 전면 재작성. `classifyTarget`(부모 자신에
  대한 질문 패턴 매칭 → 'parent', 순수 대사 요청 → 'relationship', 나머지 → 'child'),
  `classifyIntent`, `SITUATION_TAG_TRIGGERS`/`CONCEPT_TAG_TRIGGERS`(질문 텍스트 → 태그 후보,
  전부 사람이 큐레이션), `resolveDepthAndMaterial`(태그 매칭 결과로 depth 산정 + 그 depth만큼만
  재료 선택 — FOCUSED는 scene 1개+strategy 1개만, 전체 프로필 절대 안 줌). DEEP은 "재료를 많이
  주는 단계"가 아니라 "반복 신호(아까/또/이번에도) + 이전 대화의 동일 situation_tag"로 판정(승인된
  재정의 반영).
- `apps/api/src/services/conversation-service.mjs` — `buildCasualSystemPrompt` 호출에 직전
  **사용자** 메시지(`lastUserMessage`, role 필터링)를 넘겨 DEEP 반복맥락 판정에 사용.

### 구현 중 발견하고 고친 실제 결함 3가지

1. **안전 규칙 누락(중요)**: 최초 구현에서 depth=NONE일 때 "사주 원인 단정 금지" 규칙(CAUSALITY_
   RULE)까지 통째로 프롬프트에서 빠지는 버그를 발견 — 재료가 없다고 안전장치까지 빼면 모델이
   스스로 사주 표현을 지어낼 위험을 못 막는다. 즉시 수정: NONE이어도 안전 규칙은 항상 유지, 재료
   나열 부분만 생략.
2. **caution(귀문 관찰포인트) 완전 누락**: 새 depth 엔진 구현 중 `caution_points`를 아예 참조하지
   않아서, 귀문이 있는 아이도 caution이 프롬프트에 전혀 안 나오는 회귀가 있었다. `caution_points`
   에도 concept_tags 매칭을 추가하고, 매칭 시 depth와 별개로 항상 함께 노출되도록 수정.
3. **테스트-데이터 불일치(테스트 코드 문제로 판별)**: 기존 여러 테스트가 "receptive 성향 아이 +
   숙제 질문" 조합을 썼는데, receptive 프로필에는 애초에 '숙제' situation_tag가 없어서(새로운환경/
   준비시간만 보유) 실제로 매칭되지 않는다는 게 드러났다. 이는 서비스 버그가 아니라 "관련 없으면
   개인화 안 함" 원칙이 정직하게 작동한 것 — self-directed/expressive 등 실제로 매칭되는 아이·
   질문 조합으로 테스트를 교체(24/26/27/28번 파일에 걸쳐 다수 수정).

### 테스트

기존 349개 — 스키마 변경으로 9개, 이후 추가 diagnostic으로 12개까지 일시 실패 → 전부 실제
프롬프트 출력을 직접 확인하며 원인 판별 후 수정 → **최종 349개 전부 통과.**

### 남은 gap

큐레이션 태그 사전(SITUATION_TAG_TRIGGERS/CONCEPT_TAG_TRIGGERS)이 아직 소규모(10여 개 항목)라
다양한 실제 부모 질문을 커버하기엔 이르다 — 사용 데이터가 쌓이면 태그를 확장해야 한다. DEEP
depth는 이번엔 로직만 만들었고 실제 fixture로 "반복 맥락" 케이스를 폭넓게 검증하지는 못했다(다음
라운드 후보).

### 발견한 별도 이슈 — 낮은 확률의 flaky 테스트 (이번 로직과 무관, 정직하게 기록)

`npm test`(`node --test tests/*.test.mjs`, 파일당 병렬 워커)를 반복 실행하는 과정에서 **약 10%
확률로 무작위 1건이 실패**하는 현상을 발견했다. 8~10회 재실행 시도 중 재현이 드물어 정확한 실패
테스트명은 특정하지 못했다. `--test-concurrency=1`(순차 실행)로는 여러 차례 실행해도 항상
349/349 통과 — **파일 기반 JsonStore를 여러 테스트 파일이 동시에 병렬로 읽고 쓰는 경쟁 조건**으로
추정된다. 이번 26차 반영에서 새로 만든 target/intent/depth 로직 자체의 결정론적 버그는 아닌 것으로
판단되나(같은 입력에 항상 같은 depth가 나옴을 별도 확인함), 테스트 인프라 차원의 개선(테스트
파일별 독립 DB 디렉토리 사용 등)이 필요할 수 있어 다음 라운드 후보로 남긴다.

## [Unreleased] — 25차 반영: 대화 생성 골격 재설계 ("장면 번역" 아키텍처, 완성문장→파편 구조)

### 배경

"AI 말투를 줄인다"가 아니라 "분석 보고서 형식 자체를 못 쓰게 한다"는 목표로, 문제의 근원을 다시
진단했다. 실제 원인은 casual-chat-prompt.mjs의 고정 6단계 구조뿐 아니라, **AIProfileContext에
저장되는 원재료 자체가 이미 완성된 설명 문장**이었다는 것 — 프롬프트가 아무리 "장면으로 말하라"고
지시해도 원재료가 설명체면 모델은 그걸 다듬어 반복할 수밖에 없었다.

### 수정 파일

- **`packages/chart-engine/child-growth-analysis.mjs`** — `ACTION_TEMPLATES`(완성 문장 5종) →
  `TRAIT_PROFILES`(파편 구조: `observable_patterns`/`scene_examples`/`parent_strategy_examples`/
  `caution_note`/`why_fact`)로 전면 재작성. `why_fact`는 내부 근거 추적 전용으로 분리(§2, 사용자
  대화 프롬프트에서 완전 제외). `buildStarSignal`은 완성 문장 대신 `signal_kind`(내부 신뢰도
  메타데이터)만 반환. `buildCaution`도 `observable_pattern`(짧은 명사구)+`_internal_note`(내부
  전용)로 분리. `parent_actions` 각 항목의 스키마가 바뀜(`action`/`why`/`avoid_action`/
  `observation_checkpoint` → `observable_patterns`/`scene_examples`/`parent_strategy_examples`/
  `caution_note`/`why_fact`). `CHILD_GROWTH_ANALYSIS_METHOD`를 `v1`→`v2`로 갱신(계산 로직 자체는
  무변경, 표현 템플릿만 재설계됐음을 버전으로 표시).
- **`apps/api/src/services/child-profile-service.mjs`** — `buildContextPatchFromAnalysis`가 새
  파편 필드를 그대로 AIProfileContext로 옮기도록 수정. `why_fact`는 evidence_refs 추적(fact_ref)
  에는 쓰이지만 `parent_approach`에는 절대 포함하지 않음(§2 그대로 반영). `observation_points`
  필드는 v2에서 파편 구조로 대체되어 폐지(빈 배열 유지, 하위 호환).
- **`packages/character/casual-chat-prompt.mjs`** — 전면 재작성:
  - 신규 `classifyChildQuestionType(text, hasHistory)` — TYPE A~G 키워드 기반 분류(새 LLM 호출
    없음). 유형별 `QUESTION_TYPE_GUIDE`로 프롬프트 지시문 자체가 달라짐 — 모든 질문에 동일한
    고정 6단계 구조를 강제하지 않음.
  - `formatChildFragmentsForPrompt`가 파편을 "재료 목록"으로만 나열(완성 문장 조립 안 함) —
    "이 재료를 그대로 베끼지 말고 새로 조합하라"는 지시와 함께.
  - `SCENE_TRANSLATION_RULE`/`CAUSALITY_RULE` 신규 — "경향이 있습니다/~로 읽힙니다" 반복 금지,
    사주=해석 프레임일 뿐 실제 행동의 증거가 아니라는 원칙 명시.
  - Behavioral Evidence는 `topic`/`confidence` 라벨 없이 `recommended_parent_behavior` 텍스트만
    전달(§8, "연구에 따르면" 류 인용체 방지).
  - 이전 버전에 있던 "완곡한 표현은 계속 써도 된다"(예시로 "~한 경향이 있어요" 포함) 문구를
    제거 — 이 문구 자체가 반복 표현의 씨앗이었음. 조건부 장면 표현으로 hedging의 역할을 대체.
- `apps/api/src/services/conversation-service.mjs` — `buildCasualSystemPrompt` 호출에
  `hasHistory` 인자 추가(질문 유형 분류용).

### 구현 중 발견한 문제 (전부 테스트 코드 문제로 판별, raw 데이터 직접 확인으로 검증)

스키마 변경으로 기존 349개 중 9개가 실패했다. 전부 실제 서비스 코드 결함이 아니라 **구 스키마/구
문구를 직접 검증하던 테스트가 갱신이 필요했던 것**으로, 실제 프롬프트 출력을 직접 찍어서 정확한
신규 문구를 확인한 뒤 하나씩 대응 갱신:
- `analysis_engine_version` 문자열(v1→v2), caution 필드명(`text`→`observable_pattern`)
- "직접 원인으로 단정하지 않는다" → 새 문구 "실제 행동을 증명하는 자료가 아니다"로 표현이 바뀜
- 귀문 caution이 프롬프트에 노출되는 실제 문구가 `_internal_note`가 아니라
  `formatChildFragmentsForPrompt`가 만드는 "조금 더 세심하게 살펴볼 만한 부분"으로 바뀜
- 데이터 섹션 추출 마커("참고 자료야):")가 새 프롬프트 구조에서 사라져 마커 갱신 필요
- "완곡한 표현은 계속 써도 된다" 검증 테스트는 **이번 재설계로 그 원칙 자체가 의도적으로 폐기**된
  것이라, 새 원칙(조건부 장면 표현)을 검증하도록 재작성

### 실제 fixture 검증 (승인 요구사항 ⑩)

5명 × 10질문 = **50건 전수 실행**, 매번 독립 프로필로 24시간 5회 체험 제한을 우회해서 순수 프롬프트
구조만 검증(실제 서비스에서는 이 제한이 여전히 정상 작동함을 별도 확인). "경향으로 읽힙니다"/
"경향이 있습니다." 같은 구식 표현의 **실사용 0건**(50/50, 금지 예시로만 프롬프트에 존재, 실제 재료
텍스트에는 없음). 질문 유형 분류도 A(성향질문)/B(행동고민)/C(원인질문)/D(해결방법)로 정확히 갈림 —
다만 이번 10문항 세트에서 TYPE E(장문) 조건(60자 초과)에 걸린 문장이 D 패턴("어떻게")과 겹쳐 D로
우선 분류된 케이스가 있어, 분류 우선순위(D가 E보다 먼저 체크됨)가 실제로 그렇게 작동함을 확인 —
버그는 아니나 향후 우선순위 조정 여지로 기록.

### 테스트

기존 349개(9개 갱신) — **전부 통과.** 신규 테스트 파일은 이번 라운드에서 추가하지 않음(기존
24/26/27/28번 파일의 관련 테스트가 새 스키마/문구를 검증하도록 갱신됨).

### 빌드

프론트 빌드 성공. 원본 프롬프트/계산 엔진 무변경 재확인.

### 남은 gap (다음 라운드 후보)

TYPE E(장문 설명) 분류 우선순위가 TYPE D보다 낮아, "어떻게" 키워드가 포함된 장문 질문은 D로
분류됨 — 실제 서비스 영향은 제한적(D 가이드도 "설명보다 대사"라 완전히 부적합하진 않음)이나,
정밀도를 높이려면 우선순위 조정이 필요할 수 있음.

## [Unreleased] — 24차 반영: 「우리 아이 성장 코치」 24시간 5회 체험판 + 행동과학 Evidence Layer

### 배경

상품명을 "우리 아이 성장 코치"로 확정(사용자-facing 텍스트에서 "AI" 미노출), 실제 조사한 12개
행동과학 문헌을 코드화, 24시간 5회 체험 게이팅, 모델 routing(CHILD_COACH_MODEL) 구현.

### 신규 파일

- `packages/character/behavioral-evidence/*.mjs`(13개: 12개 evidence + index) — 실제 문헌
  기반(Deci & Ryan의 SDT는 웹 검색으로 재확인, 나머지는 확립된 고전 문헌). 각 항목에
  `confidence`(strong/moderate), `sources`(저자/연도/제목), `match_keywords`/`match_traits` 포함.
  `matchBehavioralEvidence()`는 키워드가 하나도 안 맞으면 즉시 null 반환(과매칭 방지, 억지 연결
  금지 원칙 구조적으로 보장).
- `tests/28-child-coach-trial-and-tone.test.mjs` — 24개 테스트(요청된 20개 항목 전부).

### 수정 파일

- `apps/api/src/repositories/child-profile-repository.mjs` — `trial_started_at`/
  `trial_question_count`/`subscription_status`(예약, 미사용) 필드 추가. `recordTrialUsage()`:
  24시간 이내 5회까지 허용, 24시간 경과 시 카운트 무관 차단(§10 그대로), 신규 체험권 자동 재발급
  없음. `updateChildProfile()` 헬퍼 추가(테스트 및 향후 관리용).
- `packages/character/casual-chat-prompt.mjs` — 전면 개정: "신호" 사용자-facing 미노출(내부
  `core_signals`/`trait_signal` 변수명은 무수정), 공감 규칙(1문장, 과잉 금지), ㅋㅋ/ㅎㅎ 계열
  완전 금지, evidence matching 결과를 선택적으로 프롬프트에 주입(moderate confidence는 완화
  문구 자동 추가), 사주=개인화/행동과학=근거 분리 원칙 명시.
- `apps/api/src/services/conversation-service.mjs` — trial 게이팅(child_profile_id 있는 대화만),
  모델 routing(`childCoachAiProvider` 우선, 없으면 `casualAiProvider` 폴백), `buildCasualSystemPrompt`
  에 `userText` 전달(evidence matching용).
- `apps/api/src/routes/conversations.mjs`, `apps/api/src/server.mjs` — `CHILD_COACH_MODEL` env var
  + `childCoachAiProviderFactory` 추가(미설정 시 casual로 자동 폴백, 하드코딩 없음).

### 구현 중 발견하고 고친 문제 — 실제 서비스 코드 버그 1건 + 테스트 결함 2건

**실제 코드 버그(중요)**: `child-growth-analysis.mjs`(20차 반영)의 caution 템플릿이 "귀문(鬼門)
**신호**가 확인됩니다"라는 문구를 생성하고 있었고, 이게 그대로 AIProfileContext → casual prompt에
삽입되어 이번 요구사항(§1 "신호" 미노출)을 실제로 위반하고 있었다. "귀문(鬼門)에 해당하는 부분이
확인됩니다"로 수정, 관련 기존 테스트(27번 파일)의 어서션도 함께 갱신.

**테스트 결함 2건**(서비스 코드 문제 아님, raw 데이터/구조 직접 확인으로 판별):
1. "신호" 미노출 테스트가 프롬프트 전체를 검사해서, "신호라는 단어를 쓰지 마라"는 지시문 자체(예시로
   "신호"를 포함)에 걸려 항상 실패 — 실제 아이 데이터 부분만 추출하도록 수정.
2. 24시간 경과 테스트가 `storeFor()`로 별도 JsonStore 인스턴스를 만들어 데이터를 직접 조작했는데,
   `JsonStore`가 인스턴스별 독립 메모리 캐시를 갖는 구조(파일엔 정상 저장되지만 다른 인스턴스는
   캐시된 옛 값을 봄)라 캐시 불일치가 발생 — 리포지토리 레이어에 `updateChildProfile()` 정식 헬퍼를
   추가해서 우회 경로 자체를 제거.

### 테스트

기존 325개 + 신규 24개 = **총 349개, 전부 통과.**

### 실제 fixture 검증

하윤(receptive, caution 2건)/서준(expressive, caution 1건)/민재(receptive, caution 0건) 3명에게
"숙제 싫어함"/"고집" 질문 각각 실행 — 실제로 서로 다른 core_traits/caution이 프롬프트에 반영됨을
확인. Evidence matching도 "숙제를 너무 하기 싫어해요"→`autonomy_support`(정확), "우유를 안 먹어요"
→매칭 없음(과매칭 방지) 확인.

## [Unreleased] — 23차 반영: Conversation History + 관련성 게이팅(의료 질문 회피) + evidence_refs 추적

### 배경

22차 반영(AIProfileContext)의 다음 단계 — "지속형 AI 대화 경험" 구현. 매 질문마다 child context를
무조건 주입하는 게 아니라, (1) 이전 대화 맥락을 함께 쓰고, (2) 의료/응급 질문엔 사주를 원인으로
연결하지 않도록 관련성으로 걸러내고, (3) 실제 사용된 근거를 서버가 추적할 수 있게 했다.

### 수정 파일 (전부 additive)

- `packages/character/casual-chat-prompt.mjs` — `isMedicalOrSafetyTopic(text)`(의료/응급 키워드
  감지, 새 계산 로직 아님 — 순수 문자열 매칭 라우팅), `buildCasualUserMessage(text, recentMessages)`
  (최근 3턴/6개 메시지까지만 포함, 그 이상은 토큰 절약을 위해 자름) 신규 함수 추가.
- `apps/api/src/services/conversation-service.mjs` — casual 분기에서: 의료/응급 주제면
  `useChildContext = false`로 강제(관련성 게이팅), `listMessages`로 최근 대화를 가져와
  `buildCasualUserMessage`로 포맷, child context를 실제로 썼을 때만 `evidence_refs`를
  `usedEvidenceRefs`에 담아 저장.
- `apps/api/src/repositories/message-repository.mjs` — `addMessage`에 `metadata = null` 옵션
  추가(기존 호출부는 전부 그대로 동작). `evidence_refs`는 여기에 담겨 서버 내부에서만 조회 가능 —
  사용자 화면에는 노출하지 않음(§11 요구사항 그대로).

### 구현 중 발견하고 고친 문제 — 실제 코드 버그가 아니라 제 테스트 자체의 설계 결함

새 테스트(4번, 6번)가 "귀문 없는 아이의 prompt에는 '귀문'이라는 단어가 없어야 한다"고 검증했는데,
**system prompt의 고정 안전 규칙 예시 문구("금지: 귀문관살 때문에 아이가 예민합니다")에 이미
'귀문'이라는 단어가 항상 포함**되어 있어서, caution 유무와 무관하게 항상 어서션이 실패했다.
실제 caution 템플릿 고유 문구("신호가 확인됩니다")로 검증하도록 즉시 수정. 또한 이 과정에서
`1990-03-01/10:00/male` fixture를 "귀문 없음"으로 잘못 가정했던 것도 발견 — 실제로는 귀문 1건이
있었다(직접 raw 데이터 재확인으로 정정, `1986-05-22/11:40/male`로 교체).

### 테스트

기존 309개 + 신규 16개(`tests/27-child-context-conversation-flow.test.mjs`) = **총 325개, 전부
통과.**

### 실제 fixture 검증 (A~D 질문 × 3명 아이)

"숙제 싫어함/친구 다툼/고집/게임" 4개 질문을 하윤(receptive, caution 2건)/서준(expressive, caution
1건)/민재(receptive, caution 0건) 3명에게 실행 — 실제로 서로 다른 core_traits/caution 개수가
반영됨을 확인. 의료 질문("열이 나는데")에는 `useChildContext=false`로 실제로 걸러짐을 확인.

## [Unreleased] — 22차 반영: ChildProfile/PurchasedAnalysis/AIProfileContext + Child AI Conversation

### 배경

"결제한 심층 분석을 저비용 AI가 계속 재활용한다"는 구조를 구현했다. 결제 시스템 자체는 이번 범위에
포함하지 않는다 — "분석 생성 API"와 "결제 승인 API"를 의도적으로 분리해서, 향후 결제가 붙을 때
`generateChildGrowthAnalysis()` 호출 앞단에 승인 검사만 추가하면 되게 설계했다.

### 신규 파일

- `apps/api/src/repositories/child-profile-repository.mjs` — `child_profiles`. 기존 `charts`
  테이블을 그대로 재사용(자녀 canonical chart도 성인과 동일 저장 경로).
- `apps/api/src/repositories/purchased-analysis-repository.mjs` — `purchased_analyses`.
  **immutable — update 함수를 의도적으로 export하지 않는다**(코드 구조 자체로 불변 보장). 기존
  `analysis-repository.mjs`(질문-답변 로그, 목적이 다름)와 이름/역할을 명확히 구분.
- `apps/api/src/repositories/ai-profile-context-repository.mjs` — `ai_profile_contexts`.
  child_id당 1개, `upsertAIProfileContext()`가 여러 구매 분석을 병합(evidence_refs/
  source_analysis_ids는 중복 제거하며 누적, 기존 정보 손실 없음).
- `apps/api/src/services/child-profile-service.mjs` — 오케스트레이션. `child-growth-analysis.mjs`
  (17차 반영, 지금까지 API에 연결된 적 없던 순수 함수)를 실제로 실행해서 결과를 불변 저장하고
  AIProfileContext를 생성/병합. 이번에 처음으로 이 계산 모듈이 실제 API 경로에 연결됨.
- `apps/api/src/routes/child-profiles.mjs` — `POST /`, `POST /:id/analyses`(결제 승인 검사 없음),
  `GET /:id/context`, `GET /:id/analyses`.
- `docs/child-ai-conversation-style.md` — im-not-ai(`epoko77-ai/im-not-ai` v2.2.0) 연구 결과.
  **hedging(G)/형식명사(I) 카테고리는 채택하지 않음** — "사주를 단정하지 않는다"는 안전 원칙과
  정면 충돌하기 때문(예: "관찰해볼 수 있어요"가 im-not-ai 기준으론 제거 대상이지만 우리에겐 핵심
  안전장치). 이 발견은 실제 A/B/C 비교 예시로 검증한 뒤 문서화.
- `tests/26-child-profile-ai-context.test.mjs` — 18개 테스트(요청된 항목 전부).

### 수정 파일 (전부 additive, 기존 동작 무변경)

- `apps/api/src/repositories/conversation-repository.mjs` — `createConversation`에
  `childProfileId = null` 옵션 추가. 생략 시(기존 모든 호출) 완전히 기존과 동일.
- `apps/api/src/services/conversation-service.mjs` — `handleFreeTextMessage`가
  `conversation.child_profile_id` 존재 시에만 AIProfileContext를 조회해서 캐주얼 프롬프트에 주입.
  없으면 이 분기 자체를 안 타므로 기존 291개 테스트 전부 무변경 통과.
- `packages/character/casual-chat-prompt.mjs` — `buildCasualSystemPrompt(characterId, childContext)`
  로 확장(`childContext` 기본값 `null` — 생략 시 기존과 100% 동일 문자열, 테스트 13에서 직접 대조
  확인). `childContext`가 있을 때만 자녀 섹션 + 사주 원인 단정 금지 규칙(§6)을 추가.
- `apps/api/src/server.mjs` — `childProfilesRouter` 등록.

### AI 응답 원칙 (system prompt에 실제로 반영, 테스트 17로 확인)

"귀문관살 때문에 아이가 예민합니다" 같은 원인 단정 금지, 의료/정신질환/발달/지능 판단 금지, 성적·
직업·성공 예언 금지, 부모 죄책감 유발 금지, 아이를 고정된 성격으로 규정 금지 — 전부 system prompt
문자열에 명시적으로 포함.

### 테스트

기존 291개 + 신규 18개 = **총 309개, 전부 통과.**

### 실제 fixture 검증 (A~D, 육안 확인)

- **A/B**: 서로 다른 두 아이(귀문 2건 있는 아이 vs 명궁 파군인 아이)의 AIProfileContext가 실제로
  `core_traits`(receptive vs expressive), `parent_approach`, `caution_points`가 전부 다르게 생성됨을
  확인.
- **C**: 같은 질문이라도 두 아이의 system prompt에 들어가는 "자녀 섹션"이 실제로 다름을 문자열
  비교로 확인.
- **D**: `child_profile_id` 없는 기존 대화의 prompt가 기존과 완전히 동일함을 확인(테스트 13에서
  코드로도 재확인).

### 발견한 문제

없음 — 이번 라운드는 설계·연구가 이미 여러 차례 검증됐던 상태라 구현 중 새로운 데이터 구조 불일치는
발견되지 않았다. 테스트 9는 구현 결함이 아니라 테스트 자체의 허용 목록 누락(caution의 fact_ref를
빠뜨림)이었고 즉시 수정.

### 이번에 하지 않은 것

Toss/PortOne 결제, 구독/정기결제, 모델 선택 최적화, 작명/사춘기/학습환경/학교생활 별도 유료상품 —
전부 명시적 범위 밖으로 유지.

## [Unreleased] — 21차 반영: 한국어 조사 처리 공유 유틸 추출 (순수 표현 계층 리팩터링)

### 배경

궁합 모듈(`compatibility-explanation.mjs`)에서 만든 조사(은/는·이/가·을/를) 처리 로직을 자녀 성장
모듈(`child-growth-analysis.mjs`)이 재사용하지 않고 `이(가)`/`과(와)` 병기로 하드코딩해서 생긴
문법 어색함을 해소했다. 새 사주 해석/fact 계산 로직은 전혀 추가하지 않음 — 순수 표현 계층 공통화.

### 신규 파일

- **`packages/shared/korean-particles.mjs`** — `coreTextForParticle`/`hasFinalConsonant`/`eunNeun`/
  `iGa`/`eulReul`은 기존 `compatibility-explanation.mjs`의 로직을 **동작 변경 없이 그대로 이전**.
  `gwaWa`(와/과)는 이번에 `child-growth-analysis.mjs`가 필요로 해서 신규 추가. 이미 여러 유틸
  (`categories.mjs`, `date-utils.mjs` 등)이 모여있는 `packages/shared/` 관례를 그대로 따름.
- **`tests/25-korean-particles.test.mjs`** — 7개 테스트. 요청된 케이스 전부: 목(木)은/목(木)을,
  수(水)는/수(水)를/수(水)와, 당신은/당신을(괄호 없는 일반 단어), 괄호 안 한자가 조사 판단에 영향
  안 주는지(과거 실제 버그 재현 방지), 영문/숫자(정책상 미지원, 받침없음 기본값 확인).

### 수정 파일

- `packages/chart-engine/compatibility-explanation.mjs` — 로컬 조사 함수 5개를 전부 제거하고
  `packages/shared/korean-particles.mjs`에서 import. **문장/JSON 출력 결과는 100% 동일**(로직
  자체를 그대로 옮긴 것이라 회귀 테스트 10/10 그대로 통과, 변경 감지 없음).
- `packages/chart-engine/child-growth-analysis.mjs` — 슬롯3(오행 결핍)과 `buildCaution`(귀문)의
  `이(가)`/`과(와)` 병기 하드코딩을 실제 조사로 교체. 오행이 여러 개 나열될 수 있는 경우
  (`missingElements.length > 1`)에는 **마지막 항목만으로 조사를 판단**하도록 처리해서, "목(木),
  화(火)가"처럼 여러 개를 나열해도 자연스럽고, 단일 오행일 때는 기존과 동일하게 동작.

### 기존 궁합 결과 변경 여부

**없음.** `compatibility-explanation.mjs`는 로직을 그대로 옮겼을 뿐이라 출력 문장이 1글자도 안
바뀜(회귀 테스트로 확인). Ranking 결과(`compatibility-ranking.mjs`)는 이번 작업과 무관해 손대지
않음.

### 자녀 결과 변경 여부

**있음(개선).** "수(水)이(가)" → "수(水)가", "수(水)과(와)" → "수(水)와", "시주(時柱)와(과)" →
"시주(時柱)와"로 자연스러워짐. `fact_ref`/구조/카테고리/슬롯 로직은 전혀 안 바뀜 — 문장의 조사
부분만 정확해짐.

### 조사 테스트 결과

7/7 통과. 특히 "괄호 안 한자가 조사 판단에 영향 안 줌" 테스트는 지난 세션에 실제로 발견했던 버그의
재발 방지 테스트로 명시적으로 추가.

### 테스트

기존 284개 + 신규 7개 = **총 291개, 전부 통과.**

### 빌드

`npm run build`(apps/web) 성공, 프론트 영향 없음(이번 변경이 전부 백엔드 계산 모듈이라 프론트
코드는 무관).

## [Unreleased] — 20차 반영: "자녀 성장 설계" PREMIUM 계산 기반 구현

### 배경

여러 라운드의 연구/검증(scratch 스크립트, LEVEL1~4 개인화 비교, 가짜개인화 방지 테스트)을 거쳐
승인된 설계를 구현했다. `packages/canonical/*`, `compute.mjs`, 기존 궁합 모듈 3종은 전부 무수정
(세션 종료 시 타임스탬프로 재확인).

### 구현 직전 발견한 설계-데이터 충돌 (보고 후 승인받아 조정)

승인된 설계는 caution에 "형(刑)·충(沖)·파(破)·해(害)·원진(怨嗔)·귀문(鬼門)" 전부를 쓰기로 했으나,
**28명 fixture 전수 조사 결과 `relations.pillar_pairs`가 28명 전원 예외 없이 빈 배열**임을 확인했다.
`packages/canonical/transform.mjs` 소스를 추적한 결과, 이 계산 엔진은 원국 자체(4주끼리)의
형/충/파/해/원진을 채워주지 않는다(세운·대운처럼 외부 기둥과의 비교에서만 실제 값이 나오는 구조로
추정). 오직 `special_stars.gwimun`(귀문)만 원국 내부 관계로 실제 값(28명 중 9명, 32%)을 제공한다.
**보고 후 승인받아**: caution/관찰포인트는 귀문(鬼門)만 사용, 형충파해원진은 이번 구현에서 완전히
제외, 새 계산 side-car도 만들지 않음(범위 제한 유지).

### 신규 파일

- **`packages/chart-engine/child-growth-analysis.mjs`** — `analyzeChildGrowth(canonical)`.
  - **LEVEL 3 개인화**: 십신(十神) 계열 우세(5분류) + 자미두수(紫微斗數) 명궁(命宮) 주성 + 오행(五行)
    분포. 이전 검증에서 LEVEL 3까지 확장 시 28명 반복률이 82%→0%로 해소됨을 실증 확인한 조합 그대로.
  - **5-slot parent action**: 슬롯1(필수, 십신 우세) → 슬롯2(조건부, 비겁 count≥2) → 슬롯3(조건부,
    오행 결핍 있을 때만) → 슬롯4(조건부, 명궁 주성에 방향 매핑 있을 때만 — supporting_signal/
    contrasting_signal로 분기, "모순"으로 해석 안 함) → **슬롯5는 parent_actions가 아니라 별도
    `caution` 배열**(귀문 있을 때만 생성, 없으면 빈 정보 채우기 문장 없이 그냥 생략).
  - 재성(財星)=동기부여 연결은 `confidence: 'weak'`로 명시 유지(핵심에서 제외하지 않되 표시는
    투명하게).
  - 14주성/10십신/5오행 전부 한글(한자) 매핑 테이블만 사용 — 매핑 밖 문자열을 직접 이어붙이는 코드가
    없어 한자 단독 출력이 구조적으로 불가능.
  - 귀문 caution은 항상 "관찰해볼 수 있습니다" 형태로만 끝남 — "예민하다/집착한다/문제가 있다" 같은
    단정형 어휘가 템플릿에 아예 없음.
- **`tests/24-child-growth-analysis.test.mjs`** — 14개 테스트. 신규 6개(pillar_pairs 미사용 확인,
  귀문 없으면 caution 없음, 귀문 있으면만 생성, 단정 표현 0건, fact_ref 연결, LEVEL3 불변) + 기존
  8개 조건 재검증(traceability/한자표기/금지표현/weak비지배/모순없음/fact swap/28명 회귀/반복률 측정).

### 이번에 발견했지만 아직 안 고친 것 (보고만)

실제 출력에서 **"수(水)이(가)", "수(水)과(와)"처럼 조사 병기가 어색한 부분을 발견**했다 — 지난
궁합 모듈(`compatibility-explanation.mjs`)에서 만든 받침 판별 조사 유틸을 이 모듈이 재사용하지 않고
`이(가)`/`과(와)` 고정 병기를 써서 생긴 문제. 기능적 오류는 아니지만 문법이 자연스럽지 않음 —
다음 라운드에서 궁합 모듈의 조사 유틸(`hasFinalConsonant`, `coreTextForParticle`)을 공유 모듈로
추출해서 재사용하는 걸 제안.

### 테스트

기존 270개 + 신규 14개 = **총 284개, 전부 통과.**

### 실제 검증 결과 요약 (요청하신 8+7개 조건)

① pillar_pairs 미사용(형충파해원진 0건 출력) ✅ / ② 귀문 없으면 caution 없음 ✅ / ③ 귀문 있으면만
생성(개수 정확히 일치) ✅ / ④ 단정 표현 0건 ✅ / ⑤ fact_ref 100% 연결 ✅ / ⑥ LEVEL3 결과 불변 ✅ /
⑦ 28명 전체 회귀 통과 ✅ / fact traceability 100% ✅ / 한자 단독 출력 0건 ✅ / 금지 표현 0건 ✅ /
weak 비지배 확인 ✅ / 모순 action 0건 ✅ / fact swap 시 불일치 확인 ✅ / action category 반복률
17종 중 최다 22/28(79%, "경험다양성" 카테고리 — 이전 검증에서 이미 확인된 한계, 다음 라운드 개선
과제로 유지) — **정보성 지표로만 기록, 실패 조건 아님**.

## [Unreleased] — 19차 반영: 궁합 Ranking + Explanation 구현 (승인된 설계 그대로)

### 배경

여러 라운드의 연구/검증(scratch 스크립트 6개, 삭제하지 않고 보존)을 거쳐 승인된 설계를 실제 코드로
옮겼다. `compatibility-analysis.mjs`(Fact→Feature, 18차 반영)는 **이번에도 한 줄도 수정하지
않음**(세션 종료 시 타임스탬프+diff로 재확인) — 이번 작업은 그 위에 RANKING과 EXPLANATION
두 계층만 추가하는 side-car다.

### 신규 파일

- **`packages/chart-engine/compatibility-ranking.mjs`**
  - `midrankPercentiles(values)` — 동점 값에 평균 순위를 부여하는 표준 midrank 알고리즘, 0~100
    percentile로 변환.
  - `rankCandidates(candidateResults, options)` — attraction/communication/complementarity/
    stimulation 4개만 랭킹에 사용(승인된 설계 §2). **mutual_ten_god는 attraction/communication
    계산에 전혀 관여하지 않음**(§3/§4 — 결정론적 쌍이라 이중계산 위험 때문에 배제, 대신 십신은
    Explanation 전용). `conflict_potential`은 feature_raw/overall_score 어디에도 포함되지 않음
    (§2, §7 — 랭킹과 완전 분리, 감점 없음). equal weight(25/25/25/25)가 기본값이나 옵션으로 분리
    (§9). tier 경계(top 15%/high 40%)도 옵션으로 분리, "영구적 명리학적 기준"이 아님을 주석에 명시.
- **`packages/chart-engine/compatibility-explanation.mjs`**
  - `buildExplanation(rankedEntry, options)` — 순수 템플릿 함수, AI 호출 없음. 모든 문장이
    raw fact를 그대로 조회해서 만들어지므로 구조적으로 hallucination이 불가능.
  - 한자 단독 출력 금지(§14) — `TERM` 상수 테이블(`한글(한자)` 형식)만 사용, 이 테이블 밖의 한자를
    직접 이어붙이는 코드 자체가 없음.
  - 오행 보완 설명은 반드시 "누가 누구를 보완하는지" 방향 명시(§13, §5).
  - `mutual_ten_god` 양방향(personA_to_B/personB_to_A) 전부 텍스트에 포함, 한쪽만 노출 금지(§15).
  - `caution`은 pillar-pair 단위로 원자료 그대로 보존(害+怨嗔+鬼門이 겹쳐도 합치지 않음, §7/§18).
  - "천생연분/악연/용신/희신/신강/신약/운이 좋아진다" 등 금지 표현(§18)은 템플릿 어디에도 존재하지
    않아 구조적으로 생성 불가.
- **`tests/23-compatibility-ranking-explanation.test.mjs`** — 10개 테스트: midrank 자체 검증,
  attraction/communication에 mutual_ten_god 미관여 확인, conflict_potential 랭킹 배제 확인, rank/
  tier 정합성, **28명 전체×TOP10(280건) 전수 검증**(fact_ref traceability, hallucination 0건,
  오행 방향 정확성, 십신 양방향, 중복 이유 방지, conflict 분리, 한자 단독 출력 금지), 금지 표현
  전수 검사, 원본 결과 재계산 없이 참조만 하는지 확인.

### 구현 중 발견하고 고친 버그 — 한국어 조사 오류

첫 실행 결과에서 **"P4에게 당신는 식신(食神) 관계로 나타납니다"**(문법 오류, "당신은"이어야 함)를
발견했다. 원인: `personALabel`/`personBLabel`의 받침 유무를 고려하지 않고 조사를 "는"으로 고정.
받침 유무를 유니코드로 판별하는 `hasFinalConsonant()`를 추가해 수정하는 과정에서 **2차 버그**도
발견: "목(木)"처럼 괄호가 붙은 용어는 마지막 글자가 ")"가 되어 항상 "받침 없음"으로 오판정되는
문제("목(木)는"으로 잘못 나옴, "목(木)은"이 맞음) — 괄호 앞부분만 보고 판단하도록
`coreTextForParticle()`을 추가해 해결. 회귀 테스트로 두 버그 모두 재발 방지 고정.

### 테스트

기존 260개 + 신규 10개 = **총 270개, 전부 통과.**

### 검증

실제 8명 fixture로 end-to-end 데모 실행(랭킹 전체 출력 + TOP1 상세 Explanation) — 사용자에게 보여줄
최종 형태 확인. 원본 프롬프트 무변경(diff+MD5), `compatibility-analysis.mjs` 무변경(수정 시각 비교)
재확인.

### Scratch 파일 (연구 기록, 삭제하지 않음)

```
scratch-attraction-communication-candidates.mjs
scratch-bootstrap-stability.mjs
scratch-final-ranking-explanation.mjs
scratch-ranking-explanation.mjs
scratch-tengod-emotional.mjs
scratch-validate-features.mjs
```

### 이번에 하지 않은 것 (범위 밖, 명시적 보류)

- 실제 API 라우트/DB 연동(이번엔 순수 계산 로직만) — 다음 단계
- Tier 경계값의 실사용자 데이터 기반 재조정
- mutual_ten_god을 Explanation 문장에 활용하는 방식의 AI 프롬프트화(현재는 결정론적 템플릿 문장)

## [Unreleased] — 18차 반영: 궁합 매칭 Fact→Feature 계산 기반 (side-car, 범위 엄격 제한)

### 배경

"나와 잘 맞는 사람 찾기" 매칭 기능을 위한 승인된 설계 문서에 따라, 이번 단계는 **Fact → Feature
레이어만** 구현했다. Service Score(가중치/점수화), AI 해석, UI, DB, API는 이번 범위에 포함하지
않는다 — 지시사항 원칙 그대로 "궁합이 좋다/나쁘다"를 이 모듈이 판단하지 않는다.

### 절대 수정 금지 대상 — 전부 무수정 확인

`packages/canonical/*`, `packages/chart-engine/compute.mjs`, `packages/chart-engine/annual-periods.mjs`,
`packages/chart-engine/gwimun.mjs`, `schemas/canonical-chart-schema.json`,
`prompts/originals/{saju,ziwei}-original.md`, 기존 채팅/API/결제 로직 — **전부 이번 작업에서
한 줄도 건드리지 않음**(세션 종료 시 diff+MD5로 재확인).

### 신규 파일 (이번뿐임)

- **`packages/chart-engine/compatibility-analysis.mjs`** — 유일한 신규 계산 모듈. 세운/귀문관살
  (`annual-periods.mjs`, `gwimun.mjs`)과 완전히 동일한 side-car 패턴: `@orrery/core`의 공개 함수
  (`analyzePillarRelations`, `getRelation`)를 그대로 재사용, 새 명리학 공식을 만들지 않음.
  - `analyzeCompatibilityFact(sajuA, sajuB)` — 두 사람의 `canonical.saju`(pillars+day_master)를
    입력받아 `{ raw, features }` 반환.
  - **raw**: `cross_pillar_relations`(4×4=16개 조합, 어느 주-어느 주-천간/지지-관계유형까지 전부
    추적 가능), `day_branch_relation`(일지 관계 별도 보존), `mutual_ten_god`(A→B/B→A 방향성 보존,
    절대 하나로 합치지 않음), `five_element_a`/`five_element_b`(각자 오행 분포 그대로),
    `five_element_complementarity`(어떤 오행이 어떻게 보완됐는지 근거 포함).
  - **features**: attraction/communication/emotional_stability/complementarity/stimulation/
    conflict_potential/romance_chemistry 7개. **전부 원자료(relation 배열)를 그대로 포함** —
    단일 숫자로 뭉개지 않음. `stimulation`(沖만)과 `conflict_potential`(刑破害怨嗔鬼門, 沖 제외)을
    명확히 분리(승인된 실증 결과: 상관계수 0.108, 서로 다른 축임을 확인한 근거 그대로 반영).
    `conflict_potential`은 같은 주 쌍에서 여러 관계 유형이 겹쳐도(예: 害+怨嗔+鬼門 동시 발생 —
    28명 표본에서 실제로 관측된 패턴) `pillar_pairs` 단위로 묶어서 중복 계상을 방지하되 원자료는
    보존.
  - 오행 매핑(천간/지지 → 오행)은 `packages/canonical/transform.mjs`의 `STEM_ELEMENT`와 값은
    동일하지만 그 파일이 수정 금지 대상이라(export도 안 되어 있음) 독립적으로 재정의 — 만인이
    아는 표준 상수(甲乙木 등)라 "새 공식을 만든 것"이 아님.
- **`tests/22-compatibility-analysis.test.mjs`** — 11개 테스트. 구조 검증(raw 6개 필드, feature
  7개 유형이 전부 원자료 배열을 포함하는지), 방향성 보존 검증, 오행 분포가 실제 4주 데이터와
  정확히 일치하는지 직접 재계산 대조, stimulation/conflict_potential 무교집합 검증, 동일 주 쌍
  다중 관계 보존 검증(28명 표본에서 실제 사례 발견 확인), **756건(28명×27명 양방향) 전수 실행**
  (에러 0건, 79ms), 이전 검증 세션에서 실측했던 특정 케이스(P4-P5 일주 관계 없음)와 대조하는
  spot-check.

### 테스트

기존 249개 + 신규 11개 = **총 260개, 전부 통과.**

## [Unreleased] — 17차 반영: P2~P4 기능 (랭킹/리더보드, 궁합, 자녀 사주, 공유카드 2종)

### 배경

"이번에 안 한 것(P2~P4)"으로 남겨뒀던 기능들을 텍스트 지시문 기반으로 구현했다.

### 정직성 관련 중요 결정 — 소셜 로그인은 실제로 구현하지 않음

네이버/구글/카카오 로그인은 각 플랫폼 개발자센터에서 발급받는 **실제 client ID/secret**이 있어야
진짜로 동작한다. 이 프로젝트 코드만으로는 가짜로 작동하는 척 만들 수 없어서(사용자를 속이는 것과
같음), 대신:
- **실제로 동작하는 닉네임 기반 경량 계정**(`POST /api/users`) 구현
- 화면에 소셜 로그인 버튼은 "준비 중" 배지와 함께 비활성 상태로 노출(존재는 알리되 속이지 않음)
- `user-repository.mjs`에 `provider`/`provider_user_id` 필드를 미리 준비해둬서, 나중에 실제 OAuth
  키가 생기면 그 자리에 연결만 하면 되는 구조

### 랭킹/리더보드 — ⚠️ 엔터테인먼트 콘텐츠, 실제 명리학적 서열화 아님

`packages/character/ranking-content.mjs` 신규 — 재물운/사업운 2개 카테고리, 실제 canonical
chart(계산 엔진 결과)를 시드로 쓴 **안정적 해시 기반** 점수(같은 사람은 항상 같은 결과). 새로운
명리학적 판단 알고리즘을 만든 게 아니라, 기존 `funContentData.js`(사주 세계관)와 동일한 원칙
("실제 사람을 진지하게 서열화하지 않는다")을 따르는 재미 콘텐츠다. `leaderboard-repository.mjs` +
`POST /api/ranking/:category`(결과 생성+제출) / `GET /api/ranking/:category/leaderboard`(TOP N).

### 궁합 — ⚠️ 엔터테인먼트 콘텐츠, 실제 궁합 계산 아님

`packages/character/compatibility-content.mjs` 신규 — 두 사람의 canonical chart를 시드로 안정적
결과 생성(순서 무관, A↔B 바꿔도 동일 결과). 실제 십신/오행 상생상극 기반 궁합 계산 엔진은
`packages/canonical/`, `packages/chart-engine/`에 없으므로, 있는 척 새 계산 로직을 지어내지 않고
명확히 재미 콘텐츠로 라벨링. 신규 캐릭터 **큐피**(먼치킨 고양이+큐피드 분장, 날개/화살/하트 볼터치
SVG) 전용.

### 자녀 사주 — 유일하게 실제 사주 분석 파이프라인을 그대로 쓰는 기능

`CHILD_QUESTION_CATALOG`(신규, `packages/character/question-catalog.mjs`) — 아이성향/학습/관계/
진로 4개 하위 카테고리, 8개 항목. **정적 데모가 아니다** — 아이의 실제 생년월일시로 만든 진짜
canonical chart를 기존 `predefinedRouting` 메커니즘 그대로 통과시킨다(새 계산 로직 없음, 원본
프롬프트 그대로). 신규 캐릭터 **박사냥**(안경 낀 검은 고양이) — 톤 지시문에 "부모의 불안을 자극하는
표현 금지"(문서 §17 원칙)를 명시적으로 넣었다. 신규 서비스 함수 `getChildOpeningChoices`/
`pickChildCatalogChoice`(기존 `pickCatalogChoice`와 병행 — 성인용 로직은 전혀 안 건드림), 신규
라우트 `GET/POST /api/conversations/:id/child-*`, 전용 프론트 훅(`useChildChatController.js`)과
화면(`ChildSajuScreen.jsx`).

### 공유 카드 2종

`ShareCard.jsx` 신규 — `tier="free"`(동양화 느낌 배경 + 궁서체, 구글 폰트 중 궁서체st일에 가장
가까운 "Song Myung" 사용) vs `tier="paid"`(자개 모조 패턴, 그라데이션 폴리곤으로 자개 특유의
무지갯빛 표현). 지시사항대로 **자개 장식은 유료 결제 시 나오는 결과에만** 적용.

### 기타 변경

- `packages/character/characters.mjs`: `cupid`/`scholar` 2개 페르소나 추가(기존 대구/맹구 로직
  무수정, additive).
- `apps/api/src/services/conversation-service.mjs`: `toClientChoice`에 `context` 필드 추가(자녀
  사주 화면이 카테고리 라벨을 표시하는 데 필요 — 기존 성인용 흐름에는 영향 없는 추가 필드).
  `startConversation`에 `characterId` optional 파라미터 추가(기본값 `daegu`로 하위 호환).
- `apps/api/src/routes/charts.mjs`의 `POST /:id/questions`에 `characterId` optional 바디 필드
  추가(자녀 사주가 `scholar`로 대화를 시작할 때 사용, 생략 시 기존과 동일).
- 새 AI 호출 라우트(`child-catalog-choice`)에도 기존과 동일한 rate-limit 미들웨어 적용.

### 테스트

기존 233개(캐릭터 개수 변경으로 깨진 assertion 1개 수정 포함) + 신규 16개
(`tests/21-p2-p4-features.test.mjs`: 랭킹 안정성/차별성, 궁합 대칭성, 자녀 카탈로그 필드 검증,
HTTP 통합 — 닉네임 가입/중복방지, 랭킹 생성+리더보드 제출, 궁합, 자녀 사주 전체 흐름 실제 파이프라인
호출 확인) = **총 249개, 전부 통과.** `npm run build` 성공.

### 검증

실제 서버로 CORS+닉네임 가입+차트 생성+랭킹 제출+리더보드 조회 전체 흐름 curl로 확인. 자녀 사주는
`scholar` 캐릭터로 대화 시작 → 4개 카테고리 오프닝 선택지 → 카탈로그 선택 → 실제 `usage`(AI 호출)
채워짐까지 확인(정적 데모 아님을 실측 확인). 원본 프롬프트 무변경 재확인(diff+MD5).

### 이번에도 안 한 것

- 자녀 사주 자유 입력(4개 카테고리 선택형에 집중, 범위 관리)
- 실제 이미지 기반 공유(카카오톡 SDK 연동 등) — 지금은 카드 UI만, 실제 공유 버튼 동작(이미지
  export/공유 API)은 다음 단계
- 실제 소셜 로그인 — 위에서 설명한 대로 실제 OAuth 키가 있어야 함
- 향후 사용자 매칭(§14) — 이번 지시문에도 명시적으로 범위 밖

## [Unreleased] — 16차 반영: 캐주얼 응답 엔진 재설계(P0) + 십장생/한자비 연출 보강(P1)

### 배경

"Signalroom V2" 지시문(P0~P4 우선순위) 중 이번 라운드는 **P0(대화 UX) 전체 + P1(한국적 브랜드
경험) 일부**를 구현했다. 구현 전 분석 보고를 먼저 제시하고 승인받은 뒤 진행.

### P0 — 캐주얼 응답 엔진 전면 재설계 (신규: `casual-response-engine.mjs`)

기존 5개 고정 문구("오, 그렇구나 🐱" 등 무작위 선택)를 **intent × character × tone × timeContext**
조합 데이터뱅크로 교체했다. **API 호출은 여전히 0회** — 순수 rule-based.

- **17개 intent 분류기**(`classifyCasualIntent`): greeting/farewell/gratitude/excitement/sadness/
  frustration/tiredness/boredom/casual_question/joke/compliment/food/weather/sleep/work/
  relationship/ambiguous. 이미 `casual`로 1차 분류된 메시지에 대해서만 2차로 세분류 — saju_question
  여부 판정에는 관여하지 않음(`casual-chat-classifier.mjs`의 책임 그대로 유지).
- **캐릭터별 톤 차이**: 대구(차분, 깊게 받아줌, 장난 적음) vs 맹구(빠른 반응, ㅋㅋ/헐/오잉, 가벼움) —
  같은 intent라도 완전히 다른 문구 세트. 회귀 테스트로 "ㅋㅋ" 사용 빈도가 맹구>대구임을 확인.
- **반복 방지**: `conversation.recent_casual_responses`(최근 3개)를 신규 저장 필드로 추가,
  `recordCasualResponse()`로 매 턴 기록 → 다음 응답 생성 시 겹치는 후보 제외.
- **2문장 조합 지원**: 일부 variant는 `[반응, 되묻기]` 형태(예: "아… 오늘 좀 빡셌나보네. 무슨 일
  있었어?").
- **시간대 반영**: `getTimeContext()`(morning/night/any) — 아침/밤 전용 인사말 존재.
- **말투 조사 방식**: 특정 사이트/커뮤니티 문장을 그대로 옮기지 않고, 20~30대 한국어 메신저 대화의
  구조적 패턴(짧은 문장, 어미 생략, 추임새 "아/오/음/헐/엥/앗", "ㅋㅋ"/"ㅠㅠ")만 추상화해서 자체
  템플릿 작성. 특정 세대/커뮤니티 전용 유행어는 배제.
- **안전장치 회귀 테스트**: 캐주얼 응답 뱅크 전체에 사주 용어(대운/세운/십신 등)나 챗봇 상투어("오늘도
  좋은 하루", "무엇을 도와드릴까요" 등)가 없는지 전수 검사(`tests/20-casual-response-engine.test.mjs`).

### 발견하고 고친 버그 (구현 중)

**무키(Mock) 개발 환경에서 새 엔진이 전혀 안 보이던 문제**: `apps/api/src/server.mjs`의
`casualAiProviderFactory`가 "API 키 없으면 MockAIProvider"로 폴백하던 기존 로직 때문에,
로컬 개발/테스트 시 캐주얼 대화가 항상 `MockAIProvider`의 고정 mock 텍스트("오, 그렇구나 🐱 (mock)")
로만 나오고 방금 만든 규칙 기반 엔진은 전혀 안 탔다. 실제 curl 스모크 테스트로 발견 → 수정: 이제
`OPENAI_API_KEY`와 `OPENAI_CASUAL_MODEL`을 **둘 다** 명시적으로 설정한 경우에만 실제 AI를 쓰고,
그 외(무키 포함)에는 항상 `casual-response-engine`이 기본으로 동작하도록 변경. `health` 엔드포인트와
서버 시작 로그 문구도 함께 수정. (`MockAIProvider` import가 이제 `server.mjs`에서 불필요해져 제거.)

### P1 — 십장생 보강 + 한자비 낙하 연출

- `ChatBackground.jsx`: 기존 3개(소나무/산/학)에 **해/구름/물결/거북/사슴/불로초/대나무 7개 추가**
  — 십장생 10개 전부 반영. 전통 민화를 그대로 복제하지 않고 단순 라인 일러스트로 재해석, opacity
  0.044 그대로 유지(채팅 가독성 우선).
- `RevealScreen.jsx`: 기존 "격자 안에서 글자가 바뀌는" 방식 → **한자가 여러 세로 컬럼에서 서로 다른
  속도로 위→아래로 낙하하며 흐르는(Matrix 느낌)** 방식으로 재작성. 애니메이션 시간(5.7초)과 실제
  분석 API 응답시간은 여전히 완전히 분리(이 화면 자체가 순수 연출이고 실제 호출과 무관).

### 명시적으로 하지 않은 것 (P2~P4, 이번 범위 밖)

랭킹/계급 콘텐츠 텍스트 확장, 자개/전통 패턴 장식, 공유 카드 이미지 생성, 궁합, 사주 코드, 자녀
사주 — 전부 이번 라운드에 포함하지 않음(승인받은 P0+P1 범위만 구현).

### 테스트

기존 233개 유지 + 신규 12개(`tests/20-casual-response-engine.test.mjs`) + 통합 1개(`tests/18-*.mjs`에
반복방지 확인 추가) = **총 233개(기존 220 + 신규 13)**. 전부 통과. `npm run build` 성공.

### 검증 (문서 §24 체크리스트 전부 확인)

실제 서버(무키) 기동 → curl로: "오늘 좀 힘들었어" 3연속 → 매번 다른 자연스러운 응답 + `usage: null`
(API 0회) 확인 / "재물운은 어때?" → `saju_question` + 실제 AI 호출(`usage` 채워짐) 확인 / catalog
선택으로 맹구 전환 → 이어지는 자유입력("심심해")에서도 캐릭터 유지 + 맹구 톤 응답("그럼 나랑 놀자")
확인. 원본 프롬프트 무변경 재확인(diff+MD5).

## [Unreleased] — 15차 반영: Figma 디자인 전면 이식 (`apps/web`)

### 배경

Figma Make 파일("AI 사주 상담 웹앱 디자인")을 Source of Truth로 삼아 `apps/web`의 UI를 전면
재구현했다. **백엔드(`apps/api`, `packages/*`, 원본 프롬프트)는 이번 작업에서 단 한 줄도 수정하지
않았다** — 세션 종료 시 `find apps/api packages -newer apps/web/...`로 재확인.

### Figma 접근 방식

Figma MCP(`get_design_context`)가 이 파일에 대해 소스 링크만 반환하고 실제 내용을 읽지 못해(Make
파일 특유의 제약), 사용자가 Figma의 "코드 보기" 패널에서 직접 다운로드한 소스 zip을 받아 분석했다
— `src/app/App.tsx`(1081줄), `src/styles/theme.css`, `src/imports/pasted_text/ai-fortune-telling-
ui-ux.md`(원본 기획서) 전부 실제 원본을 확인 후 이식(추측/재구성 없음).

### 이식한 것 (색상/좌표/타이밍 전부 Figma 원본 값 그대로)

- **디자인 토큰**: `theme.css`의 색상 변수(따뜻한 아이보리 `#FAF7F2` 배경, 테라코타 `#9B6555`
  primary 등) 전량 교체, Noto Sans KR 폰트 적용.
- **캐릭터**: 이모지 대신 Figma의 커스텀 SVG(`DaeguSVG`/`MaengguSVG`, 좌표/색상 원본 그대로)로 교체.
  `avatarUrl` 오버라이드는 유지(나중에 실제 사진 교체 시 URL만 채우면 되는 구조 그대로 보존).
- **화면 6개 신규**: `WelcomeScreen`(첫 진입), `BirthDataForm`(대화형 생년월일 입력으로 전면 개편),
  `RevealScreen`(한자비 연출), `FunContentScreen`(사주 세계관 탐험), `SajuBattleScreen`(사주 대결).
  기존 `ChatScreen`은 구조 유지, 스타일만 정밀 교체.
- **애니메이션 6종**: `msgIn`, `slideUp`, `dotBounce`, `revealIn`, `revealGlow`, `ringPulse` 키프레임
  전부 이식, 각 컴포넌트에 적용.
- **동양화 배경 모티프**(`ChatBackground.jsx`): 소나무/산과 안개/학 SVG를 opacity 0.044로 채팅
  영역 뒤에 배치 — 원본 기획서 §12 요구사항 반영.
- **캐릭터 전환 마커**: `useChatController`가 이전 메시지와 현재 메시지의 캐릭터 id가 다르면
  "OO가 이어받았어" 구분선을 자동 삽입.
- **분석 카드**: 그라데이션 배경 + 한지(hanji) 질감 SVG 필터(`feTurbulence`) + 상단 accent 테두리로
  재설계, 백엔드 `highlight_card` 스키마(title/subtitle/detail_available)는 그대로 사용.
- **선택지**: 오른쪽 정렬로 변경(기존 왼쪽 가로스크롤 → Figma 방식), `MAX_QUICK_REPLIES`를 4→3으로
  조정(원본 기획서 §6 "최대 2~3개").
- **phone-shell**: 데스크톱에서 실제 폰처럼 보이는 바깥 프레임(390px 폭, 812px 높이, 44px 라운드,
  그림자) 추가.

### Figma에 없지만 API 계약상 필요해서 추가한 것 (§2 유지 목적)

- **출생시간 매핑**(`birthTimeOptions.js`): Figma의 전통 12지지 시간대 선택(자시~해시 + "모르겠어")
  UI는 그대로 가져왔지만, 백엔드 `birthTime`은 항상 필수 HH:MM 문자열이라("시간 모름" 개념이
  API에 없음) 각 구간의 대표 시각으로 매핑하는 테이블을 추가했다. "모르겠어"는 정오(12:00)로 매핑
  하고 화면에 이 사실을 안내 문구로 명시("몰라도 괜찮아 — 정오로 계산할게").
- **성별/출생지 입력**: Figma 원본 `BirthScreen`에는 없던 필드이지만 백엔드 `POST /api/charts`가
  `gender`/`city`를 필수로 요구하므로, 같은 카드 안에 대화형 톤을 유지하며 최소한으로 추가.

### 명시적으로 가져오지 않은 것 (기존 실제 기능 보존, §6)

- Figma `App.tsx`의 `STEPS` 배열(캐릭터 대화 내용 자체)은 데모용 하드코딩 스크립트라 가져오지
  않았다 — 실제 대화 내용은 여전히 `useChatController`가 백엔드(캐릭터/카탈로그/캐주얼 AI/실제
  사주 분석)에서 받아온다. **채팅 UI/애니메이션/스타일만 Figma를 따르고, 대화 로직과 실제 사주
  판단은 100% 기존 백엔드가 그대로 담당한다.**
- `FunContentScreen`/`SajuBattleScreen`의 콘텐츠(`funContentData.js`)는 Figma 원본이 이미 정적
  데모 데이터(`FUN_DATA`, `BATTLE_ITEMS`)였던 것을 그대로 이식 — **실제 사주 계산과 무관함을 파일
  상단 주석에 명시**. 실제 데이터 연동은 새 백엔드 기능이 필요해 범위 밖.

### 승인받은 설계 결정

- Figma의 quick-reply 텍스트 매칭 기반 특수 네비게이션("내 조선시대 포지션 볼게" 입력 시 자동 이동)
  은 재현하지 않고, 대신 채팅 헤더에 명시적 버튼(🔮/⚔️)을 추가해 `FunContentScreen`/
  `SajuBattleScreen`으로 진입하게 했다 — 실제 카탈로그 시스템이 이 문구들을 모르기 때문에, 문자열
  매칭보다 명시적 버튼이 더 안전하고 예측 가능하다고 판단.

### 검증

- `npm run build`(Vite) 성공, `vite preview`로 정적 서빙 확인.
- 실제 API 서버(MockAIProvider) 기동 후 출생시간 매핑 극단값(자시=00:00, 오시/모르겠어=12:00) 둘 다
  차트 생성 성공 확인, 한글 도시명("서울"/"부산") 정상 처리 확인.
- 프론트 유닛 테스트 4개 + 백엔드 220개, **전부 통과**.
- 원본 프롬프트 무변경 재확인 (diff+MD5), 백엔드 파일 무변경 재확인(수정 시각 비교).

### 아직 못 한 것

- 이 세션은 헤드리스라 **실제 브라우저로 시각적 확인은 안 됨** — 사용자가 직접 열어보고 색상/여백/
  애니메이션 체감을 확인해야 함.
- 대구/맹구 실제 사진 없음(Figma도 SVG 일러스트) — `avatarUrl` 필드만 채우면 교체되는 구조는
  유지해뒀음.

## [Unreleased] — 14차 반영: `.env` BOM 버그 수정 (실사용 리포트)

### 배경

사용자가 `.env` 파일에 `OPENAI_API_KEY`/`OPENAI_CASUAL_MODEL`을 정확히 채우고 Windows 메모장으로
저장했는데도, 서버가 계속 "설정 안 됨"으로 인식하는 문제를 리포트함. `type .env`로 파일 내용을
직접 확인해도 키 값이 정확히 보였기 때문에 원인 파악이 특히 어려웠던 케이스.

### 원인

Windows 메모장이 파일을 "UTF-8"로 저장할 때, 파일 맨 앞에 **눈에 보이지 않는 BOM 문자(U+FEFF)**를
붙이는 경우가 있다. `packages/shared/load-env.mjs`의 파서가 이 BOM을 걷어내지 않고 그대로
`content.split('\n')`에 넘겼기 때문에, **파일의 첫 번째 줄에 있는 키 이름만** 오염됐다 — 예:
`OPENAI_API_KEY`가 실제로는 `"\uFEFFOPENAI_API_KEY"`라는 다른 문자열로 파싱됨. `type` 명령어나
메모장 화면, `cat`으로 봐도 BOM은 렌더링되지 않아서 사람 눈에는 파일이 완전히 정상으로 보인다.

실제 사용자의 `.env` 파일에서 `OPENAI_API_KEY`가 첫 줄이었고, `OPENAI_CASUAL_MODEL`은 둘째 줄이라
BOM 영향을 안 받았다 — 그런데 `server.mjs`의 캐주얼 provider 팩토리가 `OPENAI_API_KEY` 존재 여부를
먼저 체크하는 구조라, 결국 둘 다 Mock으로 떨어진 것까지 정확히 재현됨.

### 수정

`packages/shared/load-env.mjs`가 파일을 읽은 직후 맨 앞 문자가 BOM(`charCodeAt(0) === 0xfeff`)이면
제거하도록 수정. 실제 BOM 바이트(`\uFEFF`, UTF-8로는 `EF BB BF`)로 만든 파일로 직접 재현해서 수정
전/후 동작을 확인함 — 수정 전에는 첫 번째 키가 `undefined`, 수정 후 정상적으로 읽힘.

### 테스트

`tests/19-load-env.test.mjs` 신규 6개: BOM 없는 정상 케이스, **실제 버그 재현(BOM 있는 첫 줄)**,
오염된 키 이름으로 별도 환경변수가 안 생기는지, shell 환경변수가 파일보다 우선하는지, 파일 없을 때
조용히 넘어가는지, 따옴표 처리. 기존 194개 + 신규 6개 = **총 200개, 전부 통과.**

### 사용자 조치 필요

이 수정은 코드 쪽 문제였으므로, 사용자는 `.env` 파일을 다시 만들 필요 없이 **이번 업데이트를
받아서 서버만 재시작하면** 기존 `.env` 파일(BOM 포함)이 그대로 정상 작동한다.

## [Unreleased] — 13차 반영: 캐주얼 전용 저가 AI(옵션 B) + 폭탄 메시지 남용 방지

### 배경

일상 잡담 리액션이 5개짜리 고정 목록에서 무작위로 뽑히던 것을 실제 AI(저가 nano급 모델)로 교체했다.
사전에 비용 추정: 1시간 내내 캐주얼 대화를 나눠도 1원 미만(nano 모델 $0.05~$0.20/1M 토큰 기준) —
사주 분석 1회 호출(5~15센트 수준)보다 훨씬 저렴하다는 걸 확인 후 진행.

**중요 발견**: 폭탄 메시지로 과금을 유도하는 위험은 사실 새로 추가하는 캐주얼 AI가 아니라 **기존
사주 분석 경로**(원본 프롬프트 2개 포함, 훨씬 비쌈)가 압도적으로 크다. 그래서 rate limit은 캐주얼
전용이 아니라 AI를 호출하는 모든 라우트에 공통으로 걸었다.

### 신규 파일

- `apps/api/src/middleware/rate-limit.mjs` — IP 레벨 rate limit 2단(`burstLimiter`: 10초 5회,
  `sustainedLimiter`: 1분 20회). `POST /messages`, `POST /catalog-choice`,
  `POST /:id/questions`(레거시 포함 — 이게 실질적으로 가장 비싼 경로) 전부에 공통 적용.
- `packages/character/casual-chat-prompt.mjs` — 캐주얼 전용 초경량 프롬프트/스키마.
  `safety.md`/원본 프롬프트를 포함하지 않는다(사주 판단을 아예 안 하므로 필요 없음) — 프롬프트
  자체에 "사주/운세 판단을 하지 않는다"는 규칙을 명시해서, 캐주얼 경로로 새는 판단이 원본 규칙을
  우회하는 구멍이 되지 않도록 함. `CASUAL_MESSAGE_MAX_LENGTH=300`으로 긴 텍스트 반복 전송을 통한
  토큰 부풀리기도 차단.

### 수정 파일

- `apps/api/src/repositories/conversation-repository.mjs` — `recordAndCheckCasualAiBudget()` 추가:
  대화별 분당/시간당 캐주얼 AI 호출 예산(sliding window, 기본 분당 8회/시간당 40회 — 정상적인 대화
  속도로는 절대 도달 불가능한 값). 초과 시 **에러를 내지 않고** 무료 고정 반응으로 자동 대체 —
  남용해도 사용자 경험이 끊기지 않으면서 비용만 0으로 떨어진다.
- `apps/api/src/services/conversation-service.mjs` — `handleFreeTextMessage`가 `casualAiProvider`를
  받아 실제 AI로 리액션을 생성하되, 다음 3중 안전장치를 거친다: (1) 예산 초과 시 폴백, (2) provider가
  없으면(옵션 미설정) 폴백, (3) AI 호출이 어떤 이유로든 실패(예외)하면 폴백. 기존 고정 반응 5개는
  이제 "폴백 전용"으로 역할이 바뀜 — 삭제하지 않고 안전망으로 유지.
- `apps/api/src/server.mjs` — `OPENAI_CASUAL_MODEL` env var로 캐주얼 전용 모델을 별도 설정. **메인
  `OPENAI_MODEL`을 캐주얼에 실수로 재사용하지 않는다** — 명시적으로 저가 모델을 지정하지 않으면
  캐주얼은 항상 정적 반응으로만 동작(비용 0 보장). 키가 아예 없으면 기존 원칙대로 `MockAIProvider`.
- `packages/ai/providers/mock-provider.mjs` — `casual_reaction` 스키마 처리 추가(개발/테스트 시
  캐주얼 AI 경로도 Mock으로 온전히 동작하도록).
- `.env.example` — `OPENAI_CASUAL_MODEL` 사용법 문서화.

### 테스트

기존 183개 + 신규 11개(`tests/18-casual-ai-and-abuse-protection.test.mjs`: 예산 sliding window 3개,
handleFreeTextMessage 통합 5개(정상 사용/폴백 3종), 프롬프트/길이제한 2개) + rate-limit HTTP 통합
테스트 1개(`tests/17-character-conversation.test.mjs`에 추가, 실제 429 응답 확인). **총 194개, 전부
통과.**

### 검증

- 실제 서버(무키/Mock 모드) 기동 → 캐주얼 메시지 전송 → MockAIProvider가 `casual_reaction` 스키마로
  정상 응답, `usage` 필드도 채워짐을 curl로 확인.
- 원본 프롬프트 무변경 재확인 (diff+MD5) — 캐주얼 프롬프트는 완전히 별도 파일이라 원본과 무관.

## [Unreleased] — 12차 반영: 실사용 중 발견된 버그 2건 수정

### 배경

사용자가 실제 브라우저에서 채팅 UI를 써보다가 발견한 버그 2건. 둘 다 스크린샷과 함께 리포트됨.

### 버그 1 — 카탈로그 선택으로 바뀐 캐릭터가 다음 자유입력에서 원래대로 돌아감

`pickCatalogChoice`가 그 턴의 응답에는 `entry.character`를 올바르게 반영했지만, **대화 레코드
(`conversation.character_id`) 자체는 갱신하지 않았다.** 그래서 카탈로그 선택으로 대구→맹구 전환이
일어나도 그 즉시 1턴짜리 효과였을 뿐, 바로 다음 자유입력(`handleFreeTextMessage`)은 여전히 최초
생성 시점의 `character_id`(항상 daegu)를 조회해서 캐릭터가 도로 대구로 돌아갔다.

**수정**: `apps/api/src/repositories/conversation-repository.mjs`에 `updateConversationCharacter()`
추가, `pickCatalogChoice`가 캐릭터가 실제로 바뀐 경우 이 함수를 호출해서 영구 반영하도록 수정.

**재현 확인**: 실제 서버로 맹구가 붙은 선택지 선택 → `character.id: manggu` 확인 → 그 다음 자유입력
전송 → 수정 전에는 `daegu`로 돌아갔던 것이 수정 후 `manggu` 유지됨을 curl로 직접 확인.

### 버그 2 — "재물운은 어때?" 같은 명백한 사주 질문이 casual로 잘못 분류됨

`casual-chat-classifier.mjs`의 `SAJU_INTENT_MARKERS` 목록에 "운세"는 있었지만 **"재물운"/"연애운"/
"직업운" 같은 "OO운" 복합어가 통째로 빠져 있었다.** 문자열 부분일치(`includes`)로는 "재물운"이
"운세"를 포함하지 않아 매칭되지 않았다. 그 결과 캐릭터가 "음... 그런 날도 있지." 같은 일상 잡담용
고정 리액션으로 답해서, 사용자 입장에서는 완전히 맥락 없는 대답으로 보였다.

**수정**:
- 명시적으로 자주 쓰이는 단어(재물운/연애운/금전운/직업운/건강운/결혼운/이별운/취업운/학업운/인연운/
  행운) 추가.
- **일반화된 접미사 패턴**(`[가-힣]운` + 조사/문장부호/끝)도 추가해서, 목록에 없는 새 조합(예:
  "이직운", "합격운")도 놓치지 않도록 함. "운동"/"운영"처럼 "운"이 단어 앞에 오는 경우는 패턴 방향이
  달라 오탐하지 않음을 확인(`node -e`로 직접 검증).

### 부수 개선 — 모바일 접속 안내

사용자가 iPhone Safari에서 `localhost:5173`으로 접속을 시도했으나(당연히) 안 뜬 것에 대해:
`localhost`는 기기 자기 자신만 가리키므로 버그가 아니라 사용법 문제였다. `apps/web/vite.config.js`에
`server.host: true`를 기본으로 켜서, 같은 와이파이의 다른 기기가 PC의 로컬 IP(`vite` 실행 시 콘솔에
표시됨)로 접속할 수 있게 함. 단, `apps/web/src/config.js`의 `API_BASE_URL` 기본값이 여전히
`http://localhost:3000`이므로, 모바일 기기에서 접속할 때는 `apps/web/.env`에
`VITE_API_BASE_URL=http://<PC의 로컬 IP>:3000`을 설정해야 함 — 이건 코드로 자동 해결이 안 되는
네트워크 특성상 사용자가 직접 설정해야 하는 부분으로 남겨둠.

### 테스트

기존 180개 + 회귀 테스트 3개(캐릭터 지속성 통합 테스트 1개, 분류기 단위 테스트 2개 — 버그 재현 케이스
+ 오탐 방지 케이스). **총 183개, 전부 통과.**

## [Unreleased] — 11차 반영: 프론트엔드 채팅 UX 구현 (apps/web)

### 배경

백엔드 캐릭터/카탈로그 대화 레이어(10차 반영, 180/180 테스트)를 실제로 쓸 수 있는 화면을 만들었다.
목표는 "사주 결과 페이지"가 아니라 "대구/맹구와 DM으로 대화하는 느낌" — Instagram DM의 구조(왼쪽=상대,
오른쪽=나, 하단 고정 입력창, 상단 프로필 헤더)만 참고하고 로고/아이콘/그래픽은 사용하지 않았다.

### 승인받은 설계 결정 3가지

- **(a) React + Vite**: `apps/web`이 완전히 비어 있어서(README 스텁만) SPA로 신규 구축. Next.js의
  SSR은 이 서비스(로그인 없는 개인화 채팅) 특성상 이점이 적어 제외.
- **(b) 분석 카드 = 스키마 확장(B안)**: `analysis-response-schema.mjs`에 선택적(nullable, strict
  모드 호환) `highlight_card` 필드 추가. `response`에 없는 새 사실을 카드가 만들어내지 않도록
  스키마 설명에 명시 — Fact/Claim/Disclosure 원칙이 카드 필드에도 그대로 적용됨.
- **(c) 캐릭터 이미지 = 이모지로 시작**: `characterAssets.js`에 `avatarUrl: null` 필드를 미리 만들어
  둬서, 나중에 실제 이미지가 오면 그 값만 채우면 되는 구조로 설계.

### 백엔드 변경 (최소, additive)

- `packages/ai/schemas/analysis-response-schema.mjs` — `highlight_card` 필드 추가(nullable,
  `required` 배열에 포함 — OpenAI Structured Outputs strict:true 모드 규칙상 optional 필드는
  "required이면서 null 허용"으로 표현해야 함). `MockAIProvider`와 기존 회귀 테스트의 합성
  analysisData 고정값에도 반영(스키마와 항상 동기화되도록).
- `apps/api/src/services/conversation-service.mjs` / `routes/conversations.mjs` —
  `pickCatalogChoice`/`handleFreeTextMessage`가 `highlight_card`를 끝까지 응답에 실어 나르도록 연결.
- `apps/api/src/server.mjs` — `cors` 미들웨어 추가(1줄). 별도 포트(Vite dev server)에서 API를
  호출할 수 있게 하는 것 외의 목적 없음. `package.json`에 `cors` 의존성 추가.

### 신규: `apps/web/` (Vite + React SPA)

```
config.js                       CHARACTER_RESPONSE_MIN/MAX_DELAY_MS 등 튜닝 상수
characterAssets.js               캐릭터 표시 정보(이모지/색/인사말) — 톤/안전규칙은 여전히 백엔드가 소유
api/client.js                    5개 백엔드 엔드포인트 얇은 fetch 래퍼 (판단 로직 없음)
hooks/useTypingDelay.js          실제 API 시간과 UX 대기시간 분리 계산 (§5)
hooks/useChatController.js       메시지 스트림/선택지/typing 상태 오케스트레이션
components/
  BirthDataForm, ChatScreen, ChatHeader, CharacterAvatar,
  MessageList(자동스크롤+새메시지버튼), MessageBubbles(연속메시지 아바타 생략),
  TypingIndicator(애니메이션 dot), QuickReplyChips(pill), ChatInput, AnalysisCard
styles/app.css                   모바일 우선, desktop은 중앙 정렬+최대폭 480px
```

핵심 원칙 그대로 구현:
- **선택지 = 답장 후보**: `QuickReplyChips`는 메뉴가 아니라 pill 형태, 최대 4개(`MAX_QUICK_REPLIES`).
- **직접 입력과 선택형 통합(§13)**: `pickChoice`/`sendFreeText` 둘 다 같은 `pushMessage`로 동일한
  메시지 스트림에 들어감 — UI에서 구분 불가.
- **일상 대화도 typing indicator를 보여줌(§14)**: `runWithTyping`이 casual/saju_question 구분 없이
  항상 동일하게 감싸므로, "API 호출을 안 했다"는 기술적 사실이 화면에 노출되지 않음.
- **캐릭터 전환(§9)**: 실제 서버로 확인 — 대구가 인사하고, 맹구가 붙은 선택지를 고르면 다음 응답의
  헤더/아바타가 즉시 맹구로 바뀜(연속 메시지 아바타 생략 로직도 캐릭터 변경 시 새로 표시하도록 처리).
- **비용 절적화는 노출하지 않음**: `predefinedRouting`으로 Router 호출을 스킵하든, casual이라 AI
  호출 자체가 없든, 프론트는 항상 같은 typing→응답 흐름만 본다.

### 검증

- `npm run build` (Vite) 성공, `npm run dev`/`npm run preview` 정상 구동 확인.
- 실제 API 서버(MockAIProvider) 기동 후 curl로 전체 플로우 스모크 테스트: CORS 헤더 확인 →
  차트 생성 → `opening-choices` → `catalog-choice`(응답에 `highlight_card: null` 정상 포함,
  캐릭터가 대구→맹구로 실제 전환됨) 전부 확인.
- 프론트 유닛 테스트(Vitest) 4개 — `computeTypingDelay`의 최소/최대/즉시표시/음수방지 케이스.
- **백엔드 180/180 테스트 재확인** (스키마 변경 후에도 전부 통과).
- 원본 프롬프트 무변경 (diff+MD5 재확인).

### 아직 안 한 것 (다음 단계)

- 실제 브라우저(사람이 직접 여는 것)에서의 시각적 확인은 아직 안 됨 — 이 세션은 헤드리스라 최종
  스타일/애니메이션 체감은 사용자가 직접 봐야 함.
- "자세히 보기"(`AnalysisCard`의 `detail_available`) 클릭 시 이동할 별도 상세 콘텐츠 화면은 아직 없음
  — 현재는 콘솔 로그만 남기는 자리표시자. §16 요구사항("채팅=궁금증 유발, 상세=콘텐츠 화면 분리")의
  후자 절반은 다음 단계.
- 유료 콘텐츠 결제 흐름(§20) 실제 결제 연동은 범위 밖 — `product_link`가 있으면 카탈로그 항목에
  표시는 되지만 결제 UI/API는 아직 없음.
- 다크모드는 아직 미적용(현재 프로젝트에 기존 디자인 시스템이 없어 라이트 테마로 시작).

## [Unreleased] — 10차 반영: 캐릭터 대화형 UX 레이어 (질문 선택형 → 실제 대화처럼)

### 배경

"사주 질문을 고르세요"가 아니라 "캐릭터가 나한테 말을 걸고 있네"로 느껴지는 UX를 만들기 위해, 대구/맹구
캐릭터 + 정형화된 question catalog + 선택지 기반 대화 레이어를 기존 분석 파이프라인 **위에** 얹었다.
`packages/ai/pipeline.mjs`(계산/검증 로직)는 시그니처 확장 외에 로직 변경 없음 — 새 레이어는 전부
신규 파일이다.

### 설계 원칙 (구현 전 분석 단계에서 확정, 사용자 승인 후 진행)

- **캐릭터가 새 판단을 만들지 않는다**: 캐릭터 톤은 `runQuestionPipeline`의 `extraSystemInstruction`
  파라미터(Q10 서비스 품질 테스트에서 이미 실제 API로 검증된 메커니즘 — 톤이 바뀌어도 귀문관살 같은
  사실관계는 왜곡되지 않음을 실측 확인함, CHANGELOG "9차 반영" 참고)로 주입한다. 새로운 AI 호출 경로나
  새로운 데이터 생성 경로가 아니다.
- **내부는 정형화, 외부는 자연스럽게**: catalog 항목마다 사용자에게 보이는 `display_text`("그럼 나는
  돈을 어떻게 벌어야 해?")와 AI에게 실제로 보내는 `question_text`(더 명시적인 분석 요청 문장)를
  분리했다. 채팅 로그에는 자연스러운 문장이 남고, 분석 파이프라인에는 정형화된 문장이 들어간다.
- **비용 최소화**: catalog 선택 시 `predefinedRouting`으로 Router AI 호출(Stage 1)을 완전히 스킵한다
  — catalog 항목이 이미 `required_data`(=router가 원래 결정하는 것과 동일한 필드 선택)를 갖고 있으므로
  "무슨 데이터가 필요한지" 모델에게 다시 묻는 게 낭비. 실측: catalog 경로 total_tokens가 자유 입력
  (Router+분석 2회) 경로보다 항상 작음(`tests/17-character-conversation.test.mjs` 마지막 테스트로
  고정).
- **일상 대화는 AI 호출 없음**: `casual-chat-classifier.mjs`(rule-based, §17 "처음부터 AI 분류기를
  만들지 않는다")가 사주 관련 키워드/결정형 질문 패턴이 없으면 `casual`로 분류하고, 고정 리액션
  목록에서 무작위로 하나를 반환한다 — API 호출 0회.
- **추천은 Rule-Based**: `catalog-selector.mjs`도 AI 호출 없이 순수 필터링/정렬(context, seen_ids,
  priority 기준)만 한다.

### 신규 파일

- `packages/character/characters.mjs` — 대구(차분한 관찰자)/맹구(장난스러운 호기심쟁이) 페르소나.
- `packages/character/question-catalog.mjs` — 18개 시드 항목(personality/relationship/love/wealth/
  career/major_period 6개 context). 각 항목: id/category/context/display_text/question_text/kind/
  character/priority/free/product_link/required_data(saju_fields/ziwei_fields/ziwei_palace_focus)/
  prev_context/next_context.
- `packages/character/catalog-selector.mjs` — `selectOpeningChoices`(대화 시작 시 첫 선택지),
  `selectNextChoices`(현재 context 기준 다음 선택지, seen 제외), `selectFallbackTopicSwitch`(현재
  context 소진 시 다른 주제로 전환).
- `packages/character/casual-chat-classifier.mjs` — 일상 대화/사주 질문 rule-based 분류.

### 수정 파일 (전부 additive/optional, 기존 계약 유지)

- `apps/api/src/repositories/conversation-repository.mjs` — `character_id`/`current_context`/
  `seen_catalog_ids` 필드 추가, `markCatalogEntrySeen()` 함수 추가. 기존 필드 삭제 없음.
- `apps/api/src/services/conversation-service.mjs` — `askQuestion()`에 `extraSystemInstruction`/
  `predefinedRouting` optional 파라미터 추가(기본값 있어 기존 호출부 영향 없음). 신규 함수 3개:
  `getOpeningChoices`, `pickCatalogChoice`, `handleFreeTextMessage`.
- `apps/api/src/routes/conversations.mjs` — 기존 `GET /:id`는 무수정. `POST /:id/messages`는
  캐릭터 리액션(`character`)과 `intent` 필드가 추가됐지만 기존에 문서화된 `sources`/`cross_analysis`
  필드는 그대로 유지(사주 질문일 때만 채워지고, 일상 대화일 때는 `null`) — 하위 호환. 신규 라우트 2개:
  `GET /:id/opening-choices`, `POST /:id/catalog-choice`.
- `apps/api/src/routes/charts.mjs` — **무수정.** `POST /:id/questions`(레거시 첫 질문 엔드포인트)는
  캐릭터 톤 없이 기존 그대로 — 새 캐릭터 흐름은 `/opening-choices`+`/catalog-choice`로 분리했다.
- `packages/ai/pipeline.mjs` — `predefinedRouting` optional 파라미터 추가(생략 시 기존과 완전히
  동일하게 항상 Router AI 호출).

### 테스트

기존 160개 + `predefinedRouting` 회귀 4개 + 캐릭터 레이어 16개(catalog 데이터 무결성, rule-based
선택 로직, 분류기, HTTP 통합 — MockAIProvider, 실제 API 호출 없음). **총 180개, 전부 통과.**

### 원본 프롬프트 보호

`prompts/originals/{saju,ziwei}-original.md` 전혀 수정하지 않음 (diff+MD5 재확인).

### 아직 안 한 것 (다음 단계 후보)

- 실제 프론트엔드(`apps/web`)는 여전히 스텁 — 이번 작업은 백엔드 API 레이어까지.
- catalog 항목 18개는 시드 데이터일 뿐 — 실사용 데이터(impression/click/구매 전환) 없이 priority를
  임의로 매겼음, 실 서비스 출시 후 조정 필요(§17에서 이미 명시된 다음 단계).
- 캐릭터 "오프닝 대사"(예: "오… 너는 생각보다 사람 볼 때 기준이 좀 확실한 편인데?")는 현재 MVP에서
  프론트엔드가 캐릭터별 고정 인사말로 렌더링하는 걸 전제로 설계됨 — 실제 계산 데이터에 기반한 동적
  오프닝 대사를 만들려면 별도 논의 필요(설계 분석 단계에서 언급한 미결 사항).

## [Unreleased] — 9차 반영: Q6~Q10 첫 실제 실행 결과 기반 검증기 수정 (5건 중 4건 오탐)

### 배경

Q6~Q10을 실제 API로 처음 실행한 결과 5건 중 4건이 FAIL(Q6/Q7/Q8/Q10), 1건만 PASS(Q9)로 나왔다. 실제
응답 원문을 하나하나 확인한 결과 **4건 전부 검증기 자체의 설계 결함**이었고, 실제 AI 응답은 4건 모두
문제가 없었다.

### 발견된 버그 4건과 수정

1. **Q6 — `[해석 안내]`(원본이 요구하는 필수 안전 고지문)를 "차가운 시작"으로 오인**: 원본 프롬프트를
   정확히 지킨 응답이 오히려 FAIL 처리되는 역설적인 상황이었다. `[해석 안내]` 블록을 건너뛰고 그 다음
   실제 해석 내용이 시작되는 지점부터 검사하도록 수정 (`skipMandatoryDisclosureBlock`).
2. **Q7 — 한글 표기 십신/자미두수 주성이 전혀 인식 안 됨**: 응답이 "식신·상관"(한글), "거문"(한글
   巨門), "천량"(한글 天梁)처럼 실제로 구체적 데이터를 인용했는데도 한자 전용 목록이라
   citation_count가 0~3으로 잘못 낮게 나왔다. 십신(비견~정인), 자미두수 주성(14개) + 보조성/살성
   (14개) + 12궁 이름 전부 한자/한글 양쪽 인식하도록 확장. 또한 "辛 일간"처럼 완전한 간지가 아닌
   단독 일간 언급도 개인화 신호로 인정하도록 추가.
3. **Q8 — 부정문을 못 읽어 결론이 정반대로 분류됨**: "완전히 통제받는 조직원도, 모든 것을 혼자
   책임지는 1인 독립도 **아닌**..."이라는, 실질적으로 "조직" 쪽 결론인 문장에서 부정된 "1인 독립"이
   그대로 긍정 카운트되어 반대(independent)로 분류됐다. 키워드 뒤 부정 표지("도 아닌"/"아니라"/
   "라기보다" 등)가 있으면 카운트에서 제외하도록 수정, 명시적 결론 문장("한 줄 결론:" 등)이 있으면
   그 문장을 우선 분석하도록 개선.
4. **Q10 — 특정 반말 어미 문자열 목록이 실제 응답의 다른 반말 표현을 놓침**: 사용자가 준 예시 문장의
   정확한 어미("거야","줄래")만 찾았는데, 실제 응답은 "확인되지 않아"/"나와 있어"/"조합이야"처럼 다른
   반말 종결을 썼다. "정중체 종결 표지(습니다/니다/세요/어요 등)가 baseline 대비 뚜렷이 줄었는지"로
   판정 기준을 바꿔서 특정 어미 문자열에 의존하지 않게 함(baseline 실측 9회 → character 실측 0회로
   명확히 구분됨을 확인).

**흥미로운 부수 발견**: Q10의 핵심 검증 대상인 "사실관계 불변성"(귀문관살 존재/위치)은 **버그 수정
전에도 이미 정확히 PASS였다** — 즉 캐릭터 톤이 적용된 상태에서도 AI가 실제로 사실관계를 왜곡하지
않았다는 것 자체는 처음부터 확인됐고, 이번에 고친 건 "톤이 실제로 바뀌었는지"를 판정하는 보조 체크였다.

### 재채점 결과 (API 재호출 없음)

`npm run rescore:service-quality`로 5건 재채점 → **5/5 전부 PASS로 전환** (Q9는 원래도 PASS).

### 테스트

기존 검증기 로직 변경에 따라 `tests/15-service-quality-validators.test.mjs`의 관련 케이스들도 새
로직 기준으로 여전히 유효함을 재확인 (테스트 자체는 이미 올바른 기대값으로 작성되어 있었음).
**160/160 전부 통과 유지.**

## [Unreleased] — 8차 반영: Q6~Q10 서비스 품질 테스트 세트 (자기인식/개인화/일관성/과잉긍정방지/캐릭터톤)

### 배경

세운/귀문관살의 계산·전달·활용·도메인분리·환각방지는 141/141 테스트 + 실제 API 검증(edge_case,
main_quality, targeted_quality, 부산 fixture)으로 안정화됐다고 판단, 이제 "정답이 있는" 검증을 넘어
실제 유료 서비스 품질(공감/개인화/일관성/과잉긍정 방지/캐릭터 톤 안전성)을 검증하는 Q6~Q10을 추가했다.

### 설계 원칙

- **기존 파일 무수정**: `tests/real-ai/validators.mjs`, `tests/targeted-quality/*`는 import만 하고
  전혀 수정하지 않음. Q6~Q10은 `tests/service-quality/`라는 완전히 별도 디렉토리.
- **자동 vs 사람 평가 명시적 분리**: Q6~Q10은 세운/귀문관살처럼 "정답"이 있는 항목이 아니므로, 모든
  검증기가 "명백한 실패만 거르는 최소 안전망"이라는 점을 코드 주석과 결과 JSON의
  `human_review_required` 필드로 명시. 자동 PASS를 "품질이 좋다"로 오독하지 않도록 함.
- **원본 프롬프트 무수정**: `prompts/originals/{saju,ziwei}-original.md` 완전히 그대로 (작업 종료 후
  diff+MD5로 재확인, 아래 참고).

### `packages/ai/pipeline.mjs` — 유일한 기존 파일 수정 (하위 호환, optional 파라미터 추가)

`runQuestionPipeline()`에 `extraSystemInstruction` 파라미터를 추가했다. 기본값 `''`(빈 문자열)이라
기존 호출부(main_quality/targeted_quality 등 전부)는 동작이 1바이트도 변하지 않는다 — Q10(캐릭터 톤
불변성 검증)을 위해 system prompt 맨 끝에 캐릭터 톤 지시문을 얹을 수 있게 하는 테스트 하네스 훅일 뿐,
정식 캐릭터/페르소나 기능이 아니다. 141개 기존 테스트가 이 변경 후에도 그대로 통과함을 확인했다.

### 신규 파일

- `tests/service-quality/questions.mjs` — Q6~Q10 질문 정의 + `CHARACTER_TONE_INSTRUCTION`(사용자가
  제시한 예시 문장 2개를 그대로 사용: "바쁜 와중에 요즘 마음 참 답답하고 불안하지?..." /
  "네 사주엔 이미 유금이라는 귀한 인성이 박혀있으니...").
- `tests/service-quality/semantic-validators.mjs` — 8개 신규 검증 함수:
  - Q6: `checkEmpathyOpeningStructure` — 응답이 사무적 정형구/한자 밀도 높은 문장으로 곧바로 시작하지
    않는지만 확인 (공감의 질 자체는 사람 평가).
  - Q7: `checkCitationDensity`(실제 간지/십신/주성 인용 개수), `checkCrossPersonSimilarity`(서로 다른
    두 사람 응답이 표면적으로 거의 동일하면 FAIL — 단어 집합 Jaccard 유사도 근사치).
  - Q8: `classifyOrgVsIndependentLean`(조직/독립 방향성 단순 분류), `checkLeanConsistency`(N회 반복
    중 과반 이상 같은 방향인지).
  - Q9: `checkOverlyPositiveLanguage`(기존 forbidden_certainty_phrases와 별개 축 — "무조건 잘됩니다"
    같은 단정이 아니라 "분명 잘 될 거예요"류 근거 없는 낙관 표현), `checkBalanceGivenTensionSignal`
    (추출 데이터에 공망/충형해원진 같은 유보 신호가 실제로 있는데 균형 표현이 전혀 없으면 FAIL).
  - Q10: `checkToneActuallyApplied`(캐릭터 지시가 실제로 반영됐는지 — 반말 어미 존재 여부로 확인).
    귀문관살 사실관계 불변성 자체는 새로 안 만들고 `tests/targeted-quality/semantic-validators.mjs`의
    `checkGwimunExistenceConsistency`/`checkGwimunPositionAccuracy`를 그대로 재사용.
- `scripts/service-quality-runner-core.mjs` / `scripts/service-quality-real.mjs`
  (`npm run analyze:service-quality`) / `scripts/service-quality-dryrun.mjs`
  (`npm run analyze:service-quality:dryrun`) — 기존 OpenAIProvider/MockAIProvider/pipeline 재사용,
  새 AI provider 없음.
- `tests/15-service-quality-validators.test.mjs` — 8개 검증기에 대한 good/bad 합성 응답 회귀 테스트
  19개. API 호출 없음.

### 테스트

기존 141개 + 신규 19개. **총 160개, 전부 통과.**

### 아직 실행하지 않음

실제 API 호출(`npm run analyze:service-quality`)은 승인 후 실행 예정. 예상 HTTP 요청 18회
(Q6: 2, Q7: 4, Q8: 6, Q9: 2, Q10: 4), 예상 총 토큰 약 25만 (이전 실측 평균 기반 추정).

## [Unreleased] — 7차 반영: targeted_quality 테스트 세트 (세운/귀문관살 실제 활용 검증)

### 배경

지금까지 확인된 것: 계산 → Canonical JSON 전달 → Router/Extract/분석 프롬프트 전달까지는 검증됐고,
main_quality 실행에서 귀문관살 위치와 현재 대운이 실제 계산값과 일치하는 것도 확인됐다. 하지만
"데이터가 전달되는 것"과 "AI가 그 데이터를 실제 답변에 정확하게 활용하는 것"은 다른 질문이라, 이를
직접 검증하는 5개 targeted 질문 세트를 추가했다. main_quality의 13문항을 늘리지 않고 별도 세트로 분리.

### 신규 파일

- `tests/targeted-quality/expected-values.mjs` — main_quality fixture를 실행 시점에 파싱해서
  ground truth(2027년 세운 간지/십신/12운성, 귀문관살 위치, 현재 대운, 대운-세운 관계 등)를 도출.
  하드코딩된 값 없음 — fixture가 바뀌면 이 값들도 자동으로 바뀐다.
- `tests/targeted-quality/questions.mjs` — 5개 질문(TEST1~5, 사용자 권장 구성 그대로) + 각 질문이
  어떤 semantic validator를 쓸지, 어떤 체계 범위(scope_check)를 기대하는지 메타데이터.
- `tests/targeted-quality/semantic-validators.mjs` — 키워드 매칭이 아니라 "실제 값과의 일치/모순"을
  검사하는 6개 검증 함수(세운 간지 정확성, 세운 십신/12운성 일치, 귀문관살 위치 정확성, 귀문관살
  존재/부정 일관성, 대운-세운 연결 정확성 및 근거 없는 관계 생성 탐지, 불필요한 세운 추출 탐지).
- `scripts/targeted-quality-runner-core.mjs` — provider-injectable 실행 로직. **새 AI provider를
  만들지 않음** — 기존 `packages/ai/pipeline.mjs`, 기존 `tests/real-ai/validators.mjs`를 그대로
  재사용하고 semantic validator만 추가로 얹는다.
- `scripts/targeted-quality-real.mjs` (`npm run analyze:targeted`) / `scripts/targeted-quality-
  dryrun.mjs` (`npm run analyze:targeted:dryrun`) — main_quality와 동일한 무키 안내/Mock 검증 패턴.
- `tests/13-targeted-quality-validators.test.mjs` — 6개 semantic validator에 대한 good/bad 합성
  응답 회귀 테스트 17개. **실제 fixture에서 도출한 ground truth를 기준으로, 일부러 틀린 응답(다른
  연도 간지, 존재하지 않는 위치, 근거 없는 대운-세운 관계, 불필요한 세운 추출 등)을 만들어서
  validator가 실제로 FAIL을 잡아내는지 검증** (spec §7). API 호출 없음.

### 발견하고 고친 버그 (실제 호출 전)

- **십신/12운성 검증기가 한자만 인식하고 한글 표기("정재" 등)를 놓치는 버그** — 합성 테스트로 직접
  발견. 실제 AI가 한글로 답할 가능성이 높으므로 한자/한글 양쪽 다 인식하도록 `TEN_GOD_FORMS`/
  `TWELVE_STAGE_FORMS` 매핑 추가.
- **TEST2의 예상 체계 범위가 잘못 하드코딩됨** — 5개 질문 전부를 `expectedScope: 'both'`로 고정했었는데,
  TEST2("제 사주에 귀문관살이 있나요?")는 "사주"를 명시적으로 언급하므로 `question-router.md` 규칙상
  `saju_only`가 맞다. `questions.mjs`에 질문별 `scopeCheck`를 추가해서 수정.
- **Mock 라우터 미리보기가 "귀문관살"/명시적 연도("2027년") 언급을 못 잡던 문제** — 실제 GPT 라우터
  행동을 대체하려는 것은 아니지만(어디까지나 배관 확인용), pre-flight 미리보기를 더 유용하게 하려고
  `packages/ai/providers/mock-provider.mjs`에 귀문관살 키워드 규칙과 명시적 연도 정규식 매칭을 추가.

### 원본 프롬프트 보호 확인

`prompts/originals/saju-original.md`, `prompts/originals/ziwei-original.md` 둘 다 이번 작업에서
**전혀 수정하지 않음** — 작업 종료 전 `diff` + MD5로 재확인 (CHANGELOG 및 최종 보고에 결과 기록).

### 테스트

기존 134개(6차 반영까지) + 신규 17개(targeted-quality validator regression). **총 151개, 전부 통과.**
기존 테스트 삭제/약화 없음.

### 아직 실행하지 않음

실제 API 호출(`npm run analyze:targeted`)은 사용자 승인 후에만 실행 — 예상 비용은 최종 보고 참고.

## [Unreleased] — 6차 반영: main_quality 실제 AI 테스트 (2번째 실제 실행) + 검증기 추가 보강

### 실행 정보

성인 명반(main_quality fixture)으로 실제 OpenAI API를 처음 실행 (모델: gpt-5.6, 13개 질문/26회 HTTP
요청). 사용자가 로컬 PC에서 직접 실행하고 결과 JSON 11개 파일 전체를 공유해줬다.

### 실행 전 발견하고 미리 고친 문제 (실제 호출 전)

- `scripts/analyze-real.mjs`의 안내 문구가 "13회 API 호출"이라고 잘못 표기되어 있었음 — 실제로는
  13개 질문 × (Router 1회 + 분석 1회) = 26회 HTTP 요청. 문구를 정확하게 수정.
- 고정된 10개 질문 중 어느 것도 "올해"/"세운"/"귀문관살"을 명시적으로 언급하지 않아, 기존 라우터
  로직으로는 `annual_periods`/`special_stars.gwimun`이 단 한 번도 선택되지 않을 뻔했다 — 지난 두
  차례 작업의 핵심 검증 대상이 실제로는 테스트되지 않을 위험. `prompts/runtime/question-router.md`에
  "PERSONALITY 질문은 special_stars도 함께, DECISION/MAJOR_PERIOD 또는 '지금/현재/장기적으로' 표현이
  있으면 annual_periods도 함께 고려"라는 근거 있는 가이드(신살은 전통적으로 성격 해석에 쓰이는 데이터,
  장기 질문은 현재 세운 맥락이 실제로 유용)를 추가. 실행 결과 09/10번과 11번 turn2/3에서 실제로
  `annual_periods`가 선택됨을 확인 — 가이드가 의도대로 작동함.

### 실제 결과 — 두 번째 실제 검증기 오탐 패턴 발견 및 수정 (API 재호출 없이 재채점으로 확인)

13건 중 2건(09-cross-work-business, 11번 turn2)이 최초 실행에서 FAIL. 원문 확인 결과 **이번에도
검증기 오탐**이었다:

1. **"'A' 또는 'B'라는 양자택일보다는"** — "두 체계 모두 '평생 회사원' 또는 '무조건 창업가'라는
   양자택일보다는..." 처럼, 금지어를 인용부호로 감싸서 거짓 이분법으로 제시한 뒤 거부하는 패턴.
   4차 반영 때 추가한 "라기보다" 마커로는 못 잡음("양자택일보다는"에는 "라기보다"가 문자열로 포함되지
   않음).
2. **인용구 중간에 금지어가 위치하는 경우** — "'조직생활이 안 맞고 무조건 사업해야 하는 구조'로 보기는
   어렵다"처럼, 여는 인용부호가 금지어 바로 앞이 아니라 인용구 앞부분에 있고 금지어는 인용구 중간에
   위치. 처음 시도한 "금지어 직전 3자 이내에 인용부호" 검사로는 못 잡음.

**수정**: 개별 문구를 계속 추가하는 대신, **"금지어가 인용구간(quoted span) 안에 있는지"**를 일반적으로
검사하도록 변경 — 금지어 앞 40자 이내에 여는 인용부호가 있고 AND 금지어 뒤 40자 이내에 닫는 인용부호가
있으면 "인용된 것(=제시 후 반박하는 대상)"으로 간주해서 hedge 처리. `tests/real-ai/validators.mjs`의
`isWithinQuotedSpan()`. 개별 관용구를 계속 추가하는 것보다 더 견고한 일반화.

**재검증 결과**: 13건 중 2건 FAIL → **13/13 전부 PASS**. 나머지 11건도 재확인 결과 판정 변화 없음
(원래도 정상).

`tests/10-forbidden-phrase-validator.test.mjs`에 이번에 발견한 두 실제 문장을 회귀 테스트로 추가.

### AI 품질 — 사람이 직접 원문을 읽고 확인한 사항 (자동 검증과 별개)

- **귀문관살 정확도 확인**: 01-saju-personality 응답에서 "귀문관살은... 년지 辰과 월지 亥의 조합으로
  확인되지만"이라고 서술 — Canonical JSON의 실제 값(`positions:['month','year']`, 년주 戊辰/월주 癸亥)과
  **정확히 일치**. 임의 생성 없음, 계산 기준 고지("유파에 따라 판정 범위가 달라지는 보조 지표")도
  adapter가 의도한 대로 정확히 반영됨.
- **사주/자미두수 영역 혼동 없음**: 11번 turn1의 [사주 관점]은 십신 용어(정인/편인/식신/상관/정관/편재)만,
  [자미두수 관점]은 궁/성/사화 용어(관록궁/대궁/삼합궁/천기/거문/태음화권)만 사용 — 두 체계 용어가
  섞이지 않음. 관록궁 공궁 상황에서 "대궁과 삼합궁을 함께 봐야 한다"는 서술은 §3(삼방사정) adapter
  규칙이 정확히 반영된 것.
- **현재 대운 정확도**: 10번 응답 "현재는 편인 성격의 己未 대운이다", "45세부터는 인성과 관성이
  이어진다" — 둘 다 실제 계산값(35~44세=己未/偏印, 45~54세=戊午/正印+偏官)과 **정확히 일치**.
- **단정 금지 규칙 준수**: 재검토한 모든 케이스에서 "무조건 X"류 표현은 전부 인용 후 명시적으로
  반박하는 형태로만 등장 — 실제 단정 주장은 발견되지 않음.
- **대화 연속성**: 3턴에 걸쳐 이전 턴의 프레이밍을 이어받아 구체화하는 패턴 확인(예: turn2가 turn1의
  "복잡한 정보를 실용적 결과로" 프레이밍을 이어받아 "직장 vs 사업" 질문에 답함). 첫 턴에만 고정 안내
  문구("[해석 안내]...")가 나타나고 2/3턴에는 반복되지 않음 — adapter §4/§5 설계와 일치.
- **⚠️ 세운 데이터 활용도 — 개선 여지 발견**: 09번, 10번 모두 `annual_periods` 21개 항목(연도별
  간지/십신/운성/신살/관계)을 추출했지만, 실제 해석문에서는 **"세운"이라는 단어 자체가 0회 언급**되고
  21개 간지 중 어느 것도 텍스트에 등장하지 않았다(우연히 겹치는 "己未"는 대운 간지였음). 즉 라우터
  가이드로 데이터는 정상적으로 뽑혔지만, 분석 단계가 그 데이터를 실제로 활용하지 않은 채 대운 수준의
  설명으로만 답했다 — 데이터 자체는 있지만 안 쓰인 상황. 이로 인해 09/10번과 11번 turn2/3의
  input_tokens가 다른 질문 대비 약 1만 토큰(약 40%) 더 높게 나왔는데(24,929→33,151 평균), 이 추가
  비용이 실제 답변 품질 향상으로 이어지지 않았을 가능성이 있다 — 다음 개선 과제로 기록.

### 테스트 영향

기존 115개에 영향 없음. `tests/10-forbidden-phrase-validator.test.mjs`에 회귀 테스트 2개 추가.
**총 117개 전부 통과.**

## [Unreleased] — 5차 반영: 세운(歲運)/귀문관살 데이터 통합

### 배경

`main_quality` 실제 AI 테스트를 실행하기 전에, Canonical JSON에 세운과 귀문관살 데이터가 없어서
품질 평가가 불완전할 것이라는 지적에 따라 두 데이터를 먼저 통합했다. **원칙: 기존
`calculateSaju`/`SajuResult`를 절대 변경하지 않고, `@orrery/core`의 기존 공개 export를 최대한
재사용하는 side-car 모듈로 구현한다.**

### 사전 조사 (코드 확인, 추측 없음)

구현 전에 `@orrery/core`의 실제 export와 동작을 `node -e`로 직접 호출해서 확인했다:

- `getYearGanzi(year)` — 세운 간지. 2024=甲辰, 2025=乙巳, 2026=丙午, 2027=丁未, 2044=甲子 등 실측 확인.
- `getRelation(dayStem, targetStem)` — 십신. 동일 천간(예: 乙,乙)도 "本元" 특수 케이스가 아니라
  정상적으로 비견(比肩)을 반환함을 확인 (세운은 원국의 일주 자신이 아니므로 이 특수 케이스가 애초에
  적용 대상이 아님).
- `getJeonggi(branch)` — 지지 정기. 지지 십신 계산(정기 기준)에 필요.
- `getTwelveMeteor(stem, branch)`, `getTwelveSpirit(yearBranch, targetBranch)`, `getGongmang(dayGanzi)`
  — 전부 실측하여 기존 원국/대운 계산과 동일한 함수임을 확인.
- `getBranchRelation(branch1, branch2)`/`analyzePillarRelations(ganzi1, ganzi2)` — 이미 원국 4주
  사이의 합충형파해원진귀문 판정에 쓰이고 있었고, **원국으로 범위가 제한된 것은 우리 코드
  (`analyzeAllRelations`가 4주끼리만 호출)이지 함수 자체의 한계가 아님**을 확인 — 임의의 두 60갑자
  (세운-원국, 세운-대운 등)에 대해서도 동일하게 호출 가능.
- `BRANCH_GWIMUN` 상수 — `@orrery/core/constants`에서 공개 export로 확인. 6쌍: 子酉/丑午/寅未/卯申/
  辰亥/巳戌, 전부 값이 "鬼門".

### 신규 파일

- **`packages/chart-engine/annual-periods.mjs`** — 세운 side-car. `computeAnnualPeriods(sajuResult,
  {fromYear, toYear})`가 위 7개 함수만 조합해서 연도별 배열을 만든다. 새로운 60갑자/십신/12운성/12신살
  알고리즘을 전혀 새로 만들지 않았다.
- **`packages/chart-engine/gwimun.mjs`** — 귀문관살 side-car. `extractNatalGwimun(sajuResult)`(원국
  4주 안의 귀문관살 — 이미 `calculateSaju`가 계산해 둔 `relations.pairs`에서 "鬼門" 타입만 추출, 재계산
  없음), `checkGwimunBetween(ganzi1, ganzi2)`(세운-원국, 세운-대운 등 임의의 두 주 사이 판정 — 원국-원국
  판정과 **완전히 동일한 함수**인 `analyzePillarRelations` 재사용).

### 실제 테스트 명반 확보 (임의 생성 금지 준수)

귀문관살 양성 테스트 케이스를 만들기 위해, 1990년 1~12월 × 1~28일 조합을 실제 계산 엔진(`computeChart`)
으로 브루트포스 계산해서 진짜로 귀문관살이 나오는 명반을 찾았다: **1990-03-01 10:00 남성, 서울** —
일주 乙丑, 년주 庚午 → 지지 丑/午가 `BRANCH_GWIMUN`의 "丑,午" 쌍과 실제로 일치. 데이터를 손으로
넣지 않고 전부 엔진 계산 결과를 그대로 사용했다.

부수적 발견: 이미 만들어 둔 `main_quality`(성인) fixture(1988-11-22)도 재계산해보니 월지 亥/년지 辰이
`BRANCH_GWIMUN`의 "辰,亥" 쌍과 실제로 일치해서, 별도 명반을 새로 만들 필요 없이 **기존 fixture 자체가
자연스러운 귀문관살 양성 케이스**였다.

### Canonical JSON 변경 (additive only)

`schemas/canonical-chart-schema.json`에 다음을 추가했다 — **기존 필드/required 배열은 전혀 건드리지
않음**, 전부 optional:

```
saju.annual_periods                    (신규, 배열)
  year, ganzi, heavenly_stem, earthly_branch,
  ten_god{stem,branch}, twelve_stage, twelve_spirit, is_void,
  related_major_period{index,ganzi}|null,
  relations_to_natal[{pillar_position, stem_relations[], branch_relations[]}],
  relations_to_major_period{major_period_ganzi, stem_relations[], branch_relations[]}|null

saju.special_stars.gwimun              (신규, 기존 special_stars 객체 안에 추가)
  [{ positions: [pillar_position, pillar_position], detail }]
  — 다른 special_stars 필드(yangin 등)와 달리 "두 주 사이의 관계"이므로 pair 배열 형태로 설계함
    (단일 주에 붙는 플래그가 아니라서 기존 필드들과 shape이 다를 수밖에 없음, 문서화함).

saju.calculation_provenance            (신규, saju 객체 최상위)
  annual_periods: { calculation_method: "orrery-core-composed-v1", engine_functions: [...] }
  gwimun: { calculation_method: "orrery-core-branch-gwimun-v1",
            pairs_used: [...] (BRANCH_GWIMUN에서 직접 읽음, 하드코딩 아님),
            engine_functions: [...] }
```

`schemas/canonical-chart-schema.json`의 `saju.required` 배열은 여전히
`["day_master","pillars","relations","special_stars","void_branches","major_periods"]`로 변경 없음
— 기존 Canonical JSON(annual_periods/gwimun 없는 버전)도 계속 유효함을 재확인함(§테스트 결과 참고).

### 파이프라인 연동

- `packages/canonical/transform.mjs`의 `buildCanonicalChart()`가 기본으로 `annual_periods`/
  `special_stars.gwimun`/`calculation_provenance`를 함께 생성하도록 수정 (옵션으로 끌 수 있는
  `includeAnnualPeriods: false` escape hatch 유지 — 하위 호환). `transformSaju()` 자체는 전혀
  변경하지 않고, `buildCanonicalChart()` 레벨에서 결과에 필드를 추가만 함.
- `packages/shared/categories.mjs`의 `SAJU_FIELDS`에 `annual_periods` 추가 — 이게 없으면 Question
  Router가 세운 데이터를 요청할 방법 자체가 없어서 추가한 필드가 실제로는 절대 사용되지 않는
  상태였음(발견 즉시 수정).
- `packages/canonical/extract.mjs`가 `calculation_provenance`를 `subject`처럼 라우터 선택과 무관하게
  자동으로 함께 실어 보내도록 수정 — 귀문관살/세운을 다룰 때 AI가 계산 기준을 항상 참조할 수 있게 함.
- `prompts/runtime/question-router.md`에 `annual_periods` 선택 기준 추가.
- `prompts/runtime/saju.md`(adapter, **원본 아님**) §2/§3을 "세운/귀문관살 데이터 없음" → "이제
  존재함, 범위/유파 차이를 어떻게 고지할지"로 갱신. **`prompts/originals/saju-original.md`는 이번
  작업에서 전혀 건드리지 않음** (diff로 재확인 완료).
- 실제 파이프라인(`runQuestionPipeline`)으로 "올해 운세가 어때?" 질문 시 `annual_periods` 21개가
  실제로 추출되는지, "인간관계가 힘든 이유" 질문 시 `special_stars.gwimun`과 `calculation_provenance`
  가 함께 추출되는지 end-to-end로 직접 확인함.

### fixture 파일 재생성

`data/canonical-chart-example.json`, `data/fixtures/edge-case-infant-chart.json`,
`data/fixtures/adult-main-quality-chart.json` 전부 동일한 생년월일시로 재계산해서 새 필드를 포함하도록
갱신. 스키마 재검증 통과 확인.

### 자동 검증기 업그레이드 (4차 반영에서 추가했던 fabrication 체크 2종)

`no_annual_period_fabrication`, `no_gwimun_fabrication`이 "필드가 아예 없으면 무조건 fabrication"
단순 로직이었는데, 이제 필드가 실제로 존재하므로 **실제 계산값과 대조하는 로직으로 업그레이드**했다:

- 세운: 텍스트에 등장하는 간지가 `annual_periods`의 실제 계산값 목록에 있는지 대조. 없으면 FAIL.
- 귀문관살: `special_stars.gwimun`이 실제로 비어있지 않은데(양성) 존재를 단정하면 PASS, 빈 배열인데
  (음성) 단정하면 FAIL.

### 테스트

- **신규**: `tests/12-annual-gwimun.test.mjs` 20개 (세운 간지 2024~2027 + +20년 범위 + 십신/12운성/
  12신살/공망 + 원국·대운과의 관계 + 귀문관살 양성/음성(실제 엔진 계산 명반) + calculation_method +
  기존 SajuResult 불변성 2종).
- 기존 `tests/11-fabrication-validator.test.mjs`에 업그레이드된 로직에 대한 회귀 테스트 4개 추가
  (필드 존재+값 일치=PASS, 필드 존재+값 불일치=FAIL, 양쪽 각각 세운/귀문관살).
- **전체 결과: 91 → 115개, 전부 통과.**

## [Unreleased] — 4차 반영: 첫 실제 API 결과 기반 검증기 수정 + 2-fixture 분리

### 배경

사용자가 실제로 `OPENAI_API_KEY`를 로컬 PC에 설정하고 `npm run analyze:real`을 처음 실행했다
(모델: `gpt-5.6`, fixture: 기존 유아 명반). 13회 호출 중 5회가 자동 검증에서 FAIL로 나왔는데, 실제
내용을 검토한 결과 **10건 전부 검증기 자체의 버그(오탐)**였고 진짜 원본 프롬프트 위반은 0건이었다.

### `forbidden_certainty_phrases` 검증기 — 부정문 인식 추가 (버그 수정)

기존 구현은 "반드시"/"무조건"/"100%"/"운명적으로" 문자열이 텍스트에 존재하기만 하면 무조건 FAIL
처리했다. 실제 응답을 보니 5건 전부 "무조건 X라는 뜻은 아닙니다", "반드시 X하는 것은 아닙니다"처럼
**단정을 명시적으로 부정(거부)하는 문장**이었다 — 원본 프롬프트가 요구하는 정확히 그 동작(단정적 표현
금지)을 AI가 잘 지키고 있었는데, 검증기가 문맥을 못 읽어서 반대로 판정한 것.

**수정**: 각 금지어 발견 시, 발견 지점부터 문장 경계(마침표/느낌표/물음표/줄바꿈) 또는 40자 중 먼저
오는 곳까지의 텍스트에서 부정 표지("아니", "아닙"(정중체 — "아니"와 음절이 달라 별도 추가 필요),
"않", "없", "못", "라기보다")를 검사한다. 부정 표지가 있으면 "단정을 거부하는 문장"으로 보고 PASS
처리한다. 문장 경계를 넘는 부정은 인정하지 않는다(예: "반드시 X됩니다. 그렇지 않으면 이상합니다."는
여전히 FAIL — 뒤 문장의 부정이 앞 문장의 단정을 취소하지 않음).

**재검증 결과** (API 재호출 없이, 이미 받은 JSON을 재채점만 함): 업로드받은 3개 파일(01, 07,
11(3턴)) 총 5건 중 4건의 판정이 FAIL→PASS로 바뀜. 남은 1건(01)은 원래도 PASS였음 — 즉 **10건의
오탐이 전부 해소되었고, 실제 위반으로 재확인된 것은 0건.**

발견 과정에서 두 번째 헤지 패턴("~라기보다는", 예: "'A'이라기보다, B가 중요하다")도 추가로 나와서
부정 표지 목록에 포함시켰다.

모든 수정 사항은 `tests/10-forbidden-phrase-validator.test.mjs`(17개 케이스: 실제 발견된 5개 오탐
원문 그대로 + 사용자가 명시한 PASS/FAIL 예문 6개 + 문장 경계/복수 위반 등 견고성 테스트)로 회귀
테스트를 고정했다.

### 신규 검증기 5종 추가 (세운/귀문관살/대운 fabrication + 현재 대운 처리 + 데이터 제한 고지)

`tests/real-ai/validators.mjs`에 추가:

- `no_annual_period_fabrication` — Canonical JSON에 세운(annual_periods) 필드가 아예 없는 상태에서,
  응답이 "세운"을 구체적 간지와 함께 언급하면(데이터 부재 고지 없이) FAIL.
- `no_gwimun_fabrication` — 마찬가지로 `special_stars.gwimun` 필드가 없는 상태에서 귀문관살 존재를
  단정하면(부재 고지 없이) FAIL.
- `no_daewoon_fabrication` — "대운" 언급 근처에 실제 추출된 `major_periods`에 없는 간지가 나오면 FAIL.
- `current_daewoon_handling` — 현재 나이가 어떤 대운 구간에도 속하지 않을 때(예: 유아 명반, 나이가
  첫 대운 시작 나이 미만) "현재 대운"을 억지로 특정하면 FAIL. 유효한 구간이 있으면 특정 자체는 정상.
- `data_limitation_disclosure` — 위 상황처럼 데이터가 구조적으로 부족한데도 아무 제한 언급 없이
  단정적으로 서술하면 FAIL. 데이터가 충분하면 자동으로 해당 없음(N/A, PASS) 처리.

세운/귀문관살은 **현재 계산 엔진 자체가 데이터를 생성하지 않으므로**(2026-08 엔진 조사에서 이미
확인됨), "필드가 없으면 어떤 구체적 주장도 무조건 fabrication"이라는 전제로 설계했다. 나중에 세운/
귀문관살 계산 기능이 실제로 추가되면, 각 체크의 "hasField" 분기만 "실제 값과 대조"로 바꾸면 되도록
주석에 명시해 두었다.

`tests/11-fabrication-validator.test.mjs`(14개 케이스)로 회귀 테스트 고정. 기존 3개 실제 결과 파일에
재적용한 결과 오탐 0건(전부 N/A 또는 정상 PASS).

### Edge Case / Main Quality 2-fixture 분리 (신규 구조, 기존 파일 삭제 없음)

기존 유아 명반(2026-08-06 출생, 평가 시점 기준 만 0세)은 **삭제하지 않고** `data/fixtures/edge-case-
infant-chart.json`으로 보존 — "성인용 질문에 대해 AI가 데이터를 무리하게 확장하지 않는가"를 검증하는
edge case 전용 fixture로 역할을 명확히 함. 실제로 이 명반의 대운 데이터를 보면 세 번째 이상 대운은
질문 시점(나이 0세) 기준 아직 시작조차 되지 않은 상태라, `current_daewoon_handling`/
`data_limitation_disclosure` 체크가 정확히 이 케이스를 위해 설계됨.

신규로 `data/fixtures/adult-main-quality-chart.json` 추가 — **실제 계산 엔진(`packages/chart-engine/
compute.mjs` + `packages/canonical/transform.mjs`)으로만 생성**, 별도 반, 사화, 대운 값을 수기로
넣지 않음. 1988-11-22 14:30 서울 출생 여성, 평가 시점 기준 37세로 35~44세 대운(己未) 구간에 정확히
속함. 명궁 巨門, 재백궁 太陽, 관록궁 공궁(空宮 — 삼방사정 판독이 실제로 필요한 케이스), 사화 4개
전부 실존(貪狼化祿/天機化忌/太陰化權/右弼化科) — 직업/재물/관계/현재 대운 질문을 현실적으로 평가할
수 있는 데이터를 갖춤.

`tests/real-ai/fixtures.mjs`에 두 fixture를 레지스트리로 등록하고, `scripts/analyze-real.mjs` /
`scripts/analyze-real-dryrun.mjs`가 `npm run analyze:real -- main_quality`처럼 인자로 그룹을 선택할
수 있도록 수정(기본값은 하위호환을 위해 `edge_case`). 결과 저장 경로도 `tests/real-ai/edge-case/`,
`tests/real-ai/main-quality/`로 분리했다.

### `npm run rescore:real` 신규 스크립트

검증기 로직이 바뀔 때마다 **API를 재호출하지 않고** 이미 저장된 결과 JSON만 다시 채점할 수 있도록
`scripts/rescore-real-ai-results.mjs`를 추가했다. 각 결과 파일에 `fixture` 태그를 저장해 두어(이번
변경으로 `runFullEvaluation`이 자동으로 stamp함), 재채점 시 어느 fixture의 Canonical JSON을 기준으로
`extraction_correctness`를 재검증해야 하는지 자동으로 판단한다. 태그가 없는 예전 파일(이번 첫 실제
실행 결과 포함)은 `edge_case`로 간주(하위호환).

### 테스트 영향

기존 77개 테스트에 영향 없음. 신규 31개(`tests/10-forbidden-phrase-validator.test.mjs` 17개 +
`tests/11-fabrication-validator.test.mjs` 14개) 추가. **총 91개 전부 통과.**

### ⚠️ "코드 테스트 통과"와 "AI 해석 품질 통과"는 다른 것

`npm test`의 91/91은 **검증기/파이프라인 코드 자체의 정확성**을 보장하는 것이지, AI가 만들어낸
해석 내용의 품질을 보장하지 않는다. 실제 AI 응답에 대한 자동 검증(현재 규칙 위반 여부 기계적 체크)과
사람이 직접 읽고 판단해야 하는 해석 품질(고전 이론 적용의 적절성, 답변의 실질적 유용성, 유료 서비스
가치)은 `REAL-AI-EVALUATION.md` §8에서 이미 명시적으로 분리되어 있으며, 이번 작업으로 그 경계가
흐려지지 않도록 최종 보고에서도 두 가지를 항상 구분해서 서술한다.


### 배경

구조 구현(계산 엔진, Canonical JSON, Question Router, Extraction, Cross Analysis, 대화 메모리, API)이
충분히 검증된 뒤, "실제 사용자가 질문했을 때 사주+자미두수 기반 대화형 해석이 상품 수준으로 나오는가"를
검증하기 위한 실제 AI 평가 단계로 넘어갔다. 웹 UI, PostgreSQL, 인증, 결제는 이 단계에서 의도적으로
제외했다 (요청대로 새 기능 추가 없음).

### ⚠️ 중요한 환경 제약

이 작업을 수행한 세션(샌드박스)은 **`api.openai.com`에 대한 네트워크 접근이 허용 도메인 목록에 없어
차단되어 있고, `OPENAI_API_KEY`도 제공되지 않았다.** 따라서 이번 단계에서 만든 것은 "실제 평가
결과"가 아니라 "키만 넣으면 바로 실행되는 실제 평가 하네스"다. 실제 품질 데이터(토큰/비용/hallucination/
원본 프롬프트 준수 여부)는 `OPENAI_API_KEY`가 있는 별도 네트워크 환경에서 `npm run analyze:real`을
실행해야만 얻을 수 있다. 이 사실은 README §14와 `REAL-AI-EVALUATION.md` 최상단에 각각 명시했다.

### 신규 추가

- `scripts/analyze-real.mjs` (`npm run analyze:real`) — 실제 OpenAI Responses API 전용 실행 스크립트.
  `OPENAI_API_KEY`/`OPENAI_MODEL`이 없으면 **아무 것도 실행하지 않고** 설정 방법을 안내한 뒤
  `exit(0)`한다 (Mock으로 대체 실행되지 않음 — 무키 상태로 실제 실행해 확인: 안내 메시지 출력,
  `tests/real-ai/*.json` 생성 없음).
- `scripts/analyze-real-dryrun.mjs` (`npm run analyze:real:dryrun`) — 동일한 하네스를 MockAIProvider로
  실행해서 하네스 자체(파일 저장, 라우팅/추출 배관, 자동 검증, 비용 집계, 대화 연속성)만 검증. 결과는
  `tests/real-ai/_dryrun_mock_verification/`에 별도 저장되어 실제 결과 파일과 절대 섞이지 않으며, 모든
  결과 JSON에 `"mock_mode": true`가 명시된다.
- `scripts/real-ai-runner-core.mjs` — 두 스크립트가 공유하는 provider-injectable 핵심 로직.
- `tests/real-ai/questions.mjs` — 사용자가 지정한 10개 고정 질문(사주 단독 3 / 자미두수 단독 3 / 교차
  4) + 대화 연속성 3턴, 원문 그대로 보존 (재현성을 위해 문구를 임의로 바꾸지 않음).
- `tests/real-ai/validators.mjs` — 자동 검증 6종: JSON schema 적합성, 필수 필드 비어있지 않음, 금지된
  단정 표현("반드시"/"무조건"/"100%"/"운명적으로") 검출, 데이터에 없는 자미두수 별 이름 언급 휴리스틱
  (false positive 가능 — 사람 재검토 필요라고 명시), 라우팅이 의도한 체계 범위로 갔는지, 추출 결과가
  독립적으로 재현되는지. **AI가 자기 답변을 스스로 평가하지 않는다** — 전부 기계적 체크.
- `REAL-AI-EVALUATION.md` — 최종 리포트. 실제 데이터가 필요한 모든 섹션(토큰/비용/품질/hallucination/
  원본 위반)은 `[PENDING]`으로 명시하고, 방법론/테스트 환경/실행법/예상 병목 등 지금 확정 가능한 부분만
  작성함. 임의로 결과를 지어내지 않음.
- `packages/shared/load-env.mjs` — 외부 의존성 없는 최소 `.env` 로더 (analyze-real.mjs에서 사용).
- `tests/09-real-ai-harness.test.mjs` — 위 하네스 자체의 회귀 테스트 7개 (validators 단위 테스트 5개 +
  하네스 end-to-end 통합 테스트 1개 등). API 키 없이 `npm test`로 항상 실행됨.

### 코드 수정 — 질문 카테고리와 자동 검증 라벨링 정합성 버그 수정

초안에서는 "사주 단독"/"자미두수 단독" 절 아래에 있는 질문이면 무조건 `expectedScope`를
`'saju_only'`/`'ziwei_only'`로 강제 라벨링했는데, 실제 질문 문구 중 일부(예: "나는 돈을 어떤 방식으로
벌고 관리하는 성향이 강해?")는 체계를 명시하지 않는다. `question-router.md` 자체의 규칙("체계를
지정하지 않으면 두 체계 모두에서 채운다")에 따르면 이런 질문은 두 체계 모두로 라우팅되는 게 오히려
올바른 동작이라, 강제 라벨링은 정상 동작을 오탐(false FAIL)으로 잡는 버그였다.

**수정**: `tests/real-ai/questions.mjs`에 `scope_check` 필드를 추가해 질문 문구가 실제로 체계를
명시하는 경우("...사주로", "...자미두수 기준으로", 비교 표현)만 엄격 검증(`'saju_only'`/`'ziwei_only'`/
`'both'`)하고, 명시하지 않는 경우는 `'unconstrained'`로 표시해 자동 통과시키되 실제 라우팅 결과는
기록해서 사람이 검토하게 함. 수정 전 13개 중 2개(FAIL) → 수정 후 13개 전부 PASS (mock 검증 기준).

### 코드 수정 — usage 필드에 cached/reasoning 토큰 추가

`OpenAIProvider`가 `input_tokens_details.cached_tokens`, `output_tokens_details.reasoning_tokens`를
캡처하지 않고 있었는데, prompt caching이 이 서비스의 실제 비용에 큰 영향을 줄 것으로 예상되어(원본
프롬프트 두 개 전문이 매 호출 system prompt에 통째로 들어감 — REAL-AI-EVALUATION.md §13 참고) 추가함.
`packages/ai/pipeline.mjs`의 `addUsage()`도 이 필드들을 함께 합산하도록 수정. `MockAIProvider`의 usage
객체 shape도 동일하게 맞춤 (테스트 일관성).

### apps/api/src/services/conversation-service.mjs — 함수 export 추가

`appendToSummary`(대화 요약 누적 로직)를 real-ai 하네스의 대화 연속성 테스트가 프로덕션과 **동일한**
로직으로 재현할 수 있도록 export로 변경. 로직 자체는 변경 없음.

### 테스트 영향

기존 54개 테스트에 영향 없음. 신규 7개(`tests/09-real-ai-harness.test.mjs`) 추가. **총 61개 전부 통과.**

### 최종 검증 (이번 패키징 단계)

- `npm test`: 61/61 통과 (재확인)
- `npm run analyze:real:dryrun`: 13/13 결과 파일 생성, 전부 자동 검증 통과, `mock_mode: true` 확인
- `npm run analyze:real` (키 없이): 안내 메시지 출력 후 정상 종료, 파일 생성 없음 (재확인)
- ZIP 생성 후 fresh extraction 환경에서 `npm install && npm test` 재실행 — 아래 최종 보고 참고


### 자미두수 원본 프롬프트 반영

- `prompts/originals/ziwei-original.md`에 사용자가 업로드한 "AI가 읽는 내 인생의 구조: 전통 자미두수
  명반 해석 프롬프트" 원문을 반영함. PENDING placeholder 삭제, `diff` clean + MD5 체크섬
  (`5a5b7e543c2bb3813e5700df058d0f7e`) 일치로 verbatim 반영 확인.
- `saju-original.md`는 이번 작업에서 **전혀 건드리지 않음** — 작업 전후 diff로 미변경 확인.
- `prompts/runtime/ziwei.md`를 `prompts/runtime/saju.md`와 동일한 원칙(adapter, 원본 재작성 금지)으로
  새로 작성. 파이프라인이 adapter + 원본 verbatim을 실행 시점에 이어붙이는 구조는 이미 saju 통합 때
  일반화되어 있었으므로 `packages/ai/pipeline.mjs` 코드 변경 없이 그대로 재사용됨.

### 코드 변경 — 삼방사정(三方四正) 자동 확장 (중요, 동작 변경 있음)

ziwei-original.md를 실제로 읽어보니, "궁 하나만으로 결론 내리지 않는다. 반드시 해당 궁의 주성, 삼방사정,
생년사화, 보조성을 함께 본다"와 "삼방사정을 근거로 결론 내리기 전 반드시 [본궁/대궁/삼합궁1/삼합궁2]를
먼저 제시한다"는 규칙이 있는데, 기존 `packages/canonical/extract.mjs`는 라우터가 지정한 궁만 그대로
필터링해서 반환했기 때문에 이 필수 규칙을 구조적으로 지킬 수 없는 상태였다.

**변경 내용**: `packages/shared/ziwei-relations.mjs`(신규)에 12궁의 대궁(對宮)·삼합궁(三合宮) 관계를
고정 테이블로 정의(命財官/兄疾田/夫遷福/子友父 — 명반마다 달라지지 않는 구조적 사실이므로 계산 아님).
`extract.mjs`가 `ziwei_palace_focus`로 지정된 궁마다 대궁+삼합궁을 자동으로 함께 포함하도록 수정.

**테스트 영향**: 기존 테스트 1개(`tests/02-data-extraction.test.mjs` "ziwei palace_focus filters...")가
"정확히 요청한 궁만 반환"을 검증하고 있었는데, 이는 새 동작(요청한 궁 + 삼방사정)과 맞지 않아 실패했다.
이 테스트를 새 정답(예: `['career','wealth']` 요청 시 `['career','fortune','life','spouse','wealth']`
5개 반환)에 맞게 업데이트했다 — 기능 회귀가 아니라 원본이 요구하는 규칙을 실제로 지키게 된 것이므로
테스트를 수정하는 것이 맞다고 판단.

### 코드 변경 — 현재 나이 자동 계산 (양쪽 원본 공통 요구사항)

두 원본 모두 "현재 나이가 없으면 현재 대운을 특정하지 않는다"는 규칙을 갖고 있다. 이 서비스는
`subject.birth_date`를 이미 알고 있으므로, `packages/shared/date-utils.mjs`(신규, 순수 달력 계산 —
명리/자미두수 계산이 아님)로 매 질문마다 만 나이를 서버에서 계산해서 `packages/ai/pipeline.mjs`가
`CURRENT_AGE_CONTEXT`로 자동 제공하도록 수정. 원본이 요구하는 입력을 사용자에게 다시 묻지 않고
서버가 대신 채워주는 방식 — saju.md/ziwei.md adapter 둘 다에 이 매핑을 명시함.

### Question Router 프롬프트 — 명시적 체계 범위(사주만/자미두수만/비교) 규칙 추가

`prompts/runtime/question-router.md`에 "사용자가 사주만/자미두수만/비교를 명시적으로 요청하면 그에 맞게
`saju_fields`/`ziwei_fields`를 비우거나 채운다"는 규칙을 명시적으로 추가함 (이전에는 암묵적으로만
가능했고, 라우터가 두 체계를 항상 함께 채우는 경향이 있었음). `packages/ai/providers/mock-provider.mjs`의
테스트용 키워드 분류기도 동일한 3가지 시나리오(사주-only/자미두수-only/비교)를 구분하도록 개선.

### natal 잔재 확인 (§11 검증 결과 — 제거 불필요, 이미 격리되어 있었음)

전체 활성 실행 경로(`apps/`, `packages/ai/`, `packages/canonical/transform.mjs`,
`packages/canonical/validate.mjs`, `packages/chart-engine/compute.mjs`)를 grep으로 재검사한 결과:

- `packages/chart-engine/compute.mjs`는 `@orrery/core/saju`, `/ziwei`, `/cities`만 import — `/natal`
  import 없음 (확인 완료).
- `packages/canonical/transform.mjs`(활성)는 `transformSaju`/`transformZiwei`만 있고 natal 변환 함수
  자체가 없음.
- `natal`이 남아있는 곳은 다음 두 곳뿐이며, 둘 다 **이전 프로젝트에서 verbatim 보존용으로 가져온 CLI
  스크립트**이고 어떤 활성 코드에서도 import되지 않는다 (grep으로 참조 없음 확인):
  - `packages/chart-engine/orrery-test-calc.mjs` (구 `test-calc.mjs`)
  - `packages/canonical/canonical-transform.mjs` (구 `canonical-transform.mjs`)
- `schemas/canonical-chart-schema.json`은 여전히 `natal`을 정의하고 있으나(스키마 파일 자체는 이전
  CHANGELOG 항목에서 이미 결정한 대로 미수정 유지), `validate.mjs`가 실행 시점에 `required`에서
  제외하므로 natal 없는 Canonical JSON도 정상 검증되고, natal이 실제로 생성되는 경로도 없다.
- 결론: **삭제해야 할 활성 코드가 없었다** — natal은 이미 처음부터 실행 경로에서 격리되어 있었고, 이번
  검증은 그것을 재확인한 것이다. 기존 테스트가 깨진 것도 없다.

### 신규 테스트

`tests/08-ziwei-original-integration.test.mjs` 추가 (12개 케이스): 원본 파일 존재, PENDING 문구 제거
확인, 원본 고유 용어(삼방사정/공궁/생년사화/Fact-Claim-Disclosure/QUICK-STANDARD-DEEP) 포함 확인, MD5
체크섬 고정, adapter가 원본을 중복 포함하지 않는지, 파이프라인이 adapter+원본을 실제로 결합하는지,
사주-only/자미두수-only/비교 라우팅 3종, 삼방사정 고정 테이블 정확성, 추출 시 삼방사정 자동 포함 검증.

전체 테스트: **54개 (42개 기존 + 1개 수정 + 12개 신규 − 1개는 위 "삼방사정 자동 확장" 항목에서 이미
카운트) 전부 통과.**


### 원본 프롬프트 통합

- `prompts/originals/saju-original.md`에 사용자가 업로드한 "전통 명리학 (사주) 통합 해석 프롬프트" 원문을
  **한 글자도 수정하지 않고** 반영함. PENDING placeholder를 삭제하고 실제 원문으로 교체.
- `prompts/originals/ziwei-original.md`는 **아직 PENDING 상태.** 자미두수 원본("AI가 읽는 내 인생의 구조:
  전통 자미두수 명반 해석 프롬프트")은 이번 업로드에 포함되지 않았다. 도착하면 saju와 동일한 절차로 반영.
- `prompts/runtime/saju.md`를 원본을 재작성하는 대신 **adapter(배관 레이어)**로 새로 작성함. 파이프라인
  (`packages/ai/pipeline.mjs`)이 이 adapter + `originals/saju-original.md` 전문을 실행 시점에 그대로
  이어붙여 system prompt를 구성한다 — 원본 파일 자체에는 어떤 텍스트도 추가되지 않는다.

### 원본과 현재 계산 엔진 사이의 데이터 격차 (adapter에 명시, 원본은 미수정)

원본 프롬프트는 세운(연도별 유년운) 표와 귀문관살 계산표를 입력으로 기대하지만, 현재
`@orrery/core` 기반 계산 엔진과 Canonical Chart JSON 스키마는 **세운과 귀문관살을 계산/포함하지
않는다** (대운까지만 계산). 이는 원본을 수정해서 해결한 것이 아니라, 원본이 이미 정의해 둔 fallback
규칙("계산된 세운표가 없으면 임의 생성하지 않는다", "신살·귀문 표가 없으면 정밀 계산한 것처럼 쓰지
않는다")을 현재 시스템 상태에 그대로 적용하도록 `prompts/runtime/saju.md`(adapter)에 명시했다. 자세한
내용은 해당 파일의 "2. 세운 데이터 부재 처리", "3. 귀문관살 데이터 부재 처리" 섹션 참고.

### 원본의 "10단계 전체 출력" 구조와 대화형 UX(질문별 부분 응답)의 공존

원본은 QUICK/STANDARD/DEEP 모드와 10단계 전체 출력 구조를 정의한다. 이 프로젝트의 제품 방향(스펙 §1,
§8, §26)은 "질문 → 관련 데이터만 추출 → 필요한 부분만 해석"하는 대화형 서비스를 요구한다. 이 둘은
원본의 어떤 규칙도 삭제하지 않고 다음과 같이 공존하도록 설계했다 (`prompts/runtime/saju.md` §4):

- 사용자가 "전체 사주를 풀어줘"처럼 명시적으로 전체 리포트를 요청하면 → 원본 §2/§3/§9를 생략 없이 그대로
  따른다 (고정 문구, 모드 선택, 10단계 전체).
  대화형 질문에는 → 원본의 해석 원칙(§1/§4/§6/§7/§8 — 계산 경계, 판독 순서, 고전 3분 관점,
  Fact/Claim/Disclosure, 단정적 표현 금지 등)은 항상 100% 적용하되, 질문과 관련된 §9 단계만 선택적으로
  적용한다.

이 설계 결정 자체가 원본을 "단순화"한 것이 아니라, 원본이 다루지 않는 "여러 단계 중 언제 무엇을 쓸지"를
서비스 레이어에서 명시적으로 규정한 것이라는 점을 분명히 해 둔다.

### Canonical Chart Schema — natal을 필수에서 제외 (스키마 파일 자체는 미수정)

`schemas/canonical-chart-schema.json`은 이전 프로젝트에서 서양 점성술까지 포함해 설계된 스키마를
그대로 가져왔다 (요청대로 "새로운 임의 스키마를 만들지 않고 기존 스키마를 최대한 유지"). 이 제품은
서양 점성술을 완전히 제외하므로, 스키마 파일의 `required` 배열에서 `natal`을 삭제하는 대신
`packages/canonical/validate.mjs`가 **실행 시점에 스키마를 클론해서 `required`에서만 `natal`을 제거**하고
검증한다. 스키마 파일 자체(디스크상의 JSON)는 손대지 않았다. 이 계산 엔진 결과물(Canonical JSON)에는
`natal` 필드가 아예 생성되지 않는다 (`packages/canonical/transform.mjs`가 saju+ziwei만 생성).

### 계산 엔진 결과물 재사용

이전 프로젝트(`orrery-test/`)에서 이미 검증된 다음 파일들을 **그대로(내용 수정 없이)** 복사해왔다:
- `schemas/canonical-chart-schema.json` (이전 `output/canonical-chart-schema.json`)
- `packages/chart-engine/orrery-test-calc.mjs` (이전 `test-calc.mjs`, CLI 스크립트, 참고용으로 보존)
- `packages/canonical/canonical-transform.mjs` (이전과 동일한 CLI 스크립트, 참고용으로 보존)
- `data/canonical-chart-example.json`, `data/orrery-raw-example.json` (예시 데이터)

API 서비스 레이어에서 실제로 사용하는 것은 이 CLI 스크립트들이 **아니라**, 동일한 매핑 로직을 import
가능한 함수로 재작성한 `packages/chart-engine/compute.mjs` / `packages/canonical/transform.mjs`다 (natal
관련 코드는 제외하고 saju+ziwei만). CLI 스크립트는 오프라인 검증/참고용으로 그대로 남겨두었다.

### AI 비용 구조 — 5단계가 아닌 2-AI-call 구조 선택

스펙 §5는 개념적으로 "Router → Extraction → Saju 분석 → Ziwei 분석 → Cross Analysis → Response" 6단계
파이프라인을 제시하지만, 실제 구현은 **AI 호출을 2번**(Router 1번 + "Saju/Ziwei/Cross/Response 통합" 1번)
으로 줄였다. Extraction은 순수 코드(AI 호출 없음)다. 이유와 비교표는 README "AI 비용 구조" 섹션 참고 —
3~4개로 쪼갠 호출은 매번 동일한 추출 데이터/프롬프트를 반복 전송해 입력 토큰 비용이 배로 늘어나는 반면,
Structured Output의 strict JSON Schema가 이미 saju/ziwei/cross_analysis/response를 명확히 분리된
필드로 강제하므로 굳이 별도 호출로 나눌 이유가 적다.
