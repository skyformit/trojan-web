export type DocumentType = "trade_license" | "vat_certificate" | "bank_document";

export type AzureValidationResponse = {
  status?: string;
  score?: number | null;
  results?: Record<string, { value?: string; confidence?: number }>;
  document_acceptance?: {
    document_type?: string;
    status?: "approved" | "rejected" | "review" | string;
    score?: number;
    missing_fields?: string[];
    reasons?: string[];
    acceptable?: boolean;
    expiry_date?: string;
    is_expired?: boolean;
  };
  gpt_review?: {
    is_consistent?: boolean;
    anomalies?: string[];
    plausibility_score?: number;
    reasoning?: string;
  };
  error?: {
    code?: string;
    message?: string;
  };
};

export type PagesEnvBindings = {
  GENERAL_BOT_ENDPOINT?: string;
  TBMS_VENDOR_LOOKUP_ENDPOINT?: string;
  DOCUMENT_EXTRACTION_ENDPOINT?: string;
  TRADE_LICENSE_VALIDATE_ENDPOINT?: string;
  VAT_VALIDATE_ENDPOINT?: string;
  BANK_VALIDATE_ENDPOINT?: string;
  TBMS_RECONCILIATION?: string;
  TBMS_RECONCILIATION_ENDPOINT?: string;
  HIDL_APPROVAL?: string;
  APPROVAL_REVIEW_ENDPOINT?: string;
  TBMS_ORCHESTRATOR_ENDPOINT?: string;
};

export const governmentRegistries = [
  {
    companyName: "MODEC BUILDING MATERIALS TRADING (LLC)",
    licenseNumber: "568788",
    licensedActivities: "Building materials trading",
    vatNumber: "100259071700003",
    bankAccountNumber: "0201010203111050430901",
    bankName: "HABIB BANK AG ZURICH",
    status: "ACTIVE",
    licenseExpiry: "2027-05-03",
    authorizedSignatory: "Amanat Hussain",
    postalAddress: "Floor 12, Enterprise Towers, Tech District 4, Abu Dhabi",
  },
  {
    companyName: "Global Logistics & Supply Chain Corp",
    licenseNumber: "TL-381029-X",
    licensedActivities: "Logistics and supply chain services",
    vatNumber: "VAT-48192039",
    bankAccountNumber: "ACC-5910293-B",
    bankName: "Federal Reserve Bank",
    status: "ACTIVE",
    licenseExpiry: "2028-05-15",
    authorizedSignatory: "Elena Rostova",
    postalAddress: "Warehouse 4A, Terminal Gateway, Logistics Bay East",
  },
];

export function json(data: unknown, status = 200) {
  return Response.json(data, { status });
}

export function getValidationEndpoints(env?: PagesEnvBindings): Record<
  DocumentType,
  { url: string; ocrSource: string }
> {
  const sharedEndpoint =
    env?.DOCUMENT_EXTRACTION_ENDPOINT ||
    env?.TRADE_LICENSE_VALIDATE_ENDPOINT ||
    env?.VAT_VALIDATE_ENDPOINT ||
    env?.BANK_VALIDATE_ENDPOINT ||
    "";

  return {
    trade_license: {
      url: sharedEndpoint,
      ocrSource: "azure_validate_trade_license",
    },
    vat_certificate: {
      url: sharedEndpoint,
      ocrSource: "azure_validate_vat",
    },
    bank_document: {
      url: sharedEndpoint,
      ocrSource: "azure_validate_bank_document",
    },
  };
}

export function getResultValue(
  results: AzureValidationResponse["results"],
  keys: string[]
) {
  for (const key of keys) {
    const value = results?.[key]?.value?.trim();
    if (value) {
      return value;
    }
  }

  return "";
}

export function pickBestCompanyName(...candidates: Array<string | null | undefined>) {
  const normalizedCandidates = candidates
    .map((value) => String(value || "").trim())
    .filter(Boolean);

  if (normalizedCandidates.length === 0) {
    return "";
  }

  const score = (value: string) => {
    const wordCount = value.replace(/[()]/g, " ").split(/\s+/).filter(Boolean).length;
    return wordCount * 100 + value.length;
  };

  return normalizedCandidates.sort((a, b) => score(b) - score(a))[0];
}

export function getMimeTypeFromDataUrl(fileBase64: string, fallbackMimeType: string) {
  const match = fileBase64.match(/^data:([^;]+);base64,/);
  return match?.[1] || fallbackMimeType || "application/octet-stream";
}

export function getBase64Payload(fileBase64: string) {
  const separatorIndex = fileBase64.indexOf(",");
  return separatorIndex >= 0 ? fileBase64.slice(separatorIndex + 1) : fileBase64;
}

export function normalizeValidationResponse(
  documentType: DocumentType,
  payload: AzureValidationResponse
) {
  const results = payload.results || {};
  const validationSucceeded = payload.status === "success";

  if (documentType === "trade_license") {
    const tradeName = getResultValue(results, ["TradeName"]);
    const companyName = getResultValue(results, [
      "CompanyName",
      "BusinessName",
      "OperatingName",
      "LegalNameEnglish",
      "TradeName",
    ]);
    const licensedActivities = getResultValue(results, [
      "LicenceActivities",
      "LicensedActivities",
      "LicensedActivity",
      "Activity",
      "CoveredActivities",
    ]) || companyName;

    return {
      licenseNumber: getResultValue(results, ["LicenceNo", "LicenseNo", "LicenseNumber"]),
      companyName,
      tradeName,
      businessName: getResultValue(results, ["BusinessName"]),
      legalNameEnglish: getResultValue(results, ["LegalNameEnglish"]),
      issueDate: getResultValue(results, ["IssueDate"]),
      expiryDate: getResultValue(results, ["ExpiryDate"]),
      activity: licensedActivities,
      licensedActivities,
      status: validationSucceeded ? "ACTIVE" : "NOT_FOUND",
      manager: getResultValue(results, ["Manager", "AuthorizedSignatory"]),
      issueAuthority: getResultValue(results, ["IssueAuthority", "IssuingAuthority", "issuing_authority", "issue_authority"]),
    };
  }

  if (documentType === "vat_certificate") {
    const tradeName = getResultValue(results, ["TradeName"]);
    const companyName = getResultValue(results, [
      "CompanyName",
      "LegalNameEnglish",
      "BusinessName",
      "OperatingName",
      "TradeName",
    ]);

    return {
      vatNumber: getResultValue(results, [
        "VatNumber",
        "VATNumber",
        "TaxRegistrationNumber",
        "RegistrationNumber",
      ]),
      taxRegistrationNumber: getResultValue(results, [
        "TaxRegistrationNumber",
        "VatNumber",
        "VATNumber",
        "RegistrationNumber",
      ]),
      companyName,
      tradeName,
      registrationDate: getResultValue(results, ["IssueDate", "issue_date", "RegistrationDate"]),
      issueAuthority: getResultValue(results, ["IssueAuthority", "IssuingAuthority", "issuing_authority", "issue_authority"]),
      status: validationSucceeded ? "ACTIVE" : "NOT_FOUND",
    };
  }

  return {
    bankAccountNumber: getResultValue(results, [
      "BankAccountNumber",
      "AccountNumber",
      "IBAN",
    ]),
    bankName: getResultValue(results, ["BankName", "Bank"]),
    companyName: getResultValue(results, [
      "AccountName",
      "CompanyName",
      "LegalNameEnglish",
      "BusinessName",
      "TradeName",
    ]),
    tradeName: getResultValue(results, ["TradeName"]),
    status: validationSucceeded ? "ACTIVE" : "NOT_FOUND",
  };
}
