import type { ReactNode } from 'react';
import { AlertCircle, Check, XCircle } from 'lucide-react';

export type PortalStepperState = 'idle' | 'in_progress' | 'completed' | 'failed' | 'review';

export type PortalStepperStep = {
  id: number;
  label: string;
  desc: string;
  icon: (active: boolean, done: boolean) => ReactNode;
};

type PortalStepperProps = {
  steps: PortalStepperStep[];
  currentStepIndex: number;
  getStepVisualState: (stepId: number) => PortalStepperState;
};

export default function PortalStepper({
  steps,
  currentStepIndex,
  getStepVisualState,
}: PortalStepperProps) {
  const activeLinePct = Math.max(0, Math.min(100, (currentStepIndex / steps.length) * 100));

  return (
    <section className="relative overflow-hidden rounded-[28px] border border-[color:rgba(44,53,97,0.14)] bg-[radial-gradient(circle_at_3%_18%,rgba(220,225,235,0.9),transparent_20%),radial-gradient(circle_at_90%_18%,rgba(202,227,239,0.8),transparent_16%),linear-gradient(180deg,rgba(247,249,252,1)_0%,rgba(244,246,250,1)_100%)] px-4 py-3.5 shadow-[0_16px_30px_rgba(15,23,42,0.06)] md:px-7 md:py-4">
      <div className="relative">
        <div
          className="pointer-events-none absolute left-[12.5%] right-[12.5%] top-[2.15rem] z-0 hidden h-[2px] rounded-full bg-[color:rgba(214,220,232,0.95)] md:block md:top-[2.4rem]"
          style={{
            boxShadow: '0 0 0 1px rgba(255,255,255,0.85)',
          }}
          aria-hidden="true"
        />
        <div
          className="pointer-events-none absolute left-[12.5%] z-10 hidden h-[2px] rounded-full bg-gradient-to-r from-[var(--brand-primary)] via-[var(--brand-sky)] to-[var(--brand-sky-light)] md:block"
          style={{
            top: '2.4rem',
            width: `calc(${activeLinePct}% - 12.5%)`,
            maxWidth: '75%',
          }}
          aria-hidden="true"
        />
        <div className="relative grid grid-cols-1 gap-4 md:grid-cols-4 md:gap-0 md:px-1">
          {steps.map((step, index) => {
            const stepState = getStepVisualState(step.id);
            const isActive = stepState === 'in_progress';
            const isCompleted = stepState === 'completed';
            const isFailed = stepState === 'failed';
            const isReview = stepState === 'review';
            const isCurrent = currentStepIndex === step.id;
            const isPast = currentStepIndex > step.id || isCompleted;

            const isLive = isCurrent || isActive;
            const circleClass = isFailed
              ? 'bg-[color:rgba(83,86,90,0.08)] border-[color:rgba(83,86,90,0.18)] text-[var(--brand-primary-deep)]'
              : isReview
                ? 'bg-white border-[color:rgba(44,53,97,0.12)] text-[var(--brand-primary)]'
                : isLive
                  ? 'bg-[linear-gradient(180deg,var(--brand-primary)_0%,var(--brand-primary-mid)_56%,var(--brand-sky)_100%)] border-white text-white shadow-[0_14px_32px_rgba(44,53,97,0.28)] ring-4 ring-[color:rgba(44,53,97,0.08)]'
                  : isPast
                    ? 'bg-white border-[color:rgba(44,53,97,0.12)] text-[var(--brand-neutral)] shadow-[0_6px_14px_rgba(15,23,42,0.08)]'
                    : 'bg-white border-[color:rgba(44,53,97,0.12)] text-[var(--brand-neutral)] shadow-[0_6px_14px_rgba(15,23,42,0.08)]';

            return (
              <div key={step.id} className="relative flex flex-col items-center text-center">
                <div className="relative z-10 flex w-full flex-col items-center">
                  <div className={`relative flex h-[3.5rem] w-[3.5rem] items-center justify-center rounded-full border-[2px] md:h-[4rem] md:w-[4rem] ${circleClass}`}>
                    <div className="relative flex h-[1.9rem] w-[1.9rem] items-center justify-center rounded-full bg-transparent md:h-[2rem] md:w-[2rem]">
                      {isFailed ? (
                        <XCircle className="h-[1.15rem] w-[1.15rem] md:h-[1.25rem] md:w-[1.25rem]" />
                      ) : isReview ? (
                        <AlertCircle className="h-[1.15rem] w-[1.15rem] md:h-[1.25rem] md:w-[1.25rem]" />
                      ) : isCompleted ? (
                        <Check className="h-[1.15rem] w-[1.15rem] md:h-[1.25rem] md:w-[1.25rem]" />
                      ) : (
                        step.icon(isActive, isCompleted)
                      )}
                    </div>
                    <span className="absolute -right-1.5 -top-1.5 flex h-[1.45rem] w-[1.45rem] items-center justify-center rounded-full border border-[color:rgba(44,53,97,0.08)] bg-white text-[8px] font-extrabold text-[var(--brand-primary-deep)] shadow-[0_6px_14px_rgba(15,23,42,0.12)] md:h-[1.65rem] md:w-[1.65rem] md:text-[8px]">
                      {step.id}
                    </span>
                  </div>

                  <div className="mt-2 space-y-1 md:mt-3 md:space-y-1.25">
                    <span
                      className={`block text-[9px] font-black uppercase tracking-[0.28em] md:text-[10px] md:tracking-[0.3em] ${
                        isFailed
                          ? 'text-[var(--brand-primary-deep)]'
                          : isReview
                            ? 'text-[var(--brand-primary-deep)]'
                            : isCurrent || isActive
                              ? 'text-[var(--brand-primary-deep)]'
                              : 'text-[var(--brand-neutral)]'
                      }`}
                    >
                      {step.label}
                    </span>

                    <span
                      className={`mx-auto inline-flex rounded-full border px-2.5 py-[3px] text-[7px] font-extrabold uppercase tracking-[0.24em] md:px-3 md:py-[4px] md:text-[7px] md:tracking-[0.25em] ${
                        isFailed
                          ? 'border-[color:rgba(44,53,97,0.14)] bg-[color:rgba(83,86,90,0.10)] text-[var(--brand-neutral)]'
                          : isReview
                            ? 'border-[color:rgba(44,53,97,0.14)] bg-white text-[var(--brand-neutral)]'
                            : isCompleted || (step.id < currentStepIndex && !isCurrent)
                                ? 'border-[color:rgba(44,53,97,0.14)] bg-white text-[var(--brand-primary-deep)]'
                              : isCurrent || isActive
                                ? 'border-[color:rgba(44,53,97,0.18)] bg-[var(--brand-sky)] text-white shadow-[0_8px_18px_rgba(0,142,185,0.22)]'
                                : 'border-[color:rgba(44,53,97,0.14)] bg-white text-[var(--brand-neutral)]'
                      }`}
                    >
                      {isFailed
                        ? 'Rejected'
                        : isReview
                          ? 'Pending'
                          : isCompleted
                            ? 'Approved'
                            : isCurrent || isActive
                              ? 'In Progress'
                              : 'Pending'}
                    </span>

                    <span className="block text-[8px] font-semibold uppercase tracking-[0.22em] text-[var(--brand-neutral)]/90">
                      {step.desc}
                    </span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
