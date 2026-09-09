// apps/web/src/components/AnalysisCard.jsx
//
// Figma AnalysisCard 이식 — 그라데이션 배경 + 한지(hanji) 질감 SVG 필터 + 상단 accent 테두리.
// 백엔드 highlight_card 스키마(title/subtitle/detail_available)는 그대로 쓰되, 시각 스타일만
// Figma 그대로 옮겼다. Figma 카드의 emoji 필드는 백엔드 스키마에 없어서 생략(범위 외 — 새 스키마
// 필드 추가는 별도 승인 필요).
export function AnalysisCard({ card, onOpenDetail }) {
  if (!card) return null;
  return (
    <div className="analysis-card slide-up">
      {/* Hanji(한지) texture — Figma 원본 그대로 feTurbulence 노이즈 */}
      <svg className="analysis-card__texture" xmlns="http://www.w3.org/2000/svg">
        <filter id="hanji-analysis-card">
          <feTurbulence type="fractalNoise" baseFrequency="0.72" numOctaves="4" stitchTiles="stitch" />
          <feColorMatrix type="saturate" values="0" />
        </filter>
        <rect width="100%" height="100%" filter="url(#hanji-analysis-card)" />
      </svg>
      <div className="analysis-card__content">
        <div className="analysis-card__header">
          <span className="analysis-card__title">{card.title}</span>
        </div>
        <p className="analysis-card__subtitle">{card.subtitle}</p>
        {card.detail_available && (
          <button className="analysis-card__cta" onClick={onOpenDetail}>
            자세히 보기 <span aria-hidden="true">›</span>
          </button>
        )}
      </div>
    </div>
  );
}
