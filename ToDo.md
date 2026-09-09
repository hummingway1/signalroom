# ToDo.md

## 완료된 Phase (실제 코드 기준, 458+ 테스트로 검증됨)

| Phase | 내용 | 상태 |
|---|---|---|
| STEP 1~6 | Supabase 인증(Kakao/Naver OAuth), 결제 인프라(Toss), UI 리디자인(teal), 출산택일/타이밍 검증 | ✅ |
| 1차 상품정책 | 990원/4900원 tier 분리(사주/자녀/궁합), Luna/Terra 모델 라우팅, 채팅 10회/24시간 | ✅ |
| Phase 2 | `analysis_scopes` 테이블 신설, `entitlements.analysis_id/analysis_type` 연결 기반 | ✅ |
| Phase 3 | 서버측 질문 도메인 판정, 클라이언트 entitlementId 불신뢰, LLM 호출 전 authorization gate | ✅ |
| Phase 4 | Payment → analysis_scope → entitlement 실제 연결(같은 트랜잭션) | ✅ |
| Phase 5 | 신년운세(YEARLY_FORTUNE) 상품/analysis_scope, conversation-scoped 도메인 판정 | ✅ |
| Phase 6 | 명리구독(MINGRI)/아이시그널구독(CHILD_SIGNAL), 복합 질문 처리 | ✅ |
| Phase 7 | 전체 entitlement 정책 통합 검증(Mock, 540 테스트) | ✅ |
| Phase 8 | **실제 Supabase 통합검증**, 실사용 버그 2건 발견/수정(컬럼명 불일치, quota 미차감) | ✅ |
| Phase 9 | 신년운세 콘텐츠 생성(BASIC/CHAT, 영구열람)+프론트 UI 전체 | ✅ |

**현재 테스트: 568개 (전체 통과), 마이그레이션: 001~010**

## 알려진 미해결/보류 사항

| 항목 | 상태 | 비고 |
|---|---|---|
| ZIWEI_DETAIL 독립 상품 | 보류 | 실제 판매 상품 없음, SAJU_DETAIL 번들 유지 중 |
| RELATIONSHIP_DETAIL(궁합) 2-chart 구조 | 미해결 | `analysis_scopes.chart_id`가 1개뿐이라 스키마 확장 필요 |
| 신년운세 복합 질문(SAJU+YEARLY_FORTUNE 동시) | 부분 구현 | Router의 saju_fields로 일반 필드 필요 여부만 판정, 완전한 다중 scope 결합은 미완 |
| 실제 브라우저 수동 QA | 미실행 | 샌드박스 환경 한계, 사용자가 로컬에서 직접 확인 필요 |
| YEARLY_FORTUNE 실제 콘텐츠 품질(글자수/톤) | 미검증 | 실제 OpenAI API로 생성해본 적 없음(지금까지 전부 MockAIProvider) |

## 다음 우선순위 후보 (확정 아님, 논의 필요)

1. 실제 OpenAI API 키로 신년운세 BASIC/CHAT 1건씩 실제 생성 → 글자수/품질 확인
2. ZIWEI_DETAIL 독립 상품 여부 최종 결정
3. RELATIONSHIP_DETAIL 스키마 확장(궁합 2인 데이터 지원)
4. 명리구독/아이시그널구독 UI(현재 백엔드만 존재, 구매 화면 없음)
5. 실제 브라우저 모바일 QA
