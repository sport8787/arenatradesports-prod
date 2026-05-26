// =============================================================================
// HANDICAP ASIÁTICO — PRÉ-LIVE (versão final)
// Baseado em: confiança mínima 60%, linha por matchup (favorito)
// Espelha sinais aprovados em punter_analyses para o feed da Arena Punter
// =============================================================================

import { createClient } from 'npm:@supabase/supabase-js@2';
import { shadowCompare } from '../_shared/mycroft-rules-engine.ts';
import {
  getUpcomingFixturesSM,
  getRecentFixturesSM,
  getTeamStatsSM,
} from '../_shared/sportmonks-af-adapter.ts';
import { fetchSportmonksPrematchOdds } from '../_shared/sportmonksPrematchOdds.ts';
import {
  getAllowedLeagueIds,
  getOddsSportKeyMap,
  getLeagueTier,
  maxGamesForTier,
  type LeagueTier,
} from '../_shared/leaguesRegistry.ts';

// Fonte de dados: Sportmonks (Fase 2 — API-Football removida 18/05/2026)

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SVC_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const ODDS_API_KEY = Deno.env.get('THE_ODDS_API_KEY') || Deno.env.get('ODDS_API_KEY') || '';
const TELEGRAM_TOKEN = Deno.env.get('TELEGRAM_BOT_TOKEN');
const TELEGRAM_CHAT = Deno.env.get('TELEGRAM_CHAT_ID');

const supabase = createClient(SUPABASE_URL, SUPABASE_SVC_KEY);

type HALine = '-1.0' | '-0.75' | '-0.5' | '0.0' | '+0.5' | '+0.75' | '+1.0';
type HAType = 'NEGATIVO' | 'POSITIVO' | 'DNB';
type SignalStatus = 'SINAL_FORTE' | 'SINAL_BOM' | 'CUIDADO' | 'DESCARTADO';

// Whitelist e mapping de odds vêm dinamicamente do registry (tabela trader_leagues).
// HA só processa Tier A e B (Tier C cauda longa fica fora).
async function getAllowedHA(): Promise<{ ids: Set<number>; oddsMap: Record<number, string> }> {
  const [rows, oddsMap] = await Promise.all([getAllowedLeagueIds(), getOddsSportKeyMap()]);
  // Filtra só A/B
  const ab = new Set<number>();
  for (const id of rows) {
    const tier = await getLeagueTier(id);
    if (tier === 'A' || tier === 'B') ab.add(id);
  }
  return { ids: ab, oddsMap };
}
let _allowedCache: { ts: number; ids: Set<number>; oddsMap: Record<number, string> } | null = null;
async function getCachedAllowedHA() {
  if (_allowedCache && Date.now() - _allowedCache.ts < 30 * 60 * 1000) return _allowedCache;
  const r = await getAllowedHA();
  _allowedCache = { ts: Date.now(), ...r };
  return _allowedCache;
}

// =============================================================================
// HELPERS — Sportmonks via adapter
// =============================================================================

async function getUpcoming(): Promise<any[]> {
  const { ids: ALLOWED } = await getCachedAllowedHA();
  const ligasAF = Array.from(ALLOWED);
  const sm = await getUpcomingFixturesSM(ligasAF, 120);
  return sm.map((f) => ({
    fixture: { id: f.fixture.id, date: f.fixture.date, status: { short: 'NS' }, timestamp: f.fixture.timestamp },
    league: { id: f.league.id, name: f.league.name, season: f.league.season },
    teams: f.teams,
  }));
}

async function getTeamStats(teamId: number, _leagueId: number, _season: number) {
  return await getTeamStatsSM(teamId, 20);
}

async function getRecentFixtures(teamId: number, last = 12): Promise<any[]> {
  return await getRecentFixturesSM(teamId, last);
}

// =============================================================================
// ODDS — The Odds API + fallback API-Football
// =============================================================================

async function getOddsHA(homeTeam: string, awayTeam: string, leagueId: number, fixtureId: number) {
  const empty = { favOdd: null as number | null, undOdd: null as number | null, haOdds: {} as Partial<Record<HALine, number>> };
  const { oddsMap } = await getCachedAllowedHA();
  const sportKey = oddsMap[leagueId];

  if (sportKey && ODDS_API_KEY) {
    try {
      const url = `https://api.the-odds-api.com/v4/sports/${sportKey}/odds?apiKey=${ODDS_API_KEY}&regions=eu&markets=h2h,asian_handicap&oddsFormat=decimal`;
      const data = await (await fetch(url)).json() as any[];
      const game = Array.isArray(data) ? data.find((g: any) =>
        g.home_team?.toLowerCase().includes(homeTeam.split(' ')[0].toLowerCase()) ||
        g.away_team?.toLowerCase().includes(awayTeam.split(' ')[0].toLowerCase())
      ) : null;
      if (game) {
        let homeOdd: number | null = null, awayOdd: number | null = null;
        const haOdds: Partial<Record<HALine, number>> = {};
        for (const bm of game.bookmakers || []) {
          for (const mkt of bm.markets || []) {
            if (mkt.key === 'h2h') {
              const h = mkt.outcomes.find((o: any) => o.name === game.home_team);
              const a = mkt.outcomes.find((o: any) => o.name === game.away_team);
              if (h && !homeOdd) homeOdd = h.price;
              if (a && !awayOdd) awayOdd = a.price;
            }
            if (mkt.key === 'asian_handicap') {
              for (const o of mkt.outcomes || []) {
                const pt = o.point;
                const lineMap: Record<number, HALine> = {
                  0: '0.0', 0.5: '+0.5', 0.75: '+0.75', 1: '+1.0',
                  '-0.5': '-0.5' as any, '-0.75': '-0.75' as any, '-1': '-1.0' as any,
                };
                // Cobre ambos sinais
                const lineMapNum: Record<string, HALine> = {
                  '0': '0.0', '0.5': '+0.5', '0.75': '+0.75', '1': '+1.0',
                  '-0.5': '-0.5', '-0.75': '-0.75', '-1': '-1.0',
                };
                const line = lineMapNum[String(pt)];
                if (line && !haOdds[line]) haOdds[line] = o.price;
              }
            }
          }
          if (homeOdd && awayOdd) break;
        }
        if (homeOdd && awayOdd) return { favOdd: Math.min(homeOdd, awayOdd), undOdd: Math.max(homeOdd, awayOdd), haOdds };
      }
    } catch (e) { console.warn('[HA] Odds API erro, indo p/ fallback', e); }
  }

  const smOdds = await fetchSportmonksPrematchOdds(fixtureId);
  const homeOdd = smOdds['Casa'] ?? null;
  const awayOdd = smOdds['Fora'] ?? null;
  if (homeOdd && awayOdd) {
    const haOdds: Partial<Record<HALine, number>> = {};
    for (const line of ['-1.0', '-0.75', '-0.5', '0.0', '+0.5', '+0.75', '+1.0'] as HALine[]) {
      const homeKey = `AH Casa ${line}`;
      const awayKey = `AH Fora ${line}`;
      haOdds[line] = smOdds[homeKey] ?? smOdds[awayKey] ?? null ?? undefined;
    }
    return { favOdd: Math.min(homeOdd, awayOdd), undOdd: Math.max(homeOdd, awayOdd), haOdds };
  }

  // API-Football removida (Fase 2). Sem odds reais → sinal não gerado.
  return empty;
}

// =============================================================================
// LINHA POR ODD DO FAVORITO (matchup table)
// =============================================================================

function getLinhaPorOddFavorito(favOdd: number, isFavorito: boolean): { linha: HALine; tipo: HAType } {
  let linha: HALine;
  if (favOdd <= 1.30) linha = '-1.0';
  else if (favOdd <= 1.60) linha = '-0.75';
  else if (favOdd <= 1.80) linha = '-0.5';
  else linha = '0.0';

  if (isFavorito) return { linha, tipo: 'NEGATIVO' };
  const invert: Record<string, HALine> = {
    '-1.0': '+1.0', '-0.75': '+0.75', '-0.5': '+0.5', '0.0': '0.0',
  };
  return { linha: invert[linha], tipo: 'POSITIVO' };
}

// =============================================================================
// CONFIANÇA (score)
// =============================================================================

function calcConfianca(
  favOdd: number,
  win2Rate: number,
  gsUnd: number,
  derrotasUndRate: number,
  semMarcarUndRate: number
): number {
  let conf = 50;

  if (favOdd <= 1.30) conf += 20;
  else if (favOdd <= 1.50) conf += 15;
  else if (favOdd <= 1.70) conf += 10;
  else if (favOdd <= 1.90) conf += 5;

  if (win2Rate >= 60) conf += 15;
  else if (win2Rate >= 45) conf += 10;
  else if (win2Rate >= 30) conf += 5;
  else if (win2Rate >= 0 && win2Rate < 25) conf -= 10;

  if (gsUnd >= 1.8) conf += 12;
  else if (gsUnd >= 1.2) conf += 6;
  else if (gsUnd <= 0.7) conf -= 10;

  if (derrotasUndRate >= 60) conf += 12;
  else if (derrotasUndRate >= 40) conf += 6;
  else if (derrotasUndRate <= 20) conf -= 8;

  if (semMarcarUndRate >= 40) conf += 10;
  else if (semMarcarUndRate >= 25) conf += 5;

  return Math.min(100, Math.max(0, Math.round(conf)));
}

function getStatus(score: number): SignalStatus {
  if (score >= 80) return 'SINAL_FORTE';
  if (score >= 60) return 'SINAL_BOM';
  if (score >= 50) return 'CUIDADO';
  return 'DESCARTADO';
}

function getCategoria(score: number): 'A' | 'B' | 'C' {
  if (score >= 80) return 'A';
  if (score >= 65) return 'B';
  return 'C';
}

function descLiquidacao(linha: HALine, teamName: string): string {
  const map: Record<HALine, string> = {
    '-1.0': `${teamName} vence por 2+ → GREEN | Vence por 1 → REEMBOLSO | Empata/Perde → RED`,
    '-0.75': `${teamName} vence por 2+ → GREEN | Vence por 1 → MEIO GREEN + MEIO REEMBOLSO | Empata/Perde → RED`,
    '-0.5': `${teamName} vence → GREEN | Empata/Perde → RED`,
    '0.0': `${teamName} vence → GREEN | Empata → REEMBOLSO | Perde → RED`,
    '+0.5': `${teamName} vence/empata → GREEN | Perde → RED`,
    '+0.75': `${teamName} vence/empata → GREEN | Perde por 1 → MEIO RED + MEIO REEMBOLSO | Perde por 2+ → RED`,
    '+1.0': `${teamName} vence/empata → GREEN | Perde por 1 → REEMBOLSO | Perde por 2+ → RED`,
  };
  return map[linha];
}

// =============================================================================
// ANÁLISE PRINCIPAL
// =============================================================================

async function analisarJogo(fixture: any): Promise<any | null> {
  const { fixture: fix, league, teams } = fixture;
  const { ids: ALLOWED } = await getCachedAllowedHA();
  if (!ALLOWED.has(league.id)) return null;

  const oddsData = await getOddsHA(teams.home.name, teams.away.name, league.id, fix.id);
  if (!oddsData.favOdd || !oddsData.undOdd) return null;
  if (oddsData.favOdd > 2.20) return null;

  const isFavHome = oddsData.favOdd < oddsData.undOdd;
  const favTeamId = isFavHome ? teams.home.id : teams.away.id;
  const undTeamId = isFavHome ? teams.away.id : teams.home.id;

  const [statsFav, statsUnd, fixFav, fixUnd] = await Promise.all([
    getTeamStats(favTeamId, league.id, league.season),
    getTeamStats(undTeamId, league.id, league.season),
    getRecentFixtures(favTeamId, 12),
    getRecentFixtures(undTeamId, 12),
  ]);
  if (!statsFav || !statsUnd) return null;

  const localFav = isFavHome ? 'home' : 'away';
  const jogosLocalFav = isFavHome ? statsFav.fixtures.played.home : statsFav.fixtures.played.away;
  if (jogosLocalFav < 5) return null;

  const favFixturesLocal = fixFav.filter((f: any) =>
    f.goals.home !== null && (localFav === 'home' ? f.teams.home.id === favTeamId : f.teams.away.id === favTeamId)
  ).slice(0, 10);
  let win2Rate = 0;
  if (favFixturesLocal.length >= 4) {
    const wins2 = favFixturesLocal.filter((f: any) => {
      const gF = localFav === 'home' ? f.goals.home : f.goals.away;
      const gC = localFav === 'home' ? f.goals.away : f.goals.home;
      return gF - gC >= 2;
    });
    win2Rate = Math.round((wins2.length / favFixturesLocal.length) * 100);
  }

  const localUnd = isFavHome ? 'away' : 'home';
  let gsUnd = parseFloat(localUnd === 'home' ? statsUnd.goals.against.average.home : statsUnd.goals.against.average.away);
  if (isNaN(gsUnd)) gsUnd = 1.2;

  const undFixtures = fixUnd.filter((f: any) =>
    f.goals.home !== null && (localUnd === 'home' ? f.teams.home.id === undTeamId : f.teams.away.id === undTeamId)
  ).slice(0, 5);
  let derrotasUndRate = 0;
  let semMarcarUndRate = 0;
  if (undFixtures.length >= 3) {
    const derrotas = undFixtures.filter((f: any) => {
      const gU = localUnd === 'home' ? f.goals.home : f.goals.away;
      const gO = localUnd === 'home' ? f.goals.away : f.goals.home;
      return gU < gO;
    });
    derrotasUndRate = Math.round((derrotas.length / undFixtures.length) * 100);

    const semGol = undFixtures.filter((f: any) => {
      const gU = localUnd === 'home' ? f.goals.home : f.goals.away;
      return gU === 0;
    });
    semMarcarUndRate = Math.round((semGol.length / undFixtures.length) * 100);
  }

  const confianca = calcConfianca(oddsData.favOdd, win2Rate, gsUnd, derrotasUndRate, semMarcarUndRate);
  if (confianca < 60) return null;

  const { linha, tipo } = getLinhaPorOddFavorito(oddsData.favOdd, true);
  const oddHA = oddsData.haOdds[linha] ?? null;

  // Filtro range odd HA aceitável
  if (!oddHA || oddHA < 1.80 || oddHA > 2.20) return null;

  const status = getStatus(confianca);
  if (status === 'DESCARTADO') return null;

  const teamName = tipo === 'NEGATIVO'
    ? (isFavHome ? teams.home.name : teams.away.name)
    : (isFavHome ? teams.away.name : teams.home.name);

  return {
    fixtureId: fix.id,
    homeTeam: teams.home.name,
    awayTeam: teams.away.name,
    leagueId: league.id,
    leagueName: league.name,
    matchDate: fix.date,
    isFavHome,
    favOdd: oddsData.favOdd,
    undOdd: oddsData.undOdd,
    linhaRecomendada: linha,
    haType: tipo,
    scoreHA: confianca,
    statusHA: status,
    categoria: getCategoria(confianca),
    oddHA,
    teamAlvo: teamName,
    liquidacao: descLiquidacao(linha, teamName),
    indicadores: {
      win2_rate: win2Rate,
      gs_und: gsUnd,
      derrotas_und_rate: derrotasUndRate,
      sem_marcar_und_rate: semMarcarUndRate,
    },
  };
}

// =============================================================================
// PERSISTÊNCIA — sinais_handicap_prelive + mirror em punter_analyses
// =============================================================================

async function salvarSinal(s: any) {
  const { data: ex } = await supabase
    .from('sinais_handicap_prelive')
    .select('id')
    .eq('fixture_id', String(s.fixtureId))
    .eq('linha', s.linhaRecomendada)
    .maybeSingle();

  const baseRow = {
    fixture_id: String(s.fixtureId),
    home_team: s.homeTeam,
    away_team: s.awayTeam,
    league_id: s.leagueId,
    league_name: s.leagueName,
    match_date: s.matchDate,
    favorito: s.haType === 'NEGATIVO' ? s.teamAlvo : (s.isFavHome ? s.homeTeam : s.awayTeam),
    underdog: s.haType === 'POSITIVO' ? s.teamAlvo : (s.isFavHome ? s.awayTeam : s.homeTeam),
    fav_odd: s.favOdd,
    und_odd: s.undOdd,
    linha: s.linhaRecomendada,
    ha_type: s.haType,
    score_ha: s.scoreHA,
    status_ha: s.statusHA,
    odd_ha: s.oddHA,
    liquidacao: s.liquidacao,
    indicadores: s.indicadores,
  };

  if (ex) {
    await supabase.from('sinais_handicap_prelive').update({
      score_ha: s.scoreHA,
      status_ha: s.statusHA,
      odd_ha: s.oddHA,
      indicadores: s.indicadores,
      liquidacao: s.liquidacao,
    }).eq('id', ex.id);
  } else {
    await supabase.from('sinais_handicap_prelive').insert(baseRow);
  }

  // === ESPELHA em punter_analyses (somente sinais aprovados) ===
  if (s.statusHA === 'SINAL_FORTE' || s.statusHA === 'SINAL_BOM') {
    try {
      const teamSide = s.haType === 'POSITIVO'
        ? (s.isFavHome ? 'Visitante' : 'Casa')
        : (s.isFavHome ? 'Casa' : 'Visitante');
      const marketLabel = `HA ${teamSide} ${s.linhaRecomendada}`;
      const matchIdStd = `ha-${s.fixtureId}-${s.linhaRecomendada}`;

      const justificativa = `📊 Categoria: ${s.categoria} | Score: ${s.scoreHA}/100 (${s.statusHA})\n` +
        `🎯 Linha: HA ${s.linhaRecomendada} ao ${s.teamAlvo}\n` +
        `💹 Odd HA: ${s.oddHA?.toFixed(2)} | Fav Odd: ${s.favOdd?.toFixed(2)}\n\n` +
        `📈 Indicadores:\n` +
        `• Vitórias por 2+ gols (favorito): ${s.indicadores.win2_rate}%\n` +
        `• Gols sofridos médios (underdog): ${s.indicadores.gs_und?.toFixed(2)}\n` +
        `• % derrotas underdog (últ 5): ${s.indicadores.derrotas_und_rate}%\n` +
        `• % jogos sem marcar (underdog): ${s.indicadores.sem_marcar_und_rate}%\n\n` +
        `⚖️ Liquidação: ${s.liquidacao}`;

      const { data: existing } = await supabase
        .from('punter_analyses')
        .select('id')
        .eq('match_id', matchIdStd)
        .eq('market', marketLabel)
        .maybeSingle();

      const payload: any = {
        match_id: matchIdStd,
        home_team: s.homeTeam,
        away_team: s.awayTeam,
        league: s.leagueName,
        commence_time: s.matchDate,
        market: marketLabel,
        bookmaker: 'handicap-asiatico-prelive',
        odd: s.oddHA,
        verdict: 'APROVADO',
        confidence: Math.round(s.scoreHA),
        thesis: `HA ${s.linhaRecomendada} no ${s.teamAlvo} | Cat ${s.categoria}`,
        analysis: justificativa,
        analyzed_by: 'handicap-asiatico',
      };

      if (existing) {
        await supabase.from('punter_analyses').update(payload).eq('id', existing.id);
      } else {
        await supabase.from('punter_analyses').insert(payload);
      }

      // === ESPELHA também em punter_sinais (feed /punter) ===
      try {
        const sinaisPayload: any = {
          match_id: matchIdStd,
          home_team: s.homeTeam,
          away_team: s.awayTeam,
          league: s.leagueName,
          commence_time: s.matchDate,
          market: marketLabel,
          bookmaker: 'handicap-asiatico-prelive',
          odd: s.oddHA,
          verdict: 'APROVADO',
          confidence: Math.round(s.scoreHA),
          thesis: `HA ${s.linhaRecomendada} no ${s.teamAlvo} | Cat ${s.categoria}`,
          analysis: justificativa,
          analyzed_by: 'handicap-asiatico',
          status: 'pending',
        };
        const { data: existingSinal } = await supabase
          .from('punter_sinais')
          .select('id')
          .eq('match_id', matchIdStd)
          .eq('market', marketLabel)
          .maybeSingle();
        if (existingSinal) {
          await supabase.from('punter_sinais').update(sinaisPayload).eq('id', existingSinal.id);
        } else {
          await supabase.from('punter_sinais').insert(sinaisPayload);
        }
      } catch (e) {
        console.error('[HA] mirror punter_sinais err', e);
      }
    } catch (e) {
      console.error('[HA] mirror punter_analyses err', e);
    }
  }

  // ─── SHADOW MODE: motor de regras dinâmicas (modo trader pré-live) ───
  try {
    await shadowCompare({
      sb: supabase,
      modo: 'trader',
      source_function: 'handicap-asiatico-prelive',
      match_id: `ha-${s.fixtureId}-${s.linhaRecomendada}`,
      fixture_id: String(s.fixtureId ?? ''),
      mercado: `HA ${s.linhaRecomendada}`,
      home_team: s.homeTeam,
      away_team: s.awayTeam,
      league: s.leagueName,
      odd: s.oddHA ?? undefined,
      stats: {
        score_ha: Number(s.scoreHA ?? 0),
        fav_odd: Number(s.favOdd ?? 0),
        und_odd: Number(s.undOdd ?? 0),
        odd_ha: Number(s.oddHA ?? 0),
        win2_rate: Number(s.indicadores?.win2_rate ?? 0),
        gs_und: Number(s.indicadores?.gs_und ?? 0),
        derrotas_und_rate: Number(s.indicadores?.derrotas_und_rate ?? 0),
        sem_marcar_und_rate: Number(s.indicadores?.sem_marcar_und_rate ?? 0),
      },
      verdicto_atual: s.statusHA,
      score_atual: Number(s.scoreHA ?? 0),
      data_jogo: s.matchDate,
    });
  } catch (e) { console.warn('[shadowMode] HA prelive falhou:', (e as Error).message); }
}

async function notificarTelegram(s: any) {
  if (!TELEGRAM_TOKEN || !TELEGRAM_CHAT) return;
  const hora = new Date(s.matchDate).toLocaleTimeString('pt-BR', { timeZone: 'America/Recife', hour: '2-digit', minute: '2-digit' });
  const msg = `🎯 *HANDICAP ASIÁTICO* (Cat ${s.categoria})\n━━━━━━━━━━━━━━━━━━\n⚽ *${s.homeTeam}* x *${s.awayTeam}*\n🏆 ${s.leagueName}\n🕐 ${hora} BRT\n\n📌 *Linha:* HA ${s.linhaRecomendada} ao *${s.teamAlvo}*\n💹 *Odd HA:* ${s.oddHA.toFixed(2)}\n🎯 *Confiança:* ${s.scoreHA}% — ${s.statusHA}\n\n⚖️ ${s.liquidacao}\n\n🏦 *Executar na Betfair Exchange ou Betano*`;
  try {
    await fetch(`https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: TELEGRAM_CHAT, text: msg, parse_mode: 'Markdown' }),
    });
  } catch (e) { console.error('[HA] Telegram err', e); }
}

// =============================================================================
// HANDLER
// =============================================================================

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  const start = Date.now();
  try {
    // data_source ignorado — Sportmonks fixo (Fase 2)
    try { await req.json(); } catch { /* sem body */ }
    console.log(`[HA] data_source=sportmonks (Fase 2)`);

    const fixtures = await getUpcoming();
    const resultados: any[] = [];

    for (let i = 0; i < fixtures.length; i += 3) {
      const batch = fixtures.slice(i, i + 3);
      const analises = await Promise.allSettled(batch.map((f) => analisarJogo(f)));
      for (const r of analises) {
        if (r.status === 'fulfilled' && r.value) resultados.push(r.value);
      }
      if (i + 3 < fixtures.length) await new Promise((r) => setTimeout(r, 4000));
    }

    for (const s of resultados) await salvarSinal(s);

    const aprovados = resultados.filter((s) => ['SINAL_FORTE', 'SINAL_BOM'].includes(s.statusHA));
    const top = aprovados.sort((a, b) => b.scoreHA - a.scoreHA).slice(0, 4);
    // 🔒 Envio de sinais de Handicap Asiático ao Telegram desativado temporariamente
    // (em validação — feature exclusiva de admin no painel). Reativar removendo o early-return abaixo.
    const AH_TELEGRAM_ENABLED = false;
    if (AH_TELEGRAM_ENABLED) {
      for (const s of top) await notificarTelegram(s);
    } else {
      console.log(`[HA] 🔇 Telegram desativado — ${top.length} sinais TOP não enviados (apenas salvos no DB)`);
    }

    return new Response(JSON.stringify({
      success: true,
      jogos_analisados: fixtures.length,
      sinais_gerados: resultados.length,
      aprovados: aprovados.length,
      notificados: top.length,
      duracao_segundos: ((Date.now() - start) / 1000).toFixed(1),
      sinais: aprovados.map((a) => ({
        fixture_id: a.fixtureId,
        match: `${a.homeTeam} x ${a.awayTeam}`,
        linha: a.linhaRecomendada,
        team_alvo: a.teamAlvo,
        odd_ha: a.oddHA,
        score: a.scoreHA,
        categoria: a.categoria,
        status: a.statusHA,
      })),
    }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  } catch (err) {
    console.error('[HA] handler err', err);
    return new Response(JSON.stringify({ success: false, error: String(err) }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
