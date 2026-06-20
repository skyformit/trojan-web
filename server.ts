import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import dotenv from "dotenv";

dotenv.config();

const app = express();
const PORT = Number(process.env.PORT) || 3000;
const HOST = process.env.HOST || "127.0.0.1";
const GENERAL_BOT_ENDPOINT = process.env.GENERAL_BOT_ENDPOINT || "";
const TBMS_VENDOR_LOOKUP_ENDPOINT = process.env.TBMS_VENDOR_LOOKUP_ENDPOINT || "";

type DocumentType = "trade_license" | "vat_certificate" | "bank_document";

type AzureValidationResponse = {
  status?: string;
  score?: number | null;
  results?: Record<string, { value?: string; confidence?: number }>;
  error?: {
    code?: string;
    message?: string;
  };
};

type GeneralBotResponse = {
  ok?: boolean;
  status?: "completed" | "expired" | "renewal_due" | string;
  text?: string;
  source?: string;
  origin?: string;
  source_type?: string;
  response_type?: string;
  conversation_id?: string;
  routing?: {
    expiry_date?: string;
    days_remaining?: number;
    status?: "completed" | "expired" | "renewal_due" | string;
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
};

const VALIDATION_ENDPOINTS: Record<
  DocumentType,
  { url: string; ocrSource: string }
> = {
  trade_license: {
    url: process.env.TRADE_LICENSE_VALIDATE_ENDPOINT || "",
    ocrSource: "azure_validate_trade_license",
  },
  vat_certificate: {
    url: process.env.VAT_VALIDATE_ENDPOINT || "",
    ocrSource: "azure_validate_vat",
  },
  bank_document: {
    url: process.env.BANK_VALIDATE_ENDPOINT || "",
    ocrSource: "azure_validate_bank_document",
  },
};

function getResultValue(
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

function getMimeTypeFromDataUrl(fileBase64: string, fallbackMimeType: string) {
  const match = fileBase64.match(/^data:([^;]+);base64,/);
  return match?.[1] || fallbackMimeType || "application/octet-stream";
}

function getBase64Payload(fileBase64: string) {
  const separatorIndex = fileBase64.indexOf(",");
  return separatorIndex >= 0 ? fileBase64.slice(separatorIndex + 1) : fileBase64;
}

function parseExpiryDateFromText(text: string) {
  const patterns = [
    /(?:Trade License Expiry(?: \(last on record\))?:?\s*)(\d{1,2}\s+[A-Za-z]{3,9}\s+\d{4})/i,
    /(?:expires on|expired on|expiry date(?: is listed as)?)(?:\s+is\s+listed\s+as)?\s*(\d{1,2}\s+[A-Za-z]{3,9}\s+\d{4})/i,
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

function normalizeGeneralBotResponse(payload: GeneralBotResponse): GeneralBotResponse {
  const structuredSource = Boolean(payload.source_type || payload.response_type || payload.source || payload.origin);
  if (structuredSource) {
    return payload;
  }

  const text = payload.text || "";
  const statusFromPayload = payload.status || payload.routing?.status || "completed";
  const expiryDate = parseExpiryDateFromText(text);
  const lowerText = text.toLowerCase();

  const inferredStatus =
    expiryDate && expiryDate.getTime() < Date.now()
      ? "expired"
      : lowerText.includes("renewal_due") || lowerText.includes("renewal")
        ? "renewal_due"
        : statusFromPayload;

  if (inferredStatus === "expired") {
    return {
      ...payload,
      status: "expired",
      ok: false,
      routing: {
        expiry_date: expiryDate ? expiryDate.toISOString().slice(0, 10) : payload.routing?.expiry_date,
        days_remaining: expiryDate ? Math.floor((expiryDate.getTime() - Date.now()) / 86400000) : payload.routing?.days_remaining,
        status: "expired",
        workflow_name: "TCG-Vendor-Approval-Workflow",
      },
      workflow_started: true,
    };
  }

  if (inferredStatus === "renewal_due") {
    return {
      ...payload,
      status: "renewal_due",
      routing: {
        expiry_date: payload.routing?.expiry_date,
        days_remaining: payload.routing?.days_remaining,
        status: "renewal_due",
        workflow_name: "Renewal-Vendor-Approval-Workflow",
      },
      workflow_started: true,
    };
  }

  return {
    ...payload,
    status: "completed",
    routing: {
      expiry_date: payload.routing?.expiry_date,
      days_remaining: payload.routing?.days_remaining,
      status: "completed",
      workflow_name: payload.agent?.name || "GENERAL_CHAT_AGENT_ID",
    },
  };
}

function looksLikeVendorLookupInput(value: string) {
  const normalized = value.trim();
  if (!normalized) {
    return false;
  }

  if (/^\d+$/.test(normalized)) {
    return true;
  }

  const hasVendorKeyword = /\b(llc|l\.l\.c|ltd|limited|trading|company|corp|corporation|enterprise|est|fze|fzc)\b/i.test(normalized);
  return hasVendorKeyword || normalized.split(/\s+/).length >= 2 || normalized.toLowerCase().includes("trade license");
}

async function fetchVendorLookupFallback(inputText: string) {
  const trimmed = inputText.trim();
  const isLicenseNumber = /^\d+$/.test(trimmed);

  const payload = {
    vendorName: isLicenseNumber ? "" : trimmed,
    vendId: -1,
    licenseNo: isLicenseNumber ? trimmed : "",
    email: "",
    statusId: -1,
  };

  const externalRes = await fetch(TBMS_VENDOR_LOOKUP_ENDPOINT, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  const rawResponse = await externalRes.text();
  let parsedResponse: any;

  try {
    parsedResponse = JSON.parse(rawResponse);
  } catch {
    parsedResponse = {
      ok: externalRes.ok,
      status: externalRes.ok ? "completed" : "error",
      text: rawResponse || "Vendor lookup returned a non-JSON response.",
    };
  }

  return {
    ...parsedResponse,
    source: "tbms",
    origin: "tbms",
    source_type: "tbms",
    status: "completed",
    routing: {
      status: "completed",
      workflow_name: "GENERAL_CHAT_AGENT_ID",
    },
  };
}

function normalizeText(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]/g, "");
}

function normalizeCompanyName(value: string) {
  if (!value) {
    return "";
  }

  let normalized = value.toUpperCase();
  normalized = normalized.replace(/[\(\)\[\],.;\-_/]/g, " ");
  normalized = normalized.replace(/\bL\s*\.?\s*L\s*\.?\s*C\s*\.?\b/g, " ");
  normalized = normalized.replace(/\bC\s*\.?\s*O\s*\.?\b/g, " ");
  normalized = normalized.replace(/\bCO\b/g, " ");
  normalized = normalized.replace(/\bLIMITED\b/g, " ");
  normalized = normalized.replace(/\bLTD\b/g, " ");
  normalized = normalized.replace(/\bCORP\b/g, " ");
  normalized = normalized.replace(/\bINC\b/g, " ");
  normalized = normalized.replace(/\s+/g, " ").trim();

  const tokens = normalized.split(" ");
  for (let size = Math.floor(tokens.length / 2); size >= 1; size -= 1) {
    if (tokens.length % size !== 0) {
      continue;
    }

    const reference = tokens.slice(0, size).join(" ");
    let repeated = true;
    for (let index = size; index < tokens.length; index += size) {
      const candidate = tokens.slice(index, index + size).join(" ");
      if (candidate !== reference) {
        repeated = false;
        break;
      }
    }

    if (repeated) {
      return reference;
    }
  }

  return normalized;
}

function companyNamesMatch(left: string, right: string) {
  const normalizedLeft = normalizeCompanyName(left);
  const normalizedRight = normalizeCompanyName(right);
  return Boolean(normalizedLeft && normalizedRight && normalizedLeft === normalizedRight);
}

function parseDateValue(value: string) {
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

function isNotExpired(expiryValue: string) {
  const normalized = parseDateValue(expiryValue);
  if (!normalized) {
    return false;
  }

  return new Date(`${normalized}T00:00:00Z`) >= new Date();
}

function normalizeValidationResponse(
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

// Enable payload handling for rich base64 image uploads
app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ limit: "50mb", extended: true }));

// Accompanying mock databases of registered commercial entities
// Key schema corresponding to GovernmentRegistryRecord
const governmentRegistries = [
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
    postalAddress: "Floor 12, Enterprise Towers, Tech District 4, Abu Dhabi"
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
    postalAddress: "Warehouse 4A, Terminal Gateway, Logistics Bay East"
  }
 
];

// REST API endpoint: Retrieve list of sandboxed government registrar records
app.get("/api/government-records", (req, res) => {
  res.json({
    status: "success",
    description: "Sandbox Government Business registries connected in sandbox environment.",
    records: governmentRegistries
  });
});

// REST API: General bot routing entrypoint
app.post("/api/invoke-general-bot", async (req, res) => {
  try {
    const inputText =
      req.body?.text ||
      req.body?.message ||
      req.body?.prompt ||
      req.body?.input ||
      req.query?.text ||
      req.query?.message ||
      "";
    const useVendorFallback = looksLikeVendorLookupInput(inputText);
    const explicitIntent = String(req.body?.intent || req.query?.intent || "").toLowerCase();
    const forceVendorLookup = explicitIntent === "vendor_lookup";

    const payload = {
      text: inputText,
      message: inputText,
      prompt: inputText,
      input: inputText,
      conversation_id:
        req.body?.conversation_id ||
        req.body?.conversationId ||
        req.query?.conversation_id ||
        req.query?.conversationId ||
        "",
    };

    if (forceVendorLookup) {
      const vendorFallback = await fetchVendorLookupFallback(inputText);
      return res.status(200).json(vendorFallback);
    }

    const controller = new AbortController();
    const timeoutHandle = setTimeout(() => controller.abort(), 15000);
    let externalRes: Response;

    try {
      externalRes = await fetch(GENERAL_BOT_ENDPOINT, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
        signal: controller.signal,
      });
    } catch (fetchError: any) {
      if (forceVendorLookup || useVendorFallback) {
        const vendorFallback = await fetchVendorLookupFallback(inputText);
        clearTimeout(timeoutHandle);
        return res.status(200).json(vendorFallback);
      }

      clearTimeout(timeoutHandle);
      throw fetchError;
    } finally {
      clearTimeout(timeoutHandle);
    }

    const rawResponse = await externalRes.text();
    let parsedResponse: any;

    try {
      parsedResponse = JSON.parse(rawResponse);
    } catch {
      parsedResponse = {
        ok: externalRes.ok,
        status: externalRes.ok ? "completed" : "error",
        text: rawResponse || "General bot returned a non-JSON response.",
      };
    }

    if (
      useVendorFallback &&
      (parsedResponse?.ok === false || parsedResponse?.error?.code === "response_parse_error")
    ) {
      const vendorFallback = await fetchVendorLookupFallback(inputText);
      return res.status(200).json(vendorFallback);
    }

    return res.status(externalRes.status).json(normalizeGeneralBotResponse(parsedResponse));
  } catch (error: any) {
    console.error("Error in /api/invoke-general-bot:", error);
    return res.status(500).json({
      ok: false,
      status: "error",
      text: error.message || "Internal server error during general bot routing",
    });
  }
});

// REST API: Automated Document Extraction and Pre-validation
app.post("/api/analyze-document", async (req, res) => {
  try {
    const startedAt = performance.now();
    const { documentType, fileBase64, mimeType, isPresetSample, companyName } = req.body;

    if (!documentType) {
      return res.status(400).json({ error: "documentType parameter is required" });
    }

    const validationConfig = VALIDATION_ENDPOINTS[documentType as DocumentType];
    if (!validationConfig) {
      return res.status(400).json({ error: "Unsupported documentType parameter" });
    }

    if (!fileBase64) {
      return res.status(400).json({ error: "fileBase64 payload is required" });
    }

    console.log(
      `Analyzing document of type: ${documentType}. Presetsample: ${isPresetSample ? JSON.stringify(isPresetSample) : "none"}. CompanyName: ${companyName}`
    );

    const mimeTypeValue = getMimeTypeFromDataUrl(fileBase64, mimeType);
    const base64Payload = getBase64Payload(fileBase64);
    const fileBuffer = Buffer.from(base64Payload, "base64");
    const fileBlob = new Blob([fileBuffer], { type: mimeTypeValue });
    const formData = new FormData();
    formData.append(
      "file",
      fileBlob,
      `${documentType}.${mimeTypeValue.includes("pdf") ? "pdf" : "bin"}`
    );

    const externalRes = await fetch(validationConfig.url, {
      method: "POST",
      body: formData,
    });

    const rawResponse = await externalRes.text();
    let parsedResponse: AzureValidationResponse;

    try {
      parsedResponse = JSON.parse(rawResponse) as AzureValidationResponse;
    } catch {
      parsedResponse = {
        status: externalRes.ok ? "success" : "error",
        error: {
          message: rawResponse || "Validator returned a non-JSON response.",
        },
      };
    }

    if (!externalRes.ok && parsedResponse.status !== "success") {
      return res.status(502).json({
        status: "error",
        message:
          parsedResponse.error?.message ||
          rawResponse ||
          "Remote validation service failed.",
      });
    }

    const processingTimeMs = Math.round(performance.now() - startedAt);

    return res.json({
      status: "success",
      ocrSource: validationConfig.ocrSource,
      validationStatus: parsedResponse.status || "unknown",
      score: parsedResponse.score ?? null,
      processingTimeMs,
      processingTime: `${(processingTimeMs / 1000).toFixed(2)}s`,
      extractedData: normalizeValidationResponse(
        documentType as DocumentType,
        parsedResponse
      ),
      rawResponse: parsedResponse,
    });
  } catch (error: any) {
    console.error("Error in /api/analyze-document:", error);
    return res.status(500).json({
      status: "error",
      message: error.message || "Internal server error during document analysis"
    });
  }
});

// REST API: Validates extracted document indices against document-only rules
app.post("/api/verify-government", (req, res) => {
  try {
    const { documentType, extractedFields, enteredCompanyName } = req.body;

    if (!documentType || !extractedFields) {
      return res.status(400).json({ error: "Missing documentType or extractedFields arguments." });
    }

    console.log(`Executing document-only verification on: ${documentType}`);
    const normalizedEnteredCompanyName = normalizeCompanyName((enteredCompanyName || "").trim());

    if (documentType === "trade_license") {
      const licenseNumber = (extractedFields.licenseNumber || "").trim();
      const expiryDate = (extractedFields.expiryDate || "").trim();
      const licensedActivities = (
        extractedFields.licensedActivities ||
        extractedFields.activity ||
        ""
      ).trim();
      const companyName = (extractedFields.companyName || "Verified Trade License").trim();
      const companyNameMatches = companyNamesMatch(normalizedEnteredCompanyName, companyName);
      const isActive =
        companyNameMatches &&
        licenseNumber &&
        expiryDate &&
        licensedActivities &&
        isNotExpired(expiryDate);

      if (isActive) {
        return res.json({
          status: "success",
          matched: true,
          registeredName: companyName,
          registryStatus: "ACTIVE",
          details:
            `Validated trade license from OCR fields. License No: ${licenseNumber}. ` +
            `Expiry: ${expiryDate}. Licensed Activities: ${licensedActivities}.`,
          registryRecord: {
            companyName,
            postalAddress: "Document-Only Validation",
            signatory: extractedFields.manager || extractedFields.authorizedSignatory || "N/A",
            licenseExpiry: expiryDate,
            licensedActivities,
          }
        });
      }

      return res.json({
        status: "success",
        matched: false,
        registryStatus: "NOT_FOUND",
        details: !normalizedEnteredCompanyName
          ? "Entered company name is missing. Please provide the company name from the chat."
          : !companyNameMatches
            ? `Company name mismatch after normalization. Entered: "${enteredCompanyName}". OCR: "${companyName}".`
            : !licenseNumber || !expiryDate || !licensedActivities
              ? "Trade license is missing required OCR fields. Please review license number, expiry date, and licensed activities."
              : `Trade license expired on ${expiryDate}. Please upload a valid license with a future expiry date.`,
      });
    }

    if (documentType === "vat_certificate") {
      const vatNumber = (extractedFields.vatNumber || "").trim();
      const companyName = (extractedFields.companyName || "").trim();
      const companyNameMatches = companyNamesMatch(normalizedEnteredCompanyName, companyName);

      if (vatNumber && companyName && companyNameMatches) {
        return res.json({
          status: "success",
          matched: true,
          registeredName: companyName || "Verified VAT Certificate",
          registryStatus: "ACTIVE",
          details: `Validated VAT certificate from OCR fields. VAT No: ${vatNumber}.`,
          registryRecord: {
            companyName: companyName || "Verified VAT Certificate",
            postalAddress: "Document-Only Validation",
            signatory: extractedFields.manager || extractedFields.authorizedSignatory || "N/A",
            licenseExpiry: extractedFields.registrationDate || "N/A",
          }
        });
      }

      return res.json({
        status: "success",
        matched: false,
        registryStatus: "NOT_FOUND",
        details: !normalizedEnteredCompanyName
          ? "Entered company name is missing. Please provide the company name from the chat."
          : !companyNameMatches
            ? `Company name mismatch after normalization. Entered: "${enteredCompanyName}". OCR: "${companyName}".`
            : "VAT certificate is missing the VAT number or company name OCR field.",
      });
    }

    if (documentType === "bank_document") {
      const companyName = (extractedFields.companyName || "").trim();
      const companyNameMatches = companyNamesMatch(normalizedEnteredCompanyName, companyName);

      if (companyName && companyNameMatches) {
        return res.json({
          status: "success",
          matched: true,
          registeredName: companyName || "Verified Bank Document",
          registryStatus: "ACTIVE",
          details: `Validated bank document from OCR fields. Company Name: ${companyName}.`,
          registryRecord: {
            companyName: companyName || "Verified Bank Document",
            postalAddress: "Document-Only Validation",
            signatory: extractedFields.manager || extractedFields.authorizedSignatory || "N/A",
            licenseExpiry: "N/A",
          }
        });
      }

      return res.json({
        status: "success",
        matched: false,
        registryStatus: "NOT_FOUND",
        details: !normalizedEnteredCompanyName
          ? "Entered company name is missing. Please provide the company name from the chat."
          : !companyNameMatches
            ? `Company name mismatch after normalization. Entered: "${enteredCompanyName}". OCR: "${companyName}".`
            : "Bank document is missing the company name OCR field.",
      });
    }

    return res.status(400).json({
      status: "error",
      message: "Unsupported documentType parameter.",
    });
  } catch (error: any) {
    console.error("Error in /api/verify-government:", error);
    return res.status(500).json({
      status: "error",
      message: error.message || "Internal server error during verification"
    });
  }
});

// Configure Vite middleware interface mapping
async function startServer() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: {
        middlewareMode: true,
        host: HOST,
      },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, HOST, () => {
    console.log(`Supplier Registration server running on http://${HOST}:${PORT}`);
  });
}

startServer();
