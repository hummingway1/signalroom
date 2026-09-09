// packages/knowledge/ziwei-main-stars.mjs
//
// 자미두수 주성(主星) 14개 지식 청크. match_terms는 Canonical JSON의 ziwei.palaces[].stars[].name
// 실제 값(한자, 예: '紫微','天機')과 정확히 일치해야 자동 검색이 작동한다.

export const ZIWEI_MAIN_STAR_CHUNKS = [
  {
    id: 'ziwei_star_jami',
    system: 'ziwei',
    category: 'main_star',
    concept: '자미',
    match_terms: ['紫微', '자미'],
    content:
      '오행은 음토(陰土), 북두의 제왕성. 존귀·권위·리더십·중심을 상징한다. 명궁에 있으면 자존심이 높고 통솔력이 있으며 남이 자연히 따르는 카리스마가 있으나, 고고함·독선·귀 얇음의 그림자가 있어 좌보·우필 등 보좌성이 반드시 필요하다. 재백궁에서는 큰 규모의 재물 관리·투자 감각, 관록궁에서는 관리자·경영자 자질, 부처궁에서는 배우자가 능력 있고 자존심 강한 상으로 본다.',
    school_dependent: false,
    sources: ['zamidusu.co.kr', 'hanmystica.com', 'healingcrystwinity.com'],
  },
  {
    id: 'ziwei_star_cheongi',
    system: 'ziwei',
    category: 'main_star',
    concept: '천기',
    match_terms: ['天機', '천기'],
    content:
      '오행은 음목(陰木), 지혜·기획·참모의 별. 두뇌 회전이 빠르고 총명하며 전략·분석·임기응변에 능하다. 명궁에 있으면 머리가 좋고 생각이 많으며 변화를 즐기지만, 잔걱정·불안정·과민의 경향이 있다. 재백궁에서는 지혜와 단기 회전으로 버는 재물(살성 과다 시 투기·편법 주의), 관록궁에서는 기획·상담·연구직, 부처궁에서는 총명한 배우자로 본다.',
    school_dependent: false,
    sources: ['clien.net', '나무위키', 'cafe.daum 공평한저울'],
  },
  {
    id: 'ziwei_star_taeyang',
    system: 'ziwei',
    category: 'main_star',
    concept: '태양',
    match_terms: ['太陽', '태양'],
    content:
      '오행은 양화(陽火), 명예·박애·공적 활동의 별. 정직·외향·적극적이고 베푸는 기질이 강해 대중 앞에 나서는 일에 어울린다. 명궁에 있으면 활달하고 자존심이 강하며 직설적이라 마찰이 생길 수 있고, 밝기(묘·함)에 따라 편차가 크다. 재물보다 명예·리더십을 상징하며, 관록궁에서 특히 강세(공직·교육·정치), 부친·남성 육친과도 연결된다.',
    school_dependent: false,
    sources: ['cafe.daum 공평한저울', 'purplestarmapper.com'],
  },
  {
    id: 'ziwei_star_mugok',
    system: 'ziwei',
    category: 'main_star',
    concept: '무곡',
    match_terms: ['武曲', '무곡'],
    content:
      '오행은 음금(陰金), 재백주(財帛主)이자 장군성. 결단력·자기관리·승부근성이 강하고 실행력이 뛰어나다. 명궁에 있으면 과묵·강직하고 한번 정하면 밀어붙이며 정이 적고 다소 차가운 인상이다. 재백궁에서 특히 길해 스스로 움직여 버는 재물(안정적 축재)을 상징하고, 관록궁에서는 재무·군경·기술 분야, 부처궁에서는 배우자와 정서 교류가 적을 수 있다고 본다.',
    school_dependent: false,
    sources: ['m.dcinside.com 자미갤', '나무위키'],
  },
  {
    id: 'ziwei_star_cheondong',
    system: 'ziwei',
    category: 'main_star',
    concept: '천동',
    match_terms: ['天同', '천동'],
    content:
      '오행은 양수(陽水), 복덕·향유의 별. 온화·낙천·평화 지향으로 다툼을 피하고 정서가 부드럽다. 명궁에 있으면 좋은 사람 기질이라 적극성·거절력이 약하고 나태하다는 평을 듣지만, 실은 끈기 있게 기다리는 힘이 있다. 변화·도전에 초기 부담을 느낀다. 재백궁에서는 무리 없는 안정적 재물, 관록궁에서는 서비스·기획·복지 분야, 부처궁에서는 정서적으로 편안한 배우자로 본다.',
    school_dependent: false,
    sources: ['m.dcinside.com 자미갤'],
  },
  {
    id: 'ziwei_star_yeomjeong',
    system: 'ziwei',
    category: 'main_star',
    concept: '염정',
    match_terms: ['廉貞', '염정'],
    content:
      '오행은 음화(陰火), 차수도화(次桃花)이자 관리·집행의 별. 은근한 매력과 감정·자기 개성이 강하다. 명궁에 있으면 매력적이고 열정적이나 감정 통제가 관건이며, 어두우면 즉흥·질투·유혹에 약할 수 있다. 감정 절제가 되면 행정·관리·기술에서 성취한다. 재백궁에서는 사교·수완형 재물, 관록궁에서는 관리·법무·기술, 부처궁에서는 열정적이나 굴곡 있는 관계로 본다.',
    school_dependent: false,
    sources: ['m.dcinside.com 자미갤', '나무위키'],
  },
  {
    id: 'ziwei_star_cheonbu',
    system: 'ziwei',
    category: 'main_star',
    concept: '천부',
    match_terms: ['天府', '천부'],
    content:
      '오행은 양토(陽土), 남두의 재고(財庫)·재상성. 안정·포용·관리 능력을 상징하며 실질적 리더(재상)에 비유된다. 명궁에 있으면 신중·보수적이고 재물 관리와 조직 운영에 능하며 자비로운 편이나, 지나치면 보신·수동으로 흐른다. 재백궁에서 특히 길해 재물 축적·저장을 상징하고, 관록궁에서는 관리·재무·행정, 부처궁에서는 안정적이고 살림을 잘하는 배우자로 본다.',
    school_dependent: false,
    sources: ['clien.net', 'cafe.daum 금화당'],
  },
  {
    id: 'ziwei_star_taeeum',
    system: 'ziwei',
    category: 'main_star',
    concept: '태음',
    match_terms: ['太陰', '태음'],
    content:
      '오행은 음수(陰水), 재부·주택·모성의 별. 섬세·차분·심미적이며 공간 감각과 저장 능력이 뛰어나다. 명궁에 있으면 내향적·감성적이고 계획적이며, 밝기(야간 출생·묘함)에 따라 길흉 편차가 크다. 재백궁에서는 꾸준한 축재·부동산, 관록궁에서는 기획·문예·금융, 부처궁에서는 청결하고 자상한 배우자, 모친·여성 육친과 연결된다.',
    school_dependent: false,
    sources: ['clien.net', 'blog.daum 자미두수 정리'],
  },
  {
    id: 'ziwei_star_tamlang',
    system: 'ziwei',
    category: 'main_star',
    concept: '탐랑',
    match_terms: ['貪狼', '탐랑'],
    content:
      '도화·욕망·재능의 별(목/수 성질을 겸함). 다재다능·사교·호기심·욕망이 강하다. 명궁에 있으면 매력적이고 활동적이며 취미·교제·재능이 다양하나, 절제가 안 되면 주색·투기로 흐를 수 있다. 재백궁에서는 변동성 큰 재물, 관록궁에서는 사교·예술·영업·외교, 부처궁에서는 매력적이나 다정다감한 관계로 본다. 화성·영성과 만나면 오히려 급발전(화탐격/영탐격)한다.',
    school_dependent: false,
    sources: ['clien.net', '나무위키'],
  },
  {
    id: 'ziwei_star_geomun',
    system: 'ziwei',
    category: 'main_star',
    concept: '거문',
    match_terms: ['巨門', '거문'],
    content:
      '암성(暗星, 토/수 성질), 말·논변·시비의 별. 분석력·언변·탐구심이 뛰어나고 특수 분야·해외와 인연이 있다. 명궁에 있으면 세심하고 의심이 많으며 말이 날카로워 구설 소지가 있으나, 잘 발현되면 대기만성형 전문가가 된다. 재백궁에서는 말·전문성으로 버는 재물, 관록궁에서는 법률·교육·언론·의료·상담, 부처궁에서는 논쟁 소지가 있는 관계로 본다. 거문이 자오궁에 좋게 놓이면 "석중은옥격"으로 본다.',
    school_dependent: false,
    sources: ['clien.net', 'cafe.daum 백현사주', '나무위키'],
  },
  {
    id: 'ziwei_star_cheonsang',
    system: 'ziwei',
    category: 'main_star',
    concept: '천상',
    match_terms: ['天相', '천상'],
    content:
      '오행은 양수(陽水), 인수(印綬)·보좌·충직의 별. 공정·성실·배려·의식주를 중시하며 조율·보좌에 능하다. 명궁에 있으면 온후·충실하고 외모·품위를 중시하나 다소 게으르거나 우유부단할 수 있다. 각 별의 장점을 두루 갖춘 멀티플레이어형이나 최고의 강점은 없다는 평이 있다. 재백궁에서는 안정 관리형 재물, 관록궁에서는 공직·행정·비서·중개, 부처궁에서는 충실하고 배려심 있는 배우자로 본다.',
    school_dependent: false,
    sources: ['clien.net', 'blog.daum 자미두수 정리'],
  },
  {
    id: 'ziwei_star_cheonryang',
    system: 'ziwei',
    category: 'main_star',
    concept: '천량',
    match_terms: ['天梁', '천량'],
    content:
      '오행은 양토(陽土), 음덕·수명·감찰의 별(노인성·장군성). 통찰·원칙·보호 본능이 강하고 어른스럽다. 명궁에 있으면 책임감 있고 남을 돌보며 분석·감찰에 능하나, 잔소리·간섭·고독의 그림자가 있다. 재백궁에서는 청렴한 재물(투기 부적합), 관록궁에서는 법무·감사·의료·교육·종교, 부처궁에서는 연상 또는 든든한 배우자로 본다. 태양과 만나면 고독함이 완화된다는 해석이 있다.',
    school_dependent: false,
    sources: ['clien.net', 'blog.daum 자미두수 정리'],
  },
  {
    id: 'ziwei_star_chilsal',
    system: 'ziwei',
    category: 'main_star',
    concept: '칠살',
    match_terms: ['七殺', '칠살'],
    content:
      '오행은 음금(陰金), 숙살·개척의 장군성. 과감·독립·직선적이며 강한 추진력과 개척정신이 있다. 명궁에 있으면 용감하고 위엄이 있으나 성격이 강하고 고독하며 기복이 있다. 살파랑(칠살·파군·탐랑) 조합의 일원으로 변화·도전·창업에 어울린다. 재백궁에서는 경쟁적·기복 있는 재물, 관록궁에서는 군경·기술·생산·창업, 부처궁에서는 강한 개성의 배우자로 본다. 자미를 만나면 안정·리더십으로 순화된다.',
    school_dependent: false,
    sources: ['clien.net', 'blog.daum 자미두수 정리', '나무위키'],
  },
  {
    id: 'ziwei_star_pagun',
    system: 'ziwei',
    category: 'main_star',
    concept: '파군',
    match_terms: ['破軍', '파군'],
    content:
      '오행은 음수(陰水), 소모·개혁·파괴 후 재건의 장군성. 기존 질서를 깨고 새로 세우는 강한 변화의 별이다. 명궁에 있으면 개척적·모험적이고 변화를 주도하나, 불안정·소모·인간관계 굴곡이 크다. 재백궁에서는 변동성 큰 재물(파재 후 재기), 관록궁에서는 개혁·창업·기술·이동성 직업, 부처궁에서는 굴곡 있는 관계로 본다. 자오궁의 파군이 길성을 보면 "영성입묘격"으로 권위를 이룬다고 본다.',
    school_dependent: false,
    sources: ['나무위키', 'sng-mia.com', 'blog.daum 자미두수 정리'],
  },
];
