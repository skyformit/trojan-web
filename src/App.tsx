import React, { useState } from 'react';
import { 
  Building2, 
  ShieldCheck, 
  HelpCircle, 
  CheckCircle2, 
  Server, 
  Sparkles, 
  ArrowRight,
  Database,
  Building,
  Check,
  Globe,
  Mail,
  Phone,
  AlertCircle,
  Upload
} from 'lucide-react';
import { SupplierRegistrationState, ChatMessage, DocumentVerification } from './types';
import AIAgentChat from './components/AIAgentChat';
import VerificationPanel from './components/VerificationPanel';
import { streamChatMessage } from './utils/chatStream';
import TrojanLogo from './components/TrojanLogo';

function getDisplayOcrName(extracted: Record<string, any>) {
  return (
    extracted?.tradeName ||
    extracted?.companyName ||
    extracted?.legalNameEnglish ||
    extracted?.businessName ||
    'N/A'
  );
}

function getDisplayTradeName(extracted: Record<string, any>) {
  return extracted?.tradeName || 'N/A';
}

function getResultValue(results: Record<string, { value?: string }>, keys: string[]) {
  for (const key of keys) {
    const value = results?.[key]?.value?.trim();
    if (value) {
      return value;
    }
  }

  return '';
}

function formatMissingFieldLabel(field: string) {
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
    qr_code: 'QR Code',
  };

  return labelMap[normalized] || normalized.replace(/_/g, ' ').replace(/\b\w/g, ch => ch.toUpperCase());
}

function formatMissingFieldLabels(fields: string[]) {
  return fields.map(formatMissingFieldLabel);
}

function normalizeCompanyName(value: string) {
  return value
    .toLowerCase()
    .replace(/[\(\)\[\],.;\-_/]/g, ' ')
    .replace(/\b(l\s*\.?\s*l\s*\.?\s*c|llc|ltd|limited|corp|corporation|co|company|sole\s+proprietorship|proprietorship|establishment|branch|inc)\b/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function companyNamesMatch(left: string, right: string) {
  const normalizedLeft = normalizeCompanyName(left);
  const normalizedRight = normalizeCompanyName(right);
  return Boolean(normalizedLeft && normalizedRight && normalizedLeft === normalizedRight);
}

function mergeOcrExtraction(analyzeData: any, documentType: 'trade_license' | 'vat_certificate' | 'bank_document') {
  const rawResults = analyzeData?.results || analyzeData?.rawResponse?.results || {};
  const normalized = analyzeData?.extractedData || {};
  const tradeName = getResultValue(rawResults, ['TradeName', 'CompanyName', 'OperatingName', 'LegalNameEnglish', 'BusinessName']);
  const companyName = tradeName || normalized.companyName || normalized.tradeName || '';

  if (documentType === 'vat_certificate') {
    const vatNumber = getResultValue(rawResults, [
      'UnifiedRegistrationNo',
      'UnifiedLicenceNo',
      'VATNumber',
      'VatNumber',
      'TaxRegistrationNumber',
      'RegistrationNumber'
    ]);

    return {
      ...normalized,
      tradeName,
      companyName,
      vatNumber: normalized.vatNumber || vatNumber,
      taxRegistrationNumber: normalized.taxRegistrationNumber || vatNumber,
      issueDate: normalized.issueDate || getResultValue(rawResults, ['IssueDate', 'RegistrationDate']),
      expiryDate: normalized.expiryDate || getResultValue(rawResults, ['ExpiryDate']),
      activity: normalized.activity || getResultValue(rawResults, ['LicenceActivities', 'LicensedActivities', 'Activity']),
      licensedActivities: normalized.licensedActivities || getResultValue(rawResults, ['LicenceActivities', 'LicensedActivities', 'Activity']),
      officialEmail: getResultValue(rawResults, ['OfficialEmail']),
      officialMobile: getResultValue(rawResults, ['OfficialMobile']),
    };
  }

  if (documentType === 'bank_document') {
    return {
      ...normalized,
      tradeName: normalized.tradeName || tradeName,
      companyName: normalized.companyName || tradeName,
      bankAccountNumber: normalized.bankAccountNumber || getResultValue(rawResults, ['BankAccountNumber', 'AccountNumber', 'IBAN']),
      bankName: normalized.bankName || getResultValue(rawResults, ['BankName', 'Bank']),
      iban: normalized.iban || getResultValue(rawResults, ['IBAN']),
      accountName: normalized.accountName || getResultValue(rawResults, ['AccountName']),
    };
  }

  return {
    ...normalized,
    tradeName: normalized.tradeName || tradeName,
    companyName: normalized.companyName || tradeName,
    businessName: normalized.businessName || getResultValue(rawResults, ['BusinessName']),
    legalNameEnglish: normalized.legalNameEnglish || getResultValue(rawResults, ['LegalNameEnglish']),
    licenseNumber:
      normalized.licenseNumber ||
      getResultValue(rawResults, ['LicenceNo', 'LicenseNo', 'LicenseNumber', 'UnifiedLicenceNo', 'UnifiedRegistrationNo']),
    issueDate: normalized.issueDate || getResultValue(rawResults, ['IssueDate']),
    expiryDate: normalized.expiryDate || getResultValue(rawResults, ['ExpiryDate']),
    activity: normalized.activity || getResultValue(rawResults, ['LicenceActivities', 'LicensedActivities', 'Activity']),
    licensedActivities: normalized.licensedActivities || getResultValue(rawResults, ['LicenceActivities', 'LicensedActivities', 'Activity']),
    manager: normalized.manager || getResultValue(rawResults, ['Manager', 'AuthorizedSignatory']),
    officialEmail: getResultValue(rawResults, ['OfficialEmail']),
    officialMobile: getResultValue(rawResults, ['OfficialMobile']),
  };
}

const initialRegistrationState: SupplierRegistrationState = {
  companyName: '',
  contactName: '',
  contactEmail: '',
  phoneNumber: '',
  country: '',
  workflowStatus: undefined,
  workflowRoute: '',
  workflowName: '',
  workflowApiPath: '',
  documents: {
    trade_license: { type: 'trade_license', fileName: '', uploadedAt: '', status: 'empty', validationLogs: [] },
    vat_certificate: { type: 'vat_certificate', fileName: '', uploadedAt: '', status: 'empty', validationLogs: [] },
    bank_document: { type: 'bank_document', fileName: '', uploadedAt: '', status: 'empty', validationLogs: [] }
  },
  registryChecks: {
    tradeLicenseVerified: false,
    vatVerified: false,
    bankDocumentVerified: false
  },
  currentStep: 'initial',
  status: 'draft',
  yearsInBusiness: '',
  totalStaff: '',
  totalLabors: '',
  totalEngineers: '',
  testingFacility: '',
  clientConsultantListings: '',
  projectsLast3Years: '',
  biggestProjectValue: '',
  annualTurnover: '',
  factoryAssetValue: ''
};

export default function App() {
  const [registrationState, setRegistrationState] = useState<SupplierRegistrationState>(initialRegistrationState);
  const [chatHistory, setChatHistory] = useState<ChatMessage[]>([]);
  const [registryRecords, setRegistryRecords] = useState<any[]>([]);
  const [showRegistryDrawer, setShowRegistryDrawer] = useState(false);
  const [submissionComplete, setSubmissionComplete] = useState(false);

  // Fetch sandbox records from server to display in helper drawer
  const fetchRegistryRecords = async () => {
    try {
      const res = await fetch('/api/government-records');
      const data = await res.json();
      if (data.status === 'success') {
        setRegistryRecords(data.records);
        setShowRegistryDrawer(true);
      }
    } catch (err) {
      console.error("Failed to load official sandbox tables:", err);
    }
  };

  // Automated document scanning & government lookup cascade orchestration
  const handleAnalyzeDocument = async (
    type: 'trade_license' | 'vat_certificate' | 'bank_document',
    fileBase64: string | null,
    mimeType: string,
    isPresetSample?: { companyName: string }
  ) => {
    // 1. Mark status as verifying, and log the scanning kickoff
    setRegistrationState(prev => {
      const doc = prev.documents[type];
      return {
        ...prev,
        documents: {
          ...prev.documents,
          [type]: {
            ...doc,
            status: 'verifying',
            fileName: isPresetSample ? `preset_${type}_sample.svg` : 'uploaded_file.' + mimeType.split('/')[1],
            uploadedAt: new Date().toLocaleTimeString(),
            validationLogs: [
              `Kickoff audit protocol: OCR visual analysis matching.`,
              `Triggering Gemini AI (gemini-3.5-flash) visual metadata scanner...`
            ]
          }
        }
      };
    });

    try {
      // 2. Call the Express backend to run Gemini OCR extraction
      const analyzeRes = await fetch('/api/analyze-document', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          documentType: type,
          fileBase64,
          mimeType,
          isPresetSample
        })
      });

      const analyzeData = await analyzeRes.json();
      if (!analyzeRes.ok || analyzeData.status !== 'success') {
        throw new Error(analyzeData.message || 'Image AI scanning phase failed.');
      }

      const extracted = mergeOcrExtraction(analyzeData, type);
      console.log("OCR Extracted values:", extracted);
      const documentAcceptance = analyzeData.documentAcceptance || analyzeData.rawResponse?.document_acceptance || null;
      const ocrResults = analyzeData.results || analyzeData.rawResponse?.results || {};
      const qrCodes = Array.isArray(analyzeData.rawResponse?.qr_codes?.value)
        ? analyzeData.rawResponse.qr_codes.value
        : Array.isArray(analyzeData.qr_codes?.value)
          ? analyzeData.qr_codes.value
          : [];
      const enteredCompanyName = registrationState.companyName || '';
      const extractedCompanyName = getDisplayOcrName(extracted);
      const companyNameAligned =
        !enteredCompanyName ||
        !extractedCompanyName ||
        companyNamesMatch(enteredCompanyName, extractedCompanyName);
      const companyMismatchReason = !companyNameAligned
        ? `Company name mismatch. Entered: "${enteredCompanyName}". OCR: "${extractedCompanyName}".`
        : '';
      const acceptanceStatus = String(documentAcceptance?.status || (documentAcceptance?.acceptable ? 'approved' : '')).toLowerCase();
      const missingFields = Array.isArray(documentAcceptance?.missing_fields)
        ? documentAcceptance.missing_fields
        : [];
      const missingFieldLabels = formatMissingFieldLabels(missingFields);
      const decisionLabel =
        companyNameAligned && acceptanceStatus === 'approved'
          ? 'APPROVED'
          : companyNameAligned && acceptanceStatus === 'review'
            ? 'REVIEW'
            : 'REJECTED';
      const effectiveDocumentAcceptance = companyNameAligned
        ? documentAcceptance
        : {
            ...(documentAcceptance || {}),
            status: 'rejected',
            acceptable: false,
            reasons: [
              ...(Array.isArray(documentAcceptance?.reasons) ? documentAcceptance.reasons : []),
              companyMismatchReason,
            ].filter(Boolean),
          };
      const bankQrRequired = type === 'bank_document' && qrCodes.length === 0;
      const bankQrReason = 'QR code is required for bank documents.';
      const qrEnforcedDocumentAcceptance = bankQrRequired
        ? {
            ...(effectiveDocumentAcceptance || {}),
            status: 'rejected',
            acceptable: false,
            missing_fields: Array.from(new Set([
              ...((effectiveDocumentAcceptance as any)?.missing_fields || []),
              'qr_code',
            ])),
            reasons: [
              ...((effectiveDocumentAcceptance as any)?.reasons || []),
              bankQrReason,
            ].filter(Boolean),
          }
        : effectiveDocumentAcceptance;
      const effectiveFinalStatus: DocumentVerification['status'] =
        bankQrRequired
          ? 'failed'
          : companyNameAligned && acceptanceStatus === 'approved'
            ? 'verified'
            : companyNameAligned && acceptanceStatus === 'review'
              ? 'review'
              : 'failed';

      // 3. Mark OCR success and prompt the registry check starting
      setRegistrationState(prev => {
        const doc = prev.documents[type];
        return {
          ...prev,
          documents: {
            ...prev.documents,
            [type]: {
              ...doc,
              status: 'ocr_completed',
              extractedData: extracted,
              ocrResults,
              documentAcceptance: qrEnforcedDocumentAcceptance,
              processingTimeMs: analyzeData.processingTimeMs,
              processingTime: analyzeData.processingTime,
              validationLogs: [
                ...doc.validationLogs,
                `Clean fields successfully populated.`,
                `Processing Time: ${analyzeData.processingTime || (typeof analyzeData.processingTimeMs === 'number' ? `${(analyzeData.processingTimeMs / 1000).toFixed(2)}s` : 'N/A')}`,
                `Trade Name parsed: "${getDisplayTradeName(extracted)}"`,
                `Company Name matched: "${getDisplayOcrName(extracted)}"`,
                `Identification ID parsed: "${Object.values(extracted)[0] || 'N/A'}"`,
                `Acceptance Decision: ${decisionLabel}`,
                !companyNameAligned ? `Company name mismatch: ${companyMismatchReason}` : 'Company name aligned.',
                missingFieldLabels.length > 0 ? `Missing mandatory fields: ${missingFieldLabels.join(', ')}` : 'No mandatory fields missing.',
                ...(Array.isArray(qrEnforcedDocumentAcceptance?.reasons) && qrEnforcedDocumentAcceptance.reasons.length > 0
                  ? qrEnforcedDocumentAcceptance.reasons.map((reason: string) => `Acceptance reason: ${reason}`)
                  : [])
              ]
            }
          }
        };
      });

      // Quick visual delay transition to registry verification
      await new Promise(resolve => setTimeout(resolve, 1000));

      if (effectiveFinalStatus === 'review') {
        setRegistrationState(prev => {
          const doc = prev.documents[type];
          return {
            ...prev,
            documents: {
              ...prev.documents,
              [type]: {
                ...doc,
                status: 'review',
              }
            }
          };
        });
      } else {
        setRegistrationState(prev => {
          const doc = prev.documents[type];
          return {
            ...prev,
            documents: {
              ...prev.documents,
              [type]: {
                ...doc,
                status: effectiveFinalStatus,
              }
            }
          };
        });
      }

      setRegistrationState(prev => {
        const doc = prev.documents[type];
        const updatedDoc: DocumentVerification = {
          ...doc,
          status: effectiveFinalStatus,
          registryMatch: {
            matched: effectiveFinalStatus === 'verified',
            registeredName: getDisplayOcrName(extracted),
            status: effectiveFinalStatus === 'verified' ? 'ACTIVE' : 'NOT_FOUND',
            details: qrEnforcedDocumentAcceptance
              ? `Document acceptance status: ${decisionLabel}.`
              : 'Document acceptance response unavailable.',
          },
          documentAcceptance: qrEnforcedDocumentAcceptance,
          validationLogs: [
            ...doc.validationLogs,
            `Document Acceptance Decision: ${decisionLabel}`,
            qrEnforcedDocumentAcceptance?.document_type ? `Document Type: ${qrEnforcedDocumentAcceptance.document_type}` : 'Document Type: N/A',
            !companyNameAligned ? `Company name mismatch: ${companyMismatchReason}` : 'Company name aligned.',
            bankQrRequired ? `QR code is missing for bank document.` : 'QR code check passed.',
            missingFieldLabels.length > 0 ? `Missing mandatory fields: ${missingFieldLabels.join(', ')}` : 'Missing mandatory fields: none',
            ...(Array.isArray(qrEnforcedDocumentAcceptance?.reasons) && qrEnforcedDocumentAcceptance.reasons.length > 0
              ? qrEnforcedDocumentAcceptance.reasons.map((reason: string) => `Acceptance reason: ${reason}`)
              : []),
            effectiveFinalStatus === 'verified'
              ? 'Compliance Checklist APPROVED.'
              : effectiveFinalStatus === 'review'
                ? 'Compliance Status: REVIEW REQUIRED.'
                : 'Compliance Alert: Document rejected by backend acceptance rules.'
          ]
        };

        // Determine next sequence stage
        let nextStep = prev.currentStep;
        if (effectiveFinalStatus === 'verified') {
          if (type === 'trade_license') nextStep = 'vat_upload';
          else if (type === 'vat_certificate') nextStep = 'bank_document_upload';
          else if (type === 'bank_document') nextStep = 'review';
        }

        return {
          ...prev,
          companyName: prev.companyName || extracted.companyName || extracted.tradeName || '',
          tradeLicenseNumber: prev.tradeLicenseNumber || extracted.licenseNumber || '',
          vatNumber: prev.vatNumber || extracted.taxRegistrationNumber || extracted.vatNumber || '',
          currentStep: nextStep,
          documents: {
            ...prev.documents,
            [type]: updatedDoc
          },
          registryChecks: {
            ...prev.registryChecks,
            tradeLicenseVerified: type === 'trade_license' ? effectiveFinalStatus === 'verified' : prev.registryChecks.tradeLicenseVerified,
            vatVerified: type === 'vat_certificate' ? effectiveFinalStatus === 'verified' : prev.registryChecks.vatVerified,
            bankDocumentVerified: type === 'bank_document' ? effectiveFinalStatus === 'verified' : prev.registryChecks.bankDocumentVerified
          }
        };
      });

      // 6. Write explanation of compliance checks outcome into chatbot history
      await streamChatMessage(
        setChatHistory,
        effectiveFinalStatus === 'verified'
          ? `✦ **Document Accepted** ✦\n\nI have scanned your submitted **${type.replace(/_/g, ' ').toUpperCase()}**.\n\n- **OCR Scanned Name**: "${getDisplayOcrName(extracted)}"\n- **Acceptance Status**: ✅ Approved by Expert Intelligent rules.\n\n${
              type === 'trade_license'
                ? "Let's move onto **Step 3**. Please provide your company's **VAT Certificate**."
                : type === 'vat_certificate'
                ? "Great! We are almost done. Please provide your official **Bank Document** (Ownership Statement)."
                : "All requested parameters are verified! Please review the registry verification score card on the right, and submit your registration profile."
            }`
          : effectiveFinalStatus === 'review'
            ? `⚠ **Document Sent for Review** ⚠\n\n- **OCR Extracted Name**: "${getDisplayOcrName(extracted)}"${missingFieldLabels.length > 0 ? `\n- **Missing Fields**: ${missingFieldLabels.join(', ')}` : ''}\n\nYour document is under review based on the backend acceptance rules.`
            : `⚠ **Document Rejected** ⚠\n\n- **OCR Extracted Name**: "${getDisplayOcrName(extracted)}"${missingFieldLabels.length > 0 ? `\n- **Missing Fields**: ${missingFieldLabels.join(', ')}` : ''}\n${bankQrRequired ? `- **Missing Fields**: QR Code\n` : ''}${!companyNameAligned ? `- **Company Name Mismatch**: ${companyMismatchReason}\n` : ''}\nPlease upload a corrected document that satisfies the backend acceptance rules.`
      );

    } catch (err: any) {
      console.error(err);
      
      setRegistrationState(prev => {
        const doc = prev.documents[type];
        return {
          ...prev,
          documents: {
            ...prev.documents,
            [type]: {
              ...doc,
              status: 'failed',
              error: err.message,
              validationLogs: [
                ...doc.validationLogs,
                `Critical exception encountered during parsing: ${err.message}`
              ]
            }
          }
        };
      });

      setChatHistory(prev => [
        ...prev,
        {
          id: 'bot-err-' + Date.now(),
          sender: 'agent',
          text: `I encountered an issue verifying your uploaded document: "${err.message}". Please review the upload state and ensure it corresponds to a valid document format.`,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        }
      ]);
    }
  };

  const handleSubmitRegistration = () => {
    setSubmissionComplete(true);
  };

  const handleReset = () => {
    setRegistrationState(initialRegistrationState);
    setChatHistory([]);
    setSubmissionComplete(false);
  };

  // Steps calculation for visual progress bar tracking
  const docs = Object.values(registrationState.documents) as DocumentVerification[];
  const numUploaded = docs.filter(d => d.status !== 'empty').length;
  const numVerified = docs.filter(d => d.status === 'verified').length;

  let currentStepIndex = 1;
  if (submissionComplete) {
    currentStepIndex = 4;
  } else if (numVerified === 3) {
    currentStepIndex = 3;
  } else if (numUploaded > 0) {
    currentStepIndex = 2;
  } else {
    currentStepIndex = 1;
  }

  const steps = [
    {
      id: 1,
      label: 'Upload',
      desc: 'Doc Drop & Gather',
      icon: (active: boolean, done: boolean) => <Upload className="w-4 h-4" />
    },
    {
      id: 2,
      label: 'Verification',
      desc: 'Gemini OCR Audits',
      icon: (active: boolean, done: boolean) => <Building2 className="w-4 h-4" />
    },
    {
      id: 3,
      label: 'Review',
      desc: 'Scorecard Review',
      icon: (active: boolean, done: boolean) => <ShieldCheck className="w-4 h-4" />
    },
    {
      id: 4,
      label: 'Finalized',
      desc: 'Registry Approved',
      icon: (active: boolean, done: boolean) => <CheckCircle2 className="w-4 h-4" />
    }
  ];

  return (
    <div className="min-h-screen bg-[#F8FAFC] font-sans text-slate-800 flex flex-col selection:bg-indigo-600 selection:text-white">
      {/* Dynamic Banner Header */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-50 shadow-sm">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <TrojanLogo />
          </div>

          <div className="flex items-center gap-4">
            <button
              onClick={handleReset}
              className="text-[10px] uppercase tracking-widest font-bold text-slate-400 hover:text-slate-600 transition"
            >
              Reset Portal
            </button>
          </div>
        </div>
      </header>

      {/* Main Container Workspace */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-4 md:p-6 space-y-6">

        {/* Visual Registration Lifecycle Progress Bar */}
        <div className="bg-white border border-slate-200 rounded-lg p-5 shadow-sm">
          <div className="relative flex items-center justify-between">
            {/* Background Line & Active Fill */}
            <div className="absolute top-5 left-[12.5%] right-[12.5%] h-[2px] bg-slate-100 -translate-y-1/2 z-0">
              <div 
                className="h-full bg-indigo-600 transition-all duration-500 ease-in-out"
                style={{ 
                  width: `${
                    currentStepIndex === 1 ? '0%' : 
                    currentStepIndex === 2 ? '33.33%' : 
                    currentStepIndex === 3 ? '66.66%' : 
                    '100%'
                  }` 
                }} 
              />
            </div>

            {steps.map((step) => {
              const isActive = currentStepIndex === step.id;
              const isCompleted = currentStepIndex > step.id;
              
              return (
                <div key={step.id} className="relative z-10 flex flex-col items-center flex-1">
                  <div 
                    className={`w-10 h-10 rounded-full flex items-center justify-center transition-all duration-300 border-2 ${
                      isCompleted 
                        ? 'bg-emerald-50 border-emerald-500 text-emerald-600 shadow-sm' 
                        : isActive 
                          ? 'bg-indigo-50 border-indigo-600 text-indigo-600 scale-105 shadow-md ring-4 ring-indigo-50' 
                          : 'bg-white border-slate-200 text-slate-400'
                    }`}
                  >
                    {isCompleted ? (
                      <Check className="w-5 h-5 text-emerald-600" />
                    ) : (
                      step.icon(isActive, isCompleted)
                    )}
                  </div>
                  
                  <div className="mt-3 text-center">
                    <span className={`block text-[10px] font-bold uppercase tracking-wider ${
                      isActive ? 'text-indigo-600' : isCompleted ? 'text-emerald-700' : 'text-slate-400'
                    }`}>
                      {step.label}
                    </span>
                    <span className="hidden sm:block text-[9px] text-slate-400 uppercase tracking-widest font-mono mt-0.5">
                      {step.desc}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
        
        {/* Dashboard split screen layout */}
        {submissionComplete ? (
          <div className="max-w-2xl mx-auto bg-white border border-slate-200 p-8 rounded-lg shadow-sm text-center space-y-6 animate-fade-in mt-6">
            <div className="w-16 h-16 bg-green-50 border border-green-200 text-green-600 rounded-full flex items-center justify-center mx-auto shadow-sm">
              <CheckCircle2 className="w-9 h-9" />
            </div>
            <div className="space-y-2">
              <h2 className="text-xl font-bold text-slate-900 uppercase tracking-tight">Supplier Registration Successful!</h2>
              <p className="text-xs text-slate-500 leading-relaxed max-w-md mx-auto">
                 Your enterprise registered for active procurement . Your Transaction Id is 346.
              </p>
            </div>

            <div className="bg-slate-50 p-5 rounded border border-slate-200 text-left font-mono text-xs text-slate-600 space-y-2">
              <p><strong className="text-slate-900 font-sans uppercase text-[10px] tracking-wider block">Business Name:</strong> {registrationState.companyName || "Dynamic Tech Enterprises Corp"}</p>
              <p><strong className="text-slate-900 font-sans uppercase text-[10px] tracking-wider block mt-1">Trade License:</strong> TL_2024_GlobalTech.pdf <span className="text-emerald-600 ml-1 font-bold">(ACTIVE)</span></p>
              <p><strong className="text-slate-900 font-sans uppercase text-[10px] tracking-wider block mt-1">VAT Account:</strong> Registered contributor status</p>
              <p><strong className="text-slate-900 font-sans uppercase text-[10px] tracking-wider block mt-1">Corporate Bank Account:</strong> Authoritative Verification Complete <span className="text-indigo-600 ml-1 font-bold">(AUTHORIZED)</span></p>
              {registrationState.yearsInBusiness && (
                <div className="border-t border-slate-200 pt-3 mt-3 font-sans text-slate-700 text-[11px] grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-2.5">
                  <div><span className="text-slate-400 uppercase text-[9px] font-bold block">Years in Business</span><strong className="text-slate-800 text-xs">{registrationState.yearsInBusiness}</strong></div>
                  <div><span className="text-slate-400 uppercase text-[9px] font-bold block">Total Staff</span><strong className="text-slate-800 text-xs">{registrationState.totalStaff}</strong></div>
                  <div><span className="text-slate-400 uppercase text-[9px] font-bold block">Total Labors</span><strong className="text-slate-800 text-xs">{registrationState.totalLabors}</strong></div>
                  <div><span className="text-slate-400 uppercase text-[9px] font-bold block">Engineers among Staff</span><strong className="text-slate-800 text-xs">{registrationState.totalEngineers}</strong></div>
                  <div><span className="text-slate-400 uppercase text-[9px] font-bold block">Testing Facility Available</span><strong className="text-slate-800 text-xs">{registrationState.testingFacility}</strong></div>
                  <div><span className="text-slate-400 uppercase text-[9px] font-bold block">Product Listing Coverage</span><strong className="text-slate-800 text-xs">{registrationState.clientConsultantListings} client(s)/consultant(s)</strong></div>
                  <div><span className="text-slate-400 uppercase text-[9px] font-bold block">Projects executed (last 3y)</span><strong className="text-slate-800 text-xs">{registrationState.projectsLast3Years}</strong></div>
                  <div><span className="text-slate-400 uppercase text-[9px] font-bold block">Biggest Project (last 3y)</span><strong className="text-slate-800 text-xs">{registrationState.biggestProjectValue}</strong></div>
                  <div><span className="text-slate-400 uppercase text-[9px] font-bold block">Annual Turnover</span><strong className="text-slate-800 text-xs">{registrationState.annualTurnover}</strong></div>
                  <div><span className="text-slate-400 uppercase text-[9px] font-bold block">Factory Asset Value</span><strong className="text-slate-800 text-xs">{registrationState.factoryAssetValue}</strong></div>
                </div>
              )}
            </div>

            <button
              onClick={handleReset}
              className="mt-4 bg-slate-900 hover:bg-black text-white font-bold text-[10px] uppercase tracking-widest py-3 px-6 rounded-sm transition"
            >
              Onboard another supplier
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            <div className="lg:col-span-6 xl:col-span-7">
              <AIAgentChat
                registrationState={registrationState}
                setRegistrationState={setRegistrationState}
                onAnalyzeDocument={handleAnalyzeDocument}
                chatHistory={chatHistory}
                setChatHistory={setChatHistory}
              />
            </div>
            
            <div className="lg:col-span-6 xl:col-span-5 text-slate-800">
              <VerificationPanel
                registrationState={registrationState}
                setRegistrationState={setRegistrationState}
                onSubmitRegistration={handleSubmitRegistration}
              />
            </div>
          </div>
        )}
      </main>

      {/* Registry Drawer modal sheet */}
      {showRegistryDrawer && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-lg w-full max-w-4xl max-h-[85vh] overflow-hidden flex flex-col shadow-lg">
            <div className="bg-slate-50 p-6 border-b border-slate-200 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Database className="w-5 h-5 text-indigo-600" />
                <div>
                  <h3 className="font-bold text-sm text-slate-900 uppercase tracking-tight">Central Registrar Database Indexes (Live Registry Simulation)</h3>
                  <p className="text-[10px] text-slate-400 font-semibold uppercase tracking-wider mt-0.5">Official business data used to authorize corporate registrations</p>
                </div>
              </div>
              <button
                onClick={() => setShowRegistryDrawer(false)}
                className="text-[10px] uppercase tracking-wider font-bold bg-slate-200 hover:bg-slate-300 text-slate-700 py-1.5 px-3 rounded"
              >
                ✕ Close
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-6 space-y-4 bg-[#F8FAFC]">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {registryRecords.map((record) => (
                  <div key={record.companyName} className="bg-white border border-slate-200 rounded-lg p-5 space-y-3 shadow-sm">
                    <div className="flex items-start justify-between">
                      <h4 className="font-bold text-xs text-slate-900 flex items-center gap-1.5 uppercase tracking-wide">
                        <Building className="w-3.5 h-3.5 text-indigo-600" /> {record.companyName}
                      </h4>
                      <span className={`text-[9px] px-2 py-0.5 rounded font-black tracking-wider uppercase ${
                        record.status === 'ACTIVE' ? 'bg-green-100 text-green-700' : 'bg-rose-100 text-rose-700'
                      }`}>
                        {record.status}
                      </span>
                    </div>

                    <div className="grid grid-cols-2 gap-2 text-[10px] font-mono text-slate-600 bg-slate-50 p-3 rounded border border-slate-100">
                      <div>
                        <span className="block text-[8px] font-bold uppercase text-slate-400">Trade License:</span>
                        <span className="font-semibold">{record.licenseNumber}</span>
                      </div>
                      <div>
                        <span className="block text-[8px] font-bold uppercase text-slate-400">License Expiry:</span>
                        <span className={`font-semibold ${record.status === 'EXPIRED' ? 'text-rose-600 font-bold' : 'text-slate-800'}`}>{record.licenseExpiry}</span>
                      </div>
                      <div>
                        <span className="block text-[8px] font-bold uppercase text-slate-400">VAT Registration:</span>
                        <span className="font-semibold">{record.vatNumber}</span>
                      </div>
                      <div>
                        <span className="block text-[8px] font-bold uppercase text-slate-400">Bank Account No:</span>
                        <span className="font-semibold">{record.bankAccountNumber}</span>
                      </div>
                    </div>

                    <div className="text-[10px] space-y-1 mt-1 font-medium text-slate-600">
                      <p><span className="text-slate-400 uppercase font-bold text-[9px] mr-1">Authorized Officer:</span> <strong className="text-slate-800">{record.authorizedSignatory}</strong></p>
                      <p><span className="text-slate-400 uppercase font-bold text-[9px] mr-1">Corporate Address:</span> <span className="text-slate-500 italic">{record.postalAddress}</span></p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="p-4 bg-slate-50 border-t border-slate-200 text-[10px] font-bold text-slate-400 uppercase tracking-widest text-center">
              The AI compliance advisor performs exact indices matching or dynamically checks formatting checkrules against this registry database structure.
            </div>
          </div>
        </div>
      )}

      {/* Humble Footer */}
      <footer className="bg-white border-t border-slate-200 h-16 flex items-center">
        <div className="max-w-7xl mx-auto px-6 w-full flex flex-col sm:flex-row items-center justify-between text-[10px] font-bold text-slate-400 uppercase tracking-widest gap-2">
          
          <div className="flex items-center gap-4">
            <span>Copyright reserved to Trojan General Contracting</span>
            <span className="text-indigo-600">v2.4.1</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
