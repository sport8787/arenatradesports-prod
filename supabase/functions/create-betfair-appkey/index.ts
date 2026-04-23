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

function extractKeys(data: any): { delayedKey: string | null; liveKey: string | null; appName: string | null } {
  let delayedKey: string | null = null;
  let liveKey: string | null = null;
  let appName: string | null = null;

  const root = data?.result ?? data;
  const apps = Array.isArray(root) ? root : root ? [root] : [];

  for (const app of apps) {
    if (!appName && typeof app?.appName === "string") {
      appName = app.appName;
    }

    const versions = app?.appVersions ?? app?.result?.appVersions ?? [];
    if (!Array.isArray(versions)) continue;

    for (const version of versions) {
      if (version?.delayData === true && version?.applicationKey) {
        delayedKey = version.applicationKey;
      } else if (version?.applicationKey) {
        liveKey = version.applicationKey;
      }

      if (version?.delayedKey) {
        delayedKey = version.delayedKey;
      }
    }
  }

  return { delayedKey, liveKey, appName };
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
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

    const body = await req.json().catch(() => null);
    const sessionToken = normalizeSessionToken(body?.sessionToken);
    const requestedAppName = typeof body?.appName === "string" && body.appName.trim()
      ? body.appName.trim()
      : "ArenaTradeBot";

    console.log("[create-betfair-appkey] user:", claimsData.claims.sub, "ssoidLen:", sessionToken.length, "appName:", requestedAppName);

    if (!sessionToken) {
      return jsonResponse({ error: "sessionToken é obrigatório" }, 400);
    }
    if (sessionToken.length < 20) {
      return jsonResponse({
        error: "SSOID inválido",
        hint: "O valor parece curto demais. Cole apenas o VALOR do cookie ssoid (sem 'ssoid=' e sem ponto e vírgula).",
      }, 400);
    }

    const BR_API = "https://api.betfair.bet.br/exchange/account/rest/v1.0";

    console.log("[create-betfair-appkey] Consultando getDeveloperAppKeys (BR)...");
    const getResult = await betfairRequest(
      `${BR_API}/getDeveloperAppKeys/`,
      sessionToken,
      {},
    );
    console.log("[create-betfair-appkey] getResult.ok:", getResult.ok, "status:", getResult.status);

    if (!getResult.ok) {
      console.log("[create-betfair-appkey] BR falhou. Tentando endpoint global...");
      const getGlobal = await betfairRequest(
        "https://api.betfair.com/exchange/account/rest/v1.0/getDeveloperAppKeys/",
        sessionToken,
        {},
      );
      console.log("[create-betfair-appkey] getGlobal.ok:", getGlobal.ok, "status:", getGlobal.status);
      if (!getGlobal.ok) {
        const detailBr = getResult.data ?? getResult.raw;
        const detailGlobal = getGlobal.data ?? getGlobal.raw;
        console.error("[create-betfair-appkey] Falha total:", { detailBr, detailGlobal });
        return jsonResponse(
          {
            error: "A Betfair recusou a requisição",
            hint: "Sessão (SSOID) inválida, expirada ou sem permissão. Faça login na Betfair Brasil, copie um SSOID novo e tente novamente.",
            detail_br: detailBr,
            detail_global: detailGlobal,
          },
          400,
        );
      }
      // Use global result
      Object.assign(getResult, getGlobal);
    }

    let keys = extractKeys(getResult.data);
    if (!keys.delayedKey && !keys.liveKey) {
      console.log("[create-betfair-appkey] Nenhuma key existente. Tentando createDeveloperAppKeys (BR)...");
      const createResult = await betfairRequest(
        `${BR_API}/createDeveloperAppKeys/`,
        sessionToken,
        { appName: requestedAppName },
      );
      console.log("[create-betfair-appkey] createResult.ok:", createResult.ok, "status:", createResult.status);
      if (createResult.ok) {
        console.log("[create-betfair-appkey] App Key criada:", JSON.stringify(createResult.data).slice(0, 300));
        keys = extractKeys(createResult.data);
      } else {
        const createDetail = createResult.data ?? createResult.raw;
        console.error("[create-betfair-appkey] createDeveloperAppKeys falhou:", JSON.stringify(createDetail).slice(0, 500));
        return jsonResponse(
          {
            error: "Não foi possível criar a App Key na Betfair",
            hint: "Pode ser que já exista uma App Key com esse nome OU sua conta ainda não esteja habilitada como Developer. Tente outro nome ou crie manualmente em developer.betfair.com.",
            detail: createDetail,
          },
          400,
        );
      }
    }

    return jsonResponse({
      success: true,
      source: keys.appName ? "existing" : "created",
      appName: keys.appName,
      delayedKey: keys.delayedKey,
      liveKey: keys.liveKey,
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
