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
  XCircle,
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

function parseMaybeJson(value: unknown) {
  if (typeof value !== 'string' || !value.trim()) {
    return value ?? null;
  }

  try {
    return JSON.parse(value);
  } catch {
    return value;
  }
}

function getAgentDecisionDocumentType(documentType: 'trade_license' | 'vat_certificate' | 'bank_document') {
  if (documentType === 'trade_license') return 'trade';
  if (documentType === 'vat_certificate') return 'vat';
  return 'bank';
}

type AgentDocumentAcceptance = NonNullable<DocumentVerification['documentAcceptance']>;

type AgentExtractionResponse = {
  status?: string;
  score?: number | null;
  processingTimeMs?: number;
  processingTime?: string;
  results?: Record<string, { value?: string; confidence?: number }>;
  raw_results?: Record<string, unknown> | null;
  documentAcceptance?: AgentDocumentAcceptance | null;
  extractedData?: Record<string, string>;
  extraction?: {
    document_type?: string;
    results?: Record<string, { value?: string; confidence?: number }>;
    raw_results?: Record<string, unknown> | null;
    llm_extraction?: Record<string, unknown> | null;
    qr_codes?: Record<string, unknown> | null;
    verification_urls?: Record<string, unknown> | null;
    logo?: Record<string, unknown> | boolean | null;
    gpt_review?: {
      is_consistent?: boolean;
      anomalies?: string[];
      plausibility_score?: number;
      reasoning?: string;
    } | null;
    score?: number | null;
  } | null;
  llm_extraction?: Record<string, unknown> | null;
  llmExtraction?: Record<string, unknown> | null;
  qr_codes?: Record<string, unknown> | null;
  verification_urls?: Record<string, unknown> | null;
  logo?: Record<string, unknown> | boolean | null;
  gpt_review?: {
    is_consistent?: boolean;
    anomalies?: string[];
    plausibility_score?: number;
    reasoning?: string;
  } | null;
  gptReview?: {
    is_consistent?: boolean;
    anomalies?: string[];
    plausibility_score?: number;
    reasoning?: string;
  };
  rawResponse?: Record<string, any>;
  requestContext?: {
    company_name?: string | null;
    conversation_id?: string | null;
    trade_license_number?: string | null;
    document_context?: unknown;
    context_hint?: unknown;
  };
};

function getAgent2ExtractionSource(analyzeData: any) {
  const extraction = analyzeData?.extraction && typeof analyzeData.extraction === 'object'
    ? analyzeData.extraction
    : {};
  const rawResponse = analyzeData?.rawResponse && typeof analyzeData.rawResponse === 'object'
    ? analyzeData.rawResponse
    : {};
  const rawExtraction = rawResponse.extraction && typeof rawResponse.extraction === 'object'
    ? rawResponse.extraction
    : {};

  return { extraction, rawResponse, rawExtraction };
}

type AgentTbmsReconciliationResponse = {
  ok?: boolean;
  status?: string;
  agent?: {
    name?: string;
    version?: string;
  };
  document_type?: string;
  context?: {
    conversation_id?: string;
  };
  state?: {
    conversation_entities?: {
      company_name?: string;
      trade_license_number?: string;
    };
    trusted_trade_document?: Record<string, unknown>;
    case_state?: {
      document_type?: string;
      validation_status?: string;
    };
  };
  validation?: AgentDocumentAcceptance;
  company_match?: {
    requested_company_name?: string;
    requested_company_name_normalized?: string;
    matched_company_name?: string;
    matched_company_name_normalized?: string;
    exact_match?: boolean;
    similarity_percent?: number;
    match_status?: string;
  };
  tbms_match?: {
    status?: string;
    license_match?: boolean;
  };
  score?: number;
  recommended_action?: string;
  thresholds?: {
    approved?: number;
    review?: number;
  };
  text?: string;
};

type AgentApprovalReviewResponse = {
  ok?: boolean;
  status?: string;
  agent?: {
    name?: string;
    version?: string;
  };
  context?: {
    conversation_id?: string;
  };
  state?: {
    conversation_entities?: {
      company_name?: string;
      trade_license_number?: string;
    };
    trusted_trade_document?: Record<string, unknown>;
    case_state?: {
      final_decision?: string;
      case_status?: string;
    };
  };
  validation?: AgentDocumentAcceptance;
  gpt_review?: {
    is_consistent?: boolean;
    anomalies?: string[];
    plausibility_score?: number;
    reasoning?: string;
  };
  final_decision?: string;
  workflow_action?: string;
  case_status?: string;
  score?: number;
  thresholds?: {
    approved?: number;
    review?: number;
  };
  text?: string;
};

function normalizeDocumentDecision(value?: string | null) {
  const normalized = String(value || '').trim().toLowerCase();
  if (!normalized) return '';
  if (normalized.includes('expired')) return 'expired';
  if (normalized.includes('auto-approve') || normalized.includes('auto_approve') || normalized.includes('approved')) return 'approved';
  if (normalized.includes('review')) return 'review';
  if (normalized.includes('reject')) return 'rejected';
  return normalized;
}

function normalizeAgentDocumentAcceptance(
  decision: AgentDocumentAcceptance | null | undefined,
  fallbackDocumentType: 'trade' | 'vat' | 'bank'
): AgentDocumentAcceptance | null {
  if (!decision) {
    return null;
  }

  return {
    document_type: decision.document_type || fallbackDocumentType,
    status: decision.status || 'review',
    score: typeof decision.score === 'number' ? decision.score : undefined,
    missing_fields: Array.isArray(decision.missing_fields) ? decision.missing_fields : [],
    reasons: Array.isArray(decision.reasons) ? decision.reasons : [],
    acceptable: typeof decision.acceptable === 'boolean' ? decision.acceptable : undefined,
    expiry_date: decision.expiry_date,
    is_expired: decision.is_expired,
    company_match: decision.company_match,
    tbms_match: decision.tbms_match,
    recommended_action: decision.recommended_action,
  };
}

function buildAgent2ExtractionPayload(
  extractionResponse: AgentExtractionResponse,
  agentDocumentType: 'trade' | 'vat' | 'bank'
) {
  const rawResponse = extractionResponse.rawResponse || {};
  const rawExtraction = (rawResponse.extraction && typeof rawResponse.extraction === 'object'
    ? rawResponse.extraction
    : {}) as Record<string, any>;

  const results =
    rawExtraction.results ||
    rawExtraction.raw_results ||
    extractionResponse.results ||
    rawResponse.results ||
    rawResponse.raw_results ||
    {};

  const llmExtraction =
    rawExtraction.llm_extraction ||
    rawExtraction.llmExtraction ||
    rawResponse.llm_extraction ||
    rawResponse.llmExtraction ||
    extractionResponse.llm_extraction ||
    extractionResponse.llmExtraction ||
    null;

  const qrCodes =
    rawExtraction.qr_codes ||
    rawResponse.qr_codes ||
    extractionResponse.qr_codes ||
    null;

  const verificationUrls =
    rawExtraction.verification_urls ||
    rawResponse.verification_urls ||
    extractionResponse.verification_urls ||
    null;

  const logo =
    rawExtraction.logo ||
    rawResponse.logo ||
    extractionResponse.logo ||
    null;

  const gptReview =
    rawExtraction.gpt_review ||
    rawExtraction.gptReview ||
    rawResponse.gpt_review ||
    rawResponse.gptReview ||
    extractionResponse.gpt_review ||
    extractionResponse.gptReview ||
    null;

  const score =
    extractionResponse.score ??
    rawExtraction.score ??
    rawExtraction.plausibility_score ??
    rawResponse.score ??
    rawResponse.plausibility_score ??
    gptReview?.plausibility_score ??
    null;
  const normalizedDocumentContext = parseMaybeJson(
    (rawExtraction as Record<string, unknown>).document_context ||
    (rawResponse as Record<string, unknown>).document_context ||
    extractionResponse.requestContext?.document_context ||
    null
  );
  const normalizedContextHint = parseMaybeJson(
    (rawExtraction as Record<string, unknown>).context_hint ||
    (rawResponse as Record<string, unknown>).context_hint ||
    extractionResponse.requestContext?.context_hint ||
    null
  );

  return {
    ...rawExtraction,
    document_type: agentDocumentType,
    results,
    raw_results: rawExtraction.raw_results || rawResponse.raw_results || extractionResponse.raw_results || null,
    llm_extraction: llmExtraction,
    llmExtraction: llmExtraction,
    qr_codes: qrCodes,
    verification_urls: verificationUrls,
    logo,
    gpt_review: gptReview,
    gptReview: gptReview,
    score,
    document_context: normalizedDocumentContext,
    context_hint: normalizedContextHint,
  };
}

function buildReconciliationPayload(
  documentType: 'trade_license' | 'vat_certificate' | 'bank_document',
  registrationState: SupplierRegistrationState,
  uploadContext: {
    companyName?: string;
    conversationId?: string | null;
    tradeLicenseNumber?: string;
    documentContext?: Record<string, unknown> | string | null;
    contextHint?: Record<string, unknown> | string | null;
  } | undefined,
  extractionResponse: AgentExtractionResponse
) {
  const agentDocumentType = getAgentDecisionDocumentType(documentType);
  const parsedContextHint = parseMaybeJson(uploadContext?.contextHint);
  const requestedCompanyName =
    uploadContext?.companyName?.trim() ||
    registrationState.companyName?.trim() ||
    String(extractionResponse.requestContext?.company_name || '').trim() ||
    String((parsedContextHint as Record<string, any> | undefined)?.entities?.company_name || '').trim();

  const requestedLicenseNumber =
    uploadContext?.tradeLicenseNumber?.trim() ||
    registrationState.tradeLicenseNumber?.trim() ||
    extractionResponse.extractedData?.licenseNumber?.trim() ||
    getResultValue(extractionResponse.results || {}, ['LicenseNo', 'LicenceNo', 'LicenseNumber']) ||
    getResultValue(extractionResponse.rawResponse?.results || {}, ['LicenseNo', 'LicenceNo', 'LicenseNumber']) ||
    '';
  const agent2Extraction = buildAgent2ExtractionPayload(extractionResponse, agentDocumentType);

  return {
    document_type: agentDocumentType,
    company_name: requestedCompanyName,
    company_name_hint: requestedCompanyName,
    extraction: agent2Extraction,
    tbms_record: {
      vendor_name: requestedCompanyName,
      license_no: requestedLicenseNumber,
    },
    context: {
      conversation_id: uploadContext?.conversationId || extractionResponse.requestContext?.conversation_id || null,
    },
  };
}

function createWelcomeMessage(): ChatMessage {
  return {
    id: 'welcome',
    sender: 'agent',
    text: `Hello and welcome to the Secure Supplier Portal! 🛡️\n\nI am your AI Onboarding Assistant. I am here to guide you step-by-step through our supplier registration program. To align with corporate and compliance standards, we require authentication of three vital company certificates in real-time:\n\n1. **Valid Trade License**\n2. **VAT Registration Certificate**\n3. **Official Bank Document (Account ownership statement)**\n\nLet's begin! **What is the registered Commercial Name of your Enterprise?**`,
    timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  };
}

function mergeOcrExtraction(analyzeData: any, documentType: 'trade_license' | 'vat_certificate' | 'bank_document') {
  const { extraction, rawResponse, rawExtraction } = getAgent2ExtractionSource(analyzeData);
  const rawResults =
    extraction.results ||
    rawExtraction.results ||
    analyzeData?.results ||
    rawResponse?.results ||
    analyzeData?.raw_results ||
    rawExtraction.raw_results ||
    rawResponse?.raw_results ||
    {};

  const normalized = analyzeData?.extractedData || {};
  const tradeName = getResultValue(rawResults, ['TradeName', 'CompanyName', 'OperatingName', 'LegalNameEnglish', 'BusinessName']);
  const companyName = tradeName || normalized.companyName || normalized.tradeName || '';
  const licenseNumber = getResultValue(rawResults, ['LicenceNo', 'LicenseNo', 'LicenseNumber', 'UnifiedLicenceNo', 'UnifiedRegistrationNo']) ||
    getResultValue(rawExtraction.results, ['LicenceNo', 'LicenseNo', 'LicenseNumber', 'UnifiedLicenceNo', 'UnifiedRegistrationNo']) ||
    getResultValue(analyzeData?.results, ['LicenceNo', 'LicenseNo', 'LicenseNumber', 'UnifiedLicenceNo', 'UnifiedRegistrationNo']) ||
    normalized.licenseNumber ||
    '';

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
    licenseNumber,
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
  factoryAssetValue: '',
  vendorType: '',
  surveyProduct: ''
};

export default function App() {
  const [registrationState, setRegistrationState] = useState<SupplierRegistrationState>(initialRegistrationState);
  const [chatHistory, setChatHistory] = useState<ChatMessage[]>([createWelcomeMessage()]);
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
    file: File | null,
    isPresetSample?: { companyName: string },
    uploadContext?: {
      companyName?: string;
      conversationId?: string | null;
      tradeLicenseNumber?: string;
      documentContext?: Record<string, unknown> | string | null;
      contextHint?: Record<string, unknown> | string | null;
    }
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
            fileName: isPresetSample
              ? `preset_${type}_sample.svg`
              : file?.name || `uploaded_file.${file?.type?.split('/')[1] || 'bin'}`,
            uploadedAt: new Date().toLocaleTimeString(),
            validationLogs: [
              `Kickoff audit protocol: OCR visual analysis matching.`,
              `Triggering OCR visual metadata scanner...`
            ]
          }
        }
      };
    });

    try {
      // 2. Call the Express backend to run OCR extraction
      const formData = new FormData();
      formData.append('documentType', type);
      if (file) {
        formData.append('file', file, file.name);
        formData.append('mimeType', file.type || 'application/octet-stream');
      }
      if (isPresetSample) {
        formData.append('isPresetSample', JSON.stringify(isPresetSample));
      }
      if (uploadContext?.companyName) {
        formData.append('companyName', uploadContext.companyName);
        formData.append('company_name', uploadContext.companyName);
      }
      if (uploadContext?.conversationId) {
        formData.append('conversation_id', uploadContext.conversationId);
      }
      if (uploadContext?.tradeLicenseNumber) {
        formData.append('trade_license_number', uploadContext.tradeLicenseNumber);
      }
      if (uploadContext?.documentContext) {
        formData.append('document_context', JSON.stringify(uploadContext.documentContext));
      }
      if (uploadContext?.contextHint) {
        formData.append('context_hint', JSON.stringify(uploadContext.contextHint));
      }

      const analyzeRes = await fetch('/api/analyze-document', {
        method: 'POST',
        body: formData
      });

      const analyzeData = (await analyzeRes.json()) as AgentExtractionResponse;
      if (!analyzeRes.ok || analyzeData.status !== 'success') {
        throw new Error((analyzeData as any).message || 'Image AI scanning phase failed.');
      }

      const extracted = mergeOcrExtraction(analyzeData, type);
      const agentDocumentType = getAgentDecisionDocumentType(type);
      const ocrResults = analyzeData.results || analyzeData.rawResponse?.results || {};
      const requestCompanyName =
        uploadContext?.companyName?.trim() ||
        registrationState.companyName?.trim() ||
        String(analyzeData.requestContext?.company_name || '').trim() ||
        '';
      const requestLicenseNumber =
        uploadContext?.tradeLicenseNumber?.trim() ||
        registrationState.tradeLicenseNumber?.trim() ||
        String(analyzeData.requestContext?.trade_license_number || '').trim() ||
        String(extracted.licenseNumber || '').trim();
      const requestConversationId =
        uploadContext?.conversationId ||
        analyzeData.requestContext?.conversation_id ||
        null;

      const agent2Acceptance = normalizeAgentDocumentAcceptance(
        analyzeData.documentAcceptance || analyzeData.rawResponse?.document_acceptance || null,
        agentDocumentType
      );

      const reconciliationPayload = buildReconciliationPayload(
        type,
        registrationState,
        {
          ...uploadContext,
          companyName: requestCompanyName,
          conversationId: requestConversationId,
          tradeLicenseNumber: requestLicenseNumber,
        },
        analyzeData
      );

      const reconciliationRes = await fetch('/api/agent-tbms-reconciliation', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(reconciliationPayload),
      });

      const reconciliationData = (await reconciliationRes.json()) as AgentTbmsReconciliationResponse;
      if (!reconciliationRes.ok || reconciliationData.ok === false || reconciliationData.status === 'error') {
        throw new Error((reconciliationData as any).text || 'TBMS reconciliation failed.');
      }

      const reconciliationDecision = normalizeDocumentDecision(
        reconciliationData.recommended_action ||
        reconciliationData.validation?.status ||
        reconciliationData.state?.case_state?.validation_status
      );
      const needsApprovalReview =
        reconciliationDecision === 'review' ||
        reconciliationDecision === '' ||
        reconciliationDecision === 'escalate_for_review';

      let finalValidation = normalizeAgentDocumentAcceptance(
        reconciliationData.validation || agent2Acceptance,
        agentDocumentType
      );
      let approvalReviewData: AgentApprovalReviewResponse | null = null;
      let finalDecision = reconciliationDecision || normalizeDocumentDecision(finalValidation?.status) || 'rejected';

      const finalValidationHasCompanyMismatch = Boolean(
        String(finalValidation?.company_match?.match_status || '').toLowerCase() === 'mismatch' ||
        String(finalValidation?.tbms_match?.status || '').toLowerCase() === 'mismatch' ||
        String(reconciliationData.company_match?.match_status || '').toLowerCase() === 'mismatch' ||
        String(reconciliationData.tbms_match?.status || '').toLowerCase() === 'mismatch' ||
        /company name mismatch|does not match/i.test(
          [
            ...(Array.isArray(finalValidation?.reasons) ? finalValidation.reasons : []),
            reconciliationData.validation?.reasons?.join(' ') || '',
            reconciliationData.text || '',
          ].join(' ')
        )
      );

      if (needsApprovalReview && finalDecision !== 'approved') {
        const agentExtractionForDecision = buildAgent2ExtractionPayload(analyzeData, agentDocumentType);

        const agentReconciliationForDecision = {
          ...reconciliationData,
          document_type: reconciliationData.document_type || agentDocumentType,
          company_name: requestCompanyName,
          company_name_hint: requestCompanyName,
          tbms_record: {
            vendor_name: requestCompanyName,
            license_no: requestLicenseNumber,
          },
          context: {
            conversation_id: requestConversationId,
          },
        };

        const approvalPayload = {
          document_type: agentDocumentType,
          company_name: requestCompanyName,
          company_name_hint: requestCompanyName,
          extraction: agentExtractionForDecision,
          reconciliation: agentReconciliationForDecision,
          tbms_record: {
            vendor_name: requestCompanyName,
            license_no: requestLicenseNumber,
          },
          context: {
            conversation_id: requestConversationId,
          },
        };

        const approvalRes = await fetch('/api/agent-approval-review', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(approvalPayload),
        });

        approvalReviewData = (await approvalRes.json()) as AgentApprovalReviewResponse;
        if (!approvalRes.ok || approvalReviewData.ok === false || approvalReviewData.status === 'error') {
          throw new Error((approvalReviewData as any).text || 'Final approval review failed.');
        }

        finalDecision = normalizeDocumentDecision(
          approvalReviewData.final_decision ||
          approvalReviewData.validation?.status ||
          finalDecision
        ) || finalDecision;

        const approvalReviewValidation = normalizeAgentDocumentAcceptance(
          approvalReviewData.validation || finalValidation,
          agentDocumentType
        );
        finalValidation = approvalReviewValidation
          ? {
              ...approvalReviewValidation,
              status: finalDecision as AgentDocumentAcceptance['status'],
              recommended_action:
                approvalReviewData.workflow_action ||
                approvalReviewValidation.recommended_action ||
                finalDecision,
              acceptable: finalDecision === 'approved',
              reasons: finalDecision === 'approved'
                ? (approvalReviewValidation.reasons?.length
                    ? approvalReviewValidation.reasons
                    : ['The document was approved after verification checks.'])
                : finalDecision === 'review'
                  ? (approvalReviewData.text
                      ? [approvalReviewData.text]
                      : approvalReviewValidation.reasons?.length
                        ? approvalReviewValidation.reasons
                        : ['The document needs a quick review before approval.'])
                  : (approvalReviewData.text
                      ? [approvalReviewData.text]
                      : approvalReviewValidation.reasons?.length
                        ? approvalReviewValidation.reasons
                        : ['The document could not be approved after verification checks.']),
            }
          : approvalReviewValidation;
      }

      const finalValidationHasExpiry = Boolean(
        finalValidation?.is_expired ||
        reconciliationData.validation?.is_expired ||
        agent2Acceptance?.is_expired
      );
      const uiDecision = finalValidationHasCompanyMismatch
        ? 'rejected'
        : finalValidationHasExpiry
          ? 'expired'
          : finalDecision;

      if (finalValidation) {
        finalValidation = {
          ...finalValidation,
          status: finalDecision as AgentDocumentAcceptance['status'],
          recommended_action:
            finalValidation.recommended_action ||
            reconciliationData.recommended_action ||
            finalDecision,
          acceptable: finalDecision === 'approved',
          reasons:
            finalValidation.reasons?.length
              ? finalValidation.reasons
              : finalDecision === 'approved'
                ? ['The document was approved after verification checks.']
                : finalDecision === 'review'
                  ? ['The document needs a quick review before approval.']
                  : ['The document could not be approved after verification checks.'],
        };
      }

      const finalStatus: DocumentVerification['status'] =
        finalDecision === 'approved'
          ? 'verified'
          : finalDecision === 'review'
            ? 'review'
            : 'failed';

      const decisionLabel = uiDecision === 'approved'
        ? 'APPROVED'
        : uiDecision === 'review'
          ? 'REVIEW'
          : uiDecision === 'expired'
            ? 'EXPIRED'
            : 'REJECTED';

      const issueReasonSource = Array.isArray(finalValidation?.reasons) && finalValidation.reasons.length > 0
        ? finalValidation.reasons.join(' ')
        : approvalReviewData?.text || reconciliationData.text || '';
      const friendlyReason = issueReasonSource || (
        uiDecision === 'approved'
          ? 'The document was approved after extraction and TBMS reconciliation.'
          : uiDecision === 'expired'
            ? 'The document appears to be expired.'
          : uiDecision === 'review'
            ? 'The document needs a quick review before approval.'
            : 'The document could not be approved after verification checks.'
      );
      const friendlyNextStep = uiDecision === 'approved'
        ? (
          type === 'trade_license'
            ? "Let's move onto Step 3. Please provide your company's VAT Certificate."
            : type === 'vat_certificate'
              ? 'Great! We are almost done. Please provide your official Bank Document (Ownership Statement).'
              : 'All requested parameters are verified! Please review the score card on the right, and submit your registration profile.'
        )
        : finalValidationHasExpiry
          ? 'Please upload a current document with a valid expiry date so we can continue.'
          : 'Please upload a clearer or corrected document so we can continue.';

      const finalLogEntries = [
        `Decision: ${decisionLabel}`,
        finalValidation?.document_type ? `Document Type: ${finalValidation.document_type}` : 'Document Type: N/A',
        finalValidation?.score !== undefined ? `Review Score: ${finalValidation.score}` : 'Review Score: N/A',
        Array.isArray(finalValidation?.reasons) && finalValidation.reasons.length > 0
          ? `Reasons: ${finalValidation.reasons.join(' ')}`
          : 'Reasons: N/A',
      ];

      setRegistrationState(prev => {
        const doc = prev.documents[type];
        const updatedDoc: DocumentVerification = {
          ...doc,
          status: finalStatus,
          extractedData: extracted,
          ocrResults,
          documentAcceptance: finalValidation,
          processingTimeMs: analyzeData.processingTimeMs,
          processingTime: analyzeData.processingTime,
          agent2Response: analyzeData,
          agent3Response: reconciliationData,
          agent4Response: approvalReviewData,
          registryMatch: {
            matched: finalStatus === 'verified',
            registeredName: extracted.companyName || extracted.tradeName || requestCompanyName || 'N/A',
            status: finalStatus === 'verified' ? 'ACTIVE' : 'NOT_FOUND',
            details: approvalReviewData?.workflow_action
              ? `Final workflow action: ${approvalReviewData.workflow_action}.`
              : reconciliationData?.recommended_action
                ? `Recommended action: ${reconciliationData.recommended_action}.`
                : `Final decision: ${decisionLabel}.`,
          },
          validationLogs: [
            ...doc.validationLogs,
            `OCR company: "${getDisplayOcrName(extracted)}"`,
            `Trade name: "${getDisplayTradeName(extracted)}"`,
            `Result status: ${decisionLabel}`,
            ...finalLogEntries,
          ],
        };

        let nextStep = prev.currentStep;
        if (finalStatus === 'verified') {
          if (type === 'trade_license') nextStep = 'vat_upload';
          else if (type === 'vat_certificate') nextStep = 'bank_document_upload';
          else if (type === 'bank_document') nextStep = 'review';
        }

        return {
          ...prev,
          companyName: prev.companyName || requestCompanyName || extracted.companyName || extracted.tradeName || '',
          tradeLicenseNumber: prev.tradeLicenseNumber || requestLicenseNumber || extracted.licenseNumber || '',
          vatNumber: prev.vatNumber || extracted.taxRegistrationNumber || extracted.vatNumber || '',
          currentStep: nextStep,
          documents: {
            ...prev.documents,
            [type]: updatedDoc,
          },
          registryChecks: {
            ...prev.registryChecks,
            tradeLicenseVerified: type === 'trade_license' ? finalStatus === 'verified' : prev.registryChecks.tradeLicenseVerified,
            vatVerified: type === 'vat_certificate' ? finalStatus === 'verified' : prev.registryChecks.vatVerified,
            bankDocumentVerified: type === 'bank_document' ? finalStatus === 'verified' : prev.registryChecks.bankDocumentVerified,
          },
        };
      });

      await streamChatMessage(
        setChatHistory,
        uiDecision === 'approved'
          ? `[[DOCUMENT_ACCEPTED]]
Document Type: ${type.replace(/_/g, ' ').toUpperCase()}
OCR Scanned Name: "${getDisplayOcrName(extracted)}"
Acceptance Status: Approved
Next Step: ${
              type === 'trade_license'
                ? "Let's move onto Step 3. Please provide your company's VAT Certificate."
                : type === 'vat_certificate'
                  ? 'Great! We are almost done. Please provide your official Bank Document (Ownership Statement).'
                  : 'All requested parameters are verified! Please review the score card on the right, and submit your registration profile.'
            }`
          : uiDecision === 'review'
            ? `[[DOCUMENT_REVIEW]]
Document Type: ${type.replace(/_/g, ' ').toUpperCase()}
OCR Scanned Name: "${getDisplayOcrName(extracted)}"
Review Note: ${friendlyReason}
Next Step: We will continue once the review is complete.`
          : uiDecision === 'expired'
            ? `[[DOCUMENT_EXPIRED]]
Document Type: ${type.replace(/_/g, ' ').toUpperCase()}
OCR Scanned Name: "${getDisplayOcrName(extracted)}"
Expiry Note: ${friendlyReason}
Next Step: ${friendlyNextStep}`
          : `[[DOCUMENT_REJECTED]]
Document Type: ${type.replace(/_/g, ' ').toUpperCase()}
OCR Scanned Name: "${getDisplayOcrName(extracted)}"
Rejection Summary: ${friendlyReason}
Next Step: ${friendlyNextStep}`
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
    setChatHistory([createWelcomeMessage()]);
    setSubmissionComplete(false);
  };

  // Steps calculation for visual progress bar tracking
  const docs = Object.values(registrationState.documents) as DocumentVerification[];
  const tradeDoc = registrationState.documents.trade_license;
  const vatDoc = registrationState.documents.vat_certificate;
  const bankDoc = registrationState.documents.bank_document;

  const currentStepIndex = submissionComplete
    ? 4
    : bankDoc.status === 'verified'
      ? 4
      : vatDoc.status === 'verified'
        ? 3
        : tradeDoc.status === 'verified'
          ? 2
          : tradeDoc.status === 'failed' || tradeDoc.status === 'review'
            ? 2
            : tradeDoc.status !== 'empty'
              ? 2
              : 1;

  const overallAuditState = (() => {
    const statuses = [tradeDoc.status, vatDoc.status, bankDoc.status];
    if (statuses.some(status => status === 'failed')) return 'rejected' as const;
    if (statuses.some(status => status === 'review')) return 'review' as const;
    if (statuses.every(status => status === 'verified')) return 'approved' as const;
    return 'in_progress' as const;
  })();

  const getStepVisualState = (stepId: number) => {
    if (stepId === 1) {
      if (tradeDoc.status === 'failed') return 'failed';
      if (tradeDoc.status === 'review') return 'review';
      if (tradeDoc.status === 'verified') return 'completed';
      if (tradeDoc.status !== 'empty') return 'in_progress';
      return 'idle';
    }

    if (stepId === 2) {
      if (tradeDoc.status === 'failed') return 'failed';
      if (tradeDoc.status === 'review') return 'review';
      if (tradeDoc.status === 'verified') {
        if (vatDoc.status === 'failed') return 'failed';
        if (vatDoc.status === 'review') return 'review';
        if (vatDoc.status === 'verified') return 'completed';
        if (vatDoc.status !== 'empty') return 'in_progress';
        return 'in_progress';
      }
      if (tradeDoc.status !== 'empty') return 'in_progress';
      return 'idle';
    }

    if (stepId === 3) {
      if (tradeDoc.status === 'failed' || vatDoc.status === 'failed') return 'failed';
      if (tradeDoc.status === 'review' || vatDoc.status === 'review') return 'review';
      if (tradeDoc.status === 'verified' && vatDoc.status === 'verified') {
        if (bankDoc.status === 'failed') return 'failed';
        if (bankDoc.status === 'review') return 'review';
        if (bankDoc.status === 'verified') return 'completed';
        if (bankDoc.status !== 'empty') return 'in_progress';
        return 'in_progress';
      }
      if (tradeDoc.status === 'verified' || vatDoc.status === 'verified' || vatDoc.status !== 'empty') return 'in_progress';
      return 'idle';
    }

    if (stepId === 4) {
      if (submissionComplete) return 'completed';
      if (tradeDoc.status === 'failed' || vatDoc.status === 'failed' || bankDoc.status === 'failed') return 'failed';
      if (tradeDoc.status === 'review' || vatDoc.status === 'review' || bankDoc.status === 'review') return 'review';
      if (tradeDoc.status === 'verified' && vatDoc.status === 'verified' && bankDoc.status === 'verified') return 'completed';
      return 'idle';
    }

    return 'idle';
  };

  const steps = [
    {
      id: 1,
      label: 'Document Intake',
      desc: 'Document Collection',
      icon: (active: boolean, done: boolean) => <Upload className="w-4 h-4" />
    },
    {
      id: 2,
      label: 'Document Review',
      desc: 'Validation & Checks',
      icon: (active: boolean, done: boolean) => <Building2 className="w-4 h-4" />
    },
    {
      id: 3,
      label: 'Compliance Review',
      desc: 'Decision Review',
      icon: (active: boolean, done: boolean) => <ShieldCheck className="w-4 h-4" />
    },
    {
      id: 4,
      label: 'Approved',
      desc: 'Ready for Onboarding',
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
                className={`h-full transition-all duration-500 ease-in-out ${
                  overallAuditState === 'rejected'
                    ? 'bg-rose-500'
                    : overallAuditState === 'review'
                      ? 'bg-amber-500'
                      : overallAuditState === 'approved'
                        ? 'bg-emerald-500'
                        : 'bg-indigo-600'
                }`}
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
              const stepState = getStepVisualState(step.id);
              const isActive = stepState === 'in_progress';
              const isCompleted = stepState === 'completed';
              const isFailed = stepState === 'failed';
              const isReview = stepState === 'review';

              return (
                <div key={step.id} className="relative z-10 flex flex-col items-center flex-1">
                  <div 
                    className={`w-10 h-10 rounded-full flex items-center justify-center transition-all duration-300 border-2 ${
                      isFailed
                        ? 'bg-rose-50 border-rose-500 text-rose-600 shadow-sm'
                        : isCompleted 
                          ? 'bg-emerald-50 border-emerald-500 text-emerald-600 shadow-sm' 
                          : isReview
                            ? 'bg-amber-50 border-amber-500 text-amber-600 shadow-sm'
                            : isActive 
                              ? 'bg-indigo-50 border-indigo-600 text-indigo-600 scale-105 shadow-md ring-4 ring-indigo-50' 
                              : 'bg-white border-slate-200 text-slate-400'
                    }`}
                  >
                    {isFailed ? (
                      <XCircle className="w-5 h-5 text-rose-600" />
                    ) : isReview ? (
                      <AlertCircle className="w-5 h-5 text-amber-600" />
                    ) : isCompleted ? (
                      <Check className="w-5 h-5 text-emerald-600" />
                    ) : (
                      step.icon(isActive, isCompleted)
                    )}
                  </div>
                  
                  <div className="mt-3 text-center">
                    <span className={`block text-[10px] font-bold uppercase tracking-wider ${
                      isFailed
                        ? 'text-rose-600'
                        : isActive
                          ? 'text-indigo-600'
                          : isCompleted
                            ? 'text-emerald-700'
                            : isReview
                              ? 'text-amber-700'
                              : 'text-slate-400'
                    }`}>
                      {step.label}
                    </span>
                    <span className={`mt-1 inline-flex items-center rounded-full border px-2 py-0.5 text-[9px] font-bold uppercase tracking-widest ${
                      isFailed
                        ? 'text-rose-700 bg-rose-50 border-rose-200'
                        : isReview
                          ? 'text-amber-700 bg-amber-50 border-amber-200'
                          : isCompleted
                            ? 'text-emerald-700 bg-emerald-50 border-emerald-200'
                            : isActive
                              ? 'text-indigo-700 bg-indigo-50 border-indigo-200'
                              : 'text-slate-400 bg-slate-50 border-slate-200'
                    }`}>
                      {isFailed
                        ? 'Rejected'
                        : isReview
                          ? 'Needs Review'
                          : isCompleted
                            ? 'Approved'
                            : isActive
                              ? 'In Progress'
                              : 'Pending'}
                    </span>
                    <span className="hidden sm:block text-[9px] text-slate-400 uppercase tracking-widest font-mono mt-1.5">
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
                  <div><span className="text-slate-400 uppercase text-[9px] font-bold block">Vendor Type</span><strong className="text-slate-800 text-xs">{registrationState.vendorType || 'N/A'}</strong></div>
                  <div><span className="text-slate-400 uppercase text-[9px] font-bold block">Selected Product</span><strong className="text-slate-800 text-xs">{registrationState.surveyProduct || 'N/A'}</strong></div>
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
