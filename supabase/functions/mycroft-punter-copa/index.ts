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

type AhCandidate = { line: number; side: "home" | "away"; isFavorite: boolean };

function ahLineCandidates(diff: number): AhCandidate[] {
  const abs = Math.abs(diff);
  const favSide: "home" | "away" = diff >= 0 ? "home" : "away";
  const undSide: "home" | "away" = favSide === "home" ? "away" : "home";

  let favLines: number[];
  if (abs > 500)       favLines = [-1.5, -2.0, -2.5, -3.0];
  else if (abs >= 200) favLines = [-0.5, -1.0, -1.5, -2.0, -2.5];
  else if (abs >= 80)  favLines = [-0.5, -1.0, -1.5];
  else                 favLines = [0.0, -0.5];

  const out: AhCandidate[] = [];
  for (const l of favLines) out.push({ line: l, side: favSide, isFavorite: true });
  for (const l of favLines) out.push({ line: -l, side: undSide, isFavorite: false });
  return out;
}

function vePct(prob: number, odd: number): number {
  return +((prob * odd - 1) * 100).toFixed(2);
}

// Stake conforme bloco + fase
function pickBlock(ve: number, conf: number): "A" | "B" | "C" | null {
  if (ve >= 12 && conf >= 70) return "C";
  if (ve >= 8 && conf >= 60) return "B";
  if (ve >= 5 && conf >= 52) return "A";
  return null;
}

function getStake(config: any, block: string, isMataMata: boolean): number {
  const s = config?.stake_blocks?.[block];
  if (!s) return 1;
  return isMataMata ? (s.mata_mata ?? 2) : (s.grupos ?? 1.5);
}

// ───────── Síntese de xG a partir de pontos FIFA ─────────
// Produz estimativa de xG quando dados históricos do time são ausentes.
// xgH = ataque do mandante; xgaA = defesa do visitante (simétrico: xgaA = xgH).
// Gradiente /450: 200 pts de diferença → +0.44 xG, suficiente para favoritos claros.
function synthXg(attPts: number, defPts: number): number {
  return Math.max(0.5, Math.min(2.5, 1.25 + (attPts - defPts) / 450));
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
    const sidePayload = data.payload?.[side] || {};
    const v = sidePayload[String(line)];
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
  // Ignora snapshots h2h-only (linha "0") — compara só snapshots com linhas AH reais
  const ahOnly = (data as any[]).filter((row) => {
    const keys = [...Object.keys(row.payload?.home || {}), ...Object.keys(row.payload?.away || {})];
    return keys.some((k) => k !== "0");
  });
  if (ahOnly.length < 2) return { pct: 0, alert: false };
  const first = JSON.stringify(ahOnly[0]?.payload || {});
  const last = JSON.stringify(ahOnly.at(-1)?.payload || {});
  const same = first === last;
  return { pct: same ? 0 : 25, alert: !same };
}

// ───────── Pipeline por fixture ─────────
async function analyzeFixture(supabase: any, fx: any, cfg: any) {
  const ve_min = cfg?.ve_min || {};
  const conf_min_cfg = cfg?.conf_min || {};
  const ahRange = cfg?.ah_odd_range || { min: 1.40, max: 4.50 };

  const isMataMata = ["oitavas", "quartas", "semi", "final", "3lugar"].includes(fx.phase);
  const veMinThis = fx.phase.startsWith("grupos") ? (ve_min.grupos ?? 5)
                  : fx.phase === "oitavas" ? (ve_min.oitavas ?? 5)
                  : (ve_min.quartas_plus ?? 4);
  const confMin = isMataMata ? (conf_min_cfg.mata_mata ?? 65) : (conf_min_cfg.grupos ?? 52);

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

  const ptsH = fx.home_fifa_pts ?? 0;
  const ptsA = fx.away_fifa_pts ?? 0;
  if (!ptsH || !ptsA) vetos.push("ranking FIFA ausente");

  if (vetos.length > 0) {
    return { fixture_id: fx.fixture_id, approved: false, vetos, ve: 0, confidence: 0 };
  }

  const diff = ptsH - ptsA;

  // xG / xGA: usa histórico se disponível, sintetiza via pontos FIFA caso contrário
  const xgH  = fx.xg_last5?.home?.xg  ?? synthXg(ptsH, ptsA);
  const xgaH = fx.xg_last5?.home?.xga ?? synthXg(ptsA, ptsH);
  const xgA  = fx.xg_last5?.away?.xg  ?? synthXg(ptsA, ptsH);
  const xgaA = fx.xg_last5?.away?.xga ?? synthXg(ptsH, ptsA);

  const xg_fav_min = cfg?.xg_fav_min ?? 1.5;
  const xga_adv_min = cfg?.xga_adv_min ?? 1.2;

  // Avalia todos os candidatos AH (favorito + underdog); escolhe melhor VE dentre os que passam thresholds
  const candidates = ahLineCandidates(diff);
  type CandResult = { line: number; side: "home" | "away"; isFavorite: boolean; odd: number; prob: number; ve: number };
  const validCands: CandResult[] = [];

  for (const cand of candidates) {
    // Veto: AH ≤ -1.0 em mata-mata (só favorito)
    if (isMataMata && cand.isFavorite && cand.line <= -1.0) continue;

    const odd = await getAhOdd(supabase, fx.fixture_id, cand.line, cand.side);
    if (!odd || odd < ahRange.min || odd > ahRange.max) continue;

    // Filtro de xG só para candidatos favoritos
    if (cand.isFavorite) {
      const favXg = cand.side === "home" ? xgH : xgA;
      const advXga = cand.side === "home" ? xgaA : xgaH;
      if (favXg < xg_fav_min || advXga < xga_adv_min) continue;
    }

    const prob = probAHCover(xgH, xgA, cand.line, cand.side);
    const ve = vePct(prob, odd);
    const conf = Math.round(prob * 100);

    // Só mantém candidatos que passariam os filtros finais
    if (ve >= veMinThis && conf >= confMin) {
      validCands.push({ ...cand, odd, prob, ve });
    }
  }

  validCands.sort((a, b) => b.ve - a.ve);
  const bestCand = validCands[0] ?? null;

  if (!bestCand) {
    vetos.push("odd AH indisponível ou fora de range em ah_odds_snapshot");
    return { fixture_id: fx.fixture_id, approved: false, vetos, ve: 0, confidence: 0 };
  }

  const { line: ahLine, side: ahSide, odd, prob, ve } = bestCand;
  const confidence = Math.round(prob * 100);
  const selLabel = ahLine > 0 ? `+${ahLine}` : String(ahLine);

  // Movimento de odd nas últimas 12h (não bloqueia, mas veta se suspeito)
  const mv = await checkOddMovement(supabase, fx.fixture_id);
  if (mv.alert) vetos.push("movimento de odd suspeito nas últimas 12h");

  const block = vetos.length === 0 ? pickBlock(ve, confidence) : null;
  if (!block) {
    return { fixture_id: fx.fixture_id, approved: false, vetos, ve, confidence };
  }

  // IA: justificativa pt-br
  let rationale = `${ahSide === "home" ? fx.home : fx.away} AH ${selLabel}. xG H ${xgH.toFixed(2)}/A ${xgA.toFixed(2)}. Diff FIFA ${diff} pts. VE ${ve}%, prob ${confidence}%.`;
  try {
    const sys = "Você é o Mycroft. Responde sempre em pt-br, frio e dedutivo. JSON com {ok:boolean, rationale:string}. Recuse (ok:false) se a tese tiver furo claro.";
    const usr = `Copa do Mundo 2026 — ${fx.phase}\n${fx.home} x ${fx.away}\nAH: ${selLabel} no ${ahSide === "home" ? fx.home : fx.away}\nOdd: ${odd}\nVE: ${ve}% | Prob: ${confidence}%\nFIFA: ${ptsH} vs ${ptsA}\nxG L5: H ${xgH.toFixed(2)}/${xgaH.toFixed(2)} | A ${xgA.toFixed(2)}/${xgaA.toFixed(2)}\nDesfalques: H=${injH} A=${injA}\n\nValide a tese em ≤4 linhas, frias e técnicas. Devolva JSON.`;
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
      selection: `${ahSide === "home" ? fx.home : fx.away} ${selLabel}`,
      ah_line: ahLine,
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

    // 2a) Expira sinais APROVADOS cujo jogo já iniciou (evita entradas in-game)
    const nowIso = new Date().toISOString();
    const { error: expireErr } = await supabase
      .from("punter_copa_signals")
      .update({ status: "EXPIRADO" })
      .eq("status", "APROVADO")
      .is("resultado", null)          // não toca nos já liquidados
      .lt("commence_time", nowIso);
    if (expireErr) console.warn("[copa-punter] erro ao expirar sinais:", expireErr.message);

    // 2b) Carrega fixtures das próximas 36h — exige ≥60 min até o início (margem anti in-game)
    const PRE_GAME_BUFFER = 60 * 60_000; // 60 minutos
    const horizonStart = new Date(Date.now() + PRE_GAME_BUFFER).toISOString();
    const horizonEnd   = new Date(Date.now() + 36 * 3600_000).toISOString();
    const { data: fixtures } = await supabase
      .from("copa_fixtures")
      .select("*")
      .gte("commence_time", horizonStart)
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
      // Guarda final: nunca insere sinal para jogo que já iniciou
      if (new Date(s.commence_time) <= new Date()) {
        console.warn(`[copa-punter] ${s.home} x ${s.away}: jogo já iniciado, sinal descartado`);
        continue;
      }
      const { data: upserted, error } = await supabase
        .from("punter_copa_signals")
        .upsert({ ...s, status: "APROVADO" }, { onConflict: "fixture_id,market,selection" })
        .select("id")
        .single();
      if (error) console.error("[copa-punter] insert aprovado:", error.message);
      else {
        // Registra em copa_punter_entradas para rastreio G/R exclusivo da Copa
        const { error: entradaErr } = await supabase
          .from("copa_punter_entradas")
          .upsert({
            signal_id:    upserted?.id ?? null,
            fixture_id:   s.fixture_id,
            home:         s.home,
            away:         s.away,
            phase:        s.phase,
            commence_time: s.commence_time,
            market:       s.market,
            selection:    s.selection,
            ah_line:      s.ah_line,
            odd:          s.odd,
            stake_pct:    s.stake_pct,
            block:        s.block,
            confidence:   s.confidence,
            ve_pct:       s.ve_pct,
            edge_pct:     s.edge_pct,
            prob:         s.prob,
            rationale:    s.rationale,
          }, { onConflict: "fixture_id,selection" });
        if (entradaErr) console.warn("[copa-punter] copa_punter_entradas:", entradaErr.message);
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
