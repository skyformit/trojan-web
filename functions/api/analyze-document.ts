import {
  DocumentType,
  AzureValidationResponse,
  getBase64Payload,
  getMimeTypeFromDataUrl,
  getValidationEndpoints,
  normalizeValidationResponse,
  PagesEnvBindings,
} from "../_shared";

type ExpertReview = {
  is_consistent: boolean;
  anomalies: string[];
  plausibility_score: number;
  reasoning: string;
};

function toFileBuffer(fileBase64: string) {
  const base64Payload = getBase64Payload(fileBase64);
  const binary = atob(base64Payload);
  const bytes = new Uint8Array(binary.length);

  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }

  return bytes;
}

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

function buildFallbackExpertReview(
  documentType: DocumentType,
  parsedResponse: AzureValidationResponse,
  extractedData: Record<string, unknown>
): ExpertReview {
  const results = parsedResponse.results || {};
  const anomalies: string[] = [];
  const confidenceWarnings = Object.entries(results)
    .filter(([, field]) => typeof field.confidence === "number" && (field.confidence ?? 0) < 0.5)
    .slice(0, 3)
    .map(([field, value]) => `${field} confidence is low (${(value.confidence ?? 0).toFixed(3)}).`);

  const addIfMissing = (label: string, value: unknown) => {
    if (!String(value ?? "").trim()) {
      anomalies.push(`${label} is missing or unreadable.`);
    }
  };

  if (documentType === "trade_license") {
    addIfMissing("License number", extractedData.licenseNumber);
    addIfMissing("Company name", extractedData.companyName);
    addIfMissing("Expiry date", extractedData.expiryDate);
  } else if (documentType === "vat_certificate") {
    addIfMissing("VAT / TRN", extractedData.vatNumber || extractedData.taxRegistrationNumber);
    addIfMissing("Company name", extractedData.companyName);
  } else {
    addIfMissing("Bank account number", extractedData.bankAccountNumber);
    addIfMissing("Bank name", extractedData.bankName);
    addIfMissing("Company name", extractedData.companyName);
  }

  anomalies.push(...confidenceWarnings);

  const uniqueAnomalies = Array.from(new Set(anomalies));
  const isConsistent = uniqueAnomalies.length === 0 && parsedResponse.status === "success";
  const baseScore = typeof parsedResponse.score === "number" ? parsedResponse.score : 0.75;
  const penalty = Math.min(uniqueAnomalies.length * 0.12, 0.45);
  const plausibility_score = Number(Math.max(0, Math.min(1, baseScore - penalty)).toFixed(4));

  const documentLabel =
    documentType === "trade_license"
      ? "trade license"
      : documentType === "vat_certificate"
        ? "VAT certificate"
        : "bank document";

  return {
    is_consistent: isConsistent,
    anomalies: uniqueAnomalies,
    plausibility_score,
    reasoning: uniqueAnomalies.length > 0
      ? `Automated review flagged ${documentLabel} extraction inconsistencies that should be checked before approval.`
      : `Automated review found the ${documentLabel} extraction to be internally consistent.`,
  };
}

export async function onRequestPost({ request, env }: { request: Request; env: PagesEnvBindings }) {
  try {
    const startedAt = performance.now();
    const { documentType, fileBase64, mimeType } = (await request.json()) as {
      documentType?: string;
      fileBase64?: string;
      mimeType?: string;
    };

    if (!documentType) {
      return Response.json({ error: "documentType parameter is required" }, { status: 400 });
    }

    const validationConfig = getValidationEndpoints(env)[documentType as DocumentType];
    if (!validationConfig) {
      return Response.json({ error: "Unsupported documentType parameter" }, { status: 400 });
    }

    if (!validationConfig.url) {
      return Response.json({ error: "Validation endpoint is not configured." }, { status: 500 });
    }

    if (!fileBase64) {
      return Response.json({ error: "fileBase64 payload is required" }, { status: 400 });
    }

    const mimeTypeValue = getMimeTypeFromDataUrl(fileBase64, mimeType || "");
    const fileBytes = toFileBuffer(fileBase64);
    const fileBlob = new Blob([fileBytes], { type: mimeTypeValue });
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
      return Response.json(
        {
          status: "error",
          message:
            parsedResponse.error?.message ||
            rawResponse ||
            "Remote validation service failed.",
        },
        { status: 502 }
      );
    }

    const processingTimeMs = Math.round(performance.now() - startedAt);
    const extractedData = normalizeValidationResponse(
      documentType as DocumentType,
      parsedResponse
    );
    const tradeName = getResultValue(parsedResponse.results, ["TradeName"]);
    const fallbackReview = buildFallbackExpertReview(
      documentType as DocumentType,
      parsedResponse,
      extractedData as Record<string, unknown>
    );
    const mergedGptReview = parsedResponse.gpt_review || fallbackReview;

    return Response.json({
      status: "success",
      ocrSource: validationConfig.ocrSource,
      validationStatus: parsedResponse.status || "unknown",
      score: parsedResponse.score ?? null,
      processingTimeMs,
      processingTime: `${(processingTimeMs / 1000).toFixed(2)}s`,
      results: parsedResponse.results || {},
      documentAcceptance: parsedResponse.document_acceptance || null,
      extractedData: {
        ...extractedData,
        tradeName: (extractedData as Record<string, unknown>).tradeName || tradeName,
        companyName:
          (extractedData as Record<string, unknown>).companyName ||
          (extractedData as Record<string, unknown>).tradeName ||
          tradeName,
      },
      gptReview: mergedGptReview,
      rawResponse: {
        ...parsedResponse,
        gpt_review: mergedGptReview,
      },
    });
  } catch (error: any) {
    return Response.json(
      {
        status: "error",
        message: error.message || "Internal server error during document analysis",
      },
      { status: 500 }
    );
  }
}
