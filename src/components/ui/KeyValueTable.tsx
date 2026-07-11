import type { ReactNode } from 'react';

export interface KeyValueTableRow {
  label: string;
  value: ReactNode;
  valueClassName?: string;
  labelClassName?: string;
  rowClassName?: string;
}

interface KeyValueTableProps {
  rows: KeyValueTableRow[];
  headerLeft: string;
  headerRight: string;
  className?: string;
}

export default function KeyValueTable({
  rows,
  headerLeft,
  headerRight,
  className = '',
}: KeyValueTableProps) {
  return (
    <div className={['overflow-hidden rounded-lg border border-[color:rgba(44,53,97,0.12)] bg-white', className].join(' ')}>
      <div className="grid grid-cols-2 bg-[color:rgba(44,53,97,0.04)] text-[10px] uppercase tracking-widest text-[var(--brand-neutral)] font-bold border-b border-[color:rgba(44,53,97,0.12)]">
        <div className="px-3 py-2 border-r border-[color:rgba(44,53,97,0.12)]">{headerLeft}</div>
        <div className="px-3 py-2">{headerRight}</div>
      </div>

      {rows.map(({ label, value, valueClassName = '', labelClassName = '', rowClassName = '' }) => (
        <div key={label} className={['grid grid-cols-2 text-xs border-b border-[color:rgba(44,53,97,0.08)] last:border-b-0', rowClassName].join(' ')}>
          <div className={['px-3 py-2 font-semibold text-[var(--brand-neutral)] bg-[color:rgba(44,53,97,0.03)] border-r border-[color:rgba(44,53,97,0.08)]', labelClassName].join(' ')}>
            {label}
          </div>
          <div className={['px-3 py-2 text-[var(--brand-primary-deep)] break-words', valueClassName].join(' ')}>
            {value}
          </div>
        </div>
      ))}
    </div>
  );
}
