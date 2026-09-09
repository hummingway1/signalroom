# FIGMA_HANDOFF.md — 아이시그널 디자인 시스템 핸드오프

> 아래 값은 전부 `apps/web/src/styles/app.css`에서 실제로 그대로 추출했다. 새로 만든 값이
> 아니다 — Figma 작업 시 이 값을 기준(Source of Truth)으로 삼는다.

## 디자인 시스템 (현재 실제 값)

### 색상

| 토큰 | 값 | 용도 |
|---|---|---|
| `--background` | `#F4FAF8` | 화면 배경(연한 민트) |
| `--foreground` | `#1A3344` | 기본 텍스트(진한 네이비) |
| `--card` | `#FFFFFF` | 카드 배경 |
| `--card-foreground` | `#1A3344` | 카드 안 텍스트 |
| `--primary` | `#39A89B` | 브랜드 색(teal), 버튼/강조 |
| `--primary-foreground` | `#FFFFFF` | primary 위 텍스트 |
| `--secondary` | `#EDF8F6` | 보조 배경(연한 teal) |
| `--secondary-foreground` | `#1A3344` | secondary 위 텍스트 |
| `--muted` | `#E4F3F0` | 흐린 배경 |
| `--muted-foreground` | `#5A7A8A` | 흐린 텍스트(블루그레이) |
| `--accent` | `#F07A6A` | 강조색(산호색) |
| `--accent-foreground` | `#FFFFFF` | accent 위 텍스트 |
| `--border` | `rgba(26, 51, 68, 0.1)` | 테두리(네이비 10% 투명) |

### Typography
- **폰트**: `Pretendard`(1순위), `Noto Sans KR`(폴백), 시스템 sans-serif
- `word-break: keep-all` — 한글 줄바꿈 원칙(단어 중간에서 안 끊김)

### Spacing / Border Radius
- `--radius: 1rem`(16px) 기본값
- 실제 코드에서 가장 흔한 radius: **16px**(카드류), **999px**(칩/필 형태 버튼)
- 모바일 화면 최대 너비: `--max-width: 390px`
- 하단 안전영역: `env(safe-area-inset-bottom, 0px)` 반영(`--safe-bottom`)

### 카드 스타일 (`home-service-card`, `products-screen__card` 등 공통 패턴)
- 배경: `var(--card)`(흰색)
- 테두리: `1px solid var(--border)`
- radius: 16~18px
- 그림자 없음(플랫 디자인, border로만 구분)

### 버튼 스타일
- 기본 버튼(`intake-submit` 등): `var(--primary)` 배경, 흰 텍스트, radius 10~16px
- 보조 버튼(`nickname-signup__social-btn` 등): `var(--secondary)` 배경, `cursor: pointer`
  (⚠️ 과거 "준비 중" 상태의 잔재로 `not-allowed` 커서가 남아있던 실제 버그 이력 있음 — 지금은
  수정됨, Figma에서 비활성 버튼 디자인 시 커서 상태를 명확히 구분해서 표시할 것)

### 입력창 스타일
- `<input>`/`<select>` — 별도 커스텀 클래스 없이 폼 요소 기본 스타일에 최소 패딩만 적용된 상태
  (디자인 다듬기가 아직 안 된 영역 — Figma 우선순위 높음)

### Chat Bubble
- 클래스: `msg-in`(등장 애니메이션), `MessageBubbles.jsx`/`MessageList.jsx`가 렌더링 담당
- 애니메이션: `msgIn 0.28s cubic-bezier(0.34, 1.56, 0.64, 1)` — 살짝 튀어오르는 느낌(bounce)

### 추천 질문 Chip (`quick-reply-chip`)
- 배경: `var(--background)`
- 테두리: `1.5px solid var(--border)`
- radius: `999px`(완전한 필 형태)
- 패딩: `8px 16px`, 최소 높이 `36px`(터치 영역 확보)
- 그림자: `0 1px 4px rgba(42, 30, 26, 0.07)`
- 클릭 시: `scale(0.95)` 축소 애니메이션

### 분석 결과 카드
- `AnalysisCard.jsx`가 공용 담당 — 별도 전용 CSS 클래스 체계는 아직 화면별로 분산되어 있어 통합
  디자인 시안이 필요한 영역(Figma 우선순위 중간)

### Home 카드
- 히어로: `linear-gradient(145deg, #DFF5F0 0%, #C4EAE4 100%)` 배경, radius 24px
- 서비스 카드 3개: 동일 크기, 아이콘 배지(44×44px, radius 14px, `var(--secondary)` 배경)

## 모바일 화면 기준
- 최대 너비 390px 안에서 모든 화면이 동작(웹뷰/앱 공용 전제)
- 터치 영역: 최소 36px 높이 확보 원칙(칩 기준), 화면 최상단/최하단 요소는 좌우 여백 최소 4px 이상
  확보(과거 "화면 끝에 붙어서 터치 어려움" 실제 피드백 반영 이력 있음)

## 공통 컴포넌트 (Figma 컴포넌트화 우선순위)
1. Chat bubble(캐릭터/사용자 구분)
2. Quick-reply chip
3. 서비스 카드(홈)
4. 상품 카드(결제)
5. 헤더 바(뒤로가기 + 제목 + 홈 버튼) — `subscreen__header` 패턴, 대부분의 서브 화면이 공유

## 화면별 디자인 요구사항 (Figma 우선순위)

| 화면 | 우선순위 | 사유 |
|---|---|---|
| ChildSajuScreen | 높음 | 한 화면에 여러 상태(입력/대화/분석버튼)가 몰려있어 상태별 시안 필요 |
| ProductsScreen/결제 결과 화면 | 높음 | 이번에 막 만들어져서 디자인 다듬기 전혀 안 됨 |
| BirthDataForm/입력창 전반 | 중간 | 폼 요소가 브라우저 기본 스타일에 가까움 |
| AnalysisCard(분석 결과 공통) | 중간 | 화면마다 표현이 조금씩 다름, 통일 필요 |
| Home/ServiceIntro | 낮음 | 최근에 이미 디자인 갱신됨 |
| 궁합/사주대결 결과 | 낮음 | 기존 디자인 유지 중 |

## 애니메이션이 필요한 위치
- Chat bubble 등장: `msgIn`(이미 있음, 참고용)
- 홈 화면 요소 등장: `fade-up`(이미 있음)
- Quick-reply chip 클릭: `scale(0.95)`(이미 있음)
- **결제 결과 화면**: 아직 애니메이션 없음(신규 추가 후보)
- **마이페이지 진입**: 아직 애니메이션 없음(신규 추가 후보)
