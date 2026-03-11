// Edge Function: create-betfair-appkey
// Deploy: supabase functions deploy create-betfair-appkey

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
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

    // ============================================
    // PASSO 1: Login na Betfair — obter sessionToken
    // ============================================
    console.log("Fazendo login na Betfair...");

    const loginResponse = await fetch(
      "https://identitysso.betfair.com/api/login",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          "Accept": "application/json",
        },
        body: new URLSearchParams({ username, password }),
      }
    );

    const loginData = await loginResponse.json();

    if (loginData.status !== "SUCCESS") {
      return new Response(
        JSON.stringify({
          error: "Falha no login Betfair",
          detail: loginData,
        }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const sessionToken = loginData.token;
    console.log("Login OK. SessionToken obtido.");

    // ============================================
    // PASSO 2: Criar App Key
    // ============================================
    console.log("Criando App Key...");

    const createKeyResponse = await fetch(
      "https://api.betfair.com/exchange/account/rest/v1.0/createDeveloperAppKeys/",
      {
        method: "POST",
        headers: {
          "Accept": "application/json",
          "Content-Type": "application/json",
          "X-Authentication": sessionToken,
        },
        body: JSON.stringify({ appName }),
      }
    );

    const keyData = await createKeyResponse.json();

    if (keyData.faultcode || keyData.error) {
      return new Response(
        JSON.stringify({
          error: "Falha ao criar App Key",
          detail: keyData,
        }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ============================================
    // PASSO 3: Extrair as duas chaves geradas
    // ============================================
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
        delayedKey,   // Para testes e desenvolvimento
        liveKey,      // Para produção (requer aprovação + £2.99)
        rawResponse: keyData,
        instructions: {
          delayedKey: "Use para desenvolvimento. Dados com atraso de 1-60s.",
          liveKey: "Para produção. Acesse developer.betfair.com para ativar (taxa única £2.99).",
        }
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );

  } catch (error) {
    console.error("Erro:", error);
    return new Response(
      JSON.stringify({ error: "Erro interno", detail: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
