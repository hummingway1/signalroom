// apps/web/src/funContentData.js
//
// ⚠️ 정적 데모 데이터 — 실제 사주 계산과 무관하다. Figma Make 원본(App.tsx의 FUN_DATA)에
// 하드코딩되어 있던 값을 그대로 이식했다. 백엔드 saju-original.md/ziwei-original.md 파이프라인을
// 거치지 않으므로, 사용자의 실제 명식과 아무 관련이 없는 "재미용 체험 콘텐츠"다.
// 실제 사주 데이터와 연동하려면 별도의 백엔드 기능/승인이 필요하다(이번 작업 범위 밖).
export const FUN_DATA = {
  joseon: {
    hanja: '文官', label: '조선 중기 문관', emoji: '✒️',
    accent: '#4A6D8C', bg: 'linear-gradient(135deg, #EEF4F8 0%, #E8F0F5 100%)',
    badgeBg: '#4A6D8C18', badgeText: '#4A6D8C',
    description: '예리한 관찰력과 신중한 판단력을 가진 당신. 조선이었다면 글 한 줄로 세상을 바꾸려 했을 거예요. 사람의 마음을 읽는 데 능하고, 의리를 중시합니다.',
    tags: ['관찰력', '신중함', '글의 힘'],
    note: '사림파 계열 / 퇴계 이황 유형과 유사',
  },
  kingdoms: {
    hanja: '諸葛亮型', label: '제갈량형', emoji: '⚔️',
    accent: '#7A3030', bg: 'linear-gradient(135deg, #F5ECEC 0%, #F0E6E4 100%)',
    badgeBg: '#7A303018', badgeText: '#7A3030',
    description: '행동보다 전략이 먼저입니다. 겉으로는 조용하지만 이미 열 수 앞을 계산하고 있어요. 신뢰하는 사람에겐 깊이 헌신하는 타입이에요.',
    tags: ['전략가', '냉철함', '긴 호흡'],
    note: '삼국지 기준 지략 최상위 유형',
  },
  nineties: {
    hanja: '靑春', label: '조용한 전문직 지망생', emoji: '📚',
    accent: '#8A6A30', bg: 'linear-gradient(135deg, #F8F2E6 0%, #F3EBD8 100%)',
    badgeBg: '#8A6A3018', badgeText: '#8A6A30',
    description: '1993년, 도서관 한 켠에서 혼자 공부하면서도 주변 상황은 다 파악하는 타입이에요. 의리 있고, 자기 기준이 높으며, 야망을 속으로 품는 편이에요.',
    tags: ['자기관리', '관찰', '높은 기준'],
    note: '고시반 또는 의대 준비생 계열',
  },
};

export const FUN_TABS = [
  { key: 'joseon', label: '조선시대' },
  { key: 'kingdoms', label: '삼국지' },
  { key: 'nineties', label: '1990년대' },
];

// ⚠️ 정적 데모 데이터 — 실제 사주 비교 계산이 아니다 (Figma App.tsx의 BATTLE_ITEMS 그대로).
export const BATTLE_ITEMS = [
  { q: '누가 더 먼저 움직일까?', me: 36, note: '신중한 당신보다 친구가 먼저 행동에 나설 것 같아요.' },
  { q: '싸울 때 누가 더 무서울까?', me: 71, note: '평소엔 조용하지만 화나면 더 오래 가는 편이에요.' },
  { q: '누가 조직의 중심이 될까?', me: 63, note: '사람들이 자연스럽게 의지하게 되는 타입이에요.' },
  { q: '둘이 사업하면 누가 대표?', me: 44, note: '당신은 실무, 친구는 얼굴 역할이 어울릴 것 같아요.' },
  { q: '인생에서 더 많이 웃을 사람?', me: 57, note: '비슷하지만 당신이 조금 더 웃는 날이 많을 것 같아요.' },
];
