// =============================================================================
// EVENTOS RAROS — Live Monitor
// Roda a cada 3 minutos. Para cada candidato APROVADO:
//   - Verifica condições de entrada (minuto + placar)
//   - Cria sinal ATIVO (modo simulado: sem odd Betfair, alerta manual)
//   - Monitora condições de saída (placar evolui contra a tese)
// =============================================================================
import { createClient } from "npm:@supabase/supabase-js@2";
import { logEdgeError } from "../_shared/logEdgeError.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const API_FOOTBALL_KEY = ""; // API-Football removida em Fase 2 (18/05/2026) — eventos-raros-live precisa migrar para Sportmonks
const BETFAIR_MODE = Deno.env.get("BETFAIR_MODE") ?? "simulado";
const TELEGRAM_BOT_TOKEN = Deno.env.get("TELEGRAM_BOT_TOKEN");
// Eventos raros LIVE vão APENAS para o grupo Trader.
const TELEGRAM_CHAT_ID = Deno.env.get("TELEGRAM_CHAT_ID_TRADER");
const SITE_URL = Deno.env.get("PUBLIC_SITE_URL") ?? "https://oraculo-mycroft.com";

const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
const API_BASE = "https://v3.football.api-sports.io";

function favoritoDoCandidato(c: any): string {
  const fh = Number(c.forca_ofensiva_home ?? 0);
  const fa = Number(c.forca_ofensiva_away ?? 0);
  return fh >= fa ? c.home_team : c.away_team;
}

function rotuloEstrategia(alvo: string, favorito?: string | null): string {
  switch (alvo) {
    case "LAY_GOLEADA":
      return favorito
        ? `LAY Goleada do favorito (${favorito}) — apostar contra vitória por ≥3 gols`
        : "LAY Goleada do favorito (≥3 gols de diferença)";
    case "LAY_2x2": return "LAY 2x2 (placar exato)";
    case "LAY_1x3": return "LAY 1x3 (placar exato)";
    case "LAY_3x1": return "LAY 3x1 (placar exato)";
    case "BACK_0x0": return "BACK 0x0 — operar a favor do empate sem gols";
    default: return alvo;
  }
}

function linkArena(arenas: string[] | null): string {
  if (arenas?.includes("trader_sports")) return `${SITE_URL}/arena-trader-sports#eventos-raros`;
  if (arenas?.includes("punter")) return `${SITE_URL}/punter#eventos-raros`;
  return SITE_URL;
}

async function tg(text: string) {
  if (!TELEGRAM_BOT_TOKEN || !TELEGRAM_CHAT_ID) return;
  await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      chat_id: TELEGRAM_CHAT_ID,
      text,
      parse_mode: "Markdown",
      disable_web_page_preview: true,
    }),
  }).catch(() => {});
}

async function getLiveFixture(matchId: string) {
  const r = await fetch(`${API_BASE}/fixtures?id=${matchId}`, {
    headers: { "x-apisports-key": API_FOOTBALL_KEY },
  });
  if (!r.ok) return null;
  const j = await r.json();
  return j.response?.[0] ?? null;
}

function placarString(h: number, a: number) {
  return `${h}x${a}`;
}

// Condição de ENTRADA por placar alvo
function podeEntrar(alvo: string, sh: number, sa: number, minuto: number) {
  const total = sh + sa;
  const diff = Math.abs(sh - sa);
  switch (alvo) {
    case "LAY_GOLEADA":
      // Entra cedo (até min 25), placar 0x0 ou 1x0/0x1
      return minuto >= 5 && minuto <= 25 && total <= 1;
    case "LAY_2x2":
      // Entra após 1x1 antes do min 70
      return sh === 1 && sa === 1 && minuto >= 30 && minuto <= 70;
    case "LAY_1x3":
      // Entra com 1x2 ou 0x2 após min 30
      return ((sh === 1 && sa === 2) || (sh === 0 && sa === 2)) && minuto >= 30 && minuto <= 70;
    case "LAY_3x1":
      return ((sh === 2 && sa === 1) || (sh === 2 && sa === 0)) && minuto >= 30 && minuto <= 70;
    case "BACK_0x0":
      // Entra cedo (até min 15) com placar zerado — odds crescem ao longo do jogo
      return minuto >= 1 && minuto <= 15 && sh === 0 && sa === 0;
  }
  return false;
}

// Condição de SAÍDA (placar caminha contra a tese)
function deveSair(alvo: string, sh: number, sa: number, minuto: number): { sair: boolean; motivo: string } {
  const diff = Math.abs(sh - sa);
  switch (alvo) {
    case "LAY_GOLEADA":
      if (diff >= 2 && minuto < 80) return { sair: true, motivo: "Diferença ≥ 2 antes dos 80'" };
      if (sh + sa >= 3 && diff >= 2) return { sair: true, motivo: "Caminhando para goleada" };
      if (minuto >= 85 && diff < 3) return { sair: true, motivo: "Fim de jogo, posição segura" };
      break;
    case "LAY_2x2":
      if (sh === 2 && sa === 2) return { sair: true, motivo: "Placar 2x2 atingido (RED)" };
      if (sh + sa >= 5) return { sair: true, motivo: "Total alto, 2x2 improvável" };
      if (minuto >= 85) return { sair: true, motivo: "Fim de jogo" };
      break;
    case "LAY_1x3":
      if (sh === 1 && sa === 3) return { sair: true, motivo: "Placar 1x3 (RED)" };
      if (minuto >= 85) return { sair: true, motivo: "Fim de jogo" };
      break;
    case "LAY_3x1":
      if (sh === 3 && sa === 1) return { sair: true, motivo: "Placar 3x1 (RED)" };
      if (minuto >= 85) return { sair: true, motivo: "Fim de jogo" };
      break;
    case "BACK_0x0":
      // Qualquer gol antes do fim mata a tese → sai imediatamente como RED
      if (sh + sa >= 1 && minuto < 85) return { sair: true, motivo: "Gol marcado — 0x0 perdido" };
      if (minuto >= 85 && sh === 0 && sa === 0) return { sair: true, motivo: "Min 85 com 0x0 — segurar GREEN" };
      break;
  }
  return { sair: false, motivo: "" };
}

function resultadoFinal(alvo: string, sh: number, sa: number): "GREEN" | "RED" {
  switch (alvo) {
    case "LAY_GOLEADA":
      return Math.abs(sh - sa) >= 3 ? "RED" : "GREEN";
    case "LAY_2x2":
      return sh === 2 && sa === 2 ? "RED" : "GREEN";
    case "LAY_1x3":
      return sh === 1 && sa === 3 ? "RED" : "GREEN";
    case "LAY_3x1":
      return sh === 3 && sa === 1 ? "RED" : "GREEN";
    case "BACK_0x0":
      return sh === 0 && sa === 0 ? "GREEN" : "RED";
  }
  return "GREEN";
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    // Candidatos APROVADOS com jogo nas últimas 4h
    const limite = new Date(Date.now() - 4 * 3600_000).toISOString();
    const futuro = new Date(Date.now() + 30 * 60_000).toISOString();
    const { data: candidatos } = await sb
      .from("eventos_raros_candidatos")
      .select("*")
      .eq("status", "APROVADO")
      .gte("match_date", limite)
      .lte("match_date", futuro);

    if (!candidatos?.length) {
      return new Response(JSON.stringify({ processados: 0 }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let entradas = 0, saidas = 0;

    for (const c of candidatos) {
      const live = await getLiveFixture(c.match_id);
      if (!live) continue;
      const status = live.fixture.status.short;
      const minuto = live.fixture.status.elapsed ?? 0;
      const sh = live.goals.home ?? 0;
      const sa = live.goals.away ?? 0;

      // Sinal já existente?
      const { data: sinalAtivo } = await sb
        .from("eventos_raros_sinais")
        .select("*")
        .eq("candidato_id", c.id)
        .eq("status", "ATIVO")
        .maybeSingle();

      // Jogo terminou?
      if (["FT", "AET", "PEN"].includes(status)) {
        if (sinalAtivo) {
          const r = resultadoFinal(sinalAtivo.placar_alvo, sh, sa);
          await sb.from("eventos_raros_sinais").update({
            status: "ENCERRADO",
            motivo_saida: "Jogo finalizado",
            minuto_saida: minuto,
            placar_saida: placarString(sh, sa),
            resultado: r,
          }).eq("id", sinalAtivo.id);
          saidas++;
        }
        await sb.from("eventos_raros_candidatos").update({ status: "ENCERRADO" }).eq("id", c.id);
        continue;
      }

      // Já tem sinal ativo → checa saída
      if (sinalAtivo) {
        const { sair, motivo } = deveSair(c.placar_alvo, sh, sa, minuto);
        if (sair) {
          const r = resultadoFinal(c.placar_alvo, sh, sa);
          await sb.from("eventos_raros_sinais").update({
            status: "SAIDA_NORMAL",
            motivo_saida: motivo,
            minuto_saida: minuto,
            placar_saida: placarString(sh, sa),
            resultado: r === "RED" ? "RED" : "PENDENTE",
          }).eq("id", sinalAtivo.id);
          saidas++;
          const icon = r === "RED" ? "🔴" : "🟢";
          await tg([
            `${icon} *EVENTO RARO — Saída*`,
            `⚽ ${c.home_team} *${sh}-${sa}* ${c.away_team}`,
            `🏆 ${c.league_name ?? "—"}`,
            `🎯 ${rotuloEstrategia(c.placar_alvo, c.placar_alvo === "LAY_GOLEADA" ? favoritoDoCandidato(c) : null)}`,
            `⏱️ Min ${minuto} · ${motivo}`,
            `📊 Resultado: *${r === "RED" ? "RED" : "PENDENTE"}*`,
            `🔗 [Abrir no painel](${linkArena(c.arenas)})`,
          ].join("\n"));
        }
        continue;
      }

      // Sem sinal → checa entrada
      if (podeEntrar(c.placar_alvo, sh, sa, minuto)) {
        await sb.from("eventos_raros_sinais").insert({
          candidato_id: c.id,
          match_id: c.match_id,
          placar_alvo: c.placar_alvo,
          minuto_entrada: minuto,
          placar_no_momento: placarString(sh, sa),
          modo_betfair: BETFAIR_MODE,
          status: "ATIVO",
          resultado: "PENDENTE",
        });
        entradas++;
        await tg([
          `🚀 *EVENTO RARO — Entrada (${BETFAIR_MODE})*`,
          `⚽ ${c.home_team} *${sh}-${sa}* ${c.away_team}`,
          `🏆 ${c.league_name ?? "—"}`,
          `🎯 ${rotuloEstrategia(c.placar_alvo, c.placar_alvo === "LAY_GOLEADA" ? favoritoDoCandidato(c) : null)}`,
          `⏱️ Entrada: min ${minuto}`,
          `📊 Score qualidade: *${c.score_qualidade ?? "—"}/100*`,
          `🔗 [Abrir no painel](${linkArena(c.arenas)})`,
        ].join("\n"));
      }
    }

    return new Response(
      JSON.stringify({ processados: candidatos.length, entradas, saidas, modo: BETFAIR_MODE }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e: any) {
    console.error("[eventos-raros-live] erro", e);
    await logEdgeError("eventos-raros-live", e).catch(() => {});
    return new Response(JSON.stringify({ error: e?.message ?? String(e) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
