import React, { useState, useRef, useEffect } from 'react';
import { Send, Upload, FileText, CheckCircle2, ShieldAlert, RefreshCw, Bot, Sparkles, ArrowRight, Mail, Phone, UserCheck, AlertCircle } from 'lucide-react';
import { ChatMessage, SupplierRegistrationState, DocumentVerification } from '../types';
import { streamChatMessage } from '../utils/chatStream';
import {
  normalizeUaeMobileNumber,
  validateGuidedCompanyName,
} from '../config/guidedOnboarding';

interface AIAgentChatProps {
  registrationState: SupplierRegistrationState;
  setRegistrationState: React.Dispatch<React.SetStateAction<SupplierRegistrationState>>;
  onAnalyzeDocument: (type: 'trade_license' | 'vat_certificate' | 'bank_document', fileBase64: string | null, mimeType: string, isPresetSample?: { companyName: string }) => Promise<void>;
  chatHistory: ChatMessage[];
  setChatHistory: React.Dispatch<React.SetStateAction<ChatMessage[]>>;
}

type GeneralBotResponse = {
  ok?: boolean;
  status?: 'completed' | 'expired' | 'renewal_due' | string;
  text?: string;
  source?: string;
  origin?: string;
  source_type?: string;
  response_type?: string;
  conversation_id?: string;
  context?: {
    intent?: 'lookup' | 'chat' | string;
    document_type?: string;
    entities?: {
      company_name?: string | null;
      trade_license_number?: string | null;
      vat_number?: string | null;
      bank_name?: string | null;
      account_number?: string | null;
      iban?: string | null;
    };
    next_action?: string;
    classification?: {
      label?: string;
      confidence?: number;
      reason?: string;
    };
  };
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

const UAE_MOBILE_PREFIX_OPTIONS = ['50', '51', '52', '53', '54', '55', '56', '57', '58', '59'] as const;

function splitUaeMobileNumber(value: string) {
  const normalized = normalizeUaeMobileNumber(value);
  const prefix = normalized.slice(0, 2);
  const localNumber = normalized.slice(2, 9);

  return {
    prefix: UAE_MOBILE_PREFIX_OPTIONS.includes(prefix as typeof UAE_MOBILE_PREFIX_OPTIONS[number])
      ? prefix
      : '50',
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

function getStructuredContextIntent(response: GeneralBotResponse) {
  return String(response.context?.intent || '').toLowerCase();
}

function getStructuredContextNextAction(response: GeneralBotResponse) {
  return String(response.context?.next_action || '').toLowerCase();
}

function getContextCompanyName(response: GeneralBotResponse) {
  return String(response.context?.entities?.company_name || '').trim();
}

function shouldShowContactForm(response: GeneralBotResponse) {
  const sourceType = getStructuredSource(response);
  const responseType = getStructuredResponseType(response);
  const contextIntent = getStructuredContextIntent(response);
  const contextNextAction = getStructuredContextNextAction(response);

  if (response.ok === false) {
    return false;
  }

  if (sourceType === 'tbms' || sourceType === 'workflow') {
    return true;
  }

  if (contextIntent === 'lookup' && contextNextAction === 'tbms_lookup') {
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
    normalized.includes('please complete the notification contact setup') ||
    normalized.includes('notification contact setup') ||
    normalized.includes('please provide the contact details') ||
    normalized.includes('provide the contact details') ||
    normalized.includes('contact details below') ||
    normalized.includes('who is the contact person') ||
    normalized.includes('contact person for this application') ||
    normalized.includes('please start by uploading one of the required onboarding documents') ||
    normalized.includes('please upload or drop your') ||
    normalized.includes('please upload your valid trade license') ||
    normalized.includes('please upload your trade license document to begin') ||
    normalized.includes('please upload your trade license')
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
  } else if (!/^5[0-9]\d{7}$/.test(normalizedPhone)) {
    errors.phone = 'Enter a valid UAE mobile number using +971 and a 50 to 59 prefix followed by 7 digits.';
  }

  return errors;
}

function hasCompleteContactInfo(state: SupplierRegistrationState) {
  const name = state.contactName?.trim();
  const email = state.contactEmail?.trim();
  const phone = normalizeUaeMobileNumber(state.phoneNumber || '');

  return Boolean(
    name &&
    email &&
    /^([^\s@]+@[^\s@]+\.[^\s@]+)$/.test(email) &&
    /^5[0-9]\d{7}$/.test(phone)
  );
}

function hasContactConfirmationMessage(chatHistory: ChatMessage[]) {
  return chatHistory.some(message => {
    if (message.sender !== 'agent') {
      return false;
    }

    const normalized = message.text.toLowerCase();
    return (
      normalized.includes('contact details registered') ||
      normalized.includes('recipient name') ||
      normalized.includes('notification channels') ||
      normalized.includes('next step') &&
        normalized.includes('upload or drop your valid trade license')
    );
  });
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
  const [uaePhonePrefix, setUaePhonePrefix] = useState<'50' | '51' | '52' | '53' | '54' | '55' | '56' | '57' | '58' | '59'>('50');
  const [uaePhoneLocalNumber, setUaePhoneLocalNumber] = useState('');
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [vendorLookupSummary, setVendorLookupSummary] = useState<VendorLookupSummary | null>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const lastConversationContextRef = useRef<GeneralBotResponse['context'] | null>(null);
  const uploadTypeForCurrentStep = getUploadTypeForStep(registrationState.currentStep);
  const effectiveUploadType = uploadTypeForCurrentStep;

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatHistory, isRequestInProgress, vendorLookupSummary, registrationState.currentStep, registrationState.workflowRoute]);

  useEffect(() => {
    if (chatHistory.length === 0) {
      setConversationId(null);
      setVendorLookupSummary(null);
      lastConversationContextRef.current = null;
    }
  }, [chatHistory.length]);

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

  useEffect(() => {
    if (
      registrationState.currentStep === 'contact_info' &&
      hasCompleteContactInfo(registrationState) &&
      hasContactConfirmationMessage(chatHistory)
    ) {
      setRegistrationState(prev => ({
        ...prev,
        currentStep: 'trade_license_upload'
      }));
    }
  }, [chatHistory, registrationState, setRegistrationState]);

  const handleSendMessage = async (textToSend?: string) => {
    const text = (textToSend || inputText).trim();
    if (!text) return;

    if (showContactSetup) {
      setInputText('');
      return;
    }

    if (!textToSend) {
      setInputText('');
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

    // Handle bot logic processing based on state
    setTimeout(() => {
      processAgentResponse(text);
    }, 800);
  };

  const processAgentResponse = async (userText: string) => {
    setIsRequestInProgress(true);

    try {
      const response = await fetch('/api/invoke-general-bot', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        text: userText,
        message: userText,
        prompt: userText,
        intent: 'general_chat',
        conversation_id: conversationId,
        context: lastConversationContextRef.current || undefined
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
      const contextCompanyName = getContextCompanyName(data);
      const tbmsVendor = getFirstTbmsVendor(data);
      const showContactForm = shouldShowContactForm(data);
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
        : workflowState.workflowRoute;
      const finalWorkflowStatus = tbmsLifecycleStatus
        ? tbmsLifecycleStatus
        : workflowState.workflowStatus;

      const shouldOpenContactPanel = showContactForm || (!tbmsVendor && finalWorkflowRoute !== 'general');

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
              : workflowState.workflowName,
            workflowApiPath: tbmsLifecycleStatus
              ? tbmsLifecycleStatus === 'renewal_due'
                ? '/api/renewal-vendor-approval-workflow'
                : '/api/vendor-approval-workflow'
              : workflowState.workflowApiPath,
          }),
          companyName: contextCompanyName || prev.companyName || validVendorName || validUserCompanyName,
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
      } else if (getStructuredSource(data) === 'tbms') {
        setVendorLookupSummary(null);
      } else {
        setVendorLookupSummary(null);
      }

      if (data.conversation_id) {
        setConversationId(data.conversation_id);
      }

      if (data.context) {
        lastConversationContextRef.current = data.context;
      }

      if (!tbmsVendor) {
        await streamChatMessage(
          setChatHistory,
          getStructuredSource(data) === 'tbms'
            ? `No vendor match found. Please enter the contact details below to continue.`
            : responseText,
          {
            onFirstChunk: () => setIsRequestInProgress(false)
          }
        );
      }

      if (showContactForm || (!tbmsVendor && getStructuredSource(data) === 'tbms')) {
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
        `[[CONTACT_SUMMARY]]
Recipient Name: ${cName}
Email: ${cEmail}
SMS: ${cPhone}
Next Step: Please upload or drop your Valid Trade License (PDF) to proceed.
We will verify your company's credentials after the upload.`
      );
    }, 850);
  };

  // Upload actions orchestration
  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const input = e.currentTarget;
    const files = input.files;
    if (!files || files.length === 0 || !uploadTypeForCurrentStep) return;

    const selectedFile = files[0];
    // Clear the input immediately so selecting the same file again triggers onChange.
    input.value = '';
    await processFileUpload(selectedFile, uploadTypeForCurrentStep);
  };

  const processFileUpload = async (file: File, type: 'trade_license' | 'vat_certificate' | 'bank_document') => {
    setIsUploading(true);
    const documentLabel =
      type === 'trade_license'
        ? 'trade license'
        : type === 'vat_certificate'
          ? 'VAT certificate'
          : 'bank document';
    
    const logId = 'upload-' + Date.now();
    setChatHistory(prev => [...prev, {
      id: logId,
      sender: 'system',
      text: `Getting your ${documentLabel} ready for review...`,
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
            text: `We have received your ${documentLabel}. Starting the review now...`,
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
    if (text.startsWith('[[DOCUMENT_REVIEW]]')) {
      const rows = text
        .replace('[[DOCUMENT_REVIEW]]', '')
        .trim()
        .split('\n')
        .map(line => line.trim())
        .filter(Boolean);

      const rowMap = rows.reduce<Record<string, string>>((acc, line) => {
        const [label, ...valueParts] = line.split(':');
        if (!label || valueParts.length === 0) return acc;
        acc[label.trim()] = valueParts.join(':').trim();
        return acc;
      }, {});
      const acceptanceStatus = (rowMap['Acceptance Status'] || 'Approved')
        .replace(/^Approved by Expert Intelligent rules$/i, 'Approved')
        .replace(/^Approved by backend rules$/i, 'Approved')
        .replace(/^Approved by Expert Decision$/i, 'Approved');

      return (
        <div className="space-y-3">
          <div className="font-bold text-amber-900 flex items-center gap-2">
            <RefreshCw className="w-4 h-4 text-amber-500" />
            <span>Document Sent for Review</span>
          </div>

          <div className="overflow-hidden rounded-lg border border-amber-200 bg-amber-50">
            <div className="grid grid-cols-2 bg-amber-100 text-[10px] uppercase tracking-widest text-amber-700 font-bold border-b border-amber-200">
              <div className="px-3 py-2 border-r border-amber-200">Field</div>
              <div className="px-3 py-2">Value</div>
            </div>

            {[
              ['Document Type', rowMap['Document Type'] || 'N/A'],
              ['OCR Scanned Name', rowMap['OCR Scanned Name'] || 'N/A'],
              ['Review Note', rowMap['Review Note'] || 'Company name is a close match.'],
            ].map(([label, value]) => (
              <div key={label} className="grid grid-cols-2 text-xs border-b border-amber-100 last:border-b-0">
                <div className="px-3 py-2 font-semibold text-amber-900 bg-amber-50 border-r border-amber-100">
                  {label}
                </div>
                <div className="px-3 py-2 text-slate-800 break-words bg-amber-50">
                  {value}
                </div>
              </div>
            ))}
          </div>

          <div className="rounded-lg bg-amber-100 border border-amber-200 px-3 py-2 text-xs text-slate-800">
            <span className="font-bold text-amber-700">Next Step:</span>{' '}
            {rowMap['Next Step'] || 'We will continue once the review is complete.'}
          </div>
        </div>
      );
    }

    if (text.startsWith('[[DOCUMENT_REJECTED]]')) {
      const rows = text
        .replace('[[DOCUMENT_REJECTED]]', '')
        .trim()
        .split('\n')
        .map(line => line.trim())
        .filter(Boolean);

      const rowMap = rows.reduce<Record<string, string>>((acc, line) => {
        const [label, ...valueParts] = line.split(':');
        if (!label || valueParts.length === 0) return acc;
        acc[label.trim()] = valueParts.join(':').trim();
        return acc;
      }, {});
      const acceptanceStatus = (rowMap['Acceptance Status'] || 'Approved')
        .replace(/^Approved by Expert Intelligent rules$/i, 'Approved')
        .replace(/^Approved by backend rules$/i, 'Approved')
        .replace(/^Approved by Expert Decision$/i, 'Approved');

      return (
        <div className="space-y-3">
          <div className="font-bold text-slate-900 flex items-center gap-2">
            <ShieldAlert className="w-4 h-4 text-rose-500" />
            <span>Document Rejected</span>
          </div>

          <div className="overflow-hidden rounded-lg border border-slate-200 bg-white">
            <div className="grid grid-cols-2 bg-slate-50 text-[10px] uppercase tracking-widest text-slate-500 font-bold border-b border-slate-200">
              <div className="px-3 py-2 border-r border-slate-200">Field</div>
              <div className="px-3 py-2">Value</div>
            </div>

            {[
              ['Reason', rowMap['Reason'] || 'This document could not be approved.'],
            ].map(([label, value]) => (
              <div key={label} className="grid grid-cols-2 text-xs border-b border-slate-100 last:border-b-0">
                <div className="px-3 py-2 font-semibold text-slate-600 bg-slate-50 border-r border-slate-100">
                  {label}
                </div>
                <div className="px-3 py-2 text-slate-800 break-words">
                  {value}
                </div>
              </div>
            ))}
          </div>

          <div className="rounded-lg bg-rose-50 border border-rose-100 px-3 py-2 text-xs text-slate-800">
            <span className="font-bold text-rose-700">Next Step:</span>{' '}
            {rowMap['Next Step'] || 'Please upload a corrected document to continue.'}
          </div>
        </div>
      );
    }

    if (text.startsWith('[[DOCUMENT_ACCEPTED]]')) {
      const rows = text
        .replace('[[DOCUMENT_ACCEPTED]]', '')
        .trim()
        .split('\n')
        .map(line => line.trim())
        .filter(Boolean);

      const rowMap = rows.reduce<Record<string, string>>((acc, line) => {
        const [label, ...valueParts] = line.split(':');
        if (!label || valueParts.length === 0) return acc;
        acc[label.trim()] = valueParts.join(':').trim();
        return acc;
      }, {});
      const acceptanceStatus = (rowMap['Acceptance Status'] || 'Approved')
        .replace(/^Approved by Expert Intelligent rules$/i, 'Approved')
        .replace(/^Approved by backend rules$/i, 'Approved')
        .replace(/^Approved by Expert Decision$/i, 'Approved');

      return (
        <div className="space-y-3">
          <div className="font-bold text-slate-900 flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-500" />
            <span>Document Accepted</span>
          </div>

          <div className="overflow-hidden rounded-lg border border-slate-200 bg-white">
            <div className="grid grid-cols-2 bg-slate-50 text-[10px] uppercase tracking-widest text-slate-500 font-bold border-b border-slate-200">
              <div className="px-3 py-2 border-r border-slate-200">Field</div>
              <div className="px-3 py-2">Value</div>
            </div>

            {[
              ['Acceptance Status', acceptanceStatus],
            ].map(([label, value]) => (
              <div key={label} className="grid grid-cols-2 text-xs border-b border-slate-100 last:border-b-0">
                <div className="px-3 py-2 font-semibold text-slate-600 bg-slate-50 border-r border-slate-100">
                  {label}
                </div>
                <div className="px-3 py-2 text-slate-800 break-words">
                  {value}
                </div>
              </div>
            ))}
          </div>

          <div className="rounded-lg bg-emerald-50 border border-emerald-100 px-3 py-2 text-xs text-slate-800">
            <span className="font-bold text-emerald-700">Next Step:</span>{' '}
            {rowMap['Next Step'] || 'Please continue with the next onboarding step.'}
          </div>
        </div>
      );
    }

    if (text.startsWith('[[CONTACT_SUMMARY]]')) {
      const rows = text
        .replace('[[CONTACT_SUMMARY]]', '')
        .trim()
        .split('\n')
        .map(line => line.trim())
        .filter(Boolean);

      const rowMap = rows.reduce<Record<string, string>>((acc, line) => {
        const [label, ...valueParts] = line.split(':');
        if (!label || valueParts.length === 0) return acc;
        acc[label.trim()] = valueParts.join(':').trim();
        return acc;
      }, {});

      return (
        <div className="space-y-3">
          <div className="font-bold text-slate-900 flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-indigo-500" />
            <span>Contact Details Registered</span>
          </div>

          <div className="overflow-hidden rounded-lg border border-slate-200 bg-white">
            <div className="grid grid-cols-2 bg-slate-50 text-[10px] uppercase tracking-widest text-slate-500 font-bold border-b border-slate-200">
              <div className="px-3 py-2 border-r border-slate-200">Field</div>
              <div className="px-3 py-2">Value</div>
            </div>

            {[
              ['Recipient Name', rowMap['Recipient Name'] || 'N/A'],
              ['Email', rowMap['Email'] || 'N/A'],
              ['SMS', rowMap['SMS'] || 'N/A'],
            ].map(([label, value]) => (
              <div key={label} className="grid grid-cols-2 text-xs border-b border-slate-100 last:border-b-0">
                <div className="px-3 py-2 font-semibold text-slate-600 bg-slate-50 border-r border-slate-100">
                  {label}
                </div>
                <div className="px-3 py-2 text-slate-800 break-words">
                  {value}
                </div>
              </div>
            ))}
          </div>

          <div className="rounded-lg bg-indigo-50 border border-indigo-100 px-3 py-2 text-xs text-slate-800">
            <span className="font-bold text-indigo-700">Next Step:</span>{' '}
            {rowMap['Next Step'] || 'Please upload or drop your Valid Trade License (PDF) to proceed.'}
            <div className="mt-1 text-[11px] text-slate-600">
              {rows.find(line => line.startsWith('We will verify')) || 'We will verify your company\'s credentials after the upload.'}
            </div>
          </div>
        </div>
      );
    }

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
    !isRequestInProgress &&
    (!hasCompleteContactInfo(registrationState) || !hasContactConfirmationMessage(chatHistory));
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
              }}
              onKeyDown={(e) => e.key === 'Enter' && handleSendMessage()}
              placeholder={
                isUploading
                  ? 'Validation in progress... please wait...'
                  : isRequestInProgress
                    ? 'Processing request...'
                    : 'Describe the supplier request to route it...'
              }
              className="flex-1 text-xs bg-slate-50 border border-slate-200 text-slate-800 placeholder-slate-400 rounded py-2 px-3 focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:bg-white transition"
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
        </div>
      )}
    </div>
  );
}
