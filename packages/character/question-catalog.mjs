// packages/character/question-catalog.mjs
//
// "다음에 사용자가 할 법한 말" 카탈로그. 사용자에게는 자연스러운 대화 선택지로 보이지만, 내부적으로는
// 완전히 정형화된 데이터다 — 이게 핵심 설계 원칙이다.
//
// 각 항목을 골랐을 때 packages/ai/pipeline.mjs의 predefinedRouting으로 그대로 주입되므로, Question
// Router AI 호출(Stage 1)이 스킵된다 — 카탈로그 기반 질문은 분석 호출 1회만 발생한다(비용 절반).
//
// required_data의 필드명은 packages/shared/categories.mjs의 실제 값과 정확히 일치해야 한다(임의
// 필드명 금지 — 기존 프로젝트 전체를 관통하는 원칙과 동일).

export const QUESTION_CATALOG = [
  // ============== personality (본질/성향) ==============
  {
    id: 'personality_confirm_1',
    category: 'PERSONALITY', context: 'personality',
    display_text: '어? 내가 그래?',
    question_text: '방금 언급한 성향이 실제로 맞는지, 그리고 왜 그렇게 나타나는지 조금 더 구체적으로 설명해줘.',
    kind: 'confirmation', character: 'manggu', priority: 90, free: true, product_link: null,
    required_data: { saju_fields: ['day_master', 'pillars'], ziwei_fields: ['life_palace', 'body_palace', 'palaces'], ziwei_palace_focus: ['life', 'fortune'] },
    prev_context: [], next_context: 'personality',
  },
  {
    id: 'personality_relationship_link',
    category: 'RELATIONSHIP', context: 'personality',
    display_text: '근데 인간관계에서도 그래?',
    question_text: '방금 언급한 성향이 인간관계나 사람을 대하는 방식에서는 어떻게 나타나는지 설명해줘.',
    kind: 'question', character: 'daegu', priority: 85, free: true, product_link: null,
    required_data: { saju_fields: ['pillars', 'special_stars'], ziwei_fields: ['palaces'], ziwei_palace_focus: ['friends', 'siblings', 'fortune'] },
    prev_context: ['personality'], next_context: 'relationship',
  },
  {
    id: 'personality_love_switch',
    category: 'LOVE', context: 'personality',
    display_text: '근데 연애할 때도 그래?',
    question_text: '방금 언급한 성향이 연애할 때는 어떻게 나타나는지 설명해줘.',
    kind: 'topic_switch', character: 'manggu', priority: 80, free: true, product_link: null,
    required_data: { saju_fields: ['pillars', 'relations'], ziwei_fields: ['palaces'], ziwei_palace_focus: ['spouse'] },
    prev_context: ['personality'], next_context: 'love',
  },
  {
    id: 'personality_agree_1',
    category: 'PERSONALITY', context: 'personality',
    display_text: 'ㅋㅋㅋ 그건 좀 맞는 것 같은데',
    question_text: '방금 언급한 특징에 대해 사용자가 공감을 표했다. 그 특징이 실생활에서 구체적으로 어떻게 드러나는지 예시를 들어 조금 더 풀어서 설명해줘.',
    kind: 'agreement', character: 'daegu', priority: 70, free: true, product_link: null,
    required_data: { saju_fields: ['day_master', 'pillars'], ziwei_fields: ['palaces'], ziwei_palace_focus: ['life'] },
    prev_context: ['personality'], next_context: 'personality',
  },
  {
    id: 'personality_disagree_1',
    category: 'PERSONALITY', context: 'personality',
    display_text: '나는 오히려 아닌 것 같은데',
    question_text: '사용자가 방금 언급한 특징에 동의하지 않는다고 반응했다. 그 특징이 겉으로 잘 안 드러나거나 특정 상황에서만 나타날 수 있는 이유를 데이터에 근거해서 설명해줘. 사용자 의견을 무시하지 말고, 원국 구조상 왜 그렇게 보일 수 있는지 균형 있게 설명해줘.',
    kind: 'disagreement', character: 'daegu', priority: 65, free: true, product_link: null,
    required_data: { saju_fields: ['day_master', 'pillars', 'relations'], ziwei_fields: ['palaces'], ziwei_palace_focus: ['life', 'fortune'] },
    prev_context: ['personality'], next_context: 'personality',
  },

  // ============== relationship (인간관계) ==============
  {
    id: 'relationship_why',
    category: 'RELATIONSHIP', context: 'relationship',
    display_text: '어떻게 그런지 좀 더 말해줘',
    question_text: '인간관계에서 사용자가 신경 쓰거나 피곤함을 느낄 수 있는 구체적인 패턴을 설명해줘.',
    kind: 'request_more', character: 'daegu', priority: 75, free: true, product_link: null,
    required_data: { saju_fields: ['pillars', 'special_stars', 'relations'], ziwei_fields: ['palaces'], ziwei_palace_focus: ['friends', 'siblings'] },
    prev_context: ['relationship', 'personality'], next_context: 'relationship',
  },
  {
    id: 'relationship_to_love',
    category: 'LOVE', context: 'relationship',
    display_text: '그럼 연애할 때는 어때?',
    question_text: '지금까지 언급한 인간관계 패턴이 연애 관계에서는 어떻게 나타나는지 설명해줘.',
    kind: 'topic_switch', character: 'manggu', priority: 70, free: true, product_link: null,
    required_data: { saju_fields: ['pillars', 'relations'], ziwei_fields: ['palaces'], ziwei_palace_focus: ['spouse'] },
    prev_context: ['relationship'], next_context: 'love',
  },

  // ============== love (연애) ==============
  {
    id: 'love_who_attracts',
    category: 'LOVE', context: 'love',
    display_text: '나는 어떤 사람한테 끌려?',
    question_text: '사용자가 어떤 유형의 사람에게 끌리는 편인지 설명해줘.',
    kind: 'question', character: 'manggu', priority: 90, free: true, product_link: null,
    required_data: { saju_fields: ['pillars', 'relations'], ziwei_fields: ['palaces'], ziwei_palace_focus: ['spouse'] },
    prev_context: ['love'], next_context: 'love',
  },
  {
    id: 'love_compatible',
    category: 'MARRIAGE', context: 'love',
    display_text: '그럼 나랑 잘 맞는 사람은?',
    question_text: '사용자와 관계에서 궁합이 좋을 수 있는 상대의 특징을 설명해줘.',
    kind: 'question', character: 'daegu', priority: 85, free: false, product_link: 'compatibility_report',
    required_data: { saju_fields: ['pillars', 'relations', 'day_master'], ziwei_fields: ['palaces', 'transformations'], ziwei_palace_focus: ['spouse'] },
    prev_context: ['love'], next_context: 'love',
  },
  {
    id: 'love_curious_reaction',
    category: 'LOVE', context: 'love',
    display_text: 'ㅋㅋㅋ 갑자기 연애 얘기네',
    question_text: '가볍게 놀리듯 반응하면서, 연애 관련해서 사용자가 재미있어할 만한 특징 하나를 짧게 짚어줘.',
    kind: 'curiosity', character: 'manggu', priority: 60, free: true, product_link: null,
    required_data: { saju_fields: ['pillars'], ziwei_fields: ['palaces'], ziwei_palace_focus: ['spouse', 'fortune'] },
    prev_context: ['love'], next_context: 'love',
  },

  // ============== wealth (재물) ==============
  {
    id: 'wealth_what',
    category: 'MONEY', context: 'wealth',
    display_text: '뭔데?',
    question_text: '사용자의 재물운/돈에 대한 태도를 간단히 짚어줘.',
    kind: 'curiosity', character: 'manggu', priority: 90, free: true, product_link: null,
    required_data: { saju_fields: ['pillars', 'day_master'], ziwei_fields: ['palaces'], ziwei_palace_focus: ['wealth', 'property', 'fortune'] },
    prev_context: [], next_context: 'wealth',
  },
  {
    id: 'wealth_income_method',
    category: 'MONEY', context: 'wealth',
    display_text: '그럼 나는 돈을 어떻게 벌어야 해?',
    question_text: '사용자에게 잘 맞는 돈 버는 방식/재물 관리 성향을 설명해줘.',
    kind: 'question', character: 'daegu', priority: 85, free: true, product_link: null,
    required_data: { saju_fields: ['pillars', 'day_master'], ziwei_fields: ['palaces'], ziwei_palace_focus: ['wealth', 'career'] },
    prev_context: ['wealth'], next_context: 'wealth',
  },
  {
    id: 'wealth_am_i_rich',
    category: 'MONEY', context: 'wealth',
    display_text: '나 돈복은 있는 편이야?',
    question_text: '사용자의 재물운이 어떤 편인지, 단정적이지 않게 균형 있게 설명해줘.',
    kind: 'question', character: 'manggu', priority: 80, free: true, product_link: null,
    required_data: { saju_fields: ['pillars', 'day_master', 'major_periods'], ziwei_fields: ['palaces'], ziwei_palace_focus: ['wealth', 'fortune'] },
    prev_context: ['wealth'], next_context: 'wealth',
  },
  {
    id: 'wealth_windfall',
    category: 'MONEY', context: 'wealth',
    display_text: '근데 한방으로 크게 버는 건 없어?',
    question_text: '사용자에게 횡재성 재물운이 있는지, 아니면 꾸준한 축적형에 가까운지 설명해줘.',
    kind: 'curiosity', character: 'manggu', priority: 60, free: false, product_link: 'wealth_deep_dive',
    required_data: { saju_fields: ['pillars', 'special_stars'], ziwei_fields: ['palaces', 'transformations'], ziwei_palace_focus: ['wealth', 'fortune'] },
    prev_context: ['wealth'], next_context: 'wealth',
  },

  // ============== career (직업) ==============
  {
    id: 'career_environment',
    category: 'CAREER', context: 'career',
    display_text: '나는 어떤 환경에서 일하는 게 맞아?',
    question_text: '사용자가 경쟁력을 발휘하기 쉬운 직업/업무 환경을 설명해줘.',
    kind: 'question', character: 'daegu', priority: 90, free: true, product_link: null,
    required_data: { saju_fields: ['pillars', 'day_master', 'major_periods'], ziwei_fields: ['palaces'], ziwei_palace_focus: ['career', 'travel', 'wealth', 'friends'] },
    prev_context: [], next_context: 'career',
  },
  {
    id: 'career_org_vs_independent',
    category: 'BUSINESS', context: 'career',
    display_text: '나는 회사 체질이야, 아니면 혼자 하는 체질이야?',
    question_text: '사용자가 조직에 속해서 일하는 것과 독립적으로 일하는 것 중 어느 쪽에 더 잘 맞는지 균형 있게 설명해줘.',
    kind: 'question', character: 'manggu', priority: 85, free: true, product_link: null,
    required_data: { saju_fields: ['pillars', 'day_master', 'major_periods'], ziwei_fields: ['palaces'], ziwei_palace_focus: ['career', 'travel', 'friends'] },
    prev_context: ['career'], next_context: 'career',
  },

  // ============== major_period (대운) ==============
  {
    id: 'major_period_meaning',
    category: 'MAJOR_PERIOD', context: 'major_period',
    display_text: '지금 내 시기는 어떤 시기야?',
    question_text: '사용자의 현재 대운이 어떤 의미를 갖는 시기인지 설명해줘.',
    kind: 'question', character: 'daegu', priority: 90, free: true, product_link: null,
    required_data: { saju_fields: ['major_periods', 'day_master'], ziwei_fields: ['major_periods'], ziwei_palace_focus: [] },
    prev_context: [], next_context: 'major_period',
  },
  {
    id: 'major_period_reason',
    category: 'MAJOR_PERIOD', context: 'major_period',
    display_text: '그래서 요즘 내가 이런 건가?',
    question_text: '현재 대운이 사용자의 최근 상황이나 심리 상태와 어떻게 연결될 수 있는지 설명해줘.',
    kind: 'confirmation', character: 'manggu', priority: 80, free: true, product_link: null,
    required_data: { saju_fields: ['major_periods', 'pillars'], ziwei_fields: ['major_periods', 'palaces'], ziwei_palace_focus: ['fortune'] },
    prev_context: ['major_period'], next_context: 'major_period',
  },
  {
    id: 'major_period_next',
    category: 'MAJOR_PERIOD', context: 'major_period',
    display_text: '다음 시기는 달라?',
    question_text: '다음 대운으로 넘어가면 어떤 변화가 예상되는지 설명해줘.',
    kind: 'question', character: 'daegu', priority: 70, free: false, product_link: 'major_period_deep_dive',
    required_data: { saju_fields: ['major_periods'], ziwei_fields: ['major_periods'], ziwei_palace_focus: [] },
    prev_context: ['major_period'], next_context: 'major_period',
  },
];

export function getCatalogEntry(id) {
  return QUESTION_CATALOG.find((c) => c.id === id) ?? null;
}

// ============================================================
// 자녀 사주 전용 카탈로그 — 실제 사주 계산 파이프라인을 그대로 사용한다(정적 데모 아님).
// 아이의 생년월일시로 만든 canonical chart를 실제 파이프라인에 넣는 것뿐이라, 계산 엔진/원본
// 프롬프트를 전혀 새로 만들 필요가 없다 — 부모용 질문 문구(question_text)만 다르게 구성했다.
// context 4종: child_personality(아이성향) / child_learning(학습) / child_relationship(관계) /
// child_career(진로). getCatalogEntry와 별도로 조회해야 하므로 CHILD_QUESTION_CATALOG로 분리.
// ============================================================
export const CHILD_QUESTION_CATALOG = [
  // ---- 아이성향 ----
  {
    id: 'child_personality_basic',
    category: 'PERSONALITY', context: 'child_personality',
    display_text: '우리 아이는 기본적으로 어떤 성향이야?',
    question_text: '이 아이의 사주 원국을 바탕으로 기본 성향(예민한 편인지, 자기주장이 강한지, 새로운 환경에 어떻게 적응하는지)을 부모가 이해하기 쉽게 설명해줘. 절대적 진단처럼 말하지 말고, 실제 아이의 모습과 함께 관찰해볼 수 있는 조건부 표현을 사용해줘.',
    kind: 'question', character: 'scholar', priority: 100, free: true, product_link: null,
    required_data: { saju_fields: ['day_master', 'pillars'], ziwei_fields: ['life_palace', 'palaces'], ziwei_palace_focus: ['life'] },
    prev_context: [], next_context: 'child_personality',
  },
  {
    id: 'child_personality_alone',
    category: 'PERSONALITY', context: 'child_personality',
    display_text: '혼자 있는 걸 좋아하는 편이야?',
    question_text: '이 아이가 혼자 있는 시간을 선호하는 편인지, 아니면 사람들과 함께 있을 때 에너지를 얻는 편인지 사주 데이터에 근거해서 설명해줘.',
    kind: 'question', character: 'scholar', priority: 80, free: true, product_link: null,
    required_data: { saju_fields: ['day_master', 'pillars', 'special_stars'], ziwei_fields: ['life_palace', 'palaces'], ziwei_palace_focus: ['life', 'friends'] },
    prev_context: ['child_personality'], next_context: 'child_personality',
  },

  // ---- 학습 ----
  {
    id: 'child_learning_method',
    category: 'LEARNING', context: 'child_learning',
    display_text: '어떤 방식으로 공부할 때 효과적이야?',
    question_text: '이 아이에게 반복학습과 경험학습(직접 해보며 배우는 방식) 중 어떤 쪽이 더 잘 맞을 수 있는지, 그리고 집중이 잘 되는 환경은 어떤 편인지 사주 데이터에 근거해서 설명해줘.',
    kind: 'question', character: 'scholar', priority: 100, free: true, product_link: null,
    required_data: { saju_fields: ['day_master', 'pillars'], ziwei_fields: ['palaces'], ziwei_palace_focus: ['career', 'life'] },
    prev_context: [], next_context: 'child_learning',
  },
  {
    id: 'child_learning_competitive',
    category: 'LEARNING', context: 'child_learning',
    display_text: '경쟁형 학습이 잘 맞을까?',
    question_text: '이 아이에게 경쟁하며 성취감을 느끼는 학습 방식이 잘 맞을지, 아니면 비교/경쟁 없이 스스로의 속도로 배우는 게 더 잘 맞을지 설명해줘.',
    kind: 'question', character: 'scholar', priority: 75, free: false, product_link: 'child_learning_deep_dive',
    required_data: { saju_fields: ['day_master', 'pillars', 'relations'], ziwei_fields: ['palaces'], ziwei_palace_focus: ['career'] },
    prev_context: ['child_learning'], next_context: 'child_learning',
  },

  // ---- 관계(또래/형제자매) ----
  {
    id: 'child_relationship_peers',
    category: 'RELATIONSHIP', context: 'child_relationship',
    display_text: '친구 관계는 어떤 편이야?',
    question_text: '이 아이가 또래 관계에서 어떤 역할(주도하는 편/맞춰주는 편 등)을 하는 경향이 있는지, 갈등 상황에서는 어떻게 반응하는 편인지 사주 데이터에 근거해서 설명해줘.',
    kind: 'question', character: 'scholar', priority: 90, free: true, product_link: null,
    required_data: { saju_fields: ['pillars', 'special_stars'], ziwei_fields: ['palaces'], ziwei_palace_focus: ['friends', 'siblings'] },
    prev_context: [], next_context: 'child_relationship',
  },
  {
    id: 'child_relationship_siblings',
    category: 'FAMILY', context: 'child_relationship',
    display_text: '형제자매랑은 어때?',
    question_text: '이 아이와 형제자매 관계에서 나타날 수 있는 경향을 사주 데이터에 근거해서 설명해줘.',
    kind: 'question', character: 'scholar', priority: 65, free: false, product_link: 'child_relationship_deep_dive',
    required_data: { saju_fields: ['pillars', 'relations'], ziwei_fields: ['palaces'], ziwei_palace_focus: ['siblings'] },
    prev_context: ['child_relationship'], next_context: 'child_relationship',
  },

  // ---- 진로 ----
  {
    id: 'child_career_interest',
    category: 'CAREER', context: 'child_career',
    display_text: '나중에 어떤 분야에 흥미를 느낄까?',
    question_text: '이 아이가 어떤 분야(예체능/문과형/이과형 등)에 흥미를 느낄 가능성이 있는지, 어떤 업무/활동 환경이 잘 맞을 수 있는지 사주 데이터에 근거해서 설명해줘. 진로를 단정하지 말고 가능성으로 표현해줘.',
    kind: 'question', character: 'scholar', priority: 100, free: true, product_link: null,
    required_data: { saju_fields: ['day_master', 'pillars'], ziwei_fields: ['palaces'], ziwei_palace_focus: ['career'] },
    prev_context: [], next_context: 'child_career',
  },
  {
    id: 'child_career_environment',
    category: 'CAREER', context: 'child_career',
    display_text: '어떤 환경에서 더 잘 자랄까?',
    question_text: '이 아이가 성장하기에 어떤 환경(자율적인 환경 vs 구조화된 환경 등)이 더 잘 맞을 수 있는지 설명해줘.',
    kind: 'question', character: 'scholar', priority: 70, free: false, product_link: 'child_career_deep_dive',
    required_data: { saju_fields: ['day_master', 'pillars', 'major_periods'], ziwei_fields: ['palaces'], ziwei_palace_focus: ['career', 'life'] },
    prev_context: ['child_career'], next_context: 'child_career',
  },
];

export const CHILD_CATEGORIES = [
  { key: 'child_personality', label: '아이성향' },
  { key: 'child_learning', label: '학습' },
  { key: 'child_relationship', label: '관계' },
  { key: 'child_career', label: '진로' },
];

export function getChildCatalogEntry(id) {
  return CHILD_QUESTION_CATALOG.find((c) => c.id === id) ?? null;
}
