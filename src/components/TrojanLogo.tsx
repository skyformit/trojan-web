export default function TrojanLogo() {
  return (
    <svg
      viewBox="0 0 720 220"
      className="h-14 w-auto max-w-full"
      role="img"
      aria-label="Trojan Construction Holding"
    >
      <g transform="translate(42 26)">
        <path
          d="M68 0 L141 147 H0 Z"
          fill="#1f2f47"
        />
        <circle cx="70" cy="66" r="12" fill="#ffffff" />
        <path
          d="M10 144 C34 124, 60 116, 70 116 C82 116, 107 122, 131 143"
          fill="none"
          stroke="#ffffff"
          strokeWidth="10"
          strokeLinecap="round"
        />
      </g>

      <g transform="translate(236 56)" fill="#1f2f47">
        <text
          x="0"
          y="56"
          fontFamily="Arial, Helvetica, sans-serif"
          fontSize="68"
          fontWeight="700"
          letterSpacing="2"
        >
          TROJAN
        </text>
        <text
          x="2"
          y="116"
          fontFamily="Arial, Helvetica, sans-serif"
          fontSize="33"
          fontWeight="600"
          letterSpacing="1.6"
          opacity="1"
        >
          CONSTRUCTION HOLDING
        </text>
      </g>
    </svg>
  );
}
