// 상담사 캐릭터 "솔이"의 프로필 이미지. 지금은 인라인 SVG지만,
// 나중에 실제 일러스트로 교체하기 쉽도록 별도 컴포넌트로 분리해 둔다.
export function SolAvatar({ size = 40 }) {
  return (
    <div
      className="rounded-full flex-shrink-0 overflow-hidden"
      style={{
        width: size,
        height: size,
        background: 'linear-gradient(135deg, #39A89B 0%, #5DC8C0 100%)',
      }}
    >
      <svg viewBox="0 0 40 40" width={size} height={size}>
        <circle cx="20" cy="21" r="8" fill="white" fillOpacity="0.92" />
        <circle cx="20" cy="21" r="5" fill="#39A89B" />
        <circle cx="20" cy="21" r="2.2" fill="white" fillOpacity="0.8" />
        <path
          d="M14 15.5 Q17 10.5 20 10.5 Q23 10.5 26 15.5"
          stroke="white"
          strokeWidth="1.9"
          strokeLinecap="round"
          fill="none"
          opacity="0.92"
        />
        <path
          d="M11 13.5 Q14.5 6.5 20 6.5 Q25.5 6.5 29 13.5"
          stroke="white"
          strokeWidth="1.5"
          strokeLinecap="round"
          fill="none"
          opacity="0.5"
        />
      </svg>
    </div>
  );
}
