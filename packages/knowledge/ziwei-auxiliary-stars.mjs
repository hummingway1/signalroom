// packages/knowledge/ziwei-auxiliary-stars.mjs
//
// 자미두수 보조성/살성 14개 지식 청크. Canonical JSON에서 star name(한자) 값과 match_terms가
// 일치해야 자동 검색이 작동한다.

export const ZIWEI_AUXILIARY_STAR_CHUNKS = [
  {
    id: 'ziwei_aux_jwabo',
    system: 'ziwei',
    category: 'auxiliary_star',
    concept: '좌보',
    match_terms: ['左輔', '좌보'],
    content:
      '보필(輔弼) 중 하나인 조력의 별(양토). 동료·평배·주변 사람의 도움을 상징한다. 주성과 동궁하면 복과 역량을 강화하고 귀인의 조력을 늘린다. 우필과 짝으로 만나야(동궁·삼방·협) 힘이 강하며, 좌보는 선천적·무조건적 조력의 성격이 강하다고 본다. 자미가 보필의 보좌를 받으면 "군신경회격"으로 크게 성공한다.',
    school_dependent: false,
    sources: ['나무위키', 'gall.dcinside.com'],
  },
  {
    id: 'ziwei_aux_upil',
    system: 'ziwei',
    category: 'auxiliary_star',
    concept: '우필',
    match_terms: ['右弼', '우필'],
    content:
      '보필(輔弼) 중 하나인 조력의 별(음수). 좌보와 짝을 이루며, 좌보보다는 노력형 조력·인복의 성격이 강하다고 구분하기도 한다. 도화적 의미도 겸해서 대인 매력과도 연결된다. 주성과 동궁·삼방·협으로 만나면 복과 역량을 강화한다.',
    school_dependent: false,
    sources: ['나무위키', 'gall.dcinside.com'],
  },
  {
    id: 'ziwei_aux_munchang',
    system: 'ziwei',
    category: 'auxiliary_star',
    concept: '문창',
    match_terms: ['文昌', '문창'],
    content:
      '창곡(昌曲) 중 하나인 학문·재능의 별(음금). 정통 학문·문서·시험운을 상징한다. 주성과 동궁하면 총명·풍채·명예·시험운을 강화한다. 문곡보다 정통 학문·자격 쪽의 조력으로 구분된다.',
    school_dependent: false,
    sources: ['gall.dcinside.com', 'sng-mia.com'],
  },
  {
    id: 'ziwei_aux_mungok',
    system: 'ziwei',
    category: 'auxiliary_star',
    concept: '문곡',
    match_terms: ['文曲', '문곡'],
    content:
      '창곡(昌曲) 중 하나인 예술·구변의 별(음수). 예술·구변·잡학 방면의 재능·표현력을 상징한다. 주성과 동궁하면 총명·풍채·명예를 강화하나, 수(水)·도화 성질이라 염정·탐랑·살성·화기와 겹치면 감정·이성 문제로 흐를 수 있다는 점이 문창과의 차이다.',
    school_dependent: false,
    sources: ['gall.dcinside.com', 'sng-mia.com'],
  },
  {
    id: 'ziwei_aux_cheongoe',
    system: 'ziwei',
    category: 'auxiliary_star',
    concept: '천괴',
    match_terms: ['天魁', '천괴'],
    content:
      '괴월(魁鉞) 중 하나인 천을귀인의 별(양화, 낮의 귀인). 윗사람·상사 등 장배(長輩) 귀인의 발탁·기회를 상징한다. 주성과 동궁·회조하면 시험운·귀인운을 강화하며 "괴월동궁격/좌귀향귀격"을 이룬다. 역량이 강하고 오래간다고 본다.',
    school_dependent: false,
    sources: ['나무위키', 'gall.dcinside.com'],
  },
  {
    id: 'ziwei_aux_cheonwol',
    system: 'ziwei',
    category: 'auxiliary_star',
    concept: '천월',
    match_terms: ['天鉞', '천월'],
    content:
      '괴월(魁鉞) 중 하나인 천을귀인의 별(음화, 밤의 귀인). 천괴와 짝을 이루는 장배 귀인성으로, 도화적 의미도 있어 이성 인기와 연결되기도 한다. 주성과 동궁·회조하면 귀인운·시험운을 강화한다.',
    school_dependent: false,
    sources: ['나무위키', 'gall.dcinside.com'],
  },
  {
    id: 'ziwei_aux_nokjon',
    system: 'ziwei',
    category: 'auxiliary_star',
    concept: '녹존',
    match_terms: ['祿存', '녹존'],
    content:
      '재물·직위·집중·보수·안정을 상징하는 정재적 성격의 별. 자존심·허영이 강한 주성을 현실적으로 조율하는 역할을 한다. 천마와 동궁·회조하면 "녹마교치(祿馬交馳)"격을 이뤄 고정성과 역동성이 결합해 활동적으로 큰 재물을 이루는 사업가형으로 본다. 녹존은 경양·타라의 협을 받는 위치라 살성과의 관계도 함께 살펴야 한다.',
    school_dependent: false,
    sources: ['나무위키', 'gall.dcinside.com'],
  },
  {
    id: 'ziwei_aux_cheonma',
    system: 'ziwei',
    category: 'auxiliary_star',
    concept: '천마',
    match_terms: ['天馬', '천마'],
    content:
      '이동·활동·역동성을 상징하는 별. 녹존과 동궁·회조하면 "녹마교치(祿馬交馳)"격을 이뤄 고정적 재물(녹존)과 역동적 활동력(천마)이 결합해 활동적인 큰 재물을 이룬다고 본다. 재물 관련 대표 길조합 중 하나로 꼽힌다.',
    school_dependent: false,
    sources: ['나무위키', 'gall.dcinside.com'],
  },
  {
    id: 'ziwei_aux_gyeongyang',
    system: 'ziwei',
    category: 'auxiliary_star',
    concept: '경양',
    match_terms: ['擎羊', '경양'],
    content:
      '양타(羊陀)라 불리는 사살(四煞)의 으뜸 중 하나. 화기(化氣)가 형(刑)으로 파괴력·시비·후유증(다 된 일에 재를 뿌리는 형국)을 상징한다. 주성과 동궁 시 흉을 강화하나, 군경·의료·과학기술처럼 살의 격발력이 필요한 분야에서는 긍정적으로 발현되기도 한다. 오궁의 경양+살성 조합은 "마두대전격"(큰 위험이나 극복 시 큰 공)으로 본다.',
    school_dependent: false,
    sources: ['cyworld.com 육살성', '나무위키'],
  },
  {
    id: 'ziwei_aux_tara',
    system: 'ziwei',
    category: 'auxiliary_star',
    concept: '타라',
    match_terms: ['陀羅', '타라'],
    content:
      '양타(羊陀) 중 하나인 사살(四煞)에 속하는 별. 화기(化氣)가 기(忌)로 장애·지연·질질 끄는 성질(성취해도 이익이 손에 안 들어오는 형국)을 상징한다. 경양보다는 느리고 우회적인 흉으로 작용한다고 본다. 주성과 동궁하면 지연·장애 요소로 해석하되, 인내·지구력을 요구하는 분야에서는 다르게 발현될 수 있다.',
    school_dependent: false,
    sources: ['cyworld.com 육살성', '나무위키'],
  },
  {
    id: 'ziwei_aux_hwaseong',
    system: 'ziwei',
    category: 'auxiliary_star',
    concept: '화성',
    match_terms: ['火星', '화성'],
    content:
      '사살에 속하는 급변의 별(명적明的 성질). 길흉이 빠르고 물질적 타격이 크게 나타나는 특징이 있다. 일반 주성과 동궁하면 흉을 격발하나, 탐랑과 동궁하면 "화탐격(火貪格)"을 이뤄 오히려 갑작스러운 발전·재물운으로 길하게 작용한다고 전해진다(순간적 폭발형). 다만 지공·지겁·화기가 겹치면 오히려 폭패(破敗)로 반전될 수 있다.',
    school_dependent: false,
    sources: ['나무위키', 'sooha.net', 'm.dcinside.com 자미갤'],
  },
  {
    id: 'ziwei_aux_yeongseong',
    system: 'ziwei',
    category: 'auxiliary_star',
    concept: '영성',
    match_terms: ['鈴星', '영성'],
    content:
      '사살에 속하는 급변의 별(암적暗的 성질). 화성과 대비되게 길흉이 더디게 나타나지만 정신적 상처가 오래 남는 특징이 있다. 탐랑과 동궁하면 "영탐격(鈴貪格)"을 이뤄 화탐격보다 더 지속적이고 큰 규모의 발전으로 나타난다고 본다. 지공·지겁·화기와 겹치면 폭패로 반전될 수 있다는 점은 화성과 같다.',
    school_dependent: false,
    sources: ['나무위키', 'sooha.net', 'm.dcinside.com 자미갤'],
  },
  {
    id: 'ziwei_aux_jigong',
    system: 'ziwei',
    category: 'auxiliary_star',
    concept: '지공',
    match_terms: ['地空', '지공'],
    content:
      '공성(空星, 공겁空劫 중 하나). 상실·비움·이상주의·현실 성취 저해를 상징한다. 주성과 동궁하면 재물이 모이지 않고 손실이 생기며, 투기·도박성 손재와 연결되기도 한다. 흉을 강화하고 격국을 깨뜨리는 성질이 있으나, 종교·철학·창의 분야에서는 초월적 사고로 긍정적으로 발현되기도 한다. 화탐/영탐격을 파괴하는 대표적인 별이다.',
    school_dependent: false,
    sources: ['나무위키', 'cafe.daum 금화당 육살성'],
  },
  {
    id: 'ziwei_aux_jigeob',
    system: 'ziwei',
    category: 'auxiliary_star',
    concept: '지겁',
    match_terms: ['地劫', '지겁'],
    content:
      '공성(空星, 공겁空劫 중 하나). 지공과 함께 상실·비움을 상징하되, 재물 손실 측면에서는 지겁이 지공보다 더 엄중하다고 본다. 명궁이 지공·지겁 사이에 끼면 "겁공협명격"(이상은 높으나 축재·현실 성취가 어려움)을 이룬다. 화탐/영탐격을 가장 잘 파괴하는 별로 꼽힌다.',
    school_dependent: false,
    sources: ['나무위키', 'cafe.daum 금화당 육살성'],
  },
];
