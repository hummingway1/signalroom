// 서비스 로고 — 홈/재방문 화면 헤더에서 사용.
export function BrandLogo() {
  return (
    <div className="flex items-center gap-2">
      <div
        className="w-8 h-8 rounded-xl flex items-center justify-center"
        style={{ background: '#39A89B' }}
      >
        <svg viewBox="0 0 24 24" width="18" height="18">
          <circle cx="12" cy="12" r="3.5" fill="white" />
          <path
            d="M8 12 Q10 6 12 6 Q14 6 16 12"
            stroke="white"
            strokeWidth="1.8"
            strokeLinecap="round"
            fill="none"
          />
          <path
            d="M5 12 Q8 2 12 2 Q16 2 19 12"
            stroke="white"
            strokeWidth="1.5"
            strokeLinecap="round"
            fill="none"
            opacity="0.6"
          />
        </svg>
      </div>
      <span className="font-bold text-xl tracking-tight" style={{ color: '#1A3344' }}>
        아이시그널
      </span>
    </div>
  );
}
