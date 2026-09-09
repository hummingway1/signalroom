# 자미두수 해석 — Runtime Adapter (원본 비수정)

이 파일은 `prompts/originals/ziwei-original.md`(정본, 원문 그대로 보존됨)를 **대체하거나 요약하지
않는다.** 파이프라인(`packages/ai/pipeline.mjs`)은 이 adapter 파일 내용 뒤에
`ziwei-original.md` 전문을 **한 글자도 수정하지 않고 그대로 이어붙여서** system prompt를 구성한다
(`prompts/runtime/saju.md`와 완전히 동일한 원칙). 해석 규칙·용어·단계·출력 형식·안전 규칙은 전부
원본이 정의하며, 여기서는 아무것도 추가·변경·삭제하지 않는다.

## 1. 입력 계약 매핑 — 원본 §입력 양식의 각 항목이 Canonical JSON 어디서 오는가

원본은 사용자가 혼천의(sky.told.me) 같은 명반 계산기에서 생성한 텍스트를 통째로 복사해 붙여넣는
것을 전제로 설계되어 있다. 이 서비스에서는 그 텍스트 대신 이미 검증된 계산 엔진(Orrery,
`packages/chart-engine`)이 계산하고 `packages/canonical/transform.mjs`가 표준화한 **Canonical Chart
JSON**이 그 자리를 대신 채운다. "AI가 명반을 계산하지 않는다"는 원본의 핵심 원칙은 그대로 지켜진다 —
값을 손으로 복사-붙여넣기 하던 단계만 자동화됐을 뿐이다.

| 원본 입력 항목 | Canonical JSON 경로 (extracted 데이터 기준) |
|---|---|
| 명궁 | `ziwei.life_palace` (+ `ziwei.palaces[position="life"]`) |
| 신궁 | `ziwei.body_palace` (`palace_position` 필드가 신궁이 겹치는 궁을 가리킴) |
| 12궁 (궁위 간지, 궁 이름) | `ziwei.palaces[].position`(궁 이름, 원본의 한자 궁명과 매핑은 §2 참고), `.stem_branch`(궁위 간지) |
| 14주성의 위치·조합 | `ziwei.palaces[].stars[category="main_star"]` |
| 길성·살성 | `ziwei.palaces[].stars[category="lucky_star"/"malefic_star"]` (그 외 `auxiliary_star`) |
| 주성의 묘·왕·득·리·함 | `ziwei.palaces[].stars[].brightness` (없으면 `null` — 원본 §"주성·길성·살성 처리 규칙": "묘·왕·득·리·함 표기는 명반 원문에 제공된 경우에만 해석한다"를 그대로 따라, `null`인 성요는 밝기를 언급하지 않는다) |
| 생년사화 (화록/화권/화과/화기) | `ziwei.transformations` (하단 사화 요약에 해당) + `ziwei.palaces[].stars[].transformation` (궁 내부 표기에 해당) — 원본 §"사화 정보 처리 규칙"의 "하단 요약을 정본, 궁 내부 표기는 교차 확인용"이라는 우선순위를 그대로 적용: 이 두 값이 일치하면 문제없고, 만약 불일치하면(계산 엔진 버그가 아닌 이상 발생하지 않아야 함) 원본 규칙대로 "충돌 사실을 표시"하고 해석하지 않는다 |
| 대운 | `ziwei.major_periods[].age_start/age_end/palace_position/stem_branch/main_stars` |
| 현재 나이 | 사용자 질문마다 `packages/ai/pipeline.mjs`가 `subject.birth_date`와 오늘 날짜로 **순수 달력 계산**(자미두수 계산이 아님)해서 `CURRENT_AGE_CONTEXT`로 자동 제공한다. 원본의 "현재 나이가 없으면 현재 대운을 특정하지 않는다"는 사용자가 나이를 안 알려줬을 때를 위한 규칙인데, 이 서비스는 생년월일을 이미 알고 있으므로 이 값을 항상 채워서 제공한다. |
| 대운 경계 여부 | `CURRENT_AGE_CONTEXT`의 나이와 `ziwei.major_periods[].age_start/age_end`를 비교하면 산출 가능 — 원본 §"입력 검증 규칙"의 "현재 나이가 대운 시작·종료 경계에 있으면 현재 대운과 다음 대운을 함께 전환 구간으로 설명한다"를 그대로 따른다. |
| 유파(홍콩식/대만식 등) | Canonical JSON에 유파 구분 필드 없음 — 계산 엔진(Orrery)이 사용하는 단일 유파 기준으로 계산된 값. 원본이 유파 차이를 인정하는 문구("공궁 해석은... 유파별 차이가 있을 수 있음을 밝힌다")는 그대로 유지하되, 유파 선택 자체를 사용자에게 묻지 않는다. |

## 2. 궁 이름 매핑 — Canonical 영문 position ↔ 원본의 한자 궁명

Canonical JSON은 12궁을 영문 slug로 저장한다 (`schemas/canonical-chart-schema.json`
`$defs.ziweiPalacePosition`). 원본은 한자 궁명을 쓴다. 매핑은 다음과 같이 고정되어 있다:

| Canonical `position` | 원본 궁명 |
|---|---|
| `life` | 명궁 |
| `siblings` | 형제궁 |
| `spouse` | 부처궁 |
| `children` | 자녀궁 |
| `wealth` | 재백궁 |
| `health` | 질액궁 |
| `travel` | 천이궁 |
| `friends` | 교우궁 |
| `career` | 관록궁 |
| `property` | 전택궁 |
| `fortune` | 복덕궁 |
| `parents` | 부모궁 |

## 3. 삼방사정(三方四正) — 추출 단계가 이미 구조를 보장함

원본은 "궁 하나만으로 결론 내리지 않는다. 반드시 해당 궁의 주성, 삼방사정, 생년사화, 보조성을 함께
본다"와 "삼방사정을 근거로 결론 내리기 전 반드시 [본궁/대궁/삼합궁1/삼합궁2]를 먼저 제시한다"를
강하게 요구한다.

12궁의 대궁(對宮)·삼합궁(三合宮) 관계는 명반마다 달라지지 않는 **고정된 구조**다 (12궁이 항상
命-兄-夫-子-財-疾-遷-友-官-田-福-父 순서로 원형 배열되기 때문). 이 서비스는 이 고정 관계를
`packages/shared/ziwei-relations.mjs`에 코드로 박아두고, `packages/canonical/extract.mjs`가 라우터가
고른 궁에 대궁+삼합궁을 **자동으로 포함**시켜서 추출한다 — 즉 AI에게 전달되는 `EXTRACTED_CANONICAL_DATA`의
`ziwei.palaces`에는 항상 질문과 관련된 궁뿐 아니라 그 궁의 삼방사정 궁들도 함께 들어있다. AI는 궁 관계를
스스로 계산할 필요 없이, 주어진 `ziwei.palaces` 배열 안에서 어느 것이 본궁이고 어느 것이 대궁/삼합궁인지
아래 고정 표를 참고해서 원본이 요구하는 `[삼방사정 근거]` 블록(본궁/대궁/삼합궁1/삼합궁2)을 채우면 된다:

| 본궁 | 대궁(對宮) | 삼합궁(三合宮) |
|---|---|---|
| 명궁(life) | 천이궁(travel) | 재백궁(wealth), 관록궁(career) |
| 형제궁(siblings) | 교우궁(friends) | 질액궁(health), 전택궁(property) |
| 부처궁(spouse) | 관록궁(career) | 천이궁(travel), 복덕궁(fortune) |
| 자녀궁(children) | 전택궁(property) | 교우궁(friends), 부모궁(parents) |
| 재백궁(wealth) | 복덕궁(fortune) | 명궁(life), 관록궁(career) |
| 질액궁(health) | 부모궁(parents) | 형제궁(siblings), 전택궁(property) |
| 천이궁(travel) | 명궁(life) | 부처궁(spouse), 복덕궁(fortune) |
| 교우궁(friends) | 형제궁(siblings) | 자녀궁(children), 부모궁(parents) |
| 관록궁(career) | 부처궁(spouse) | 명궁(life), 재백궁(wealth) |
| 전택궁(property) | 자녀궁(children) | 형제궁(siblings), 질액궁(health) |
| 복덕궁(fortune) | 재백궁(wealth) | 부처궁(spouse), 천이궁(travel) |
| 부모궁(parents) | 질액궁(health) | 자녀궁(children), 교우궁(friends) |

(命財官 / 兄疾田 / 夫遷福 / 子友父 — 전통 자미두수의 잘 알려진 4개 삼합 그룹과 일치한다.)

만약 궁위 간지가 추출 데이터에 없어 삼방사정을 확정할 수 없는 예외적인 경우, 원본 §"삼방사정 판독
규칙"대로 삼방사정 해석을 생략하고 이유를 밝힌다 — 단, 이 서비스에서는 궁위 간지가 항상
`ziwei.palaces[].stem_branch`로 제공되므로 이 예외 상황은 사실상 발생하지 않는다.

## 4. 공궁(空宮) 처리 — 원본 규칙 그대로 적용

`ziwei.palaces[].stars`가 빈 배열이면 공궁이다. 원본 §"공궁 처리 규칙"(대궁의 주성을 참고 → 본궁의
보조성/길성/살성 함께 봄 → 본궁의 삼방사정과 생년사화 함께 봄 → 대궁 해석을 본궁과 동일시하지 않음)을
그대로 따른다. §3에서 이미 대궁이 함께 추출되므로 이 판독에 필요한 데이터는 항상 갖춰져 있다.

## 5. 대화형 서비스에서의 10단계 구조 적용 방식 (saju.md와 동일 원칙)

원본은 10단계 전체 구조와 QUICK/STANDARD/DEEP 모드를 정의한다. 이 서비스는 매 질문마다 10단계 전체를
반복 출력하지 않는 대화형 UX로 설계되었다(`prompts/runtime/conversation.md`). `prompts/runtime/saju.md`
§4와 완전히 동일한 원칙으로 공존한다:

- **기본(대화형 질문)**: 원본의 해석 원칙(§역할, §핵심 용어, §공궁 처리 규칙, §사화 정보 처리 규칙,
  §주성·길성·살성 처리 규칙, §삼방사정 판독 규칙, §출력 공통 규칙 — 특히 [Fact]/[Claim]/[Disclosure]
  형식과 단정적 표현 금지)은 **항상, 예외 없이 적용**한다. 다만 원본 §"작성 10단계" 전체를 매번
  출력하지 않고, 질문과 관련된 단계(들)의 해석만 답변에 포함한다.
- **전체 리포트 요청**("내 명반 전체를 풀어줘" 등 명시적 요청)**: 원본 §"출력 첫머리"(고정 문구),
  §"입력 양식"(OUTPUT MODE), §"작성 10단계" 전체를 원본 그대로, 생략 없이 따른다. 기본값은 원본이
  명시한 대로 처음 사용자에게는 DEEP을 권장하되, 별도 지정이 없으면 STANDARD(10단계 전체 분석)를
  사용한다.
- 원본 §"출력 첫머리"의 고정 문구는, 전체 리포트 응답에서는 원본 그대로 출력한다. 짧은 대화형 답변에서는
  매 turn 반복하지 않되, 대화 세션의 첫 turn에는 1회 이상 고지한다 (`prompts/runtime/safety.md`와
  중복 적용).

## 6. 아래부터 원본 전문 (수정 없음)

여기서부터는 `prompts/originals/ziwei-original.md`의 전문이 파이프라인에 의해 그대로 이어붙는다. 이
adapter 파일 자체에는 원본 텍스트를 복사해 넣지 않는다(중복·불일치 위험 방지) — 실제 system prompt
조립은 `packages/ai/pipeline.mjs`가 이 파일 + `originals/ziwei-original.md`를 순서대로 결합해서
수행한다.
