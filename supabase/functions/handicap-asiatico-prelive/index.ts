// =============================================================================
// PLANO HANDICAP ASIÁTICO — PRE-LIVE (MYCROFT PUNTER)
// Análise de oportunidades em HA usando API-Football + The Odds API + OpenAI
// Mercados: HA -1.5 | -1.25 | -1.0 | 0.0 | +1.0 | +1.25 | +1.5
// =============================================================================

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SVC_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const API_FOOTBALL_KEY = Deno.env.get('API_FOOTBALL_KEY')!;
const ODDS_API_KEY = Deno.env.get('THE_ODDS_API_KEY')!;
const OPENAI_API_KEY = Deno.env.get('OPENAI_API_KEY')!;
const TELEGRAM_TOKEN = Deno.env.get('TELEGRAM_BOT_TOKEN');
const TELEGRAM_CHAT = Deno.env.get('TELEGRAM_CHAT_ID');

const supabase = createClient(SUPABASE_URL, SUPABASE_SVC_KEY);
const AF_BASE = 'https://v3.football.api-sports.io';

type HALine = '-1.5' | '-1.25' | '-1.0' | '0.0' | '+1.0' | '+1.25' | '+1.5';
type HAType = 'NEGATIVO' | 'POSITIVO' | 'DNB';
type SignalStatus = 'SINAL_FORTE' | 'SINAL_BOM' | 'CUIDADO' | 'DESCARTADO';

const LIGAS_PERMITIDAS = new Set([
  71, 72, 39, 40, 140, 135, 78, 79, 61, 94, 203, 144, 88, 179, 253, 262, 197, 307,
]);
const LIGAS_PARELHAS = new Set([71, 72, 253, 262, 203]);
const LIGAS_ODDS_MAP: Record<number, string> = {
  39: 'soccer_epl',
  140: 'soccer_spain_la_liga',
  135: 'soccer_italy_serie_a',
  78: 'soccer_germany_bundesliga',
  61: 'soccer_france_ligue_one',
  71: 'soccer_brazil_campeonato',
  88: 'soccer_netherlands_eredivisie',
  94: 'soccer_portugal_primeira_liga',
};

async function afFetch(path: string, params: Record<string, string | number>) {
  const url = new URL(`${AF_BASE}${path}`);
  Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, String(v)));
  const r = await fetch(url.toString(), { headers: { 'x-apisports-key': API_FOOTBALL_KEY } });
  if (!r.ok) throw new Error(`AF ${path} → ${r.status}`);
  const d = await r.json();
  return d.response;
}

async function getUpcoming(): Promise<any[]> {
  const now = new Date();
  const d1 = now.toISOString().split('T')[0];
  const d2 = new Date(now.getTime() + 24 * 3600 * 1000).toISOString().split('T')[0];
  const dates = d1 === d2 ? [d1] : [d1, d2];
  const horizonMs = now.getTime() + 24 * 3600 * 1000;
  const all: any[] = [];
  const seen = new Set<number>();
  for (const date of dates) {
    try {
      const resp = await afFetch('/fixtures', { date, timezone: 'America/Recife' });
      for (const f of resp || []) {
        const lid = f?.league?.id;
        const fid = f?.fixture?.id;
        const ts = f?.fixture?.timestamp ? f.fixture.timestamp * 1000 : new Date(f?.fixture?.date).getTime();
        const status = f?.fixture?.status?.short;
        if (!LIGAS_PERMITIDAS.has(lid)) continue;
        if (status && status !== 'NS' && status !== 'TBD') continue;
        if (ts < now.getTime() || ts > horizonMs) continue;
        if (seen.has(fid)) continue;
        seen.add(fid);
        all.push(f);
      }
    } catch (e) {
      console.error('[HA] getUpcoming err', date, e);
    }
  }
  console.log(`[HA] upcoming filtrados: ${all.length} (de ${dates.length} datas)`);
  return all;
}

async function getTeamStats(teamId: number, leagueId: number, season: number) {
  try {
    return await afFetch('/teams/statistics', { team: teamId, league: leagueId, season });
  } catch {
    return null;
  }
}

async function getRecentFixtures(teamId: number, last = 12): Promise<any[]> {
  try {
    return await afFetch('/fixtures', { team: teamId, last });
  } catch {
    return [];
  }
}

async function getH2H(h: number, a: number, last = 6): Promise<any[]> {
  try {
    return await afFetch('/fixtures/headtohead', { h2h: `${h}-${a}`, last });
  } catch {
    return [];
  }
}

async function getOddsAF(fixtureId: number) {
  const empty = { favOdd: null as number | null, undOdd: null as number | null, haOdds: {} as Partial<Record<HALine, number>> };
  try {
    const resp = await afFetch('/odds', { fixture: fixtureId });
    if (!resp || !resp.length) return empty;
    let homeOdd: number | null = null;
    let awayOdd: number | null = null;
    const haOdds: Partial<Record<HALine, number>> = {};
    const lineMap: Record<string, HALine> = {
      '0': '0.0', '0.0': '0.0',
      '1': '+1.0', '1.0': '+1.0', '+1': '+1.0', '+1.0': '+1.0',
      '1.25': '+1.25', '+1.25': '+1.25',
      '1.5': '+1.5', '+1.5': '+1.5',
      '-1': '-1.0', '-1.0': '-1.0',
      '-1.25': '-1.25',
      '-1.5': '-1.5',
    };
    for (const item of resp) {
      for (const bm of item.bookmakers || []) {
        for (const bet of bm.bets || []) {
          const name = (bet.name || '').toLowerCase();
          if (name === 'match winner' || name === '1x2' || name === 'full time result') {
            for (const v of bet.values || []) {
              const val = String(v.value).toLowerCase();
              const odd = parseFloat(v.odd);
              if ((val === 'home' || val === '1') && !homeOdd) homeOdd = odd;
              if ((val === 'away' || val === '2') && !awayOdd) awayOdd = odd;
            }
          }
          if (name.includes('asian handicap') || name === 'handicap') {
            for (const v of bet.values || []) {
              const m = String(v.value).match(/(home|away)\s*\(?(-?\+?\d+(?:\.\d+)?)\)?/i);
              if (!m) continue;
              const side = m[1].toLowerCase();
              const num = parseFloat(m[2]);
              const adj = side === 'away' ? -num : num;
              const key = adj > 0 ? '+' + adj.toString() : adj.toString();
              const line = lineMap[key];
              if (line && !haOdds[line]) haOdds[line] = parseFloat(v.odd);
            }
          }
        }
        if (homeOdd && awayOdd) break;
      }
    }
    if (!homeOdd || !awayOdd) return empty;
    return { favOdd: Math.min(homeOdd, awayOdd), undOdd: Math.max(homeOdd, awayOdd), haOdds };
  } catch (e) {
    console.error('[HA] getOddsAF err', fixtureId, e);
    return empty;
  }
}

async function getOddsHA(homeTeam: string, awayTeam: string, leagueId: number, fixtureId: number) {
  const sportKey = LIGAS_ODDS_MAP[leagueId];
  const empty = { favOdd: null as number | null, undOdd: null as number | null, haOdds: {} as Partial<Record<HALine, number>> };
  if (!sportKey) return await getOddsAF(fixtureId);

  try {
    const url = `https://api.the-odds-api.com/v4/sports/${sportKey}/odds?apiKey=${ODDS_API_KEY}&regions=eu&markets=h2h,asian_handicap&oddsFormat=decimal`;
    const data = (await (await fetch(url)).json()) as any[];
    const game = data.find(
      (g: any) =>
        g.home_team?.toLowerCase().includes(homeTeam.toLowerCase().split(' ')[0]) ||
        g.away_team?.toLowerCase().includes(awayTeam.toLowerCase().split(' ')[0]),
    );
    if (!game) return empty;

    let homeOdd: number | null = null;
    let awayOdd: number | null = null;
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
            const lineMap: Record<number, HALine> = {
              0: '0.0', 1: '+1.0', 1.25: '+1.25', 1.5: '+1.5',
              [-1]: '-1.0', [-1.25]: '-1.25', [-1.5]: '-1.5',
            };
            const line = lineMap[o.point];
            if (line && !haOdds[line]) haOdds[line] = o.price;
          }
        }
      }
      if (homeOdd && awayOdd) break;
    }

    if (!homeOdd || !awayOdd) return empty;
    return { favOdd: Math.min(homeOdd, awayOdd), undOdd: Math.max(homeOdd, awayOdd), haOdds };
  } catch {
    return empty;
  }
}

function calcRate(fixtures: any[], teamId: number, local: 'home' | 'away', diff: number, last = 10): number {
  const jogos = fixtures
    .filter((f) => f.goals.home !== null && (local === 'home' ? f.teams.home.id === teamId : f.teams.away.id === teamId))
    .slice(0, last);
  if (jogos.length < 4) return -1;
  const matches = jogos.filter((f) => {
    const gF = local === 'home' ? f.goals.home ?? 0 : f.goals.away ?? 0;
    const gC = local === 'home' ? f.goals.away ?? 0 : f.goals.home ?? 0;
    return diff >= 0 ? gF - gC >= diff : gC - gF >= -diff;
  });
  return Math.round((matches.length / jogos.length) * 100);
}

function calcFormRate(fixtures: any[], teamId: number, local: 'home' | 'away', last = 5): number {
  const jogos = fixtures
    .filter((f) => f.goals.home !== null && (local === 'home' ? f.teams.home.id === teamId : f.teams.away.id === teamId))
    .slice(0, last);
  if (jogos.length < 3) return -1;
  const wins = jogos.filter((f) => {
    const gF = local === 'home' ? f.goals.home ?? 0 : f.goals.away ?? 0;
    const gC = local === 'home' ? f.goals.away ?? 0 : f.goals.home ?? 0;
    return gF > gC;
  });
  return Math.round((wins.length / jogos.length) * 100);
}

function calcCSRate(stats: any, local: 'home' | 'away'): number {
  const cs = local === 'home' ? stats.clean_sheet.home : stats.clean_sheet.away;
  const j = local === 'home' ? stats.fixtures.played.home : stats.fixtures.played.away;
  return j > 0 ? Math.round((cs / j) * 100) : 0;
}

function perdeuUltimos2(fixtures: any[], teamId: number, local: 'home' | 'away'): boolean {
  const jogos = fixtures
    .filter((f) => f.goals.home !== null && (local === 'home' ? f.teams.home.id === teamId : f.teams.away.id === teamId))
    .slice(0, 3);
  if (jogos.length < 3) return false;
  const perdas = jogos.filter((f) => {
    const gF = local === 'home' ? f.goals.home ?? 0 : f.goals.away ?? 0;
    const gC = local === 'home' ? f.goals.away ?? 0 : f.goals.home ?? 0;
    return gF < gC;
  });
  return perdas.length >= 2;
}

function calcScoreHANeg(statsFav: any, statsUnd: any, fixFav: any[], fixUnd: any[], h2h: any[], favIsHome: boolean, favTeamId: number, undTeamId: number, oddHA: number | null, leagueId: number, ind: Record<string, number>): number {
  let s = 40;
  const fL = favIsHome ? 'home' : 'away';
  const uL = favIsHome ? 'away' : 'home';

  const w2 = calcRate(fixFav, favTeamId, fL, 2);
  ind.win2plus_fav = w2;
  if (w2 >= 60) s += 22; else if (w2 >= 45) s += 14; else if (w2 >= 30) s += 6; else if (w2 >= 0 && w2 < 25) s -= 20;

  const gmFav = favIsHome ? parseFloat(statsFav.goals.for.average.home) : parseFloat(statsFav.goals.for.average.away);
  ind.gm_fav = gmFav;
  if (gmFav >= 2.5) s += 18; else if (gmFav >= 1.8) s += 10; else if (gmFav < 1.3) s -= 15;

  const w3 = calcRate(fixFav, favTeamId, fL, 3);
  ind.win3plus_fav = w3;
  if (w3 >= 30) s += 12;

  const formFav = calcFormRate(fixFav, favTeamId, fL, 5);
  ind.form_fav = formFav;
  if (formFav >= 80) s += 10; else if (formFav >= 60) s += 5; else if (formFav >= 0 && formFav <= 20) s -= 15;

  const gsUnd = favIsHome ? parseFloat(statsUnd.goals.against.average.away) : parseFloat(statsUnd.goals.against.average.home);
  ind.gs_und = gsUnd;
  if (gsUnd >= 1.8) s += 15; else if (gsUnd >= 1.2) s += 8; else if (gsUnd <= 0.7) s -= 15;

  const csUnd = calcCSRate(statsUnd, uL);
  ind.cs_und = csUnd;
  if (csUnd >= 40) s -= 10;

  const l2und = calcRate(fixUnd, undTeamId, uL, -2);
  ind.lose2plus_und = l2und;
  if (l2und >= 50) s += 10; else if (l2und >= 0 && l2und <= 15) s -= 12;

  const h2hJogos = h2h.filter((f: any) => f.goals.home !== null);
  if (h2hJogos.length >= 3) {
    const h2hW2 = Math.round((h2hJogos.filter((f: any) => {
      const favHome = f.teams.home.id === favTeamId;
      const gF = favHome ? f.goals.home ?? 0 : f.goals.away ?? 0;
      const gC = favHome ? f.goals.away ?? 0 : f.goals.home ?? 0;
      return gF - gC >= 2;
    }).length / h2hJogos.length) * 100);
    ind.h2h_win2 = h2hW2;
    if (h2hW2 >= 70) s += 15; else if (h2hW2 >= 50) s += 10; else if (h2hW2 <= 20) s -= 10;
  }

  if (LIGAS_PARELHAS.has(leagueId)) s -= 10;
  if (oddHA) {
    if (oddHA >= 1.9) s += 10; else if (oddHA >= 1.7) s += 5; else if (oddHA < 1.5) s -= 8;
  }
  return Math.max(0, Math.min(100, Math.round(s)));
}

function calcScoreHAPos(statsFav: any, statsUnd: any, fixFav: any[], fixUnd: any[], h2h: any[], favIsHome: boolean, favTeamId: number, undTeamId: number, oddHA: number | null, leagueId: number, ind: Record<string, number>): number {
  let s = 40;
  const uL = favIsHome ? 'away' : 'home';
  const fL = favIsHome ? 'home' : 'away';

  const l2und = calcRate(fixUnd, undTeamId, uL, -2);
  ind.lose2plus_und_pos = l2und;
  if (l2und >= 0 && l2und <= 20) s += 20; else if (l2und <= 35) s += 10; else if (l2und >= 50) s -= 15;

  const csUnd = calcCSRate(statsUnd, uL);
  ind.cs_und_pos = csUnd;
  if (csUnd >= 30) s += 15; else if (csUnd >= 20) s += 8;

  const formUnd = calcFormRate(fixUnd, undTeamId, uL, 5);
  ind.form_und_pos = formUnd;
  if (formUnd >= 40) s += 10; else if (formUnd >= 0 && formUnd <= 10) s -= 8;

  const w2fav = calcRate(fixFav, favTeamId, fL, 2);
  ind.win2plus_fav_pos = w2fav;
  if (w2fav >= 0 && w2fav <= 30) s += 12; else if (w2fav >= 60) s -= 15;

  if (LIGAS_PARELHAS.has(leagueId)) s += 12;

  if (oddHA) {
    if (oddHA >= 1.75) s += 10; else if (oddHA >= 1.6) s += 5; else if (oddHA < 1.4) s -= 10;
  }
  return Math.max(0, Math.min(100, Math.round(s)));
}

function selecionarLinha(scoreNeg: number, scorePos: number, w2: number, w3: number, l2und: number): { linha: HALine; tipo: HAType; scoreBase: number } {
  if (scoreNeg >= scorePos && scoreNeg >= 50) {
    if (scoreNeg >= 80 && w3 >= 30) return { linha: '-1.5', tipo: 'NEGATIVO', scoreBase: scoreNeg };
    if (scoreNeg >= 70 && w2 >= 50) return { linha: '-1.25', tipo: 'NEGATIVO', scoreBase: scoreNeg };
    return { linha: '-1.0', tipo: 'NEGATIVO', scoreBase: scoreNeg };
  }
  if (scorePos >= 50) {
    if (scorePos >= 75 && l2und <= 15) return { linha: '+1.5', tipo: 'POSITIVO', scoreBase: scorePos };
    if (scorePos >= 60) return { linha: '+1.25', tipo: 'POSITIVO', scoreBase: scorePos };
    return { linha: '+1.0', tipo: 'POSITIVO', scoreBase: scorePos };
  }
  return { linha: '0.0', tipo: 'DNB', scoreBase: Math.max(scoreNeg, scorePos) };
}

function getStatus(score: number, tipo: HAType): SignalStatus {
  const threshold = tipo === 'NEGATIVO' ? 65 : 60;
  if (score >= threshold + 15) return 'SINAL_FORTE';
  if (score >= threshold) return 'SINAL_BOM';
  if (score >= threshold - 15) return 'CUIDADO';
  return 'DESCARTADO';
}

function descLiquidacao(linha: HALine, teamName: string): string {
  const map: Record<HALine, string> = {
    '-1.5': `${teamName} vence por 2+: GREEN | Vence por 1: RED | Empata/Perde: RED`,
    '-1.25': `${teamName} vence por 2+: GREEN | Vence por 1: MEIO RED + MEIO REEMBOLSO | Empata/Perde: RED`,
    '-1.0': `${teamName} vence por 2+: GREEN | Vence por 1: REEMBOLSO | Empata/Perde: RED`,
    '0.0': `${teamName} vence: GREEN | Empata: REEMBOLSO | Perde: RED`,
    '+1.0': `${teamName} vence/empata: GREEN | Perde por 1: REEMBOLSO | Perde por 2+: RED`,
    '+1.25': `${teamName} vence/empata: GREEN | Perde por 1: MEIO GREEN + MEIO REEMBOLSO | Perde por 2+: RED`,
    '+1.5': `${teamName} vence/empata/perde por 1: GREEN | Perde por 2+: RED`,
  };
  return map[linha];
}

async function analisarComOpenAI(analise: any): Promise<string> {
  try {
    const teamAlvo = analise.haType === 'POSITIVO'
      ? (analise.isFavHome ? analise.awayTeam : analise.homeTeam)
      : (analise.isFavHome ? analise.homeTeam : analise.awayTeam);

    const prompt = `Análise técnica de Handicap Asiático para apostadores profissionais.

JOGO: ${analise.homeTeam} vs ${analise.awayTeam} (${analise.leagueName})
RECOMENDAÇÃO: HA ${analise.linhaRecomendada} ao ${teamAlvo}
TIPO: ${analise.haType} | SCORE: ${analise.scoreHA}/100 | STATUS: ${analise.statusHA}
ODD HA: ${analise.oddHA ?? 'N/D'} | ODD FAV (1X2): ${analise.favOdd}

INDICADORES:
${Object.entries(analise.indicadores).map(([k, v]) => `- ${k}: ${v}`).join('\n')}

Forneça em até 4 linhas (português brasileiro):
1. Por que essa linha foi escolhida
2. Principal risco
3. Veredito final (entrar/aguardar)
Seja objetivo, técnico e direto. Sem emojis.`;

    const r = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        max_tokens: 250,
        temperature: 0.4,
        messages: [
          { role: 'system', content: 'Você é o Mycroft Punter, analista quantitativo de Handicap Asiático.' },
          { role: 'user', content: prompt },
        ],
      }),
    });
    if (!r.ok) {
      console.error('OpenAI error:', r.status, await r.text());
      return 'Análise IA indisponível.';
    }
    const data = await r.json();
    return data.choices?.[0]?.message?.content?.trim() ?? 'Análise IA indisponível.';
  } catch (e) {
    console.error('OpenAI exception:', e);
    return 'Análise IA indisponível.';
  }
}

async function analisarJogo(fixture: any): Promise<any | null> {
  const { fixture: fix, league, teams } = fixture;
  if (!LIGAS_PERMITIDAS.has(league.id)) return null;

  const oddsData = await getOddsHA(teams.home.name, teams.away.name, league.id);
  if (!oddsData.favOdd || !oddsData.undOdd) return null;
  if (oddsData.favOdd > 2.2) return null;

  const isFavHome = oddsData.favOdd < oddsData.undOdd;
  const favTeamId = isFavHome ? teams.home.id : teams.away.id;
  const undTeamId = isFavHome ? teams.away.id : teams.home.id;

  const [statsFav, statsUnd, fixFav, fixUnd, h2h] = await Promise.all([
    getTeamStats(favTeamId, league.id, league.season),
    getTeamStats(undTeamId, league.id, league.season),
    getRecentFixtures(favTeamId, 12),
    getRecentFixtures(undTeamId, 12),
    getH2H(teams.home.id, teams.away.id, 6),
  ]);

  if (!statsFav || !statsUnd) return null;

  const favLocal = isFavHome ? 'home' : 'away';
  const jogosLocal = isFavHome ? statsFav.fixtures.played.home : statsFav.fixtures.played.away;
  if (jogosLocal < 5) return null;
  if (perdeuUltimos2(fixFav, favTeamId, favLocal)) return null;

  const ind: Record<string, number> = {};
  const scoreNegBase = calcScoreHANeg(statsFav, statsUnd, fixFav, fixUnd, h2h, isFavHome, favTeamId, undTeamId, null, league.id, ind);
  const scorePosBase = calcScoreHAPos(statsFav, statsUnd, fixFav, fixUnd, h2h, isFavHome, favTeamId, undTeamId, null, league.id, ind);

  const w2 = ind.win2plus_fav ?? -1;
  const w3 = ind.win3plus_fav ?? -1;
  const l2 = ind.lose2plus_und_pos ?? -1;

  const { linha, tipo, scoreBase } = selecionarLinha(scoreNegBase, scorePosBase, w2, w3, l2);
  const oddHA = oddsData.haOdds[linha] ?? null;

  let scoreFinal = scoreBase;
  if (tipo === 'NEGATIVO') {
    scoreFinal = calcScoreHANeg(statsFav, statsUnd, fixFav, fixUnd, h2h, isFavHome, favTeamId, undTeamId, oddHA, league.id, ind);
  } else if (tipo === 'POSITIVO') {
    scoreFinal = calcScoreHAPos(statsFav, statsUnd, fixFav, fixUnd, h2h, isFavHome, favTeamId, undTeamId, oddHA, league.id, ind);
  }

  const status = getStatus(scoreFinal, tipo);
  if (status === 'DESCARTADO') return null;

  const teamName = tipo === 'POSITIVO'
    ? (isFavHome ? teams.away.name : teams.home.name)
    : (isFavHome ? teams.home.name : teams.away.name);

  const analise = {
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
    scoreHA: scoreFinal,
    statusHA: status,
    oddHA,
    liquidacao: descLiquidacao(linha, teamName),
    indicadores: ind,
    aiAnalysis: '',
  };

  if (status === 'SINAL_FORTE' || status === 'SINAL_BOM') {
    analise.aiAnalysis = await analisarComOpenAI(analise);
  }

  return analise;
}

async function salvarSinal(a: any, userId: string | null) {
  const { data: ex } = await supabase
    .from('sinais_handicap_prelive')
    .select('id')
    .eq('fixture_id', String(a.fixtureId))
    .eq('linha', a.linhaRecomendada)
    .maybeSingle();

  if (ex) {
    await supabase.from('sinais_handicap_prelive').update({
      score_ha: a.scoreHA,
      status_ha: a.statusHA,
      odd_ha: a.oddHA,
      indicadores: a.indicadores,
      ai_analysis: a.aiAnalysis,
    }).eq('id', ex.id);
    return;
  }

  await supabase.from('sinais_handicap_prelive').insert({
    user_id: userId,
    fixture_id: String(a.fixtureId),
    home_team: a.homeTeam,
    away_team: a.awayTeam,
    league_id: a.leagueId,
    league_name: a.leagueName,
    match_date: a.matchDate,
    favorito: a.isFavHome ? a.homeTeam : a.awayTeam,
    underdog: a.isFavHome ? a.awayTeam : a.homeTeam,
    fav_odd: a.favOdd,
    und_odd: a.undOdd,
    linha: a.linhaRecomendada,
    ha_type: a.haType,
    score_ha: a.scoreHA,
    status_ha: a.statusHA,
    odd_ha: a.oddHA,
    liquidacao: a.liquidacao,
    indicadores: a.indicadores,
    ai_analysis: a.aiAnalysis,
  });
}

async function notificarTelegram(a: any) {
  if (!TELEGRAM_TOKEN || !TELEGRAM_CHAT) return;
  const teamAlvo = a.haType === 'POSITIVO'
    ? (a.isFavHome ? a.awayTeam : a.homeTeam)
    : (a.isFavHome ? a.homeTeam : a.awayTeam);
  const hora = new Date(a.matchDate).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', timeZone: 'America/Recife' });
  const oddStr = a.oddHA ? a.oddHA.toFixed(2) : 'Verificar na casa';
  const msg = `🎯 *PLANO HANDICAP ASIÁTICO — PRÉ-LIVE*\n━━━━━━━━━━━━━━━━━━\n⚽ *${a.homeTeam}* x *${a.awayTeam}*\n🏆 ${a.leagueName}\n🕐 ${hora} BRT\n\n📌 *Linha:* HA ${a.linhaRecomendada} ao *${teamAlvo}*\n💹 *Odd HA:* ${oddStr}\n🎯 *Score:* ${a.scoreHA}/100 — ${a.statusHA}\n\n⚖️ ${a.liquidacao}\n\n🤖 ${a.aiAnalysis || ''}\n━━━━━━━━━━━━━━━━━━`;
  try {
    await fetch(`https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: TELEGRAM_CHAT, text: msg, parse_mode: 'Markdown' }),
    });
  } catch (e) {
    console.error('Telegram err', e);
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  const start = Date.now();
  try {
    let userId: string | null = null;
    const auth = req.headers.get('Authorization');
    if (auth) {
      const token = auth.replace('Bearer ', '');
      const { data } = await supabase.auth.getUser(token);
      userId = data.user?.id ?? null;
    }

    const fixtures = await getUpcoming();
    console.log(`[HA] ${fixtures.length} fixtures nas próximas 24h`);

    const resultados: any[] = [];
    for (let i = 0; i < fixtures.length; i += 3) {
      const lote = fixtures.slice(i, i + 3);
      const analises = await Promise.allSettled(lote.map((f) => analisarJogo(f)));
      for (const r of analises) {
        if (r.status === 'fulfilled' && r.value) resultados.push(r.value);
      }
      if (i + 3 < fixtures.length) await new Promise((r) => setTimeout(r, 4000));
    }

    for (const a of resultados) await salvarSinal(a, userId);

    const aprovados = resultados.filter((a) => ['SINAL_FORTE', 'SINAL_BOM'].includes(a.statusHA));
    const melhores = aprovados.sort((a, b) => b.scoreHA - a.scoreHA).slice(0, 4);
    for (const a of melhores) await notificarTelegram(a);

    const duracao = ((Date.now() - start) / 1000).toFixed(1);
    return new Response(
      JSON.stringify({
        success: true,
        jogos_analisados: resultados.length,
        aprovados: aprovados.length,
        notificados: melhores.length,
        duracao_segundos: duracao,
        sinais: resultados.map((a) => ({
          jogo: `${a.homeTeam} x ${a.awayTeam}`,
          liga: a.leagueName,
          horario: a.matchDate,
          linha: a.linhaRecomendada,
          tipo: a.haType,
          score: a.scoreHA,
          status: a.statusHA,
          odd_ha: a.oddHA,
          liquidacao: a.liquidacao,
          ai_analysis: a.aiAnalysis,
        })),
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  } catch (err) {
    console.error('[HA] crit:', err);
    return new Response(
      JSON.stringify({ success: false, error: err instanceof Error ? err.message : String(err) }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  }
});
