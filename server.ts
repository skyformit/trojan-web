import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import dotenv from "dotenv";

dotenv.config();

const app = express();
const PORT = Number(process.env.PORT) || 3000;

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

const VALIDATION_ENDPOINTS: Record<
  DocumentType,
  { url: string; ocrSource: string }
> = {
  trade_license: {
    url: "https://tch-function-gxbndjf4gzhad6eu.uaenorth-01.azurewebsites.net/api/ValidateTradeLicense?code=drayAXzDlc9JFtMuPoxdlhAaekt84LKJHrWEcnjmz40uAzFu1sXXIg%3D%3D",
    ocrSource: "azure_validate_trade_license",
  },
  vat_certificate: {
    url: "https://tch-function-gxbndjf4gzhad6eu.uaenorth-01.azurewebsites.net/api/ValidateVAT?code=EAN5oM7CKZSNjgg3HKO-kHz4I8YOZ7Nq5LQfpvMbJGXzAzFueDuLBw%3D%3D",
    ocrSource: "azure_validate_vat",
  },
  bank_document: {
    url: "https://tch-function-gxbndjf4gzhad6eu.uaenorth-01.azurewebsites.net/api/ValidateBankDocument?code=VLHaPcPmNrSDrlXgyy7fsx3Th9-S2jjxwriAn9ewT-CyAzFueFYoYg%3D%3D",
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

function normalizeText(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]/g, "");
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

// REST API: Automated Document Extraction and Pre-validation
app.post("/api/analyze-document", async (req, res) => {
  try {
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

    return res.json({
      status: "success",
      ocrSource: validationConfig.ocrSource,
      validationStatus: parsedResponse.status || "unknown",
      score: parsedResponse.score ?? null,
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
    const { documentType, extractedFields } = req.body;

    if (!documentType || !extractedFields) {
      return res.status(400).json({ error: "Missing documentType or extractedFields arguments." });
    }

    console.log(`Executing document-only verification on: ${documentType}`);

    if (documentType === "trade_license") {
      const licenseNumber = (extractedFields.licenseNumber || "").trim();
      const expiryDate = (extractedFields.expiryDate || "").trim();
      const licensedActivities = (
        extractedFields.licensedActivities ||
        extractedFields.activity ||
        ""
      ).trim();
      const companyName = (extractedFields.companyName || "Verified Trade License").trim();
      const isActive = licenseNumber && expiryDate && licensedActivities && isNotExpired(expiryDate);

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
        details: !licenseNumber || !expiryDate || !licensedActivities
          ? "Trade license is missing required OCR fields. Please review license number, expiry date, and licensed activities."
          : `Trade license expired on ${expiryDate}. Please upload a valid license with a future expiry date.`,
      });
    }

    if (documentType === "vat_certificate") {
      const vatNumber = (extractedFields.vatNumber || "").trim();
      const companyName = (extractedFields.companyName || "").trim();

      if (vatNumber && companyName) {
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
        details: "VAT certificate is missing the VAT number or company name OCR field.",
      });
    }

    if (documentType === "bank_document") {
      const companyName = (extractedFields.companyName || "").trim();

      if (companyName) {
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
        details: "Bank document is missing the company name OCR field.",
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
      server: { middlewareMode: true },
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

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Supplier Registration server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
