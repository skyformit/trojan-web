import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import dotenv from "dotenv";
import multer from "multer";

dotenv.config();

const app = express();
const multipartUpload = multer({ storage: multer.memoryStorage() });
const PORT = Number(process.env.PORT) || 3000;
const HOST = process.env.HOST || "127.0.0.1";
const GENERAL_BOT_ENDPOINT = process.env.GENERAL_BOT_ENDPOINT || "";
const DOCUMENT_EXTRACTION_ENDPOINT =
  process.env.DOCUMENT_EXTRACTION_ENDPOINT ||
  process.env.TRADE_LICENSE_VALIDATE_ENDPOINT ||
  process.env.VAT_VALIDATE_ENDPOINT ||
  process.env.BANK_VALIDATE_ENDPOINT ||
  "";
const TBMS_RECONCILIATION_ENDPOINT =
  process.env.TBMS_RECONCILIATION_ENDPOINT ||
  process.env.TBMS_RECONCILIATION ||
  "";
const APPROVAL_REVIEW_ENDPOINT =
  process.env.APPROVAL_REVIEW_ENDPOINT ||
  process.env.HIDL_APPROVAL ||
  "";
const TBMS_ORCHESTRATOR_ENDPOINT =
  process.env.TBMS_ORCHESTRATOR_ENDPOINT ||
  process.env.TBMS_ORCHESTRATION_ENDPOINT ||
  process.env.TBMS_ORCHESTRATOR ||
  "https://tch-function-gxbndjf4gzhad6eu.uaenorth-01.azurewebsites.net/api/agent-tbms-orchestrator?code=GDTM4c0yAfM5OhdmC9uTTYbJh4Vg5rO4JzjBR4INYyYMAzFuixAauw%3D%3D";

type DocumentType = "trade_license" | "vat_certificate" | "bank_document";

function mapAzureDocumentType(documentType: DocumentType) {
  if (documentType === "trade_license") return "trade";
  if (documentType === "vat_certificate") return "vat";
  return "bank";
}

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
  intent?: "lookup" | "chat" | string;
  next_action?: string;
  context?: {
    intent?: "lookup" | "chat" | string;
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
  entities?: {
    company_name?: string | null;
    trade_license_number?: string | null;
    vat_number?: string | null;
    bank_name?: string | null;
    account_number?: string | null;
    iban?: string | null;
  };
  confidence?: number;
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
  error?: {
    code?: string;
    message?: string;
  };
};

const VALIDATION_ENDPOINTS: Record<
  DocumentType,
  { url: string; ocrSource: string }
> = {
  trade_license: {
    url: DOCUMENT_EXTRACTION_ENDPOINT,
    ocrSource: "azure_validate_trade_license",
  },
  vat_certificate: {
    url: DOCUMENT_EXTRACTION_ENDPOINT,
    ocrSource: "azure_validate_vat",
  },
  bank_document: {
    url: DOCUMENT_EXTRACTION_ENDPOINT,
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

function pickBestCompanyName(...candidates: Array<string | null | undefined>) {
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

function parseMaybeJson(value: unknown) {
  if (typeof value !== "string" || !value.trim()) {
    return value ?? null;
  }

  try {
    return JSON.parse(value);
  } catch {
    return value;
  }
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

function normalizeValidationResponse(
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
      context: req.body?.context,
    };

    const fetchGeneralBot = async () => {
      const controller = new AbortController();
      const timeoutHandle = setTimeout(() => controller.abort(), 15000);
      try {
        return await fetch(GENERAL_BOT_ENDPOINT, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(payload),
          signal: controller.signal,
        });
      } finally {
        clearTimeout(timeoutHandle);
      }
    };

    let externalRes: Response;
    try {
      externalRes = await fetchGeneralBot();
    } catch (fetchError: any) {
      const isAbortError =
        fetchError?.name === "AbortError" ||
        /aborted|This operation was aborted/i.test(fetchError?.message || "");

      if (!isAbortError) {
        throw fetchError;
      }

      console.warn("General bot request aborted, retrying once...");

      externalRes = await fetchGeneralBot();
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
app.post("/api/analyze-document", multipartUpload.single("file"), async (req, res) => {
  try {
    const startedAt = performance.now();
    const contentType = String(req.headers["content-type"] || "");
    if (!contentType.includes("multipart/form-data")) {
      return res.status(400).json({ error: "multipart/form-data is required" });
    }

    const fields = req.body as Record<string, string | undefined>;
    const documentType = String(fields?.documentType || "").trim();
    const mimeType = String(fields?.mimeType || "").trim();
    const isPresetSample = parseMaybeJson(fields?.isPresetSample);
    const companyName = String(fields?.companyName || fields?.company_name || "").trim();
    const conversationId = String(fields?.conversation_id || fields?.conversationId || "").trim();
    const tradeLicenseNumber = String(fields?.trade_license_number || fields?.tradeLicenseNumber || "").trim();
    const documentContext = parseMaybeJson(fields?.document_context || fields?.documentContext || null);
    const contextHint = parseMaybeJson(fields?.context_hint || fields?.contextHint || null);
    const uploadedFile = req.file;

    if (!documentType) {
      return res.status(400).json({ error: "documentType parameter is required" });
    }

    const validationConfig = VALIDATION_ENDPOINTS[documentType as DocumentType];
    if (!validationConfig) {
      return res.status(400).json({ error: "Unsupported documentType parameter" });
    }

    if (!uploadedFile?.buffer) {
      return res.status(400).json({
        error: "file payload is required",
      });
    }

    console.log(
      `Analyzing document of type: ${documentType}. Presetsample: ${isPresetSample ? JSON.stringify(isPresetSample) : "none"}. CompanyName: ${companyName}. ConversationId: ${conversationId}. TradeLicenseNumber: ${tradeLicenseNumber}. Multipart: true.`
    );

    const mimeTypeValue = uploadedFile.mimetype || mimeType || "application/octet-stream";
    const resolvedFileBuffer = uploadedFile.buffer;
    const fileBlob = new Blob([resolvedFileBuffer], { type: mimeTypeValue });
    const azureDocumentType = mapAzureDocumentType(documentType as DocumentType);
    const formData = new FormData();
    formData.append(
      "file",
      fileBlob,
      `${azureDocumentType}.${mimeTypeValue.includes("pdf") ? "pdf" : "bin"}`
    );
    formData.append("document_type", azureDocumentType);
    formData.append("documentType", documentType);
    if (companyName) {
      formData.append("companyName", companyName);
      formData.append("company_name", companyName);
    }
    if (conversationId) {
      formData.append("conversation_id", conversationId);
    }
    if (tradeLicenseNumber) {
      formData.append("trade_license_number", tradeLicenseNumber);
    }
    if (documentContext !== null && documentContext !== undefined) {
      formData.append("document_context", typeof documentContext === "string" ? documentContext : JSON.stringify(documentContext));
    }
    if (contextHint !== null && contextHint !== undefined) {
      formData.append("context_hint", typeof contextHint === "string" ? contextHint : JSON.stringify(contextHint));
    }
    if (isPresetSample !== null && isPresetSample !== undefined) {
      formData.append("isPresetSample", typeof isPresetSample === "string" ? isPresetSample : JSON.stringify(isPresetSample));
    }
    formData.append("mimeType", mimeTypeValue);

    console.log("Forwarding multipart payload to Azure validator:", {
      documentType,
      azureDocumentType,
      companyName,
      conversationId,
      tradeLicenseNumber,
      hasDocumentContext: documentContext !== null && documentContext !== undefined,
      hasContextHint: contextHint !== null && contextHint !== undefined,
      isPresetSample: isPresetSample !== null && isPresetSample !== undefined,
      mimeType: mimeTypeValue,
      fileName: uploadedFile.originalname,
    });

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

    const extractedData = normalizeValidationResponse(
      documentType as DocumentType,
      parsedResponse
    );
    const tradeName = getResultValue(parsedResponse.results, ["TradeName"]);
    const mergedLlmExtraction =
      (parsedResponse as any).llm_extraction ||
      (parsedResponse as any).llmExtraction ||
      (parsedResponse as any).extraction?.llm_extraction ||
      (parsedResponse as any).extraction?.llmExtraction ||
      null;

    return res.json({
      status: "success",
      ocrSource: validationConfig.ocrSource,
      validationStatus: parsedResponse.status || "unknown",
      score: parsedResponse.score ?? null,
      processingTimeMs,
      processingTime: `${(processingTimeMs / 1000).toFixed(2)}s`,
      results: parsedResponse.results || {},
      llm_extraction: mergedLlmExtraction,
      llmExtraction: mergedLlmExtraction,
      documentAcceptance: (parsedResponse as any).document_acceptance || null,
      extractedData: {
        ...extractedData,
        tradeName: extractedData.tradeName || tradeName,
        companyName: extractedData.companyName || extractedData.tradeName || tradeName,
      },
      rawResponse: {
        ...parsedResponse,
        llm_extraction: mergedLlmExtraction,
        llmExtraction: mergedLlmExtraction,
      },
      requestContext: {
        company_name: companyName || null,
        conversation_id: conversationId || null,
        trade_license_number: tradeLicenseNumber || null,
        document_context: documentContext,
        context_hint: contextHint,
      },
    });
  } catch (error: any) {
    console.error("Error in /api/analyze-document:", error);
    return res.status(500).json({
      status: "error",
      message: error.message || "Internal server error during document analysis"
    });
  }
});

app.post("/api/agent-tbms-reconciliation", async (req, res) => {
  try {
    if (!TBMS_RECONCILIATION_ENDPOINT) {
      return res.status(500).json({ ok: false, status: "error", text: "TBMS reconciliation endpoint is not configured." });
    }

    const externalRes = await fetch(TBMS_RECONCILIATION_ENDPOINT, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(req.body || {}),
    });

    const rawResponse = await externalRes.text();
    let parsedResponse: any;

    try {
      parsedResponse = JSON.parse(rawResponse);
    } catch {
      parsedResponse = {
        ok: externalRes.ok,
        status: externalRes.ok ? "completed" : "error",
        text: rawResponse || "TBMS reconciliation returned a non-JSON response.",
      };
    }

    return res.status(externalRes.status).json(parsedResponse);
  } catch (error: any) {
    console.error("Error in /api/agent-tbms-reconciliation:", error);
    return res.status(500).json({
      ok: false,
      status: "error",
      text: error.message || "Internal server error during TBMS reconciliation",
    });
  }
});

app.post("/api/agent-approval-review", async (req, res) => {
  try {
    if (!APPROVAL_REVIEW_ENDPOINT) {
      return res.status(500).json({ ok: false, status: "error", text: "Approval review endpoint is not configured." });
    }

    const externalRes = await fetch(APPROVAL_REVIEW_ENDPOINT, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(req.body || {}),
    });

    const rawResponse = await externalRes.text();
    let parsedResponse: any;

    try {
      parsedResponse = JSON.parse(rawResponse);
    } catch {
      parsedResponse = {
        ok: externalRes.ok,
        status: externalRes.ok ? "completed" : "error",
        text: rawResponse || "Approval review returned a non-JSON response.",
      };
    }

    return res.status(externalRes.status).json(parsedResponse);
  } catch (error: any) {
    console.error("Error in /api/agent-approval-review:", error);
    return res.status(500).json({
      ok: false,
      status: "error",
      text: error.message || "Internal server error during approval review",
    });
  }
});

app.post("/api/agent-tbms-orchestrator", async (req, res) => {
  try {
    if (!TBMS_ORCHESTRATOR_ENDPOINT) {
      return res.status(500).json({
        ok: false,
        status: "error",
        text: "TBMS orchestrator endpoint is not configured. Please set TBMS_ORCHESTRATOR_ENDPOINT in .env and restart the server.",
      });
    }

    const externalRes = await fetch(TBMS_ORCHESTRATOR_ENDPOINT, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(req.body || {}),
    });

    const rawResponse = await externalRes.text();
    let parsedResponse: any;

    try {
      parsedResponse = JSON.parse(rawResponse);
    } catch {
      parsedResponse = {
        ok: externalRes.ok,
        status: externalRes.ok ? "completed" : "error",
        text: rawResponse || "TBMS orchestrator returned a non-JSON response.",
      };
    }

    return res.status(externalRes.status).json(parsedResponse);
  } catch (error: any) {
    console.error("Error in /api/agent-tbms-orchestrator:", error);
    return res.status(500).json({
      ok: false,
      status: "error",
      text: error.message || "Internal server error during TBMS orchestrator submission",
    });
  }
});

// REST API: Passthrough verification response using Azure-extracted fields only
app.post("/api/verify-government", (req, res) => {
  try {
    const { documentType, extractedFields } = req.body;

    if (!documentType || !extractedFields) {
      return res.status(400).json({ error: "Missing documentType or extractedFields arguments." });
    }

    const companyName = (
      extractedFields.tradeName ||
      extractedFields.companyName ||
      extractedFields.operatingName ||
      extractedFields.legalNameEnglish ||
      extractedFields.businessName ||
      "Verified Document"
    ).trim();

    if (documentType === "trade_license") {
      return res.json({
        status: "success",
        matched: true,
        registeredName: companyName,
        registryStatus: "ACTIVE",
        details: "Trade license data received from Azure backend response.",
        registryRecord: {
          companyName,
          postalAddress: extractedFields.address || "Document-Only Validation",
          signatory: extractedFields.manager || extractedFields.authorizedSignatory || "N/A",
          licenseExpiry: extractedFields.expiryDate || "N/A",
          licensedActivities: extractedFields.licensedActivities || extractedFields.activity || "N/A",
        },
      });
    }

    if (documentType === "vat_certificate") {
      return res.json({
        status: "success",
        matched: true,
        registeredName: companyName,
        registryStatus: "ACTIVE",
        details: "VAT document data received from Azure backend response.",
        registryRecord: {
          companyName,
          postalAddress: extractedFields.address || "Document-Only Validation",
          signatory: extractedFields.manager || extractedFields.authorizedSignatory || "N/A",
          licenseExpiry: extractedFields.registrationDate || "N/A",
        },
      });
    }

    if (documentType === "bank_document") {
      return res.json({
        status: "success",
        matched: true,
        registeredName: companyName,
        registryStatus: "ACTIVE",
        details: "Bank document data received from Azure backend response.",
        registryRecord: {
          companyName,
          postalAddress: extractedFields.address || "Document-Only Validation",
          signatory: extractedFields.manager || extractedFields.authorizedSignatory || "N/A",
          licenseExpiry: "N/A",
        },
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
