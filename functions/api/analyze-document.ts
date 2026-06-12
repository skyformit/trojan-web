import {
  DocumentType,
  AzureValidationResponse,
  VALIDATION_ENDPOINTS,
  getBase64Payload,
  getMimeTypeFromDataUrl,
  normalizeValidationResponse,
} from "../_shared";

function toFileBuffer(fileBase64: string) {
  const base64Payload = getBase64Payload(fileBase64);
  const binary = atob(base64Payload);
  const bytes = new Uint8Array(binary.length);

  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }

  return bytes;
}

export async function onRequestPost({ request }: { request: Request }) {
  try {
    const { documentType, fileBase64, mimeType } = (await request.json()) as {
      documentType?: string;
      fileBase64?: string;
      mimeType?: string;
    };

    if (!documentType) {
      return Response.json({ error: "documentType parameter is required" }, { status: 400 });
    }

    const validationConfig = VALIDATION_ENDPOINTS[documentType as DocumentType];
    if (!validationConfig) {
      return Response.json({ error: "Unsupported documentType parameter" }, { status: 400 });
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

    return Response.json({
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
    return Response.json(
      {
        status: "error",
        message: error.message || "Internal server error during document analysis",
      },
      { status: 500 }
    );
  }
}
