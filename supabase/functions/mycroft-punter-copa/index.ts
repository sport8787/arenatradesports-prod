// ─────────────────────────────────────────────────────────────────────
// mycroft-punter-copa
// Pipeline determinístico + IA (DeepSeek → Groq → Gemini) que gera
// sinais de Handicap Asiático (e mercados secundários) para a Copa
// do Mundo 2026. Roda 1× ao dia (cron 11:00 UTC).
//
// Lê: copa_fixtures (próximas 36h), punter_gate_config (modo_copa,
// copa_config), ah_odds_snapshot (odd AH mais recente).
// Escreve: punter_copa_signals + cron_logs.
// ─────────────────────────────────────────────────────────────────────
import { createClient } from "npm:@supabase/supabase-js@2";
import { callDeepseek } from "../_shared/deepseekProvider.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SUPA_URL = Deno.env.get("SUPABASE_URL")!;
const SUPA_SR = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

// ───────── Helpers matemáticos ─────────
function factorial(n: number): number { let r = 1; for (let i = 2; i <= n; i++) r *= i; return r; }
function poisson(k: number, lambda: number): number {
  return Math.exp(-lambda) * Math.pow(lambda, k) / factorial(k);
}
/** Probabilidade de cobertura de AH dado xG mandante/visitante e linha (negativa = favorito mandante). */
function probAHCover(xgH: number, xgA: number, ahLine: number, side: "home" | "away"): number {
  let prob = 0;
  const lambdaH = Math.max(0.05, xgH);
  const lambdaA = Math.max(0.05, xgA);
  for (let h = 0; h <= 8; h++) {
    for (let a = 0; a <= 8; a++) {
      const p = poisson(h, lambdaH) * poisson(a, lambdaA);
      const diff = side === "home" ? (h - a) : (a - h);
      const adjusted = diff + ahLine;
      if (adjusted > 0.25) prob += p;          // win full
      else if (adjusted >= -0.25) prob += p * 0.5; // push partial
    }
  }
  return Math.min(0.98, Math.max(0.02, prob));
}

function ahLineFromFifaDiff(diff: number): { line: number; side: "home" | "away" } | null {
  const abs = Math.abs(diff);
  const side = diff > 0 ? "home" : "away";
  if (abs > 500) return { line: -1.5, side };
  if (abs >= 300) return { line: -1.0, side };
  if (abs >= 150) return { line: -0.5, side };
  return { line: 0, side: side === "home" ? "away" : "home" }; // favorece zebra
}

function vePct(prob: number, odd: number): number {
  return +((prob * odd - 1) * 100).toFixed(2);
}

// Stake conforme bloco + fase
function pickBlock(ve: number, conf: number): "A" | "B" | "C" | null {
  if (ve >= 12 && conf >= 75) return "C";
  if (ve >= 8 && conf >= 70) return "B";
  if (ve >= 5 && conf >= 65) return "A";
  return null;
}

function getStake(config: any, block: string, isMataMata: boolean): number {
  const s = config?.stake_blocks?.[block];
  if (!s) return 1;
  return isMataMata ? (s.mata_mata ?? 2) : (s.grupos ?? 1.5);
}

// ───────── Lookup de odd AH ─────────
async function getAhOdd(supabase: any, fixtureId: string, line: number, side: string): Promise<number | null> {
  const { data } = await supabase
    .from("ah_odds_snapshot")
    .select("payload")
    .eq("fixture_id", fixtureId)
    .order("captured_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!data?.payload) return null;
  // payload esperado: { home: {[line]: odd}, away: {[line]: odd} }
  try {
    const v = data.payload?.[side]?.[String(line)];
    return typeof v === "number" ? v : null;
  } catch { return null; }
}

// ───────── Movimento de odd (anti-informação assimétrica) ─────────
async function checkOddMovement(supabase: any, fixtureId: string): Promise<{ pct: number; alert: boolean }> {
  const { data } = await supabase
    .from("ah_odds_snapshot")
    .select("captured_at, payload")
    .eq("fixture_id", fixtureId)
    .gte("captured_at", new Date(Date.now() - 12 * 3600_000).toISOString())
    .order("captured_at", { ascending: true });
  if (!data || data.length < 2) return { pct: 0, alert: false };
  const first = JSON.stringify(data[0]?.payload || {});
  const last = JSON.stringify(data.at(-1)?.payload || {});
  // proxy simples — flag de movimento se payloads diferem muito
  const same = first === last;
  return { pct: same ? 0 : 25, alert: !same };
}

// ───────── Pipeline por fixture ─────────
async function analyzeFixture(supabase: any, fx: any, cfg: any) {
  const ve_min = (cfg?.ve_min || {});
  const conf_min = (cfg?.conf_min || {});
  const ahRange = cfg?.ah_odd_range || { min: 1.65, max: 2.30 };

  const isMataMata = ["oitavas", "quartas", "semi", "final", "3lugar"].includes(fx.phase);
  const veMinThis = fx.phase.startsWith("grupos") ? (ve_min.grupos ?? 7)
                  : fx.phase === "oitavas" ? (ve_min.oitavas ?? 5)
                  : (ve_min.quartas_plus ?? 4);
  const confMin = isMataMata ? (conf_min.mata_mata ?? 65) : (conf_min.grupos ?? 70);

  const vetos: string[] = [];

  // Vetos contextuais
  if (fx.phase === "grupos_j3" && (fx.home_already_qualified || fx.away_already_qualified)) {
    vetos.push("grupos_j3: alguma seleção já classificada");
  }
  if (fx.home_eliminated || fx.away_eliminated) vetos.push("seleção eliminada matematicamente");
  const injH = (fx.injuries?.home || []).length;
  const injA = (fx.injuries?.away || []).length;
  if (injH > 4) vetos.push(`mandante com ${injH} desfalques`);
  if (injA > 4) vetos.push(`visitante com ${injA} desfalques`);

  // FIFA diff → linha AH alvo
  const ptsH = fx.home_fifa_pts ?? 0;
  const ptsA = fx.away_fifa_pts ?? 0;
  if (!ptsH || !ptsA) vetos.push("ranking FIFA ausente");
  const diff = ptsH - ptsA;
  const ah = ahLineFromFifaDiff(diff);
  if (!ah) vetos.push("não foi possível derivar linha AH");

  // Veto AH ≤ -1.0 em mata-mata
  if (ah && isMataMata && ah.line <= -1.0) vetos.push("AH ≤ -1.0 em mata-mata");

  // xG / xGA
  const xgH = fx.xg_last5?.home?.xg ?? null;
  const xgaH = fx.xg_last5?.home?.xga ?? null;
  const xgA = fx.xg_last5?.away?.xg ?? null;
  const xgaA = fx.xg_last5?.away?.xga ?? null;
  if (xgH == null || xgA == null) vetos.push("xG histórico ausente");

  let prob = 0, odd = 0, ve = 0;
  if (ah && xgH != null && xgA != null && xgaH != null && xgaA != null) {
    const favXg = ah.side === "home" ? xgH : xgA;
    const advXga = ah.side === "home" ? xgaA : xgaH;
    if (favXg < (cfg?.xg_fav_min ?? 1.5)) vetos.push(`xG favorito ${favXg} < ${cfg?.xg_fav_min ?? 1.5}`);
    if (advXga < (cfg?.xga_adv_min ?? 1.2)) vetos.push(`xGA adversário ${advXga} < ${cfg?.xga_adv_min ?? 1.2}`);

    prob = probAHCover(xgH, xgA, ah.line, ah.side);
    odd = (await getAhOdd(supabase, fx.fixture_id, ah.line, ah.side)) ?? 0;
    if (!odd) vetos.push("odd AH indisponível em ah_odds_snapshot");
    else if (odd < ahRange.min || odd > ahRange.max) vetos.push(`odd AH ${odd} fora do range ${ahRange.min}-${ahRange.max}`);
    if (odd) ve = vePct(prob, odd);
  }

  // Movimento de odd > 20% nas últimas 12h
  const mv = await checkOddMovement(supabase, fx.fixture_id);
  if (mv.alert) vetos.push("movimento de odd suspeito nas últimas 12h");

  // Filtros finais
  const confidence = Math.round(prob * 100);
  if (ve < veMinThis) vetos.push(`VE ${ve}% < mínimo da fase (${veMinThis}%)`);
  if (confidence < confMin) vetos.push(`Confiança ${confidence}% < mínimo (${confMin}%)`);

  const block = vetos.length === 0 ? pickBlock(ve, confidence) : null;
  if (!block) {
    return { fixture_id: fx.fixture_id, approved: false, vetos, ve, confidence };
  }

  // IA: justificativa pt-br
  let rationale = `Favorito ${ah!.side === "home" ? fx.home : fx.away} via AH ${ah!.line}. xG favorito ${ah!.side === "home" ? xgH : xgA}, xGA adversário ${ah!.side === "home" ? xgaA : xgaH}. Diff FIFA ${diff} pts. VE ${ve}%, prob ${confidence}%.`;
  try {
    const sys = "Você é o Mycroft. Responde sempre em pt-br, frio e dedutivo. JSON com {ok:boolean, rationale:string}. Recuse (ok:false) se a tese tiver furo claro.";
    const usr = `Copa do Mundo 2026 — ${fx.phase}\n${fx.home} x ${fx.away}\nAH: ${ah!.line} no ${ah!.side === "home" ? fx.home : fx.away}\nOdd: ${odd}\nVE: ${ve}% | Prob: ${confidence}%\nFIFA: ${ptsH} vs ${ptsA}\nxG L5: H ${xgH}/${xgaH} | A ${xgA}/${xgaA}\nDesfalques: H=${injH} A=${injA}\n\nValide a tese em ≤4 linhas, frias e técnicas. Devolva JSON.`;
    const out = await callDeepseek(sys, usr, { temperature: 0.2, max_tokens: 400, timeoutMs: 20000 });
    const parsed = JSON.parse(out);
    if (parsed?.ok === false) vetos.push("IA recusou a tese");
    else if (parsed?.rationale) rationale = parsed.rationale;
  } catch (e) {
    console.warn(`[copa] IA falhou para ${fx.fixture_id}, usando rationale determinístico:`, (e as Error).message);
  }

  if (vetos.length > 0) {
    return { fixture_id: fx.fixture_id, approved: false, vetos, ve, confidence };
  }

  const stake = getStake(cfg, block, isMataMata);

  return {
    fixture_id: fx.fixture_id,
    approved: true,
    signal: {
      fixture_id: fx.fixture_id,
      home: fx.home,
      away: fx.away,
      commence_time: fx.commence_time,
      phase: fx.phase,
      market: "Handicap Asiático",
      selection: `${ah!.side === "home" ? fx.home : fx.away} ${ah!.line}`,
      ah_line: ah!.line,
      odd, prob, ve_pct: ve, edge_pct: ve,
      confidence,
      block,
      stake_pct: stake,
      rationale,
      vetos: [],
      copa_badge: true,
    },
  };
}

// ───────── Telegram ─────────
async function sendTelegram(text: string) {
  const token = Deno.env.get("TELEGRAM_BOT_CONFIG");
  if (!token) return;
  try {
    const cfg = JSON.parse(token);
    const botToken = cfg?.bot_token;
    const chatId = cfg?.chat_id_punter || cfg?.chat_id;
    if (!botToken || !chatId) return;
    await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: chatId, text, parse_mode: "HTML" }),
    });
  } catch (e) { console.warn("[copa] telegram fail:", (e as Error).message); }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const supabase = createClient(SUPA_URL, SUPA_SR);

  try {
    // 1) Lê config
    const { data: gate } = await supabase
      .from("punter_gate_config")
      .select("modo_copa, copa_start_date, copa_end_date, copa_config")
      .limit(1).maybeSingle();

    const today = new Date().toISOString().slice(0, 10);
    const active = gate?.modo_copa === true &&
      (!gate?.copa_start_date || gate.copa_start_date <= today) &&
      (!gate?.copa_end_date || gate.copa_end_date >= today);

    if (!active) {
      await supabase.from("cron_logs").insert({
        tipo: "copa_punter",
        mensagem: "Modo Copa inativo — pulando análise",
        detalhes: { gate },
      });
      return new Response(JSON.stringify({ ok: true, skipped: "modo_copa inativo" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const cfg = gate?.copa_config || {};

    // 2) Carrega fixtures das próximas 36h
    const horizonEnd = new Date(Date.now() + 36 * 3600_000).toISOString();
    const { data: fixtures } = await supabase
      .from("copa_fixtures")
      .select("*")
      .gte("commence_time", new Date().toISOString())
      .lte("commence_time", horizonEnd)
      .order("commence_time", { ascending: true });

    console.log(`[copa-punter] ${fixtures?.length || 0} fixtures nas próximas 36h`);
    const results = [];
    for (const fx of fixtures || []) {
      try {
        const r = await analyzeFixture(supabase, fx, cfg);
        results.push(r);
      } catch (e) {
        console.error(`[copa-punter] erro fixture ${fx.fixture_id}:`, (e as Error).message);
        results.push({ fixture_id: fx.fixture_id, approved: false, vetos: ["erro interno: " + (e as Error).message] });
      }
    }

    // 3) Exposição máxima por rodada (mantém os de maior VE)
    const approved = results.filter(r => r.approved && r.signal);
    approved.sort((a: any, b: any) => (b.signal.ve_pct - a.signal.ve_pct));
    const maxExposure = cfg?.max_exposicao_rodada ?? 8;
    let totalStake = 0;
    const final: any[] = [];
    for (const r of approved as any[]) {
      if (totalStake + r.signal.stake_pct <= maxExposure) {
        final.push(r.signal); totalStake += r.signal.stake_pct;
      } else {
        r.signal.vetos = ["cap de exposição (8%) atingido"];
      }
    }

    // 4a) Persistir aprovados
    for (const s of final) {
      const { error } = await supabase
        .from("punter_copa_signals")
        .upsert({ ...s, status: "APROVADO" }, { onConflict: "fixture_id,market,selection" });
      if (error) console.error("[copa-punter] insert aprovado:", error.message);
      else {
        await sendTelegram(
          `🏆 <b>COPA 2026 — ${s.phase.toUpperCase()}</b>\n` +
          `<b>${s.home}</b> x <b>${s.away}</b>\n` +
          `Mercado: ${s.market} (${s.selection})\n` +
          `Odd: ${s.odd} | VE: ${s.ve_pct}% | Conf: ${s.confidence}%\n` +
          `Bloco ${s.block} — Stake ${s.stake_pct}%\n` +
          `${s.rationale}`
        );
      }
    }

    // 4b) Persistir vetados — para exibição na página Copa com motivo
    const vetados = results.filter((r: any) => !r.approved && r.vetos?.length > 0);
    for (const r of vetados as any[]) {
      // Busca fixture para nome dos times
      const fx = (fixtures || []).find((f: any) => f.fixture_id === r.fixture_id);
      if (!fx) continue;
      const vetadoRow = {
        fixture_id: r.fixture_id,
        home: fx.home,
        away: fx.away,
        commence_time: fx.commence_time,
        phase: fx.phase,
        market: "Handicap Asiático",
        selection: null,
        vetos: r.vetos,
        status: "VETADO",
        copa_badge: true,
        ve_pct: r.ve ?? null,
        confidence: r.confidence ?? null,
      };
      // Upsert por fixture_id+market+selection (selection=null → usa fixture_id+market)
      const { error } = await supabase
        .from("punter_copa_signals")
        .upsert(vetadoRow, { onConflict: "fixture_id,market,selection" });
      if (error) console.error("[copa-punter] insert vetado:", error.message);
    }

    const vetoCounts: Record<string, number> = {};
    for (const r of results as any[]) {
      for (const v of (r.vetos || [])) vetoCounts[v] = (vetoCounts[v] || 0) + 1;
    }

    await supabase.from("cron_logs").insert({
      tipo: "copa_punter",
      mensagem: `Copa: ${fixtures?.length || 0} fixtures, ${final.length} sinais aprovados`,
      detalhes: {
        fixtures: fixtures?.length || 0,
        candidatos: approved.length,
        aprovados: final.length,
        exposicao_total: totalStake,
        vetos_top: vetoCounts,
      },
    });

    return new Response(JSON.stringify({
      ok: true,
      fixtures: fixtures?.length || 0,
      aprovados: final.length,
      exposicao_total: totalStake,
      vetos_top: vetoCounts,
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });

  } catch (e) {
    console.error("[copa-punter] erro fatal:", e);
    return new Response(JSON.stringify({ error: (e as Error).message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
