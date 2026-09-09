// apps/web/src/components/ShareCard.jsx
//
// 공유 카드 2종:
//   - tier="free": 동양화 느낌 배경 + 궁서체(Song Myung, 궁서체st일과 가장 가까운 구글폰트)
//   - tier="paid": 자개(모조 자개 패턴) 장식 — 유료 결제 시 나오는 결과 전용
// 지시사항: "자개 장식은 유료 결제 시 나오는 결과 공유카드에만 쓴다."
export function ShareCard({ tier = 'free', title, subtitle, emoji }) {
  const isPaid = tier === 'paid';
  return (
    <div className={`share-card ${isPaid ? 'share-card--paid' : 'share-card--free'}`}>
      {isPaid && (
        <svg className="share-card__jagae" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 300 200">
          <defs>
            <linearGradient id="jagaeGradient1" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#8CE6D0" />
              <stop offset="35%" stopColor="#B79CE6" />
              <stop offset="70%" stopColor="#F2A8C9" />
              <stop offset="100%" stopColor="#8CC7E6" />
            </linearGradient>
          </defs>
          {Array.from({ length: 7 }, (_, i) => (
            <polygon
              key={i}
              points={`${20 + i * 40},10 ${45 + i * 40},30 ${35 + i * 40},70 ${5 + i * 40},55`}
              fill="url(#jagaeGradient1)"
              opacity="0.5"
              transform={`rotate(${i % 2 === 0 ? 12 : -12} ${20 + i * 40} 40)`}
            />
          ))}
        </svg>
      )}
      {!isPaid && (
        <svg className="share-card__ink-bg" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 300 200">
          <path d="M 0 160 Q 60 120 110 150 Q 160 175 220 140 Q 260 118 300 135 L 300 200 L 0 200 Z" fill="#8A7468" opacity="0.15" />
          <circle cx="255" cy="35" r="20" fill="#C4886E" opacity="0.2" />
        </svg>
      )}

      <div className="share-card__content">
        {emoji && <div className="share-card__emoji">{emoji}</div>}
        <p className={`share-card__title ${!isPaid ? 'share-card__title--gungseo' : ''}`}>{title}</p>
        {subtitle && <p className="share-card__subtitle">{subtitle}</p>}
        <p className="share-card__brand">사주냥</p>
      </div>

      {isPaid && <div className="share-card__paid-badge">✨ 프리미엄 결과</div>}
    </div>
  );
}
