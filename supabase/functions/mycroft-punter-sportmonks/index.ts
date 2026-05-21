// mycroft-punter-sportmonks
// Análise PRÉ-LIVE do Punter usando dados Sportmonks (Pro Advanced) + Gemini.
// Diferenças vs mycroft-punter-anthropic:
//   - Stats vêm de Sportmonks (cobre times sul-americanos / 2ª divisão melhor que API-Football).
//   - SEM Sherlock pós-IA (que vetava por "dados insuficientes" da API-Football).
//   - Prompt menos restritivo (edge >= 2%, prob >= 35% para 1X2).
//   - Salva analyzed_by = "sportmonks" para distinguir do motor automático.
// Disparo: botão admin manual em /punter/menu.

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import { applyApprovalBlocks, loadGateConfig } from "../_shared/punterApprovalBlocks.ts";
import { getUpcomingFixturesSM } from "../_shared/sportmonks-af-adapter.ts";
import { fetchSportmonksPrematchOdds, listPrematchMarkets, normalizePrematchMarketLabel } from "../_shared/sportmonksPrematchOdds.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const GROQ_KEY = Deno.env.get("GROQ_API_KEY") || "";
const SM_TOKEN = Deno.env.get("SPORTMONKS_API_KEY") || "";
const SM_BASE = "https://api.sportmonks.com/v3";

const TIME_GUARD_MS = 100_000;
const MAX_GAMES = 25;

// ──────────────────────────────────────────────
// Sportmonks helpers
// ──────────────────────────────────────────────
function smUrl(path: string, params: Record<string, string> = {}): string {
  const u = new URL(SM_BASE + path);
  u.searchParams.set("api_token", SM_TOKEN);
  for (const [k, v] of Object.entries(params)) u.searchParams.set(k, v);
  return u.toString();
}

// Normaliza nomes para a busca Sportmonks (remove sufixos comuns BR/AR/UR e prefixos como "CA", "SC", "FC")
function normalizeTeamName(name: string): string[] {
  const variants = new Set<string>();
  variants.add(name);
  // remove sufixo de UF brasileira (-SP, -RJ, -MG, -BA, -RS, -PR, -PE, -CE, -GO, -DF...)
  let v = name.replace(/\s*[-/]\s*(SP|RJ|MG|BA|RS|PR|PE|CE|GO|DF|ES|SC|MT|MS|PA|PB|RN|AL|MA|PI|TO|AM|RO|AC|RR|AP|SE)\b/i, "").trim();
  variants.add(v);
  // remove sufixos de cidade (Asunción, Montevideo, Guayaquil, Quito, La Paz, etc)
  v = v.replace(/\s+(Asunción|Asuncion|Montevideo|Guayaquil|Quito|La Paz|Bogotá|Medellín|Medellin|Cali|Lima|Buenos Aires|Santiago|Caracas)$/i, "").trim();
  variants.add(v);
  // remove prefixos comuns (CA, SC, FC, CD, CR, EC, AA, SE, AD, RB, CF)
  v = v.replace(/^(CA|SC|FC|CD|CR|EC|AA|SE|AD|RB|CF|SD|UD|CS|AS|US|FK|SK|HC|GD)\s+/i, "").trim();
  variants.add(v);
  // primeira palavra (last resort, p/ "Vasco da Gama" -> "Vasco")
  const first = v.split(/\s+/)[0];
  if (first.length >= 4) variants.add(first);
  return Array.from(variants).filter(Boolean);
}

async function smSearchTeam(name: string): Promise<{ id: number; name: string } | null> {
  if (!SM_TOKEN) return null;
  for (const variant of normalizeTeamName(name)) {
    try {
      const url = smUrl(`/football/teams/search/${encodeURIComponent(variant)}`);
      const r = await fetch(url);
      if (!r.ok) continue;
      const j = await r.json();
      const t = j.data?.[0];
      if (t) return { id: t.id, name: t.name };
    } catch { /* try next */ }
  }
  return null;
}

async function smLastFixtures(teamId: number, n = 8): Promise<any[]> {
  if (!SM_TOKEN) return [];
  try {
    const today = new Date().toISOString().slice(0, 10);
    const sixMonthsAgo = new Date(Date.now() - 180 * 86400_000).toISOString().slice(0, 10);
    const url = smUrl(`/football/fixtures/between/${sixMonthsAgo}/${today}/${teamId}`, {
      include: "scores;participants;state;periods",
      per_page: "50",
    });
    const r = await fetch(url);
    if (!r.ok) return [];
    const j = await r.json();
    const list = (j.data || []).filter((f: any) => {
      const s = (f.state?.short_name || f.state?.name || "").toUpperCase();
      return s.includes("FT") || s.includes("FIN") || s.includes("END");
    });
    return list.slice(-n);
  } catch { return []; }
}

interface TeamSummary {
  name: string;
  sample: number;
  played: number;
  goals_for: number;
  goals_against: number;
  wins: number;
  draws: number;
  losses: number;
  btts_pct: number;
  over25_pct: number;
  over15_pct: number;
  avg_total: number;
  recent_form: string; // "WWLDW"
}

function summarizeTeam(name: string, teamId: number, fixtures: any[]): TeamSummary {
  let gf = 0, ga = 0, w = 0, d = 0, l = 0, btts = 0, o25 = 0, o15 = 0;
  const form: string[] = [];
  for (const f of fixtures) {
    const parts = f.participants || [];
    const home = parts.find((p: any) => p.meta?.location === "home") || parts[0];
    const away = parts.find((p: any) => p.meta?.location === "away") || parts[1];
    const isHome = home?.id === teamId;
    let gh: number | null = null, gA: number | null = null;
    for (const s of (f.scores || [])) {
      if ((s.description || "").toUpperCase() !== "CURRENT") continue;
      if (s.score?.participant === "home") gh = s.score.goals;
      if (s.score?.participant === "away") gA = s.score.goals;
    }
    if (gh === null || gA === null) continue;
    const myGoals = isHome ? gh : gA;
    const oppGoals = isHome ? gA : gh;
    gf += myGoals; ga += oppGoals;
    if (myGoals > oppGoals) { w++; form.push("W"); }
    else if (myGoals < oppGoals) { l++; form.push("L"); }
    else { d++; form.push("D"); }
    if (gh > 0 && gA > 0) btts++;
    if (gh + gA > 2.5) o25++;
    if (gh + gA > 1.5) o15++;
  }
  const played = w + d + l;
  return {
    name,
    sample: played,
    played,
    goals_for: gf,
    goals_against: ga,
    wins: w, draws: d, losses: l,
    btts_pct: played > 0 ? Math.round(btts / played * 100) : 0,
    over25_pct: played > 0 ? Math.round(o25 / played * 100) : 0,
    over15_pct: played > 0 ? Math.round(o15 / played * 100) : 0,
    avg_total: played > 0 ? Number(((gf + ga) / played).toFixed(2)) : 0,
    recent_form: form.slice(-5).join(""),
  };
}

// ──────────────────────────────────────────────
// Groq call (OpenAI-compatible, llama-3.3-70b-versatile)
// ──────────────────────────────────────────────
async function callGemini(systemPrompt: string, userPrompt: string): Promise<string> {
  if (!GROQ_KEY) throw new Error("GROQ_API_KEY missing");
  const models = ["llama-3.3-70b-versatile", "llama-3.1-8b-instant", "llama-3.3-70b-versatile"];
  let lastErr = "";
  for (let attempt = 0; attempt < 3; attempt++) {
    const model = models[Math.min(attempt, models.length - 1)];
    try {
      const r = await fetch(
        "https://api.groq.com/openai/v1/chat/completions",
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${GROQ_KEY}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model,
            max_completion_tokens: 1500,
            response_format: { type: "json_object" },
            messages: [
              { role: "system", content: systemPrompt },
              { role: "user", content: userPrompt },
            ],
          }),
        },
      );
      if (r.ok) {
        const j = await r.json();
        return j.choices?.[0]?.message?.content || "";
      }
      const t = await r.text();
      lastErr = `Groq ${r.status} (${model}): ${t.slice(0, 200)}`;
      // 503/429 → retry com backoff e modelo menor
      if (r.status === 503 || r.status === 429) {
        await new Promise((res) => setTimeout(res, 1500 * (attempt + 1)));
        continue;
      }
      throw new Error(lastErr);
    } catch (e) {
      lastErr = e instanceof Error ? e.message : String(e);
      if (attempt === 2) throw new Error(lastErr);
      await new Promise((res) => setTimeout(res, 1500 * (attempt + 1)));
    }
  }
  throw new Error(lastErr || "Groq failed");
}

function parseJsonRobust(raw: string): any | null {
  if (!raw) return null;
  try { return JSON.parse(raw); } catch {}
  const start = raw.indexOf("{");
  const end = raw.lastIndexOf("}");
  if (start >= 0 && end > start) {
    try { return JSON.parse(raw.slice(start, end + 1)); } catch {}
  }
  return null;
}

// ──────────────────────────────────────────────
// Build prompt
// ──────────────────────────────────────────────
function buildPrompt(game: any, home: TeamSummary, away: TeamSummary): { sys: string; user: string } {
  const prematchMarkets = Array.isArray(game.prematch_markets) ? game.prematch_markets : [];
  const oddsBlock = prematchMarkets.length > 0
    ? prematchMarkets.map((entry: any) => `  ${entry.market}: ${entry.odd}`).join("\n")
    : "Sem odds disponíveis";

  const sys = `Você é Mycroft Punter — analista probabilístico DISCIPLINADO. Sistema de 3 blocos:

🟢 BLOCO A — SEGURANÇA: prob >= 58%, edge >= 3%, conf >= 72%, odd 1.30–1.85
🟡 BLOCO B — VALOR:     prob >= 45%, edge >= 5%, conf >= 70%, odd 1.85–3.20
🔥 BLOCO C — ELITE:     prob >= 55%, edge >= 7%, conf >= 80%, odd 1.50–4.50 c/ Pinnacle

VETOS OBRIGATÓRIOS:
- prob estimada < 45% → VETAR
- odd < 1.30 ou > 4.50 → VETAR
- favorito odd < 1.50 sem dados ALTA → VETAR
- liga não-top (fora de Premier/La Liga/Serie A/Bundesliga/Ligue1/Champions/Libertadores/Brasileirão/Championship) c/ odd < 1.60 → VETAR
- contradição grave (você projeta 70% mas odd está em 4.0) → VETAR

Meta: aprovação 25-40% com win rate >= 58%. Responda APENAS JSON válido.`;

  const user = `JOGO: ${game.home_team} vs ${game.away_team}
LIGA: ${game.sport_title || "?"}
DATA: ${game.commence_time}

═══ ESTATÍSTICAS SPORTMONKS (últimos jogos) ═══
${home.name}: ${home.recent_form} | ${home.played} jogos | ${home.wins}V ${home.draws}E ${home.losses}D
  Gols pró/contra: ${home.goals_for}/${home.goals_against} | Média total/jogo: ${home.avg_total}
  Over 2.5: ${home.over25_pct}% | Over 1.5: ${home.over15_pct}% | BTTS: ${home.btts_pct}%

${away.name}: ${away.recent_form} | ${away.played} jogos | ${away.wins}V ${away.draws}E ${away.losses}D
  Gols pró/contra: ${away.goals_for}/${away.goals_against} | Média total/jogo: ${away.avg_total}
  Over 2.5: ${away.over25_pct}% | Over 1.5: ${away.over15_pct}% | BTTS: ${away.btts_pct}%

═══ ODDS DE MERCADO ═══
${oddsBlock}

═══ INSTRUÇÕES ═══
1. Calcule prob estimada via stats (Poisson + médias). Edge = (prob × odd) − 1.
2. Mercados aceitos: Casa, Empate, Fora, Over 1.5, Under 1.5, Over 2.5, Under 2.5, Over 3.5, Under 3.5, BTTS Sim, BTTS Não.
3. ESCOLHA O MELHOR mercado (maior score = prob × edge × conf) que se encaixe em ALGUM bloco (A, B ou C).
4. Se nenhum mercado se encaixar nos blocos, VETE com motivo claro.
5. NÃO vete por: "apenas 1 bookmaker", "imprevisibilidade", "amostra de 3+ jogos".
6. Defina "data_strength": ALTA (xG+stats completos), MEDIA (stats básicas), BAIXA (só odds).

Retorne APENAS JSON neste formato:
{
  "verdict": "APROVADO" | "VETADO",
  "market": "Casa" | "Over 2.5" | etc,
  "bookmaker": "nome",
  "odd": 2.10,
  "fair_odd": 1.85,
  "implied_probability": 47.6,
  "estimated_probability": 54.1,
  "value_percentage": 13.5,
  "confidence": 70,
  "data_strength": "ALTA" | "MEDIA" | "BAIXA",
  "stake_percentage": 3,
  "thesis": "JUSTIFICATIVA narrativa em 3-4 frases curtas (formato dos cards aprovados do Trader Sports). NÃO colocar métricas cruas aqui. Estrutura: (1) contexto do confronto e ponto fraco do adversário ou força do nosso lado; (2) gatilho estatístico/forma recente; (3) por que a odd está mal precificada; (4) risco residual aceito. Linguagem de analista.",
  "analysis": "Bloco quantitativo curto: prob X% × odd Y = Z% edge. Métricas vão AQUI, não na thesis.",
  "risk_factors": "Riscos específicos (desfalque, motivação, contexto de tabela)."
}`;
  return { sys, user };
}

// ──────────────────────────────────────────────
// HT/BTTS extension (v3.4) — heurística baseada em últimos jogos
// ──────────────────────────────────────────────
interface HtBttsSummary {
  over05HT_rate: number;
  zero_zero_ht_rate: number;
  btts_rate: number;
  avg_goals_scored: number;
  avg_goals_conceded: number;
  sample: number;
}

function extractHTGoals(fixture: any): { home: number; away: number } | null {
  const periods = fixture.periods || [];
  const ht = periods.find((p: any) => p.type_id === 1);
  if (!ht) return null;
  const gh = ht.goals?.home ?? ht.score_home ?? null;
  const ga = ht.goals?.away ?? ht.score_away ?? null;
  if (gh === null || ga === null) return null;
  return { home: Number(gh) || 0, away: Number(ga) || 0 };
}

function summarizeHtBtts(teamId: number, fixtures: any[]): HtBttsSummary {
  let o05 = 0, zz = 0, btts = 0, gf = 0, ga = 0, n = 0, htSample = 0;
  for (const f of fixtures) {
    const parts = f.participants || [];
    const home = parts.find((p: any) => p.meta?.location === "home") || parts[0];
    const isHome = home?.id === teamId;
    let gh: number | null = null, gA: number | null = null;
    for (const s of (f.scores || [])) {
      if ((s.description || "").toUpperCase() !== "CURRENT") continue;
      if (s.score?.participant === "home") gh = s.score.goals;
      if (s.score?.participant === "away") gA = s.score.goals;
    }
    if (gh === null || gA === null) continue;
    n++;
    gf += isHome ? gh : gA;
    ga += isHome ? gA : gh;
    if (gh > 0 && gA > 0) btts++;
    const ht = extractHTGoals(f);
    if (ht) {
      htSample++;
      const total = ht.home + ht.away;
      if (total > 0) o05++;
      if (total === 0) zz++;
    }
  }
  const denomHT = htSample || 1;
  const denom = n || 1;
  return {
    over05HT_rate: Math.round((o05 / denomHT) * 100),
    zero_zero_ht_rate: Math.round((zz / denomHT) * 100),
    btts_rate: Math.round((btts / denom) * 100),
    avg_goals_scored: Number((gf / denom).toFixed(2)),
    avg_goals_conceded: Number((ga / denom).toFixed(2)),
    sample: n,
  };
}

async function fetchH2HSummary(homeId: number, awayId: number): Promise<{ over05HT_rate: number; btts_rate: number; total: number }> {
  if (!SM_TOKEN) return { over05HT_rate: 0, btts_rate: 0, total: 0 };
  try {
    const url = smUrl(`/football/fixtures/head2head/${homeId}/${awayId}`, {
      include: "scores;periods;state",
    });
    const r = await fetch(url);
    if (!r.ok) return { over05HT_rate: 0, btts_rate: 0, total: 0 };
    const j = await r.json();
    const list = (j.data || []).filter((f: any) => {
      const s = (f.state?.short_name || "").toUpperCase();
      return ["FT", "AET", "PEN"].includes(s);
    }).slice(0, 8);
    let o05 = 0, btts = 0, htSample = 0;
    for (const f of list) {
      const ht = extractHTGoals(f);
      if (ht) { htSample++; if (ht.home + ht.away > 0) o05++; }
      let gh: number | null = null, ga: number | null = null;
      for (const s of (f.scores || [])) {
        if ((s.description || "").toUpperCase() !== "CURRENT") continue;
        if (s.score?.participant === "home") gh = s.score.goals;
        if (s.score?.participant === "away") ga = s.score.goals;
      }
      if (gh !== null && ga !== null && gh > 0 && ga > 0) btts++;
    }
    const n = list.length || 1;
    return {
      over05HT_rate: htSample > 0 ? Math.round((o05 / htSample) * 100) : 0,
      btts_rate: Math.round((btts / n) * 100),
      total: list.length,
    };
  } catch {
    return { over05HT_rate: 0, btts_rate: 0, total: 0 };
  }
}

function calcScoreOver05HT(h: HtBttsSummary, a: HtBttsSummary, h2h: { over05HT_rate: number; total: number }): { score: number; ind: Record<string, number> } {
  let s = 35;
  const rateMedia = (h.over05HT_rate + a.over05HT_rate) / 2;
  const ind: Record<string, number> = {
    over05HT_rate_home: h.over05HT_rate,
    over05HT_rate_away: a.over05HT_rate,
    over05HT_rate_media: Math.round(rateMedia),
  };
  if (rateMedia >= 80) s += 28;
  else if (rateMedia >= 70) s += 20;
  else if (rateMedia >= 60) s += 12;
  else if (rateMedia >= 50) s += 5;
  else if (rateMedia < 40) s -= 15;

  const zeroMedia = (h.zero_zero_ht_rate + a.zero_zero_ht_rate) / 2;
  ind.zero_zero_ht_rate_media = Math.round(zeroMedia);
  if (zeroMedia >= 60) s -= 18;
  else if (zeroMedia >= 50) s -= 10;

  const avgGols = h.avg_goals_scored + a.avg_goals_scored;
  ind.avg_gols_total = Number(avgGols.toFixed(2));
  if (avgGols >= 3.0) s += 8;
  else if (avgGols >= 2.2) s += 4;
  else if (avgGols < 1.5) s -= 8;

  ind.h2h_over05HT_rate = h2h.over05HT_rate;
  if (h2h.over05HT_rate >= 70 && h2h.total >= 3) s += 10;
  else if (h2h.over05HT_rate >= 50) s += 5;
  else if (h2h.over05HT_rate <= 20 && h2h.total >= 3) s -= 8;

  return { score: Math.max(0, Math.min(100, Math.round(s))), ind };
}

function calcScoreBTTS(h: HtBttsSummary, a: HtBttsSummary, h2h: { btts_rate: number; total: number }): { score: number; ind: Record<string, number> } {
  let s = 35;
  const bttsMedia = (h.btts_rate + a.btts_rate) / 2;
  const ind: Record<string, number> = {
    btts_rate_home: h.btts_rate,
    btts_rate_away: a.btts_rate,
    btts_rate_media: Math.round(bttsMedia),
  };
  if (bttsMedia >= 75) s += 28;
  else if (bttsMedia >= 65) s += 20;
  else if (bttsMedia >= 55) s += 12;
  else if (bttsMedia >= 45) s += 4;
  else if (bttsMedia < 35) s -= 15;

  if (h.avg_goals_scored >= 1.5 && a.avg_goals_scored >= 1.2) s += 14;
  else if (h.avg_goals_scored >= 1.2 && a.avg_goals_scored >= 1.0) s += 7;
  else if (h.avg_goals_scored < 0.8 || a.avg_goals_scored < 0.8) s -= 12;

  if (h.avg_goals_conceded >= 1.3 && a.avg_goals_conceded >= 1.3) s += 12;
  else if (h.avg_goals_conceded >= 1.0 && a.avg_goals_conceded >= 1.0) s += 6;
  else if (h.avg_goals_conceded < 0.6 || a.avg_goals_conceded < 0.6) s -= 10;

  ind.h2h_btts_rate = h2h.btts_rate;
  if (h2h.btts_rate >= 70 && h2h.total >= 3) s += 12;
  else if (h2h.btts_rate >= 50) s += 6;
  else if (h2h.btts_rate <= 20 && h2h.total >= 3) s -= 10;

  return { score: Math.max(0, Math.min(100, Math.round(s))), ind };
}

// Extrai odd Over 0.5 HT (totals 0.5 first half) e BTTS Yes do payload The Odds API.
// Fallback: usa "totals" 0.5 (FT) — improvável de existir, mas tenta.
function extractHtBttsOdds(game: any): { oddOver05HT: number | null; oddBtts: number | null; bm: string } {
  const prematchOdds = game.prematch_odds || {};
  const oddBtts = prematchOdds['BTTS Sim'] ?? null;
  return { oddOver05HT: null, oddBtts, bm: 'sportmonks-prematch' };
}

async function persistHtBttsSignal(
  sb: any,
  game: any,
  matchId: string,
  market: "Over 0.5 HT" | "BTTS Sim",
  score: number,
  odd: number,
  ind: Record<string, number>,
  bookmaker: string,
) {
  const probEst = Math.min(0.95, score / 100);
  const fairOdd = 1 / probEst;
  const edgePct = ((odd - fairOdd) / fairOdd) * 100;
  if (edgePct < 5) {
    console.log(`[sm-punter htbtts] ${market} edge ${edgePct.toFixed(1)}% < 5% — skip`);
    return false;
  }
  const confidence = Math.min(95, score);
  const stake = score >= 80 ? 4 : score >= 70 ? 3 : 2.5;
  const matchDate = game.commence_time?.split("T")[0];
  const isHoje = matchDate === new Date().toISOString().split("T")[0];

  const thesis = `${market}: rate médio ${
    market === "Over 0.5 HT" ? ind.over05HT_rate_media : ind.btts_rate_media
  }% (casa/fora) | H2H ${
    market === "Over 0.5 HT" ? ind.h2h_over05HT_rate : ind.h2h_btts_rate
  }% | Edge +${edgePct.toFixed(1)}%`;

  await sb.from("punter_analyses").upsert({
    match_id: matchId,
    home_team: game.home_team,
    away_team: game.away_team,
    league: game.sport_title || "?",
    commence_time: game.commence_time,
    market,
    bookmaker,
    odd,
    fair_odd: Number(fairOdd.toFixed(2)),
    implied_probability: Number((100 / odd).toFixed(1)),
    estimated_probability: Number((probEst * 100).toFixed(1)),
    value_percentage: Number(edgePct.toFixed(1)),
    verdict: "APROVADO",
    confidence,
    stake_percentage: stake,
    thesis,
    analysis: `Score heurístico ${score}/100. Indicadores: ${JSON.stringify(ind)}`,
    risk_factors: market === "Over 0.5 HT" && ind.zero_zero_ht_rate_media >= 40
      ? `Taxa de 0x0 no HT ${ind.zero_zero_ht_rate_media}% — risco moderado`
      : "",
    analyzed_by: "sportmonks-htbtts",
  }, { onConflict: "match_id,market", ignoreDuplicates: false });

  await sb.from("punter_sinais").upsert({
    match_id: matchId,
    home_team: game.home_team,
    away_team: game.away_team,
    league: game.sport_title || "?",
    commence_time: game.commence_time,
    match_date: matchDate,
    market,
    bookmaker,
    odd,
    fair_odd: Number(fairOdd.toFixed(2)),
    implied_probability: Number((100 / odd).toFixed(1)),
    estimated_probability: Number((probEst * 100).toFixed(1)),
    value_percentage: Number(edgePct.toFixed(1)),
    verdict: "APROVADO",
    confidence,
    stake_percentage: isHoje ? stake : null,
    stake_percentage_original: stake,
    thesis,
    analysis: `Score ${score}/100`,
    risk_factors: "",
    analyzed_by: "sportmonks-htbtts",
    status: isHoje ? "pending" : "awaiting_stake",
    stake_confirmed: isHoje,
    dismissed: false,
    resultado: null,
  }, { onConflict: "match_id,market", ignoreDuplicates: false });

  return true;
}

// ──────────────────────────────────────────────
// MAIN
// ──────────────────────────────────────────────
serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  const startedAt = Date.now();
  const sb = createClient(SUPABASE_URL, SERVICE_KEY);

  try {
    if (!SM_TOKEN) throw new Error("SPORTMONKS_API_KEY missing");
    if (!GROQ_KEY) throw new Error("GROQ_API_KEY missing");

    const body = await req.json().catch(() => ({}));
    const sports: string[] = body.sports || [
      "soccer_brazil_campeonato",
      "soccer_brazil_serie_b",
      "soccer_conmebol_copa_libertadores",
      "soccer_conmebol_copa_sudamericana",
      "soccer_uefa_champs_league",
      "soccer_uefa_europa_league",
      "soccer_epl",
      "soccer_spain_la_liga",
      "soccer_italy_serie_a",
      "soccer_germany_bundesliga",
      "soccer_france_ligue_one",
      "soccer_argentina_primera_division",
    ];
    const hours_ahead = body.hours_ahead || 72;

    // 1) Coleta jogos via Sportmonks + odds pré-jogo da própria Sportmonks
    const now = Date.now();
    const horizon = now + hours_ahead * 3_600_000;
    const leagueIdToKey: Record<number, string> = {
      71: 'soccer_brazil_campeonato',
      72: 'soccer_brazil_serie_b',
      13: 'soccer_conmebol_copa_libertadores',
      11: 'soccer_conmebol_copa_sudamericana',
      2: 'soccer_uefa_champs_league',
      3: 'soccer_uefa_europa_league',
      39: 'soccer_epl',
      140: 'soccer_spain_la_liga',
      135: 'soccer_italy_serie_a',
      78: 'soccer_germany_bundesliga',
      61: 'soccer_france_ligue_one',
      128: 'soccer_argentina_primera_division',
    };
    const selectedLeagueIds = Object.entries(leagueIdToKey)
      .filter(([, key]) => sports.includes(key))
      .map(([id]) => Number(id));
    const fixturesRaw = await getUpcomingFixturesSM(selectedLeagueIds, hours_ahead);
    const games: any[] = [];
    for (const fixture of fixturesRaw) {
      const t = new Date(fixture.fixture.date).getTime();
      if (t < now || t > horizon) continue;
      const prematchOdds = await fetchSportmonksPrematchOdds(fixture.fixture.id);
      const prematchMarkets = listPrematchMarkets(prematchOdds);
      if (prematchMarkets.length === 0) continue;
      games.push({
        id: String(fixture.fixture.id),
        fixture_id: fixture.fixture.id,
        commence_time: fixture.fixture.date,
        home_team: fixture.teams.home.name,
        away_team: fixture.teams.away.name,
        sport_title: fixture.league.name,
        league_id: fixture.league.id,
        prematch_odds: prematchOdds,
        prematch_markets: prematchMarkets,
      });
      if (games.length >= MAX_GAMES) break;
    }

    console.log(`[sm-punter] ${games.length} jogos para análise`);

    const gateCfg = await loadGateConfig(sb);
    let approved = 0, vetoed = 0, errors = 0;
    const results: any[] = [];

    for (const g of games.slice(0, MAX_GAMES)) {
      if (Date.now() - startedAt > TIME_GUARD_MS) {
        console.warn("[sm-punter] time guard hit");
        break;
      }
      try {
        const matchId = g.id;
        // Skip se já analisado por sportmonks recentemente
        const { data: existing } = await sb
          .from("punter_analyses")
          .select("id")
          .eq("match_id", matchId)
          .eq("analyzed_by", "sportmonks")
          .gte("created_at", new Date(Date.now() - 6 * 3600_000).toISOString())
          .limit(1);
        if (existing && existing.length > 0) {
          console.log(`[sm-punter] skip ${g.home_team} (já analisado)`);
          continue;
        }

        const [thome, taway] = await Promise.all([
          smSearchTeam(g.home_team),
          smSearchTeam(g.away_team),
        ]);
        if (!thome || !taway) {
          console.log(`[sm-punter] sem team-id para ${g.home_team} / ${g.away_team}`);
          continue;
        }

        const [fxH, fxA] = await Promise.all([
          smLastFixtures(thome.id, 8),
          smLastFixtures(taway.id, 8),
        ]);
        const sumH = summarizeTeam(thome.name, thome.id, fxH);
        const sumA = summarizeTeam(taway.name, taway.id, fxA);

        if (sumH.played < 3 || sumA.played < 3) {
          console.log(`[sm-punter] amostra insuficiente ${sumH.played}/${sumA.played}`);
          continue;
        }

        const { sys, user } = buildPrompt(g, sumH, sumA);
        const txt = await callGemini(sys, user);
        const an = parseJsonRobust(txt);
        if (!an) { errors++; continue; }

        const normalizedMarket = normalizePrematchMarketLabel(String(an.market || ''));
        const derivedOdd = normalizedMarket ? g.prematch_odds?.[normalizedMarket] : null;
        if (derivedOdd && Number.isFinite(Number(derivedOdd))) {
          an.odd = Number(derivedOdd);
          an.bookmaker = an.bookmaker || 'sportmonks-prematch';
          const estProb = Number(an.estimated_probability) || 0;
          if (estProb > 0) {
            an.fair_odd = Number((100 / estProb).toFixed(2));
            an.implied_probability = Number((100 / Number(derivedOdd)).toFixed(1));
            an.value_percentage = Number((((Number(derivedOdd) * estProb) / 100 - 1) * 100).toFixed(1));
          }
        }

        if (!an.odd || Number(an.odd) <= 1.01) {
          console.log(`[sm-punter] sem odd real para ${g.home_team} vs ${g.away_team} mercado=${an.market}`);
          vetoed++;
          continue;
        }

        // ─── BLOCK GATE (3 blocos A/B/C + 4 vetos determinísticos) ───
        const gate = applyApprovalBlocks({
          verdict: String(an.verdict || "VETADO"),
          market: an.market,
          odd: Number(an.odd) || 0,
          estimated_probability: Number(an.estimated_probability) || 0,
          value_percentage: Number(an.value_percentage) || 0,
          confidence: Number(an.confidence) || 0,
          league: g.sport_title || "",
          bookmaker: an.bookmaker || "",
          data_strength: an.data_strength || "",
        }, gateCfg);
        if (gate.demoted) {
          console.log(`[sm-punter GATE] ${g.home_team} vs ${g.away_team}: ${gate.veto_reason || gate.block_reason}`);
        }
        // Sobrescreve com decisão do gate
        an.verdict = gate.verdict;
        an.tier = gate.block;
        an.tier_label = gate.tier_label;
        an.block_reason = gate.block_reason;
        if (gate.veto_reason) an.veto_reason = gate.veto_reason;
        if (gate.stake_percentage > 0) an.stake_percentage = gate.stake_percentage;
        const verdict = gate.verdict;
        const isApproved = verdict === "APROVADO";

        await sb.from("punter_analyses").upsert({
          match_id: matchId,
          home_team: g.home_team,
          away_team: g.away_team,
          league: g.sport_title || "?",
          commence_time: g.commence_time,
          market: an.market || "N/A",
          bookmaker: an.bookmaker || "N/A",
          odd: Number(an.odd) || 0,
          fair_odd: Number(an.fair_odd) || null,
          implied_probability: Number(an.implied_probability) || null,
          estimated_probability: Number(an.estimated_probability) || null,
          value_percentage: Number(an.value_percentage) || 0,
          verdict: isApproved ? "APROVADO" : "VETADO",
          confidence: Number(an.confidence) || 0,
          stake_percentage: Number(an.stake_percentage) || 0,
          thesis: an.thesis || "",
          analysis: an.analysis || "",
          risk_factors: an.risk_factors || "",
          analyzed_by: "sportmonks",
          approval_block: gate.block,
          gate_demoted: gate.demoted || false,
          gate_veto_reason: gate.veto_reason || null,
          gate_block_reason: gate.block_reason || null,
        }, { onConflict: "match_id,market", ignoreDuplicates: false });

        if (isApproved) {
          approved++;
          // Persiste sinal (mesma tabela usada pelo automático)
          const matchDate = g.commence_time?.split("T")[0];
          const isHoje = matchDate === new Date().toISOString().split("T")[0];
          await sb.from("punter_sinais").upsert({
            match_id: matchId,
            home_team: g.home_team,
            away_team: g.away_team,
            league: g.sport_title || "?",
            commence_time: g.commence_time,
            match_date: matchDate,
            market: an.market || "N/A",
            bookmaker: an.bookmaker || "N/A",
            odd: Number(an.odd) || 0,
            fair_odd: Number(an.fair_odd) || null,
            implied_probability: Number(an.implied_probability) || null,
            estimated_probability: Number(an.estimated_probability) || null,
            value_percentage: Number(an.value_percentage) || 0,
            verdict: "APROVADO",
            confidence: Number(an.confidence) || 0,
            stake_percentage: isHoje ? Number(an.stake_percentage) || 0 : null,
            stake_percentage_original: Number(an.stake_percentage) || 0,
            thesis: an.thesis || "",
            analysis: an.analysis || "",
            risk_factors: an.risk_factors || "",
            analyzed_by: "sportmonks",
            status: isHoje ? "pending" : "awaiting_stake",
            stake_confirmed: isHoje,
            dismissed: false,
            resultado: null,
            approval_block: gate.block,
          }, { onConflict: "match_id,market", ignoreDuplicates: false });

          // === TELEGRAM (Pré Live) — usa telegram-send-dedupe (evita duplicatas) ===
          try {
            const horaBR = new Date(g.commence_time).toLocaleString("pt-BR", {
              timeZone: "America/Recife", day: "2-digit", month: "2-digit",
              hour: "2-digit", minute: "2-digit",
            });
            const conf = Number(an.confidence) || 0;
            const edge = Number(an.value_percentage) || 0;
            const tier = conf >= 75 ? "⚡ FORTE" : conf >= 65 ? "✅ BOM" : "🎯 MODERADO";
            const stake = Number(an.stake_percentage) || 0;
            const tgText = [
              `🎯 <b>SINAL PUNTER PRÉ-LIVE</b> ${tier}`,
              `━━━━━━━━━━━━━━━━━━`,
              `⚽ <b>${g.home_team}</b> x <b>${g.away_team}</b>`,
              `🏆 ${g.sport_title || "?"}`,
              `🕐 ${horaBR} BRT`,
              ``,
              `📌 <b>Mercado:</b> ${an.market || "?"}`,
              `💹 <b>Odd:</b> ${(Number(an.odd) || 0).toFixed(2)} (${an.bookmaker || "?"})`,
              `🎯 <b>Confiança:</b> ${conf}% | <b>Edge:</b> +${edge.toFixed(1)}%`,
              stake > 0 ? `💰 <b>Stake:</b> ${stake.toFixed(1)}% banca` : "",
              ``,
              an.thesis ? `🧠 ${String(an.thesis).slice(0, 280)}` : "",
              ``,
              `<i>Análise Mycroft via Sportmonks</i>`,
            ].filter(Boolean).join("\n");

            await sb.functions.invoke("telegram-send-dedupe", {
              body: {
                text: tgText,
                match_id: matchId,
                market: an.market || "N/A",
                verdict: "APROVADO",
                channel: "punter-prelive",
                source: "mycroft-punter-sportmonks",
                parse_mode: "HTML",
                enabled: true, // força envio mesmo se TELEGRAM_ENABLED não estiver setado
              },
            });
          } catch (tgErr) {
            console.error("[sm-punter] telegram err:", tgErr instanceof Error ? tgErr.message : tgErr);
          }
        } else {
          vetoed++;
        }
        results.push({ game: `${g.home_team} vs ${g.away_team}`, verdict, market: an.market, edge: an.value_percentage });
        console.log(`[sm-punter] ${g.home_team} vs ${g.away_team}: ${verdict} | ${an.market} | edge ${an.value_percentage}%`);

        // ── EXTENSÃO HT/BTTS (v3.4) — heurística estatística + odds The Odds API ──
        try {
          const hSum = summarizeHtBtts(thome.id, fxH);
          const aSum = summarizeHtBtts(taway.id, fxA);
          if (hSum.sample >= 3 && aSum.sample >= 3) {
            const h2h = await fetchH2HSummary(thome.id, taway.id);
            const { score: scoreHT, ind: indHT } = calcScoreOver05HT(hSum, aSum, h2h);
            const { score: scoreBTTS, ind: indBTTS } = calcScoreBTTS(hSum, aSum, h2h);
            const { oddOver05HT, oddBtts, bm } = extractHtBttsOdds(g);

            if (scoreHT >= 62 && oddOver05HT) {
              const ok = await persistHtBttsSignal(sb, g, matchId, "Over 0.5 HT", scoreHT, oddOver05HT, indHT, bm);
              if (ok) { approved++; console.log(`[sm-punter htbtts] APROVADO Over 0.5 HT score=${scoreHT} odd=${oddOver05HT}`); }
            }
            if (scoreBTTS >= 62 && oddBtts) {
              const ok = await persistHtBttsSignal(sb, g, matchId, "BTTS Sim", scoreBTTS, oddBtts, indBTTS, bm);
              if (ok) { approved++; console.log(`[sm-punter htbtts] APROVADO BTTS Sim score=${scoreBTTS} odd=${oddBtts}`); }
            }
          }
        } catch (hbErr) {
          console.error(`[sm-punter htbtts] erro em ${g.home_team}:`, hbErr instanceof Error ? hbErr.message : hbErr);
        }
      } catch (err) {
        errors++;
        console.error(`[sm-punter] erro em ${g.home_team}:`, err instanceof Error ? err.message : err);
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        analyzed: games.length,
        approved,
        vetoed,
        errors,
        elapsed_ms: Date.now() - startedAt,
        results,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err: any) {
    console.error("[sm-punter] fatal:", err);
    return new Response(
      JSON.stringify({ success: false, error: err instanceof Error ? err.message : String(err) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
