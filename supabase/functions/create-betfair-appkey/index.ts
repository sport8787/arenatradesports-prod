import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

function jsonResponse(payload: unknown, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function normalizeSessionToken(rawValue: unknown): string {
  if (typeof rawValue !== "string") return "";
  const trimmed = rawValue.trim();
  if (!trimmed) return "";
  const withoutPrefix = trimmed.replace(/^ssoid\s*=\s*/i, "");
  const firstPart = withoutPrefix.split(";")[0]?.trim() ?? "";
  return firstPart.replace(/^"|"$/g, "");
}

async function betfairRequest(
  url: string,
  sessionToken: string,
  body: Record<string, unknown> = {},
): Promise<{ ok: boolean; data?: any; raw?: string; status: number }> {
  const res = await fetch(url, {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
      "X-Authentication": sessionToken,
      "X-Application": "1",
    },
    body: JSON.stringify(body),
  });

  const contentType = res.headers.get("content-type") || "";
  const raw = await res.text();
  const looksJson =
    contentType.includes("application/json") || raw.trim().startsWith("{") || raw.trim().startsWith("[");

  if (!looksJson) {
    return { ok: false, raw: raw.slice(0, 300), status: res.status };
  }

  try {
    const data = JSON.parse(raw);
    if (data?.faultcode || data?.error) {
      return { ok: false, data, status: res.status };
    }
    return { ok: true, data, status: res.status };
  } catch {
    return { ok: false, raw: raw.slice(0, 300), status: res.status };
  }
}

function extractKeys(data: any): { delayedKey: string | null; liveKey: string | null } {
  let delayedKey: string | null = null;
  let liveKey: string | null = null;

  // getDeveloperAppKeys returns an array of apps
  const apps = Array.isArray(data) ? data : [data];

  for (const app of apps) {
    const versions = app?.appVersions ?? app?.result?.appVersions ?? [];
    if (Array.isArray(versions)) {
      for (const v of versions) {
        if (v?.delayData === true && v?.applicationKey) {
          delayedKey = v.applicationKey;
        } else if (v?.applicationKey) {
          liveKey = v.applicationKey;
        }
        // fallback fields
        if (v?.delayedKey) delayedKey = v.delayedKey;
      }
    }
  }

  return { delayedKey, liveKey };
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    // Auth check
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return jsonResponse({ error: "Unauthorized" }, 401);
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? "",
      { global: { headers: { Authorization: authHeader } } },
    );

    const token = authHeader.replace("Bearer ", "");
    const { data: claimsData, error: claimsError } = await supabase.auth.getClaims(token);
    if (claimsError || !claimsData?.claims?.sub) {
      return jsonResponse({ error: "Unauthorized" }, 401);
    }

    // Parse input
    const body = await req.json().catch(() => null);
    const sessionToken = normalizeSessionToken(body?.sessionToken);
    const appName = (body?.appName || "").trim();

    if (!sessionToken) {
      return jsonResponse({ error: "sessionToken é obrigatório" }, 400);
    }

    // ── Step 1: Try to GET existing keys first ──
    console.log("Tentando recuperar App Keys existentes...");
    const getResult = await betfairRequest(
      "https://api.betfair.com/exchange/account/rest/v1.0/getDeveloperAppKeys/",
      sessionToken,
    );

    if (getResult.ok && getResult.data) {
      const keys = extractKeys(getResult.data);
      if (keys.delayedKey || keys.liveKey) {
        console.log("App Keys existentes encontradas!");
        return jsonResponse({
          success: true,
          source: "existing",
          appName: Array.isArray(getResult.data) ? getResult.data[0]?.appName : appName,
          ...keys,
          instructions: {
            delayedKey: "Gratuita. Pronta para uso imediato.",
            liveKey: "Requer ativação em developer.betfair.com (taxa única £2.99).",
          },
        });
      }
    }

    // ── Step 2: No existing keys → create new ones ──
    if (!appName) {
      return jsonResponse(
        { error: "Nenhuma App Key encontrada e appName não foi informado para criar uma nova." },
        400,
      );
    }

    console.log(`Nenhuma key existente. Criando App Key "${appName}"...`);
    const createResult = await betfairRequest(
      "https://api.betfair.com/exchange/account/rest/v1.0/createDeveloperAppKeys/",
      sessionToken,
      { appName },
    );

    if (!createResult.ok) {
      const hint = createResult.data?.faultstring === "DSC-0024"
        ? "Erro de formato na requisição. Se já existem keys na sua conta, elas foram retornadas acima."
        : "Verifique se o sessionToken (ssoid) está válido e a sessão ativa na Betfair.";

      return jsonResponse(
        {
          error: "Falha ao criar App Key na Betfair",
          hint,
          detail: createResult.data ?? createResult.raw,
        },
        400,
      );
    }

    const keys = extractKeys(createResult.data);
    return jsonResponse({
      success: true,
      source: "created",
      appName,
      ...keys,
      instructions: {
        delayedKey: "Gratuita. Pronta para uso imediato.",
        liveKey: "Requer ativação em developer.betfair.com (taxa única £2.99).",
      },
    });
  } catch (error) {
    console.error("Erro create-betfair-appkey:", error);
    return jsonResponse(
      { error: "Erro interno", detail: error instanceof Error ? error.message : "unknown_error" },
      500,
    );
  }
});
