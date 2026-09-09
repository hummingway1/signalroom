// apps/web/src/components/HomeScreen.jsx
//
// §디자인 갱신 — Figma Make(teal 팔레트) 디자인 언어를 이식하되, 사용자 피드백대로 아이시그널만
// 과도하게 부각되지 않도록 3개 서비스를 동일한 크기의 카드로 균형있게 배치한다. 히어로 영역은
// 특정 서비스가 아니라 브랜드 전체를 소개하는 중립적 자리로 둔다. 계산 엔진/라우팅 로직은 무변경.
export const SERVICES = [
  { key: 'child', emoji: '🤓', title: '아이시그널', description: '아이를 더 잘 이해하기 위한 성향과 고민 코칭' },
  { key: 'saju', emoji: '🔮', title: '나의 시그널', description: '나의 성향과 흐름을 사주와 자미두수로 살펴보기' },
  { key: 'relationship', emoji: '💘', title: '관계 시그널', description: '두 사람의 성향과 관계 흐름 살펴보기' },
];

export function HomeScreen({ onSelect, onLogin, onOpenMyPage, nickname }) {
  return (
    <div className="home-screen">
      <div className="home-screen__topbar">
        <span className="home-screen__brand">아이시그널</span>
        {nickname ? (
          <button className="home-screen__nickname" onClick={onOpenMyPage}>{nickname}님</button>
        ) : (
          <button className="home-screen__login-btn" onClick={onLogin}>로그인 / 회원가입</button>
        )}
      </div>

      <div className="home-hero fade-up">
        <p className="home-hero__eyebrow">나와 우리를 이해하는 시간</p>
        <p className="home-hero__title">오늘은 어떤 이야기를<br />나눠볼까요</p>
      </div>

      <div className="home-service-list">
        {SERVICES.map((service, i) => (
          <button
            key={service.key}
            className="home-service-card fade-up"
            style={{ animationDelay: `${0.06 + i * 0.05}s` }}
            onClick={() => onSelect(service.key)}
          >
            <span className="home-service-card__badge">{service.emoji}</span>
            <span className="home-service-card__body">
              <span className="home-service-card__title">{service.title}</span>
              <span className="home-service-card__desc">{service.description}</span>
            </span>
            <span className="home-service-card__arrow">›</span>
          </button>
        ))}
      </div>
    </div>
  );
}
