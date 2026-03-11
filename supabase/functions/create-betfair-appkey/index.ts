import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { username, password, appName } = await req.json();

    if (!username || !password || !appName) {
      return new Response(
        JSON.stringify({ error: "username, password e appName são obrigatórios" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // PASSO 1: Login na Betfair
    console.log("Tentando login na Betfair...");

    const loginResponse = await fetch(
      "https://identitysso.betfair.com/api/login",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          "Accept": "application/json",
          "X-Application": "1",
        },
        body: new URLSearchParams({ username, password }),
      }
    );

    const loginContentType = loginResponse.headers.get("content-type") || "";
    if (!loginContentType.includes("application/json")) {
      const rawText = await loginResponse.text();
      console.error("Resposta não-JSON do login:", rawText.substring(0, 200));
      return new Response(
        JSON.stringify({
          error: "Betfair retornou resposta inesperada no login",
          hint: "Verifique usuário e senha. O endpoint pode estar bloqueado nesta região.",
          rawPreview: rawText.substring(0, 200),
        }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const loginData = await loginResponse.json();
    console.log("Resposta login:", JSON.stringify(loginData));

    if (loginData.status !== "SUCCESS") {
      return new Response(
        JSON.stringify({
          error: "Falha no login Betfair",
          status: loginData.status,
          error_detail: loginData.error,
        }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const sessionToken = loginData.token;
    console.log("Login OK. SessionToken obtido.");

    // PASSO 2: Criar App Key
    console.log("Criando App Key...");

    const createKeyResponse = await fetch(
      "https://api.betfair.com/exchange/account/rest/v1.0/createDeveloperAppKeys/",
      {
        method: "POST",
        headers: {
          "Accept": "application/json",
          "Content-Type": "application/json",
          "X-Authentication": sessionToken,
          "X-Application": "1",
        },
        body: JSON.stringify({ appName }),
      }
    );

    const keyContentType = createKeyResponse.headers.get("content-type") || "";
    if (!keyContentType.includes("application/json")) {
      const rawText = await createKeyResponse.text();
      return new Response(
        JSON.stringify({
          error: "Betfair retornou resposta inesperada ao criar App Key",
          rawPreview: rawText.substring(0, 200),
        }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const keyData = await createKeyResponse.json();
    console.log("Resposta App Key:", JSON.stringify(keyData));

    if (keyData.faultcode || keyData.error) {
      return new Response(
        JSON.stringify({ error: "Falha ao criar App Key", detail: keyData }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // PASSO 3: Extrair chaves
    let delayedKey = null;
    let liveKey = null;

    if (keyData.appVersions) {
      for (const version of keyData.appVersions) {
        if (version.delayedKey) delayedKey = version.delayedKey;
        if (version.applicationKey) liveKey = version.applicationKey;
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        appName,
        sessionToken,
        delayedKey,
        liveKey,
        instructions: {
          delayedKey: "Gratuita. Pronta para uso imediato.",
          liveKey: "Requer ativação em developer.betfair.com (taxa única £2.99).",
        },
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Erro:", error);
    return new Response(
      JSON.stringify({ error: "Erro interno", detail: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
