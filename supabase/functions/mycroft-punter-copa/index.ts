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
/** Probabilidade de vitória simples (exclui empate). Usado no fallback 1X2. */
function probWin(xgH: number, xgA: number, side: "home" | "away"): number {
  let prob = 0;
  const lH = Math.max(0.05, xgH);
  const lA = Math.max(0.05, xgA);
  for (let h = 0; h <= 8; h++) {
    for (let a = 0; a <= 8; a++) {
      const p = poisson(h, lH) * poisson(a, lA);
      if (side === "home" && h > a) prob += p;
      else if (side === "away" && a > h) prob += p;
    }
  }
  return Math.min(0.98, Math.max(0.02, prob));
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

/** Probabilidade de mais de `line` gols no total (Over line). */
function probOver(xgH: number, xgA: number, line: number): number {
  let prob = 0;
  const lH = Math.max(0.05, xgH);
  const lA = Math.max(0.05, xgA);
  for (let h = 0; h <= 10; h++) {
    for (let a = 0; a <= 10; a++) {
      if (h + a > line) prob += poisson(h, lH) * poisson(a, lA);
    }
  }
  return Math.min(0.98, Math.max(0.02, prob));
}

/** Probabilidade de ambas as equipes marcarem (BTTS). */
function probBTTS(xgH: number, xgA: number): number {
  const lH = Math.max(0.05, xgH);
  const lA = Math.max(0.05, xgA);
  return Math.min(0.98, Math.max(0.02, (1 - poisson(0, lH)) * (1 - poisson(0, lA))));
}

/** Verifica se o fixture envolve a Seleção Brasileira. */
function isBrazilGame(fx: any): boolean {
  const normalize = (s: string) => s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
  const h = normalize(String(fx.home || ""));
  const a = normalize(String(fx.away || ""));
  return h.includes("brazil") || h.includes("brasil") || a.includes("brazil") || a.includes("brasil");
}

/** Lê uma chave de topo no payload do ah_odds_snapshot (ex: over_25, btts_yes). */
async function getSnapOdd(supabase: any, fixtureId: string, key: string): Promise<number | null> {
  const { data } = await supabase
    .from("ah_odds_snapshot")
    .select("payload")
    .eq("fixture_id", fixtureId)
    .order("captured_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!data?.payload) return null;
  try {
    const v = data.payload[key];
    return typeof v === "number" ? v : null;
  } catch { return null; }
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

  // xG / xGA: Futodds CS (proj) → FootyStats → API-Football → síntese FIFA
  const xgH  = fx.xg_last5?.home?.xg  ?? synthXg(ptsH, ptsA);
  const xgaH = fx.xg_last5?.home?.xga ?? synthXg(ptsA, ptsH);
  const xgA  = fx.xg_last5?.away?.xg  ?? synthXg(ptsA, ptsH);
  const xgaA = fx.xg_last5?.away?.xga ?? synthXg(ptsH, ptsA);
  const xgSource = fx.xg_last5?.home?.source ?? "synth_fifa";
  const formH = fx.xg_last5?.home?.form ?? null;
  const formA = fx.xg_last5?.away?.form ?? null;

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

  // ───────── Fallback 1X2 quando não há linhas AH ─────────
  if (!bestCand) {
    const h2hHome = await getAhOdd(supabase, fx.fixture_id, 0, "home");
    const h2hAway = await getAhOdd(supabase, fx.fixture_id, 0, "away");

    if (!h2hHome && !h2hAway) {
      vetos.push("sem odds AH ou 1X2 em ah_odds_snapshot");
      return { fixture_id: fx.fixture_id, approved: false, vetos, ve: 0, confidence: 0 };
    }

    type H2hCand = { side: "home" | "away"; odd: number; prob: number; ve: number };
    const h2hCands: H2hCand[] = [];
    for (const [side, odd] of [["home", h2hHome], ["away", h2hAway]] as [string, number | null][]) {
      if (!odd || odd < ahRange.min || odd > ahRange.max) continue;
      const prob = probWin(xgH, xgA, side as "home" | "away");
      const ve = vePct(prob, odd);
      const conf = Math.round(prob * 100);
      if (ve >= veMinThis && conf >= confMin) {
        h2hCands.push({ side: side as "home" | "away", odd, prob, ve });
      }
    }
    h2hCands.sort((a, b) => b.ve - a.ve);
    const h2hBest = h2hCands[0];

    if (!h2hBest) {
      vetos.push("odds 1X2 disponíveis mas sem valor esperado positivo");
      return { fixture_id: fx.fixture_id, approved: false, vetos, ve: 0, confidence: 0 };
    }

    const h2hConf = Math.round(h2hBest.prob * 100);
    const mvH2h = await checkOddMovement(supabase, fx.fixture_id);
    if (mvH2h.alert) vetos.push("movimento de odd suspeito nas últimas 12h");

    const h2hBlock = vetos.length === 0 ? pickBlock(h2hBest.ve, h2hConf) : null;
    if (!h2hBlock) {
      return { fixture_id: fx.fixture_id, approved: false, vetos, ve: h2hBest.ve, confidence: h2hConf };
    }

    const h2hTeam = h2hBest.side === "home" ? fx.home : fx.away;
    const h2hStake = getStake(cfg, h2hBlock, isMataMata);

    let h2hRationale = `${h2hTeam} Vence (1X2). xG H ${xgH.toFixed(2)}/A ${xgA.toFixed(2)}. Diff FIFA ${diff} pts. VE ${h2hBest.ve}%, prob ${h2hConf}%.`;
    try {
      const sys = "Você é o Mycroft. Responde em pt-br, frio e dedutivo. JSON com {ok:boolean, rationale:string}. Recuse (ok:false) se a tese tiver furo claro.";
      const usr = `Copa 2026 — ${fx.phase}\n${fx.home} x ${fx.away}\nMercado: 1X2 — ${h2hTeam} Vence\nOdd: ${h2hBest.odd}\nVE: ${h2hBest.ve}% | Prob: ${h2hConf}%\nFIFA: ${ptsH} vs ${ptsA}\nλ (${xgSource}): H ${xgH.toFixed(2)}/${xgaH.toFixed(2)} | A ${xgA.toFixed(2)}/${xgaA.toFixed(2)}${formH ? `\nForma H: ${formH} | A: ${formA}` : ""}\nDesfalques: H=${injH} A=${injA}\n\nValide a tese em ≤4 linhas. Devolva JSON.`;
      const out = await callDeepseek(sys, usr, { temperature: 0.2, max_tokens: 400, timeoutMs: 20000 });
      const parsed = JSON.parse(out);
      if (parsed?.ok === false) vetos.push("IA recusou a tese (1X2)");
      else if (parsed?.rationale) h2hRationale = parsed.rationale;
    } catch (e) {
      console.warn(`[copa] IA 1X2 falhou ${fx.fixture_id}:`, (e as Error).message);
    }

    if (vetos.length > 0) {
      return { fixture_id: fx.fixture_id, approved: false, vetos, ve: h2hBest.ve, confidence: h2hConf };
    }

    return {
      fixture_id: fx.fixture_id,
      approved: true,
      signal: {
        fixture_id: fx.fixture_id,
        home: fx.home,
        away: fx.away,
        commence_time: fx.commence_time,
        phase: fx.phase,
        market: "Resultado 1X2",
        selection: `${h2hTeam} Vence`,
        ah_line: null,
        odd: h2hBest.odd,
        prob: h2hBest.prob,
        ve_pct: h2hBest.ve,
        edge_pct: h2hBest.ve,
        confidence: h2hConf,
        block: h2hBlock,
        stake_pct: h2hStake,
        rationale: h2hRationale,
        vetos: [],
        copa_badge: true,
      },
    };
  }
  // ─────────────────────────────────────────────────────────

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
    const usr = `Copa do Mundo 2026 — ${fx.phase}\n${fx.home} x ${fx.away}\nAH: ${selLabel} no ${ahSide === "home" ? fx.home : fx.away}\nOdd: ${odd}\nVE: ${ve}% | Prob: ${confidence}%\nFIFA: ${ptsH} vs ${ptsA}\nλ (${xgSource}): H ${xgH.toFixed(2)}/${xgaH.toFixed(2)} | A ${xgA.toFixed(2)}/${xgaA.toFixed(2)}${formH ? `\nForma H: ${formH} | A: ${formA}` : ""}\nDesfalques: H=${injH} A=${injA}\n\nValide a tese em ≤4 linhas, frias e técnicas. Devolva JSON.`;
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

// ───────── Aprovação mandatória Brasil ─────────
// Requisito de negócio: todo jogo do Brasil DEVE ser aprovado para aparecer
// na Arena Punter e permitir que o usuário acesse o chat Mycroft para análise.
// Usa thresholds relaxados — DeepSeek fornece racional mas não pode vetar.
async function brazilMandatoryApproval(supabase: any, fx: any, cfg: any): Promise<any> {
  const ptsH = fx.home_fifa_pts ?? 1400;
  const ptsA = fx.away_fifa_pts ?? 1300;
  const diff = ptsH - ptsA;
  const isMataMata = ["oitavas", "quartas", "semi", "final", "3lugar"].includes(fx.phase);

  const xgH = fx.xg_last5?.home?.xg ?? synthXg(ptsH, ptsA);
  const xgA = fx.xg_last5?.away?.xg ?? synthXg(ptsA, ptsH);
  const xgSource = fx.xg_last5?.home?.source ?? "synth_fifa";

  type BrCand = { market: string; selection: string; odd: number; prob: number; ve: number; ah_line: number | null };
  const cands: BrCand[] = [];

  // 1. Candidatos AH (thresholds relaxados: odd ≥ 1.20, sem VE mínimo)
  for (const cand of ahLineCandidates(diff)) {
    if (isMataMata && cand.isFavorite && cand.line <= -1.0) continue;
    const odd = await getAhOdd(supabase, fx.fixture_id, cand.line, cand.side);
    if (!odd || odd < 1.20) continue;
    const prob = probAHCover(xgH, xgA, cand.line, cand.side);
    const ve = vePct(prob, odd);
    const selLabel = cand.line > 0 ? `+${cand.line}` : String(cand.line);
    cands.push({ market: "Handicap Asiático", selection: `${cand.side === "home" ? fx.home : fx.away} ${selLabel}`, odd, prob, ve, ah_line: cand.line });
  }

  // 2. 1X2 Brasil vence
  const brazilIsHome = String(fx.home || "").toLowerCase().includes("brazil") ||
                       String(fx.home || "").toLowerCase().includes("brasil");
  const brazilSide: "home" | "away" = brazilIsHome ? "home" : "away";
  const brazilOdd = await getAhOdd(supabase, fx.fixture_id, 0, brazilSide);
  if (brazilOdd && brazilOdd >= 1.20) {
    const prob = probWin(xgH, xgA, brazilSide);
    cands.push({ market: "Resultado 1X2", selection: `${brazilIsHome ? fx.home : fx.away} Vence`, odd: brazilOdd, prob, ve: vePct(prob, brazilOdd), ah_line: null });
  }

  // 3. Over 1.5 / Over 2.5 / BTTS (odds armazenadas pelo punter-copa-odds-sync)
  const over15Odd = await getSnapOdd(supabase, fx.fixture_id, "over_15");
  if (over15Odd && over15Odd >= 1.20) {
    const prob = probOver(xgH, xgA, 1.5);
    cands.push({ market: "Over 1.5 Gols", selection: "Over 1.5", odd: over15Odd, prob, ve: vePct(prob, over15Odd), ah_line: null });
  }
  const over25Odd = await getSnapOdd(supabase, fx.fixture_id, "over_25");
  if (over25Odd && over25Odd >= 1.20) {
    const prob = probOver(xgH, xgA, 2.5);
    cands.push({ market: "Over 2.5 Gols", selection: "Over 2.5", odd: over25Odd, prob, ve: vePct(prob, over25Odd), ah_line: null });
  }
  const bttsOdd = await getSnapOdd(supabase, fx.fixture_id, "btts_yes");
  if (bttsOdd && bttsOdd >= 1.20) {
    const prob = probBTTS(xgH, xgA);
    cands.push({ market: "Ambas Marcam", selection: "Sim", odd: bttsOdd, prob, ve: vePct(prob, bttsOdd), ah_line: null });
  }

  if (cands.length === 0) {
    console.warn(`[copa] 🇧🇷 Brasil sem odds em snapshot: ${fx.home} x ${fx.away} — não é possível aprovar sem odd`);
    return { fixture_id: fx.fixture_id, approved: false, vetos: ["brasil: sem odds disponíveis no snapshot"], ve: 0, confidence: 0 };
  }

  // Ordena por VE (melhor primeiro); mesmo VE negativo → pick least bad
  cands.sort((a, b) => b.ve - a.ve);
  const best = cands[0];
  const conf = Math.round(best.prob * 100);
  const block = pickBlock(best.ve, conf) ?? "A";
  const stake = getStake(cfg, block, isMataMata);

  // DeepSeek: racional técnico (não veta — aprovação é mandatória)
  let rationale = `🇧🇷 Brasil (aprovação mandatória). ${best.selection} | Odd ${best.odd} | VE ${best.ve.toFixed(1)}% | Prob ${conf}% | λ (${xgSource}): H ${xgH.toFixed(2)}/A ${xgA.toFixed(2)}.`;
  try {
    const sys = "Você é o Mycroft. Responde em pt-br, frio e dedutivo. JSON com {rationale:string}. Esta é aprovação mandatória para jogo do Brasil — forneça apenas racional técnico, não pode recusar.";
    const usr = `Copa 2026 — ${fx.phase}\n${fx.home} x ${fx.away}\nMercado: ${best.market} (${best.selection})\nOdd: ${best.odd} | VE: ${best.ve.toFixed(1)}% | Prob: ${conf}%\nFIFA: ${ptsH} vs ${ptsA} | λ: H ${xgH.toFixed(2)}/A ${xgA.toFixed(2)}\n\nRacional técnico em ≤4 linhas. Devolva JSON.`;
    const out = await callDeepseek(sys, usr, { temperature: 0.2, max_tokens: 400, timeoutMs: 15000 });
    const parsed = JSON.parse(out);
    if (parsed?.rationale) rationale = `🇧🇷 ${parsed.rationale}`;
  } catch (e) {
    console.warn(`[copa] brasil rationale IA falhou ${fx.fixture_id}:`, (e as Error).message);
  }

  console.log(`[copa] 🇧🇷 Brasil mandatório aprovado: ${fx.home} x ${fx.away} | ${best.market} (${best.selection}) | VE ${best.ve.toFixed(1)}% | Bloco ${block}`);

  return {
    fixture_id: fx.fixture_id,
    approved: true,
    signal: {
      fixture_id: fx.fixture_id,
      home: fx.home,
      away: fx.away,
      commence_time: fx.commence_time,
      phase: fx.phase,
      market: best.market,
      selection: best.selection,
      ah_line: best.ah_line,
      odd: best.odd,
      prob: best.prob,
      ve_pct: best.ve,
      edge_pct: best.ve,
      confidence: conf,
      block,
      stake_pct: stake,
      rationale,
      vetos: [],
      copa_badge: true,
    },
  };
}

// ───────── Bridge: persiste sinal Copa em punter_sinais (Arena Punter) ─────────
// Permite que os jogos da Copa apareçam na tela Arena Punter e no chat Mycroft.
async function writeToPunterSinais(supabase: any, s: any) {
  const matchId = `${s.home}_${s.away}_${s.commence_time}`
    .replace(/\s+/g, "_")
    .replace(/\+00:00/g, "Z");
  const matchDate = s.commence_time ? s.commence_time.slice(0, 10) : new Date().toISOString().slice(0, 10);
  try {
    // Dedup para evitar duplicata no mesmo match+market
    await supabase.from("punter_sinais").delete().eq("match_id", matchId).eq("market", s.market || "N/A");
    const { error } = await supabase.from("punter_sinais").insert({
      match_id:              matchId,
      home_team:             s.home,
      away_team:             s.away,
      league:                "Copa do Mundo 2026",
      market:                s.market,
      bookmaker:             "Copa 2026",
      odd:                   s.odd,
      fair_odd:              s.prob ? +(1 / s.prob).toFixed(4) : null,
      implied_probability:   s.odd  ? +((1 / s.odd) * 100).toFixed(2) : null,
      estimated_probability: s.prob ? +(s.prob * 100).toFixed(2) : null,
      value_percentage:      s.ve_pct,
      verdict:               "APROVADO",
      confidence:            s.confidence,
      stake_percentage:      s.stake_pct,
      stake_percentage_original: s.stake_pct,
      thesis:                s.rationale,
      analysis:              s.rationale,
      risk_factors:          `Copa do Mundo 2026 — ${s.phase || "grupos"}`,
      analyzed_by:           "mycroft-copa",
      status:                "pending",
      stake_confirmed:       true,
      match_date:            matchDate,
      commence_time:         s.commence_time,
      dismissed:             false,
      resultado:             null,
    });
    if (error) console.warn("[copa-punter] punter_sinais write error:", error.message);
    else console.log(`[copa-punter] ✅ Arena Punter: ${s.home} x ${s.away} | ${s.market}`);
  } catch (e) {
    console.warn("[copa-punter] punter_sinais write falhou:", (e as Error).message);
  }
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
        let r = await analyzeFixture(supabase, fx, cfg);
        // Brasil: se análise normal não aprovou, aplica aprovação mandatória
        if (!r.approved && isBrazilGame(fx)) {
          console.log(`[copa-punter] 🇧🇷 Brasil não aprovado via análise normal — aprovação mandatória: ${fx.home} x ${fx.away}`);
          r = await brazilMandatoryApproval(supabase, fx, cfg);
        }
        results.push(r);
      } catch (e) {
        console.error(`[copa-punter] erro fixture ${fx.fixture_id}:`, (e as Error).message);
        results.push({ fixture_id: fx.fixture_id, approved: false, vetos: ["erro interno: " + (e as Error).message] });
      }
    }

    // 3) Exposição máxima por rodada (mantém os de maior VE; Brasil mandatório entra primeiro)
    const approved = results.filter(r => r.approved && r.signal);
    approved.sort((a: any, b: any) => {
      // Brasil mandatório tem prioridade sobre limite de exposição
      const aBr = isBrazilGame(a.signal) ? 1 : 0;
      const bBr = isBrazilGame(b.signal) ? 1 : 0;
      if (bBr !== aBr) return bBr - aBr;
      return b.signal.ve_pct - a.signal.ve_pct;
    });
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
        // Persiste em punter_sinais para aparecer na Arena Punter e no chat Mycroft
        await writeToPunterSinais(supabase, s);
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
      total_recebidos: fixtures?.length || 0,
      total_filtrados: final.length,
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
