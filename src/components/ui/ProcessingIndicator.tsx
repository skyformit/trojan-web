import AnimatedAiOrb from './AnimatedAiOrb';

interface ProcessingIndicatorProps {
  label?: string;
  description?: string;
}

export default function ProcessingIndicator({
  label = 'Processing request...',
  description = 'Please wait while the routing engine responds.',
}: ProcessingIndicatorProps) {
  return (
    <div className="relative flex items-start gap-3 pl-1">
      <div className="pointer-events-none absolute left-0 top-2 bottom-2 w-14 rounded-full bg-gradient-to-b from-[color:rgba(74,103,163,0.24)] via-[color:rgba(42,168,212,0.14)] to-transparent blur-2xl" />
      <AnimatedAiOrb variant="loading" className="relative z-10 mt-1" />
      <div className="relative z-10 max-w-[91%] rounded-[22px] rounded-bl-[18px] border border-[color:rgba(74,103,163,0.10)] bg-white/97 px-5 py-3.5 text-[14px] leading-6 text-[var(--brand-primary-deep)] shadow-[0_18px_40px_rgba(44,53,97,0.06)] ring-1 ring-[color:rgba(74,103,163,0.05)]">
        <div className="flex items-start gap-3">
          <div className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 border-[color:rgba(74,103,163,0.16)] border-t-[var(--brand-primary)] animate-spin" />
          <div className="min-w-0 space-y-0.5">
            <p className="font-sans font-semibold text-[var(--brand-primary-deep)]">{label}</p>
            <p className="font-sans text-[10px] leading-[1.35] text-[var(--brand-neutral)]">{description}</p>
          </div>
        </div>
        <div className="mt-2.5 flex items-end justify-between gap-3 text-[10px] font-mono tracking-[0.16em] text-[var(--brand-neutral)]">
          <span className="normal-case font-semibold text-[var(--brand-neutral)]">Encrypted • end-to-end</span>
          <span className="tracking-[0.14em] text-[var(--brand-primary-deep)]">now</span>
        </div>
      </div>
    </div>
  );
}
