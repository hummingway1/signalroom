// packages/knowledge/saju-sinsal.mjs
//
// 사주 신살(神殺) 10개 + 십이운성 12단계 지식 청크. canonical_field는 Canonical JSON의
// saju.special_stars 실제 키와 정확히 일치해야 자동 검색이 작동한다
// (packages/canonical/transform.mjs 기준). 계산 엔진이 아예 계산하지 않는 신살(역마·화개 등)은
// canonical_field를 null로 두고 키워드 매칭만 지원한다 — 이런 항목은 "명반에 실제로 있는지"
// 자동 확인이 불가능하므로, saju.md adapter의 "계산되지 않은 데이터는 지어내지 않는다" 원칙과
// 반드시 함께 적용해야 한다(코드 주석 및 검색 결과 메타데이터에 명시).
//
// 모든 항목은 "성향/경향을 나타내는 보조 지표이며 단정적 판단의 근거가 아니다"라는 톤을 유지한다.

export const SAJU_SINSAL_CHUNKS = [
  {
    id: 'saju_sinsal_dohwa',
    system: 'saju',
    category: 'sinsal',
    concept: '도화살',
    canonical_field: 'dohwa',
    match_terms: ['도화', '도화살', '桃花'],
    content:
      '지지에 자(子)·오(午)·묘(卯)·유(酉)가 있을 때 성립하는 신살로, 많은 사람의 주목·매력·인기를 상징한다. 전통적으로는 이성 문제·색정의 흉살로 여겨졌으나, 현대에는 매력·표현력·대중적 인기로 재평가되어 연예·영업·서비스직 등 대중과 만나는 분야에 유리한 성향으로 본다. "타인의 시선을 끄는 힘이 강하다" 정도의 성향 지표이며, 이성 관계 자체를 단정하는 근거로 삼아서는 안 된다.',
    school_dependent: false,
    sources: ['위키백과 신살', '나무위키', 'nadaunse.com'],
  },
  {
    id: 'saju_sinsal_yeokma',
    system: 'saju',
    category: 'sinsal',
    concept: '역마살',
    canonical_field: null,
    match_terms: ['역마', '역마살', '驛馬'],
    content:
      '지지에 인(寅)·신(申)·사(巳)·해(亥)가 있을 때 성립하는 신살로, 이동·변동·분주함을 상징한다. 정착을 중시하던 과거에는 흉살로 여겨졌으나, 이동이 자유로운 현대에는 여행·무역·해외진출·유동적 커리어에 유리한 긍정 지표로 본다. "한곳에 머물기보다 활동 반경이 넓을 때 능력을 발휘하는 경향" 정도로 순화해서 다룬다.',
    school_dependent: false,
    sources: ['나무위키', 'cmsdongil.co.kr'],
  },
  {
    id: 'saju_sinsal_cheoneul',
    system: 'saju',
    category: 'sinsal',
    concept: '천을귀인',
    canonical_field: 'cheoneul_gwiin',
    match_terms: ['천을귀인', '天乙貴人'],
    content:
      '일간 기준으로 정해진 두 지지가 사주 지지에 있으면 성립하는 대표적 길신. "하늘이 내린 귀인"으로 위기 시 도움·인복·품격을 상징하며, 전통적으로 흉살을 제압하는 최고의 길신으로 꼽힌다. "곤경에서 조력자를 만나는 경향, 대인복" 정도의 긍정 지표로 보되, 형·충·공망이 겹치면 작용이 약해진다고 본다. 단독으로 성공을 보장하는 것이 아니라 다른 구조와 함께 판단해야 한다.',
    school_dependent: false,
    sources: ['위키백과 신살', 'sajuabc.com', 'sazasaju.com'],
  },
  {
    id: 'saju_sinsal_munchang',
    system: 'saju',
    category: 'sinsal',
    concept: '문창귀인',
    canonical_field: 'munchang_gwiin',
    match_terms: ['문창귀인', '文昌貴人'],
    content:
      '일간 기준으로 정해진 지지(대체로 식신/장생에 해당)가 있으면 성립하는 학문의 길신. "글로 크게 일어난다"는 뜻으로 지혜·총명·학업·문서·표현력을 상징한다. 학습·연구·창작·시험 방면의 재능 경향으로 해석하며, 신왕하고 형충·공망이 없어야 온전히 발현된다는 조건이 붙는다. 재능의 방향성을 나타내는 보조 지표로 다룬다.',
    school_dependent: false,
    sources: ['joseilbo.com', 'sajustudy.com 신살론'],
  },
  {
    id: 'saju_sinsal_goegang',
    system: 'saju',
    category: 'sinsal',
    concept: '괴강살',
    canonical_field: 'goegang',
    match_terms: ['괴강', '괴강살', '魁罡'],
    content:
      '경진·경술·임진·무술 등 특정 일주일 때 성립하는 신살. "우두머리의 극강한 기운"으로 결단력·리더십·강한 추진력·카리스마를 상징한다. 타협이 적고 강직하며, 극단적 길흉(대성 또는 큰 좌절)으로 치우치기 쉽다고 본다. 성별에 따른 단정적 해석은 지양하고 "강한 통솔력과 원칙주의 성향"으로 순화해서 설명하는 것이 적절하다.',
    school_dependent: false,
    sources: ['위키백과 신살', 'cmsdongil.co.kr', '나무위키'],
  },
  {
    id: 'saju_sinsal_baekho',
    system: 'saju',
    category: 'sinsal',
    concept: '백호살',
    canonical_field: 'baekho',
    match_terms: ['백호', '백호살', '白虎'],
    content:
      '갑진·을미·병술·정축·무진·임술·계축 등 특정 일주에서 성립하는 신살(문헌에 따라 기준 편차 있음). 전통적으로는 유혈·사고의 흉살로 여겨졌다. 현대 해석에서는 강한 활동성·에너지·외유내강 성향으로 순화하며, 특정 분야에서 큰 성취로 발현될 수 있다고 본다. 사고·질병을 단정하는 근거가 아니라 "에너지가 강하고 기복이 큰 경향" 수준의 참고 지표로 다룬다.',
    school_dependent: true,
    sources: ['나무위키', 'v.daum.net 데일리'],
  },
  {
    id: 'saju_sinsal_yangin',
    system: 'saju',
    category: 'sinsal',
    concept: '양인살',
    canonical_field: 'yangin',
    match_terms: ['양인', '양인살', '羊刃'],
    content:
      '양간(갑·병·무·경·임) 일간 기준으로 겁재에 해당하는 왕지가 지지에 있을 때 성립하는 신살. "날 선 칼날"로 극단적 강함·투쟁성·과감함을 상징한다. 추진력·전문 기술·승부 근성이 뛰어나지만 과격·자기 극단으로 흐를 수 있다. 자평진전은 양인을 사흉신으로 보아 관살로 제압(양인가살)하는 구조를 귀하게 본다. 현대에는 "강한 집중력과 결단, 위기 돌파력"으로 순화하되 조절이 필요한 기운으로 설명한다.',
    school_dependent: false,
    sources: ['gangjungsa.co.kr', '자평진전 격국론 해설'],
  },
  {
    id: 'saju_sinsal_hwagae',
    system: 'saju',
    category: 'sinsal',
    concept: '화개살',
    canonical_field: null,
    match_terms: ['화개', '화개살', '華蓋'],
    content:
      '지지에 진·술·축·미(삼합의 고지)가 있을 때 성립하는 신살. "화려함을 덮는다"는 뜻으로 예술·학문·종교·철학·고독의 별로 본다. 재능·감수성·수행성이 뛰어나되 남들과 다른 독특함, 고독 성향이 있다. "예술·정신적 깊이의 재능 경향"으로 순화하며, 인복·환경에 따라 발현이 크게 달라진다는 점을 함께 설명한다.',
    school_dependent: false,
    sources: ['나무위키', 'cafe.daum 신살'],
  },
  {
    id: 'saju_sinsal_hongyeom',
    system: 'saju',
    category: 'sinsal',
    concept: '홍염살',
    canonical_field: 'hongyeom',
    match_terms: ['홍염', '홍염살', '紅艶'],
    content:
      '일주 기준으로 특정 지지가 올 때 성립하는 신살(기준은 문헌마다 편차가 있음). 도화살이 만인의 인기라면 홍염살은 특정 상대에게 어필하는 은근하고 요염한 매력으로 구분한다. 친근함·부드러운 인상·예술적 끼로 재해석되며, 대인·연애에서 호감을 주는 경향으로 본다. 색정 단정이 아니라 "친밀한 매력과 예술적 감성" 수준의 보조 지표로 다룬다.',
    school_dependent: true,
    sources: ['나무위키 홍염살'],
  },
  {
    id: 'saju_sinsal_gwimun',
    system: 'saju',
    category: 'sinsal',
    concept: '귀문관살',
    canonical_field: 'gwimun',
    match_terms: ['귀문관살', '귀문', '鬼門關殺', '鬼門'],
    content:
      '자유(子酉)·축오(丑午)·인미(寅未)·묘신(卯申)·진해(辰亥)·사술(巳戌) 여섯 지지 조합 중 하나가 사주 지지에 함께 있으면 성립하며, 붙어 있을수록 작용이 강하고 떨어져 있으면 잠재 기질로 본다. 전통적으로 "귀신이 드나드는 문"이라 하여 신경과민·집착·의심의 흉살로 다뤄졌다. 미신적 단정을 피하고, 현대에는 예민한 감수성·강한 직관·몰입력·비상한 기억력·창의성 등 "감각이 예리한 경향"으로 순화해 설명하는 것이 적절하다. 정신적 이상이나 병리를 단정하는 근거로 사용해서는 안 된다. 이 계산 결과의 계산 기준(어떤 지지 페어 조합을 사용했는지)은 saju.calculation_provenance.gwimun에서 별도로 확인할 것.',
    school_dependent: true,
    sources: ['나무위키', 'dk-saju.com', 'sajubaju.com'],
  },
];

export const SAJU_TWELVE_STAGE_CHUNKS = [
  { id: 'saju_stage_jangsaeng', system: 'saju', category: 'twelve_stage', concept: '장생', canonical_field: null, match_terms: ['長生', '장생'], content: '십이운성의 첫 단계. 갓 태어난 기운으로 순수·희망·새 출발을 상징한다. 온화하고 발전 지향적인 성향으로 해석한다.', school_dependent: false, sources: ['위키백과 십이운성'] },
  { id: 'saju_stage_mogyok', system: 'saju', category: 'twelve_stage', concept: '목욕', canonical_field: null, match_terms: ['沐浴', '목욕'], content: '십이운성 두 번째 단계. 유년기에 해당하며 미숙·불안정·변덕을 상징한다. 멋과 감정 기복, 도화적 성향과 연결되는 경우가 많다.', school_dependent: false, sources: ['위키백과 십이운성'] },
  { id: 'saju_stage_gwandae', system: 'saju', category: 'twelve_stage', concept: '관대', canonical_field: null, match_terms: ['冠帶', '관대'], content: '십이운성 세 번째 단계. 소년기에 해당하며 성장·독립심·자신감이 강하나 세련되지 못한 저돌성을 함께 지닌다.', school_dependent: false, sources: ['위키백과 십이운성'] },
  { id: 'saju_stage_geollok', system: 'saju', category: 'twelve_stage', concept: '건록', canonical_field: null, match_terms: ['乾祿', '建祿', '건록'], content: '십이운성 네 번째 단계. 청년기에 해당하며 자립·왕성함, 사회적 소득을 얻는 안정과 책임의 단계로 본다.', school_dependent: false, sources: ['위키백과 십이운성'] },
  { id: 'saju_stage_jewang', system: 'saju', category: 'twelve_stage', concept: '제왕', canonical_field: null, match_terms: ['帝旺', '제왕'], content: '십이운성 다섯 번째 단계이자 인생의 정점. 리더십·추진력이 최강이나 정점 이후 하강이 예정된 자리라 자만·고독을 경계해야 한다고 본다.', school_dependent: false, sources: ['위키백과 십이운성'] },
  { id: 'saju_stage_soe', system: 'saju', category: 'twelve_stage', concept: '쇠', canonical_field: null, match_terms: ['衰'], content: '십이운성 여섯 번째 단계. 정점을 지나 물러나는 시기로 노련·안정·보수적인 성향이나 활력은 다소 감소한다고 본다.', school_dependent: false, sources: ['위키백과 십이운성'] },
  { id: 'saju_stage_byeong', system: 'saju', category: 'twelve_stage', concept: '병', canonical_field: null, match_terms: ['病'], content: '십이운성 일곱 번째 단계. 기운이 쇠해지는 시기로 예민·섬세·동정심이 강해지고 보호받고 싶어하는 성향으로 해석한다.', school_dependent: false, sources: ['위키백과 십이운성'] },
  { id: 'saju_stage_sa', system: 'saju', category: 'twelve_stage', concept: '사', canonical_field: null, match_terms: ['死'], content: '십이운성 여덟 번째 단계. 활동이 정지되고 정신·학문 활동이 시작되는 시기로, 사색·연구·전문성이 발현되는 경향으로 본다.', school_dependent: false, sources: ['위키백과 십이운성'] },
  { id: 'saju_stage_myo', system: 'saju', category: 'twelve_stage', concept: '묘', canonical_field: null, match_terms: ['墓'], content: '십이운성 아홉 번째 단계. 무덤·창고에 비유되며 저장·수렴·휴식·고립을 상징한다. 축적과 안정을 지향하되 인색함으로도 해석될 수 있다.', school_dependent: false, sources: ['위키백과 십이운성'] },
  { id: 'saju_stage_jeol', system: 'saju', category: 'twelve_stage', concept: '절', canonical_field: null, match_terms: ['絶'], content: '십이운성 열 번째 단계. 단절·비어있음의 시기로 기운이 극도로 약하지만 새 시작을 예비하는 단계라, 변덕·즉흥성으로 나타나기도 한다.', school_dependent: false, sources: ['위키백과 십이운성'] },
  { id: 'saju_stage_tae', system: 'saju', category: 'twelve_stage', concept: '태', canonical_field: null, match_terms: ['胎'], content: '십이운성 열한 번째 단계. 잉태의 시기로 작은 잠재력·가능성을 상징한다. 아직 불안정하나 순수하고 의존적인 성향으로 해석한다.', school_dependent: false, sources: ['위키백과 십이운성'] },
  { id: 'saju_stage_yang', system: 'saju', category: 'twelve_stage', concept: '양', canonical_field: null, match_terms: ['養'], content: '십이운성 마지막 단계. 양육의 시기로 잠재력이 자라나는 준비 단계를 상징한다. 온순·수용적이며 성장 지향적인 성향으로 본다.', school_dependent: false, sources: ['위키백과 십이운성'] },
];
