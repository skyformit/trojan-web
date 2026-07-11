import type { VendorLookupSummary } from '../../utils/chatWorkflow';

interface VendorLookupResultsProps {
  summaries: VendorLookupSummary[];
  getBadgeLabel: (summary: VendorLookupSummary) => string;
}

export default function VendorLookupResults({ summaries, getBadgeLabel }: VendorLookupResultsProps) {
  if (summaries.length === 0) {
    return null;
  }

  return (
    <div className="max-w-[90%] mx-auto rounded-lg border border-[color:rgba(44,53,97,0.14)] bg-[linear-gradient(180deg,rgba(243,245,250,0.98)_0%,rgba(248,249,251,0.95)_100%)] p-4 shadow-sm space-y-3 animate-fade-in">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-[10px] uppercase tracking-widest font-bold text-[var(--brand-primary)]">Vendor Lookup Result</p>
          <h3 className="text-sm font-bold text-slate-900 mt-1">
            {summaries[0]?.companyName || 'Vendor Matches'}
          </h3>
        </div>
        <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-1 rounded border text-[var(--brand-primary)] bg-[color:rgba(44,53,97,0.08)] border-[color:rgba(44,53,97,0.14)]">
          {summaries.length} Match{summaries.length > 1 ? 'es' : ''}
        </span>
      </div>

      <div className="space-y-3">
        {summaries.map((vendor, index) => (
          <div key={`${vendor.tradeLicenseNo}-${index}`} className="rounded-lg border border-[color:rgba(44,53,97,0.12)] bg-white p-3.5 space-y-3">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-[10px] uppercase tracking-widest font-bold text-[var(--brand-primary)]">Vendor {index + 1}</p>
                <h4 className="text-sm font-bold text-slate-900 mt-1">{vendor.companyName}</h4>
              </div>
              <span
                className={`text-[10px] font-bold uppercase tracking-wider px-2 py-1 rounded border ${
                  vendor.lifecycleStatus === 'expired'
                    ? 'text-[var(--brand-primary-deep)] bg-slate-100 border-slate-200'
                    : vendor.lifecycleStatus === 'renewal_due'
                      ? 'text-[var(--brand-brown)] bg-[color:rgba(185,131,90,0.12)] border-[color:rgba(185,131,90,0.18)]'
                      : 'text-[var(--brand-primary)] bg-[color:rgba(44,53,97,0.08)] border-[color:rgba(44,53,97,0.14)]'
                }`}
              >
                {getBadgeLabel(vendor)}
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px] text-slate-700">
              <div className="bg-slate-50 rounded border border-[color:rgba(44,53,97,0.12)] p-2.5">
                <span className="block text-[9px] uppercase tracking-wider text-slate-400 font-bold">Trade License No.</span>
                <span className="font-mono font-semibold">{vendor.tradeLicenseNo}</span>
              </div>
              <div className="bg-slate-50 rounded border border-[color:rgba(44,53,97,0.12)] p-2.5">
                <span className="block text-[9px] uppercase tracking-wider text-slate-400 font-bold">Expiry Date</span>
                <span className="font-semibold">{vendor.expDate}</span>
              </div>
              <div className="bg-slate-50 rounded border border-[color:rgba(44,53,97,0.12)] p-2.5 sm:col-span-2">
                <span className="block text-[9px] uppercase tracking-wider text-slate-400 font-bold">Business Activity</span>
                <span>{vendor.businessActivity}</span>
              </div>
              <div className="bg-slate-50 rounded border border-[color:rgba(44,53,97,0.12)] p-2.5 sm:col-span-2">
                <span className="block text-[9px] uppercase tracking-wider text-slate-400 font-bold">Address</span>
                <span>{vendor.address}</span>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-[11px] text-slate-700">
              <div className="bg-slate-50 rounded border border-[color:rgba(44,53,97,0.12)] p-2.5">
                <span className="block text-[9px] uppercase tracking-wider text-slate-400 font-bold">Phone</span>
                <span>{vendor.phone}</span>
              </div>
              <div className="bg-slate-50 rounded border border-[color:rgba(44,53,97,0.12)] p-2.5">
                <span className="block text-[9px] uppercase tracking-wider text-slate-400 font-bold">Email</span>
                <span className="break-all">{vendor.email}</span>
              </div>
              <div className="bg-slate-50 rounded border border-[color:rgba(44,53,97,0.12)] p-2.5">
                <span className="block text-[9px] uppercase tracking-wider text-slate-400 font-bold">Chamber No.</span>
                <span>{vendor.chamberNo}</span>
              </div>
            </div>

            <div className="text-[10px] text-[var(--brand-primary)] font-medium">
              Route: {vendor.routeLabel}
              <span className="mx-1">•</span>
              Source: TBMS lookup
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
