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

    // PASSO 1: Login na Betfair — tentar múltiplos endpoints
    console.log("Fazendo login na Betfair...");

    const loginEndpoints = [
      "https://identitysso.betfair.com/api/login",
      "https://identitysso-cert.betfair.com/api/login",
      "https://identitysso.betfair.es/api/login",
      "https://identitysso.betfair.it/api/login",
    ];

    let loginData: any = null;
    let loginError: string | null = null;

    for (const endpoint of loginEndpoints) {
      try {
        console.log(`Tentando endpoint: ${endpoint}`);
        const loginResponse = await fetch(endpoint, {
          method: "POST",
          headers: {
            "Content-Type": "application/x-www-form-urlencoded",
            "Accept": "application/json",
            "X-Application": "BetfairAPI",
          },
          body: new URLSearchParams({ username, password }),
        });

        const contentType = loginResponse.headers.get("content-type") || "";
        const responseText = await loginResponse.text();

        if (!contentType.includes("application/json") && !responseText.startsWith("{")) {
          console.log(`Endpoint ${endpoint} retornou HTML/não-JSON. Tentando próximo...`);
          loginError = `Endpoint ${endpoint} bloqueado (retornou HTML)`;
          continue;
        }

        loginData = JSON.parse(responseText);

        if (loginData.status === "SUCCESS") {
          console.log(`Login OK via ${endpoint}`);
          break;
        } else {
          loginError = loginData.error || `Status: ${loginData.status}`;
          loginData = null;
        }
      } catch (e) {
        console.log(`Erro no endpoint ${endpoint}: ${e.message}`);
        loginError = e.message;
        continue;
      }
    }

    if (!loginData || loginData.status !== "SUCCESS") {
      return new Response(
        JSON.stringify({
          error: "Falha no login Betfair",
          detail: loginError || "Todos os endpoints retornaram erro ou estão bloqueados",
          hint: "Verifique se seu usuário e senha estão corretos. A Betfair pode estar bloqueando requisições desta região.",
        }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const sessionToken = loginData.token;

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
          "X-Application": "BetfairAPI",
        },
        body: JSON.stringify({ appName }),
      }
    );

    const keyContentType = createKeyResponse.headers.get("content-type") || "";
    const keyText = await createKeyResponse.text();

    if (!keyContentType.includes("application/json") && !keyText.startsWith("{") && !keyText.startsWith("[")) {
      return new Response(
        JSON.stringify({
          error: "API de criação de chave retornou resposta inválida",
          detail: keyText.substring(0, 200),
        }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const keyData = JSON.parse(keyText);

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

    console.log("App Key criada com sucesso!");

    return new Response(
      JSON.stringify({
        success: true,
        appName,
        sessionToken,
        delayedKey,
        liveKey,
        rawResponse: keyData,
        instructions: {
          delayedKey: "Use para desenvolvimento. Dados com atraso de 1-60s.",
          liveKey: "Para produção. Acesse developer.betfair.com para ativar (taxa única £2.99).",
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
