// Auditoria pós-rodada: avalia performance do motor determinístico nos jogos
// de Libertadores e Sul-Americana das últimas 24h e envia relatório ao Telegram admin.
import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const TELEGRAM_BOT_TOKEN = Deno.env.get("TELEGRAM_BOT_TOKEN");
const TELEGRAM_ADMIN_CHAT_ID = Deno.env.get("TELEGRAM_ADMIN_CHAT_ID");

const LEAGUE_REGEX = /libertad|sudameric|sul[- ]?americ/i;
const APPROVED_VERDICTS = ["APROVADO", "APROVADO_SITUACIONAL", "LABAREDA"];

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE);
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

  // 1. Match IDs de jogos das competições alvo nas últimas 24h
  const { data: matches, error: matchesErr } = await supabase
    .from("live_matches")
    .select("match_id, championship, home_team, away_team, score_home, score_away, status")
    .gte("updated_at", since);

  if (matchesErr) {
    return new Response(JSON.stringify({ error: matchesErr.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const target = (matches ?? []).filter((m) => LEAGUE_REGEX.test(m.championship ?? ""));
  const ids = target.map((m) => m.match_id);

  if (ids.length === 0) {
    return new Response(
      JSON.stringify({ ok: true, message: "Nenhum jogo de Libertadores/Sul-Americana nas últimas 24h." }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }

  // 2. Análises Mycroft para esses match_ids
  const { data: analyses, error: anErr } = await supabase
    .from("mycroft_analyses")
    .select("match_id, verdict, market, confidence, result, plan_name, created_at")
    .in("match_id", ids)
    .gte("created_at", since);

  if (anErr) {
    return new Response(JSON.stringify({ error: anErr.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const total = analyses?.length ?? 0;
  const byVerdict: Record<string, number> = {};
  let approved = 0;
  let settled = 0;
  let green = 0;
  let red = 0;

  for (const a of analyses ?? []) {
    byVerdict[a.verdict] = (byVerdict[a.verdict] ?? 0) + 1;
    if (APPROVED_VERDICTS.includes(a.verdict)) approved++;
    if (a.result) {
      settled++;
      if (a.result === "GREEN") green++;
      else if (a.result === "RED") red++;
    }
  }

  const approvalRate = total > 0 ? (approved / total) * 100 : 0;
  const accuracy = settled > 0 ? (green / settled) * 100 : 0;

  // Vetos auditados
  const { data: vetoed } = await supabase
    .from("mycroft_vetoed_log")
    .select("match_id, reason, created_at")
    .in("match_id", ids)
    .gte("created_at", since);

  const vetoReasons: Record<string, number> = {};
  for (const v of vetoed ?? []) {
    const key = (v.reason ?? "desconhecido").slice(0, 60);
    vetoReasons[key] = (vetoReasons[key] ?? 0) + 1;
  }

  const report = {
    window: "últimas 24h",
    competitions: ["CONMEBOL Libertadores", "CONMEBOL Sudamericana", "Copa Libertadores da América"],
    matches_count: target.length,
    analyses_count: total,
    approved_count: approved,
    approval_rate_pct: Number(approvalRate.toFixed(1)),
    settled_count: settled,
    green_count: green,
    red_count: red,
    accuracy_pct: Number(accuracy.toFixed(1)),
    by_verdict: byVerdict,
    veto_reasons_top: vetoReasons,
    recommendation:
      approvalRate < 15
        ? "CALIBRAR — taxa abaixo do alvo (30-40%). Considerar reduzir penalidade xG ausente / dominância de chutes."
        : approvalRate > 50
        ? "OBSERVAR — taxa acima do alvo, motor pode estar permissivo."
        : "MANTER — taxa dentro da faixa-alvo (15-50%).",
  };

  // 3. Telegram admin
  if (TELEGRAM_BOT_TOKEN && TELEGRAM_ADMIN_CHAT_ID) {
    const lines = [
      `🔍 *Auditoria Trader — Libertadores/Sul-Americana*`,
      `Janela: ${report.window}`,
      `Jogos: ${report.matches_count} | Análises: ${report.analyses_count}`,
      `Aprovados: ${report.approved_count} (${report.approval_rate_pct}%)`,
      `Liquidados: ${report.settled_count} (G:${report.green_count} R:${report.red_count}) → ${report.accuracy_pct}%`,
      ``,
      `*Por verdict:*`,
      ...Object.entries(byVerdict).map(([k, v]) => `• ${k}: ${v}`),
      ``,
      `*Recomendação:* ${report.recommendation}`,
    ];
    try {
      await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chat_id: TELEGRAM_ADMIN_CHAT_ID,
          text: lines.join("\n"),
          parse_mode: "Markdown",
        }),
      });
    } catch (e) {
      console.error("Telegram send failed:", e);
    }
  }

  return new Response(JSON.stringify({ ok: true, report }, null, 2), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
