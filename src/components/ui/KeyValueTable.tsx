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
    <div className={['overflow-hidden rounded-lg border border-slate-200 bg-white', className].join(' ')}>
      <div className="grid grid-cols-2 bg-slate-50 text-[10px] uppercase tracking-widest text-slate-500 font-bold border-b border-slate-200">
        <div className="px-3 py-2 border-r border-slate-200">{headerLeft}</div>
        <div className="px-3 py-2">{headerRight}</div>
      </div>

      {rows.map(({ label, value, valueClassName = '', labelClassName = '', rowClassName = '' }) => (
        <div key={label} className={['grid grid-cols-2 text-xs border-b border-slate-100 last:border-b-0', rowClassName].join(' ')}>
          <div className={['px-3 py-2 font-semibold text-slate-600 bg-slate-50 border-r border-slate-100', labelClassName].join(' ')}>
            {label}
          </div>
          <div className={['px-3 py-2 text-slate-800 break-words', valueClassName].join(' ')}>
            {value}
          </div>
        </div>
      ))}
    </div>
  );
}
