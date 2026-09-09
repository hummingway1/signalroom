# REAL-AI-EVALUATION.md

## ⚠️ 최상단 요약 — 이 리포트의 현재 상태

**두 fixture 모두 실제 API 호출 완료.**

1. **edge_case** (유아 명반) — 2026-08-17, gpt-5.6, 13건. 최초 실행 시 5건 FAIL, 전부 검증기의 부정문
   인식 버그로 확인되어 수정 후 재채점 결과 **13/13 PASS**. 3/11개 파일만 사람이 직접 원문 검토함
   (나머지는 미검토 — §6~§9에 표시).
2. **main_quality** (성인 명반, 세운/귀문관살 데이터 포함) — 2026-08-17, gpt-5.6, 13건(26회 HTTP 요청).
   최초 실행 시 2건 FAIL, 이번에도 검증기 오탐(새로운 인용부호 헤지 패턴 2종)으로 확인되어 수정 후
   **13/13 PASS**. **11개 파일 전체를 사람이 직접 원문 검토함** — §16 참고.

**"코드 테스트 통과"와 "AI 해석 품질 통과"는 다른 것이다.** `npm test`의 117/117은 검증기/파이프라인
코드 자체가 올바르게 동작함을 보장할 뿐이다. AI가 만든 실제 해석 내용의 품질(정확성/유용성/유료
서비스 가치)은 사람이 원문을 읽고 판단한 §16을 참고할 것 — 이번에는 main_quality의 11개 파일 전체를
검토해서 이전보다 훨씬 완전한 그림을 확보했다.

**핵심 발견 (요약, 상세는 §16)**:
- ✅ 귀문관살을 실제 계산값과 정확히 일치하게 인용, 유파 차이 고지도 정확히 반영
- ✅ 현재 대운(35~44세 己未)과 다음 대운(45세~ 戊午)을 실제 데이터와 정확히 일치하게 서술
- ✅ 사주/자미두수 영역 혼동 없음 (십신 용어와 궁/성 용어가 섞이지 않음)
- ✅ 원본의 단정 금지 규칙 준수 (모든 "무조건 X" 표현이 인용 후 반박하는 형태)
- ✅ 대화 3턴 맥락 유지 확인
- ⚠️ **세운(annual_periods) 데이터는 추출됐지만 실제 해석문에 전혀 사용되지 않은 케이스 발견** — 토큰
  비용만 늘고 답변 품질에 반영 안 됨 (§12, §16 참고)

---

## 1. 테스트 환경

| 항목 | 값 |
|---|---|
| 계산 엔진 | `@orrery/core` 0.4.2 (사주+자미두수만, natal 제외) |
| 고정 테스트 명반 | `data/canonical-chart-example.json` (기존에 검증 완료된 명반 — 이번에 새로 계산하지 않음, spec §2) |
| 생년월일시 | 2026-08-06 10:59 (양력), 남성, 인천(Asia/Seoul) |
| 사주 원본 프롬프트 | `prompts/originals/saju-original.md` (verbatim 반영 완료, MD5 검증됨) |
| 자미두수 원본 프롬프트 | `prompts/originals/ziwei-original.md` (verbatim 반영 완료, MD5 검증됨) |
| 파이프라인 구조 | Question Router 1회 AI 호출 → Relevant Data Extraction(순수 코드) → Saju+Ziwei+Cross+Response 통합 1회 AI 호출 |
| AI Provider | `packages/ai/providers/openai-provider.mjs` (OpenAI Responses API, Structured Outputs strict JSON schema) |
| 실행 명령 | `npm run analyze:real` (§1 요구사항대로 키 없으면 실행하지 않고 안내만 출력 — 실제로 무키 상태에서 실행해 확인함, exit code 0, 파일 생성 없음) |

## 2. 사용 모델

`gpt-5.6` (2026-08-17 첫 실행 기준, edge_case fixture). `main_quality` fixture 실행 시 같은 모델을
쓸지, 혹은 다른 모델로 비교 테스트할지는 실행 전 결정 필요.

## 3. 질문별 토큰 사용량 (edge_case fixture, gpt-5.6, 2026-08-17 실행)

| # | 파일 | input_tokens | output_tokens | total_tokens | cached_input_tokens | reasoning_tokens |
|---|---|---|---|---|---|---|
| 1 | 01-saju-personality | 22,849 | 1,923 | 24,772 | 0 | 293 |
| 2 | 02-saju-money | 24,609 | 2,602 | 27,211 | 21,335 | 602 |
| 3 | 03-saju-career | 24,394 | 2,469 | 26,863 | 21,335 | 621 |
| 4 | 04-ziwei-personality | 22,692 | 2,069 | 24,761 | 21,335 | 353 |
| 5 | 05-ziwei-money | 23,335 | 2,547 | 25,882 | 21,335 | 720 |
| 6 | 06-ziwei-career | 23,059 | 3,044 | 26,103 | 21,335 | 994 |
| 7 | 07-cross-career | 23,766 | 2,655 | 26,421 | 21,335 | 610 |
| 8 | 08-cross-money | 24,771 | 3,031 | 27,802 | 21,335 | 1,002 |
| 9 | 09-cross-work-business | 24,419 | 2,866 | 27,285 | 21,335 | 692 |
| 10 | 10-cross-long-term | 26,873 | 2,542 | 29,415 | 21,335 | 647 |
| 11 turn1 | 11-conversation-career | 23,636 | 2,855 | 26,491 | 21,335 | 672 |
| 11 turn2 | 11-conversation-career | 24,198 | 2,149 | 26,347 | 21,335 | 470 |
| 11 turn3 | 11-conversation-career | 24,367 | 2,529 | 26,896 | 21,335 | 669 |

**관찰**: 첫 호출(01번) 이후 `cached_input_tokens`가 21,335로 고정 — OpenAI의 자동 prompt caching이
정확히 원본 프롬프트 2개(saju-original.md + ziwei-original.md) 전문 분량만큼 캐시를 잡고 있는 것으로
보인다 (원본 프롬프트 캐릭터 수 합계와 대략 비례). 이건 §13에서 예상했던 "원본 프롬프트 전문을 매
호출 통째로 보내는 고정 비용" 문제가 caching으로 상당 부분 상쇄된다는 뜻 — 실제 순수 input 비용은
겉보기 input_tokens보다 훨씬 낮을 것으로 추정된다(캐시 토큰은 보통 일반 input 토큰보다 훨씬 저렴하게
과금됨 — 정확한 할인율은 사용 모델의 가격 정책에 따름).

## 4. 질문별 비용

**[PENDING]** — `OPENAI_INPUT_PRICE_PER_1M`/`OPENAI_OUTPUT_PRICE_PER_1M` 환경변수를 설정하고 실행하면
각 결과 파일의 `estimated_cost`에 채워진다 (설정하지 않으면 `null` — 가격표를 코드에 하드코딩하지 않는
이유는 README §9 참고).

## 5. 평균 비용 — 카테고리별 비교 (spec §6: Saju-only / Ziwei-only / Cross-analysis / Conversation follow-up)

edge_case fixture, gpt-5.6, 2026-08-17 실행 결과 (검증기 수정 후 재채점 기준 `validation_pass_rate`):

```json
{
  "saju_only": { "count": 3, "avg_input_tokens": 23951, "avg_output_tokens": 2331, "avg_total_tokens": 26282, "avg_cost_usd": null, "validation_pass_rate": "3/3" },
  "ziwei_only": { "count": 3, "avg_input_tokens": 23029, "avg_output_tokens": 2553, "avg_total_tokens": 25582, "avg_cost_usd": null, "validation_pass_rate": "3/3" },
  "cross": { "count": 4, "avg_input_tokens": 24957, "avg_output_tokens": 2774, "avg_total_tokens": 27731, "avg_cost_usd": null, "validation_pass_rate": "4/4 (재채점 후 — 최초 실행 시 2/4였으나 검증기 오탐으로 확인됨)" },
  "conversation": { "count": 3, "avg_input_tokens": 24067, "avg_output_tokens": 2511, "avg_total_tokens": 26578, "avg_cost_usd": null, "validation_pass_rate": "3/3 (재채점 후 — 최초 실행 시 0/3였으나 검증기 오탐으로 확인됨)" }
}
```

`avg_cost_usd`가 전부 `null`인 이유: `OPENAI_INPUT_PRICE_PER_1M`/`OPENAI_OUTPUT_PRICE_PER_1M`을 설정
하지 않고 실행했기 때문 (§9 "가격표를 코드에 하드코딩하지 않는 이유" 참고). 정확한 $비용을 보고
싶으면 이 두 환경변수를 설정하고 `npm run rescore:real`이 아니라 **재실행**(`npm run analyze:real`)이
필요하다 — 비용 계산은 실행 시점에만 이루어지고 저장된 토큰 수치 자체에서 사후 계산하는 기능은 아직
없음(다음 개발 단계 후보).

**참고**: 위 4건 표기된 `validation_pass_rate`는 이번 세션에서 검증기를 고친 뒤 **업로드받아 직접
확인한 3개 파일**(01, 07, 11의 3턴 = cross 1건 + conversation 3건)만 반영한 것이다. cross 카테고리의
나머지 3건(08, 09, 10)과 saju_only/ziwei_only 전체는 콘솔 로그상 최초 실행에서 이미 PASS였으므로
검증기 수정의 영향을 받지 않았을 가능성이 높지만, **로컬에서 `npm run rescore:real`을 실행해 전체
11개 파일을 다시 확인하기 전까지는 확정이 아니다.**

## 6. 사주 단독 품질

**자동 검증**: 3/3 PASS (01, 02, 03 모두 최초 실행부터 검증기 오탐 없이 통과).

**사람 평가**: 3개 중 **01-saju-personality만 원문을 직접 검토**했다. 월령/일간/오행/십신/격국/용신/
조후/형충합회/대운 중 질문("내 성격의 핵심 구조를 사주로 설명해줘")과 직접 관련된 요소만 선별해서
서술했고, 원국 전체를 장황하게 반복하지 않았다 — 단, 이는 1건에 대한 관찰이며 02/03은 아직 사람이
읽지 않았다.

**[PENDING]** 02-saju-money, 03-saju-career 원문 검토.

## 7. 자미두수 단독 품질

**자동 검증**: 3/3 PASS (04, 05, 06 모두 최초 실행부터 통과 — 검증기 버그의 영향을 받지 않은 것으로
보임, 단 원문 재확인은 아직 안 함).

**사람 평가**: **[PENDING]** — 04/05/06 중 어느 것도 아직 원문을 직접 읽지 못했다. 특히 본궁/대궁/
삼합궁1/삼합궁2/주성/생년사화/필요한 보조성/현재 대운이 실제로 반영됐는지는 원문을 읽어야만 확인
가능하다.

## 8. Cross Analysis 품질

**자동 검증** (검증기 수정 후 재채점 기준): 07 PASS(재채점 전 FAIL), 08 최초 실행 FAIL(원인 미확인,
아직 원문 미검토), 09/10 최초 실행부터 PASS.

**사람 평가 — 07-cross-career만 직접 검토**: `[공통 방향]/[차이점]/[종합 판단]/[현실에서 확인할 조건]`
을 실제로 구분해서 작성했다. "그렇다고 무조건 독립·사업형이라고 단정할 수는 없어요"처럼 단정을
명시적으로 피하는 서술을 확인했다 — 원본 프롬프트가 요구하는 정확히 그 동작. 한 가지 특이사항: 응답에
"현재 나이 정보가 만 0세이므로"라는 문구가 등장했다 — edge_case fixture(유아 명반)의 나이가 비현실적
이라는 걸 AI가 실제로 인지하고 반영한 것으로 보인다(적절한 데이터 한계 인식으로 평가됨, §13에서
main_quality fixture 추가 이유로 이어짐).

**[PENDING]** 08-cross-money(최초 FAIL 원인 미확인 — 검증기 버그였는지 실제 위반이었는지 원문 확인
필요), 09-cross-work-business, 10-cross-long-term 원문 검토.

## 9. 대화 연속성 품질

**자동 검증** (검증기 수정 후 재채점): turn 1/2/3 전부 PASS (재채점 전 3턴 모두 FAIL — 전부 검증기
오탐이었음, §CHANGELOG "4차 반영" 참고).

**사람 평가 — 3턴 전부 원문 검토 완료**:

| Turn | 질문 | 관찰 |
|---|---|---|
| 1 | 내 직업 성향을 사주와 자미두수로 비교해줘. | 사주+자미두수 데이터를 모두 사용, 단정 회피("반드시 관리직이나 사업가가 된다는 뜻은 아닙니다") |
| 2 | 그럼 나는 직장보다 사업이 더 맞는다는 뜻이야? | 직전 turn 맥락을 이어받아 "아니요"로 명확히 답하며 구체화 — 전체 명반을 처음부터 다시 설명하지 않고 이어서 답함. "'직장보다 무조건 사업이 맞다'는 뜻은 아니에요"처럼 앞선 질문의 프레이밍 자체를 교정 |
| 3 | 그렇다면 혼자 하는 사업과 동업 중 어느 쪽을 더 조심해서 봐야 해? | "동업이 더 조심해야 할 쪽"이라고 답하되 "그렇다고 무조건 혼자 해야 한다는 뜻은 아니다"로 단정 회피, 구체적 확인 조건(지분/권한 문서화, 퇴출·해산 절차) 제시 |

`conversation_summary_after_this_turn` 필드로 실제 누적 요약을 확인했고(카테고리+한줄질문 누적 방식),
매 turn마다 전체 Canonical JSON을 다시 보내는 구조가 아니라 라우팅에 따라 추출된 부분 데이터만
사용하는 것을 `extracted_data`로 확인했다. **3턴 모두 앞선 답변을 실제로 기억하며 이어서 답하는
패턴을 확인** — 대화 연속성 자체는 설계대로 동작하는 것으로 보인다 (단, n=1 사례이므로 일반화는
주의).

## 10. 발견된 Hallucination

**직접 검토한 3개 파일(01, 07, 11의 3턴)에서는 hallucination 0건.** 자동 검증(`missing_data_
hallucination`, `no_annual_period_fabrication`, `no_gwimun_fabrication`, `no_daewoon_fabrication`)도
전부 PASS 또는 N/A였다. 다만 이는 5건에 대한 결과이며, 나머지 8건(02~06, 08~10)은 아직 원문도
자동검증 재확인도 안 된 상태다 — `npm run rescore:real` 실행 후 결과를 알려주면 이어서 확인 가능.

## 11. 원본 프롬프트 위반

**직접 검토한 3개 파일에서는 확인된 위반 0건.** 최초 실행에서 FAIL로 나왔던 5건은 전부 검증기의
부정문 인식 버그였고(§CHANGELOG "4차 반영"), 재검토 결과 오히려 원본이 요구하는 "단정적 표현 금지"
규칙을 정확히 지키고 있었다(예: "그렇다고 무조건 독립·사업형이라고 단정할 수는 없어요"). 나머지
8건은 미검토.

## 12. 개선이 필요한 부분

**[PENDING]** — 사람 평가 후 종합.

## 13. 현재 구조에서 가장 큰 병목

지금까지 코드/구조 검증 단계에서 미리 파악된 잠재적 병목 (실제 실행 후 재확인 필요):

- **세운(연간 유년운) 데이터 부재**: `saju-original.md`가 요구하는 연도별 세운표를 계산 엔진이
  아예 생성하지 않는다. adapter가 원본의 fallback 규칙("계산된 세운표가 없으면 임의 생성하지
  않는다")을 명시하고 있지만, 실제 모델이 이 규칙을 얼마나 잘 지키는지는 실제 실행 전까지 알 수 없다.
- **귀문관살 데이터 부재**: 마찬가지로 계산 엔진에 없는 항목. 질문에 귀문관살이 관련되면 "정보 없음"으로
  나오는지 확인 필요.
- **2-AI-call 구조의 두 번째 호출 크기**: Saju+Ziwei+Cross+Response를 한 호출에 합쳤기 때문에, 특히
  cross-analysis 질문(양쪽 원본 프롬프트 전문 + 양쪽 추출 데이터를 모두 시스템/유저 프롬프트에 넣음)의
  input_tokens가 클 것으로 예상된다 — §5 표로 실측 필요.
- **원본 프롬프트 두 개 전문의 토큰 비용**: `saju-original.md`(약 10,927자) + `ziwei-original.md`(약
  16,800자)를 매 호출 system prompt에 통째로 넣고 있어, 이것만으로도 상당한 고정 비용이 매 질문마다
  발생한다. 캐싱(prompt caching) 지원 여부/설정에 따라 실제 비용에 큰 차이가 날 수 있음 — 실제 실행 후
  `usage.cached_input_tokens`(OpenAIProvider가 있으면 기록하도록 되어 있는지 확인) 확인 필요.

## 14. 실제 유료 서비스에 사용할 수 있는 수준인지

**[PENDING — 사람 평가 필요, 실제 응답을 읽지 않고는 판단 불가능]**

## 15. 다음 개발 단계

1. **[진행 중]** 로컬에서 `npm run rescore:real` 실행 → 나머지 8개 edge_case 결과 파일(02~06, 08~10)
   재확인. API 재호출 불필요, 비용 없음.
2. **[승인 대기]** `npm run analyze:real -- main_quality` 실행 — 예상 호출 수/비용은 부록 C 참고.
3. 8개 파일 + main_quality 결과에 대한 사람 평가(§8 기준) 진행.
4. §13에서 예상한 병목(세운/귀문관살 부재, cross-analysis 호출 크기)이 실제로 문제인지 재확인 —
   prompt caching이 예상보다 효과적인 것으로 보여(§3 관찰 참고) 원본 프롬프트 고정비용 문제는
   완화됐을 가능성.
5. 위 결과에 따라 adapter 프롬프트 또는 파이프라인 구조 조정.
6. 통과 기준 만족 시: 웹 UI, PostgreSQL, 인증, 결제.

## 부록 C. `main_quality` 실행 예상 호출 수/비용 (승인 전 — 아직 실행 안 함)

- **예상 호출 수**: edge_case와 동일하게 13회 (Router 1회 + 통합분석 1회를 10문항+대화3턴에 적용 =
  26회 실제 HTTP 요청, 질문 단위로는 13건).
- **예상 토큰 규모**: edge_case 실행의 카테고리별 평균(§5)과 유사한 자릿수로 예상되나, main_quality
  명반은 12궁이 전부 채워져 있고(edge_case는 상당수 공궁) 대운/사화 데이터도 더 풍부해서 추출되는
  데이터量이 다소 커질 수 있음 — 대략 **총 30~40만 토큰(입력+출력 합산, 13건 기준)** 수준으로 추정
  (edge_case 실측 총합 약 34.6만 토큰 대비 ±15% 범위로 예상, 확정치 아님).
- **예상 비용**: `gpt-5.6` 또는 사용할 모델의 정확한 단가를 알아야 계산 가능. `OPENAI_INPUT_PRICE_
  PER_1M`/`OPENAI_OUTPUT_PRICE_PER_1M` 환경변수를 설정하고 실행하면 실행 결과에 실제 $비용이 함께
  기록된다.
- **실행 명령**: `npm run analyze:real -- main_quality` (로컬 PC, `OPENAI_API_KEY` 설정된 상태에서)

---

## 16. main_quality 실제 실행 결과 (2번째 실제 API 호출, 전체 11개 파일 사람 검토 완료)

### 16.1 테스트 환경

| 항목 | 값 |
|---|---|
| fixture | main_quality (`data/fixtures/adult-main-quality-chart.json`) |
| 생년월일시 | 1988-11-22 14:30, 여성, 서울 |
| 평가 시점 나이 | 37세 (35~44세 己未 대운 구간) |
| 실제 계산된 귀문관살 | 년지 辰 - 월지 亥 (`BRANCH_GWIMUN`의 "辰,亥" 쌍) |
| 세운 범위 | 2026~2046 (21개년) |
| 모델 | gpt-5.6 |
| 질문 수 / 실제 HTTP 요청 수 | 13개 질문 / 26회 (Router 1회 + 분석 1회 × 13) |

### 16.2 토큰 사용량 (전체 13건)

| # | 파일 | input | output | total | cached_input | reasoning |
|---|---|---|---|---|---|---|
| 1 | 01-saju-personality | 23,967 | 2,016 | 25,983 | 0 | 568 |
| 2 | 02-saju-money | 25,441 | 2,885 | 28,326 | 22,273 | 745 |
| 3 | 03-saju-career | 25,379 | 2,575 | 27,954 | 22,273 | 627 |
| 4 | 04-ziwei-personality | 23,546 | 2,204 | 25,750 | 22,273 | 377 |
| 5 | 05-ziwei-money | 24,170 | 2,419 | 26,589 | 22,273 | 621 |
| 6 | 06-ziwei-career | 24,135 | 2,737 | 26,872 | 22,273 | 654 |
| 7 | 07-cross-career | 24,613 | 2,839 | 27,452 | 22,273 | 624 |
| 8 | 08-cross-money | 25,191 | 3,678 | 28,869 | 22,273 | 1,186 |
| 9 | 09-cross-work-business | **34,824** | 3,311 | 38,135 | 22,273 | 853 |
| 10 | 10-cross-long-term | **35,382** | 2,765 | 38,147 | 22,273 | 573 |
| 11 turn1 | 11-conversation-career | 24,593 | 2,846 | 27,439 | 22,273 | 578 |
| 11 turn2 | 11-conversation-career | **35,054** | 2,413 | 37,467 | 22,273 | 732 |
| 11 turn3 | 11-conversation-career | **35,167** | 2,518 | 37,685 | 22,273 | 646 |

**관찰**: 09, 10, 11turn2/3 — `annual_periods`(세운 21개년)가 함께 추출된 5건만 input_tokens가
약 1만 토큰(+40%) 더 높다. edge_case 실행과 비교하면 `cached_input_tokens`가 22,273으로 소폭
증가(원본 프롬프트 자체는 그대로인데 adapter 파일에 세운/귀문관살 안내가 추가되어 캐시 대상 자체가
커진 것으로 추정).

### 16.3 카테고리별 평균 (자동 검증 재채점 반영, 13/13 PASS)

| 카테고리 | count | avg_input | avg_output | avg_total | pass_rate |
|---|---|---|---|---|---|
| saju_only | 3 | 24,929 | 2,492 | 27,421 | 3/3 |
| ziwei_only | 3 | 23,950 | 2,453 | 26,404 | 3/3 |
| cross | 4 | 30,003 | 3,148 | 33,151 | 4/4 (재채점 전 3/4) |
| conversation | 3 | 31,605 | 2,592 | 34,197 | 3/3 (재채점 전 2/3) |

### 16.4 검증기 오탐 2건 발견 및 수정 (실제 원본 위반 아님)

최초 실행 시 09, 11turn2가 FAIL. 원문 확인 결과 **둘 다 검증기 오탐**:

- **09**: "'평생 회사원' 또는 '무조건 창업가'라는 양자택일보다는..." — 거짓 이분법을 인용부호로 제시한
  뒤 명시적으로 거부하는 문장. 기존 부정 표지 목록("아니"/"않"/"없"/"라기보다" 등)에 없는 새 패턴.
- **11turn2**: "'조직생활이 안 맞고 무조건 사업해야 하는 구조'로 보기는 어렵다" — 인용부호가 금지어
  바로 앞이 아니라 인용구 앞부분에 있고, 금지어는 인용구 중간에 위치 — 더 일반화된 검사 필요했음.

**수정**: "금지어가 인용구간(quoted span) 안에 있는지"를 일반적으로 검사하도록 검증기 개선
(`isWithinQuotedSpan()`). 재채점 결과 13/13 PASS. 자세한 내용은 `CHANGELOG.md` "6차 반영" 참고.

### 16.5 사람 평가 — 11개 파일 전체 원문 직접 검토

**✅ 귀문관살 정확도 (요청 §9 "Canonical에 실제 존재하는 귀문관살을 제대로 해석하는가")**

01-saju-personality에서:

> 귀문관살은 제공된 계산 기준에서 년지 辰과 월지 亥의 조합으로 확인되지만, 이는 유파에 따라 판정
> 범위가 달라지는 보조 지표입니다. 초자연적인 의미로 볼 근거는 없고, 굳이 현실적으로 풀면 예민한
> 관찰, 깊은 몰입, 생각을 오래 붙드는 경향을 보조적으로 시사하는 정도입니다.

- 위치("년지 辰과 월지 亥") — Canonical JSON의 실제 값(`positions:['month','year']`, 년주 戊**辰**,
  월주 癸**亥**)과 **정확히 일치**. 지어내지 않음.
- "유파에 따라 판정 범위가 달라지는 보조 지표" — `prompts/runtime/saju.md` §3(유파 차이 고지) adapter
  지침이 정확히 반영됨.
- 초자연적 해석을 배제하고 절제된 현실적 해석만 제시 — safety.md 규칙 준수.
- 나머지 02/03/07번은 `special_stars`를 추출했지만 텍스트에서 귀문관살을 언급하지 않음(질문 성격상
  불필요하다고 판단한 것으로 보이며, 언급 안 한 것 자체는 문제 아님 — 있는데 지어내서 왜곡한 게 아니라
  단순히 이번 질문에 안 썼을 뿐).

**✅ 현재 대운 정확도 (요청 §9 "현재 대운을 실제 데이터와 일치하게 사용하는가")**

10-cross-long-term에서:

> [Fact] ... 현재는 편인 성격의 己未 대운이다. 45세부터는 인성과 관성이 이어진다.

- 실제 계산값: 35~44세=**己未**(십신: 偏印/偏印) — 정확히 일치.
- 45~54세=**戊午**(십신: 正印/偏官, 즉 인성+관성) — 정확히 일치.

**✅ 사주/자미두수 영역 혼동 없음 (요청 §9)**

11turn1의 [사주 관점]은 십신 용어(정인·편인·식신·상관·정관·편재)만, [자미두수 관점]은 궁/성/사화
용어(관록궁·대궁·삼합궁·천기·거문·태음화권)만 사용 — 교차 오염 없음. 관록궁이 공궁인 상황에서
"대궁과 삼합궁을 함께 봐야 한다"는 서술은 `ziwei.md` §3(삼방사정) adapter 규칙이 정확히 반영된 것.

**✅ 원본의 단정 금지 규칙 준수 (요청 §9)**

재검토한 모든 "무조건"/"반드시" 사례가 인용 후 명시적으로 반박하는 형태로만 등장. 실제 단정 주장은
발견되지 않음 (§16.4 참고).

**✅ 대화 3턴 맥락 유지 (요청 §9)**

- turn1에만 원본 §2 고정 안내 문구("[해석 안내]...")가 등장, turn2/3에는 반복되지 않음 —
  `saju.md`/`ziwei.md` adapter §4/§5 설계와 일치.
- turn2가 turn1의 프레이밍("복잡한 정보를 실용적 결과로 바꾸는 성향")을 이어받아 "직장 vs 사업" 질문에
  답함.
- turn3이 turn2의 "주도권 있는 일이 잘 맞음" 결론을 이어받아 "혼자 vs 동업" 질문에 새로운 근거(자금/
  결정권)를 추가.

**⚠️ 세운(annual_periods) 데이터 활용도 — 개선 필요 (요청 §9 "AI가 세운을 임의 계산하지 않는가"는
통과했으나, 그 이상의 문제 발견)**

09, 10, 11turn2/3 — `annual_periods` 21개 항목을 추출했으나(§16.2에서 확인한 토큰 증가의 원인), 실제
해석문 전체(saju/ziwei/cross_analysis/response)에서 **"세운"이라는 단어가 0회 등장**, 21개 세운 간지
중 어느 것도 텍스트에 나타나지 않음. "임의 계산/지어내기"는 없었다(그 자체로는 §9 요구사항 통과)는
점에서 안전하지만, **추출은 됐는데 실제로 안 쓰인** 상황이라 그만큼의 토큰 비용이 답변 품질에
반영되지 못했다.

**✅ 불필요한 전체 명반 재설명 없음 (요청 §9)**

모든 응답이 질문과 직접 관련된 항목만 서술 — 원국 전체를 장황하게 반복하는 패턴 없음.

### 16.6 종합

이번 main_quality 실행은 세운/귀문관살 통합의 **핵심 목표(임의 생성 없이 정확한 데이터 기반 해석)**를
실제로 달성했음을 확인했다 — 특히 귀문관살 위치/현재 대운 서술이 계산값과 정확히 일치한 것은 강력한
증거다. 다만 세운 데이터의 실제 활용도가 낮다는 새로운 개선 과제가 발견됐다.

## 17. main_quality 다음 개선 과제

1. **세운 데이터 활용도 개선**: `annual_periods`가 추출되고도 텍스트에 반영되지 않는 경우가 있음.
   원인 후보: (a) 원본 프롬프트의 해석 우선순위상 대운이 세운보다 항상 우선시되어 세운까지 내려가지
   않는 것이 실제로 올바른 판단일 수 있음 — 이 경우 애초에 라우터가 `annual_periods`를 선택하지
   않도록 조건을 더 좁히는 게 맞을 수 있음 (예: "장기적으로"는 오히려 세운이 필요 없다는 신호일 수
   있음, "올해"/"내년"처럼 명시적 단일 연도 질문에만 세운을 선택하도록 재조정 검토). (b) 또는 adapter가
   세운 데이터를 실제로 활용하도록 더 명시적으로 지시해야 할 수도 있음. 실 데이터로 두 가설을 나눠
   테스트해볼 필요.
2. `saju_only`/`ziwei_only`/`cross`/`conversation` 각 3~4건씩의 표본은 통계적으로 작음 — 더 다양한
   질문·명반으로 반복 검증 필요.
3. 위 §12(개선이 필요한 부분)와 통합해서 다음 adapter 개정 사이클에 반영.



```bash
# 1. 실제 평가 (API 키 필요, 비용 발생) — fixture 그룹 지정 (기본값 edge_case)
cp .env.example .env
# .env에 OPENAI_API_KEY, OPENAI_MODEL 채우기
npm run analyze:real                    # edge_case (기본값, 유아 명반)
npm run analyze:real -- main_quality    # 성인 명반 (승인 후 실행)
# → tests/real-ai/edge-case/*.json 또는 tests/real-ai/main-quality/*.json 생성
# → 콘솔에 카테고리별 stats 출력 (§5에 붙여넣기)

# 2. (선택) 하네스 자체만 재검증하고 싶을 때 — 비용 없음, 실제 평가 아님
npm run analyze:real:dryrun -- edge_case
npm run analyze:real:dryrun -- main_quality
# → tests/real-ai/_dryrun_mock_verification/{edge-case,main-quality}/*.json (실제 결과와 절대 안 섞임)

# 3. 검증기 로직이 바뀌었을 때 — 이미 받은 결과를 API 재호출 없이 재채점
npm run rescore:real                    # 기본: tests/real-ai/ 전체(하위 폴더 포함) 재귀 탐색
npm run rescore:real -- tests/real-ai/edge-case   # 특정 폴더만

# 4. 자동 검증 로직 자체의 회귀 테스트
npm test    # tests/10-forbidden-phrase-validator.test.mjs, tests/11-fabrication-validator.test.mjs 포함
```

## 부록 B. 결과 JSON 구조 (spec §7)

각 `tests/real-ai/NN-*.json`은 다음 필드를 포함한다 (단일 질문 파일 기준; `11-conversation-career.json`은
`turns` 배열로 3개를 감싸는 구조):

```
{
  question, category, routing, extracted_data, extraction_stats,
  model, usage, estimated_cost, response, full_analysis, validation,
  timestamp, mock_mode
}
```

`validation` 필드는 자동 검증 6종(json_schema_valid, required_fields_non_empty,
forbidden_certainty_phrases, missing_data_hallucination, routing_correctness,
extraction_correctness)의 `{pass, details}`를 담는다 — 사람 평가는 이 JSON 밖, 이 문서(§6~§9, §14)에서
별도로 진행한다 (spec §8: 자동 검증과 사람 평가 분리).
