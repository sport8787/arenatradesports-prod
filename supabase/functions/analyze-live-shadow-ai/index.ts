// analyze-live-shadow-ai
// Análise PARALELA pura de IA (DeepSeek com fallback Groq) sobre jogos ao vivo.
// Grava em mycroft_analyses_shadow_ai. Não interfere no motor primário.
// Dedup por (match_id, mercado normalizado) — NÃO empilha sinais.

import { createClient } from "npm:@supabase/supabase-js@2";
import { callDeepseek } from "../_shared/deepseekProvider.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const DEEPSEEK_KEY = Deno.env.get("DEEPSEEK_API_KEY") || "";
const GROQ_API_KEY = Deno.env.get("GROQ_API_KEY") || "";
const GROQ_MODEL = "llama-3.3-70b-versatile";
const GROQ_URL = "https://api.groq.com/openai/v1/chat/completions";
const DEEPSEEK_MODEL = "deepseek-chat";

// Janela de reanálise por minuto (igual ao motor primário)
function reanalysisIntervalMs(minute: number): number {
  if (minute < 25) return 5 * 60_000;
  return 1 * 60_000;
}

function normMarket(m: string): string {
  return String(m || "")
    .toLowerCase()
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/\b(total|gols?|goals?)\b/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function applyMarketSanityVeto(params: {
  verdict: string;
  market: string;
  minute: number;
  period?: string | null;
  scoreHome: number;
  scoreAway: number;
  thesis?: string | null;
}) {
  const activeVerdicts = ["APROVADO", "APROVADO_SITUACIONAL", "LABAREDA"];
  if (!activeVerdicts.includes(params.verdict)) {
    return {
      verdict: params.verdict,
      thesis: params.thesis ?? null,
      vetoed: false,
      vetoReason: null as string | null,
    };
  }

  const marketLower = String(params.market || "").toLowerCase();
  const minute = Number(params.minute ?? 0);
  const sh = Number(params.scoreHome ?? 0);
  const sa = Number(params.scoreAway ?? 0);
  const totalGoals = sh + sa;
  const period = String(params.period || "").toLowerCase();
  const isHTMarket = /(ht|1t|1[ºo]?\s*tempo|primeiro\s*tempo|first\s*half)/.test(marketLower);
  const isSecondHalf = /(second|2nd|2t|2º|2o\s*tempo|segundo|halftime|intervalo|ft|full_time)/.test(period) || minute > 45;

  let vetoReason: string | null = null;

  const isOver05HT =
    /over\s*0\.?5/.test(marketLower) &&
    /(ht|1t|1[ºo]?\s*tempo|primeiro\s*tempo|first\s*half)/.test(marketLower);
  if (isOver05HT) {
    if (minute < 5 || minute > 20 || totalGoals >= 1) {
      vetoReason = `Over 0.5 HT bloqueado: minuto ${minute}, placar ${sh}x${sa}. Janela válida: minuto 5–20 e placar 0x0.`;
    }
  }

  if (!vetoReason) {
    const isBTTS = /(btts|ambas\s*marcam|both\s*teams)/.test(marketLower);
    const isBTTSNo = isBTTS && /(não|nao|\bno\b)/.test(marketLower);
    const isBTTSYes = isBTTS && !isBTTSNo;

    if (isBTTSYes) {
      if (sh >= 1 && sa >= 1) vetoReason = `BTTS Sim já decidido (${sh}x${sa})`;
      else if (minute >= 75 && (sh === 0 || sa === 0)) vetoReason = `BTTS Sim com pouco tempo restante (${minute}', ${sh}x${sa})`;
    }

    if (!vetoReason && isBTTSNo && sh >= 1 && sa >= 1) {
      vetoReason = `BTTS Não já perdido (${sh}x${sa})`;
    }

    if (!vetoReason && !isHTMarket) {
      const overFTMatch = marketLower.match(/over\s*(\d)\.?5/);
      if (overFTMatch) {
        const line = Number(overFTMatch[1]);
        if (totalGoals >= line + 1) vetoReason = `Over ${line}.5 FT já batido (${totalGoals} gols)`;
        else if (line >= 1 && minute > 70 && params.verdict !== "LABAREDA") vetoReason = `Over ${line}.5 FT fora da janela (${minute}')`;
      }
    }

    if (!vetoReason && isHTMarket) {
      const overHTMatch = marketLower.match(/over\s*(\d)\.?5/);
      if (overHTMatch) {
        const line = Number(overHTMatch[1]);
        if (totalGoals >= line + 1) vetoReason = `Over ${line}.5 HT já batido (${totalGoals} gols)`;
        else if (isSecondHalf) vetoReason = `Over ${line}.5 HT com 1º tempo encerrado`;
        else if (minute > 40) vetoReason = `Over ${line}.5 HT fora da janela (${minute}')`;
      }
    }

    if (!vetoReason) {
      const underMatch = marketLower.match(/under\s*(\d)\.?5/);
      if (underMatch) {
        const line = Number(underMatch[1]);
        if (totalGoals >= line + 1) vetoReason = `Under ${line}.5 já estourado (${totalGoals} gols)`;
      }
    }
  }

  if (!vetoReason) {
    return {
      verdict: params.verdict,
      thesis: params.thesis ?? null,
      vetoed: false,
      vetoReason: null as string | null,
    };
  }

  return {
    verdict: "AGUARDAR",
    thesis: `[SAFETY NET] ${vetoReason}. ${params.thesis || ""}`.trim(),
    vetoed: true,
    vetoReason,
  };
}

const SYSTEM_PROMPT = "Você é o Mycroft, analista frio e dedutivo de trading esportivo ao vivo. Responde SOMENTE em JSON pt-br válido.";

function parseJson(raw: string): any {
  try { return JSON.parse(raw); } catch {
    const m = raw.match(/\{[\s\S]*\}/);
    if (m) { try { return JSON.parse(m[0]); } catch { /* ignore */ } }
  }
  return null;
}

async function callGroq(prompt: string, timeoutMs = 20_000): Promise<{ raw: string }> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const resp = await fetch(GROQ_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json", "Authorization": `Bearer ${GROQ_API_KEY}` },
      signal: ctrl.signal,
      body: JSON.stringify({
        model: GROQ_MODEL,
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: prompt },
        ],
        temperature: 0.2,
        max_completion_tokens: 700,
        response_format: { type: "json_object" },
      }),
    });
    if (!resp.ok) {
      const txt = await resp.text().catch(() => "");
      throw new Error(`Groq HTTP ${resp.status} ${txt.slice(0, 200)}`);
    }
    const data = await resp.json();
    return { raw: data?.choices?.[0]?.message?.content ?? "" };
  } finally {
    clearTimeout(timer);
  }
}

async function callAi(prompt: string): Promise<{ json: any; ms: number; raw: string; provider: "deepseek" | "groq"; model: string }> {
  const t0 = Date.now();
  // 1) DeepSeek primário
  if (DEEPSEEK_KEY) {
    try {
      const raw = await callDeepseek(SYSTEM_PROMPT, prompt, {
        model: DEEPSEEK_MODEL,
        temperature: 0.2,
        max_tokens: 700,
        response_format_json: true,
        timeoutMs: 25_000,
      });
      return { json: parseJson(raw), ms: Date.now() - t0, raw, provider: "deepseek", model: DEEPSEEK_MODEL };
    } catch (e) {
      console.warn(`[ShadowAI] DeepSeek falhou, fallback Groq: ${(e as Error).message}`);
    }
  }
  // 2) Fallback Groq
  if (!GROQ_API_KEY) throw new Error("Sem providers disponíveis (DEEPSEEK_API_KEY e GROQ_API_KEY ausentes)");
  const { raw } = await callGroq(prompt);
  return { json: parseJson(raw), ms: Date.now() - t0, raw, provider: "groq", model: GROQ_MODEL };
}

function buildPrompt(m: any): string {
  const s = m.stats || {};
  const xgH = Number(s.xg_home ?? s.xG_home ?? 0);
  const xgA = Number(s.xg_away ?? s.xG_away ?? 0);
  const possH = Number(s.possession_home ?? 0);
  const possA = Number(s.possession_away ?? 0);
  const shotsH = Number(s.shots_home ?? 0);
  const shotsA = Number(s.shots_away ?? 0);
  const sotH = Number(s.shots_on_target_home ?? 0);
  const sotA = Number(s.shots_on_target_away ?? 0);
  const dangH = Number(s.dangerous_attacks_home ?? 0);
  const dangA = Number(s.dangerous_attacks_away ?? 0);
  const corners = Number(s.corners_total ?? 0);

  return `Você é o Mycroft analisando este jogo AO VIVO. Sua missão é IDENTIFICAR VALOR e propor uma entrada sempre que houver edge técnico — não fique conservador demais.

JOGO: ${m.home_team} ${m.score_home ?? 0} x ${m.score_away ?? 0} ${m.away_team}
LIGA: ${m.championship ?? "?"}
MINUTO: ${m.minute ?? 0}'

STATS:
- xG: ${xgH.toFixed(2)} x ${xgA.toFixed(2)} (total ${(xgH + xgA).toFixed(2)})
- Posse: ${possH}% x ${possA}%
- Chutes: ${shotsH} x ${shotsA} (no gol: ${sotH} x ${sotA})
- Ataques perigosos: ${dangH} x ${dangA}
- Escanteios: ${corners}

MERCADOS POSSÍVEIS: Over 0.5 HT, Over 1.5, Over 2.5, Under 2.5, BTTS Sim, BTTS Não, Próximo Gol Casa, Próximo Gol Fora.

GATILHOS DE APROVAÇÃO (escolha o melhor mercado quando QUALQUER um bater):
- LABAREDA (conf 70-85): minuto 60-80', xG total ≥ 1.5 sem gol, OU pressão clara (ataques perigosos ≥ 25 do lado dominante), OU 3+ escanteios recentes → Over 1.5 / Over 2.5 / Próximo Gol do lado que pressiona.
- APROVADO (conf 65-80): xG combinado ≥ 1.8 com 0-1 gols antes do minuto 70 → Over 1.5 / Over 2.5. Ou time com 60%+ posse + 2x chutes do adversário → Próximo Gol.
- APROVADO_SITUACIONAL (conf 55-70): contexto favorável mesmo sem dominância gritante (ex: jogo travado minuto 70+ com xG < 0.8 cada → Under 2.5; ou 1x1 minuto < 75 com xG > 1.5 cada → Over 2.5).
- AGUARDAR: SOMENTE se stats zeradas, minuto < 15 sem nada, ou cenário contraditório real.

NÃO use CUIDADO. Se há edge claro, APROVE. Quando em dúvida entre APROVAR e AGUARDAR e o jogo tem stats significativas, prefira APROVADO_SITUACIONAL.

Responda em JSON puro (sem markdown):
{
  "verdict": "APROVADO" | "APROVADO_SITUACIONAL" | "LABAREDA" | "AGUARDAR",
  "market": "<mercado escolhido ou ''>",
  "confidence": <0-100>,
  "odd": <odd estimada ou 0>,
  "thesis": "<tese curta em pt-br, máx 280 chars>",
  "alerts": ["<alerta1>", "..."]
}`;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const startedAt = Date.now();
  const sb = createClient(SUPABASE_URL, SERVICE_KEY);

  try {
    // Kill switch
    const { data: setting } = await sb
      .from("cron_settings")
      .select("is_enabled")
      .eq("setting_key", "shadow_ai_cron")
      .maybeSingle();
    if (setting && setting.is_enabled === false) {
      return new Response(JSON.stringify({ ok: true, skipped: true, reason: "shadow_ai_cron disabled" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!GROQ_API_KEY) {
      return new Response(JSON.stringify({ ok: false, error: "GROQ_API_KEY ausente" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: liveMatches, error: lmErr } = await sb
      .from("live_matches")
      .select("match_id, home_team, away_team, championship, score_home, score_away, minute, period, status, stats")
      .in("status", ["live", "halftime"])
      .limit(60);

    if (lmErr) throw lmErr;
    if (!liveMatches || liveMatches.length === 0) {
      return new Response(JSON.stringify({ ok: true, processed: 0, msg: "no live matches" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let approved = 0, total = 0, skipped = 0, errors: string[] = [];

    for (const m of liveMatches) {
      total++;
      try {
        const minute = m.minute ?? 0;
        const intervalMs = reanalysisIntervalMs(minute);

        // Janela de reanálise
        const { data: recent } = await sb
          .from("mycroft_analyses_shadow_ai")
          .select("id, created_at")
          .eq("match_id", m.match_id)
          .order("created_at", { ascending: false })
          .limit(1);
        if (recent && recent.length > 0) {
          const lastMs = Date.now() - new Date(recent[0].created_at).getTime();
          if (lastMs < intervalMs) { skipped++; continue; }
        }

        const prompt = buildPrompt(m);
        let aiRes: { json: any; ms: number; raw: string; provider: "deepseek" | "groq"; model: string };
        try {
          aiRes = await callAi(prompt);
        } catch (e) {
          errors.push(`${m.match_id}: ai ${(e as Error).message}`);
          continue;
        }
        const a = aiRes.json;
        if (!a || !a.verdict) { skipped++; continue; }

        let verdict = String(a.verdict).toUpperCase();
        const market = String(a.market || "").trim();
        let thesis = a.thesis ?? null;

        const vetoed = applyMarketSanityVeto({
          verdict,
          market,
          minute,
          period: m.period,
          scoreHome: Number(m.score_home ?? 0),
          scoreAway: Number(m.score_away ?? 0),
          thesis,
        });
        verdict = vetoed.verdict;
        thesis = vetoed.thesis;
        if (vetoed.vetoed) {
          console.log(`[ShadowAI] 🚫 VETO ${m.home_team} vs ${m.away_team} — ${vetoed.vetoReason} | market=\"${market}\"`);
        }

        const isApproved = ["APROVADO", "APROVADO_SITUACIONAL", "LABAREDA"].includes(verdict);

        // Dedup: não empilha — se já há sinal aprovado p/ mesmo mercado neste jogo, pula
        if (isApproved && market) {
          const nm = normMarket(market);
          const { data: existing } = await sb
            .from("mycroft_analyses_shadow_ai")
            .select("id, market")
            .eq("match_id", m.match_id)
            .in("verdict", ["APROVADO", "APROVADO_SITUACIONAL", "LABAREDA"]);
          const dup = (existing || []).find((row: any) => normMarket(row.market || "") === nm);
          if (dup) { skipped++; continue; }
        }

        await sb.from("mycroft_analyses_shadow_ai").insert({
          match_id: m.match_id,
          home_team: m.home_team ?? null,
          away_team: m.away_team ?? null,
          championship: m.championship ?? null,
          verdict,
          market: market || "N/A",
          thesis,
          odd: typeof a.odd === "number" && a.odd > 0 ? a.odd : null,
          confidence: typeof a.confidence === "number" ? Math.round(a.confidence) : null,
          alerts: Array.isArray(a.alerts) ? a.alerts : [],
          provider: "gemini-ai",
          model: MODEL,
          approved_at_minute: minute,
          approved_at_score_home: m.score_home ?? null,
          approved_at_score_away: m.score_away ?? null,
          stats_snapshot: isApproved ? { provider: "gemini-ai", minute, score_home: m.score_home ?? 0, score_away: m.score_away ?? 0, home_team: m.home_team, away_team: m.away_team, championship: m.championship, stats: m.stats || {} } : null,
          latency_ms: aiRes.ms,
          raw_response: { raw: aiRes.raw?.slice(0, 4000) ?? null },
        });
        if (isApproved) approved++;
      } catch (e) {
        errors.push(`${m.match_id}: ${(e as Error).message}`);
      }
    }

    return new Response(JSON.stringify({
      ok: true, processed: total, approved, skipped, errors: errors.slice(0, 10), ms: Date.now() - startedAt,
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    return new Response(JSON.stringify({ ok: false, error: (e as Error).message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
