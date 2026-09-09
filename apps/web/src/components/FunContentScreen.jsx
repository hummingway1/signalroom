// apps/web/src/components/FunContentScreen.jsx
//
// Figma FunContentScreen("사주 세계관 탐험") 이식. ⚠️ 이 화면의 콘텐츠는 전부 정적 데모 데이터다
// (funContentData.js 참고) — 실제 사주 계산 파이프라인과 무관하다.
import { useState } from 'react';
import { FUN_DATA, FUN_TABS } from '../funContentData.js';

export function FunContentScreen({ onBack, onHome }) {
  const [tab, setTab] = useState('joseon');
  const data = FUN_DATA[tab];

  return (
    <div className="subscreen">
      <div className="subscreen__header">
        <button onClick={onBack} className="chat-header__back" aria-label="뒤로가기">‹</button>
        <div>
          <p className="subscreen__header-title">사주 세계관</p>
          <p className="subscreen__header-subtitle">내 사주로 보는 또 다른 나</p>
        </div>
        {onHome && <button className="subscreen__header-home" onClick={onHome} aria-label="홈으로">⌂</button>}
      </div>

      <div className="fun-tabs">
        {FUN_TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`fun-tab${tab === t.key ? ' fun-tab--active' : ''}`}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="subscreen__body">
        <div className="fun-card slide-up" style={{ background: data.bg, border: `1px solid ${data.accent}22` }}>
          <svg className="fun-card__texture" xmlns="http://www.w3.org/2000/svg">
            <filter id="hanji-fun-card">
              <feTurbulence type="fractalNoise" baseFrequency="0.68" numOctaves="4" stitchTiles="stitch" />
              <feColorMatrix type="saturate" values="0" />
            </filter>
            <rect width="100%" height="100%" filter="url(#hanji-fun-card)" />
          </svg>
          <div className="fun-card__bg-hanja" style={{ color: data.accent, opacity: 0.07 }}>{data.hanja}</div>

          <div className="fun-card__body">
            <div className="fun-card__emoji">{data.emoji}</div>
            <p className="fun-card__eyebrow" style={{ color: data.accent, opacity: 0.7 }}>내 포지션</p>
            <h2 className="fun-card__title">{data.label}</h2>
            <p className="fun-card__hanja" style={{ color: data.accent, opacity: 0.75 }}>{data.hanja}</p>
            <p className="fun-card__desc">{data.description}</p>
            <div className="fun-card__tags">
              {data.tags.map((tag) => (
                <span key={tag} className="fun-card__tag" style={{ background: data.badgeBg, color: data.badgeText }}>
                  {tag}
                </span>
              ))}
            </div>
            <div className="fun-card__note">📌 {data.note}</div>
          </div>
        </div>

        <p className="fun-switch-hint">다른 세계관도 확인해봐</p>
        <div className="fun-switch-row">
          {FUN_TABS.filter((t) => t.key !== tab).map((t) => (
            <button key={t.key} onClick={() => setTab(t.key)} className="fun-switch-btn">
              {t.label} 보기
            </button>
          ))}
        </div>
      </div>

      <div className="subscreen__footer">
        <button className="subscreen__btn-secondary">공유</button>
        <button onClick={onBack} className="subscreen__btn-primary">대화로 돌아가기</button>
      </div>
    </div>
  );
}
