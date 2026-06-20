export type DocumentType = "trade_license" | "vat_certificate" | "bank_document";

export type AzureValidationResponse = {
  status?: string;
  score?: number | null;
  results?: Record<string, { value?: string; confidence?: number }>;
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
  TRADE_LICENSE_VALIDATE_ENDPOINT?: string;
  VAT_VALIDATE_ENDPOINT?: string;
  BANK_VALIDATE_ENDPOINT?: string;
  ENABLE_LOCAL_ROUTING_HEURISTICS?: string;
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
  return {
    trade_license: {
      url: env?.TRADE_LICENSE_VALIDATE_ENDPOINT || "",
      ocrSource: "azure_validate_trade_license",
    },
    vat_certificate: {
      url: env?.VAT_VALIDATE_ENDPOINT || "",
      ocrSource: "azure_validate_vat",
    },
    bank_document: {
      url: env?.BANK_VALIDATE_ENDPOINT || "",
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

export function getMimeTypeFromDataUrl(fileBase64: string, fallbackMimeType: string) {
  const match = fileBase64.match(/^data:([^;]+);base64,/);
  return match?.[1] || fallbackMimeType || "application/octet-stream";
}

export function getBase64Payload(fileBase64: string) {
  const separatorIndex = fileBase64.indexOf(",");
  return separatorIndex >= 0 ? fileBase64.slice(separatorIndex + 1) : fileBase64;
}

export function parseDateValue(value: string) {
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
    const first = Number(numericMatch[1]);
    const second = Number(numericMatch[2]);
    const year = numericMatch[3];

    const day = first;
    const month = second;
    const dayString = String(day).padStart(2, "0");
    const monthString = String(month).padStart(2, "0");
    return `${year}-${monthString}-${dayString}`;
  }

  const textualMatch = trimmed.match(/^(\d{1,2})\s+([A-Za-z]{3,9})\s+(\d{4})$/);
  if (textualMatch) {
    const parsed = new Date(`${textualMatch[1]} ${textualMatch[2]} ${textualMatch[3]}`);
    if (!Number.isNaN(parsed.getTime())) {
      return parsed.toISOString().slice(0, 10);
    }
  }

  const parsed = new Date(trimmed);
  if (!Number.isNaN(parsed.getTime())) {
    return parsed.toISOString().slice(0, 10);
  }

  return null;
}

export function isNotExpired(expiryValue: string) {
  const normalized = parseDateValue(expiryValue);
  if (!normalized) {
    return false;
  }

  return new Date(`${normalized}T00:00:00Z`) >= new Date();
}

export function normalizeValidationResponse(
  documentType: DocumentType,
  payload: AzureValidationResponse
) {
  const results = payload.results || {};
  const validationSucceeded = payload.status === "success";

  if (documentType === "trade_license") {
    const companyName = getResultValue(results, [
      "OperatingName",
      "BusinessName",
      "CompanyName",
      "LegalNameEnglish",
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
      issueDate: getResultValue(results, ["IssueDate"]),
      expiryDate: getResultValue(results, ["ExpiryDate"]),
      activity: licensedActivities,
      licensedActivities,
      status: validationSucceeded ? "ACTIVE" : "NOT_FOUND",
      manager: getResultValue(results, ["Manager", "AuthorizedSignatory"]),
    };
  }

  if (documentType === "vat_certificate") {
    const companyName = getResultValue(results, [
      "LegalNameEnglish",
      "CompanyName",
      "BusinessName",
      "OperatingName",
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
      registrationDate: getResultValue(results, ["RegistrationDate", "IssueDate"]),
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
    ]),
    status: validationSucceeded ? "ACTIVE" : "NOT_FOUND",
  };
}
