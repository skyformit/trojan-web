import { AlertCircle, ArrowRight, Mail, Phone, Sparkles, UserCheck } from 'lucide-react';
import type { ContactValidationErrors } from '../../utils/chatWorkflow';

interface ContactSetupCardProps {
  attempted: boolean;
  errors: ContactValidationErrors;
  contactName: string;
  contactEmail: string;
  phonePrefix: string;
  phoneLocalNumber: string;
  prefixOptions: readonly string[];
  onContactNameChange: (value: string) => void;
  onContactEmailChange: (value: string) => void;
  onPrefixChange: (value: string) => void;
  onPhoneLocalNumberChange: (value: string) => void;
  onSave: () => void;
}

export default function ContactSetupCard({
  attempted,
  errors,
  contactName,
  contactEmail,
  phonePrefix,
  phoneLocalNumber,
  prefixOptions,
  onContactNameChange,
  onContactEmailChange,
  onPrefixChange,
  onPhoneLocalNumberChange,
  onSave,
}: ContactSetupCardProps) {
  return (
    <div className="bg-white border hover:border-[color:rgba(44,53,97,0.24)] border-[color:rgba(44,53,97,0.14)] rounded-lg p-5 shadow-sm space-y-3.5 max-w-[90%] mx-auto font-sans text-[var(--brand-primary-deep)] animate-fade-in">
      <div className="flex items-center gap-2 text-[var(--brand-primary)] font-bold text-xs uppercase tracking-wider border-b border-[color:rgba(44,53,97,0.08)] pb-2">
        <Sparkles className="w-4 h-4 text-[var(--brand-sky)] animate-pulse" />
        <span>Notification Contact Setup</span>
      </div>

      {attempted && Object.keys(errors).length > 0 && (
        <div className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-[11px] text-rose-700 flex items-start gap-2">
          <AlertCircle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
          <span>Please fix the highlighted fields before continuing.</span>
        </div>
      )}

      <div className="space-y-3.5 text-xs">
        <div>
          <label className="block text-[10px] font-bold text-[var(--brand-gray-light)] uppercase tracking-widest mb-1.5 flex items-center gap-1.5">
            <UserCheck className="w-3.5 h-3.5 text-[var(--brand-sky)] shrink-0" />
            <span>Full Name</span>
          </label>
          <input
            type="text"
            placeholder="e.g. John Doe"
            value={contactName}
            onChange={(e) => onContactNameChange(e.target.value)}
            className={`w-full bg-[color:rgba(44,53,97,0.04)] focus:bg-white rounded px-3 py-2 focus:outline-none transition font-medium border ${
              attempted && errors.name
                ? 'border-rose-300 focus:border-rose-500 bg-rose-50'
                : 'border-[color:rgba(44,53,97,0.12)] focus:border-[var(--brand-primary)]'
            }`}
          />
          {attempted && errors.name && (
            <p className="mt-1 text-[10px] text-rose-600 font-medium flex items-center gap-1">
              <AlertCircle className="w-3 h-3" />
              <span>{errors.name}</span>
            </p>
          )}
        </div>

        <div>
          <label className="block text-[10px] font-bold text-[var(--brand-gray-light)] uppercase tracking-widest mb-1.5 flex items-center gap-1.5">
            <Mail className="w-3.5 h-3.5 text-[var(--brand-sky)] shrink-0" />
            <span>Primary Notification Email</span>
          </label>
          <input
            type="email"
            placeholder="john.doe@company.com"
            value={contactEmail}
            onChange={(e) => onContactEmailChange(e.target.value)}
            className={`w-full bg-[color:rgba(44,53,97,0.04)] focus:bg-white rounded px-3 py-2 focus:outline-none transition font-medium border ${
              attempted && errors.email
                ? 'border-rose-300 focus:border-rose-500 bg-rose-50'
                : 'border-[color:rgba(44,53,97,0.12)] focus:border-[var(--brand-primary)]'
            }`}
          />
          {attempted && errors.email && (
            <p className="mt-1 text-[10px] text-rose-600 font-medium flex items-center gap-1">
              <AlertCircle className="w-3 h-3" />
              <span>{errors.email}</span>
            </p>
          )}
        </div>

        <div>
          <label className="block text-[10px] font-bold text-[var(--brand-gray-light)] uppercase tracking-widest mb-1.5 flex items-center gap-1.5">
            <Phone className="w-3.5 h-3.5 text-[var(--brand-sky)] shrink-0" />
            <span>UAE Mobile Phone Number</span>
          </label>
          <div className={`flex items-stretch rounded border overflow-hidden ${
            attempted && errors.phone
              ? 'border-rose-300 bg-rose-50'
              : 'border-[color:rgba(44,53,97,0.12)] bg-[color:rgba(44,53,97,0.04)] focus-within:border-[var(--brand-primary)] focus-within:bg-white'
          }`}>
            <div className="flex items-center px-3 text-sm font-bold text-[var(--brand-neutral)] border-r border-[color:rgba(44,53,97,0.12)] bg-[color:rgba(44,53,97,0.06)]">
              +971
            </div>
            <select
              value={phonePrefix}
              onChange={(e) => onPrefixChange(e.target.value)}
              className="w-24 bg-transparent px-3 py-2 text-sm font-semibold text-[var(--brand-primary-deep)] outline-none border-r border-[color:rgba(44,53,97,0.12)]"
            >
              {prefixOptions.map(prefix => (
                <option key={prefix} value={prefix}>
                  {prefix}
                </option>
              ))}
            </select>
            <input
              type="text"
              inputMode="numeric"
              placeholder="7 digits"
              value={phoneLocalNumber}
              maxLength={7}
              onChange={(e) => onPhoneLocalNumberChange(e.target.value)}
              className="flex-1 bg-transparent px-3 py-2 focus:outline-none text-sm font-medium text-[var(--brand-primary-deep)] placeholder:text-[var(--brand-gray-light)]"
            />
          </div>
          {attempted && errors.phone && (
            <p className="mt-1 text-[10px] text-rose-600 font-medium flex items-center gap-1">
              <AlertCircle className="w-3 h-3" />
              <span>{errors.phone}</span>
            </p>
          )}
        </div>
      </div>

      <button
        onClick={onSave}
        className="w-full text-[10px] uppercase tracking-widest bg-[var(--brand-primary)] hover:bg-[var(--brand-primary-deep)] text-white font-bold py-3 px-4 rounded-sm transition flex items-center justify-center gap-2 mt-2 shadow-xs"
      >
        <span>Save Contact Config & Proceed</span>
        <ArrowRight className="w-3.5 h-3.5" />
      </button>
    </div>
  );
}
