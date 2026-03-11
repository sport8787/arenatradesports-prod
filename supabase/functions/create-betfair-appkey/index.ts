import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const LOGIN_ENDPOINTS = [
  "https://identitysso.betfair.com/api/login",
  "https://identitysso.betfair.es/api/login",
  "https://identitysso.betfair.it/api/login",
  "https://identitysso.betfair.ro/api/login",
  "https://identitysso-cert.betfair.com/api/login",
];

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
    const username = body?.username?.trim();
    const password = body?.password;
    const appName = body?.appName?.trim();

    if (!username || !password || !appName) {
      return jsonResponse(
        { error: "username, password e appName são obrigatórios" },
        400,
      );
    }

    let sessionToken: string | null = null;
    const loginAttempts: Array<Record<string, unknown>> = [];

    for (const endpoint of LOGIN_ENDPOINTS) {
      console.log(`Tentando login endpoint: ${endpoint}`);

      const loginParams = new URLSearchParams({
        username,
        password,
        locale: "pt_BR",
        redirectMethod: "POST",
        product: "bfexplorer",
        url: "https://www.betfair.com",
      });

      const loginResponse = await fetch(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          Accept: "application/json",
          "X-Application": "1",
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
        },
        body: loginParams,
        redirect: "manual",
      });

      const contentType = loginResponse.headers.get("content-type") || "";
      const location = loginResponse.headers.get("location") || null;
      const rawText = await loginResponse.text();
      const looksJson = contentType.includes("application/json") || rawText.trim().startsWith("{");

      if (loginResponse.status >= 300 && loginResponse.status < 400) {
        loginAttempts.push({
          endpoint,
          status: loginResponse.status,
          reason: "redirect",
          location,
        });
        continue;
      }

      if (!looksJson) {
        loginAttempts.push({
          endpoint,
          status: loginResponse.status,
          reason: "non_json",
          preview: rawText.slice(0, 180),
        });
        continue;
      }

      const loginData = await parseJsonSafe(rawText);
      if (!loginData) {
        loginAttempts.push({
          endpoint,
          status: loginResponse.status,
          reason: "invalid_json",
          preview: rawText.slice(0, 180),
        });
        continue;
      }

      if (loginData?.status === "SUCCESS" && loginData?.token) {
        sessionToken = loginData.token;
        break;
      }

      loginAttempts.push({
        endpoint,
        status: loginResponse.status,
        reason: "login_failed",
        betfairStatus: loginData?.status ?? null,
        betfairError: loginData?.error ?? null,
      });
    }

    if (!sessionToken) {
      console.error("Falha no login Betfair", JSON.stringify(loginAttempts));
      return jsonResponse(
        {
          error: "Falha no login Betfair via API",
          hint:
            "Betfair retornou bloqueio/regra de acesso nos endpoints testados. Tente novamente em alguns minutos; se persistir, a conta/região está bloqueando login por API.",
          attempts: loginAttempts,
        },
        502,
      );
    }

    console.log("Login Betfair OK. Criando App Key...");

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
      return jsonResponse({ error: "Falha ao criar App Key", detail: keyData }, 400);
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
