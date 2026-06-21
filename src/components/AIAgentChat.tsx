import React, { useState, useRef, useEffect } from 'react';
import { Send, Upload, FileText, CheckCircle2, ShieldAlert, RefreshCw, Bot, Sparkles, ArrowRight, Mail, Phone, UserCheck, AlertCircle } from 'lucide-react';
import { ChatMessage, SupplierRegistrationState, DocumentVerification } from '../types';
import { streamChatMessage } from '../utils/chatStream';
import {
  applyGuidedAnswerToRegistrationState,
  GUIDED_ONBOARDING_CONFIG,
  getGuidedOnboardingCompletionPrompt,
  getGuidedOnboardingFieldLabel,
  getGuidedOnboardingIntroPrompt,
  getGuidedOnboardingStartPrompt,
  getGuidedOnboardingQuestion,
  formatGuidedOnboardingPrompt,
  GuidedOnboardingAnswerState,
  GuidedOnboardingField,
  isGuidedOnboardingTrigger,
  normalizeGuidedOnboardingAnswer,
  normalizeUaeMobileNumber,
  normalizeGuidedPhoneNumber,
  validateGuidedCompanyName,
  validateGuidedEmail,
  validateGuidedPhoneNumber,
} from '../config/guidedOnboarding';

interface AIAgentChatProps {
  registrationState: SupplierRegistrationState;
  setRegistrationState: React.Dispatch<React.SetStateAction<SupplierRegistrationState>>;
  onAnalyzeDocument: (type: 'trade_license' | 'vat_certificate' | 'bank_document', fileBase64: string | null, mimeType: string, isPresetSample?: { companyName: string }) => Promise<void>;
  chatHistory: ChatMessage[];
  setChatHistory: React.Dispatch<React.SetStateAction<ChatMessage[]>>;
}

const ENABLE_LOCAL_ROUTING_HEURISTICS =
  import.meta.env.VITE_ENABLE_LOCAL_ROUTING_HEURISTICS === 'true';
const ENABLE_GUIDED_ONBOARDING_FLOW =
  import.meta.env.VITE_ENABLE_GUIDED_ONBOARDING_FLOW === 'true';

type GeneralBotResponse = {
  ok?: boolean;
  status?: 'completed' | 'expired' | 'renewal_due' | string;
  text?: string;
  source?: string;
  origin?: string;
  source_type?: string;
  response_type?: string;
  conversation_id?: string;
  routing?: {
    expiry_date?: string;
    days_remaining?: number;
    status?: 'expired' | 'renewal_due' | 'completed' | string;
    workflow_name?: string;
  };
  workflow_started?: boolean;
  agent?: {
    name?: string;
    version?: string;
  };
  warning?: {
    code?: string;
    message?: string;
  };
  error?: {
    code?: string;
    message?: string;
  };
};

type WorkflowRoute = 'general' | 'vendor' | 'renewal';

type ContactValidationErrors = {
  name?: string;
  email?: string;
  phone?: string;
};

const UAE_MOBILE_PREFIX_OPTIONS = ['51', '52', '53', '54', '55', '56', '57', '58', '59'] as const;

function splitUaeMobileNumber(value: string) {
  const normalized = normalizeUaeMobileNumber(value);
  const prefix = normalized.slice(0, 2);
  const localNumber = normalized.slice(2, 9);

  return {
    prefix: UAE_MOBILE_PREFIX_OPTIONS.includes(prefix as typeof UAE_MOBILE_PREFIX_OPTIONS[number])
      ? prefix
      : '51',
    localNumber,
  };
}

function composeUaeMobileNumber(prefix: string, localNumber: string) {
  const digits = localNumber.replace(/\D/g, '').slice(0, 7);
  if (!digits) {
    return '';
  }

  return `+971${prefix}${digits}`;
}

type VendorLookupSummary = {
  companyName: string;
  tradeLicenseNo: string;
  approvalStatus: string;
  lifecycleStatus: 'expired' | 'renewal_due' | 'completed';
  routeLabel: string;
  expDate: string;
  issueAuthority: string;
  address: string;
  phone: string;
  email: string;
  website: string;
  chamberNo: string;
  businessActivity: string;
};

const INITIAL_GUIDED_ONBOARDING_ANSWERS: GuidedOnboardingAnswerState = {
  companyName: '',
  contactName: '',
  contactEmail: '',
  phoneNumber: '',
};

function parseExpiryDateFromText(text: string) {
  const patterns = [
    /(?:Trade License Expiry(?: \(last on record\))?:?\s*)(\d{1,2}\s+[A-Za-z]{3,9}\s+\d{4})/i,
    /(?:expires on|expired on)\s+(\d{1,2}\s+[A-Za-z]{3,9}\s+\d{4})/i,
    /(\d{4}-\d{2}-\d{2})/,
  ];

  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match?.[1]) {
      const parsed = new Date(match[1]);
      if (!Number.isNaN(parsed.getTime())) {
        return parsed;
      }
    }
  }

  return null;
}

function parseVendorExpiryDate(value: string) {
  const patterns = [
    /(\d{1,2}\s+[A-Za-z]{3,9}\s+\d{4})/,
    /(\d{4}-\d{2}-\d{2})/,
  ];

  for (const pattern of patterns) {
    const match = value.match(pattern);
    if (!match?.[1]) {
      continue;
    }

    const parsed = new Date(match[1]);
    if (!Number.isNaN(parsed.getTime())) {
      return parsed;
    }
  }

  return null;
}

function getDaysRemainingFromExpiry(expDate: string) {
  const parsedExpiry = parseVendorExpiryDate(expDate);
  if (!parsedExpiry) {
    return null;
  }

  return Math.floor((parsedExpiry.getTime() - Date.now()) / 86400000);
}

function getVendorLifecycleStatus(expDate: string, approvalStatus?: string) {
  const parsedExpiry = parseVendorExpiryDate(expDate);
  const daysRemaining = getDaysRemainingFromExpiry(expDate);
  const normalizedApprovalStatus = (approvalStatus || '').toLowerCase();

  if (parsedExpiry && parsedExpiry.getTime() < Date.now()) {
    return 'expired' as const;
  }

  if (daysRemaining !== null && daysRemaining <= 60) {
    return 'renewal_due' as const;
  }

  if (normalizedApprovalStatus.includes('renewal')) {
    return 'renewal_due' as const;
  }

  return 'completed' as const;
}

function getVendorRouteLabel(lifecycleStatus: VendorLookupSummary['lifecycleStatus']) {
  if (lifecycleStatus === 'expired') {
    return 'TCG-Vendor-Approval-Workflow';
  }

  if (lifecycleStatus === 'renewal_due') {
    return 'Renewal-Vendor-Approval-Workflow';
  }

  return 'Vendor approval flow';
}

function getVendorBadgeLabel(summary: VendorLookupSummary) {
  if (summary.lifecycleStatus === 'expired') {
    return 'Expired';
  }

  if (summary.lifecycleStatus === 'renewal_due') {
    return 'Renewal due';
  }

  return summary.approvalStatus || 'Approved';
}

function inferWorkflowStatusFromText(text: string) {
  const normalized = text.toLowerCase();
  const expiryDate = parseExpiryDateFromText(text);

  if (
    normalized.includes('expired') ||
    normalized.includes('please verify renewal status') ||
    (expiryDate && expiryDate.getTime() < Date.now())
  ) {
    return 'expired' as const;
  }

  if (normalized.includes('renewal_due')) {
    return 'renewal_due' as const;
  }

  if (normalized.includes('renewal')) {
    return 'renewal_due' as const;
  }

  return 'completed' as const;
}

function getWorkflowStateFromResponse(response: GeneralBotResponse) {
  const sourceType = getStructuredSource(response);
  const responseType = getStructuredResponseType(response);

  if (sourceType === 'tbms') {
    return {
      workflowRoute: 'vendor' as WorkflowRoute,
      workflowStatus: 'completed' as const,
      workflowName: response.routing?.workflow_name || 'TBMS Vendor Lookup',
      workflowApiPath: '/api/tbms-vendor-lookup',
    };
  }

  if (sourceType === 'workflow') {
    const isRenewal = responseType.includes('renewal');
    return {
      workflowRoute: isRenewal ? 'renewal' as WorkflowRoute : 'vendor' as WorkflowRoute,
      workflowStatus: isRenewal ? 'renewal_due' as const : 'completed' as const,
      workflowName: response.routing?.workflow_name || (isRenewal ? 'Renewal-Vendor-Approval-Workflow' : 'TCG-Vendor-Approval-Workflow'),
      workflowApiPath: isRenewal ? '/api/renewal-vendor-approval-workflow' : '/api/vendor-approval-workflow',
    };
  }

  if (sourceType === 'backend') {
    return {
      workflowRoute: 'general' as WorkflowRoute,
      workflowStatus: 'completed' as const,
      workflowName: response.agent?.name || 'GENERAL_CHAT_AGENT_ID',
      workflowApiPath: '/api/invoke-general-bot',
    };
  }

  if (sourceType === 'llm' || sourceType === 'document_intelligence' || sourceType === 'storage') {
    return {
      workflowRoute: 'general' as WorkflowRoute,
      workflowStatus: 'completed' as const,
      workflowName: response.agent?.name || response.source_type || 'GENERAL_CHAT_AGENT_ID',
      workflowApiPath: '/api/invoke-general-bot',
    };
  }

  const inferredStatus = inferWorkflowStatusFromText(response.text || '');
  const explicitStatus = response.status || response.routing?.status;
  const status = inferredStatus !== 'completed' ? inferredStatus : (explicitStatus || inferredStatus);
  if (status === 'expired') {
    return {
      workflowRoute: 'vendor' as WorkflowRoute,
      workflowStatus: 'expired' as const,
      workflowName: response.routing?.workflow_name || 'TCG-Vendor-Approval-Workflow',
      workflowApiPath: '/api/vendor-approval-workflow',
    };
  }

  if (status === 'renewal_due') {
    return {
      workflowRoute: 'renewal' as WorkflowRoute,
      workflowStatus: 'renewal_due' as const,
      workflowName: response.routing?.workflow_name || 'Renewal-Vendor-Approval-Workflow',
      workflowApiPath: '/api/renewal-vendor-approval-workflow',
    };
  }

  return {
    workflowRoute: 'general' as WorkflowRoute,
    workflowStatus: 'completed' as const,
    workflowName: response.agent?.name || 'GENERAL_CHAT_AGENT_ID',
    workflowApiPath: '/api/invoke-general-bot',
  };
}

function stabilizeWorkflowState(
  previous: SupplierRegistrationState,
  next: {
    workflowRoute: WorkflowRoute;
    workflowStatus: NonNullable<SupplierRegistrationState['workflowStatus']>;
    workflowName: string;
    workflowApiPath: string;
  }
) {
  const currentRoute = previous.workflowRoute || 'general';
  const currentStatus = previous.workflowStatus;

  if (currentRoute === 'renewal') {
    return {
      workflowRoute: 'renewal' as WorkflowRoute,
      workflowStatus: currentStatus || next.workflowStatus,
      workflowName: previous.workflowName || next.workflowName,
      workflowApiPath: previous.workflowApiPath || next.workflowApiPath,
    };
  }

  if (currentRoute === 'vendor') {
    if (next.workflowRoute === 'renewal') {
      return next;
    }

    return {
      workflowRoute: 'vendor' as WorkflowRoute,
      workflowStatus: currentStatus || next.workflowStatus,
      workflowName: previous.workflowName || next.workflowName,
      workflowApiPath: previous.workflowApiPath || next.workflowApiPath,
    };
  }

  return next;
}

function getUploadTypeForStep(step: SupplierRegistrationState['currentStep']) {
  if (step === 'trade_license_upload') {
    return 'trade_license' as const;
  }

  if (step === 'vat_upload') {
    return 'vat_certificate' as const;
  }

  if (step === 'bank_document_upload') {
    return 'bank_document' as const;
  }

  return null;
}

function isQuestionLikeText(value: string) {
  const normalized = value.trim().toLowerCase();
  if (!normalized) {
    return false;
  }

  if (/\?$/.test(normalized)) {
    return true;
  }

  return /^(what|how|why|when|where|who|which|can you|could you|would you|should i|is it|are you|am i|do you|does it|please)\b/.test(normalized);
}

function getGuidedValidationError(field: GuidedOnboardingField, value: string) {
  if (field === 'companyName') {
    const result = validateGuidedCompanyName(value);
    return result.valid ? '' : result.reason;
  }

  if (field === 'contactEmail') {
    const result = validateGuidedEmail(value);
    return result.valid ? '' : result.reason;
  }

  if (field === 'phoneNumber') {
    const result = validateGuidedPhoneNumber(value);
    return result.valid ? '' : result.reason;
  }

  return '';
}

function getNormalizedGuidedAnswer(field: GuidedOnboardingField, value: string) {
  if (field === 'phoneNumber') {
    return normalizeGuidedPhoneNumber(value);
  }

  return normalizeGuidedOnboardingAnswer(field, value);
}

type GuidedOnboardingLLMClassification = {
  kind: 'company_name' | 'greeting' | 'unrelated';
  value: string;
  reason: string;
};

function parseGuidedOnboardingClassification(text: string): GuidedOnboardingLLMClassification | null {
  const trimmed = text.trim();
  if (!trimmed) {
    return null;
  }

  const jsonMatch = trimmed.match(/\{[\s\S]*\}/);
  if (jsonMatch?.[0]) {
    try {
      const parsed = JSON.parse(jsonMatch[0]) as Partial<GuidedOnboardingLLMClassification>;
      if (parsed.kind === 'company_name' || parsed.kind === 'greeting' || parsed.kind === 'unrelated') {
        return {
          kind: parsed.kind,
          value: typeof parsed.value === 'string' ? parsed.value.trim() : '',
          reason: typeof parsed.reason === 'string' ? parsed.reason.trim() : '',
        };
      }
    } catch {
      return null;
    }
  }

  return null;
}

async function classifyGuidedOnboardingReply(userText: string): Promise<GuidedOnboardingLLMClassification> {
  const fallback = (kind: GuidedOnboardingLLMClassification['kind'], value = '', reason = '') => ({
    kind,
    value,
    reason,
  });

  try {
    const response = await fetch('/api/invoke-general-bot', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        intent: 'general_chat',
        text: userText,
        message: userText,
        prompt: [
          GUIDED_ONBOARDING_CONFIG.companyNameClassifierPrompt,
          '',
          `User reply: ${userText}`,
        ].join('\n'),
      }),
    });

    const data = (await response.json()) as GeneralBotResponse;
    const parsed = parseGuidedOnboardingClassification(data.text || '');
    if (parsed) {
      return parsed;
    }
  } catch {
    // Fall through to deterministic fallback below.
  }

  const normalized = userText.trim();
  if (!normalized) {
    return fallback('unrelated', '', 'Empty reply.');
  }

  if (/^(hi|hello|hey|thanks|thank you)\b/i.test(normalized)) {
    return fallback('greeting', '', 'Greeting detected.');
  }

  if (isQuestionLikeText(normalized)) {
    return fallback('unrelated', '', 'Question-like reply detected.');
  }

  return fallback('company_name', normalized, 'No greeting detected; treating as company name.');
}

function extractVendorName(text: string) {
  const match = text.match(/Vendor Name:\s*(.+)/i);
  return match?.[1]?.trim() || '';
}

function getFirstTbmsVendor(response: GeneralBotResponse) {
  const vendors = (response as any)?.data?.data?.vendors;
  return Array.isArray(vendors) && vendors.length > 0 ? vendors[0] : null;
}

function hasTbmsVendorResults(response: GeneralBotResponse) {
  return Boolean(getFirstTbmsVendor(response));
}

function getVendorDisplayName(response: GeneralBotResponse) {
  const tbmsVendor = getFirstTbmsVendor(response);
  if (tbmsVendor?.vendName) {
    return String(tbmsVendor.vendName).trim();
  }

  return extractVendorName(response.text || '');
}

function getStructuredSource(response: GeneralBotResponse) {
  return (response.source_type || response.source || '').toLowerCase();
}

function getStructuredResponseType(response: GeneralBotResponse) {
  return (response.response_type || '').toLowerCase();
}

function classifyInitialInput(value: string) {
  const normalized = value.trim();
  const lower = normalized.toLowerCase();
  const singleTokenStopwords = new Set([
    'name',
    'company',
    'vendor',
    'trade',
    'license',
    'licence',
    'number',
    'no',
    'id',
    'email',
    'mail',
    'phone',
    'mobile',
  ]);

  if (!normalized) {
    return { intent: 'general_chat' as const, extracted: '', rule: 'empty_input' };
  }

  if (/^(hi|hello|hey|thanks|thank you|good morning|good evening|good afternoon)\b/.test(lower)) {
    return { intent: 'general_chat' as const, extracted: '', rule: 'greeting' };
  }

  const explicitPatterns = [
    /\b(my|our)\s+company\s+name\s+is\s+(.+)$/i,
    /\b(company\s+name|company|vendor\s+name|vendor)\s*[:\-]?\s*(.+)$/i,
    /\b(trade\s+license\s+number|trade\s+license\s+no|license\s+number|license\s+no|licence\s+number|licence\s+no)\s*[:\-]?\s*(.+)$/i,
  ];

  for (const pattern of explicitPatterns) {
    const match = normalized.match(pattern);
    if (match?.[2]) {
      return {
        intent: /trade\s+license|license|licence/i.test(match[1]) ? 'vendor_lookup' as const : 'vendor_lookup' as const,
        extracted: match[2].trim(),
        rule: 'explicit_lookup_phrase',
      };
    }
  }

  if (
    /\b(company name|my company|our company|vendor name|vendor|trade license|license number|license no|licence number|licence no)\b/i.test(normalized)
  ) {
    return { intent: 'vendor_lookup' as const, extracted: normalized, rule: 'keyword_lookup' };
  }

  const words = normalized.split(/\s+/);
  const looksLikeQuestion = /[?]/.test(normalized) || /^(what|how|why|when|where|who|can you|could you|please)\b/i.test(lower);
  const mostlyAlpha = /^[A-Za-z0-9&().,\-\/\s]+$/.test(normalized);
  const isLikelyGreeting = /(hi|hello|hey|thanks|thank you)/i.test(lower);

  if (looksLikeQuestion || isLikelyGreeting) {
    return { intent: 'general_chat' as const, extracted: '', rule: looksLikeQuestion ? 'question' : 'greeting' };
  }

  const standaloneNameLike =
    mostlyAlpha &&
    words.length <= 6 &&
    /[A-Za-z]/.test(normalized) &&
    !/[,:;?]/.test(normalized) &&
    !(words.length === 1 && singleTokenStopwords.has(lower));

  return {
    intent: standaloneNameLike ? 'vendor_lookup' as const : 'general_chat' as const,
    extracted: normalized,
    rule: standaloneNameLike ? 'standalone_name_like' : 'not_name_like',
  };
}

function shouldShowContactForm(response: GeneralBotResponse) {
  const sourceType = getStructuredSource(response);
  const responseType = getStructuredResponseType(response);

  if (response.ok === false) {
    return false;
  }

  if (sourceType === 'tbms' || sourceType === 'workflow') {
    return true;
  }

  if (
    responseType.includes('vendor_lookup') ||
    responseType.includes('trade_license') ||
    responseType.includes('workflow_routed') ||
    responseType.includes('vendor')
  ) {
    return true;
  }

  const normalized = (response.text || '').toLowerCase();
  return (
    normalized.includes('vendor name:') ||
    normalized.includes('trade license no.:') ||
    normalized.includes('trade license no:') ||
    normalized.includes('license expiry date:') ||
    normalized.includes('approved vendor') ||
    normalized.includes('route: vendor approval') ||
    normalized.includes('route: renewal approval')
  );
}

function validateContactInfo(name: string, email: string, phone: string): ContactValidationErrors {
  const errors: ContactValidationErrors = {};
  const trimmedName = name.trim();
  const trimmedEmail = email.trim();
  const trimmedPhone = phone.trim();
  const normalizedPhone = normalizeUaeMobileNumber(trimmedPhone);

  if (!trimmedName) {
    errors.name = 'Full name is required.';
  }

  if (!trimmedEmail) {
    errors.email = 'Email address is required.';
  } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail)) {
    errors.email = 'Enter a valid email address.';
  }

  if (!trimmedPhone) {
    errors.phone = 'UAE mobile number is required.';
  } else if (!/^5[1-9]\d{7}$/.test(normalizedPhone)) {
    errors.phone = 'Enter a valid UAE mobile number using +971 and a 51 to 59 prefix followed by 7 digits.';
  }

  return errors;
}

export default function AIAgentChat({
  registrationState,
  setRegistrationState,
  onAnalyzeDocument,
  chatHistory,
  setChatHistory,
}: AIAgentChatProps) {
  const [inputText, setInputText] = useState('');
  const [isUploading, setIsUploading] = useState(false);
  const [isRequestInProgress, setIsRequestInProgress] = useState(false);
  const [activeUploadType, setActiveUploadType] = useState<'trade_license' | 'vat_certificate' | 'bank_document' | null>('trade_license');
  const [contactValidationAttempted, setContactValidationAttempted] = useState(false);
  const [contactErrors, setContactErrors] = useState<ContactValidationErrors>({});
  const [uaePhonePrefix, setUaePhonePrefix] = useState<'51' | '52' | '53' | '54' | '55' | '56' | '57' | '58' | '59'>('51');
  const [uaePhoneLocalNumber, setUaePhoneLocalNumber] = useState('');
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [vendorLookupSummary, setVendorLookupSummary] = useState<VendorLookupSummary | null>(null);
  const [guidedOnboardingActive, setGuidedOnboardingActive] = useState(false);
  const [guidedOnboardingStepIndex, setGuidedOnboardingStepIndex] = useState(-1);
  const [guidedOnboardingAnswers, setGuidedOnboardingAnswers] = useState<GuidedOnboardingAnswerState>(INITIAL_GUIDED_ONBOARDING_ANSWERS);
  const [guidedInlineError, setGuidedInlineError] = useState('');
  const chatEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const uploadTypeForCurrentStep = getUploadTypeForStep(registrationState.currentStep);
  const canShowUploadPanel = !guidedOnboardingActive && Boolean(uploadTypeForCurrentStep);
  const effectiveUploadType = canShowUploadPanel ? uploadTypeForCurrentStep : null;

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatHistory, isRequestInProgress, vendorLookupSummary, registrationState.currentStep, registrationState.workflowRoute]);

  useEffect(() => {
    if (chatHistory.length === 0) {
      setConversationId(null);
      setVendorLookupSummary(null);
      setGuidedOnboardingActive(false);
      setGuidedOnboardingStepIndex(-1);
      setGuidedOnboardingAnswers(INITIAL_GUIDED_ONBOARDING_ANSWERS);
      setGuidedInlineError('');
    }
  }, [chatHistory.length]);

  useEffect(() => {
    setGuidedInlineError('');
  }, [guidedOnboardingStepIndex, guidedOnboardingActive]);

  // Adjust active expectations based on registration sequence step
  useEffect(() => {
    if (registrationState.currentStep === 'initial') {
      setActiveUploadType(null);
    } else if (registrationState.currentStep === 'trade_license_upload') {
      setActiveUploadType('trade_license');
    } else if (registrationState.currentStep === 'vat_upload') {
      setActiveUploadType('vat_certificate');
    } else if (registrationState.currentStep === 'bank_document_upload') {
      setActiveUploadType('bank_document');
    } else {
      setActiveUploadType(null);
    }
  }, [registrationState.currentStep]);

  // Automated welcome script on initial mount
  useEffect(() => {
    if (chatHistory.length === 0) {
      setChatHistory([
        {
          id: 'welcome',
          sender: 'agent',
          text: `Hello and welcome to the Secure Supplier Portal! 🛡️\n\nI am your AI Onboarding Assistant. I am here to guide you step-by-step through our supplier registration program. To align with corporate and compliance standards, we require authentication of three vital company certificates in real-time:\n\n1. **Valid Trade License**\n2. **VAT Registration Certificate**\n3. **Official Bank Document (Account ownership statement)**\n\nLet's begin! **What is the registered Commercial Name of your Enterprise?**`,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        }
      ]);
    }
  }, []);

  useEffect(() => {
    if (!contactValidationAttempted) {
      return;
    }

    setContactErrors(
      validateContactInfo(
        registrationState.contactName,
        registrationState.contactEmail,
        registrationState.phoneNumber
      )
    );
  }, [
    contactValidationAttempted,
    registrationState.contactName,
    registrationState.contactEmail,
    registrationState.phoneNumber
  ]);

  useEffect(() => {
    const { prefix, localNumber } = splitUaeMobileNumber(registrationState.phoneNumber);
    setUaePhonePrefix(prefix as typeof uaePhonePrefix);
    setUaePhoneLocalNumber(localNumber);
  }, [registrationState.phoneNumber]);

  const handleSendMessage = async (textToSend?: string) => {
    const text = (textToSend || inputText).trim();
    if (!text) return;

    if (showContactSetup) {
      setInputText('');
      return;
    }

    const normalizedCompanyCandidate = normalizeGuidedOnboardingAnswer('companyName', text);
    const directCompanyCandidate = validateGuidedCompanyName(normalizedCompanyCandidate).valid
      ? normalizedCompanyCandidate
      : '';

    const initialInputClassification =
      ENABLE_LOCAL_ROUTING_HEURISTICS && registrationState.currentStep === 'initial'
        ? classifyInitialInput(text)
        : { intent: 'general_chat' as const, extracted: '', rule: 'llm_only' };

    if (!textToSend) {
      setInputText('');
    }

    if (guidedInlineError) {
      setGuidedInlineError('');
    }

    // Add user message to history
    const userMsgId = 'user-' + Date.now();
    const newUserMessage: ChatMessage = {
      id: userMsgId,
      sender: 'user',
      text: text,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };

    setChatHistory(prev => [...prev, newUserMessage]);

    if (ENABLE_GUIDED_ONBOARDING_FLOW) {
      if (
        !guidedOnboardingActive &&
        registrationState.currentStep === 'initial' &&
        directCompanyCandidate
      ) {
        setGuidedOnboardingActive(false);
        setGuidedOnboardingStepIndex(-1);
        setIsRequestInProgress(true);
        setGuidedInlineError('');
        setConversationId(null);
        setVendorLookupSummary(null);
        setRegistrationState(prev => ({
          ...prev,
          companyName: directCompanyCandidate,
          currentStep: 'contact_info',
          workflowRoute: 'general',
          workflowStatus: 'completed',
          workflowName: 'GUIDED_SUPPLIER_ONBOARDING',
          workflowApiPath: '/api/invoke-general-bot'
        }));

        setIsRequestInProgress(false);

        return;
      }

      const shouldStartGuidedOnboarding = !guidedOnboardingActive && isGuidedOnboardingTrigger(text);

      if (shouldStartGuidedOnboarding) {
        const hasValidStoredCompanyName = validateGuidedCompanyName(registrationState.companyName || '').valid;
        if (hasValidStoredCompanyName) {
          setGuidedOnboardingActive(false);
          setGuidedOnboardingStepIndex(-1);
          setContactValidationAttempted(false);
          setContactErrors({});
          setRegistrationState(prev => ({
            ...prev,
            currentStep: 'contact_info',
            workflowRoute: 'general',
            workflowStatus: 'completed',
            workflowName: 'GUIDED_SUPPLIER_ONBOARDING',
            workflowApiPath: '/api/invoke-general-bot'
          }));

          setTimeout(() => {
            setIsRequestInProgress(false);
          }, 350);

          return;
        }

        activateGuidedOnboarding(0);

        setTimeout(async () => {
          await streamChatMessage(
            setChatHistory,
            getGuidedOnboardingStartPrompt(0),
            {
              onFirstChunk: () => setIsRequestInProgress(false)
            }
          );
        }, 350);

        return;
      }

      if (guidedOnboardingActive) {
        const currentQuestion = getGuidedOnboardingQuestion(guidedOnboardingStepIndex);

        if (currentQuestion) {
          if (currentQuestion.field === 'companyName') {
            setIsRequestInProgress(true);
            const classification = await classifyGuidedOnboardingReply(text);
            const candidate = normalizeGuidedOnboardingAnswer(currentQuestion.field, classification.value || text);
            const validationError = getGuidedValidationError(currentQuestion.field, candidate);
            if (validationError) {
              setGuidedInlineError(`Company name rejected: ${validationError}`);
              setIsRequestInProgress(false);
              return;
            }

            setGuidedInlineError('');
            const answer = candidate;

            setGuidedOnboardingAnswers(prev => ({
              ...prev,
              [currentQuestion.field]: answer
            }));

            setRegistrationState(prev => applyGuidedAnswerToRegistrationState(prev, currentQuestion.field, answer));
            setGuidedOnboardingActive(false);
            setGuidedOnboardingStepIndex(-1);
            setIsRequestInProgress(true);

            setTimeout(async () => {
              setRegistrationState(prev => ({
                ...prev,
                currentStep: 'contact_info',
                workflowName: 'GUIDED_SUPPLIER_ONBOARDING',
                workflowApiPath: '/api/invoke-general-bot'
              }));

              setIsRequestInProgress(false);
            }, 350);

            return;
          }

          const candidate = getNormalizedGuidedAnswer(currentQuestion.field, text);
          const validationError = getGuidedValidationError(currentQuestion.field, candidate);
          if (validationError) {
            const prefix =
              currentQuestion.field === 'contactEmail'
                ? 'Email rejected'
                : currentQuestion.field === 'phoneNumber'
                  ? 'Mobile number rejected'
                  : `${getGuidedOnboardingFieldLabel(currentQuestion.field)} rejected`;

            setGuidedInlineError(`${prefix}: ${validationError}`);
            setIsRequestInProgress(false);
            return;
          }

          setGuidedInlineError('');
          const answer = candidate;
          const nextQuestionIndex = guidedOnboardingStepIndex + 1;
          const nextQuestion = getGuidedOnboardingQuestion(nextQuestionIndex);

          setGuidedOnboardingAnswers(prev => ({
            ...prev,
            [currentQuestion.field]: answer
          }));

          setRegistrationState(prev => applyGuidedAnswerToRegistrationState(prev, currentQuestion.field, answer));
          setGuidedOnboardingStepIndex(nextQuestionIndex);
          setIsRequestInProgress(true);

          setTimeout(async () => {
            if (nextQuestion) {
              await streamChatMessage(
                setChatHistory,
                `Captured your ${getGuidedOnboardingFieldLabel(currentQuestion.field)}.\n\n${formatGuidedOnboardingPrompt(nextQuestion.prompt)}`,
                {
                  onFirstChunk: () => setIsRequestInProgress(false)
                }
              );
            } else {
              setGuidedOnboardingActive(false);
              setGuidedOnboardingStepIndex(-1);
              setRegistrationState(prev => ({
                ...prev,
                currentStep: 'trade_license_upload',
                workflowRoute: 'general',
                workflowStatus: 'completed',
                workflowName: 'GUIDED_SUPPLIER_ONBOARDING',
                workflowApiPath: '/api/invoke-general-bot'
              }));

              await streamChatMessage(
                setChatHistory,
                getGuidedOnboardingCompletionPrompt({
                  ...guidedOnboardingAnswers,
                  [currentQuestion.field]: answer
                }),
                {
                  onFirstChunk: () => setIsRequestInProgress(false)
                }
              );
            }
          }, 350);

          return;
        }
      }
    }

    // Handle bot logic processing based on state
    setTimeout(() => {
      processAgentResponse(text, initialInputClassification);
    }, 800);
  };

  const processAgentResponse = async (
    userText: string,
    classification: { intent: 'vendor_lookup' | 'general_chat'; extracted: string }
  ) => {
    setIsRequestInProgress(true);
    const forceVendorLookup = ENABLE_LOCAL_ROUTING_HEURISTICS && classification.intent === 'vendor_lookup';

    try {
      const response = await fetch('/api/invoke-general-bot', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: userText,
          message: userText,
          prompt: userText,
          intent: forceVendorLookup ? 'vendor_lookup' : 'general_chat',
          extracted_subject: forceVendorLookup ? classification.extracted : '',
          conversation_id: conversationId
        })
      });

      const data = (await response.json()) as GeneralBotResponse;
      const isServerError =
        !response.ok ||
        data.ok === false ||
        data.error?.code === 'response_parse_error' ||
        data.status === 'error';

      if (isServerError) {
        setRegistrationState(prev => ({
          ...prev,
          currentStep: 'initial'
        }));

        await streamChatMessage(
          setChatHistory,
          `The server is temporarily unavailable. Please try again in a moment.`,
          {
            onFirstChunk: () => setIsRequestInProgress(false)
          }
        );
        return;
      }

      const workflowState = getWorkflowStateFromResponse(data);
      const responseText = data.text || 'No response text returned from the workflow router.';
      const vendorName = getVendorDisplayName(data);
      const tbmsVendor = getFirstTbmsVendor(data);
      const showContactForm = shouldShowContactForm(data);
      const shouldOpenContactSetup = forceVendorLookup && !tbmsVendor;
      const tbmsLifecycleStatus = tbmsVendor
        ? getVendorLifecycleStatus(
            String(tbmsVendor.expDate || ''),
            String(tbmsVendor.approvalStatus || '')
          )
        : null;
      const finalWorkflowRoute = tbmsLifecycleStatus
        ? tbmsLifecycleStatus === 'renewal_due'
          ? 'renewal'
          : tbmsLifecycleStatus === 'expired'
            ? 'vendor'
            : 'vendor'
        : forceVendorLookup
          ? 'vendor'
        : workflowState.workflowRoute;
      const finalWorkflowStatus = tbmsLifecycleStatus
        ? tbmsLifecycleStatus
        : forceVendorLookup
          ? 'completed'
        : workflowState.workflowStatus;

      setRegistrationState(prev => {
        const validVendorName = validateGuidedCompanyName(vendorName).valid ? vendorName : '';
        const validUserCompanyName = validateGuidedCompanyName(userText).valid ? userText : '';

        return {
          ...prev,
          ...stabilizeWorkflowState(prev, {
            workflowRoute: finalWorkflowRoute,
            workflowStatus: finalWorkflowStatus,
            workflowName: tbmsLifecycleStatus
              ? tbmsLifecycleStatus === 'renewal_due'
                ? 'Renewal-Vendor-Approval-Workflow'
                : 'TCG-Vendor-Approval-Workflow'
              : forceVendorLookup
                ? 'TCG-Vendor-Approval-Workflow'
              : workflowState.workflowName,
            workflowApiPath: tbmsLifecycleStatus
              ? tbmsLifecycleStatus === 'renewal_due'
                ? '/api/renewal-vendor-approval-workflow'
                : '/api/vendor-approval-workflow'
              : forceVendorLookup
                ? '/api/vendor-approval-workflow'
              : workflowState.workflowApiPath,
          }),
          companyName: prev.companyName || validVendorName || validUserCompanyName,
          currentStep: 'initial'
        };
      });

      if (tbmsVendor) {
        const lifecycleStatus = tbmsLifecycleStatus || getVendorLifecycleStatus(
          String(tbmsVendor.expDate || ''),
          String(tbmsVendor.approvalStatus || '')
        );

        setVendorLookupSummary({
          companyName: String(tbmsVendor.vendName || vendorName || userText).trim(),
          tradeLicenseNo: String(tbmsVendor.tradeLicenseNo || 'N/A'),
          approvalStatus: String(tbmsVendor.approvalStatus || 'N/A'),
          lifecycleStatus,
          routeLabel: getVendorRouteLabel(lifecycleStatus),
          expDate: String(tbmsVendor.expDate || 'N/A'),
          issueAuthority: String(tbmsVendor.issueAuthority || 'N/A'),
          address: String(tbmsVendor.address || 'N/A').replace(/\r?\n/g, ', '),
          phone: String(tbmsVendor.tel || 'N/A'),
          email: String(tbmsVendor.email || 'N/A').replace(/\.$/, ''),
          website: String(tbmsVendor.website || 'N/A'),
          chamberNo: String(tbmsVendor.chamberNo || 'N/A'),
          businessActivity: String(tbmsVendor.tradeActivities || 'N/A'),
        });
      } else if (forceVendorLookup || getStructuredSource(data) === 'tbms') {
        setVendorLookupSummary(null);
      } else {
        setVendorLookupSummary(null);
      }

      if (data.conversation_id) {
        setConversationId(data.conversation_id);
      }

      if (!tbmsVendor) {
        await streamChatMessage(
          setChatHistory,
          forceVendorLookup || getStructuredSource(data) === 'tbms'
            ? `No vendor match found. Please enter the contact details below to continue.`
            : responseText,
          {
            onFirstChunk: () => setIsRequestInProgress(false)
          }
        );
      }

      if (showContactForm || shouldOpenContactSetup) {
        setRegistrationState(prev => ({
          ...prev,
          currentStep: 'contact_info'
        }));
      }
    } catch (error: any) {
      await streamChatMessage(
        setChatHistory,
        `The server is temporarily unavailable. Please try again in a moment.`,
        {
          onFirstChunk: () => setIsRequestInProgress(false)
        }
      );
    } finally {
      setIsRequestInProgress(false);
    }
  };

  const handleSaveContactInfo = () => {
    setContactValidationAttempted(true);

    const validationErrors = validateContactInfo(
      registrationState.contactName,
      registrationState.contactEmail,
      registrationState.phoneNumber
    );

    setContactErrors(validationErrors);

    if (Object.keys(validationErrors).length > 0) {
      return;
    }

    const cName = registrationState.contactName.trim();
    const cEmail = registrationState.contactEmail.trim();
    const cPhone = registrationState.phoneNumber.trim();

    setChatHistory(prev => [
      ...prev,
      {
        id: 'contact-submit-' + Date.now(),
        sender: 'user',
        text: `Full Name: ${cName}\nEmail: ${cEmail}\nMobile: ${cPhone}`,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      }
    ]);

    setTimeout(async () => {
      setRegistrationState(prev => ({
        ...prev,
        contactName: cName,
        contactEmail: cEmail,
        phoneNumber: cPhone,
        currentStep: 'trade_license_upload'
      }));

      setContactValidationAttempted(false);
      setContactErrors({});

      await streamChatMessage(
        setChatHistory,
        `✦ **Contact Details Registered** ✦\n\n- **Recipient Name**: "${cName}"\n- **Notification Channels**: Email (${cEmail}) & SMS (${cPhone})\n\nNow, let's verify your company's credentials.\n\nPlease upload or drop your **Valid Trade License** (PDF) to proceed.`
      );
    }, 850);
  };

  // Upload actions orchestration
  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0 || !uploadTypeForCurrentStep) return;
    await processFileUpload(files[0], uploadTypeForCurrentStep);
  };

  const processFileUpload = async (file: File, type: 'trade_license' | 'vat_certificate' | 'bank_document') => {
    setIsUploading(true);
    
    const logId = 'upload-' + Date.now();
    setChatHistory(prev => [...prev, {
      id: logId,
      sender: 'system',
      text: `Preparing "${file.name}" for ${type.replace(/_/g, ' ')} validation...`,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    }]);

    try {
      const reader = new FileReader();
      reader.onload = async (event) => {
        const base64 = event.target?.result as string;

        try {
          setChatHistory(prev => [...prev, {
            id: 'upload-start-' + Date.now(),
            sender: 'system',
            text: `Validation request started for ${type.replace(/_/g, ' ')}. Sending file to the API...`,
            timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
          }]);

          await onAnalyzeDocument(
            type,
            base64,
            file.type,
            { companyName: registrationState.companyName || 'AeroTech Solutions Ltd' }
          );
        } catch (error: any) {
          setChatHistory(prev => [...prev, {
            id: 'error-' + Date.now(),
            sender: 'agent',
            text: `Validation failed: ${error?.message || 'Unknown error'}.`,
            timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
          }]);
        } finally {
          setIsUploading(false);
        }
      };

      reader.onerror = () => {
        setIsUploading(false);
        setChatHistory(prev => [...prev, {
          id: 'error-' + Date.now(),
          sender: 'agent',
          text: `Error reading "${file.name}". Please retry.`,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        }]);
      };
      
      reader.readAsDataURL(file);
    } catch (err: any) {
      console.error(err);
      setIsUploading(false);
      setChatHistory(prev => [...prev, {
        id: 'error-' + Date.now(),
        sender: 'agent',
        text: `Error uploading document: ${err.message || 'File processing failed'}. Please retry.`,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      }]);
    }
  };

  // Drag and drop events
  const [dragActive, setDragActive] = useState(false);

  const renderFormattedText = (text: string) => {
    const parts = text.split(/(\*\*[^*]+\*\*)/g);

    return parts.map((part, index) => {
      if (part.startsWith('**') && part.endsWith('**') && part.length > 4) {
        return (
          <strong key={`${index}-${part}`} className="font-bold">
            {part.slice(2, -2)}
          </strong>
        );
      }

      return <React.Fragment key={`${index}-${part}`}>{part}</React.Fragment>;
    });
  };

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    
    if (!uploadTypeForCurrentStep) return;

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      await processFileUpload(e.dataTransfer.files[0], uploadTypeForCurrentStep);
    }
  };

  const getStepIndicator = () => {
    if (guidedOnboardingActive) return 'Workflow: Guided Supplier Onboarding';
    if (registrationState.currentStep === 'initial') return 'Step 1: Account Identification';
    if (registrationState.currentStep === 'contact_info') return 'Step 2: Notification Setup';
    if (registrationState.currentStep === 'trade_license_upload') return 'Step 3: Trade License Audit';
    if (registrationState.currentStep === 'vat_upload') return 'Step 4: VAT Compliance Audit';
    if (registrationState.currentStep === 'bank_document_upload') return 'Step 5: Bank Account Clearance';
    if (registrationState.currentStep === 'review') return 'Step 6: Compliance Scores';
    if (registrationState.workflowRoute === 'vendor') return 'Workflow: Vendor Approval';
    if (registrationState.workflowRoute === 'renewal') return 'Workflow: Renewal Approval';
    if (registrationState.workflowRoute === 'general') return 'Workflow: General Bot';
    return 'Workflow: Awaiting Input';
  };

  const isAgentStreaming = chatHistory.some(message => message.sender === 'agent' && message.isPending);
  const showContactSetup =
    registrationState.currentStep === 'contact_info' &&
    (registrationState.workflowRoute !== 'general' || registrationState.workflowName === 'GUIDED_SUPPLIER_ONBOARDING');

  const activateGuidedOnboarding = (startIndex = 0) => {
    setGuidedOnboardingActive(true);
    setGuidedOnboardingStepIndex(startIndex);
    setGuidedOnboardingAnswers(INITIAL_GUIDED_ONBOARDING_ANSWERS);
    setIsRequestInProgress(true);
    setConversationId(null);
    setVendorLookupSummary(null);
    setContactValidationAttempted(false);
    setContactErrors({});
    setRegistrationState(prev => ({
      ...prev,
      currentStep: 'initial',
      workflowRoute: 'general',
      workflowStatus: 'completed',
      workflowName: 'GUIDED_SUPPLIER_ONBOARDING',
      workflowApiPath: '/api/invoke-general-bot'
    }));
  };

  const startGuidedOnboarding = () => {
    const hasValidStoredCompanyName = validateGuidedCompanyName(registrationState.companyName || '').valid;
    if (hasValidStoredCompanyName) {
      setGuidedOnboardingActive(false);
      setGuidedOnboardingStepIndex(-1);
      setContactValidationAttempted(false);
      setContactErrors({});
      setIsRequestInProgress(true);
      setRegistrationState(prev => ({
        ...prev,
        currentStep: 'contact_info',
        workflowRoute: 'general',
        workflowStatus: 'completed',
        workflowName: 'GUIDED_SUPPLIER_ONBOARDING',
        workflowApiPath: '/api/invoke-general-bot'
      }));

      setIsRequestInProgress(false);
      return;
    }

    activateGuidedOnboarding(0);
    void streamChatMessage(
      setChatHistory,
      getGuidedOnboardingStartPrompt(0),
      {
        onFirstChunk: () => setIsRequestInProgress(false)
      }
    );
  };

  const stopGuidedOnboarding = () => {
    setGuidedOnboardingActive(false);
    setGuidedOnboardingStepIndex(-1);
    setIsRequestInProgress(false);
  };
  return (
    <div className="flex flex-col h-[600px] border border-slate-200 bg-white rounded-lg overflow-hidden shadow-sm">
      {/* Bot Chat Header with security seal */}
      <div className="bg-white px-6 py-4 border-b border-slate-200 flex items-center justify-between shadow-sm">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600">
            <Bot className="w-4 h-4" />
          </div>
            <div>
            <h2 className="text-sm font-bold text-slate-900 tracking-tight">Onboarding Officer (AI Agent)</h2>
            <div className="flex items-center gap-1.5 text-[10px] text-slate-500">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
              <span>Real-time OCR Validation Service Online</span>
            </div>
          </div>
        </div>
        <div className="text-right flex items-center gap-2">
          {ENABLE_GUIDED_ONBOARDING_FLOW && (
            <button
              type="button"
              onClick={guidedOnboardingActive ? stopGuidedOnboarding : startGuidedOnboarding}
              className={`text-[10px] uppercase font-bold tracking-widest px-2 py-1 rounded-sm border transition ${
                guidedOnboardingActive
                  ? 'text-amber-700 bg-amber-50 border-amber-200 hover:bg-amber-100'
                  : 'text-indigo-600 bg-indigo-50 border-indigo-100 hover:bg-indigo-100'
              }`}
            >
              {guidedOnboardingActive ? 'Exit Guided Mode' : 'Guided Onboarding'}
            </button>
          )}
          <span className="text-[10px] uppercase font-bold tracking-widest text-indigo-600 bg-indigo-50 border border-indigo-100 px-2 py-1 rounded-sm">
            {getStepIndicator()}
          </span>
        </div>
      </div>

      {/* Messages Scroll Frame */}
      <div className="flex-1 overflow-y-auto p-5 space-y-4 bg-slate-50">
        {chatHistory.map((msg) => {
          if (msg.sender === 'system') {
            const isLatest = chatHistory[chatHistory.length - 1]?.id === msg.id;
            const shouldSpin = isUploading && isLatest;
            return (
              <div key={msg.id} className="flex justify-center">
                <div className={`text-[10px] py-1 px-3 rounded border flex items-center gap-2 ${
                  shouldSpin 
                    ? 'bg-indigo-50 text-indigo-700 font-mono border-indigo-100 shadow-xs' 
                    : 'bg-slate-100 text-slate-500 font-mono border-slate-200'
                }`}>
                  {shouldSpin ? (
                    <RefreshCw className="w-3 h-3 animate-spin text-indigo-500" />
                  ) : (
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                  )}
                  <span>{msg.text}</span>
                </div>
              </div>
            );
          }

          const isUser = msg.sender === 'user';
          return (
            <div
              key={msg.id}
              className={`flex ${isUser ? 'justify-end' : 'justify-start'} items-end gap-2`}
            >
              {!isUser && (
                <div className="w-6 h-6 rounded-full bg-indigo-50 text-indigo-600 flex items-center justify-center shrink-0 border border-indigo-100 text-[10px] font-bold">
                  AI
                </div>
              )}
              
              <div className={`max-w-[85%] rounded-lg px-4 py-3 text-xs leading-relaxed ${
                isUser 
                  ? 'bg-indigo-600 text-white rounded-br-none font-medium shadow-sm' 
                  : 'bg-white text-slate-800 border border-slate-200 rounded-bl-none shadow-sm'
              }`}>
                {/* Process text highlights for headings/bold styling */}
                <div className="whitespace-pre-line font-sans">
                  {msg.isPending && !msg.text ? (
                    <span className="text-slate-400 italic">Typing…</span>
                  ) : (
                    <>
                      {renderFormattedText(msg.text)}
                      {msg.isPending && <span className="ml-1 inline-block animate-pulse text-slate-400">▍</span>}
                    </>
                  )}
                </div>
                
                {msg.fileDetails && (
                  <div className="mt-2.5 flex items-center gap-2 bg-slate-50 border border-slate-200 p-2.5 rounded text-[11px] font-mono">
                    <FileText className="w-4 h-4 text-indigo-500" />
                    <div className="flex-1 overflow-hidden text-slate-700">
                      <p className="font-semibold truncate">{msg.fileDetails.name}</p>
                      <p className="text-[9px] text-slate-400">{msg.fileDetails.size}</p>
                    </div>
                  </div>
                )}
                
                <p className="text-[9px] text-right text-slate-400 mt-1 font-mono">{msg.timestamp}</p>
              </div>
            </div>
          );
        })}

        {vendorLookupSummary && (
          <div className="max-w-[90%] mx-auto rounded-lg border border-emerald-200 bg-emerald-50/80 p-4 shadow-sm space-y-3 animate-fade-in">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-[10px] uppercase tracking-widest font-bold text-emerald-700">Vendor Lookup Result</p>
                <h3 className="text-sm font-bold text-slate-900 mt-1">{vendorLookupSummary.companyName}</h3>
              </div>
              <span
                className={`text-[10px] font-bold uppercase tracking-wider px-2 py-1 rounded border ${
                  vendorLookupSummary.lifecycleStatus === 'expired'
                    ? 'text-rose-700 bg-rose-100 border-rose-200'
                    : vendorLookupSummary.lifecycleStatus === 'renewal_due'
                      ? 'text-amber-700 bg-amber-100 border-amber-200'
                      : 'text-emerald-700 bg-emerald-100 border-emerald-200'
                }`}
              >
                {getVendorBadgeLabel(vendorLookupSummary)}
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px] text-slate-700">
              <div className="bg-white rounded border border-emerald-100 p-2.5">
                <span className="block text-[9px] uppercase tracking-wider text-slate-400 font-bold">Trade License No.</span>
                <span className="font-mono font-semibold">{vendorLookupSummary.tradeLicenseNo}</span>
              </div>
              <div className="bg-white rounded border border-emerald-100 p-2.5">
                <span className="block text-[9px] uppercase tracking-wider text-slate-400 font-bold">Expiry Date</span>
                <span className="font-semibold">{vendorLookupSummary.expDate}</span>
              </div>
              <div className="bg-white rounded border border-emerald-100 p-2.5 sm:col-span-2">
                <span className="block text-[9px] uppercase tracking-wider text-slate-400 font-bold">Business Activity</span>
                <span>{vendorLookupSummary.businessActivity}</span>
              </div>
              <div className="bg-white rounded border border-emerald-100 p-2.5 sm:col-span-2">
                <span className="block text-[9px] uppercase tracking-wider text-slate-400 font-bold">Address</span>
                <span>{vendorLookupSummary.address}</span>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-[11px] text-slate-700">
              <div className="bg-white rounded border border-emerald-100 p-2.5">
                <span className="block text-[9px] uppercase tracking-wider text-slate-400 font-bold">Phone</span>
                <span>{vendorLookupSummary.phone}</span>
              </div>
              <div className="bg-white rounded border border-emerald-100 p-2.5">
                <span className="block text-[9px] uppercase tracking-wider text-slate-400 font-bold">Email</span>
                <span className="break-all">{vendorLookupSummary.email}</span>
              </div>
              <div className="bg-white rounded border border-emerald-100 p-2.5">
                <span className="block text-[9px] uppercase tracking-wider text-slate-400 font-bold">Chamber No.</span>
                <span>{vendorLookupSummary.chamberNo}</span>
              </div>
            </div>

            <div className="text-[10px] text-emerald-800 font-medium">
              Route: {vendorLookupSummary.routeLabel}
              <span className="mx-1">•</span>
              Source: TBMS lookup
            </div>
          </div>
        )}

        {showContactSetup && (
          <div className="bg-white border hover:border-indigo-200 border-indigo-100 rounded-lg p-5 shadow-sm space-y-3.5 max-w-[90%] mx-auto font-sans text-slate-800 animate-fade-in">
            <div className="flex items-center gap-2 text-indigo-700 font-bold text-xs uppercase tracking-wider border-b border-indigo-50 pb-2">
              <Sparkles className="w-4 h-4 text-indigo-500 animate-pulse" />
              <span>Notification Contact Setup</span>
            </div>

            {contactValidationAttempted && Object.keys(contactErrors).length > 0 && (
              <div className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-[11px] text-rose-700 flex items-start gap-2">
                <AlertCircle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                <span>Please fix the highlighted fields before continuing.</span>
              </div>
            )}

            <div className="space-y-3.5 text-xs">
              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5 flex items-center gap-1.5">
                  <UserCheck className="w-3.5 h-3.5 text-indigo-500 shrink-0" />
                  <span>Full Name</span>
                </label>
                <input
                  type="text"
                  placeholder="e.g. John Doe"
                  value={registrationState.contactName || ''}
                  onChange={(e) => setRegistrationState(prev => ({ ...prev, contactName: e.target.value }))}
                  className={`w-full bg-slate-50 focus:bg-white rounded px-3 py-2 focus:outline-none transition font-medium border ${
                    contactValidationAttempted && contactErrors.name
                      ? 'border-rose-300 focus:border-rose-500 bg-rose-50'
                      : 'border-slate-200 focus:border-indigo-500'
                  }`}
                />
                {contactValidationAttempted && contactErrors.name && (
                  <p className="mt-1 text-[10px] text-rose-600 font-medium flex items-center gap-1">
                    <AlertCircle className="w-3 h-3" />
                    <span>{contactErrors.name}</span>
                  </p>
                )}
              </div>

              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5 flex items-center gap-1.5">
                  <Mail className="w-3.5 h-3.5 text-indigo-500 shrink-0" />
                  <span>Primary Notification Email</span>
                </label>
                <input
                  type="email"
                  placeholder="john.doe@company.com"
                  value={registrationState.contactEmail || ''}
                  onChange={(e) => setRegistrationState(prev => ({ ...prev, contactEmail: e.target.value }))}
                  className={`w-full bg-slate-50 focus:bg-white rounded px-3 py-2 focus:outline-none transition font-medium border ${
                    contactValidationAttempted && contactErrors.email
                      ? 'border-rose-300 focus:border-rose-500 bg-rose-50'
                      : 'border-slate-200 focus:border-indigo-500'
                  }`}
                />
                {contactValidationAttempted && contactErrors.email && (
                  <p className="mt-1 text-[10px] text-rose-600 font-medium flex items-center gap-1">
                    <AlertCircle className="w-3 h-3" />
                    <span>{contactErrors.email}</span>
                  </p>
                )}
              </div>

              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5 flex items-center gap-1.5">
                  <Phone className="w-3.5 h-3.5 text-indigo-500 shrink-0" />
                  <span>UAE Mobile Phone Number</span>
                </label>
                <div className={`flex items-stretch rounded border overflow-hidden ${
                  contactValidationAttempted && contactErrors.phone
                    ? 'border-rose-300 bg-rose-50'
                    : 'border-slate-200 bg-slate-50 focus-within:border-indigo-500 focus-within:bg-white'
                }`}>
                  <div className="flex items-center px-3 text-sm font-bold text-slate-500 border-r border-slate-200 bg-slate-100">
                    +971
                  </div>
                  <select
                    value={uaePhonePrefix}
                    onChange={(e) => {
                      const nextPrefix = e.target.value as typeof uaePhonePrefix;
                      setUaePhonePrefix(nextPrefix);
                      setRegistrationState(prev => ({
                        ...prev,
                        phoneNumber: composeUaeMobileNumber(nextPrefix, uaePhoneLocalNumber),
                      }));
                    }}
                    className="w-24 bg-transparent px-3 py-2 text-sm font-semibold text-slate-800 outline-none border-r border-slate-200"
                  >
                    {UAE_MOBILE_PREFIX_OPTIONS.map(prefix => (
                      <option key={prefix} value={prefix}>
                        {prefix}
                      </option>
                    ))}
                  </select>
                  <input
                    type="text"
                    inputMode="numeric"
                    placeholder="7 digits"
                    value={uaePhoneLocalNumber}
                    maxLength={7}
                    onChange={(e) => {
                      const digits = e.target.value.replace(/\D/g, '').slice(0, 7);
                      setUaePhoneLocalNumber(digits);
                      setRegistrationState(prev => ({
                        ...prev,
                        phoneNumber: composeUaeMobileNumber(uaePhonePrefix, digits),
                      }));
                    }}
                    className="flex-1 bg-transparent px-3 py-2 focus:outline-none text-sm font-medium text-slate-900 placeholder:text-slate-400"
                  />
                </div>
                {contactValidationAttempted && contactErrors.phone && (
                  <p className="mt-1 text-[10px] text-rose-600 font-medium flex items-center gap-1">
                    <AlertCircle className="w-3 h-3" />
                    <span>{contactErrors.phone}</span>
                  </p>
                )}
              </div>
            </div>

            <button
              onClick={handleSaveContactInfo}
              className="w-full text-[10px] uppercase tracking-widest bg-indigo-600 hover:bg-slate-900 text-white font-bold py-3 px-4 rounded-sm transition flex items-center justify-center gap-2 mt-2 shadow-xs"
            >
              <span>Save Contact Config & Proceed</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {isRequestInProgress && (
          <div className="flex justify-start items-end gap-2">
            <div className="w-6 h-6 rounded-full bg-indigo-50 text-indigo-600 flex items-center justify-center shrink-0 border border-indigo-100 text-[10px] font-bold">
              AI
            </div>
            <div className="max-w-[85%] rounded-lg rounded-bl-none px-4 py-3 text-xs leading-relaxed bg-white text-slate-800 border border-slate-200 shadow-sm">
              <div className="flex items-center gap-3">
                <div className="w-5 h-5 rounded-full border-2 border-indigo-200 border-t-indigo-600 animate-spin" />
                <div>
                  <p className="font-semibold text-slate-900">Processing request...</p>
                  <p className="text-[10px] text-slate-500">Please wait while the routing engine responds.</p>
                </div>
              </div>
            </div>
          </div>
        )}

        <div ref={chatEndRef} />
      </div>

      {/* Drag and Drop wrapper surrounding action input area */}
      {effectiveUploadType && (
        <div
          onDragEnter={handleDrag}
          onDragOver={handleDrag}
          onDragLeave={handleDrag}
          onDrop={handleDrop}
          className={`px-4 py-3.5 text-center border-t border-dashed transition-all ${
            isUploading 
              ? 'bg-indigo-50 border-indigo-300 text-indigo-700 animate-pulse'
              : dragActive 
                ? 'bg-indigo-50 border-indigo-300 text-indigo-700' 
                : 'bg-slate-50 border-slate-200 text-slate-500'
          }`}
        >
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileChange}
            accept="image/*,application/pdf"
            className="hidden"
            disabled={isUploading}
          />
          {isUploading ? (
            <div className="flex flex-col items-center justify-center gap-1.5 py-1">
              <div className="flex items-center gap-2 text-xs font-bold text-indigo-700">
                <RefreshCw className="w-4 h-4 animate-spin text-indigo-600" />
                <span>Validation In Progress...</span>
              </div>
            </div>
          ) : (
            <>
              <div className="flex items-center justify-center gap-2 text-[11px]">
                <Upload className={`w-3.5 h-3.5 ${dragActive ? 'animate-bounce text-indigo-600' : 'text-slate-400'}`} />
                <span>
                  Drag & Drop verification files here or{' '}
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    disabled={isUploading}
                    className="text-indigo-600 hover:text-indigo-700 font-bold underline underline-offset-2"
                  >
                    select from computer
                  </button>{' '}
                  for <strong className="text-slate-800 uppercase font-mono bg-slate-100 px-1 py-0.5 rounded text-[10px] ml-0.5">{effectiveUploadType.replace(/_/g, ' ')}</strong>
                </span>
              </div>
            </>
          )}
        </div>
      )}

      {/* Input Form area */}
      {!showContactSetup && (
        <div className="p-3 bg-white border-t border-slate-200">
          <div className="flex items-center gap-2">
            <input
            type="text"
            value={inputText}
            onChange={(e) => {
              setInputText(e.target.value);
              if (guidedInlineError) {
                setGuidedInlineError('');
              }
            }}
            onKeyDown={(e) => e.key === 'Enter' && handleSendMessage()}
            placeholder={
              isUploading
                ? 'Validation in progress... please wait...'
                : isRequestInProgress
                  ? 'Processing request...'
                  : guidedOnboardingActive
                    ? 'Type your answer...'
                    : 'Describe the supplier request to route it...'
            }
            className={`flex-1 text-xs bg-slate-50 border text-slate-800 placeholder-slate-400 rounded py-2 px-3 focus:outline-none focus:ring-1 focus:bg-white transition ${
              guidedOnboardingActive && guidedInlineError
                ? 'border-rose-300 focus:ring-rose-500'
                : 'border-slate-200 focus:ring-indigo-500'
            }`}
            disabled={isUploading || isRequestInProgress}
          />
          <button
            onClick={() => handleSendMessage()}
            disabled={!inputText.trim() || isUploading || isRequestInProgress}
            className="p-2 rounded bg-indigo-600 hover:bg-indigo-700 text-white disabled:opacity-50 disabled:hover:bg-indigo-600 transition"
          >
            <Send className="w-4 h-4" />
          </button>
          </div>

          {guidedOnboardingActive && guidedInlineError && (
            <div className="mt-2 flex items-start gap-2 rounded border border-rose-200 bg-rose-50 px-3 py-2 text-[11px] text-rose-700">
              <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              <span>{guidedInlineError}</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
