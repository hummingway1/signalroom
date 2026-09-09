# SIGNAL ROOM Vercel 배포 가이드

## 1. Vercel 프로젝트 생성

1. https://vercel.com 에서 GitHub 저장소(이 repo)를 Import
2. **Root Directory를 `apps/web`으로 설정** (모노레포 구조라 필수)
3. Framework Preset: Vite (자동 감지됨)
4. Build Command / Output Directory는 `apps/web/vercel.json`에 이미 설정되어 있어 자동 적용됨

## 2. 환경변수 설정 (Vercel Project Settings > Environment Variables)

| 변수명 | 값 | 비고 |
|---|---|---|
| `VITE_API_BASE_URL` | 실제 백엔드(apps/api) 서버의 공개 URL | 백엔드를 아직 배포 안 했다면 잠시 비워둬도 빌드는 되지만, 이 경우 localhost로 fallback되어 API 호출이 전부 실패함 - 반드시 백엔드도 함께 배포 후 이 값을 채워야 정상 작동 |
| `VITE_TOSS_CLIENT_KEY` | (비워둠) | Toss Payments 가입 전이므로 비워둔 채로 배포해도 안전 - 결제 화면에서 "결제 기능이 아직 설정되지 않았어요" 안내만 뜨고 결제 자체는 자동으로 막힘 |

## 3. 백엔드(apps/api) 배포 필요

이 프론트엔드는 별도의 백엔드 API 서버(apps/api)가 실행 중이어야 정상 작동합니다.
Vercel은 프론트엔드(정적 SPA)만 호스팅하므로, 백엔드는 별도로 배포해야 합니다
(예: Railway, Render, Fly.io 등 Node.js를 상시 실행할 수 있는 서비스).

백엔드 배포 시 필요한 환경변수(.env.example 참고): DATABASE_URL, OPENAI_API_KEY/
OPENAI_MODEL, SESSION_SECRET 등.

**중요 — `FRONTEND_BASE_URL`도 함께 바꿔야 함**: 백엔드 `.env`의 `FRONTEND_BASE_URL`은
카카오/네이버/구글 로그인 성공/실패 후 사용자를 되돌려보낼 프론트 주소다. 지금은
`http://localhost:5173`로 되어 있는데, 백엔드를 실제로 배포하는 시점에 **반드시 Vercel에서
발급받은 실제 프론트 주소**(예: `https://[프로젝트].vercel.app`)로 바꿔야 한다 — 안 바꾸면
로그인 후 사용자가 로컬 개발 주소로 리다이렉트되어 로그인 자체가 실패한다. 카카오/네이버/
구글 개발자 콘솔에 등록해둔 Redirect URI(`KAKAO_REDIRECT_URI` 등)도 실제 배포된 백엔드
주소로 함께 갱신해야 한다.

## 4. 배포 후 확인 체크리스트

- [ ] https://[프로젝트].vercel.app 접속 시 SIGNAL ROOM 별밤 화면이 정상 표시되는지
- [ ] 사주/자미두수/궁합/아이시그널/멤버십/출생일 택일 클릭 시 실제 화면으로 진입하는지
- [ ] 작명소 클릭 시 "COMING SOON, 추후 서비스 예정" 안내만 뜨고 결제로 안 이어지는지
- [ ] SIGNAL ROOM 화면 최하단의 "마이페이지 · 이용약관 · 개인정보처리방침" 링크 클릭 시
      마이페이지로 정상 진입하는지(§이번 라운드에서 실제로 이 진입점 자체가 없던 버그를
      발견해서 고쳤음 — SignalRoomHome.jsx에 onOpenMyPage prop과 footer 링크 추가)
- [ ] 로그인 -> 마이페이지 -> 이용약관/개인정보처리방침/사업자 정보 페이지 진입 확인
- [ ] 새로고침(F5) 시 빈 화면 없이 정상 로드되는지(vercel.json의 SPA rewrite 확인용)
- [ ] 개발자도구 Network 탭에서 API 호출이 localhost:3000이 아니라 실제 배포한 백엔드 주소로 가는지

**이번 라운드에서 실제 Playwright 브라우저로 확인 완료(로컬 빌드 기준)**: SIGNAL ROOM →
footer 링크 → 마이페이지 → 이용약관 페이지 표시 → 뒤로가기로 SIGNAL ROOM 정상 복귀까지
전부 실측 확인함. Vercel 실제 배포 후에는 위 체크리스트를 실제 공개 URL에서 다시 확인 필요.

## 5. 아직 하지 않은 것 (이번 단계 범위 밖)

- 백엔드(apps/api) 자체의 실제 배포
- Toss Payments 가입 후 VITE_TOSS_CLIENT_KEY/TOSS_SECRET_KEY 실제 값 입력
- 이용약관/개인정보처리방침/사업자정보 페이지의 [placeholder] 실제 값 채우기 -
  apps/web/src/components/LegalScreen.jsx에서 직접 수정
- 커스텀 도메인 연결
