import React, { useState } from 'react';
import { ShieldCheck, FileText, AlertTriangle, CheckSquare, Clock, Globe, ArrowRight, Save, Database, UserCheck } from 'lucide-react';
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

  const parseDocumentDateValue = (value?: string) => {
    if (!value) {
      return null;
    }

    const trimmed = value.trim();
    if (!trimmed) {
      return null;
    }

    const isoMatch = trimmed.match(/^(\d{4})[-/](\d{2})[-/](\d{2})$/);
    if (isoMatch) {
      return `${isoMatch[1]}-${isoMatch[2]}-${isoMatch[3]}`;
    }

    const numericMatch = trimmed.match(/^(\d{1,2})[\/-](\d{1,2})[\/-](\d{4})$/);
    if (numericMatch) {
      const day = String(Number(numericMatch[1])).padStart(2, '0');
      const month = String(Number(numericMatch[2])).padStart(2, '0');
      return `${numericMatch[3]}-${month}-${day}`;
    }

    const parsed = new Date(trimmed);
    if (!Number.isNaN(parsed.getTime())) {
      return parsed.toISOString().slice(0, 10);
    }

    return null;
  };

  const isDocumentExpired = (value?: string) => {
    const normalized = parseDocumentDateValue(value);
    if (!normalized) {
      return false;
    }

    return new Date(`${normalized}T00:00:00Z`) < new Date();
  };

  // Perform cross-document validation to make sure naming is fully aligned
  const getDocumentDiscrepancyCheck = () => {
    const findings: string[] = [];
    
    const tradeName = trade_license.extractedData?.companyName;
    const vatName = vat_certificate.extractedData?.companyName;
    const bankDocName = bank_document.extractedData?.companyName;

    if (tradeName && vatName && tradeName.toLowerCase().replace(/[^a-z0-9]/g, '') !== vatName.toLowerCase().replace(/[^a-z0-9]/g, '')) {
      findings.push(`Name Discrepancy: Trade License Name ("${tradeName}") does not match VAT Corporate Name ("${vatName}")`);
    }

    if (tradeName && bankDocName && tradeName.toLowerCase().replace(/[^a-z0-9]/g, '') !== bankDocName.toLowerCase().replace(/[^a-z0-9]/g, '')) {
      findings.push(`Name Discrepancy: Trade License Name ("${tradeName}") does not match Bank Document Beneficiary Name ("${bankDocName}")`);
    }

    // Expiry check
    if (trade_license.extractedData?.expiryDate && isDocumentExpired(trade_license.extractedData.expiryDate)) {
      findings.push(`License Expired: The submitted Trade license expired on ${trade_license.extractedData.expiryDate}`);
    }

    return findings;
  };

  const discrepancies = getDocumentDiscrepancyCheck();

  const getDocStatusBadge = (doc: DocumentVerification) => {
    switch (doc.status) {
      case 'empty':
        return <span className="text-[10px] text-slate-500 bg-slate-100 border border-slate-200 px-2 py-0.5 rounded font-bold uppercase tracking-wider">Missing</span>;
      case 'verifying':
        return <span className="text-[10px] text-indigo-700 bg-indigo-50 border border-indigo-100 px-2 py-0.5 rounded font-bold uppercase tracking-wider animate-pulse">Scanning...</span>;
      case 'ocr_completed':
        return <span className="text-[10px] text-cyan-700 bg-cyan-50 border border-cyan-100 px-2 py-0.5 rounded font-bold uppercase tracking-wider">OCR Extracted</span>;
      case 'registry_check':
        return <span className="text-[10px] text-amber-700 bg-amber-50 border border-amber-100 px-2 py-0.5 rounded font-bold uppercase tracking-wider animate-pulse">Checking...</span>;
      case 'verified':
        return <span className="text-[10px] text-green-700 bg-green-100 border border-green-200 px-2 py-0.5 rounded font-bold uppercase tracking-wider flex items-center gap-1">✓ Verified</span>;
      case 'failed':
        return <span className="text-[10px] text-rose-700 bg-rose-100 border border-rose-200 px-2 py-0.5 rounded font-bold uppercase tracking-wider flex items-center gap-1">✕ Failed</span>;
    }
  };

  const getOverallProgress = () => {
    let completed = 0;
    if (trade_license.status === 'verified') completed += 33.3;
    if (vat_certificate.status === 'verified') completed += 33.3;
    if (bank_document.status === 'verified') completed += 33.4;
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
              <p className="text-[10px] uppercase tracking-widest font-bold text-slate-400">Compliance Audit Score</p>
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
                  <div className={`p-2 rounded ${doc.status === 'verified' ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-500'}`}>
                    <FileText className="w-4 h-4" />
                  </div>
                  <div>
                    <p className="text-xs font-bold text-slate-900">{label}</p>
                    <p className="text-[10px] text-slate-400 font-mono mt-0.5">
                      {doc.extractedData ? `No: ${Object.values(doc.extractedData)[0] || 'Unknown'}` : 'Not provided yet'}
                    </p>
                  </div>
                </div>
                {getDocStatusBadge(doc)}
              </button>
            ))}
          </div>
        </div>

        {/* Alert discrepancies if any exist */}
        {discrepancies.length > 0 && (
          <div className="p-4 bg-rose-50 border border-rose-200 rounded text-rose-800 space-y-2 shadow-sm">
            <div className="flex items-center gap-2 text-rose-700 font-bold text-xs uppercase tracking-wider">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              <span>Cross-Document Discrepancy Warnings</span>
            </div>
            <ul className="list-disc pl-5 text-[11px] space-y-1.5 leading-relaxed text-rose-700/90 font-medium">
              {discrepancies.map((disc, idx) => (
                <li key={idx}>{disc}</li>
              ))}
            </ul>
          </div>
        )}

        {/* Registry compliance statement & action trigger */}
        <div className="pt-4 border-t border-slate-200">
          {score === 100 && discrepancies.length === 0 ? (
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
                    <label htmlFor="survey-biggest-project" className="block text-[9px] font-bold text-slate-500 uppercase tracking-wider mb-1">Value of biggest project</label>
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
                    <label htmlFor="survey-factory-asset" className="block text-[9px] font-bold text-slate-500 uppercase tracking-wider mb-1">Value of factory asset</label>
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
    fieldsDef: Array<{ key: string; label: string }>,
    headerBadge?: React.ReactNode
  ) => {
    return (
      <div className="space-y-5">
        <div className="flex items-center justify-between border-b border-slate-200 pb-3">
          <div className="flex items-center gap-2 flex-wrap">
            <h4 className="text-xs font-bold text-slate-900 tracking-wider uppercase">{title} Details</h4>
            {headerBadge}
          </div>
          {getDocStatusBadge(doc)}
        </div>

        {doc.status === 'empty' ? (
          <div className="py-12 text-center text-slate-400 space-y-2">
            <FileText className="w-8 h-8 mx-auto text-slate-300" />
            <p className="text-xs font-bold uppercase tracking-wider text-slate-600">No document uploaded yet</p>
            <p className="text-[11px] text-slate-400">Please chat with the AI Agent or inject a sample sandbox file above.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {/* Scanned/Extracted details */}
            <div className="p-4 bg-slate-50 border border-slate-200 rounded">
              <h5 className="text-[9px] uppercase font-bold text-slate-400 mb-3 tracking-widest">Extracted Fields via Gemini OCR</h5>
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
            </div>


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
        <p className="text-xs text-slate-400 mt-0.5">Automated document analysis & identity checks</p>
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
        ],
        trade_license.extractedData?.expiryDate && isDocumentExpired(trade_license.extractedData.expiryDate) ? (
          <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-1 rounded border border-rose-200 bg-rose-50 text-rose-700">
            Expired on {trade_license.extractedData.expiryDate}
          </span>
        ) : null
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
