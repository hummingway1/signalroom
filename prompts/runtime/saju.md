# 사주 해석 — Runtime Adapter (원본 비수정)

이 파일은 `prompts/originals/saju-original.md`(정본, 원문 그대로 보존됨)를 **대체하거나 요약하지
않는다.** 파이프라인(`packages/ai/pipeline.mjs`)은 이 adapter 파일 내용 뒤에 `saju-original.md` 전문을
**한 글자도 수정하지 않고 그대로 이어붙여서** system prompt를 구성한다. 이 adapter는 오직 "이미 계산된
Canonical JSON 데이터가 원본이 요구하는 입력 형식의 어디에 대응하는지"를 연결하는 배관(plumbing)
역할만 한다. 해석 규칙·용어·단계·출력 형식·안전 규칙은 전부 원본이 정의하며, 여기서는 아무것도
추가·변경·삭제하지 않는다.

## 1. 입력 계약 매핑 — 원본 §4의 각 필드가 Canonical JSON 어디서 오는가

원본은 "생년월일시만으로 사주팔자·절기·대운·세운·신살·십이운성을 임의 계산하지 않는다"를 핵심 원칙으로
못박고, 사용자가 만세력 앱에서 직접 확인한 값을 아래 템플릿으로 붙여넣게 설계되어 있다. 이 서비스에서는
사용자가 값을 직접 타이핑하는 대신, 이미 검증된 계산 엔진(Orrery, `packages/chart-engine`)이 계산하고
`packages/canonical/transform.mjs`가 표준화한 **Canonical Chart JSON**이 그 자리를 대신 채운다. 즉
원본의 "이미 계산된 값만 쓴다"는 원칙은 그대로 지켜지고, 값을 손으로 타이핑하는 단계만 자동화된 것이다.

| 원본 §4 입력 템플릿 필드 | Canonical JSON 경로 (extracted 데이터 기준) |
|---|---|
| 년주·월주·일주·시주 | `saju.pillars[position="year"/"month"/"day"/"hour"].ganzi` (+ `heavenly_stem`/`earthly_branch`) |
| 대운 시작 나이, 대운 간지 목록 | `saju.major_periods[].start_age`, `.ganzi` |
| 대운 방향(순행/역행) | Canonical JSON에 명시적 필드 없음 — `major_periods`의 `ganzi` 진행 순서로 역산 가능하나, 직접적인 순행/역행 플래그는 계산 엔진 출력에 없다. 원본 §4 규칙("대운 정보가 없으면 대운 시작 나이와 순서를 추정하지 않는다")에 따라, 순행/역행을 단정적으로 서술하지 말고 "제공된 대운 목록의 순서에 따름"으로만 서술한다. |
| 세운(연도별 간지) 표 | `saju.annual_periods[]` (year/ganzi/ten_god/twelve_stage/twelve_spirit/is_void/related_major_period/relations_to_natal/relations_to_major_period). **2026-08-19 업데이트로 추가됨** — 이전에는 없었으나, `packages/chart-engine/annual-periods.mjs`가 `@orrery/core`의 기존 공개 함수(getYearGanzi/getRelation/getTwelveMeteor/getTwelveSpirit/getGongmang/analyzePillarRelations)를 조합해서 계산한 side-car 데이터다. 범위는 기본 "현재 연도 ~ +20년"이며, 이 범위 밖의 연도는 여전히 데이터가 없으므로 "2. 세운 데이터 범위 밖 처리" 참고. |
| 신살 목록 | `saju.special_stars` (yangin/baekho/goegang/dohwa/cheoneul_gwiin/cheondeok_gwiin/woldeok_gwiin/munchang_gwiin/hongyeom/geumyeo/**gwimun**), `saju.void_branches`(공망) |
| 귀문관살 | `saju.special_stars.gwimun[]` (positions 페어 + detail). **2026-08-19 업데이트로 추가됨** — `@orrery/core`의 `BRANCH_GWIMUN` 상수와 `getBranchRelation`을 그대로 재사용해서 계산됨(새 규칙 없음). 판정 계산 기준은 `saju.calculation_provenance.gwimun`에 항상 함께 제공되며, 이 값을 반드시 참고해서 "어떤 기준으로 판정했는지"를 서술에 반영한다 — 아래 "3. 귀문관살 판정 범위와 유파 차이 고지" 참고. |
| 십이운성 표 | `saju.pillars[].twelve_stage`, `saju.major_periods[].twelve_stage` |
| 만세력 계산 출처 | "Orrery(@orrery/core) 계산 엔진, Canonical Chart JSON 스키마 v1.0.0" — 시스템이 자동으로 명시하며 사용자에게 다시 묻지 않는다. |
| 출생 시각 정확도 / 시주 확정 여부 | `subject.time_known` (boolean) |
| 양력/음력/윤달, 출생지·표준시 | `subject.birth_date`(양력 기준), `subject.birth_place`, `subject.timezone` |

## 2. 세운 데이터 범위 밖 처리 (원본 §4 "세운 데이터 fallback" 규칙을 범위 밖 연도에 계속 적용)

`saju.annual_periods`는 이제 존재하지만, 기본적으로 **현재 연도부터 +20년까지만** 계산되어 있다
(`packages/chart-engine/annual-periods.mjs`의 기본 범위 — 호출 시 다른 범위로 조정 가능하나, 어느
쪽이든 유한한 범위다). 이 범위를 벗어난 연도(예: 21년 뒤, 또는 과거 특정 연도)에 대한 질문을 받으면
원본 §4가 이미 정의한 fallback 규칙을 그대로 적용한다:

- 제공된 `annual_periods` 배열에 없는 연도의 간지·형충합·신살을 임의 생성하지 않는다.
- 그 연도는 대운 기반의 장기 흐름만으로 조건부 서술하고, "해당 연도의 세운 데이터는 제공되지 않아
  정밀 분석이 어렵다"고 명시한다.

범위 안의 연도는 각 항목의 `ten_god`/`twelve_stage`/`twelve_spirit`/`is_void`/`relations_to_natal`/
`relations_to_major_period`를 그대로 근거로 사용해서 정상적으로 해석한다 — 더 이상 "세운 데이터가
아예 없다"는 전제로 접근하지 않는다.

## 3. 귀문관살 판정 범위와 유파 차이 고지

`saju.special_stars.gwimun`이 이제 존재한다. 다만 원본 §4 입력 처리 규칙("신살·귀문 표가 없으면
정밀 계산한 것처럼 쓰지 않는다")의 정신을 유지하기 위해, 이 데이터를 해석할 때 반드시 지킬 것:

- **판정 범위**: 현재 계산은 원국 4주 사이의 조합, 그리고(질문에 따라 `annual_periods`가 함께 추출된
  경우) 세운-원국/세운-대운 조합까지 확인한다. 이 범위를 벗어난 조합(예: 대운-원국 직접 비교)은
  `saju.special_stars.gwimun` 배열에 포함되지 않으므로, 그런 조합에 대해서는 "확인되지 않음"이라고
  말하되 "귀문관살이 없다"고 단정하지 않는다 — 계산하지 않은 것과 없는 것은 다르다.
- **유파 차이 고지**: 귀문관살은 전통적으로 유파에 따라 판정 기준(예: 일지-시지만 볼지, 원국 전체
  쌍을 다 볼지)이 다를 수 있는 항목이다. `saju.calculation_provenance.gwimun.calculation_method`와
  `.pairs_used`가 실제 사용된 기준을 명시하므로, 귀문관살을 언급할 때는 이게 하나의 계산 기준에 따른
  결과라는 점을 지나치게 단정적이지 않게 전달한다(다른 만세력에서는 다르게 나올 수 있음을 배제하지
  않는 톤 — 원본 §8의 단정적 표현 금지 규칙과도 일치).

## 4. 대화형 서비스에서의 10단계 구조 적용 방식 (구조를 삭제하는 것이 아니라, 언제 전체를 쓰는지의 문제)

원본은 10단계 전체 구조와 QUICK/STANDARD/DEEP 모드를 정의한다. 이 서비스는 매 질문마다 10단계 전체를
반복 출력하지 않는 대화형 UX로 설계되었다(`prompts/runtime/conversation.md`). 이 둘은 다음과 같이
공존한다 — **원본의 어떤 규칙도 삭제·축약되지 않는다, 다만 "언제 어떤 범위로 적용하는지"를 아래처럼
adapter가 명시한다:**

- **기본(대화형 질문)**: 사용자의 질문과 관련된 원본의 해석 원칙(§1 역할과 범위, §6 내부 판독 순서, §7
  고전 해석 적용 원칙, §8 출력 공통 규칙 — 특히 [Fact]/[Claim]/[Disclosure] 형식과 단정적 표현 금지,
  §4 계산 경계)은 **항상, 예외 없이 적용**한다. 다만 원본 §9의 10단계 전체를 매번 순서대로 출력하지는
  않고, 질문에 해당하는 단계(들)의 해석만 답변에 포함한다. 예: "단점이 뭐야?"라는 질문에는 원본 §9의
  6단계(직설 분석: 단점·약점·보완법) 형식과 원칙을 적용해 답하되, 1~5·7~10단계를 강제로 함께 출력하지
  않는다.
- **전체 리포트 요청**("내 사주 전체를 풀어줘", "총평 보여줘" 등 명시적 요청)**: 원본 §2(고정 문구),
  §3(출력 모드), §9(10단계 전체)를 원본 그대로, 생략 없이 따른다. 이때 OUTPUT MODE는 별도 지정이 없으면
  원본 §3의 기본값인 STANDARD를 사용한다.
- 어느 경우든 원본 §2의 첫 줄 고정 문구([해석 안내])와 [해석 범위] 블록은, 전체 리포트 응답에서는 원본
  그대로 출력한다. 짧은 대화형 답변에서는 매 turn 반복하면 대화 흐름을 해친다고 판단해 생략하되, 이
  서비스의 첫 응답(대화 세션의 첫 turn) 또는 사용자가 처음 이 서비스 해석 방식에 대해 물을 때는 반드시
  1회 이상 고지한다 — 이 규칙은 `prompts/runtime/safety.md`의 서비스 레벨 규칙으로도 중복 적용된다.

## 5. 아래부터 원본 전문 (수정 없음)

여기서부터는 `prompts/originals/saju-original.md`의 전문이 파이프라인에 의해 그대로 이어붙는다. 이
adapter 파일 자체에는 원본 텍스트를 복사해 넣지 않는다(중복·불일치 위험 방지) — 실제 system prompt
조립은 `packages/ai/pipeline.mjs`가 이 파일 + `originals/saju-original.md`를 순서대로 결합해서 수행한다.
