import type { ReactNode } from 'react';

type StatusTone = 'success' | 'warning' | 'danger' | 'neutral' | 'info';

interface StatusPillProps {
  tone: StatusTone;
  children: ReactNode;
  className?: string;
}

const toneStyles: Record<StatusTone, string> = {
  success: 'text-[var(--brand-primary)] bg-[color:rgba(44,53,97,0.08)] border-[color:rgba(44,53,97,0.14)]',
  warning: 'text-[var(--brand-brown)] bg-[color:rgba(185,131,90,0.12)] border-[color:rgba(185,131,90,0.18)]',
  danger: 'text-[var(--brand-danger)] bg-[color:rgba(214,63,75,0.08)] border-[color:rgba(214,63,75,0.18)]',
  neutral: 'text-[var(--brand-danger)] bg-[color:rgba(214,63,75,0.10)] border-[color:rgba(214,63,75,0.18)]',
  info: 'text-[var(--brand-primary)] bg-[color:rgba(44,53,97,0.08)] border-[color:rgba(44,53,97,0.14)]',
};

export default function StatusPill({ tone, children, className = '' }: StatusPillProps) {
  return (
    <span
      className={[
        'inline-flex min-w-[112px] shrink-0 flex-nowrap whitespace-nowrap items-center justify-center gap-1 text-[10px] leading-none px-3 py-1 rounded-[10px] font-extrabold uppercase tracking-[0.18em] border',
        toneStyles[tone],
        className,
      ].join(' ')}
    >
      {children}
    </span>
  );
}
