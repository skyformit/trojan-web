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
  status: 'empty' | 'verifying' | 'ocr_completed' | 'registry_check' | 'verified' | 'failed';
  extractedData?: Record<string, string>;
  validationLogs: string[];
  registryMatch?: {
    matched: boolean;
    registeredName?: string;
    status: 'ACTIVE' | 'INACTIVE' | 'EXPIRED' | 'NOT_FOUND';
    details?: string;
  };
  error?: string;
}

export interface SupplierRegistrationState {
  companyName: string;
  contactName: string;
  contactEmail: string;
  phoneNumber: string;
  country: string;
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
