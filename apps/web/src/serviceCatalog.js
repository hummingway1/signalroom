// apps/web/src/serviceCatalog.js
//
// §SERVICE_CATALOG — SIGNAL ROOM 7개 서비스의 identity/UI 정보를 담는 단일 소스.
// internalServiceKey는 기존 백엔드 API가 요구하는 실제 값(변경 없음).
// 가격/quota는 여기 없다 — GET /api/products에서 productCodes로 조회한다(하드코딩 금지).
export const SERVICE_CATALOG = {
  saju: {
    id: 'saju',
    title: '사주',
    subtitle: '타고난 성향과 삶의 흐름',
    description: '태어난 년월일시를 바탕으로 나의 타고난 성향과 삶의 흐름을 사주로 살펴봐요.',
    status: 'active',
    npc: 'daegu',
    internalServiceKey: 'saju',
    greeting: '어서 와. 이 방에서는 사주로 타고난 성향과 삶의 흐름을 살펴볼 수 있어.',
    quickReplies: [
      { label: '내 사주 분석 시작하기', action: 'start' },
      { label: '사주로 무엇을 볼 수 있어?', action: 'describe' },
      { label: '가격과 분석 내용 보기', action: 'products' },
    ],
    productCodes: ['SAJU_BASIC', 'SAJU_DETAIL'],
  },
  jami: {
    id: 'jami',
    title: '자미두수',
    subtitle: '시간 정보를 활용하는 세밀한 분석',
    description: '태어난 년월일시를 바탕으로 나의 타고난 성향과 삶의 흐름을 자미두수로 살펴봐요. 출생시간 정보를 활용해 더 세밀하게 볼 수 있어요.',
    status: 'active',
    npc: 'daegu',
    internalServiceKey: 'saju',
    greeting: '어서 와. 이 방에서는 자미두수로 시간의 흐름까지 함께 살펴볼 수 있어.',
    quickReplies: [
      { label: '내 자미두수 분석 시작하기', action: 'start' },
      { label: '자미두수로 무엇을 볼 수 있어?', action: 'describe' },
      { label: '가격과 분석 내용 보기', action: 'products' },
    ],
    productCodes: ['SAJU_BASIC', 'SAJU_DETAIL'],
  },
  yearlyFortune: {
    id: 'yearlyFortune',
    title: '신년운세',
    subtitle: '올해 한 해의 흐름',
    description: '특정 연도의 총운·재물운·직업운·인간관계·연애운·건강운을 월별로 살펴봐요.',
    status: 'active',
    npc: 'daegu',
    internalServiceKey: 'yearlyFortune',
    greeting: '어서 와. 이 방에서는 올해 한 해의 흐름을 자세히 살펴볼 수 있어.',
    quickReplies: [
      { label: '올해 운세 분석 시작하기', action: 'start' },
      { label: '신년운세로 무엇을 볼 수 있어?', action: 'describe' },
      { label: '가격과 분석 내용 보기', action: 'products' },
    ],
    productCodes: ['YEARLY_FORTUNE_BASIC', 'YEARLY_FORTUNE_CHAT'],
  },
  gunghap: {
    id: 'gunghap',
    title: '궁합',
    subtitle: '두 사람의 관계 흐름',
    description: '나와 상대방의 정보를 함께 넣어 두 사람의 관계 구조와 성향 흐름을 살펴봐요.',
    status: 'active',
    npc: 'daegu',
    internalServiceKey: 'relationship',
    greeting: '어서 와. 이 방에서는 두 사람의 관계 구조와 흐름을 함께 살펴볼 수 있어.',
    quickReplies: [
      { label: '궁합 분석 시작하기', action: 'start' },
      { label: '궁합으로 무엇을 볼 수 있어?', action: 'describe' },
      { label: '가격과 분석 내용 보기', action: 'products' },
    ],
    productCodes: ['RELATIONSHIP_BASIC', 'RELATIONSHIP_DETAIL'],
  },
  isignal: {
    id: 'isignal',
    title: '아이시그널',
    subtitle: '아이의 성향과 고민 코칭',
    description: '아이의 사주를 바탕으로 성향과 기질을 살펴보고, 아이를 이해하는 데 도움이 될 관점과 대화 방법을 찾아드려요.',
    status: 'active',
    npc: 'daegu',
    internalServiceKey: 'child',
    greeting: '어서 와. 이 방에서는 아이의 성향을 함께 살펴보고 고민을 나눌 수 있어.',
    quickReplies: [
      { label: '아이 분석 시작하기', action: 'start' },
      { label: '아이시그널로 무엇을 볼 수 있어?', action: 'describe' },
      { label: '가격과 분석 내용 보기', action: 'products' },
    ],
    productCodes: ['CHILD_BASIC', 'CHILD_DETAIL'],
  },
  taegil: {
    id: 'taegil',
    title: '출생일 택일',
    subtitle: '아이가 태어날 좋은 날',
    description: '희망하는 날짜/시간 범위 안에서 후보들을 비교해서 살펴봐요.',
    status: 'active',
    npc: 'daegu',
    internalServiceKey: 'dateSelection',
    greeting: '어서 와. 이 방에서는 출생일 후보들을 비교해서 살펴볼 수 있어.',
    quickReplies: [
      { label: '택일 분석 시작하기', action: 'start' },
      { label: '출생일 택일로 무엇을 볼 수 있어?', action: 'describe' },
      { label: '가격과 분석 내용 보기', action: 'products' },
    ],
    productCodes: ['DATE_SELECTION'],
  },
  naming: {
    id: 'naming',
    title: '작명',
    subtitle: '준비 중인 서비스',
    description: '이름 후보를 비교해서 살펴보는 작명 서비스를 준비하고 있어요.',
    status: 'comingSoon',
    npc: 'daegu',
    internalServiceKey: 'naming',
    greeting: null,
    quickReplies: [],
    productCodes: [],
  },
};

export function getServiceCatalogEntry(serviceId) {
  return SERVICE_CATALOG[serviceId] ?? null;
}
