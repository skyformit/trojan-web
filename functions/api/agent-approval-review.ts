import { json, PagesEnvBindings } from "../_shared";

type ProxyPayload = Record<string, unknown>;

function getApprovalEndpoint(env?: PagesEnvBindings) {
  return (
    env?.APPROVAL_REVIEW_ENDPOINT ||
    env?.HIDL_APPROVAL ||
    ""
  );
}

export async function onRequestPost({ request, env }: { request: Request; env: PagesEnvBindings }) {
  try {
    const endpoint = getApprovalEndpoint(env);
    if (!endpoint) {
      return json({ ok: false, status: "error", text: "Approval review endpoint is not configured." }, 500);
    }

    const payload = (await request.json()) as ProxyPayload;
    const externalRes = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    const rawResponse = await externalRes.text();
    let parsedResponse: unknown;
    try {
      parsedResponse = JSON.parse(rawResponse);
    } catch {
      parsedResponse = {
        ok: externalRes.ok,
        status: externalRes.ok ? "completed" : "error",
        text: rawResponse || "Approval review returned a non-JSON response.",
      };
    }

    return json(parsedResponse, externalRes.status);
  } catch (error: any) {
    return json(
      {
        ok: false,
        status: "error",
        text: error?.message || "Internal server error during approval review",
      },
      500
    );
  }
}
