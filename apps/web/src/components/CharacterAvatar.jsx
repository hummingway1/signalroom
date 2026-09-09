// apps/web/src/components/CharacterAvatar.jsx
//
// Figma(src/app/App.tsx)의 DaeguSVG/MaengguSVG를 좌표/색상 그대로 이식했다 — 임의로 다시 그린 게
// 아니라 원본 path/polygon/ellipse 값을 그대로 옮겼다. avatarUrl이 채워지면(나중에 실제 사진으로
// 교체) <img>로 대체되는 구조는 그대로 유지 — Figma 주석("swap SVG children with <img> for real
// photos")과 같은 설계 의도.
import { getCharacterAsset } from '../characterAssets.js';

function DaeguSVG() {
  return (
    <>
      <rect width="100" height="100" fill="#FEF3E2" />
      <polygon points="16,26 30,56 4,56" fill="#E8923A" />
      <polygon points="84,26 96,56 70,56" fill="#E8923A" />
      <polygon points="16,26 28,50 8,50" fill="#F5BFA0" />
      <polygon points="84,26 92,50 72,50" fill="#F5BFA0" />
      <ellipse cx="50" cy="58" rx="37" ry="35" fill="#F0A845" />
      <path d="M 42 32 Q 50 27 58 32" stroke="#C87015" strokeWidth="2.5" fill="none" strokeLinecap="round" />
      <path d="M 40 38 Q 50 33 60 38" stroke="#C87015" strokeWidth="2" fill="none" strokeLinecap="round" opacity="0.6" />
      <ellipse cx="37" cy="55" rx="7.5" ry="7" fill="#3C240E" />
      <ellipse cx="63" cy="55" rx="7.5" ry="7" fill="#3C240E" />
      <circle cx="39" cy="53" r="2.5" fill="#fff" />
      <circle cx="65" cy="53" r="2.5" fill="#fff" />
      <path d="M 47 66 L 50 62 L 53 66 Z" fill="#E07060" />
      <path d="M 44 69 Q 50 74 56 69" stroke="#3C240E" strokeWidth="1.8" fill="none" strokeLinecap="round" />
      <ellipse cx="27" cy="65" rx="8" ry="5" fill="#F4A0A0" opacity="0.28" />
      <ellipse cx="73" cy="65" rx="8" ry="5" fill="#F4A0A0" opacity="0.28" />
      <line x1="10" y1="62" x2="42" y2="67" stroke="#3C240E" strokeWidth="1.2" opacity="0.28" />
      <line x1="10" y1="68" x2="42" y2="69" stroke="#3C240E" strokeWidth="1.2" opacity="0.28" />
      <line x1="58" y1="67" x2="90" y2="62" stroke="#3C240E" strokeWidth="1.2" opacity="0.28" />
      <line x1="58" y1="69" x2="90" y2="68" stroke="#3C240E" strokeWidth="1.2" opacity="0.28" />
    </>
  );
}

function MaengguSVG() {
  return (
    <>
      <rect width="100" height="100" fill="#ECEEF5" />
      <polygon points="15,22 31,54 5,54" fill="#8C95A8" />
      <polygon points="85,22 95,54 69,54" fill="#8C95A8" />
      <polygon points="15,22 28,48 9,48" fill="#C4CAD8" />
      <polygon points="85,22 91,48 71,48" fill="#C4CAD8" />
      <ellipse cx="50" cy="58" rx="38" ry="36" fill="#A0A8BC" />
      <ellipse cx="37" cy="54" rx="8.5" ry="6" fill="#2A3448" />
      <ellipse cx="63" cy="54" rx="8.5" ry="6" fill="#2A3448" />
      <ellipse cx="37" cy="54" rx="5.5" ry="4" fill="#3E5080" />
      <ellipse cx="63" cy="54" rx="5.5" ry="4" fill="#3E5080" />
      <circle cx="39" cy="52" r="2" fill="#fff" />
      <circle cx="65" cy="52" r="2" fill="#fff" />
      <path d="M 47 65 L 50 62 L 53 65 Z" fill="#C07080" />
      <path d="M 45 68 Q 50 72 55 68" stroke="#2A3448" strokeWidth="1.6" fill="none" strokeLinecap="round" />
      <ellipse cx="27" cy="63" rx="7" ry="4" fill="#B0B8D0" opacity="0.18" />
      <ellipse cx="73" cy="63" rx="7" ry="4" fill="#B0B8D0" opacity="0.18" />
      <line x1="10" y1="62" x2="42" y2="66" stroke="#2A3448" strokeWidth="1" opacity="0.2" />
      <line x1="10" y1="67" x2="42" y2="68" stroke="#2A3448" strokeWidth="1" opacity="0.2" />
      <line x1="58" y1="66" x2="90" y2="62" stroke="#2A3448" strokeWidth="1" opacity="0.2" />
      <line x1="58" y1="68" x2="90" y2="67" stroke="#2A3448" strokeWidth="1" opacity="0.2" />
    </>
  );
}

function CupidSVG() {
  // 먼치킨 고양이(다리가 짧고 몸이 낮은 품종 특징 — 몸통을 낮고 둥글게) + 큐피드 분장(작은 날개,
  // 화살, 하트 볼터치). 대구/맹구와 다른 파스텔 핑크 톤으로 구분.
  return (
    <>
      <rect width="100" height="100" fill="#FDECEF" />
      {/* 날개 */}
      <path d="M 20 48 Q 4 38 8 22 Q 20 26 24 42 Z" fill="#FFF7FA" stroke="#F4B8C6" strokeWidth="1.5" />
      <path d="M 80 48 Q 96 38 92 22 Q 80 26 76 42 Z" fill="#FFF7FA" stroke="#F4B8C6" strokeWidth="1.5" />
      {/* 귀 */}
      <polygon points="18,30 30,54 6,54" fill="#F4B8C6" />
      <polygon points="82,30 94,54 70,54" fill="#F4B8C6" />
      <polygon points="18,30 27,49 10,49" fill="#FDD8E2" />
      <polygon points="82,30 90,49 73,49" fill="#FDD8E2" />
      {/* 먼치킨 특유의 낮고 둥근 얼굴/몸 */}
      <ellipse cx="50" cy="62" rx="39" ry="33" fill="#F7C6D3" />
      <ellipse cx="37" cy="58" rx="7" ry="6.5" fill="#3C240E" />
      <ellipse cx="63" cy="58" rx="7" ry="6.5" fill="#3C240E" />
      <circle cx="39" cy="56" r="2.3" fill="#fff" />
      <circle cx="65" cy="56" r="2.3" fill="#fff" />
      <path d="M 47 69 L 50 65 L 53 69 Z" fill="#E07090" />
      <path d="M 44 72 Q 50 76 56 72" stroke="#3C240E" strokeWidth="1.6" fill="none" strokeLinecap="round" />
      {/* 하트 볼터치 */}
      <path d="M 25 66 c -2 -3 -7 -1 -6 3 c 1 3 6 5 6 5 c 0 0 5 -2 6 -5 c 1 -4 -4 -6 -6 -3 Z" fill="#F49CB0" opacity="0.7" />
      <path d="M 75 66 c -2 -3 -7 -1 -6 3 c 1 3 6 5 6 5 c 0 0 5 -2 6 -5 c 1 -4 -4 -6 -6 -3 Z" fill="#F49CB0" opacity="0.7" />
      {/* 화살(작은 큐피드 화살, 옆에 살짝) */}
      <line x1="66" y1="30" x2="86" y2="14" stroke="#D98CA0" strokeWidth="2" strokeLinecap="round" />
      <polygon points="86,14 80,15 84,20" fill="#D98CA0" />
    </>
  );
}

function ScholarSVG() {
  // 안경을 낀 똑똑한 이미지의 검은 고양이 — 대구/맹구/큐피와 톤을 명확히 구분(차분한 남색/블랙).
  return (
    <>
      <rect width="100" height="100" fill="#EAEAF2" />
      <polygon points="17,24 31,54 5,54" fill="#232336" />
      <polygon points="83,24 95,54 69,54" fill="#232336" />
      <polygon points="17,24 27,47 10,47" fill="#3C3C55" />
      <polygon points="83,24 90,47 73,47" fill="#3C3C55" />
      <ellipse cx="50" cy="58" rx="37" ry="35" fill="#2B2B40" />
      {/* 안경 */}
      <circle cx="37" cy="55" r="10" fill="none" stroke="#D8C89A" strokeWidth="2.2" />
      <circle cx="63" cy="55" r="10" fill="none" stroke="#D8C89A" strokeWidth="2.2" />
      <line x1="47" y1="55" x2="53" y2="55" stroke="#D8C89A" strokeWidth="2.2" />
      <line x1="27" y1="53" x2="20" y2="50" stroke="#D8C89A" strokeWidth="2" strokeLinecap="round" />
      <line x1="73" y1="53" x2="80" y2="50" stroke="#D8C89A" strokeWidth="2" strokeLinecap="round" />
      <circle cx="37" cy="55" r="4.5" fill="#8AA8D8" />
      <circle cx="63" cy="55" r="4.5" fill="#8AA8D8" />
      <circle cx="38.5" cy="53.5" r="1.3" fill="#fff" />
      <circle cx="64.5" cy="53.5" r="1.3" fill="#fff" />
      <path d="M 47 68 L 50 64 L 53 68 Z" fill="#5A5A70" />
      <path d="M 44 71 Q 50 75 56 71" stroke="#D8C89A" strokeWidth="1.6" fill="none" strokeLinecap="round" />
      <line x1="10" y1="64" x2="42" y2="68" stroke="#D8C89A" strokeWidth="1" opacity="0.4" />
      <line x1="58" y1="68" x2="90" y2="64" stroke="#D8C89A" strokeWidth="1" opacity="0.4" />
    </>
  );
}

export function CharacterAvatar({ characterId, size = 40 }) {
  const asset = getCharacterAsset(characterId);

  if (asset.avatarUrl) {
    return (
      <div style={{ width: size, height: size, borderRadius: '50%', overflow: 'hidden', flexShrink: 0 }}>
        <img src={asset.avatarUrl} alt="" style={{ width: size, height: size, objectFit: 'cover' }} />
      </div>
    );
  }

  const SVG_BY_CHARACTER = { manggu: MaengguSVG, cupid: CupidSVG, scholar: ScholarSVG, daegu: DaeguSVG };
  const Chosen = SVG_BY_CHARACTER[characterId] ?? DaeguSVG;

  return (
    <div style={{ width: size, height: size, borderRadius: '50%', overflow: 'hidden', flexShrink: 0 }}>
      <svg viewBox="0 0 100 100" width={size} height={size}>
        <Chosen />
      </svg>
    </div>
  );
}
