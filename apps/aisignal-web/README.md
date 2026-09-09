# 아이시그널 (aisignal-web)

Figma Make 프로젝트 **"AI 사주 상담 웹앱 디자인"**(파일 키 `FG2EYLkUB8aoSS2EGbrqRE`)을
코드로 구현한 모바일 웹앱입니다.

> 참고: Figma 파일 이름은 "AI 사주 상담"이지만, Make 안에서 실제로 만들어진 프로토타입은
> **아이의 기질·상황을 대화형으로 살펴보는 육아 상담 앱 "아이시그널"** 입니다. 이 저장소의
> 구현은 Make 소스(`src/app/App.tsx`)의 현재 상태를 그대로 따릅니다.

## 실행

```bash
cd apps/aisignal-web
npm install
npm run dev      # http://localhost:5174
npm run build    # dist/ 정적 번들
npm run preview  # 빌드 결과 미리보기
```

## 스택

- React 18 + Vite 6
- Tailwind CSS v4 (`@tailwindcss/vite`)
- lucide-react 아이콘

원본 Make 코드는 TypeScript 단일 파일이었지만, 이 저장소(`apps/web` 등)가 모두 순수 JS/JSX를
쓰므로 동일하게 **JSX로 변환**하고 화면·데이터·컴포넌트 단위로 파일을 분리했습니다.

## 구조

```
src/
  main.jsx                  진입점
  App.jsx                   화면 라우팅 (useState 기반 상태 머신)
  styles/index.css          Tailwind + 키프레임(msgIn/cardIn/fadeUp/barGrow/dotBounce) + phone-shell
  data/
    topics.js               고민 주제 6종 (TOPICS)
    personality.js          주제별 기질 분석 프로필 (기본/상세 분석 콘텐츠)
  components/
    SolAvatar.jsx           상담사 "솔이" 프로필 (인라인 SVG, 나중에 일러스트로 교체 가능)
    BrandLogo.jsx           서비스 로고
  screens/
    HomeScreen.jsx          첫 진입 — 히어로 + CTA, 기록 있으면 "이어보기"
    TopicScreen.jsx         고민 주제 2열 그리드 선택
    ChildInfoScreen.jsx     대화형 3단계 입력 (이름 → 생년월일 → 성별)
    ChatScreen.jsx          메인 DM — 타이핑 인디케이터, 순차 메시지, Quick Reply, 발견/CTA 카드
    BasicAnalysisScreen.jsx 무료 분석 — 기질 유형, 지표 막대, 특징, 프리미엄 업셀
    DetailAnalysisScreen.jsx 상세 분석 — 기질/관계/감정/조언 탭
    ReturnScreen.jsx        재방문 — 이전 결과 요약 + 후속 질문
```

## 화면 흐름

```
home → topic → childInfo → chat → basic → detail
                              ↑              ↓
                          (더 이야기하기)  (뒤로)
home ⇄ return (basic를 한 번 본 뒤부터 "이어보기"로 진입)
return → chat (이어서) 또는 topic (새 고민)
```

## 원본과 달라진 점

- **생년월일 입력 3칸**에 `min-width: 0`을 추가해 390px 폭에서 가로 넘침이 없도록 고쳤습니다.
  (원본은 좁은 화면에서 입력칸이 셸 밖으로 밀려났습니다.)
- 앱 최상위 컨테이너에 `overflow-x: hidden`을 추가했습니다.
- `prefers-reduced-motion` 사용자를 위해 애니메이션을 끄는 미디어 쿼리를 추가했습니다.

## 데모 스크립트 안내

`ChatScreen.jsx`의 `STEPS` 배열은 Make 프로토타입의 **하드코딩된 데모 대본**입니다. 실제
서비스에서는 이 자리에 백엔드(사주/기질 계산 + AI 응답)가 들어갑니다.
