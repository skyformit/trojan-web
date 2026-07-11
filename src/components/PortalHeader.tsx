import { Wifi } from 'lucide-react';
import { type ReactNode } from 'react';

type PortalHeaderProps = {
  label: string;
  title: string;
  subtitle: string;
  sessionId?: string;
  startedAt?: string;
  logo?: ReactNode;
};

export default function PortalHeader({
  label,
  title,
  subtitle,
  sessionId,
  startedAt,
  logo,
}: PortalHeaderProps) {
  return (
    <section>
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div className="flex items-start gap-3.5 md:gap-4">
          {logo && (
            <div className="shrink-0 pt-0.5">
              {logo}
            </div>
          )}
          <div className="space-y-1.5 md:space-y-1.5 lg:pt-0.5">
            <p className="flex items-center gap-1.5 text-[9px] font-extrabold uppercase tracking-[0.42em] text-[var(--brand-primary)]">
              <Wifi className="h-3 w-3 -translate-y-px text-[var(--brand-sky)]" />
              {label}
            </p>
            <div className="space-y-1 md:space-y-1.5">
              <h1 className="text-[19px] font-black leading-[0.95] tracking-tight text-[var(--brand-primary-deep)] md:text-[36px]">
                {title.split('Supplier').length > 1 ? (
                  <>
                    {title.split('Supplier')[0]}
                    <span className="text-[var(--brand-primary)]">Supplier</span>
                    {title.split('Supplier').slice(1).join('Supplier')}
                  </>
                ) : (
                  title
                )}
              </h1>
              <p className="max-w-2xl text-[13px] text-slate-600 md:mt-1.5 md:text-[16px] leading-snug">
                {subtitle}
              </p>
            </div>
          </div>
        </div>

        <div className="flex flex-col items-start lg:items-end lg:pt-0.5">
          {(sessionId || startedAt) && (
            <div className="flex flex-wrap items-center gap-2 lg:justify-end">
              {sessionId && (
                <div className="min-w-[92px]">
                  <p className="text-right text-[7px] font-extrabold uppercase tracking-[0.36em] text-[var(--brand-neutral)]">
                    Session ID
                  </p>
                  <p className="mt-0.5 text-right text-[12px] font-black tracking-wide text-[var(--brand-primary-deep)]">
                    {sessionId}
                  </p>
                </div>
              )}
              {startedAt && (
                <div className="min-w-[84px]">
                  <p className="text-right text-[7px] font-extrabold uppercase tracking-[0.36em] text-[var(--brand-neutral)]">
                    Started
                  </p>
                  <p className="mt-0.5 text-right text-[12px] font-black tracking-wide text-[var(--brand-primary-deep)]">
                    {startedAt}
                  </p>
                </div>
              )}
            </div>
          )}

        </div>
      </div>
    </section>
  );
}
