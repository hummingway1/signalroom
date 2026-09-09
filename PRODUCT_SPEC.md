# PRODUCT_SPEC.md — 아이시그널 제품 명세 (단일 기준 문서)

> 이 문서는 실제 코드베이스(2026년 기준 최신 상태)를 직접 조사해서 작성했다. 기획과 실제 구현이
> 다른 부분은 "⚠️ 기획과 다름"으로 명시했다. 이 문서에 없는 기능은 구현되지 않은 것이다.

---

## 1. 서비스 구조 (실제 코드 기준)

홈 화면(`HomeScreen.jsx`)은 3개 서비스를 **동일한 크기의 카드**로 보여준다(디자인 갱신 이력에 따라
"아이시그널만 부각되지 않게" 균형 배치로 변경됨 — 기획서의 "메인 서비스" 개념과 화면상 시각적
위계는 일치하지 않음).

```
Home
 ├─ 아이시그널 (child)   → ServiceIntro → ChildSajuScreen (자녀 출생정보 입력 → 캐주얼 대화 → 기본/전체 분석)
 ├─ 나의 시그널 (saju)   → ServiceIntro → WelcomeScreen → BirthDataForm → ChatScreen (사주+자미두수 통합 대화)
 └─ 관계 시그널 (relationship) → ServiceIntro → (내 정보 있으면 바로, 없으면 BirthDataForm) → CompatibilityScreen 또는 SajuBattleScreen
```

### 1-1. 아이시그널
- 아이 출생정보 입력(`ChildSajuScreen` 내부, 이름/생년월일/시간/성별)
- 캐주얼 대화(대구/맹구 등 캐릭터, 사주 판단 없이 반응만)
- 부모의 고민 파악 → target(parent/child/relationship) 분류 → depth(NONE/LIGHT/FOCUSED/DEEP) 결정
- 기본 사주 분석(무료 1회, `gpt-5.6-luna`) / 전체 분석(유료, `gpt-5.6-terra`) — **tier로 구분**
- ⚠️ "이후 아이 성장 코치 채팅 구독"은 **코드에 없음** — 구독 관련 모델/라우트/DB 전혀 없음(기획 단계)

### 1-2. 나의 시그널
- 사주 + 자미두수 통합(같은 대화 안에서 질문에 따라 `saju_fields`/`ziwei_fields`를 동적으로 라우팅)
- 화면 진입 흐름에 "사주"/"자미두수"를 별도로 나누는 화면 분기는 없음(기획서의 "사주/자미두수"
  하위 항목 구분은 화면 레벨이 아니라 대화 내 질문 라우팅 레벨에서만 존재)
- ⚠️ **`ServiceIntroScreen`에 "무료"로 표시됨** — §4 가격 정책(990원)과 다름, 실제 결제 연결 없음

### 1-3. 관계 시그널
- 궁합(`CompatibilityScreen`) — 실제 상대방 생년월일/시간/성별을 직접 입력받아 실제 계산 엔진으로
  계산(가짜 데이터 아님)
- 사주 대결(`SajuBattleScreen`) — 마찬가지로 상대방 정보 실제 입력, 실제 계산
- ⚠️ **`ServiceIntroScreen`에 "무료"로 표시됨** — §4 가격 정책(990원)과 다름

---

## 2. 화면별 명세

### Home (`HomeScreen.jsx`)
- **목적**: 서비스 3개 진입점 + 로그인 상태 표시
- **진입 경로**: 앱 최초 진입
- **표시 요소**: 브랜드명, 로그인/닉네임 버튼, 히어로 카드(브랜드 소개, 특정 서비스 아님), 서비스
  카드 3개(이모지+제목+설명)
- **사용자 입력**: 없음(선택만)
- **버튼/액션**: 서비스 카드 클릭 → intro로, 닉네임 클릭 → mypage로, 로그인 버튼 → signup으로
- **API 호출**: 없음(단, 로그인 상태는 `App.jsx` 전역에서 `/api/auth/me`로 이미 조회됨)
- **다음 화면**: intro, mypage, signup
- **오류/예외**: 없음
- **구현 상태**: 완전 구현
- **Figma 필요 여부**: 낮음(이미 최근 디자인 반영됨)

### Service Intro (`ServiceIntroScreen.jsx`)
- **목적**: 서비스 선택 직후 설명 + 가격 안내(개인정보 안내 포함, 아이시그널만)
- **진입 경로**: Home에서 서비스 카드 클릭
- **표시 요소**: 서비스 설명, 가격 문구(§1 표 참고), 아이시그널만 개인정보 안내 박스
- **버튼/액션**: "다음" → 서비스별 분기(§1), 뒤로가기
- **API 호출**: 없음
- **다음 화면**: welcome(사주), child(아이시그널), birth 또는 compatibility/battle(관계)
- **구현 상태**: 완전 구현
- **Figma 필요 여부**: 낮음

### Child Coach 관련 (`ChildSajuScreen.jsx`)
자녀 프로필 생성, 캐주얼 대화, 카탈로그 선택지, 기본/전체 분석 버튼을 한 화면 안에서 전부 처리하는
통합 화면. 지시서가 나눈 "Child Profile / Child Analysis / Child Chat"이 **코드에서는 별도 화면이
아니라 하나의 컴포넌트 안에서 상태(state)로 구분**된다.

- **목적**: 자녀 정보 입력 → 대화 → 분석까지 전 과정
- **진입 경로**: intro → child
- **표시 요소**: 자녀 출생정보 폼(최초 1회), 캐릭터 대화 버블, `suggestedQuestions` 칩(최대 3개),
  2턴 이후 "기본/전체 분석" 버튼
- **사용자 입력**: 자녀 이름/생년월일/시간/성별, 자유 텍스트 메시지
- **API 호출**: `POST /api/child-profiles`, `POST /api/child-profiles/:id/analyses`,
  `GET /api/child-profiles/:id/context`, `POST /api/conversations/:id/messages` 등
- **오류/예외**: 무료 1회 이미 사용 시 서버가 명시적으로 차단(`hasUsedFreeChildAnalysis`)
- **구현 상태**: 완전 구현(무료 게이팅, target/intent/depth, evidence 전부 실제 동작)
- **Figma 필요 여부**: 중간(화면 하나에 여러 상태가 몰려있어 디자인 시안이 상태별로 필요)

### My Signal / Saju / Ziwei (`WelcomeScreen.jsx` → `BirthDataForm.jsx` → `ChatScreen.jsx`)
- **목적**: 본인 사주+자미두수 통합 대화
- **진입 경로**: intro(saju) → welcome → birth → chat
- **표시 요소**: 대구 캐릭터 인사(welcome), 생년월일/시간/성별/도시 입력폼(birth), 대화 버블+
  선택지 칩(chat)
- **API 호출**: `POST /api/charts`, `POST /api/charts/:id/questions`,
  `POST /api/conversations/:id/messages`, `GET /api/conversations/:id/opening-choices`
- **오류/예외**: 방금 발견/수정된 "fetch" 원문 노출 버그는 친화적 메시지로 개선됨(§실사용 버그
  수정 이력 참고, `useChatController.js`)
- **구현 상태**: 완전 구현
- **Figma 필요 여부**: 낮음

### Relationship / Compatibility / Saju Battle
- **CompatibilityScreen.jsx**: 상대방 정보 입력 → 실제 궁합 계산(`analyzeCompatibilityFact`,
  `rankCandidates`류 엔진 재사용) → 결과 카드 + `ShareCard`(공유 기능 여기만 부분 구현)
- **SajuBattleScreen.jsx**: 상대방 정보 입력 → 실제 사주 대결 계산(`generateCompatibilityResult`)
- **구현 상태**: 둘 다 완전 구현(가짜 데이터 없음)
- **Figma 필요 여부**: 낮음

### 결과 화면
별도의 공용 "결과 화면" 컴포넌트는 없음 — 각 서비스(child/saju/compatibility/battle)가 자기
화면 안에서 결과를 인라인으로 표시한다. `AnalysisCard.jsx`가 분석 결과 카드 UI를 공용으로 담당.

### 공통 Chat UI
- `MessageList.jsx`/`MessageBubbles.jsx`/`ChatInput.jsx`/`QuickReplyChips.jsx`/
  `TypingIndicator.jsx`/`ChatHeader.jsx`/`ChatBackground.jsx` — 사주/자미두수 대화와 자녀 코치
  대화가 이 컴포넌트들을 공유한다.
- **suggestedQuestions**: 실제 구현됨(캐주얼 응답 스키마에 포함, OpenAI strict 모드 제약을
  맞추기 위해 `required`에 포함하고 빈 배열 허용 방식으로 처리 — 이전 버그 수정 이력 참고)
- **긴 응답 문단 분리**: `utils/splitIntoBubbles.js`로 실제 구현됨 — API 1회 호출 후 여러 채팅
  버블로 순차 표시(요청하신 "API 1회 호출 후 여러 채팅 버블" 정확히 이 파일이 담당)

---

## 3. 현재 기능 상태

| 기능 | 상태 | 비고 |
|---|---|---|
| 추천 질문(suggestedQuestions) | ✅ 구현됨 | 캐주얼/자녀코치 응답에 포함, 최대 3개 |
| 긴 응답 문단 분리 | ✅ 구현됨 | `splitIntoBubbles.js` |
| API 1회 호출 후 여러 버블 | ✅ 구현됨 | 위와 동일 메커니즘 |
| 무료 기본 분석 1회 | ✅ 구현됨(자녀만) | `hasUsedFreeChildAnalysis`로 서버 강제. **본인 사주(나의 시그널)는 애초에 전체가 무료라 게이팅 자체가 없음** |
| 기본 분석 Luna 모델 | ✅ 구현됨 | `OPENAI_CHILD_COACH_MODEL` env로 관리(하드코딩 아님) |
| 상세 분석 Terra 모델 | ✅ 구현됨 | `OPENAI_MODEL` env로 관리 |
| Child Profile ID 연결 | ✅ 구현됨 | 대화/분석/이용이력 전부 `child_profile_id`로 추적 |
| target/intent/depth | ✅ 구현됨 | `packages/character/casual-chat-prompt.mjs` |
| evidence | ✅ 구현됨 | `packages/character/behavioral-evidence/` (12개 근거 파일) |
| education evidence | ✅ 구현됨 | confidence(strong/moderate)에 따라 표현 차등 |
| 개인정보 관련 기능 | 부분 구현 | 아이시그널 소개 화면에 안내 문구만 있음. 별도 개인정보 설정/동의 관리 화면은 없음 |
| 궁합 실제 계산 | ✅ 구현됨 | 가짜 데이터 아님, 실제 두 명 Canonical Chart 기반 |
| 사주 대결 상대방 입력 | ✅ 구현됨 | 실제 입력폼 존재 |
| 결제(인프라) | ✅ 구현됨(연결 미완료) | Product/Order/Payment/Entitlement + Toss 승인 트랜잭션 실제 구현. **단, 아직 어느 분석 화면도 "결제된 entitlement 확인 후 제공" 흐름으로 연결되어 있지 않음** — 결제와 실제 서비스 제공(분석 gating)이 아직 분리되어 있음 |
| 구독 | ❌ 미구현 | 코드/DB 전혀 없음(기획 단계) |
| 공유 기능 | 부분 구현 | `ShareCard.jsx`가 궁합 결과 화면에만 연결됨. 사주/자녀 분석 결과에는 없음 |
| 인증(카카오/네이버/구글/로그아웃/마이페이지) | ✅ 구현됨 | STEP3~4에서 완성, 실제 카카오 로그인 E2E 확인됨 |

---

## 4. 가격 정책 — 기획 vs 실제 코드

| 상품 | 기획 가격 | 실제 코드(화면 표시) | 실제 결제 연결 |
|---|---|---|---|
| 아이시그널 기본 | 990원(최초 1회 무료) | "990원, 첫 이용 무료" 표시 일치 | ❌ 아직 미연결(§3 참고) |
| 아이시그널 전체 분석 | 10,000원 미만 | 가격 미표시(그냥 "전체 분석은 별도 유료") | ❌ 미구현 |
| 나의 시그널(사주/자미두수 기본) | 990원 | ⚠️ **화면엔 "무료"로 표시** | 결제 자체 없음 |
| 나의 시그널 상세 | 10,000원 미만 | ❌ 상세/기본 구분 자체가 화면에 없음 | 미구현 |
| 아이 성장 코치 채팅 구독 | 4,900원 | ❌ 코드 없음 | 미구현 |
| 궁합 | 990원 | ⚠️ **화면엔 "무료"로 표시** | 결제 자체 없음 |
| 상세 궁합 | 4,900원 | ❌ 코드 없음 | 미구현 |
| 작명 | 100,000원 미만 | ❌ 코드 없음 | 미구현 |
| 출생일자 택일 | 20,000~30,000원 | 🔶 **기획/설계만 완료**(Mock 파이프라인 구현됨, 실제 상품 등록/가격 미설정 — "출산일시 택일" 명칭으로 별도 문서 진행 중) | 미구현 |

**Product 테이블 실제 시드 데이터(`migrations/003_seed_products.sql`)**: `SAJU_BASIC`,
`CHILD_BASIC`, `RELATIONSHIP_BASIC` 3개 전부 990원으로 등록되어 있음 — 이건 **DB에는 있지만
프론트 화면(무료 표시)과 아직 연결이 안 된 상태**임을 명확히 알아야 함(DB 스키마 준비 완료,
UI/실제 결제 트리거는 미완료).

---

## 5. 모델 정책 — 기획 vs 실제 코드

| 항목 | 기획 | 실제 코드 |
|---|---|---|
| 기본 무료 분석 | Luna | `OPENAI_CHILD_COACH_MODEL`(자녀 전용) — **본인 사주/나의 시그널은 이 구분 자체가 없고 `OPENAI_MODEL`(Terra) 하나만 씀** |
| 상세 분석 | Terra | `OPENAI_MODEL` |
| 아이 성장 코치 채팅 | Luna 기반 | 일치 — `OPENAI_CHILD_COACH_MODEL` |
| 비용 구조 원칙(Terra는 고가 상품 중심) | Terra=고가 전용 | ⚠️ **나의 시그널(현재 무료 표시)이 실제로는 Terra를 씀** — 무료 서비스에 고가 모델이 연결된 상태, 비용 정책과 실제 코드가 불일치 |

---

## 6~9. 문서 체계 원칙

- Figma는 디자인 기준, 이 코드베이스는 기능 기준, `PRODUCT_SPEC.md`가 둘을 연결.
- 새 기능은 이 문서에 먼저 정의 후 Figma/코드에 반영.
- 기능 수정 시: PRODUCT_SPEC 확인 → 코드 확인 → 수정 → 테스트 → PRODUCT_SPEC 갱신 →
  CHANGELOG 기록 순서를 지킨다.
- Figma 작업은 UI 레이어에 한정 — API/컨트롤러/테스트/계산 엔진/target·intent·depth/evidence를
  건드리지 않는다.
- 디자인 시스템 세부 사항은 `FIGMA_HANDOFF.md` 참고.
