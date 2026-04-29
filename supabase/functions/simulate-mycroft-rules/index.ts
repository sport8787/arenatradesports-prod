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

    // Carrega regras/config — override direto, override por histórico, ou ativas
    let rules: MycroftRule[];
    let config: MycroftConfig;
    let rules_source = "active";

    if (body.override_rules?.length) {
      rules = body.override_rules.filter((r) => r.active && r.modo === modo).sort((a, b) => b.priority - a.priority);
      rules_source = "override_inline";
    } else if (body.history_version_ids?.length) {
      // Reconstrói regras a partir de versões históricas selecionadas (snapshot do new_data)
      const { data: hist } = await sb
        .from("mycroft_rules_history")
        .select("record_id,new_data,operation")
        .in("id", body.history_version_ids);
      rules = ((hist ?? []) as any[])
        .filter((h) => h.operation !== "DELETE" && h.new_data)
        .map((h) => h.new_data as MycroftRule)
        .filter((r) => r && r.modo === modo);
      rules_source = "history_versions";
    } else if (body.history_at) {
      // Reconstrói o estado das regras na data fornecida usando a última versão de cada record_id <= history_at
      const { data: hist } = await sb
        .from("mycroft_rules_history")
        .select("record_id,new_data,old_data,operation,created_at")
        .eq("table_name", "mycroft_rules")
        .lte("created_at", body.history_at)
        .order("created_at", { ascending: true });
      const latest = new Map<string, any>();
      for (const h of (hist ?? []) as any[]) {
        if (h.operation === "DELETE") latest.delete(h.record_id);
        else latest.set(h.record_id, h.new_data);
      }
      rules = Array.from(latest.values()).filter((r) => r && r.modo === modo && r.active) as MycroftRule[];
      rules_source = `history_at:${body.history_at}`;
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

    // Ranking de regras: contribuição em casos divergentes
    interface RuleStat {
      rule: string; field: string; op: string; value: number;
      category: "pontuacao" | "veto"; points: number | null;
      hits_total: number; hits_div: number;
      veto_div: number; bonus_div: number;
      flips_to_aprovado: number; flips_from_aprovado: number;
    }
    const ruleStats = new Map<string, RuleStat>();
    const ruleMeta = new Map<string, MycroftRule>();
    rules.forEach((r) => ruleMeta.set(r.name, r));

    for (const c of cenarios) {
      const stats = (c.stats_snapshot ?? {}) as Record<string, any>;
      const result = runEngineLocal({ rules, config, mercado: c.mercado, odd: c.odd_atual ?? undefined, minute: stats.minute, stats });
      dist[result.status]++;
      const va = (c.verdicto_atual ?? "AGUARDAR").toUpperCase();
      distAtual[va] = (distAtual[va] ?? 0) + 1;

      const aprovouNovo = result.status === "APROVADO";
      const aprovouAtual = va === "APROVADO";
      const isDiv = aprovouNovo !== aprovouAtual;
      if (isDiv) {
        divergentes++;
        if (aprovouNovo && !aprovouAtual) novos_aprovou_atual_nao++;
        if (!aprovouNovo && aprovouAtual) atual_aprovou_novo_nao++;
      }

      // Atribui contribuição às regras que MATCHED
      for (const log of result.logs) {
        if (!log.matched) continue;
        const meta = ruleMeta.get(log.rule);
        if (!meta) continue;
        const key = log.rule;
        let s = ruleStats.get(key);
        if (!s) {
          s = {
            rule: log.rule, field: log.field, op: log.op, value: log.value,
            category: meta.category, points: meta.points,
            hits_total: 0, hits_div: 0,
            veto_div: 0, bonus_div: 0,
            flips_to_aprovado: 0, flips_from_aprovado: 0,
          };
          ruleStats.set(key, s);
        }
        s.hits_total++;
        if (isDiv) {
          s.hits_div++;
          if (log.veto) s.veto_div++;
          if (log.delta) s.bonus_div++;
          if (aprovouNovo && !aprovouAtual) s.flips_to_aprovado++;
          if (!aprovouNovo && aprovouAtual) s.flips_from_aprovado++;
        }
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
          divergente: isDiv,
          resultado_real: c.resultado_real,
          razoes: result.explicacao.razoes.slice(0, 3),
        });
      }
    }

    // Ranking ordenado por impacto em divergências
    const ruleRanking = Array.from(ruleStats.values())
      .map((s) => ({
        ...s,
        impacto_pct: s.hits_total > 0 ? +(100 * s.hits_div / s.hits_total).toFixed(1) : 0,
        impacto_score: s.hits_div * (s.flips_to_aprovado + s.flips_from_aprovado + 1),
      }))
      .filter((s) => s.hits_div > 0)
      .sort((a, b) => b.hits_div - a.hits_div)
      .slice(0, 20);

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
      rule_ranking: ruleRanking,
      rules_source,
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
