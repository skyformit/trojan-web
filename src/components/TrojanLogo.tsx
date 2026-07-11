type TrojanLogoProps = {
  className?: string;
  variant?: 'full' | 'icon';
  ariaLabel?: string;
};

export default function TrojanLogo({
  className = 'h-14 w-auto max-w-full',
  variant = 'full',
  ariaLabel = 'Trojan Construction Holding',
}: TrojanLogoProps) {
  if (variant === 'icon') {
    return (
      <svg
        viewBox="0 0 180 180"
        className={className}
        role="img"
        aria-label={ariaLabel}
      >
        <g transform="translate(10 18)">
          <path
            d="M62 0 L124 120 H0 Z"
            fill="#1f2f47"
          />
          <circle cx="62" cy="54" r="10" fill="#ffffff" />
          <path
            d="M8 118 C29 102, 49 94, 62 94 C75 94, 95 100, 116 118"
            fill="none"
            stroke="#ffffff"
            strokeWidth="8"
            strokeLinecap="round"
          />
        </g>
      </svg>
    );
  }

  return (
    <svg
      viewBox="0 0 720 220"
      className={className}
      role="img"
      aria-label={ariaLabel}
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
