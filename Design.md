# Design.md

> 마지막 지시 메시지가 "Design.md ... 최소한 다음"에서 끊겨서, 요구하신 구체적 항목 목록을 받지 못했습니다. 아래는 실제 코드(`apps/web/src/styles/app.css`)를 기준으로 정리한 기본 구성이며, 빠진 항목이 있으면 알려주시면 추가하겠습니다.

## 0. 실제 서비스 프론트 위치

`apps/web`(package명 `saju-web`)이 실제 서비스 프론트엔드다. `apps/aisignal-web`는 Figma Make 프로토타입(파일 키 `FG2EYLkUB8aoSS2EGbrqRE`)을 그대로 옮긴 **디자인 참고용 코드**로, 실제 서비스에 연결되어 있지 않다 — 새 화면 만들 때 디자인 레퍼런스로만 참고.

## 1. 디자인 토큰 (`apps/web/src/styles/app.css`)

| 토큰 | 값 | 용도 |
|---|---|---|
| `--background` | `#F4FAF8` | 전체 배경 |
| `--foreground` | `#1A3344` | 기본 텍스트 |
| `--card` | `#FFFFFF` | 카드 배경 |
| `--primary` | `#39A89B` | 브랜드 teal, 버튼/강조 |
| `--secondary` | `#EDF8F6` | 보조 배경 |
| `--muted` | `#E4F3F0` | 흐린 배경 |
| `--muted-foreground` | `#5A7A8A` | 보조 텍스트 |
| `--accent` | `#F07A6A` | 경고/포인트(코럴) |
| `--border` | `rgba(26,51,68,0.1)` | 구분선 |
| `--radius` | `1rem` | 기본 모서리 |
| `--max-width` | `390px` | 폰 셸 최대 너비(모바일 전용) |

**폰트**: Pretendard → Noto Sans KR fallback.

## 2. 레이아웃 원칙

- **모바일 전용**, 390px 폭 기준. 데스크톱 대응 없음.
- 하단 고정 요소(채팅 입력창 등)는 `--safe-bottom`(`env(safe-area-inset-bottom)`)으로 iOS 안전영역 대응.
- 화면 전환은 `App.jsx`의 `screen` 문자열 state 하나로 관리(react-router 미사용) — 신규 화면 추가 시 이 패턴 유지.

## 3. 컴포넌트 패턴

- **`AnalysisCard.jsx`**: 분석 결과 섹션의 기본 카드 단위. 한지 질감/그라데이션 배경, `title`/`content` 구조. 신년운세 결과 화면(`YearlyFortuneResult.jsx`)도 이 클래스(`analysis-card`)를 재사용.
- **`subscreen` / `subscreen__header` / `subscreen__body`**: 뒤로가기+홈 버튼이 있는 하위 화면의 공통 레이아웃 클래스. 상품 선택, 신년운세 등 새 화면은 이 구조를 그대로 따름.
- **채팅 화면**: `ChatHeader` + `MessageList`(`MessageBubbles`) + `ChatInput` + `TypingIndicator` 조합. AI 답변은 여러 버블로 자동 분리(`splitIntoBubbles`), 사용자 입력은 50자 제한(카운터 UI 포함).
- **버튼**: `products-screen__buy-btn` 클래스가 사실상 primary CTA 버튼의 표준(신년운세 구매/업셀 버튼도 재사용 중).

## 4. 톤앤매너

- 캐릭터 2종(daegu/manggu 등, `characters.mjs`)이 대화 페르소나를 가짐 — 딱딱한 "AI 상담" 톤이 아니라 친근한 캐릭터 채팅 톤.
- 명리학 용어(십신/용신/격국 등)를 전면에 내세우지 않고, 일반 사용자가 이해하기 쉬운 표현으로 풀어씀.
- "AI가 아무 근거 없이 답한다"는 인상을 주지 않기 위해, 실제 계산된 데이터(원국/세운) 기반임을 은근히 드러내는 문구를 씀(예: 신년운세 진입 애니메이션 아이디어 등 — 아직 미구현).

## 5. 향후 유지해야 할 기준

- 새 상품(신년운세 등) 도입 시에도 **기존 teal 팔레트/카드 패턴을 그대로 재사용**, 새 디자인 시스템을 만들지 않는다(Phase 9에서 실제로 이 원칙을 지켜 구현함).
- 결과 화면은 항상 "실제 데이터에 있는 필드만 렌더링, 없으면 자연스럽게 숨김" 원칙(YearlyFortuneResult.jsx 참고).
- quota/만료 등 숫자·날짜는 항상 서버 응답값을 그대로 표시, 프론트에서 계산하지 않는다.
