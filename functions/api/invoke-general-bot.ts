import { json } from "../_shared";

const GENERAL_BOT_ENDPOINT =
  process.env.GENERAL_BOT_ENDPOINT || "";

const TBMS_VENDOR_LOOKUP_ENDPOINT =
  process.env.TBMS_VENDOR_LOOKUP_ENDPOINT || "";

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
  error?: {
    code?: string;
    message?: string;
  };
};

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

export async function onRequestPost({ request }: { request: Request }) {
  try {
    const input = (await request.json()) as Record<string, unknown>;
    const inputText =
      String(input?.text || input?.message || input?.prompt || input?.input || "").trim();
    const explicitIntent = String(input?.intent || "").toLowerCase();
    const forceVendorLookup = explicitIntent === "vendor_lookup";
    const useVendorFallback = looksLikeVendorLookupInput(inputText);

    const payload = {
      text: inputText,
      message: inputText,
      prompt: inputText,
      input: inputText,
      conversation_id: String(input?.conversation_id || input?.conversationId || ""),
    };

    if (!GENERAL_BOT_ENDPOINT || !TBMS_VENDOR_LOOKUP_ENDPOINT) {
      return json(
        {
          ok: false,
          status: "error",
          text: "Routing endpoints are not configured.",
        },
        500
      );
    }

    if (forceVendorLookup) {
      return json(await fetchVendorLookupFallback(inputText));
    }

    const controller = new AbortController();
    const timeoutHandle = setTimeout(() => controller.abort(), 15000);

    try {
      const externalRes = await fetch(GENERAL_BOT_ENDPOINT, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
        signal: controller.signal,
      });

      const rawResponse = await externalRes.text();
      let parsedResponse: GeneralBotResponse;

      try {
        parsedResponse = JSON.parse(rawResponse) as GeneralBotResponse;
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
        return json(await fetchVendorLookupFallback(inputText));
      }

      return json(normalizeGeneralBotResponse(parsedResponse), externalRes.status);
    } catch (error: any) {
      if (forceVendorLookup || useVendorFallback) {
        return json(await fetchVendorLookupFallback(inputText));
      }

      return json(
        {
          ok: false,
          status: "error",
          text: error?.message || "Internal server error during general bot routing",
        },
        500
      );
    } finally {
      clearTimeout(timeoutHandle);
    }
  } catch (error: any) {
    return json(
      {
        ok: false,
        status: "error",
        text: error?.message || "Internal server error during general bot routing",
      },
      500
    );
  }
}
