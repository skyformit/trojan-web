import React, { useState } from 'react';
import { ShieldCheck, FileText, CheckSquare, Clock, Globe, ArrowRight, Save, Database, UserCheck } from 'lucide-react';
import { SupplierRegistrationState, DocumentVerification } from '../types';

interface VerificationPanelProps {
  registrationState: SupplierRegistrationState;
  setRegistrationState: React.Dispatch<React.SetStateAction<SupplierRegistrationState>>;
  onSubmitRegistration: () => void;
}

export default function VerificationPanel({
  registrationState,
  setRegistrationState,
  onSubmitRegistration
}: VerificationPanelProps) {
  const { trade_license, vat_certificate, bank_document } = registrationState.documents;
  const [activeTab, setActiveTab] = useState<'status' | 'trade' | 'vat' | 'bank_document'>('status');

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
      return <span className="text-[10px] text-emerald-700 bg-emerald-100 border border-emerald-200 px-2 py-0.5 rounded font-bold uppercase tracking-wider">Approved</span>;
    }
    if (normalized === 'review') {
      return <span className="text-[10px] text-amber-700 bg-amber-100 border border-amber-200 px-2 py-0.5 rounded font-bold uppercase tracking-wider">Review</span>;
    }
    if (normalized === 'expired') {
      return <span className="text-[10px] text-rose-700 bg-rose-100 border border-rose-200 px-2 py-0.5 rounded font-bold uppercase tracking-wider">Expired</span>;
    }
    if (normalized === 'rejected') {
      return <span className="text-[10px] text-rose-700 bg-rose-100 border border-rose-200 px-2 py-0.5 rounded font-bold uppercase tracking-wider">Rejected</span>;
    }
    return <span className="text-[10px] text-slate-600 bg-slate-100 border border-slate-200 px-2 py-0.5 rounded font-bold uppercase tracking-wider">Unknown</span>;
  };

  const getDocumentSummaryDetails = (doc: DocumentVerification) => {
    if (doc.type === 'bank_document') {
      return (
        doc.extractedData?.companyName ||
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
        return <span className="text-[10px] text-slate-500 bg-slate-100 border border-slate-200 px-2 py-0.5 rounded font-bold uppercase tracking-wider">Missing</span>;
      case 'verifying':
        return <span className="text-[10px] text-indigo-700 bg-indigo-50 border border-indigo-100 px-2 py-0.5 rounded font-bold uppercase tracking-wider animate-pulse">Scanning...</span>;
      case 'ocr_completed':
        return <span className="text-[10px] text-cyan-700 bg-cyan-50 border border-cyan-100 px-2 py-0.5 rounded font-bold uppercase tracking-wider">OCR Extracted</span>;
      case 'registry_check':
        return <span className="text-[10px] text-amber-700 bg-amber-50 border border-amber-100 px-2 py-0.5 rounded font-bold uppercase tracking-wider animate-pulse">Checking...</span>;
      case 'review':
        return <span className="text-[10px] text-amber-700 bg-amber-50 border border-amber-100 px-2 py-0.5 rounded font-bold uppercase tracking-wider flex items-center gap-1">Review</span>;
      case 'expired':
        return <span className="text-[10px] text-rose-700 bg-rose-50 border border-rose-200 px-2 py-0.5 rounded font-bold uppercase tracking-wider flex items-center gap-1">Expired</span>;
      case 'verified':
        return <span className="text-[10px] text-green-700 bg-green-100 border border-green-200 px-2 py-0.5 rounded font-bold uppercase tracking-wider flex items-center gap-1">✓ Verified</span>;
      case 'failed':
        return <span className="text-[10px] text-rose-700 bg-rose-100 border border-rose-200 px-2 py-0.5 rounded font-bold uppercase tracking-wider flex items-center gap-1">✕ Failed</span>;
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

  const renderStatusDashboard = () => {
    return (
      <div className="space-y-6">
        {/* Core summary card */}
        <div className="bg-slate-50 p-6 rounded-lg border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <div>
              <p className="text-[10px] uppercase tracking-widest font-bold text-slate-400">Overall Decision</p>
              <h3 className="text-2xl font-black text-slate-900 font-sans mt-1">{score}% Validated</h3>
            </div>
            <div className={`p-3 rounded border ${score === 100 ? 'bg-green-100 border-green-200 text-green-700' : 'bg-white border-slate-200 text-slate-500'}`}>
              <ShieldCheck className="w-7 h-7" />
            </div>
          </div>

          <div className="w-full bg-slate-200 h-2 rounded-full overflow-hidden mb-2">
            <div 
              className={`h-full transition-all duration-700 ${score === 100 ? 'bg-emerald-500' : 'bg-indigo-600'}`}
              style={{ width: `${score}%` }}
            />
          </div>
          <div className="flex items-center justify-between text-[10px] text-slate-400 font-bold uppercase tracking-wider">
            <span>Pending Setup</span>
            <span>Compliance Match</span>
          </div>
        </div>

        {/* Contact & Notification Settings Status */}
        <div className="bg-white border border-slate-200 rounded-lg p-4 shadow-sm space-y-3">
          <h4 className="text-[10px] font-bold text-indigo-600 uppercase tracking-widest flex items-center gap-2">
            <UserCheck className="w-3.5 h-3.5 text-indigo-500" /> Authorized Representative
          </h4>
          
          {registrationState.contactName ? (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
              <div className="bg-slate-50 p-2.5 rounded border border-slate-100 overflow-hidden">
                <span className="block text-[8px] uppercase tracking-wider text-slate-400 font-bold">Full Name</span>
                <span className="font-bold text-slate-800 truncate block mt-0.5">{registrationState.contactName}</span>
              </div>
              <div className="bg-slate-50 p-2.5 rounded border border-slate-100 overflow-hidden">
                <span className="block text-[8px] uppercase tracking-wider text-slate-400 font-bold">Notification Email</span>
                <span className="font-semibold text-indigo-600 truncate block mt-0.5" title={registrationState.contactEmail}>{registrationState.contactEmail || 'N/A'}</span>
              </div>
              <div className="bg-slate-50 p-2.5 rounded border border-slate-100 overflow-hidden">
                <span className="block text-[8px] uppercase tracking-wider text-slate-400 font-bold">Mobile/SMS Contact</span>
                <span className="font-mono font-medium text-slate-700 truncate block mt-0.5">{registrationState.phoneNumber || 'N/A'}</span>
              </div>
            </div>
          ) : (
            <p className="text-[11px] text-slate-400 italic">No notification settings filed. We'll collect configuration details in Step 2 of the AI Agent chat.</p>
          )}
        </div>

        {/* Compliance Checklist status breakdown */}
        <div className="space-y-3">
          <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest flex items-center gap-2">
            <Database className="w-3.5 h-3.5 text-slate-400" /> Required Identification Badges
          </h4>
          
          <div className="grid grid-cols-1 gap-2">
            {([
              { doc: trade_license, tab: 'trade', label: 'Commercial Trade License', key: 'trade_license', id: 'TL' },
              { doc: vat_certificate, tab: 'vat', label: 'VAT Registration Ledger', key: 'vat_certificate', id: 'VAT' },
              { doc: bank_document, tab: 'bank_document', label: 'Authorized Bank Document', key: 'bank_document', id: 'BANK' }
            ] as const).map(({ doc, tab, label, id }) => (
              <button
                key={id}
                onClick={() => setActiveTab(tab)}
                className="flex items-center justify-between text-left p-4 bg-white hover:bg-slate-50 border border-slate-200 hover:border-slate-300 rounded-lg shadow-sm transition"
              >
                <div className="flex items-center gap-3">
                  <div className={`p-2 rounded ${getEffectiveDocStatus(doc) === 'verified' ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-500'}`}>
                    <FileText className="w-4 h-4" />
                  </div>
                  <div>
                    <p className="text-xs font-bold text-slate-900">{label}</p>
                    <p className="text-[10px] text-slate-400 font-mono mt-0.5">
                      {doc.extractedData
                        ? doc.type === 'bank_document'
                          ? `Bank Holder Name: ${getDocumentSummaryDetails(doc)}`
                          : doc.type === 'vat_certificate'
                            ? `VAT Registration No: ${getDocumentSummaryDetails(doc)}`
                            : `Trade License No: ${getDocumentSummaryDetails(doc)}`
                        : 'Not provided yet'}
                    </p>
                    {doc.type === 'trade_license' && doc.extractedData?.tradeName && (
                      <p className="text-[10px] text-slate-500 font-mono mt-0.5">
                        Trade Name: {doc.extractedData.tradeName}
                      </p>
                    )}
                    {doc.documentAcceptance?.status && (
                      <p className="text-[10px] text-slate-500 font-mono mt-0.5">
                        Acceptance: {doc.documentAcceptance.is_expired ? 'expired' : doc.documentAcceptance.status}
                      </p>
                    )}
                    {doc.processingTime && (
                      <p className="text-[9px] text-indigo-600 font-bold uppercase tracking-wider mt-0.5">
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
        <div className="pt-4 border-t border-slate-200">
          {score === 100 ? (
            <div className="space-y-5">
              <div className="p-4 bg-green-50 border border-green-150 rounded-lg text-xs text-green-800 leading-relaxed font-sans shadow-xs">
                <div className="flex items-center gap-2 mb-1.5 font-bold text-green-700 uppercase tracking-wider text-[10px]">
                  <UserCheck className="w-4 h-4 text-green-600" />
                  <span>Onboarding Credentials Approved</span>
                </div>
                AI Agent validation confirms that all document IDs are globally validated. Under Trojan General Contracting onboarding protocol, please complete the commercial and operational survey below to publish your submission.
              </div>

              {/* Infrastructure & Capabilities Survey Section */}
              <div id="registration-survey-form" className="bg-slate-50 border border-slate-200 rounded-lg p-5 space-y-4">
                <div className="flex items-center justify-between border-b border-slate-200 pb-2">
                  <span className="text-[11px] font-extrabold text-slate-800 uppercase tracking-wider">Business Profile & Capacity</span>
                  <button
                    type="button"
                    onClick={() => {
                      setRegistrationState(prev => ({
                        ...prev,
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
                    className="text-[9px] text-indigo-600 font-bold uppercase tracking-widest hover:text-indigo-800 transition-colors pointer-events-auto cursor-pointer"
                  >
                    ⚡ Fast Prefill Answers
                  </button>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                  <div>
                    <label htmlFor="survey-years-in-business" className="block text-[9px] font-bold text-slate-500 uppercase tracking-wider mb-1">Years in business</label>
                    <select
                      id="survey-years-in-business"
                      value={registrationState.yearsInBusiness || ''}
                      onChange={(e) => setRegistrationState(prev => ({ ...prev, yearsInBusiness: e.target.value }))}
                      className="w-full bg-white border border-slate-200 rounded p-2 text-xs text-slate-800 focus:outline-none focus:ring-1 focus:ring-indigo-500"
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
                      className="w-full bg-white border border-slate-200 rounded p-2 text-xs text-slate-800 focus:outline-none focus:ring-1 focus:ring-indigo-500"
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
                      className="w-full bg-white border border-slate-200 rounded p-2 text-xs text-slate-800 focus:outline-none focus:ring-1 focus:ring-indigo-500"
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
                      className="w-full bg-white border border-slate-200 rounded p-2 text-xs text-slate-800 focus:outline-none focus:ring-1 focus:ring-indigo-500"
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
                      className="w-full bg-white border border-slate-200 rounded p-2 text-xs text-slate-800 focus:outline-none focus:ring-1 focus:ring-indigo-500"
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
                      className="w-full bg-white border border-slate-200 rounded p-2 text-xs text-slate-800 focus:outline-none focus:ring-1 focus:ring-indigo-500"
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
                      className="w-full bg-white border border-slate-200 rounded p-2 text-xs text-slate-800 focus:outline-none focus:ring-1 focus:ring-indigo-500"
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
                      className="w-full bg-white border border-slate-200 rounded p-2 text-xs text-slate-800 focus:outline-none focus:ring-1 focus:ring-indigo-500"
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
                      className="w-full bg-white border border-slate-200 rounded p-2 text-xs text-slate-800 focus:outline-none focus:ring-1 focus:ring-indigo-500"
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
                      className="w-full bg-white border border-slate-200 rounded p-2 text-xs text-slate-800 focus:outline-none focus:ring-1 focus:ring-indigo-500"
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
                  !(
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
                <Save className="w-4 h-4" />
                <span>Complete & Publish Supplier Registration</span>
              </button>
            </div>
          ) : (
            <div className="p-5 bg-slate-50 rounded border border-slate-200 text-slate-500 text-xs text-center space-y-1">
              <Clock className="w-5 h-5 mx-auto mb-2 text-slate-400" />
              <p className="font-bold text-slate-700 uppercase tracking-widest text-[10px]">File Incomplete or Flagged</p>
              <p className="text-[11px] text-slate-500 leading-relaxed font-medium">
                Provide or align all 3 required documents. Once the score reaches 100%, you can submit the official application.
              </p>
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
                      {doc.extractedData?.[def.key] || (def.key === 'vatNumber' ? doc.extractedData?.taxRegistrationNumber : '') || 'N/A'}
                    </span>
                  </div>
                ))}
              </div>

              {doc.processingTime && (
                <div className="mt-3 inline-flex items-center gap-2 text-[10px] font-bold uppercase tracking-wider px-2.5 py-1 rounded border border-indigo-200 bg-indigo-50 text-indigo-700">
                  Processing Time: {doc.processingTime}
                </div>
              )}
            </div>

            {doc.documentAcceptance && (
              <div className="overflow-hidden rounded-lg border border-slate-200 bg-white">
                <div className="flex items-center justify-between px-4 py-3 border-b border-slate-200 bg-slate-50">
                <div>
                    <p className="text-[10px] uppercase tracking-widest font-bold text-slate-400">Verification Summary</p>
                    <h5 className="text-sm font-bold text-slate-900 mt-0.5">Decision Summary</h5>
                  </div>
                  {renderAcceptanceBadge(doc)}
                </div>

                <div className="grid grid-cols-2 bg-slate-50 text-[10px] uppercase tracking-widest text-slate-500 font-bold border-b border-slate-200">
                  <div className="px-3 py-2 border-r border-slate-200">Item</div>
                  <div className="px-3 py-2">Details</div>
                </div>

                {(() => {
                  const acceptanceStatus = String(doc.documentAcceptance.status || '').toLowerCase();
                  const displayStatus = getAcceptanceDisplayStatus(doc);
                  const notesLabel = displayStatus === 'rejected'
                    ? 'Rejection Notes'
                    : displayStatus === 'expired'
                      ? 'Expiration Notes'
                      : acceptanceStatus === 'review'
                      ? 'Review Notes'
                      : 'Approval Notes';
                  const notes = Array.isArray(doc.documentAcceptance.reasons)
                    ? doc.documentAcceptance.reasons.map(reason => formatAcceptanceReasonText(String(reason)))
                    : [];

                  return [
                    ['Document Type', formatAcceptanceValue(doc.documentAcceptance.document_type)],
                    ['Final Decision', formatAcceptanceValue(displayStatus || doc.documentAcceptance.status)],
                    ['Decision Score', formatAcceptanceValue(doc.documentAcceptance.score)],
                    ['Missing Fields', formatAcceptanceValue(formatMissingFieldLabels(doc.documentAcceptance.missing_fields))],
                    [notesLabel, notes],
                    ['Expiry Date', formatAcceptanceValue(doc.documentAcceptance.expiry_date)],
                    ['Expired', formatAcceptanceValue(doc.documentAcceptance.is_expired)],
                    ['Ready for Approval', formatAcceptanceValue(doc.documentAcceptance.acceptable)],
                  ] as Array<[string, unknown]>;
                })().map(([label, value]) => (
                  <div key={label} className="grid grid-cols-2 text-xs border-b border-slate-100 last:border-b-0">
                    <div className="px-3 py-2 font-semibold text-slate-600 bg-slate-50 border-r border-slate-100">
                      {label}
                    </div>
                    <div className="px-3 py-2 text-slate-800 break-words">
                      {Array.isArray(value) ? (
                        <ul className="space-y-1 list-disc list-inside">
                          {value.map((reason, index) => (
                            <li key={`${label}-${index}`}>{reason}</li>
                          ))}
                        </ul>
                      ) : (
                        value
                      )}
                    </div>
                  </div>
                ))}
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
    <div className="bg-white border border-slate-200 rounded-lg p-6 text-slate-800 h-[600px] overflow-y-auto shadow-sm">
      {/* Title block */}
      <div className="mb-4">
        <h3 className="text-sm font-bold uppercase tracking-widest text-slate-900">Real-Time Registration Auditor</h3>
        <p className="text-xs text-slate-400 mt-0.5">Document review and verification</p>
      </div>

      {/* Tabs list */}
      <div className="flex border-b border-slate-200 mb-5 text-xs text-slate-400 gap-1 overflow-x-auto">
        <button
          onClick={() => setActiveTab('status')}
          className={`pb-2 px-3 font-bold uppercase tracking-wider transition ${
            activeTab === 'status' ? 'text-indigo-600 border-b-2 border-indigo-600' : 'hover:text-slate-800'
          }`}
        >
          Scoreboard
        </button>
        <button
          onClick={() => setActiveTab('trade')}
          className={`pb-2 px-3 font-bold uppercase tracking-wider transition ${
            activeTab === 'trade' ? 'text-indigo-600 border-b-2 border-indigo-600' : 'hover:text-slate-800'
          }`}
        >
          License
        </button>
        <button
          onClick={() => setActiveTab('vat')}
          className={`pb-2 px-3 font-bold uppercase tracking-wider transition ${
            activeTab === 'vat' ? 'text-indigo-600 border-b-2 border-indigo-600' : 'hover:text-slate-800'
          }`}
        >
          VAT
        </button>
        <button
          onClick={() => setActiveTab('bank_document')}
          className={`pb-2 px-3 font-bold uppercase tracking-wider transition ${
            activeTab === 'bank_document' ? 'text-indigo-600 border-b-2 border-indigo-600' : 'hover:text-slate-800'
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
          { key: 'companyName', label: 'Beneficiary Name' },
          { key: 'status', label: 'Account Standing' }
        ]
      )}
    </div>
  );
}
