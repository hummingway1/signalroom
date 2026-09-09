// apps/web/src/components/MoreMenu.jsx
//
// 채팅 헤더의 "더보기" 메뉴 — 사주 세계관/사주 대결/랭킹/궁합/자녀 사주로 진입하는 통합 메뉴.
// 아이콘을 헤더에 5개씩 늘어놓지 않고 하나로 묶어서 화면을 복잡하게 만들지 않는다.
const MENU_ITEMS = [
  { key: 'fun', emoji: '🔮', label: '사주 세계관 탐험' },
  { key: 'battle', emoji: '⚔️', label: '사주 대결' },
  { key: 'ranking', emoji: '🏆', label: '랭킹' },
  { key: 'compatibility', emoji: '💘', label: '궁합' },
  { key: 'child', emoji: '🤓', label: '자녀 사주' },
  { key: 'yearlyFortune', emoji: '🎍', label: '신년운세' },
];

export function MoreMenu({ onSelect, onClose }) {
  return (
    <div className="more-menu-overlay" onClick={onClose}>
      <div className="more-menu" onClick={(e) => e.stopPropagation()}>
        <div className="more-menu__handle" />
        {MENU_ITEMS.map((item) => (
          <button key={item.key} className="more-menu__item" onClick={() => onSelect(item.key)}>
            <span className="more-menu__emoji">{item.emoji}</span>
            <span>{item.label}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
