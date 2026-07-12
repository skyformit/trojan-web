import Lottie from 'lottie-react';
import type { CSSProperties } from 'react';
import botAnimation from '../../assets/icon-bot.json';

type AnimatedAiOrbVariant = 'header' | 'chat' | 'loading';

interface AnimatedAiOrbProps {
  variant?: AnimatedAiOrbVariant;
  className?: string;
  showStatus?: boolean;
}

const variantStyles: Record<AnimatedAiOrbVariant, { outer: string }> = {
  header: {
    outer: 'h-11 w-11 md:h-[50px] md:w-[50px]',
  },
  chat: {
    outer: 'h-9 w-9 md:h-10 md:w-10',
  },
  loading: {
    outer: 'h-8 w-8',
  },
};

const outerPadding: Record<AnimatedAiOrbVariant, string> = {
  header: 'p-[2px]',
  chat: 'p-[1px]',
  loading: 'p-[1px]',
};

const lottieStyle: CSSProperties = {
  width: '100%',
  height: '100%',
  display: 'block',
  background: 'transparent',
};

export default function AnimatedAiOrb({
  variant = 'chat',
  className = '',
  showStatus = false,
}: AnimatedAiOrbProps) {
  const styles = variantStyles[variant];

  return (
    <div
      className={`relative shrink-0 ${styles.outer} ${outerPadding[variant]} overflow-hidden rounded-full ${className}`}
      aria-hidden="true"
    >
      <div className="absolute inset-[-16%] rounded-full bg-[radial-gradient(circle,rgba(170,255,241,0.32)_0%,rgba(84,182,255,0.22)_24%,rgba(44,53,97,0.08)_50%,transparent_74%)] blur-2xl opacity-80" />
      <div className="absolute inset-0 rounded-full bg-[linear-gradient(180deg,rgba(44,53,97,0.96)_0%,rgba(31,72,146,0.88)_45%,rgba(0,142,185,0.74)_100%)] shadow-[0_10px_24px_rgba(44,53,97,0.22)] ring-4 ring-white/90" />
      <div className="absolute inset-[10%] rounded-full bg-[radial-gradient(circle_at_35%_30%,rgba(255,255,255,0.96)_0%,rgba(223,251,255,0.9)_18%,rgba(188,236,255,0.84)_42%,rgba(44,53,97,0.08)_76%,transparent_100%)] shadow-[0_0_24px_rgba(255,255,255,0.18)]" />
      <div className="absolute inset-[5%] overflow-hidden rounded-full">
        <Lottie
          animationData={botAnimation}
          loop
          autoplay
          style={lottieStyle}
          rendererSettings={{ preserveAspectRatio: 'xMidYMid meet' }}
        />
      </div>
      <div className="absolute inset-[30%] flex items-center justify-center rounded-full bg-[radial-gradient(circle,rgba(255,255,255,0.2)_0%,rgba(255,255,255,0.04)_65%,transparent_100%)] text-white/20 font-black tracking-tight">
        AI
      </div>
      <div className="absolute inset-0 rounded-full shadow-[inset_0_0_0_1px_rgba(255,255,255,0.12)]" />
      {showStatus && (
        <span className="absolute -bottom-1 -right-1 h-3.5 w-3.5 rounded-full border-[2px] border-white bg-[var(--brand-success)] shadow-[0_0_0_2px_rgba(25,184,107,0.08)]" />
      )}
    </div>
  );
}
