import { DocumentType, isNotExpired } from "../_shared";

function normalizeCompanyName(value: string) {
  if (!value) {
    return "";
  }

  let normalized = value.toUpperCase();
  normalized = normalized.replace(/[\(\)\[\],.;\-_/]/g, " ");
  normalized = normalized.replace(/\bL\s*\.?\s*L\s*\.?\s*C\s*\.?\b/g, " ");
  normalized = normalized.replace(/\bC\s*\.?\s*O\s*\.?\b/g, " ");
  normalized = normalized.replace(/\bCO\b/g, " ");
  normalized = normalized.replace(/\bSOLE\s+PROPRIETORSHIP\b/g, " ");
  normalized = normalized.replace(/\bSOLE\s+PROPRIETOR\b/g, " ");
  normalized = normalized.replace(/\bPROPRIETORSHIP\b/g, " ");
  normalized = normalized.replace(/\bESTABLISHMENT\b/g, " ");
  normalized = normalized.replace(/\bBRANCH\b/g, " ");
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

function cleanCompanyDisplayName(value: string) {
  return value
    .replace(/\s+/g, " ")
    .replace(/\bL\s*\.?\s*L\s*\.?\s*C\s*\.?\b/gi, " ")
    .replace(/\bLIMITED\b/gi, " ")
    .replace(/\bLTD\b/gi, " ")
    .replace(/\bCORP\b/gi, " ")
    .replace(/\bINC\b/gi, " ")
    .replace(/\bCO\b/gi, " ")
    .replace(/\bSOLE\s+PROPRIETORSHIP\b/gi, " ")
    .replace(/\bSOLE\s+PROPRIETOR\b/gi, " ")
    .replace(/\bPROPRIETORSHIP\b/gi, " ")
    .replace(/\bESTABLISHMENT\b/gi, " ")
    .replace(/\bBRANCH\b/gi, " ")
    .replace(/\bLLP\b/gi, " ")
    .replace(/\bFZE\b/gi, " ")
    .replace(/\bFZC\b/gi, " ")
    .replace(/\bEST\b/gi, " ")
    .trim();
}

function isLocationLikeName(value: string) {
  const normalized = cleanCompanyDisplayName(value).toLowerCase();
  if (!normalized) {
    return true;
  }

  if (/^(abu dhabi|dubai|sharjah|ajman|ra's? al khaimah|ras al khaimah|umm al quwain|fujairah|uae|united arab emirates)$/i.test(normalized)) {
    return true;
  }

  const tokens = normalized.split(" ").filter(Boolean);
  return tokens.length <= 2 && !/\b(llc|l\.l\.c|ltd|limited|company|corp|corporation|enterprise|group|trading|engineering|services|service|materials|equipment|contracting|consulting|solutions|industries|international|supplies|supply)\b/i.test(normalized);
}

function getCompanyNameForVerification(extractedFields: Record<string, string>) {
  const candidates = [
    extractedFields.tradeName || "",
    extractedFields.companyName || "",
    extractedFields.operatingName || "",
    extractedFields.legalNameEnglish || "",
    extractedFields.businessName || "",
  ];

  for (const candidate of candidates) {
    const trimmed = candidate.trim();
    if (trimmed && !isLocationLikeName(trimmed)) {
      return cleanCompanyDisplayName(trimmed);
    }
  }

  const fallback = candidates.find(candidate => candidate.trim()) || "";
  return cleanCompanyDisplayName(fallback);
}

function json(data: unknown, status = 200) {
  return Response.json(data, { status });
}

export async function onRequestPost({ request }: { request: Request }) {
  try {
    const { documentType, extractedFields, enteredCompanyName } = (await request.json()) as {
      documentType?: string;
      extractedFields?: Record<string, string>;
      enteredCompanyName?: string;
    };

    if (!documentType || !extractedFields) {
      return json({ error: "Missing documentType or extractedFields arguments." }, 400);
    }

    const normalizedEnteredCompanyName = normalizeCompanyName((enteredCompanyName || "").trim());

    if (documentType === "trade_license") {
      const licenseNumber = (extractedFields.licenseNumber || "").trim();
      const expiryDate = (extractedFields.expiryDate || "").trim();
      const licensedActivities = (
        extractedFields.licensedActivities ||
        extractedFields.activity ||
        ""
      ).trim();
      const companyName = getCompanyNameForVerification(extractedFields);
      const companyNameMatches = companyNamesMatch(normalizedEnteredCompanyName, companyName);
      const isActive =
        companyNameMatches &&
        licenseNumber &&
        expiryDate &&
        licensedActivities &&
        isNotExpired(expiryDate);

      if (isActive) {
        return json({
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
          },
        });
      }

      return json({
        status: "success",
        matched: false,
        registryStatus: "NOT_FOUND",
        details: !normalizedEnteredCompanyName
          ? "Entered company name is missing. Please provide the company name from the chat."
          : !companyNameMatches
            ? `Company name mismatch after normalization. Entered: "${enteredCompanyName}". OCR: "${companyName || 'not extracted'}".`
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
        return json({
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
          },
        });
      }

      return json({
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
        return json({
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
          },
        });
      }

      return json({
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

    return json({
      status: "error",
      message: "Unsupported documentType parameter.",
    }, 400);
  } catch (error: any) {
    return json(
      {
        status: "error",
        message: error.message || "Internal server error during verification",
      },
      500
    );
  }
}
