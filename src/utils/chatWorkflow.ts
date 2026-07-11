import { normalizeUaeMobileNumber } from '../config/guidedOnboarding';
import type { ChatMessage, SupplierRegistrationState } from '../types';

export type WorkflowRoute = 'general' | 'vendor' | 'renewal';

export type GeneralBotResponse = {
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
  data?: {
    data?: {
      vendors?: Array<Record<string, unknown>>;
    };
  };
};

export type VendorLookupSummary = {
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

export type ContactValidationErrors = {
  name?: string;
  email?: string;
  phone?: string;
};

export const UAE_MOBILE_PREFIX_OPTIONS = ['50', '51', '52', '53', '54', '55', '56', '57', '58', '59'] as const;

export function splitUaeMobileNumber(value: string) {
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

export function composeUaeMobileNumber(prefix: string, localNumber: string) {
  const digits = localNumber.replace(/\D/g, '').slice(0, 7);
  if (!digits) {
    return '';
  }

  return `+971${prefix}${digits}`;
}

export function parseExpiryDateFromText(text: string) {
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

export function parseVendorExpiryDate(value: string) {
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

export function getDaysRemainingFromExpiry(expDate: string) {
  const parsedExpiry = parseVendorExpiryDate(expDate);
  if (!parsedExpiry) {
    return null;
  }

  return Math.floor((parsedExpiry.getTime() - Date.now()) / 86400000);
}

export function getVendorLifecycleStatus(expDate: string, approvalStatus?: string) {
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

export function getVendorRouteLabel(lifecycleStatus: VendorLookupSummary['lifecycleStatus']) {
  if (lifecycleStatus === 'expired') {
    return 'TCG-Vendor-Approval-Workflow';
  }

  if (lifecycleStatus === 'renewal_due') {
    return 'Renewal-Vendor-Approval-Workflow';
  }

  return 'Vendor approval flow';
}

export function getVendorBadgeLabel(summary: VendorLookupSummary) {
  if (summary.lifecycleStatus === 'expired') {
    return 'Expired';
  }

  if (summary.lifecycleStatus === 'renewal_due') {
    return 'Renewal due';
  }

  return summary.approvalStatus || 'Approved';
}

export function inferWorkflowStatusFromText(text: string) {
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

export function getStructuredSource(response: GeneralBotResponse) {
  return (response.source_type || response.source || '').toLowerCase();
}

export function getStructuredResponseType(response: GeneralBotResponse) {
  return (response.response_type || '').toLowerCase();
}

export function getStructuredContextIntent(response: GeneralBotResponse) {
  return String(response.context?.intent || '').toLowerCase();
}

export function getStructuredContextNextAction(response: GeneralBotResponse) {
  return String(response.context?.next_action || '').toLowerCase();
}

export function getContextCompanyName(response: GeneralBotResponse) {
  return String(response.context?.entities?.company_name || '').trim();
}

export function getTbmsVendors(response: GeneralBotResponse) {
  const vendors = (response as any)?.data?.data?.vendors;
  return Array.isArray(vendors) ? vendors : [];
}

export function getFirstTbmsVendor(response: GeneralBotResponse) {
  const vendors = getTbmsVendors(response);
  return vendors.length > 0 ? vendors[0] : null;
}

export function hasTbmsVendorResults(response: GeneralBotResponse) {
  return getTbmsVendors(response).length > 0;
}

export function extractVendorName(text: string) {
  const match = text.match(/Vendor Name:\s*(.+)/i);
  return match?.[1]?.trim() || '';
}

export function getVendorDisplayName(response: GeneralBotResponse) {
  const tbmsVendor = getFirstTbmsVendor(response);
  if (tbmsVendor?.vendName) {
    return String(tbmsVendor.vendName).trim();
  }

  return extractVendorName(response.text || '');
}

export function shouldShowContactForm(response: GeneralBotResponse) {
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

export function getNextStepFromResponse(
  response: GeneralBotResponse,
  previousStep: SupplierRegistrationState['currentStep']
): SupplierRegistrationState['currentStep'] {
  if (shouldShowContactForm(response)) {
    return 'contact_info';
  }

  const contextIntent = getStructuredContextIntent(response);
  const contextNextAction = getStructuredContextNextAction(response);
  const documentType = String(response.context?.document_type || '').trim().toLowerCase();

  const shouldOpenDocumentUpload =
    contextIntent === 'document' ||
    contextNextAction === 'document_review' ||
    documentType === 'trade' ||
    documentType === 'vat' ||
    documentType === 'bank';

  if (shouldOpenDocumentUpload) {
    if (documentType === 'vat') {
      return 'vat_upload';
    }

    if (documentType === 'bank') {
      return 'bank_document_upload';
    }

    return 'trade_license_upload';
  }

  return previousStep;
}

export function validateContactInfo(name: string, email: string, phone: string): ContactValidationErrors {
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

export function hasCompleteContactInfo(state: SupplierRegistrationState) {
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

export function hasContactConfirmationMessage(chatHistory: ChatMessage[]) {
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

export function stabilizeWorkflowState(
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

export function getWorkflowStateFromResponse(response: GeneralBotResponse) {
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

export function getUploadTypeForStep(step: SupplierRegistrationState['currentStep']) {
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
