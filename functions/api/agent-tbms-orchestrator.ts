import { json, PagesEnvBindings } from "../_shared";

type ProxyPayload = Record<string, unknown>;

function getOrchestratorEndpoint(env?: PagesEnvBindings) {
  return (
    env?.TBMS_ORCHESTRATOR_ENDPOINT ||
    "https://tch-function-gxbndjf4gzhad6eu.uaenorth-01.azurewebsites.net/api/agent-tbms-orchestrator?code=GDTM4c0yAfM5OhdmC9uTTYbJh4Vg5rO4JzjBR4INYyYMAzFuixAauw%3D%3D"
  );
}

export async function onRequestPost({ request, env }: { request: Request; env: PagesEnvBindings }) {
  try {
    const endpoint = getOrchestratorEndpoint(env);

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
        text: rawResponse || "TBMS orchestrator returned a non-JSON response.",
      };
    }

    return json(parsedResponse, externalRes.status);
  } catch (error: any) {
    return json(
      {
        ok: false,
        status: "error",
        text: error?.message || "Internal server error during TBMS orchestrator submission",
      },
      500
    );
  }
}
