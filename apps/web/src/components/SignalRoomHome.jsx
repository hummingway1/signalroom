// apps/web/src/components/SignalRoomHome.jsx
//
// SIGNAL ROOM 홈 화면 — Figma Make 프로토타입(VISUAL REFERENCE)에서 이식. 순수 React+SVG+인라인
// 스타일만 사용(외부 UI 라이브러리 의존 없음, 새 라이브러리 추가 안 함).
//
// §중요 원칙 — 이 컴포넌트는 "무엇을 보여줄지"만 담당하고 "선택 시 어디로 갈지"는 전혀 모른다.
// onService(id)를 호출할 뿐이고, 실제 라우팅(기존 handleHomeSelect 등)은 App.jsx가 그대로 담당한다.
// 새로운 상태관리/라우팅 구조를 추가하지 않았다 — 기존 screen state 패턴 그대로 재사용.
import { useState, useEffect, useRef } from "react";

const SR_CX = 195;
const SR_CY = 900;

const SR_SERVICES = [
  { id: "saju",     kr: "사주",        hanja: "四柱", color: "#E84040", r: 800, order: 6, x: 250, y: 140, bodyType: "star" },
  { id: "jami",     kr: "자미두수",    hanja: "紫微", color: "#F08828", r: 733, order: 5, x: 140, y: 205, bodyType: "planet" },
  { id: "yearlyFortune", kr: "신년운세", hanja: "年運", color: "#DDB820", r: 666, order: 4, x: 290, y: 270, bodyType: "moon" },
  { id: "gunghap",  kr: "궁합",        hanja: "宮合", color: "#3ABE80", r: 599, order: 3, x: 100, y: 335, bodyType: "constellation" },
  { id: "isignal",  kr: "아이시그널",  hanja: "兒",   color: "#4090E8", r: 532, order: 2, x: 305, y: 405, bodyType: "comet" },
  { id: "taegil",   kr: "출생일 택일", hanja: "擇日", color: "#5B55CC", r: 465, order: 1, x: 85,  y: 465, bodyType: "nebula" },
  { id: "jakmeong", kr: "작명소",      hanja: "作名", color: "#9B48CC", r: 398, order: 0, x: 195, y: 535, bodyType: "portal" },
];

// ── Celestial bodies (replaces the old rainbow-arc visual) ─────────────────
// "하나의 깊은 별밤 속에 존재하는 7개의 운명의 천체" — 각 서비스는 무지개 띠가 아니라 밤하늘에
//흩어진 별자리 속 하나의 천체로 표현된다. 기존 SR_SERVICES(color/order/hanja) 데이터는 그대로
// 재사용하고, 렌더링 방식만 arc → 천체로 바꾼다(서비스 이동 로직 onService는 완전히 그대로).
function CelestialBody({ svc }) {
  const { bodyType, color } = svc;
  const glow = (
    <circle cx={0} cy={0} r={26} fill={color} opacity={0.16} filter="url(#arc-glow)" />
  );

  if (bodyType === "star") {
    // 가장 크고 밝은 별 — 사주. 4방향 spike + pixel core.
    return (
      <g>
        {glow}
        <path d="M0,-20 L4,-4 L20,0 L4,4 L0,20 L-4,4 L-20,0 L-4,-4 Z" fill={color} opacity={0.9} />
        <rect x={-3} y={-3} width={6} height={6} fill="#FFF" opacity={0.95} />
      </g>
    );
  }
  if (bodyType === "planet") {
    // 작은 행성 + 고리 — 자미두수
    return (
      <g>
        {glow}
        <ellipse cx={0} cy={0} rx={16} ry={5} fill="none" stroke={color} strokeWidth={2} opacity={0.55} transform="rotate(-18)" />
        <circle cx={0} cy={0} r={9} fill={color} opacity={0.92} />
        <rect x={-3} y={-3} width={3} height={3} fill="#FFF" opacity={0.4} />
      </g>
    );
  }
  if (bodyType === "moon") {
    // 서로 연결된 쌍별(궁합) — 초승달 + 작은 동반성. 크기를 키워서 초승달 곡선이 실제로 보이게.
    return (
      <g>
        {glow}
        <path d="M8,-16 A16,16 0 1 0 8,16 A12,12 0 1 1 8,-16 Z" fill={color} opacity={0.92} />
        <circle cx={22} cy={9} r={3} fill={color} opacity={0.8} />
        <line x1={13} y1={3} x2={19} y2={7} stroke={color} strokeWidth={1} opacity={0.4} />
      </g>
    );
  }
  if (bodyType === "constellation") {
    // 작은 별자리(아이시그널) — 여러 별을 선으로 연결
    const pts = [[-14, 6], [-3, -10], [10, -4], [15, 9]];
    return (
      <g>
        {glow}
        <polyline points={pts.map((p) => p.join(",")).join(" ")} fill="none" stroke={color} strokeWidth={1.2} opacity={0.55} />
        {pts.map(([px, py], i) => (
          <circle key={i} cx={px} cy={py} r={i === 1 ? 3.2 : 2.2} fill={color} opacity={0.9} />
        ))}
      </g>
    );
  }
  if (bodyType === "comet") {
    // 혜성(택일) — 꼬리 있는 밝은 점. 꼬리를 더 길고 굵게 그려서 원거리에서도 혜성임을 알아보게.
    return (
      <g>
        {glow}
        <path d="M0,0 L-34,15 L-24,5 L-32,10 L-20,3 L-12,1.5 Z" fill={color} opacity={0.5} />
        <circle cx={0} cy={0} r={6} fill={color} opacity={0.95} />
        <rect x={-2} y={-2} width={4} height={4} fill="#FFF" opacity={0.85} />
      </g>
    );
  }
  if (bodyType === "nebula") {
    // 작은 성운(작명소) — 부드러운 다중 원 구름
    return (
      <g opacity={0.85}>
        <circle cx={0} cy={0} r={20} fill={color} opacity={0.1} filter="url(#arc-glow)" />
        <circle cx={-6} cy={2} r={9} fill={color} opacity={0.35} />
        <circle cx={7} cy={-3} r={7} fill={color} opacity={0.3} />
        <circle cx={2} cy={6} r={6} fill={color} opacity={0.28} />
        <rect x={-2} y={-1} width={2} height={2} fill="#FFF" opacity={0.5} />
      </g>
    );
  }
  // portal — MEMBERSHIP, 가장 신비로운 밝은 별/포털
  return (
    <g>
      <circle cx={0} cy={0} r={34} fill={color} opacity={0.14} filter="url(#arc-glow)" />
      <circle cx={0} cy={0} r={18} fill="none" stroke={color} strokeWidth={1.5} opacity={0.5} />
      <circle cx={0} cy={0} r={11} fill="none" stroke={color} strokeWidth={1} opacity={0.35} />
      <path d="M0,-9 L2.5,-2.5 L9,0 L2.5,2.5 L0,9 L-2.5,2.5 L-9,0 L-2.5,-2.5 Z" fill={color} opacity={0.95} />
      <rect x={-2} y={-2} width={4} height={4} fill="#FFF" opacity={0.95} />
    </g>
  );
}

// Pre-generate star positions once at module level (stable, no re-random on re-render)
const SR_STARS = Array.from({ length: 88 }, (_, i) => ({
  x: Math.floor(Math.random() * 390),
  y: Math.floor(Math.random() * 610),
  s: i % 9 === 0 ? 2 : 1,
  o: 0.12 + Math.random() * 0.72,
}));

const SR_HANJA = [
  { c: "命", x: 332, y: 66, sz: 16, o: 0.06 },
  { c: "運", x: 42, y: 128, sz: 13, o: 0.07 },
  { c: "緣", x: 354, y: 256, sz: 18, o: 0.05 },
  { c: "福", x: 26, y: 366, sz: 14, o: 0.06 },
  { c: "財", x: 357, y: 440, sz: 12, o: 0.07 },
  { c: "情", x: 42, y: 500, sz: 15, o: 0.05 },
  { c: "星", x: 18, y: 198, sz: 11, o: 0.05 },
  { c: "月", x: 359, y: 160, sz: 10, o: 0.06 },
];

// Pixel cat v2 — 20 cols × 15 rows, 4px per pixel = 80×60px.
// 재설계 이유(§7 지시): 기존 그리드는 (1) 귀가 뭉툭한 사각형 (2) 머리/몸통 색이 달라 분리돼
// 보임 (3) 꼬리가 아예 없어서 "고양이보다 돼지처럼 보임"이라는 문제가 있었다. 이번 그리드는
// 뾰족한 삼각형 귀(0행에서 좁게 시작해 아래로 넓어짐), 몸 전체를 한 색으로 통일, 오른쪽에
// 위로 말린 꼬리를 명시적으로 추가했다.
// 0=transparent 1=body-orange 2=shadow(legs/tail) 3=pupil 4=white-eye 5=ear-inner-pink 6=nose-pink
const CAT_PIXELS = [
  [0,0,0,0,1,1,0,0,0,0,0,0,0,0,1,1,0,0,0,0],
  [0,0,0,1,1,1,1,0,0,0,0,0,0,1,1,1,1,0,0,0],
  [0,0,1,1,5,5,1,1,0,0,0,0,1,1,5,5,1,1,0,0],
  [0,0,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,0,0],
  [0,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,0],
  [1,1,1,1,4,4,1,1,1,1,1,1,1,1,4,4,1,1,1,1],
  [1,1,1,1,4,3,1,1,1,1,1,1,1,1,3,4,1,1,1,1],
  [1,1,1,1,1,1,1,1,1,6,6,1,1,1,1,1,1,1,1,1],
  [0,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,0],
  [0,0,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,0,0],
  [0,0,0,0,1,1,1,1,1,1,1,1,1,1,1,0,0,0,2,2],
  [0,0,0,0,0,1,1,1,1,1,1,1,1,1,0,0,0,2,2,2],
  [0,0,0,0,0,0,1,1,1,1,1,1,1,0,0,0,2,2,0,0],
  [0,0,0,0,0,0,2,2,0,0,0,0,2,2,0,0,0,0,0,0],
  [0,0,0,0,0,0,2,2,0,0,0,0,2,2,0,0,0,0,0,0],
];
const CAT_COLORS = {
  1: "#EC935E", 2: "#C06020", 3: "#241006",
  4: "#FFFFFF", 5: "#F2A8A0", 6: "#E87870",
};

function PixelCat({ scale = 5 }) {
  const w = CAT_PIXELS[0].length * scale;
  const h = CAT_PIXELS.length * scale;
  // §7 — 아주 미세한 idle animation(눈 깜빡임). 새 라이브러리 없이 CSS keyframes 하나로 처리.
  const eyeRowIndices = [5, 6]; // 흰자/눈동자가 있는 행(위 CAT_PIXELS 기준)
  return (
    <svg width={w} height={h} style={{ imageRendering: "pixelated", display: "block" }}>
      {CAT_PIXELS.flatMap((row, r) =>
        row.map((v, c) =>
          v > 0 ? (
            <rect
              key={`${r}-${c}`}
              x={c * scale} y={r * scale}
              width={scale} height={scale}
              fill={CAT_COLORS[v]}
              style={(v === 3 || v === 4) && eyeRowIndices.includes(r) ? { animation: "srCatBlink 4.2s ease-in-out infinite", transformBox: "fill-box", transformOrigin: "center" } : undefined}
            />
          ) : null
        )
      )}
    </svg>
  );
}

// ── Signal Room Home Screen ───────────────────────────────────────────────
function SignalRoomHome({ onService, onOpenMyPage }) {
  const [phase, setPhase] = useState(0);
  const [flash, setFlash] = useState(null);
  const flashKey = useRef(0);

  useEffect(() => {
    const ts = [
      setTimeout(() => setPhase(1),  700),   // stars visible
      setTimeout(() => setPhase(2),  1500),  // violet arc
      setTimeout(() => setPhase(3),  1820),  // indigo
      setTimeout(() => setPhase(4),  2140),  // blue
      setTimeout(() => setPhase(5),  2460),  // green
      setTimeout(() => setPhase(6),  2780),  // yellow
      setTimeout(() => setPhase(7),  3100),  // orange
      setTimeout(() => setPhase(8),  3420),  // red
      setTimeout(() => setPhase(9),  4050),  // cat appears
      setTimeout(() => setPhase(10), 4600),  // speech bubble
    ];
    return () => ts.forEach(clearTimeout);
  }, []);

  const isArcVisible = (order) => phase >= order + 2;

  const handleArcTap = (svc) => {
    if (!isArcVisible(svc.order)) return;
    flashKey.current++;
    setFlash({ peakX: svc.x, peakY: svc.y, color: svc.color, key: flashKey.current });
    setTimeout(() => setFlash(null), 800);
    setTimeout(() => onService(svc.id), 320);
  };

  return (
    <div
      className="phone-shell"
      style={{ background: "#060B1A", position: "relative" }}
    >
      {/* ── SVG noise texture ── */}
      <svg
        style={{
          position: "absolute", inset: 0, width: "100%", height: "100%",
          opacity: 0.04, pointerEvents: "none", zIndex: 0,
        }}
      >
        <defs>
          <filter id="sr-noise">
            <feTurbulence type="fractalNoise" baseFrequency="0.85" numOctaves="4" seed="7" stitchTiles="stitch" />
            <feColorMatrix type="saturate" values="0" />
          </filter>
        </defs>
        <rect width="100%" height="100%" filter="url(#sr-noise)" />
      </svg>

      {/* ── Stars ── */}
      <svg
        style={{
          position: "absolute", top: 0, left: 0, width: 390, height: 620,
          opacity: phase >= 1 ? 1 : 0,
          transition: "opacity 1.4s ease",
          pointerEvents: "none", zIndex: 1,
        }}
      >
        {SR_STARS.map((s, i) => (
          <rect key={i} x={s.x} y={s.y} width={s.s} height={s.s} fill="white" opacity={s.o} />
        ))}
      </svg>

      {/* ── Faint hanja decorations ── */}
      {SR_HANJA.map((h, i) => (
        <span
          key={i}
          style={{
            position: "absolute", left: h.x, top: h.y,
            fontSize: h.sz,
            color: `rgba(170,190,255,${h.o})`,
            fontFamily: "serif", userSelect: "none",
            pointerEvents: "none", zIndex: 1,
            opacity: phase >= 1 ? 1 : 0,
            transition: "opacity 2s ease",
          }}
        >
          {h.c}
        </span>
      ))}

      {/* ── CRT scanlines ── */}
      <div
        className="crt-lines"
        style={{ position: "absolute", inset: 0, zIndex: 2, pointerEvents: "none" }}
      />

      {/* ── Vignette ── */}
      <div
        style={{
          position: "absolute", inset: 0, zIndex: 2, pointerEvents: "none",
          background: "radial-gradient(ellipse 85% 85% at 50% 50%, transparent 38%, rgba(0,0,14,0.62) 100%)",
        }}
      />

      {/* ── Brand header ── */}
      <div
        style={{
          position: "absolute", top: 50, left: 0, right: 0,
          display: "flex", alignItems: "center", justifyContent: "center",
          zIndex: 20,
          opacity: phase >= 1 ? 1 : 0,
          transition: "opacity 1.2s ease",
        }}
      >
        <span
          style={{
            fontFamily: "'Press Start 2P', monospace",
            fontSize: 9, letterSpacing: "0.28em",
            color: "#283466",
          }}
        >
          SIGNAL ROOM
        </span>
      </div>

      {/* ── Initial pixel sparkle (phase 1 only, before first arc) ── */}
      {phase === 1 && (
        <div
          style={{
            position: "absolute", top: 300, left: SR_CX,
            transform: "translate(-50%, -50%)",
            zIndex: 15, pointerEvents: "none",
            animation: "srFadeIn 0.5s ease both, srStarPulse 0.9s ease-in-out infinite",
          }}
        >
          <svg width="14" height="14" viewBox="0 0 14 14" style={{ imageRendering: "pixelated" }}>
            <rect x="6" y="0" width="2" height="14" fill="white" opacity="0.82" />
            <rect x="0" y="6" width="14" height="2" fill="white" opacity="0.82" />
            <rect x="3" y="3" width="2" height="2" fill="white" opacity="0.35" />
            <rect x="9" y="3" width="2" height="2" fill="white" opacity="0.35" />
            <rect x="3" y="9" width="2" height="2" fill="white" opacity="0.35" />
            <rect x="9" y="9" width="2" height="2" fill="white" opacity="0.35" />
          </svg>
        </div>
      )}

      {/* ── 7 celestial bodies of destiny (fixed 390×844 canvas) ── */}
      <svg
        style={{
          position: "absolute", top: 0, left: 0,
          width: 390, height: 844,
          overflow: "visible", zIndex: 10,
        }}
        viewBox="0 0 390 844"
      >
        <defs>
          <clipPath id="sr-clip">
            <rect x="0" y="0" width="390" height="844" />
          </clipPath>
          <filter id="arc-glow" x="-30%" y="-30%" width="160%" height="160%">
            <feGaussianBlur stdDeviation="9" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        <g clipPath="url(#sr-clip)">
          {SR_SERVICES.map((svc) => {
            const visible = isArcVisible(svc.order);
            return (
              <g
                key={svc.id}
                transform={`translate(${svc.x}, ${svc.y})`}
                style={{
                  opacity: visible ? 1 : 0,
                  transition: "opacity 0.55s ease",
                  cursor: visible ? "pointer" : "default",
                  pointerEvents: visible ? "all" : "none",
                }}
                onClick={() => handleArcTap(svc)}
              >
                {/* 터치 판정 영역 확대(모바일 터치 UX 우선, §11) — 보이지 않는 투명 원 */}
                <circle cx={0} cy={0} r={28} fill="transparent" />
                <CelestialBody svc={svc} />
              </g>
            );
          })}
        </g>
      </svg>

      {/* ── Service labels (HTML overlays, next to each celestial body) ── */}
      {SR_SERVICES.map((svc) => {
        const visible = isArcVisible(svc.order);
        const isMember = svc.id === "member";
        const onLeftHalf = svc.x < 195;
        return (
          <div
            key={`lbl-${svc.id}`}
            onClick={() => handleArcTap(svc)}
            style={{
              position: "absolute",
              top: svc.y - (isMember ? 11 : 9),
              left: onLeftHalf ? svc.x + 24 : undefined,
              right: onLeftHalf ? undefined : 390 - svc.x + 24,
              display: "flex", justifyContent: onLeftHalf ? "flex-start" : "flex-end",
              zIndex: 25,
              cursor: visible ? "pointer" : "default",
              pointerEvents: visible ? "all" : "none",
              opacity: visible ? 1 : 0,
              transition: `opacity 0.4s ease`,
            }}
          >
            <div
              style={{
                display: "flex", alignItems: "center", gap: isMember ? 7 : 5,
                background: "rgba(2,5,16,0.82)",
                border: `1px solid ${svc.color}44`,
                padding: isMember ? "5px 11px 5px 9px" : "3px 8px 3px 7px",
                backdropFilter: "blur(8px)",
                boxShadow: `0 0 18px ${svc.color}20`,
                borderRadius: 1,
              }}
            >
              <span
                style={{
                  fontSize: isMember ? 12 : 9,
                  color: svc.color,
                  fontFamily: "serif",
                  opacity: 0.88,
                  lineHeight: 1,
                  minWidth: isMember ? 16 : 12,
                  textAlign: "center",
                }}
              >
                {svc.hanja}
              </span>
              {isMember ? (
                <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                  <span
                    style={{
                      fontSize: 12, color: "#EDD8FF",
                      fontFamily: "Noto Sans KR", fontWeight: 700, lineHeight: 1.2,
                    }}
                  >
                    {svc.kr}
                  </span>
                  <span
                    style={{
                      fontSize: 6.5, color: "#AA80EE",
                      fontFamily: "'Press Start 2P', monospace",
                      letterSpacing: "0.1em", opacity: 0.88,
                    }}
                  >
                    MEMBERSHIP KEY
                  </span>
                </div>
              ) : (
                <span
                  style={{
                    fontSize: 11, color: "#DDE4FF",
                    fontFamily: "Noto Sans KR", fontWeight: 600, lineHeight: 1.2,
                  }}
                >
                  {svc.kr}
                </span>
              )}
            </div>
          </div>
        );
      })}

      {/* ── Cat + speech bubble ── */}
      <div
        style={{
          position: "absolute", bottom: 52, left: "50%",
          transform: "translateX(-50%)",
          display: "flex", flexDirection: "column", alignItems: "center", gap: 10,
          zIndex: 30,
          opacity: phase >= 9 ? 1 : 0,
          transition: "opacity 0.55s ease",
        }}
      >
        {/* Speech bubble */}
        <div
          style={{
            background: "#07102A",
            border: "1px solid #22346A",
            borderRadius: 2,
            padding: "9px 15px",
            color: "#8FA0D8",
            fontSize: 13,
            fontFamily: "Noto Sans KR",
            letterSpacing: "-0.2px",
            position: "relative",
            boxShadow: "0 0 22px rgba(50,70,210,0.12)",
            whiteSpace: "nowrap",
            opacity: phase >= 10 ? 1 : 0,
            animation: phase >= 10 ? "bubbleIn 0.45s cubic-bezier(0.34,1.56,0.64,1) both" : "none",
          }}
        >
          어디부터 볼래?
          {/* Down-pointing arrow */}
          <div
            style={{
              position: "absolute", bottom: -6, left: "50%",
              width: 10, height: 10,
              background: "#07102A",
              borderRight: "1px solid #22346A",
              borderBottom: "1px solid #22346A",
              transform: "translateX(-50%) rotate(45deg)",
            }}
          />
        </div>

        {/* Floating pixel cat */}
        <div
          style={{
            animation: phase >= 9 ? "catFloat 3.2s ease-in-out infinite" : "none",
            filter: "drop-shadow(0 6px 20px rgba(40,60,200,0.22))",
          }}
        >
          <PixelCat scale={5} />
        </div>
      </div>

      {/* ── Tap flash ripple ── */}
      {flash && (
        <div
          key={flash.key}
          style={{
            position: "absolute",
            left: flash.peakX, top: flash.peakY,
            transform: "translate(-50%, -50%)",
            width: 44, height: 44,
            borderRadius: "50%",
            background: `radial-gradient(circle, ${flash.color}CC 0%, ${flash.color}44 55%, transparent 75%)`,
            pointerEvents: "none", zIndex: 50,
            animation: "flashPop 0.75s ease-out forwards",
          }}
        />
      )}

      {/* §Toss 가입 준비 — SIGNAL ROOM(실제 첫 화면)엔 MyPage/이용약관/개인정보처리방침으로
          가는 진입점이 전혀 없었다(기존엔 teal home에서만 접근 가능). 디자인을 재설계하지
          않고, 화면 최하단에 눈에 띄지 않는 작은 텍스트 링크 하나만 추가한다. */}
      {onOpenMyPage && (
        <button
          onClick={onOpenMyPage}
          style={{
            position: "absolute", left: "50%", bottom: 10, transform: "translateX(-50%)",
            background: "none", border: "none", color: "#5C6B9A", fontSize: 11,
            letterSpacing: "0.02em", cursor: "pointer", zIndex: 60, padding: "6px 10px",
          }}
        >
          마이페이지 · 이용약관 · 개인정보처리방침
        </button>
      )}
    </div>
  );
}

export { SignalRoomHome };
