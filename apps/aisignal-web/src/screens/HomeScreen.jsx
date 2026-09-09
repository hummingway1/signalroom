import { ArrowRight, Brain, Heart, Users, RefreshCw } from 'lucide-react';
import { BrandLogo } from '../components/BrandLogo.jsx';

// 첫 진입 화면 — 복잡한 메뉴 없이 CTA 하나로 시작한다.
// 이전에 분석을 끝낸 기록(hasHistory)이 있으면 "이어보기" 버튼을 노출한다.
export function HomeScreen({ onStart, onReturn, hasHistory }) {
  return (
    <div className="phone-shell" style={{ background: '#F4FAF8' }}>
      <div className="flex items-center justify-between px-5 pt-12 pb-3">
        <BrandLogo />
        {hasHistory && (
          <button
            onClick={onReturn}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold"
            style={{ background: '#EDF8F6', color: '#39A89B' }}
          >
            <RefreshCw size={12} /> 이어보기
          </button>
        )}
      </div>

      {/* Hero */}
      <div
        className="mx-5 mt-2 mb-5 rounded-3xl overflow-hidden relative fade-up"
        style={{ height: 196, background: 'linear-gradient(145deg, #DFF5F0 0%, #C4EAE4 100%)' }}
      >
        <svg
          className="absolute inset-0 w-full h-full"
          viewBox="0 0 350 196"
          preserveAspectRatio="xMidYMid slice"
        >
          <circle cx="295" cy="28" r="90" fill="#39A89B" fillOpacity="0.12" />
          <circle cx="55" cy="185" r="75" fill="#F07A6A" fillOpacity="0.09" />
          <path
            d="M0 148 Q88 128 175 143 Q262 158 350 132 L350 196 L0 196Z"
            fill="#39A89B"
            fillOpacity="0.07"
          />
        </svg>
        <div className="absolute inset-0 flex items-center justify-center gap-8">
          <div className="flex flex-col items-center gap-1">
            <div
              className="w-16 h-16 rounded-full flex items-center justify-center shadow-sm"
              style={{ background: 'white' }}
            >
              <svg viewBox="0 0 56 56" width="50" height="50">
                <circle cx="28" cy="18" r="10" fill="#C8EDE8" />
                <circle cx="28" cy="17" r="7.5" fill="#5DC8C0" />
                <ellipse cx="28" cy="17" rx="3.5" ry="4.5" fill="white" fillOpacity="0.65" />
                <path d="M13 52 Q13 36 28 36 Q43 36 43 52" fill="#39A89B" />
              </svg>
            </div>
            <span className="text-xs font-semibold" style={{ color: '#2D7A70' }}>
              엄마
            </span>
          </div>
          <div className="flex flex-col gap-1.5 items-center mb-5">
            {[30, 21, 12].map((w, i) => (
              <div
                key={i}
                className="rounded-full"
                style={{ width: w, height: 3, background: '#39A89B', opacity: 0.2 + i * 0.32 }}
              />
            ))}
          </div>
          <div className="flex flex-col items-center gap-1">
            <div
              className="rounded-full flex items-center justify-center shadow-sm"
              style={{ width: 52, height: 52, background: 'white' }}
            >
              <svg viewBox="0 0 56 56" width="44" height="44">
                <circle cx="28" cy="18" r="10" fill="#FEE8D6" />
                <circle cx="28" cy="17" r="7.5" fill="#F0A07A" />
                <ellipse cx="28" cy="17" rx="3.5" ry="4.5" fill="white" fillOpacity="0.65" />
                <path d="M14 52 Q14 36 28 36 Q42 36 42 52" fill="#F07A6A" />
              </svg>
            </div>
            <span className="text-xs font-semibold" style={{ color: '#C05A45' }}>
              아이
            </span>
          </div>
        </div>
        <p
          className="absolute bottom-4 left-0 right-0 text-center text-sm font-semibold"
          style={{ color: '#2D5A6B' }}
        >
          우리 아이의 마음, 더 가까이
        </p>
      </div>

      <div className="px-5 mb-5 fade-up" style={{ animationDelay: '0.08s' }}>
        <h1 className="text-[26px] font-bold leading-snug mb-2" style={{ color: '#1A3344' }}>
          아이의 신호를
          <br />
          읽어드릴게요
        </h1>
        <p className="text-sm leading-relaxed" style={{ color: '#5A7A8A' }}>
          아이의 타고난 기질과 현재 상황을 살펴보며
          <br />
          엄마가 더 잘 이해할 수 있도록 도와드려요.
        </p>
      </div>

      <div className="flex gap-2 px-5 mb-5 fade-up" style={{ animationDelay: '0.14s' }}>
        {[
          { label: '기질 파악', icon: Brain, color: '#39A89B' },
          { label: '고민 해결', icon: Heart, color: '#F07A6A' },
          { label: '관계 이해', icon: Users, color: '#7BAFC0' },
        ].map(({ label, icon: Icon, color }) => (
          <div
            key={label}
            className="flex-1 rounded-2xl py-3 flex flex-col items-center gap-1.5"
            style={{ background: 'white' }}
          >
            <div
              className="w-8 h-8 rounded-xl flex items-center justify-center"
              style={{ background: color + '18' }}
            >
              <Icon size={16} color={color} />
            </div>
            <span className="text-xs font-semibold" style={{ color: '#1A3344' }}>
              {label}
            </span>
          </div>
        ))}
      </div>

      <div className="px-5 mt-auto pb-10 fade-up" style={{ animationDelay: '0.2s' }}>
        <button
          onClick={onStart}
          className="w-full py-4 rounded-2xl font-bold text-white text-[15px] flex items-center justify-center gap-2 active:scale-[0.98] transition-transform"
          style={{ background: 'linear-gradient(135deg, #39A89B 0%, #2D9088 100%)' }}
        >
          아이 이야기 시작하기 <ArrowRight size={18} />
        </button>
        <p className="text-xs text-center mt-3" style={{ color: '#8AADBA' }}>
          무료로 시작 · 아이의 기질을 이해하는 첫 걸음
        </p>
      </div>
    </div>
  );
}
