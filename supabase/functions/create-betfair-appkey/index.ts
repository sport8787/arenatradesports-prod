import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

function jsonResponse(payload: unknown, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

async function parseJsonSafe(raw: string) {
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
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
    const sessionToken = body?.sessionToken?.trim();
    const appName = body?.appName?.trim();

    if (!sessionToken || !appName) {
      return jsonResponse(
        { error: "sessionToken e appName são obrigatórios" },
        400,
      );
    }

    console.log("Criando App Key Betfair com sessionToken informado pelo usuário...");

    const createKeyResponse = await fetch(
      "https://api.betfair.com/exchange/account/rest/v1.0/createDeveloperAppKeys/",
      {
        method: "POST",
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
          "X-Authentication": sessionToken,
          "X-Application": "1",
        },
        body: JSON.stringify({ appName }),
      },
    );

    const keyContentType = createKeyResponse.headers.get("content-type") || "";
    const keyRaw = await createKeyResponse.text();
    const keyLooksJson = keyContentType.includes("application/json") || keyRaw.trim().startsWith("{");

    if (!keyLooksJson) {
      return jsonResponse(
        {
          error: "Betfair retornou resposta inesperada ao criar App Key",
          hint: "Verifique se o sessionToken (ssoid) é válido e se a sessão ainda está ativa na Betfair.",
          preview: keyRaw.slice(0, 180),
        },
        502,
      );
    }

    const keyData = await parseJsonSafe(keyRaw);
    if (!keyData) {
      return jsonResponse(
        {
          error: "Resposta inválida da Betfair ao criar App Key",
          preview: keyRaw.slice(0, 180),
        },
        502,
      );
    }

    if (keyData.faultcode || keyData.error) {
      return jsonResponse(
        {
          error: "Falha ao criar App Key",
          detail: keyData,
        },
        400,
      );
    }

    const versions = keyData?.appVersions ?? keyData?.result?.appVersions ?? [];

    let delayedKey: string | null = null;
    let liveKey: string | null = null;

    if (Array.isArray(versions)) {
      for (const version of versions) {
        if (version?.delayedKey) delayedKey = version.delayedKey;
        if (version?.applicationKey) liveKey = version.applicationKey;
      }
    }

    return jsonResponse({
      success: true,
      appName,
      delayedKey,
      liveKey,
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
