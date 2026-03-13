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

    if (!sessionToken) {
      return jsonResponse({ error: "sessionToken é obrigatório" }, 400);
    }

    const BR_API = "https://api.betfair.bet.br/exchange/account/rest/v1.0";

    console.log("Consultando App Keys existentes via getDeveloperAppKeys (BR endpoint)...");
    const getResult = await betfairRequest(
      `${BR_API}/getDeveloperAppKeys/`,
      sessionToken,
      {},
    );

    if (!getResult.ok) {
      console.log("BR endpoint falhou, tentando endpoint global como fallback...");
      const getGlobal = await betfairRequest(
        "https://api.betfair.com/exchange/account/rest/v1.0/getDeveloperAppKeys/",
        sessionToken,
        {},
      );
      if (!getGlobal.ok) {
        return jsonResponse(
          {
            error: "Falha ao consultar App Keys na Betfair (BR e global)",
            hint: "Sessão inválida, expirada ou sem permissão para consultar as chaves.",
            detail_br: getResult.data ?? getResult.raw,
            detail_global: getGlobal.data ?? getGlobal.raw,
          },
          400,
        );
      }
      // Use global result
      Object.assign(getResult, getGlobal);
    }

    let keys = extractKeys(getResult.data);
    if (!keys.delayedKey && !keys.liveKey) {
      // Try creating via BR endpoint
      console.log("Nenhuma key encontrada, tentando createDeveloperAppKeys no endpoint BR...");
      const createResult = await betfairRequest(
        `${BR_API}/createDeveloperAppKeys/`,
        sessionToken,
        { appName: "ArenaTradeBot" },
      );
      if (createResult.ok) {
        console.log("App Key criada com sucesso via BR endpoint:", JSON.stringify(createResult.data));
        keys = extractKeys(createResult.data);
      } else {
        console.log("createDeveloperAppKeys BR falhou:", JSON.stringify(createResult.data ?? createResult.raw));
        return jsonResponse(
          {
            error: "Nenhuma App Key existente encontrada e falha ao criar nova.",
            hint: "Tente criar manualmente no portal Betfair Developer.",
            detail: createResult.data ?? createResult.raw,
          },
          404,
        );
      }
    }

    return jsonResponse({
      success: true,
      source: "existing",
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
