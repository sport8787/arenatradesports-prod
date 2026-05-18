// Edge Function: mycroft-players-punter
// ─────────────────────────────────────────────────────────────────────────────
// DEPRECATED (Fase 2 — Migração Sportmonks, 18/05/2026)
//
// Esta edge dependia 100% da API-Football (/players, /fixtures/lineups,
// /fixtures/events) para gerar sinais de jogadores (gols, chutes, SOG,
// assistências). A API-Football foi descontinuada do projeto.
//
// Sportmonks (Pro Advanced) não expõe estatísticas de jogador por 90min com
// a granularidade necessária. Decisão registrada em chat: mantém o mercado
// desativado até encontrarmos um provider melhor.
//
// O cron `punter-prelive-players-1730-brt` foi removido. Chamadas manuais
// retornam 200 + payload informativo sem persistir nada.
// ─────────────────────────────────────────────────────────────────────────────

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

serve((req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  console.warn("[players] deprecated — API-Football removida; mercado desativado");
  return new Response(
    JSON.stringify({
      success: true,
      deprecated: true,
      message:
        "mercado de jogadores desativado (Fase 2 — API-Football descontinuada, Sportmonks não cobre player props)",
      analyzed: 0,
      approved: 0,
      informative: 0,
    }),
    { headers: { ...corsHeaders, "Content-Type": "application/json" } },
  );
});
