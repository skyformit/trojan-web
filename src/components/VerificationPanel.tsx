import React, { useState } from 'react';
import { ShieldCheck, FileText, Clock, ArrowRight, Save, Database, UserCheck } from 'lucide-react';
import { SupplierRegistrationState, DocumentVerification } from '../types';
import KeyValueTable from './ui/KeyValueTable';
import StatusPill from './ui/StatusPill';

interface VerificationPanelProps {
  registrationState: SupplierRegistrationState;
  setRegistrationState: React.Dispatch<React.SetStateAction<SupplierRegistrationState>>;
  onSubmitRegistration: () => void | Promise<void>;
  isSubmitting?: boolean;
}

export default function VerificationPanel({
  registrationState,
  setRegistrationState,
  onSubmitRegistration,
  isSubmitting = false
}: VerificationPanelProps) {
  const { trade_license, vat_certificate, bank_document } = registrationState.documents;
  const [activeTab, setActiveTab] = useState<'status' | 'trade' | 'vat' | 'bank_document'>('status');
  const productOptions = [
    'Construction Equipment',
    'Spare Parts',
    'Electrical & Lighting',
    'Oilfield & Gas Equipment',
    'Safety & PPE',
    'Hardware & Fasteners',
    'Plumbing Materials',
    'HVAC & Ducting',
    'Industrial Tools',
    'Chemicals & Consumables',
    'General Trading'
  ];

  const formatMissingItemLabel = (field: string) => {
    const normalized = field.trim().toLowerCase();
    const labelMap: Record<string, string> = {
      trade_name: 'Trade Name',
      expiry_date: 'Expiry Date',
      licensed_activities: 'Licensed Activities',
      vat_number: 'VAT Number',
      company_name: 'Company Name',
      bank_name: 'Bank Name',
      license_number: 'License Number',
      tax_number: 'Tax Number',
      account_number: 'Account Number',
      bank_account_number: 'Bank Account Number',
    };

    return labelMap[normalized] || normalized.replace(/_/g, ' ').replace(/\b\w/g, ch => ch.toUpperCase());
  };

  const formatMissingFieldLabels = (fields?: string[]) => (fields || []).map(formatMissingItemLabel);

  const formatAcceptanceValue = (value: unknown) => {
    if (Array.isArray(value)) {
      return value.length > 0 ? value.join(', ') : 'N/A';
    }

    if (value === true) return 'Yes';
    if (value === false) return 'No';
    if (value === null || value === undefined || value === '') return 'N/A';
    return String(value);
  };

  const formatAcceptanceReasonText = (reason: string) => {
    const normalized = reason.toLowerCase();

    if (!normalized) {
      return 'We could not approve this document because one or more checks did not pass.';
    }

    if (normalized.includes('company name') && normalized.includes('does not match')) {
      return 'The company name on the document does not match the company name we received.';
    }

    if (normalized.includes('expired')) {
      return 'The uploaded document appears to be expired.';
    }

    if (normalized.includes('plausibility score') || normalized.includes('gpt review')) {
      return 'The document authenticity review needs a stronger match before it can be approved.';
    }

    if (normalized.includes('document type')) {
      return 'The uploaded document does not match the current step in the onboarding flow.';
    }

    if (normalized.includes('missing')) {
      return 'Some required details are missing from the uploaded document.';
    }

    if (normalized.includes('close match')) {
      return 'The company name is a close match and needs a quick review before approval.';
    }

    if (normalized.includes('verification url present')) {
      return 'An official verification link was found.';
    }

    if (normalized.includes('logo present')) {
      return 'The company logo was detected.';
    }

    if (normalized.includes('qr code present')) {
      return 'A QR code was detected.';
    }

    if (normalized.includes('expert review contribution')) {
      return 'The document was reviewed as part of the verification process.';
    }

    if (normalized.includes('+') && normalized.match(/\+\d+/)) {
      return 'The document was reviewed as part of the verification process.';
    }

    if (normalized.includes('verification signals')) {
      return 'The document includes the expected verification signals.';
    }

    return reason;
  };

  const getAcceptanceDisplayStatus = (doc: DocumentVerification) => {
    const acceptance = doc.documentAcceptance;
    const mismatchStatus = String(acceptance?.company_match?.match_status || acceptance?.tbms_match?.status || '').toLowerCase();
    if (mismatchStatus === 'mismatch') {
      return String(acceptance?.status || '').toLowerCase() || 'rejected';
    }

    if (acceptance?.is_expired) {
      return 'expired';
    }
    return String(acceptance?.status || '').toLowerCase();
  };

  const getEffectiveDocStatus = (doc: DocumentVerification) => {
    const acceptanceDisplayStatus = getAcceptanceDisplayStatus(doc);

    if (acceptanceDisplayStatus === 'rejected') {
      return doc.status && doc.status !== 'empty' ? doc.status : 'failed';
    }

    if (acceptanceDisplayStatus === 'expired') {
      return 'expired';
    }

    if (doc.status && doc.status !== 'empty') {
      return doc.status;
    }

    const acceptanceStatus = String(doc.documentAcceptance?.status || '').toLowerCase();
    if (acceptanceStatus === 'approved') return 'verified';
    if (acceptanceStatus === 'review') return 'review';
    if (acceptanceStatus === 'rejected') return 'failed';
    return doc.status;
  };

  const renderAcceptanceBadge = (doc: DocumentVerification) => {
    const normalized = getAcceptanceDisplayStatus(doc);
    if (normalized === 'approved') {
      return <StatusPill tone="success">Approved</StatusPill>;
    }
    if (normalized === 'review') {
      return <StatusPill tone="warning">Review</StatusPill>;
    }
    if (normalized === 'expired') {
      return <StatusPill tone="danger">Expired</StatusPill>;
    }
    if (normalized === 'rejected') {
      return <StatusPill tone="danger">Rejected</StatusPill>;
    }
    return <StatusPill tone="neutral">Unknown</StatusPill>;
  };

  const getDocumentSummaryDetails = (doc: DocumentVerification) => {
    if (doc.type === 'bank_document') {
      return (
        doc.extractedData?.companyName ||
        doc.extractedData?.beneficiaryName ||
        doc.extractedData?.accountName ||
        doc.extractedData?.bankHolderName ||
        doc.extractedData?.tradeName ||
        doc.extractedData?.bankName ||
        doc.extractedData?.bankAccountNumber ||
        'N/A'
      );
    }

    if (doc.type === 'vat_certificate') {
      return (
        doc.extractedData?.taxRegistrationNumber ||
        doc.extractedData?.vatNumber ||
        doc.extractedData?.companyName ||
        doc.extractedData?.tradeName ||
        'N/A'
      );
    }

    return (
      doc.extractedData?.licenseNumber ||
      doc.extractedData?.companyName ||
      doc.extractedData?.tradeName ||
      'N/A'
    );
  };

  const getDocStatusBadge = (doc: DocumentVerification) => {
    switch (getEffectiveDocStatus(doc)) {
      case 'empty':
        return <StatusPill tone="neutral">Missing</StatusPill>;
      case 'verifying':
        return <StatusPill tone="info" className="animate-pulse">Scanning...</StatusPill>;
      case 'ocr_completed':
        return <StatusPill tone="info">OCR Extracted</StatusPill>;
      case 'registry_check':
        return <StatusPill tone="warning" className="animate-pulse">Checking...</StatusPill>;
      case 'review':
        return <StatusPill tone="warning">Review</StatusPill>;
      case 'expired':
        return <StatusPill tone="danger">Expired</StatusPill>;
      case 'verified':
        return <StatusPill tone="success">✓ Verified</StatusPill>;
      case 'failed':
        return <StatusPill tone="danger">✕ Failed</StatusPill>;
    }
  };

  const getOverallProgress = () => {
    let completed = 0;
    if (getEffectiveDocStatus(trade_license) === 'verified') completed += 33.3;
    if (getEffectiveDocStatus(vat_certificate) === 'verified') completed += 33.3;
    if (getEffectiveDocStatus(bank_document) === 'verified') completed += 33.4;
    return Math.min(Math.round(completed), 100);
  };

  const score = getOverallProgress();

  const buildDocumentSummaryRows = (doc: DocumentVerification) => {
    const displayStatus = getAcceptanceDisplayStatus(doc);
    const acceptanceStatus = String(doc.documentAcceptance?.status || '').toLowerCase();
    const notesLabel = displayStatus === 'rejected'
      ? 'Rejection Notes'
      : displayStatus === 'expired'
        ? 'Expiration Notes'
        : acceptanceStatus === 'review'
          ? 'Review Notes'
          : 'Approval Notes';
    const notes = Array.isArray(doc.documentAcceptance?.reasons)
      ? doc.documentAcceptance.reasons.map(reason => formatAcceptanceReasonText(String(reason)))
      : [];

    return [
      { label: 'Document Type', value: formatAcceptanceValue(doc.documentAcceptance?.document_type) },
      { label: 'Final Decision', value: formatAcceptanceValue(displayStatus || doc.documentAcceptance?.status) },
      { label: 'Decision Score', value: formatAcceptanceValue(doc.documentAcceptance?.score) },
      { label: 'Missing Fields', value: formatAcceptanceValue(formatMissingFieldLabels(doc.documentAcceptance?.missing_fields)) },
      {
        label: notesLabel,
        value: notes.length > 0 ? (
          <ul className="space-y-1 list-disc list-inside">
            {notes.map((reason, index) => (
              <li key={`${notesLabel}-${index}`}>{reason}</li>
            ))}
          </ul>
        ) : 'N/A',
      },
      { label: 'Expiry Date', value: formatAcceptanceValue(doc.documentAcceptance?.expiry_date) },
      { label: 'Expired', value: formatAcceptanceValue(doc.documentAcceptance?.is_expired) },
      { label: 'Ready for Approval', value: formatAcceptanceValue(doc.documentAcceptance?.acceptable) },
    ];
  };

  const getExtractedValue = (doc: DocumentVerification, key: string) => {
    const extractedData = doc.extractedData || {};
    if (key === 'vatNumber') {
      return extractedData.vatNumber || extractedData.taxRegistrationNumber || 'N/A';
    }
    return extractedData[key] || 'N/A';
  };

  const renderStatusDashboard = () => {
    const scoreProgress = Math.max(0, Math.min(score, 100));
    const scoreRingStyle = {
      background: `conic-gradient(#4f46e5 0deg ${scoreProgress * 3.6}deg, #dbe5f3 ${scoreProgress * 3.6}deg 360deg)`,
    } as React.CSSProperties;

    return (
      <div className="space-y-2.5">
        {/* Core summary card */}
        <div className="rounded-[18px] border border-slate-200/80 bg-[linear-gradient(135deg,rgba(244,248,255,0.98)_0%,rgba(236,243,253,0.98)_46%,rgba(249,250,255,0.99)_100%)] px-3 py-2 shadow-[0_8px_18px_rgba(15,23,42,0.06)] md:px-4 md:py-2.5">
          <p className="text-[11px] font-black uppercase tracking-[0.26em] text-[var(--brand-gray-light)]">Overall Decision</p>

          <div className="mt-2 grid grid-cols-1 items-start gap-3 sm:grid-cols-[minmax(80px,auto)_minmax(0,1fr)_auto] sm:items-center md:gap-2.5">
            <div className="relative flex h-[80px] w-[80px] items-center justify-center rounded-full bg-[color:rgba(83,86,90,0.08)] shadow-[inset_0_0_0_1px_rgba(44,53,97,0.10)] md:h-[88px] md:w-[88px]">
              <div
                className="absolute inset-0 rounded-full p-[4px] md:p-[5px]"
                style={scoreRingStyle}
              >
                <div className="h-full w-full rounded-full bg-[linear-gradient(180deg,rgba(255,255,255,0.98)_0%,rgba(248,250,255,0.98)_100%)] shadow-[inset_0_0_0_1px_rgba(255,255,255,0.8)]" />
              </div>
              <div className="relative z-10 flex flex-col items-center justify-center text-center">
                <span className="text-[22px] font-black leading-none tracking-tight text-[var(--brand-primary)] md:text-[26px]">{score}%</span>
                <span className="mt-0.5 text-[6px] font-black uppercase tracking-[0.2em] text-[var(--brand-neutral)] md:text-[7px]">Validated</span>
              </div>
            </div>

            <div className="flex flex-col justify-center gap-0.5 pl-0 text-[12px] font-medium text-[var(--brand-neutral)] md:text-[13px]">
              <div className="flex items-center gap-1.5">
                <span className="h-1.5 w-1.5 rounded-full bg-[var(--brand-gray-light)]/90" />
                <span>Identity</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="h-1.5 w-1.5 rounded-full bg-[var(--brand-gray-light)]/90" />
                <span>Documents</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="h-1.5 w-1.5 rounded-full bg-[var(--brand-gray-light)]/90" />
                <span>Compliance</span>
              </div>
            </div>

            <div>
              <p className="text-[8px] font-black uppercase tracking-[0.2em] text-amber-500">Pending</p>
              <p className="mt-1 text-[16px] font-black leading-none text-[var(--brand-primary-deep)] md:text-[20px]">0 / 3</p>
              <p className="mt-1 text-[8px] font-black uppercase tracking-[0.18em] text-[var(--brand-neutral)]">Awaiting</p>
            </div>
          </div>
        </div>

        {/* Contact & Notification Settings Status */}
        <div className="rounded-[18px] border border-[color:rgba(44,53,97,0.14)] bg-[linear-gradient(180deg,rgba(243,245,250,0.98)_0%,rgba(239,241,246,0.95)_100%)] p-3 shadow-[0_8px_18px_rgba(15,23,42,0.05)] space-y-2.5">
          <h4 className="flex items-center gap-1.5 text-[8px] font-extrabold uppercase tracking-[0.28em] text-[var(--brand-primary)]">
            <UserCheck className="h-3.5 w-3.5 text-[var(--brand-sky)]" /> Authorized Representative
          </h4>
          
          {registrationState.contactName ? (
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
              <div className="rounded-[14px] border border-white/80 bg-white/75 px-3 py-2.5 shadow-[0_6px_14px_rgba(15,23,42,0.04)]">
                <span className="block text-[8px] font-extrabold uppercase tracking-[0.24em] text-[var(--brand-gray-light)]">Full Name</span>
                <span className="mt-1 block truncate text-[13px] font-black text-[var(--brand-primary-deep)]">{registrationState.contactName}</span>
              </div>
              <div className="rounded-[14px] border border-white/80 bg-white/75 px-3 py-2.5 shadow-[0_6px_14px_rgba(15,23,42,0.04)]">
                <span className="block text-[8px] font-extrabold uppercase tracking-[0.24em] text-[var(--brand-gray-light)]">Notification Email</span>
                <span className="mt-1 block truncate text-[13px] font-black text-[var(--brand-primary)]" title={registrationState.contactEmail}>{registrationState.contactEmail || 'N/A'}</span>
              </div>
              <div className="rounded-[14px] border border-white/80 bg-white/75 px-3 py-2.5 shadow-[0_6px_14px_rgba(15,23,42,0.04)]">
                <span className="block text-[8px] font-extrabold uppercase tracking-[0.24em] text-[var(--brand-gray-light)]">Mobile/SMS Contact</span>
                <span className="mt-1 block truncate font-mono text-[13px] font-medium text-[var(--brand-primary-deep)]">{registrationState.phoneNumber || 'N/A'}</span>
              </div>
            </div>
          ) : (
            <p className="rounded-[14px] border border-[color:rgba(44,53,97,0.1)] bg-white/70 px-3 py-2.5 text-[10px] italic text-[var(--brand-neutral)] shadow-[0_6px_14px_rgba(15,23,42,0.04)]">No notification settings filed. We'll collect configuration details in Step 2 of the AI Agent chat.</p>
          )}
        </div>

        {/* Compliance Checklist status breakdown */}
        <div className="space-y-2.5">
          <div className="flex items-center justify-between gap-2.5">
            <h4 className="flex items-center gap-1.5 text-[8px] font-extrabold uppercase tracking-[0.28em] text-[var(--brand-neutral)]">
              <Database className="h-3.5 w-3.5 text-[var(--brand-gray-light)]" /> Required Identification Badges
            </h4>
            <span className="text-[8px] font-black uppercase tracking-[0.22em] text-[var(--brand-primary)]">{[trade_license, vat_certificate, bank_document].filter(doc => getEffectiveDocStatus(doc) === 'verified').length} / 3</span>
          </div>
          <div className="grid grid-cols-1 gap-1.5">
            {([
              { doc: trade_license, tab: 'trade', label: 'Commercial Trade License', key: 'trade_license', id: 'TL' },
              { doc: vat_certificate, tab: 'vat', label: 'VAT Registration Ledger', key: 'vat_certificate', id: 'VAT' },
              { doc: bank_document, tab: 'bank_document', label: 'Bank Account Statement', key: 'bank_document', id: 'BANK' }
            ] as const).map(({ doc, tab, label, id }) => (
              <button
                key={id}
                onClick={() => setActiveTab(tab)}
                className="flex items-start justify-between gap-3 rounded-[16px] border border-slate-200/90 bg-white px-4 py-3 text-left shadow-[0_6px_14px_rgba(15,23,42,0.04)] transition hover:border-slate-300 hover:bg-slate-50 sm:items-center md:px-4 md:py-3.5"
              >
                <div className="flex min-w-0 items-start gap-3 sm:items-center">
                  <div className={`flex h-10 w-10 items-center justify-center rounded-[14px] ${getEffectiveDocStatus(doc) === 'verified' ? 'bg-[color:rgba(44,53,97,0.08)] text-[var(--brand-primary)]' : 'bg-slate-100 text-slate-500'} md:h-11 md:w-11`}>
                    <FileText className="h-[18px] w-[18px]" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-[13px] font-bold text-slate-900 md:text-[14px]">{label}</p>
                    <p className="mt-0.5 text-[9px] font-medium text-slate-400 md:text-[10px] break-words">
                      {doc.extractedData
                        ? doc.type === 'bank_document'
                          ? `Bank Holder Name: ${getDocumentSummaryDetails(doc)}`
                          : doc.type === 'vat_certificate'
                            ? `VAT Registration No: ${getDocumentSummaryDetails(doc)}`
                            : `Trade License No: ${getDocumentSummaryDetails(doc)}`
                        : 'Not provided yet'}
                    </p>
                    {doc.type === 'trade_license' && doc.extractedData?.tradeName && (
                      <p className="mt-0.5 text-[9px] text-slate-500 md:text-[10px]">
                        Trade Name: {doc.extractedData.tradeName}
                      </p>
                    )}
                    {doc.documentAcceptance?.status && (
                      <p className="mt-0.5 text-[9px] text-slate-500 md:text-[10px]">
                        Acceptance: {doc.documentAcceptance.is_expired ? 'expired' : doc.documentAcceptance.status}
                      </p>
                    )}
                    {doc.processingTime && (
                      <p className="mt-0.5 text-[8px] font-extrabold uppercase tracking-[0.2em] text-[var(--brand-sky)]">
                        Processing time: {doc.processingTime}
                      </p>
                    )}
                  </div>
                </div>
                {getDocStatusBadge(doc)}
              </button>
            ))}
          </div>
        </div>

        {/* Registry compliance statement & action trigger */}
        <div className="pt-3 border-t border-slate-200">
          {score === 100 ? (
            <div className="space-y-3.5">
              <div className="rounded-[14px] border border-[color:rgba(44,53,97,0.14)] bg-[color:rgba(44,53,97,0.06)] p-3 text-[10px] font-sans leading-relaxed text-[var(--brand-primary)] shadow-[0_6px_14px_rgba(15,23,42,0.04)]">
                <div className="mb-1 flex items-center gap-1.5 font-bold text-[var(--brand-primary)] uppercase tracking-wider text-[8px]">
                  <UserCheck className="w-3.5 h-3.5 text-[var(--brand-sky)]" />
                  <span>Onboarding Credentials Approved</span>
                </div>
                AI Agent validation confirms that all document IDs are globally validated. Under Trojan General Contracting onboarding protocol, please complete the commercial and operational survey below to publish your submission.
              </div>

              {/* Infrastructure & Capabilities Survey Section */}
              <div id="registration-survey-form" className="rounded-[16px] border border-slate-200/80 bg-slate-50/80 p-3.5 space-y-3 shadow-[0_6px_14px_rgba(15,23,42,0.04)]">
                <div className="flex flex-col gap-2 border-b border-slate-200 pb-2 sm:flex-row sm:items-center sm:justify-between">
                  <span className="text-[9px] font-extrabold uppercase tracking-[0.24em] text-slate-800">Business Profile & Capacity</span>
                  <button
                    type="button"
                    onClick={() => {
                      setRegistrationState(prev => ({
                        ...prev,
                        vendorType: 'Supplier',
                        surveyProduct: 'Construction Equipment',
                        yearsInBusiness: '5 to 10',
                        totalStaff: '50 to 100',
                        totalLabors: '100 Plus',
                        totalEngineers: '0 to 50',
                        testingFacility: 'Yes',
                        clientConsultantListings: '5 to 10',
                        projectsLast3Years: '10 to 20',
                        biggestProjectValue: '100k to 500k',
                        annualTurnover: '10m to 50m',
                        factoryAssetValue: '10m to 50m'
                      }));
                    }}
                    className="text-[8px] text-[var(--brand-primary)] font-bold uppercase tracking-widest hover:text-[var(--brand-sky)] transition-colors pointer-events-auto cursor-pointer"
                  >
                    ⚡ Fast Prefill Answers
                  </button>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 text-xs">
                  <div>
                    <label htmlFor="survey-vendor-type" className="block text-[9px] font-bold text-slate-500 uppercase tracking-wider mb-1">Vendor type</label>
                    <select
                      id="survey-vendor-type"
                      value={registrationState.vendorType || ''}
                      onChange={(e) => setRegistrationState(prev => ({ ...prev, vendorType: e.target.value as 'Supplier' | 'Others' | 'Government services' | '' }))}
                      className="w-full bg-white border border-slate-200 rounded p-2 text-xs text-slate-800 focus:outline-none focus:ring-1 focus:ring-[var(--brand-primary)]"
                    >
                      <option value="">Select option...</option>
                      <option value="Supplier">Supplier</option>
                      <option value="Others">Others</option>
                      <option value="Government services">Government services</option>
                    </select>
                  </div>

                  <div>
                    <label htmlFor="survey-product" className="block text-[9px] font-bold text-slate-500 uppercase tracking-wider mb-1">Products</label>
                    <select
                      id="survey-product"
                      value={registrationState.surveyProduct || ''}
                      onChange={(e) => setRegistrationState(prev => ({ ...prev, surveyProduct: e.target.value }))}
                      className="w-full bg-white border border-slate-200 rounded p-2 text-xs text-slate-800 focus:outline-none focus:ring-1 focus:ring-[var(--brand-primary)]"
                    >
                      <option value="">Select option...</option>
                      {productOptions.map((product) => (
                        <option key={product} value={product}>{product}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label htmlFor="survey-years-in-business" className="block text-[9px] font-bold text-slate-500 uppercase tracking-wider mb-1">Years in business</label>
                    <select
                      id="survey-years-in-business"
                      value={registrationState.yearsInBusiness || ''}
                      onChange={(e) => setRegistrationState(prev => ({ ...prev, yearsInBusiness: e.target.value }))}
                      className="w-full bg-white border border-slate-200 rounded p-2 text-xs text-slate-800 focus:outline-none focus:ring-1 focus:ring-[var(--brand-primary)]"
                    >
                      <option value="">Select option...</option>
                      <option value="0 to 5">0 to 5</option>
                      <option value="5 to 10">5 to 10</option>
                      <option value="10 Plus">10 Plus</option>
                    </select>
                  </div>

                  <div>
                    <label htmlFor="survey-total-staff" className="block text-[9px] font-bold text-slate-500 uppercase tracking-wider mb-1">Total number of staff</label>
                    <select
                      id="survey-total-staff"
                      value={registrationState.totalStaff || ''}
                      onChange={(e) => setRegistrationState(prev => ({ ...prev, totalStaff: e.target.value }))}
                      className="w-full bg-white border border-slate-200 rounded p-2 text-xs text-slate-800 focus:outline-none focus:ring-1 focus:ring-[var(--brand-primary)]"
                    >
                      <option value="">Select option...</option>
                      <option value="0 to 50">0 to 50</option>
                      <option value="50 to 100">50 to 100</option>
                      <option value="100 Plus">100 Plus</option>
                    </select>
                  </div>

                  <div>
                    <label htmlFor="survey-total-labors" className="block text-[9px] font-bold text-slate-500 uppercase tracking-wider mb-1">Total number of labors</label>
                    <select
                      id="survey-total-labors"
                      value={registrationState.totalLabors || ''}
                      onChange={(e) => setRegistrationState(prev => ({ ...prev, totalLabors: e.target.value }))}
                      className="w-full bg-white border border-slate-200 rounded p-2 text-xs text-slate-800 focus:outline-none focus:ring-1 focus:ring-[var(--brand-primary)]"
                    >
                      <option value="">Select option...</option>
                      <option value="0 to 50">0 to 50</option>
                      <option value="50 to 100">50 to 100</option>
                      <option value="100 Plus">100 Plus</option>
                    </select>
                  </div>

                  <div>
                    <label htmlFor="survey-total-engineers" className="block text-[9px] font-bold text-slate-500 uppercase tracking-wider mb-1">Engineers among staff</label>
                    <select
                      id="survey-total-engineers"
                      value={registrationState.totalEngineers || ''}
                      onChange={(e) => setRegistrationState(prev => ({ ...prev, totalEngineers: e.target.value }))}
                      className="w-full bg-white border border-slate-200 rounded p-2 text-xs text-slate-800 focus:outline-none focus:ring-1 focus:ring-[var(--brand-primary)]"
                    >
                      <option value="">Select option...</option>
                      <option value="0 to 50">0 to 50</option>
                      <option value="50 to 100">50 to 100</option>
                      <option value="100 Plus">100 Plus</option>
                    </select>
                  </div>

                  <div>
                    <label htmlFor="survey-testing-facility" className="block text-[9px] font-bold text-slate-500 uppercase tracking-wider mb-1">Testing facility availability</label>
                    <select
                      id="survey-testing-facility"
                      value={registrationState.testingFacility || ''}
                      onChange={(e) => setRegistrationState(prev => ({ ...prev, testingFacility: e.target.value }))}
                      className="w-full bg-white border border-slate-200 rounded p-2 text-xs text-slate-800 focus:outline-none focus:ring-1 focus:ring-[var(--brand-primary)]"
                    >
                      <option value="">Select option...</option>
                      <option value="Yes">Yes</option>
                      <option value="No">No</option>
                    </select>
                  </div>

                  <div>
                    <label htmlFor="survey-client-listings" className="block text-[9px] font-bold text-slate-500 uppercase tracking-wider mb-1">Listed client/consultants</label>
                    <select
                      id="survey-client-listings"
                      value={registrationState.clientConsultantListings || ''}
                      onChange={(e) => setRegistrationState(prev => ({ ...prev, clientConsultantListings: e.target.value }))}
                      className="w-full bg-white border border-slate-200 rounded p-2 text-xs text-slate-800 focus:outline-none focus:ring-1 focus:ring-[var(--brand-primary)]"
                    >
                      <option value="">Select option...</option>
                      <option value="0 to 5">0 to 5</option>
                      <option value="5 to 10">5 to 10</option>
                      <option value="10 Plus">10 Plus</option>
                    </select>
                  </div>

                  <div>
                    <label htmlFor="survey-projects-3yr" className="block text-[9px] font-bold text-slate-500 uppercase tracking-wider mb-1">Projects (Last 3 years)</label>
                    <select
                      id="survey-projects-3yr"
                      value={registrationState.projectsLast3Years || ''}
                      onChange={(e) => setRegistrationState(prev => ({ ...prev, projectsLast3Years: e.target.value }))}
                      className="w-full bg-white border border-slate-200 rounded p-2 text-xs text-slate-800 focus:outline-none focus:ring-1 focus:ring-[var(--brand-primary)]"
                    >
                      <option value="">Select option...</option>
                      <option value="0 to 10">0 to 10</option>
                      <option value="10 to 20">10 to 20</option>
                      <option value="20 Plus">20 Plus</option>
                    </select>
                  </div>

                  <div>
                    <label htmlFor="survey-biggest-project" className="block text-[9px] font-bold text-slate-500 uppercase tracking-wider mb-1">Details of biggest project</label>
                    <select
                      id="survey-biggest-project"
                      value={registrationState.biggestProjectValue || ''}
                      onChange={(e) => setRegistrationState(prev => ({ ...prev, biggestProjectValue: e.target.value }))}
                      className="w-full bg-white border border-slate-200 rounded p-2 text-xs text-slate-800 focus:outline-none focus:ring-1 focus:ring-[var(--brand-primary)]"
                    >
                      <option value="">Select option...</option>
                      <option value="0 to 100k">0 to 100k</option>
                      <option value="100k to 500k">100k to 500k</option>
                      <option value="500k Plus">500k Plus</option>
                    </select>
                  </div>

                  <div>
                    <label htmlFor="survey-annual-turnover" className="block text-[9px] font-bold text-slate-500 uppercase tracking-wider mb-1">Annual Turnover</label>
                    <select
                      id="survey-annual-turnover"
                      value={registrationState.annualTurnover || ''}
                      onChange={(e) => setRegistrationState(prev => ({ ...prev, annualTurnover: e.target.value }))}
                      className="w-full bg-white border border-slate-200 rounded p-2 text-xs text-slate-800 focus:outline-none focus:ring-1 focus:ring-[var(--brand-primary)]"
                    >
                      <option value="">Select option...</option>
                      <option value="0 to 10m">0 to 10m</option>
                      <option value="10m to 50m">10m to 50m</option>
                      <option value="50m Plus">50m Plus</option>
                    </select>
                  </div>

                  <div>
                    <label htmlFor="survey-factory-asset" className="block text-[9px] font-bold text-slate-500 uppercase tracking-wider mb-1">Details of factory asset</label>
                    <select
                      id="survey-factory-asset"
                      value={registrationState.factoryAssetValue || ''}
                      onChange={(e) => setRegistrationState(prev => ({ ...prev, factoryAssetValue: e.target.value }))}
                      className="w-full bg-white border border-slate-200 rounded p-2 text-xs text-slate-800 focus:outline-none focus:ring-1 focus:ring-[var(--brand-primary)]"
                    >
                      <option value="">Select option...</option>
                      <option value="0 to 10m">0 to 10m</option>
                      <option value="10m to 50m">10m to 50m</option>
                      <option value="50m Plus">50m Plus</option>
                    </select>
                  </div>
                </div>
              </div>

              {/* Complete & Submit Button */}
              {!(
                registrationState.vendorType &&
                registrationState.surveyProduct &&
                registrationState.yearsInBusiness &&
                registrationState.totalStaff &&
                registrationState.totalLabors &&
                registrationState.totalEngineers &&
                registrationState.testingFacility &&
                registrationState.clientConsultantListings &&
                registrationState.projectsLast3Years &&
                registrationState.biggestProjectValue &&
                registrationState.annualTurnover &&
                registrationState.factoryAssetValue
              ) ? (
                <div className="p-3 bg-amber-50 border border-amber-100 rounded text-[11px] text-amber-700 font-medium">
                  Please answer all survey fields to authorize profile publication.
                </div>
              ) : null}

              <button
                onClick={onSubmitRegistration}
                disabled={
                  isSubmitting ||
                  !(
                    registrationState.vendorType &&
                    registrationState.surveyProduct &&
                    registrationState.yearsInBusiness &&
                    registrationState.totalStaff &&
                    registrationState.totalLabors &&
                    registrationState.totalEngineers &&
                    registrationState.testingFacility &&
                    registrationState.clientConsultantListings &&
                    registrationState.projectsLast3Years &&
                    registrationState.biggestProjectValue &&
                    registrationState.annualTurnover &&
                    registrationState.factoryAssetValue
                  )
                }
                className="w-full bg-slate-900 hover:bg-black disabled:bg-slate-300 disabled:cursor-not-allowed text-white text-xs font-bold py-4 rounded-sm flex items-center justify-center gap-2 transition uppercase tracking-widest pointer-events-auto cursor-pointer"
              >
                <Save className={`w-4 h-4 ${isSubmitting ? 'animate-pulse' : ''}`} />
                <span>{isSubmitting ? 'Sending registration request to TBMS...' : 'Complete & Publish Supplier Registration'}</span>
              </button>
            </div>
          ) : (
            <div className="rounded-[16px] border border-amber-200 bg-[linear-gradient(180deg,rgba(255,248,235,0.98)_0%,rgba(255,244,217,0.92)_100%)] px-3 py-2 text-left shadow-[0_6px_14px_rgba(15,23,42,0.04)]">
              <div className="flex items-start gap-2.5">
                <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-amber-200 bg-white/80 text-amber-500">
                  <Clock className="h-3.5 w-3.5" />
                </div>
                <p className="text-[11px] font-semibold leading-relaxed text-slate-600">

                  Upload or align all 3 required documents. Once the score reaches 100%, you can submit the official application.
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    );
  };

  const renderDocumentDetailsTab = (
    doc: DocumentVerification,
    title: string,
    fieldsDef: Array<{ key: string; label: string }>
  ) => {
    return (
      <div className="space-y-5">
        <div className="flex items-center justify-between border-b border-slate-200 pb-3">
          <h4 className="text-xs font-bold text-slate-900 tracking-wider uppercase">{title} Details</h4>
          {getDocStatusBadge(doc)}
        </div>

        {getEffectiveDocStatus(doc) === 'empty' ? (
          <div className="py-12 text-center text-slate-400 space-y-2">
            <FileText className="w-8 h-8 mx-auto text-slate-300" />
            <p className="text-xs font-bold uppercase tracking-wider text-slate-600">No document uploaded yet</p>
            <p className="text-[11px] text-slate-400">Please chat with the AI Agent or inject a sample sandbox file above.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {/* Scanned/Extracted details */}
            <div className="p-4 bg-slate-50 border border-slate-200 rounded">
              <h5 className="text-[9px] uppercase font-bold text-slate-400 mb-3 tracking-widest">Extracted Compliance Fields</h5>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                {fieldsDef.map((def) => (
                  <div key={def.key} className="border-b border-slate-200 pb-1.5">
                    <span className="block text-[9px] uppercase font-bold text-slate-400">{def.label}:</span>
                    <span className="text-xs font-bold text-slate-800 font-mono">
                      {getExtractedValue(doc, def.key)}
                    </span>
                  </div>
                ))}
              </div>

              {doc.processingTime && (
                <div className="mt-3 inline-flex items-center gap-2 text-[10px] font-bold uppercase tracking-wider px-2.5 py-1 rounded border border-[color:rgba(44,53,97,0.18)] bg-[color:rgba(44,53,97,0.06)] text-[var(--brand-primary)]">
                  Processing Time: {doc.processingTime}
                </div>
              )}
            </div>

            {doc.documentAcceptance && (
              <div className="space-y-3">
                <div className="flex items-center justify-between px-1">
                  <div>
                    <p className="text-[10px] uppercase tracking-widest font-bold text-slate-400">Verification Summary</p>
                    <h5 className="text-sm font-bold text-slate-900 mt-0.5">Decision Summary</h5>
                  </div>
                  {renderAcceptanceBadge(doc)}
                </div>

                <KeyValueTable
                  headerLeft="Item"
                  headerRight="Details"
                  rows={buildDocumentSummaryRows(doc)}
                />
              </div>
            )}

          </div>
        )}

        <button
          onClick={() => setActiveTab('status')}
          className="w-full text-[10px] uppercase tracking-widest bg-slate-100 hover:bg-slate-200 text-slate-850 py-2.5 rounded-sm flex items-center justify-center gap-1.5 transition font-bold"
        >
          <ArrowRight className="w-3.5 h-3.5 rotate-180" />
          <span>Return to Scoreboard</span>
        </button>
      </div>
    );
  };

  return (
    <div className="relative h-[min(600px,calc(100dvh-14rem))] overflow-y-auto overflow-x-hidden rounded-[28px] border border-slate-200 bg-white p-6 text-slate-800 shadow-[0_18px_34px_rgba(15,23,42,0.07)] md:h-[600px] md:p-7">
      <div className="pointer-events-none absolute inset-x-0 top-0 z-20 h-[2px] rounded-r-full bg-gradient-to-r from-[var(--brand-primary)] via-[var(--brand-sky)] to-[var(--brand-sky-accent)] shadow-[0_0_0_1px_rgba(44,53,97,0.04)] md:h-[3px]" />
      {/* Title block */}
      <div className="mb-5 flex items-start justify-between gap-4 border-b border-slate-200 pb-4">
        <div>
          <p className="text-[10px] font-extrabold uppercase tracking-[0.32em] text-slate-400">Real-Time Registration Auditor</p>
          <h3 className="mt-1 text-[17px] font-bold text-[var(--brand-primary)]">Document review and verification</h3>
        </div>
        <div className="rounded-[14px] border border-[color:rgba(44,53,97,0.14)] bg-[color:rgba(44,53,97,0.06)] p-2.5 text-[var(--brand-sky)] shadow-[0_8px_16px_rgba(15,23,42,0.04)]">
          <ShieldCheck className="h-5 w-5" />
        </div>
      </div>

      {/* Tabs list */}
      <div className="mb-5 flex gap-2 overflow-x-auto border-b border-slate-200 text-xs text-slate-400">
        <button
          onClick={() => setActiveTab('status')}
          className={`border-b-2 px-4 pb-3 pt-1 font-extrabold uppercase tracking-[0.22em] transition ${
            activeTab === 'status' ? 'border-[var(--brand-primary)] text-[var(--brand-primary)]' : 'border-transparent hover:text-slate-800'
          }`}
        >
          Scoreboard
        </button>
        <button
          onClick={() => setActiveTab('trade')}
          className={`border-b-2 px-4 pb-3 pt-1 font-extrabold uppercase tracking-[0.22em] transition ${
            activeTab === 'trade' ? 'border-[var(--brand-primary)] text-[var(--brand-primary)]' : 'border-transparent hover:text-slate-800'
          }`}
        >
          License
        </button>
        <button
          onClick={() => setActiveTab('vat')}
          className={`border-b-2 px-4 pb-3 pt-1 font-extrabold uppercase tracking-[0.22em] transition ${
            activeTab === 'vat' ? 'border-[var(--brand-primary)] text-[var(--brand-primary)]' : 'border-transparent hover:text-slate-800'
          }`}
        >
          VAT
        </button>
        <button
          onClick={() => setActiveTab('bank_document')}
          className={`border-b-2 px-4 pb-3 pt-1 font-extrabold uppercase tracking-[0.22em] transition ${
            activeTab === 'bank_document' ? 'border-[var(--brand-primary)] text-[var(--brand-primary)]' : 'border-transparent hover:text-slate-800'
          }`}
        >
          Bank Doc
        </button>
      </div>

      {/* Tabs display */}
      {activeTab === 'status' && renderStatusDashboard()}
      {activeTab === 'trade' && renderDocumentDetailsTab(
        trade_license,
        'Trade License',
        [
          { key: 'licenseNumber', label: 'License Number' },
          { key: 'companyName', label: 'Extracted Company' },
          { key: 'expiryDate', label: 'Expiry Date' },
          { key: 'manager', label: 'Manager / Owner' },
          { key: 'licensedActivities', label: 'Licensed Activities' }
        ]
      )}
      {activeTab === 'vat' && renderDocumentDetailsTab(
        vat_certificate,
        'VAT Certificate',
        [
          { key: 'vatNumber', label: 'VAT Registration No' },
          { key: 'companyName', label: 'Company Name' },
          { key: 'registrationDate', label: 'Registration Date' },
          { key: 'status', label: 'Registration Standing' }
        ]
      )}
      {activeTab === 'bank_document' && renderDocumentDetailsTab(
        bank_document,
        'Official Bank Document',
        [
          { key: 'bankAccountNumber', label: 'Account Number/IBAN' },
          { key: 'bankName', label: 'Financial Institution' },
          { key: 'beneficiaryName', label: 'Beneficiary Name' },
          { key: 'iban', label: 'IBAN Number' }
        ]
      )}
    </div>
  );
}
