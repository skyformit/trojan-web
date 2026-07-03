export interface ChatMessage {
  id: string;
  sender: 'user' | 'agent' | 'system';
  text: string;
  timestamp: string;
  isPending?: boolean;
  documentType?: 'trade_license' | 'vat_certificate' | 'bank_document' | null;
  fileDetails?: {
    name: string;
    size: string;
    type: string;
  };
}

export interface DocumentVerification {
  type: 'trade_license' | 'vat_certificate' | 'bank_document';
  fileName: string;
  uploadedAt: string;
  status: 'empty' | 'verifying' | 'ocr_completed' | 'registry_check' | 'review' | 'verified' | 'failed';
  extractedData?: Record<string, string>;
  ocrResults?: Record<string, { value?: string; confidence?: number }>;
  documentAcceptance?: {
    document_type?: string;
    status?: 'approved' | 'rejected' | 'review' | string;
    score?: number;
    missing_fields?: string[];
    reasons?: string[];
    acceptable?: boolean;
    expiry_date?: string;
    is_expired?: boolean;
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
    recommended_action?: string;
  };
  validationLogs: string[];
  processingTimeMs?: number;
  processingTime?: string;
  registryMatch?: {
    matched: boolean;
    registeredName?: string;
    status: 'ACTIVE' | 'INACTIVE' | 'EXPIRED' | 'NOT_FOUND';
    details?: string;
  };
  error?: string;
  agent2Response?: unknown;
  agent3Response?: unknown;
  agent4Response?: unknown;
}

export interface SupplierRegistrationState {
  companyName: string;
  tradeLicenseNumber?: string;
  vatNumber?: string;
  contactName: string;
  contactEmail: string;
  phoneNumber: string;
  companyAddress?: string;
  country: string;
  workflowStatus?: 'completed' | 'expired' | 'renewal_due';
  workflowRoute?: 'general' | 'vendor' | 'renewal' | '';
  workflowName?: string;
  workflowApiPath?: string;
  documents: {
    trade_license: DocumentVerification;
    vat_certificate: DocumentVerification;
    bank_document: DocumentVerification;
  };
  registryChecks: {
    tradeLicenseVerified: boolean;
    vatVerified: boolean;
    bankDocumentVerified: boolean;
  };
  currentStep: 'initial' | 'contact_info' | 'trade_license_upload' | 'vat_upload' | 'bank_document_upload' | 'review' | 'completed';
  status: 'draft' | 'pending' | 'verified' | 'rejected';
  yearsInBusiness?: string;
  totalStaff?: string;
  totalLabors?: string;
  totalEngineers?: string;
  testingFacility?: string;
  clientConsultantListings?: string;
  projectsLast3Years?: string;
  biggestProjectValue?: string;
  annualTurnover?: string;
  factoryAssetValue?: string;
  surveyDocumentType?: 'trade' | 'vat' | 'bank' | '';
  surveyProduct?: string;
}

export interface GovernmentRegistryRecord {
  companyName: string;
  bankAccountNumber: string;
  bankName: string;
  vatNumber: string;
  licenseNumber: string;
  licenseExpiry: string;
  status: 'ACTIVE' | 'INACTIVE' | 'EXPIRED';
  authorizedSignatory: string;
  postalAddress: string;
}
