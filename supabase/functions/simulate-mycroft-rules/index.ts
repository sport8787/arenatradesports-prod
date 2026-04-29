// Simulador de regras Mycroft — roda o engine contra cenários históricos
// (snapshots de analises_comparativas) com regras CUSTOM (preview) ou as ativas.
import { createClient } from "npm:@supabase/supabase-js@2";
import type { MycroftRule, MycroftConfig, Modo } from "../_shared/mycroft-rules-engine.ts";
import { runEngineLocal } from "./local-engine.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface ReqBody {
  modo: Modo;
  sample_size?: number;        // padrão 200
  window_hours?: number;       // padrão 168 (7 dias)
  mercado_filter?: string;     // opcional, substring
  override_rules?: MycroftRule[];   // se enviado, usa essas regras
  override_config?: Partial<MycroftConfig>;
  history_version_ids?: string[];   // IDs de mycroft_rules_history para usar como override
  history_at?: string;              // ISO timestamp: reconstrói o estado das regras nessa data
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const body = (await req.json()) as ReqBody;
    const modo = body.modo;
    const sampleSize = Math.min(body.sample_size ?? 200, 1000);
    const hours = body.window_hours ?? 168;

    // Busca cenários históricos com snapshot
    let q = sb
      .from("analises_comparativas")
      .select("id,match_id,mercado,verdicto_atual,verdicto_novo,resultado_real,odd_atual,stats_snapshot,home_team,away_team,league,data_jogo,created_at")
      .eq("modo", modo)
      .not("stats_snapshot", "is", null)
      .gte("created_at", new Date(Date.now() - hours * 3600_000).toISOString())
      .order("created_at", { ascending: false })
      .limit(sampleSize);
    if (body.mercado_filter) q = q.ilike("mercado", `%${body.mercado_filter}%`);
    const { data: cenarios, error } = await q;
    if (error) throw error;
    if (!cenarios || cenarios.length === 0) {
      return new Response(JSON.stringify({ ok: true, total: 0, message: "Sem cenários no período." }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Carrega regras/config — override ou as ativas
    let rules: MycroftRule[];
    let config: MycroftConfig;
    if (body.override_rules?.length) {
      rules = body.override_rules.filter((r) => r.active && r.modo === modo).sort((a, b) => b.priority - a.priority);
    } else {
      const { data } = await sb.from("mycroft_rules").select("*").eq("modo", modo).eq("active", true);
      rules = (data ?? []) as MycroftRule[];
    }
    const { data: cfgRows } = await sb.from("mycroft_config").select("key,value").eq("modo", modo);
    config = {
      score_minimo_aprovar: 70, score_minimo_cuidado: 50,
      stake_min_percent: 2, stake_max_percent: 5,
      odd_minima: 1.5, odd_maxima: 3.0, tempo_minimo_analise: 10,
      ...Object.fromEntries((cfgRows ?? []).map((r: any) => [r.key, Number(r.value)])),
      ...(body.override_config ?? {}),
    } as MycroftConfig;

    const dist = { APROVADO: 0, CUIDADO: 0, AGUARDAR: 0, VETADO: 0 };
    const distAtual: Record<string, number> = {};
    let divergentes = 0;
    let novos_aprovou_atual_nao = 0;
    let atual_aprovou_novo_nao = 0;
    let green_novo = 0, red_novo = 0, green_atual = 0, red_atual = 0, total_settled = 0;
    const samples: any[] = [];

    for (const c of cenarios) {
      const stats = (c.stats_snapshot ?? {}) as Record<string, any>;
      const result = runEngineLocal({ rules, config, mercado: c.mercado, odd: c.odd_atual ?? undefined, minute: stats.minute, stats });
      dist[result.status]++;
      const va = (c.verdicto_atual ?? "AGUARDAR").toUpperCase();
      distAtual[va] = (distAtual[va] ?? 0) + 1;

      const aprovouNovo = result.status === "APROVADO";
      const aprovouAtual = va === "APROVADO";
      if (aprovouNovo !== aprovouAtual) {
        divergentes++;
        if (aprovouNovo && !aprovouAtual) novos_aprovou_atual_nao++;
        if (!aprovouNovo && aprovouAtual) atual_aprovou_novo_nao++;
      }

      if (c.resultado_real) {
        total_settled++;
        if (aprovouNovo) (c.resultado_real === "GREEN" ? green_novo++ : red_novo++);
        if (aprovouAtual) (c.resultado_real === "GREEN" ? green_atual++ : red_atual++);
      }

      if (samples.length < 30) {
        samples.push({
          match_id: c.match_id, mercado: c.mercado,
          home: c.home_team, away: c.away_team, league: c.league,
          verdicto_atual: va, verdicto_novo: result.status,
          score_novo: result.score, stake_novo: result.stake,
          divergente: aprovouNovo !== aprovouAtual,
          resultado_real: c.resultado_real,
          razoes: result.explicacao.razoes.slice(0, 3),
        });
      }
    }

    const total = cenarios.length;
    return new Response(JSON.stringify({
      ok: true,
      total,
      dist_novo: dist,
      dist_atual: distAtual,
      divergencia_pct: total > 0 ? +(100 * divergentes / total).toFixed(2) : 0,
      novos_aprovou_atual_nao,
      atual_aprovou_novo_nao,
      winrate: {
        total_settled,
        novo_winrate: (green_novo + red_novo) > 0 ? +(100 * green_novo / (green_novo + red_novo)).toFixed(2) : null,
        atual_winrate: (green_atual + red_atual) > 0 ? +(100 * green_atual / (green_atual + red_atual)).toFixed(2) : null,
        novo_aprovou: green_novo + red_novo,
        atual_aprovou: green_atual + red_atual,
      },
      samples,
      config_used: config,
      rules_count: rules.length,
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (err) {
    console.error("[simulate-mycroft-rules]", err);
    return new Response(JSON.stringify({ ok: false, error: (err as Error).message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
