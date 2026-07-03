import {
  DocumentType,
  AzureValidationResponse,
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

function mapAzureDocumentType(documentType: DocumentType) {
  if (documentType === "trade_license") return "trade";
  if (documentType === "vat_certificate") return "vat";
  return "bank";
}

function parseMaybeJson(value: FormDataEntryValue | null) {
  if (typeof value !== "string" || !value.trim()) {
    return value ?? null;
  }

  try {
    return JSON.parse(value);
  } catch {
    return value;
  }
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
    const contentType = request.headers.get("content-type") || "";
    if (!contentType.includes("multipart/form-data")) {
      return Response.json({ error: "multipart/form-data is required" }, { status: 400 });
    }

    const requestFormData = await request.formData();
    const documentType = String(requestFormData.get("documentType") || "").trim();
    const companyName = String(requestFormData.get("companyName") || requestFormData.get("company_name") || "").trim();
    const conversationId = String(requestFormData.get("conversation_id") || requestFormData.get("conversationId") || "").trim();
    const tradeLicenseNumber = String(requestFormData.get("trade_license_number") || requestFormData.get("tradeLicenseNumber") || "").trim();
    const documentContext = parseMaybeJson(requestFormData.get("document_context") || requestFormData.get("documentContext"));
    const contextHint = parseMaybeJson(requestFormData.get("context_hint") || requestFormData.get("contextHint"));
    const isPresetSample = parseMaybeJson(requestFormData.get("isPresetSample"));
    const mimeType = String(requestFormData.get("mimeType") || "").trim();
    const file = requestFormData.get("file");

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

    if (!(file instanceof File)) {
      return Response.json({ error: "file payload is required" }, { status: 400 });
    }

    const mimeTypeValue = file.type || mimeType || "application/octet-stream";
    const resolvedFileBytes = new Uint8Array(await file.arrayBuffer());
    const fileBlob = new Blob([resolvedFileBytes], { type: mimeTypeValue });
    const azureDocumentType = mapAzureDocumentType(documentType as DocumentType);
    const payloadFormData = new FormData();
    payloadFormData.append(
      "file",
      fileBlob,
      `${azureDocumentType}.${mimeTypeValue.includes("pdf") ? "pdf" : "bin"}`
    );
    payloadFormData.append("document_type", azureDocumentType);
    payloadFormData.append("documentType", documentType);
    if (companyName) {
      payloadFormData.append("companyName", companyName);
      payloadFormData.append("company_name", companyName);
    }
    if (conversationId) {
      payloadFormData.append("conversation_id", conversationId);
    }
    if (tradeLicenseNumber) {
      payloadFormData.append("trade_license_number", tradeLicenseNumber);
    }
    if (documentContext !== null && documentContext !== undefined) {
      payloadFormData.append("document_context", typeof documentContext === "string" ? documentContext : JSON.stringify(documentContext));
    }
    if (contextHint !== null && contextHint !== undefined) {
      payloadFormData.append("context_hint", typeof contextHint === "string" ? contextHint : JSON.stringify(contextHint));
    }
    if (isPresetSample !== null && isPresetSample !== undefined) {
      payloadFormData.append("isPresetSample", typeof isPresetSample === "string" ? isPresetSample : JSON.stringify(isPresetSample));
    }
    payloadFormData.append("mimeType", mimeTypeValue);

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
      fileName: file.name,
    });

    const externalRes = await fetch(validationConfig.url, {
      method: "POST",
      body: payloadFormData,
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
    const mergedLlmExtraction =
      (parsedResponse as any).llm_extraction ||
      (parsedResponse as any).llmExtraction ||
      (parsedResponse as any).extraction?.llm_extraction ||
      (parsedResponse as any).extraction?.llmExtraction ||
      null;

    return Response.json({
      status: "success",
      ocrSource: validationConfig.ocrSource,
      validationStatus: parsedResponse.status || "unknown",
      score: parsedResponse.score ?? null,
      processingTimeMs,
      processingTime: `${(processingTimeMs / 1000).toFixed(2)}s`,
      results: parsedResponse.results || {},
      llm_extraction: mergedLlmExtraction,
      llmExtraction: mergedLlmExtraction,
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
        llm_extraction: mergedLlmExtraction,
        llmExtraction: mergedLlmExtraction,
        gpt_review: mergedGptReview,
      },
      requestContext: {
        company_name: companyName || null,
        conversation_id: conversationId || null,
        trade_license_number: tradeLicenseNumber || null,
        document_context: documentContext,
        context_hint: contextHint,
        is_preset_sample: isPresetSample ?? null,
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
