export default function TrojanLogo() {
  return (
    <div className="flex items-center gap-3">
      <svg
        viewBox="0 0 120 120"
        className="h-12 w-12 shrink-0"
        aria-hidden="true"
      >
        <circle cx="60" cy="60" r="55" fill="white" stroke="#1f5fbf" strokeWidth="4" />
        <path
          d="M60 18 L88 78 H32 Z"
          fill="#1f5fbf"
        />
        <circle cx="60" cy="62" r="7" fill="white" />
        <path
          d="M24 92 C38 80, 56 74, 60 74 C68 74, 86 78, 96 90"
          fill="none"
          stroke="#1f5fbf"
          strokeWidth="6"
          strokeLinecap="round"
        />
        <path
          d="M18 98 C35 83, 51 79, 60 79 C72 79, 88 84, 102 97"
          fill="none"
          stroke="#1f5fbf"
          strokeWidth="3.5"
          strokeLinecap="round"
          opacity="0.95"
        />
      </svg>

      <div className="leading-none">
        <div className="font-serif text-[2.2rem] tracking-[0.12em] text-[#d4a000]">
          TROJAN
        </div>
        <div className="mt-1 font-serif text-[0.95rem] tracking-[0.22em] text-slate-600">
          GENERAL CONTRACTING
        </div>
      </div>
    </div>
  );
}
