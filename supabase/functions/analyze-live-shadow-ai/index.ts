// analyze-live-shadow-ai
// Análise PARALELA pura de IA (Gemini via Lovable AI Gateway) sobre jogos ao vivo.
// Grava em mycroft_analyses_shadow_ai. Não interfere no motor primário.
// Dedup por (match_id, mercado normalizado) — NÃO empilha sinais.

import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY") || "";
const MODEL = "google/gemini-3-flash-preview";
const GATEWAY = "https://ai.gateway.lovable.dev/v1/chat/completions";

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

async function callGemini(prompt: string, timeoutMs = 20_000): Promise<{ json: any; ms: number; raw: string }> {
  const t0 = Date.now();
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const resp = await fetch(GATEWAY, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${LOVABLE_API_KEY}`,
      },
      signal: ctrl.signal,
      body: JSON.stringify({
        model: MODEL,
        messages: [
          { role: "system", content: "Você é o Mycroft, analista frio e dedutivo de trading esportivo ao vivo. Responde SOMENTE em JSON pt-br válido." },
          { role: "user", content: prompt },
        ],
        temperature: 0.2,
        max_tokens: 700,
        response_format: { type: "json_object" },
      }),
    });
    if (!resp.ok) {
      const txt = await resp.text().catch(() => "");
      throw new Error(`HTTP ${resp.status} ${txt.slice(0, 200)}`);
    }
    const data = await resp.json();
    const raw = data?.choices?.[0]?.message?.content ?? "";
    let parsed: any = null;
    try { parsed = JSON.parse(raw); } catch {
      const m = raw.match(/\{[\s\S]*\}/);
      if (m) { try { parsed = JSON.parse(m[0]); } catch { /* ignore */ } }
    }
    return { json: parsed, ms: Date.now() - t0, raw };
  } finally {
    clearTimeout(timer);
  }
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

  return `Analise este jogo AO VIVO e decida UM mercado de aposta (ou AGUARDAR).

JOGO: ${m.home_team} ${m.score_home ?? 0} x ${m.score_away ?? 0} ${m.away_team}
LIGA: ${m.championship ?? "?"}
MINUTO: ${m.minute ?? 0}'

STATS:
- xG: ${xgH.toFixed(2)} x ${xgA.toFixed(2)} (total ${(xgH + xgA).toFixed(2)})
- Posse: ${possH}% x ${possA}%
- Chutes: ${shotsH} x ${shotsA} (no gol: ${sotH} x ${sotA})
- Ataques perigosos: ${dangH} x ${dangA}
- Escanteios: ${corners}

MERCADOS POSSÍVEIS: Over 0.5 HT, Over 1.5, Over 2.5, Under 2.5, BTTS Sim, BTTS Não, Próximo Gol.

Responda em JSON (apenas isto, sem markdown):
{
  "verdict": "APROVADO" | "APROVADO_SITUACIONAL" | "LABAREDA" | "AGUARDAR" | "CUIDADO",
  "market": "<mercado escolhido ou ''>",
  "confidence": <0-100>,
  "odd": <odd estimada ou 0>,
  "thesis": "<tese curta em pt-br, máx 280 chars>",
  "alerts": ["<alerta1>", "..."]
}

Regras: só aprove (APROVADO/SITUACIONAL/LABAREDA) com edge real. Em dúvida → AGUARDAR. Não invente stats.`;
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

    if (!LOVABLE_API_KEY) {
      return new Response(JSON.stringify({ ok: false, error: "LOVABLE_API_KEY ausente" }), {
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
        let aiRes: { json: any; ms: number; raw: string };
        try {
          aiRes = await callGemini(prompt);
        } catch (e) {
          errors.push(`${m.match_id}: gemini ${(e as Error).message}`);
          continue;
        }
        const a = aiRes.json;
        if (!a || !a.verdict) { skipped++; continue; }

        const verdict = String(a.verdict).toUpperCase();
        const market = String(a.market || "").trim();
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
          verdict,
          market: market || "N/A",
          thesis: a.thesis ?? null,
          odd: typeof a.odd === "number" && a.odd > 0 ? a.odd : null,
          confidence: typeof a.confidence === "number" ? Math.round(a.confidence) : null,
          alerts: Array.isArray(a.alerts) ? a.alerts : [],
          provider: "gemini-ai",
          model: MODEL,
          approved_at_minute: minute,
          approved_at_score_home: m.score_home ?? null,
          approved_at_score_away: m.score_away ?? null,
          stats_snapshot: isApproved ? { provider: "gemini-ai", minute, score_home: m.score_home ?? 0, score_away: m.score_away ?? 0, stats: m.stats || {} } : null,
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
