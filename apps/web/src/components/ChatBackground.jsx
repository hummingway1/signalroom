// apps/web/src/components/ChatBackground.jsx
//
// 십장생(十長生) 모티프 — 원래 Figma엔 소나무/산/학 3개만 있었으나, 문서 지시(§8 "십장생 요소가
// 너무 약하다, 더 명확하게 배치")에 따라 나머지 7개(해/구름/물/거북/사슴/불로초/대나무)를 추가했다.
// 전통 민화를 그대로 복제하지 않고 현대적인 단순 라인 일러스트로 재해석 — "전통적인데 이상하게
// 귀엽고 힙하다"는 목표 톤에 맞춤. 채팅 가독성을 해치지 않도록 여전히 매우 낮은 opacity(0.044) 유지.
export function ChatBackground() {
  return (
    <div className="chat-background" aria-hidden="true">
      {/* 해 (sun) — top left */}
      <svg viewBox="0 0 60 60" width={60} height={60} className="chat-background__sun" fill="none">
        <circle cx="30" cy="30" r="14" fill="#C4886E" />
        {Array.from({ length: 12 }, (_, i) => {
          const angle = (i * 30 * Math.PI) / 180;
          const x1 = 30 + Math.cos(angle) * 18;
          const y1 = 30 + Math.sin(angle) * 18;
          const x2 = 30 + Math.cos(angle) * 26;
          const y2 = 30 + Math.sin(angle) * 26;
          return <line key={i} x1={x1} y1={y1} x2={x2} y2={y2} stroke="#C4886E" strokeWidth="2" strokeLinecap="round" />;
        })}
      </svg>

      {/* 구름 (clouds) — top center-left, drifting shapes */}
      <svg viewBox="0 0 140 40" width={140} height={40} className="chat-background__clouds" fill="none">
        <path d="M 10 28 Q 6 16 20 16 Q 24 6 38 10 Q 48 4 56 14 Q 70 12 68 26 Q 74 34 62 36 L 16 36 Q 4 34 10 28 Z" fill="#8A7468" />
        <path d="M 80 32 Q 78 24 88 24 Q 91 18 100 20 Q 108 16 112 24 Q 122 24 118 32 L 84 32 Z" fill="#8A7468" opacity="0.7" />
      </svg>

      {/* 물결 (waves/water) — bottom center */}
      <svg viewBox="0 0 220 30" width={220} height={30} className="chat-background__waves" fill="none">
        <path d="M 0 12 Q 15 2 30 12 T 60 12 T 90 12 T 120 12 T 150 12 T 180 12 T 210 12" stroke="#4A6D8C" strokeWidth="2" fill="none" />
        <path d="M 0 22 Q 15 14 30 22 T 60 22 T 90 22 T 120 22 T 150 22 T 180 22 T 210 22" stroke="#4A6D8C" strokeWidth="1.6" fill="none" opacity="0.7" />
      </svg>

      {/* 거북이 (turtle) — bottom left, simplified geometric shell */}
      <svg viewBox="0 0 80 60" width={80} height={60} className="chat-background__turtle" fill="none">
        <ellipse cx="40" cy="34" rx="26" ry="18" fill="#3D4A2A" />
        <path d="M 40 16 L 48 26 L 40 34 L 32 26 Z" fill="#2A3618" />
        <path d="M 20 34 L 28 26 L 40 34 L 28 42 Z" fill="#2A3618" opacity="0.8" />
        <path d="M 60 34 L 52 26 L 40 34 L 52 42 Z" fill="#2A3618" opacity="0.8" />
        <ellipse cx="12" cy="30" rx="7" ry="5" fill="#3D4A2A" />
        <line x1="18" y1="48" x2="14" y2="56" stroke="#3D4A2A" strokeWidth="3" strokeLinecap="round" />
        <line x1="62" y1="48" x2="66" y2="56" stroke="#3D4A2A" strokeWidth="3" strokeLinecap="round" />
      </svg>

      {/* 사슴 (deer) — mid right, minimal line silhouette */}
      <svg viewBox="0 0 90 100" width={90} height={100} className="chat-background__deer" fill="none">
        <path d="M 45 40 C 30 44 22 56 24 72 C 26 84 36 92 45 92 C 54 92 64 84 66 72 C 68 56 60 44 45 40 Z" fill="#8A6A30" opacity="0.85" />
        <path d="M 45 40 L 42 24" stroke="#8A6A30" strokeWidth="2.5" strokeLinecap="round" />
        <path d="M 42 24 C 38 18 32 18 28 22" stroke="#8A6A30" strokeWidth="2" strokeLinecap="round" />
        <path d="M 42 24 C 44 16 50 15 54 18" stroke="#8A6A30" strokeWidth="2" strokeLinecap="round" />
        <line x1="34" y1="92" x2="32" y2="100" stroke="#8A6A30" strokeWidth="3" strokeLinecap="round" />
        <line x1="56" y1="92" x2="58" y2="100" stroke="#8A6A30" strokeWidth="3" strokeLinecap="round" />
      </svg>

      {/* 불로초 (mushroom of immortality) — small cluster, bottom right area */}
      <svg viewBox="0 0 60 40" width={60} height={40} className="chat-background__mushroom" fill="none">
        <ellipse cx="16" cy="18" rx="10" ry="7" fill="#C4886E" />
        <line x1="16" y1="24" x2="16" y2="36" stroke="#8A7468" strokeWidth="2.5" strokeLinecap="round" />
        <ellipse cx="38" cy="14" rx="8" ry="6" fill="#C4886E" opacity="0.85" />
        <line x1="38" y1="19" x2="38" y2="32" stroke="#8A7468" strokeWidth="2" strokeLinecap="round" />
      </svg>

      {/* 대나무 (bamboo) — right edge, tall segmented stalks */}
      <svg viewBox="0 0 60 220" width={60} height={220} className="chat-background__bamboo" fill="none">
        <line x1="14" y1="0" x2="14" y2="220" stroke="#3D4A2A" strokeWidth="4" />
        <line x1="4" y1="40" x2="24" y2="40" stroke="#3D4A2A" strokeWidth="3" />
        <line x1="4" y1="95" x2="24" y2="95" stroke="#3D4A2A" strokeWidth="3" />
        <line x1="4" y1="150" x2="24" y2="150" stroke="#3D4A2A" strokeWidth="3" />
        <path d="M 14 40 C 26 32 34 26 40 16" stroke="#3D4A2A" strokeWidth="1.6" strokeLinecap="round" />
        <path d="M 14 95 C 4 88 -4 82 -10 74" stroke="#3D4A2A" strokeWidth="1.6" strokeLinecap="round" />
      </svg>

      {/* 소나무 (pine tree) — bottom right */}
      <svg viewBox="0 0 100 200" width={100} height={200} className="chat-background__pine" fill="none">
        <path d="M 52 200 C 50 175 55 155 50 128 C 46 102 53 80 50 54 C 48 38 52 22 50 8" stroke="#3D2510" strokeWidth="5.5" strokeLinecap="round" />
        <path d="M 50 145 C 35 138 16 128 3 118" stroke="#3D2510" strokeWidth="2.8" strokeLinecap="round" />
        <path d="M 50 118 C 32 110 14 98 2 88" stroke="#3D2510" strokeWidth="2.3" strokeLinecap="round" />
        <path d="M 50 92 C 34 83 18 74 6 66" stroke="#3D2510" strokeWidth="2" strokeLinecap="round" />
        <path d="M 50 140 C 67 132 86 122 98 113" stroke="#3D2510" strokeWidth="2.8" strokeLinecap="round" />
        <path d="M 50 114 C 68 105 88 94 99 86" stroke="#3D2510" strokeWidth="2.3" strokeLinecap="round" />
        <path d="M 50 90 C 66 80 84 70 95 63" stroke="#3D2510" strokeWidth="2" strokeLinecap="round" />
        <ellipse cx="3" cy="115" rx="13" ry="6.5" fill="#3D4A2A" transform="rotate(-12 3 115)" />
        <ellipse cx="2" cy="85" rx="11" ry="5.5" fill="#3D4A2A" transform="rotate(-8 2 85)" />
        <ellipse cx="6" cy="62" rx="9" ry="4.5" fill="#3D4A2A" transform="rotate(-6 6 62)" />
        <ellipse cx="98" cy="110" rx="13" ry="6.5" fill="#3D4A2A" transform="rotate(14 98 110)" />
        <ellipse cx="99" cy="83" rx="11" ry="5.5" fill="#3D4A2A" transform="rotate(10 99 83)" />
        <ellipse cx="95" cy="60" rx="9" ry="4.5" fill="#3D4A2A" transform="rotate(8 95 60)" />
        <ellipse cx="50" cy="8" rx="7" ry="3.5" fill="#3D4A2A" />
        <ellipse cx="50" cy="20" rx="9" ry="4.5" fill="#3D4A2A" />
        <ellipse cx="50" cy="34" rx="11" ry="5" fill="#3D4A2A" />
      </svg>

      {/* 산 (mountains + mist) — top right */}
      <svg viewBox="0 0 190 90" width={190} height={90} className="chat-background__mountains">
        <path d="M 30 90 Q 75 28 95 12 Q 118 30 155 75 Q 170 82 190 90 Z" fill="#5A4A3A" />
        <path d="M 0 70 Q 95 60 190 66" stroke="#FAF7F2" strokeWidth="18" fill="none" />
        <path d="M 65 90 Q 100 42 135 90 Z" fill="#3D2D1A" />
        <path d="M 0 82 Q 95 74 190 78" stroke="#FAF7F2" strokeWidth="10" fill="none" opacity="0.7" />
      </svg>

      {/* 학 (cranes) — bottom left */}
      <svg viewBox="0 0 110 80" width={110} height={80} className="chat-background__cranes" fill="none">
        <ellipse cx="42" cy="48" rx="18" ry="10" fill="#2A1E1A" />
        <path d="M 33 41 C 28 28 31 18 34 10" stroke="#2A1E1A" strokeWidth="3.5" strokeLinecap="round" />
        <circle cx="35" cy="8" r="4.5" fill="#2A1E1A" />
        <path d="M 38 7 L 48 6" stroke="#2A1E1A" strokeWidth="2" strokeLinecap="round" />
        <path d="M 30 46 C 10 38 2 42 0 52" stroke="#2A1E1A" strokeWidth="2.8" strokeLinecap="round" />
        <path d="M 56 46 C 74 34 86 36 95 44" stroke="#2A1E1A" strokeWidth="2.8" strokeLinecap="round" />
        <path d="M 60 52 C 70 58 76 65 78 72" stroke="#2A1E1A" strokeWidth="2.2" strokeLinecap="round" />
        <path d="M 58 54 C 65 61 68 68 70 76" stroke="#2A1E1A" strokeWidth="1.8" strokeLinecap="round" />
        <path d="M 38 58 L 36 74" stroke="#2A1E1A" strokeWidth="1.8" />
        <path d="M 46 58 L 48 74" stroke="#2A1E1A" strokeWidth="1.8" />
        <path d="M 80 22 C 66 16 62 18 60 24" stroke="#2A1E1A" strokeWidth="2" strokeLinecap="round" />
        <path d="M 80 22 C 94 14 100 16 104 22" stroke="#2A1E1A" strokeWidth="2" strokeLinecap="round" />
        <ellipse cx="80" cy="22" rx="8" ry="5" fill="#2A1E1A" />
        <path d="M 76 18 C 73 12 74 8 76 5" stroke="#2A1E1A" strokeWidth="2.2" strokeLinecap="round" />
        <circle cx="76" cy="4" r="2.8" fill="#2A1E1A" />
      </svg>
    </div>
  );
}
