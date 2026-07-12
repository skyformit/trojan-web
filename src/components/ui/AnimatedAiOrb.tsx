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
  header: 'p-0',
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
      className={`relative shrink-0 ${styles.outer} ${outerPadding[variant]} overflow-hidden rounded-full bg-transparent ${className}`}
      aria-hidden="true"
    >
      <div className="absolute inset-0 overflow-hidden rounded-full bg-transparent">
        <Lottie
          animationData={botAnimation}
          loop
          autoplay
          style={lottieStyle}
          rendererSettings={{ preserveAspectRatio: 'xMidYMid meet' }}
        />
      </div>
      {showStatus && (
        <span className="absolute -bottom-1 -right-1 h-3.5 w-3.5 rounded-full border-[2px] border-white bg-[var(--brand-success)] shadow-[0_0_0_2px_rgba(25,184,107,0.08)]" />
      )}
    </div>
  );
}
