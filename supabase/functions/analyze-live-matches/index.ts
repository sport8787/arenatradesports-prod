import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import { logEdgeError } from "../_shared/logEdgeError.ts";
import { shadowCompare } from "../_shared/mycroft-rules-engine.ts";
import { getLiveStatsSM } from "../_shared/sportmonks-af-adapter.ts";
import { getFutoddsLive } from "../_shared/futoddsProvider.ts";
import { fetchFutoddsList } from "../_shared/futoddsCache.ts";
import { getCalibrationFloor, applyCalibrationFloor } from "../_shared/calibrationFloor.ts";
import { isBorderline, validateBorderline, ACTIVE_VERDICTS as BORDERLINE_ACTIVE } from "../_shared/borderlineAIValidator.ts";
import { resolveFallbackOdd } from "../_shared/estimateLiveOdd.ts";

// Cache de odds_live (Futodds /matches-live-full) por execução
let _futoddsOddsCache: { ts: number; list: any[] } | null = null;
async function getFutoddsOddsCached(maxAgeMs = 25_000): Promise<any[]> {
  const now = Date.now();
  if (_futoddsOddsCache && now - _futoddsOddsCache.ts < maxAgeMs) return _futoddsOddsCache.list;
  try {
    const list = await fetchFutoddsList("/matches-live-full", { ttlMs: 25_000 });
    _futoddsOddsCache = { ts: now, list: list || [] };
    return _futoddsOddsCache.list;
  } catch (e) {
    console.warn("[AnalyzeLive] futodds odds (live-full) fetch falhou:", (e as Error)?.message);
    _futoddsOddsCache = { ts: now, list: [] };
    return [];
  }
}

// Cache de fixtures Futodds por execução (1 chamada por loop)
let _futoddsLiveCache: { ts: number; fixtures: any[] } | null = null;
async function getFutoddsLiveCached(maxAgeMs = 25_000): Promise<any[]> {
  const now = Date.now();
  if (_futoddsLiveCache && now - _futoddsLiveCache.ts < maxAgeMs) {
    return _futoddsLiveCache.fixtures;
  }
  try {
    const r = await getFutoddsLive();
    _futoddsLiveCache = { ts: now, fixtures: r.fixtures || [] };
    return _futoddsLiveCache.fixtures;
  } catch (e) {
    console.warn("[AnalyzeLive] futodds live fetch falhou:", (e as Error)?.message);
    _futoddsLiveCache = { ts: now, fixtures: [] };
    return [];
  }
}

function _normTeam(s: string): string {
  return String(s || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9 ]/g, "").trim();
}
function _pairMatch(a: string, b: string): boolean {
  // Evita falso positivo com string vazia / nomes muito curtos.
  if (!a || !b || a.length < 4 || b.length < 4) return false;
  if (a === b) return true;
  // Inclusão só vale se a parte "menor" tiver pelo menos 4 chars (já garantido acima)
  // e representar pelo menos 60% da maior — evita "as" casando "as monaco".
  const longer = a.length >= b.length ? a : b;
  const shorter = a.length >= b.length ? b : a;
  if (!longer.includes(shorter)) return false;
  return shorter.length / longer.length >= 0.6;
}
function findFutoddsFixture(home: string, away: string, list: any[]): any | null {
  const h = _normTeam(home), a = _normTeam(away);
  if (!h || !a) return null;
  return list.find((f: any) => {
    const fh = _normTeam(f?.teams?.home?.name || "");
    const fa = _normTeam(f?.teams?.away?.name || "");
    return _pairMatch(fh, h) && _pairMatch(fa, a);
  }) || null;
}

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

// ============================================================
// FALLBACK GROK (xAI) — usado se a engine determinística falhar
// ============================================================
async function callGrokFallback(payload: any): Promise<any | null> {
  const GROK_API_KEY = Deno.env.get('GROK_API_KEY');
  if (!GROK_API_KEY) {
    console.warn('[AnalyzeLive][Grok] GROK_API_KEY não configurada — fallback desativado');
    return null;
  }
  const m = payload?.match || {};
  const stats = m.stats || {};
  const system = `Você é o Mycroft, analista frio de futebol ao vivo. Responda APENAS um JSON válido com este shape exato:
{"verdict":"APROVADO|APROVADO_SITUACIONAL|LABAREDA|AGUARDAR|CUIDADO|JOGO_MORTO","market":"string","plan_name":"string","confidence":0-100,"thesis":"string em pt-br","estimated_probability":0-1,"odd":number|null,"stake_pct":number|null}
Use no máximo 2 frases na thesis. NUNCA invente estatísticas.`;
  const user = `Jogo: ${m.home} ${m.scoreHome ?? 0} x ${m.scoreAway ?? 0} ${m.away}
Minuto: ${m.minute} (${m.period || '?'})
Campeonato: ${m.championship || '?'}
Stats: ${JSON.stringify(stats).slice(0, 2500)}
Mercados já aprovados: ${JSON.stringify(m.existingApprovedMarkets || []).slice(0, 500)}`;

  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 20_000);
    const r = await fetch('https://api.x.ai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${GROK_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'grok-2-latest',
        temperature: 0.2,
        response_format: { type: 'json_object' },
        messages: [
          { role: 'system', content: system },
          { role: 'user', content: user },
        ],
      }),
      signal: ctrl.signal,
    });
    clearTimeout(t);
    if (!r.ok) {
      const errText = await r.text();
      console.error('[AnalyzeLive][Grok] HTTP', r.status, errText.slice(0, 300));
      return null;
    }
    const j = await r.json();
    const content = j?.choices?.[0]?.message?.content;
    if (!content) {
      console.error('[AnalyzeLive][Grok] resposta sem content');
      return null;
    }
    let parsed: any;
    try { parsed = JSON.parse(content); } catch {
      const match = content.match(/\{[\s\S]*\}/);
      if (!match) { console.error('[AnalyzeLive][Grok] JSON inválido'); return null; }
      parsed = JSON.parse(match[0]);
    }
    // Normaliza campos esperados
    return {
      verdict: String(parsed.verdict || 'AGUARDAR').toUpperCase(),
      market: parsed.market || 'N/A',
      plan_name: parsed.plan_name || 'GROK FALLBACK',
      confidence: Number(parsed.confidence ?? 0),
      thesis: parsed.thesis || 'Fallback Grok sem tese.',
      estimated_probability: parsed.estimated_probability ?? null,
      odd: parsed.odd ?? null,
      stake_pct: parsed.stake_pct ?? null,
      ai_engine: 'grok-fallback',
    };
  } catch (e) {
    console.error('[AnalyzeLive][Grok] exceção:', (e as Error)?.message);
    return null;
  }
}


function getSupabaseAdmin() {
  return createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );
}

// Reanalysis intervals (ms) by status and minute range
// AJUSTE 11/05/2026: throttle global aumentado para reduzir custo Gemini.
// Mínimo de 3 min entre reanálises do mesmo jogo a partir do minuto 25,
// exceto LABAREDA (2 min) que precisa de granularidade fina.
function getReanalysisInterval(status: string, minute: number): number {
  const MIN = 60 * 1000;
  if (status === 'aguardar' || status === 'AGUARDAR') {
    if (minute < 25) return 5 * MIN;
    return 3 * MIN; // antes 1 min
  }
  if (status === 'jogo_morto' || status === 'JOGO_MORTO') {
    if (minute < 60) return 5 * MIN;
    return 3 * MIN; // antes 2-3 min
  }
  if (status === 'cuidado' || status === 'CUIDADO') {
    if (minute < 60) return 5 * MIN; // antes 3 min
    return 3 * MIN; // antes 1-2 min
  }
  if (status === 'labareda' || status === 'LABAREDA') {
    return 2 * MIN; // antes 1 min — mantém granularidade fina sem martelar
  }
  if (status === 'approved_extra' || status === 'APPROVED_EXTRA') {
    if (minute < 60) return 5 * MIN; // antes 3 min
    return 3 * MIN; // antes 2 min
  }
  return 5 * MIN; // default
}

// Normaliza mercado para chave de comparação (evita duplicados óbvios)
function normalizeMarketKey(m: string): string {
  return String(m || '')
    .toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabase = getSupabaseAdmin();
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

    const { bankroll } = await req.json();

    // Camada 2 — kill switch do validador IA borderline
    let borderlineAIEnabled = true;
    try {
      const { data: kill } = await supabase
        .from('cron_settings')
        .select('is_enabled')
        .eq('setting_key', 'borderline_ai_validator')
        .maybeSingle();
      borderlineAIEnabled = kill?.is_enabled ?? true;
    } catch { /* default ON */ }

    // Helper: check if match has special early context
    const hasSpecialEarlyContext = (m: any): boolean => {
      const stats = m.stats || {};
      const championship = (m.championship || '').toLowerCase();
      const isKnockout = /copa|cup|eliminat|playoff|mata-mata|knockout|libertadores|champions|europa league/i.test(championship);
      const homeBehind = (m.score_home ?? 0) < (m.score_away ?? 0);
      if (isKnockout && homeBehind) return true;
      const xgHome = parseFloat(stats.xg_home ?? stats.expected_goals_home ?? '0') || 0;
      if (xgHome > 0.3) return true;
      return false;
    };

    // Get live matches eligible for FIRST analysis (no previous analysis)
    const { data: allNewMatches, error: matchError1 } = await supabase
      .from('live_matches')
      .select('*')
      .eq('status', 'live')
      .is('mycroft_analysis_id', null)
      .order('minute', { ascending: false })
      .limit(10);

    const matchesNew = (allNewMatches || []).filter((m: any) => {
      const min = m.minute ?? 0;
      if (min < 10) {
        const special = hasSpecialEarlyContext(m);
        if (!special) console.log(`[AnalyzeLive] ⏭️ Skipping ${m.home_team} vs ${m.away_team} (${min}') — no special early context`);
        return special;
      }
      return true;
    }).slice(0, 5);

    // Re-analyze ALL matches (incluindo APROVADOS) com tiered intervals.
    // Para jogos APROVADOS, o objetivo é buscar MERCADOS COMPLEMENTARES
    // (ex: aprovou Over 0.5 HT — pode aprovar Over 1.5 FT depois).
    const { data: matchesForReanalysis, error: matchError2 } = await supabase
      .from('live_matches')
      .select('*, mycroft_analyses!inner(id, verdict, plan_name, market, created_at)')
      .eq('status', 'live')
      .in('mycroft_status', ['aguardar', 'jogo_morto', 'cuidado', 'labareda', 'done'])
      .order('minute', { ascending: false })
      .limit(30);

    const now = Date.now();
    const reAnalyzable = (matchesForReanalysis || []).filter((m: any) => {
      const min = m.minute ?? 0;
      const verdict = m.mycroft_analyses?.verdict || '';
      const planName = m.mycroft_analyses?.plan_name || '';
      const analysisTime = new Date(m.mycroft_analyses?.created_at || 0).getTime();
      const elapsed = now - analysisTime;

      // EXCEÇÃO: Planos com monitoramento ativo de saída devem ser reanalisados (1 min)
      const isUnder25Active = verdict === 'APROVADO' && planName === 'PLANO UNDER 2.5 EARLY';
      const isDominanteActive = verdict === 'APROVADO' && planName === 'PLANO BACK AO DOMINANTE';
      const isMonitoredActive = isUnder25Active || isDominanteActive;
      const isApproved = verdict === 'APROVADO' || verdict === 'APROVADO_SITUACIONAL';

      // Determine effective status for interval calculation
      let effectiveStatus: string;
      if (isMonitoredActive) effectiveStatus = 'labareda';
      else if (isApproved) effectiveStatus = 'approved_extra'; // busca mercados COMPLEMENTARES
      else effectiveStatus = (verdict || m.mycroft_status || 'aguardar');

      const interval = getReanalysisInterval(effectiveStatus, min);

      // For early minutes, also check special context
      if (min < 10 && !hasSpecialEarlyContext(m)) return false;

      // Não reanalisar jogos APROVADOS após o min 85 (janela de novos mercados encerrada)
      if (isApproved && !isMonitoredActive && min > 85) return false;

      if (elapsed > interval) {
        const tag = isMonitoredActive ? `[${planName}-MONITOR]` : (isApproved ? '[BUSCA-EXTRA]' : '');
        console.log(`[AnalyzeLive] 🔄 Re-analyze ${m.home_team} vs ${m.away_team} (${min}', status=${effectiveStatus}${tag}, elapsed=${Math.round(elapsed/1000)}s, interval=${Math.round(interval/1000)}s)`);
        return true;
      }
      return false;
    }).slice(0, 8);

    if (reAnalyzable.length > 0) {
      console.log(`[AnalyzeLive] 🔄 ${reAnalyzable.length} matches eligible for re-analysis`);
      for (const m of reAnalyzable) {
        const verdict = m.mycroft_analyses?.verdict || '';
        const isApproved = verdict === 'APROVADO' || verdict === 'APROVADO_SITUACIONAL';
        // Para APROVADOS, NÃO resetar o vínculo (mantém sinal entregue visível).
        // Para outros, reseta para que a nova análise vire a "atual".
        if (!isApproved) {
          await supabase.from('live_matches').update({
            mycroft_analysis_id: null,
            mycroft_status: 'pending',
            updated_at: new Date().toISOString(),
          }).eq('match_id', m.match_id);
        }
      }
    }

    const matchError = matchError1 || matchError2;
    const eligibleMatches = [...(matchesNew || []), ...reAnalyzable];

    if (matchError) {
      console.error('[AnalyzeLive] Error fetching matches:', matchError);
      return new Response(JSON.stringify({ error: matchError.message }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log(`[AnalyzeLive] Found ${eligibleMatches.length} matches to analyze`);

    let analyzedCount = 0;
    const results: any[] = [];

    for (const match of eligibleMatches) {
      try {
        console.log(`[AnalyzeLive] Analyzing ${match.home_team} vs ${match.away_team} (${match.minute}')`);

        // 🔬 ENRIQUECIMENTO COM SOFASCORE: API-Football retorna xG/shots zerados em muitos jogos.
        // SofaScore tem xG real, big chances, tackles, momentum. Fazemos merge.
        let enrichedStats = { ...(match.stats || {}) };
        let sofascoreFound = false;
        let sportmonksFound = false;
        // Cotação real ao vivo capturada do Futodds /matches-live-full (usada
        // para preencher Over/Under/BTTS quando o Mycroft não devolve odd).
        let liveOddsRaw: Record<string, any> | null = null;

        // 🟢 FONTE PRIMÁRIA: SPORTMONKS LIVE — xG/shots/possession nativos e confiáveis
        // SofaScore/Flashscore caem como fallback se Sportmonks não encontrar o jogo.
        try {
          const sm = await getLiveStatsSM(match.home_team, match.away_team);
          if (sm?.found) {
            sportmonksFound = true;
            const num = (v: any) => (v == null || isNaN(Number(v))) ? null : Number(v);
            const prefer = (smVal: any, apiVal: any) => {
              const s = num(smVal); const a = num(apiVal);
              if (s == null || s === 0) return apiVal ?? null;
              if (a == null || a === 0) return s;
              return Math.max(s, a);
            };
            enrichedStats = {
              ...enrichedStats,
              xG_home: prefer(sm.xg_home, enrichedStats.xG_home ?? enrichedStats.xg_home),
              xG_away: prefer(sm.xg_away, enrichedStats.xG_away ?? enrichedStats.xg_away),
              xg_home: prefer(sm.xg_home, enrichedStats.xg_home ?? enrichedStats.xG_home),
              xg_away: prefer(sm.xg_away, enrichedStats.xg_away ?? enrichedStats.xG_away),
              possession_home: prefer(sm.possession_home, enrichedStats.possession_home),
              possession_away: prefer(sm.possession_away, enrichedStats.possession_away),
              shots_total_home: prefer(sm.shots_total_home, enrichedStats.shots_total_home),
              shots_total_away: prefer(sm.shots_total_away, enrichedStats.shots_total_away),
              shots_on_target_home: prefer(sm.shots_on_target_home, enrichedStats.shots_on_target_home),
              shots_on_target_away: prefer(sm.shots_on_target_away, enrichedStats.shots_on_target_away),
              shots_home: prefer(sm.shots_on_target_home, enrichedStats.shots_home),
              shots_away: prefer(sm.shots_on_target_away, enrichedStats.shots_away),
              corners_home: prefer(sm.corners_home, enrichedStats.corners_home),
              corners_away: prefer(sm.corners_away, enrichedStats.corners_away),
              dangerous_attacks_home: prefer(sm.dangerous_attacks_home, enrichedStats.dangerous_attacks_home),
              dangerous_attacks_away: prefer(sm.dangerous_attacks_away, enrichedStats.dangerous_attacks_away),
              big_chances_home: num(sm.big_chances_home),
              big_chances_away: num(sm.big_chances_away),
              source_enriched: 'sportmonks',
            };
            console.log(`[AnalyzeLive] 🟢 Sportmonks enriched ${match.home_team} vs ${match.away_team}: xG ${enrichedStats.xG_home}-${enrichedStats.xG_away}, shots ${enrichedStats.shots_total_home}-${enrichedStats.shots_total_away}, corners ${enrichedStats.corners_home}-${enrichedStats.corners_away}`);
          } else {
            console.log(`[AnalyzeLive] ℹ️ Sportmonks no inplay match for ${match.home_team} vs ${match.away_team}`);
          }
        } catch (smErr) {
          console.warn(`[AnalyzeLive] Sportmonks live enrichment failed:`, smErr instanceof Error ? smErr.message : smErr);
        }

        // 🔵 ENRIQUECIMENTO FUTODDS — pressão real (pressure_indices) + janelas 5/10/15/20 min
        // Adiciona campos consumidos pelo Mycroft sem sobrescrever Sportmonks.
        try {
          const fdList = await getFutoddsLiveCached();
          const fdFx = findFutoddsFixture(match.home_team, match.away_team, fdList);
          const fds = fdFx?._futodds_stats;
          if (fds) {
            (enrichedStats as any).pressure_indices = {
              home: fds.pressure_home,
              away: fds.pressure_away,
              total: fds.pressure_total,
            };
            (enrichedStats as any).pressure_home = fds.pressure_home;
            (enrichedStats as any).pressure_away = fds.pressure_away;
            (enrichedStats as any).pressure_total = fds.pressure_total;
            if (fds.last5min)  (enrichedStats as any).last5min_stats  = fds.last5min;
            if (fds.last10min) (enrichedStats as any).last10min_stats = fds.last10min;
            if (fds.last15min) (enrichedStats as any).last15min_stats = fds.last15min;
            if (fds.last20min) (enrichedStats as any).last20min_stats = fds.last20min;
            // Backfill stats reais Futodds (somente quando Sportmonks/API-Football vieram zerados/missing)
            const _miss = (v: any) => v == null || Number(v) === 0;
            const _backfill = (key: string, val: any) => {
              if (val != null && Number(val) > 0 && _miss((enrichedStats as any)[key])) {
                (enrichedStats as any)[key] = val;
              }
            };
            _backfill("possession_home", fds.possession_home);
            _backfill("possession_away", fds.possession_away);
            _backfill("shots_total_home", fds.shots_total_home);
            _backfill("shots_total_away", fds.shots_total_away);
            _backfill("shots_home", fds.shots_total_home);
            _backfill("shots_away", fds.shots_total_away);
            _backfill("shots_on_target_home", fds.shots_on_target_home);
            _backfill("shots_on_target_away", fds.shots_on_target_away);
            _backfill("corners_home", fds.corners_home);
            _backfill("corners_away", fds.corners_away);
            _backfill("attacks_home", fds.attacks_home);
            _backfill("attacks_away", fds.attacks_away);
            _backfill("dangerous_attacks_home", fds.dangerous_attacks_home);
            _backfill("dangerous_attacks_away", fds.dangerous_attacks_away);
            _backfill("xG_home", (fds as any).xg_home);
            _backfill("xG_away", (fds as any).xg_away);
            _backfill("xg_home", (fds as any).xg_home);
            _backfill("xg_away", (fds as any).xg_away);
            (enrichedStats as any).futodds_event_id = fdFx?.fixture?.futodds_event_id ?? null;
            (enrichedStats as any).source_pressure = "futodds";

            // 💰 Persistir odds ao vivo (Futodds /matches-live-full → odds_live FLAT)
            // shape do endpoint: { home, draw, away, over_25, over_15, btts_yes, ... }
            try {
              const oddsList = await getFutoddsOddsCached();
              const h = _normTeam(match.home_team);
              const a = _normTeam(match.away_team);
              const fdOddMatch = oddsList.find((m: any) =>
                _pairMatch(m.home_name || '', match.home_team) && _pairMatch(m.away_name || '', match.away_team)
              ) || oddsList.find((m: any) => {
                const mh = _normTeam(m.home_name || ''); const ma = _normTeam(m.away_name || '');
                return (mh.includes(h) || h.includes(mh)) && (ma.includes(a) || a.includes(ma));
              });
              const ol = fdOddMatch?.odds_live || {};
              liveOddsRaw = ol;
              const flat = {
                home: Number(ol?.home) || null,
                draw: Number(ol?.draw) || null,
                away: Number(ol?.away) || null,
                over15: Number(ol?.over_15) || null,
                under15: Number(ol?.under_15) || null,
                over25: Number(ol?.over_25) || null,
                under25: Number(ol?.under_25) || null,
                over35: Number(ol?.over_35) || null,
                under35: Number(ol?.under_35) || null,
                btts_yes: Number(ol?.btts_yes) || null,
                btts_no: Number(ol?.btts_no) || null,
                bookmaker: 'Futodds',
                updated_at: new Date().toISOString(),
              };
              if (flat.home || flat.draw || flat.away || flat.over25 || flat.over15) {
                await supabase.from('live_matches').update({
                  odds_live: flat,
                }).eq('match_id', match.match_id);
                console.log(`[AnalyzeLive] 💰 odds_live ${match.home_team}-${match.away_team}: ${flat.home}/${flat.draw}/${flat.away} O1.5=${flat.over15} O2.5=${flat.over25} O3.5=${flat.over35} BTTS=${flat.btts_yes}/${flat.btts_no}`);
              }

              // 🟣 BACKFILL xG via /matches-live-full (Sportmonks/Betfair-live podem vir com xg=null)
              // Tenta vários shapes: m.stats.xg = [h,a] | m.stats.expected_goals=[h,a] | m.xg_home/xg_away
              try {
                const _curH = Number((enrichedStats as any).xG_home ?? (enrichedStats as any).xg_home ?? 0);
                const _curA = Number((enrichedStats as any).xG_away ?? (enrichedStats as any).xg_away ?? 0);
                if (_curH === 0 && _curA === 0 && fdOddMatch) {
                  const fs = (fdOddMatch as any).stats || {};
                  const arr2 = (k: string) => Array.isArray(fs[k]) ? fs[k] : [null, null];
                  const [xH1, xA1] = arr2('xg');
                  const [xH2, xA2] = arr2('expected_goals');
                  const xH = Number(xH1 ?? xH2 ?? (fdOddMatch as any).xg_home ?? 0) || 0;
                  const xA = Number(xA1 ?? xA2 ?? (fdOddMatch as any).xg_away ?? 0) || 0;
                  if (xH > 0 || xA > 0) {
                    (enrichedStats as any).xG_home = xH;
                    (enrichedStats as any).xG_away = xA;
                    (enrichedStats as any).xg_home = xH;
                    (enrichedStats as any).xg_away = xA;
                    (enrichedStats as any).source_xg = 'futodds-live-full';
                    console.log(`[AnalyzeLive] 🟣 xG backfill via live-full ${match.home_team}-${match.away_team}: ${xH}/${xA}`);
                  }
                }
              } catch (_e) { /* não-fatal */ }
            } catch (oddsErr) {
              console.warn('[AnalyzeLive] odds_live persist failed:', (oddsErr as Error)?.message);
            }
            console.log(`[AnalyzeLive] 🔵 Futodds backfill ${match.home_team}-${match.away_team}: P=${fds.pressure_home}/${fds.pressure_away} | poss=${fds.possession_home}/${fds.possession_away} | shots=${fds.shots_total_home}/${fds.shots_total_away} | dAtk=${fds.dangerous_attacks_home}/${fds.dangerous_attacks_away} | corners=${fds.corners_home}/${fds.corners_away}`);
          }
        } catch (fdErr) {
          console.warn(`[AnalyzeLive] Futodds pressure enrichment failed:`, fdErr instanceof Error ? fdErr.message : fdErr);
        }

        // 🚫 SofaScore e Flashscore DESATIVADOS — fonte única: Sportmonks (live).
        // Decisão: evitar ruído/inconsistência. Se Sportmonks não tiver, mantém API-Football
        // ou marca xg_unavailable abaixo. (sofascoreFound já foi declarado acima como `let`)
        const flashscoreFound = false;

        // 🚨 FLAG xG INDISPONÍVEL: SofaScore E Flashscore falharam + API-Football zerado
        const _xgH = Number((enrichedStats as any).xG_home ?? (enrichedStats as any).xg_home ?? 0);
        const _xgA = Number((enrichedStats as any).xG_away ?? (enrichedStats as any).xg_away ?? 0);
        const _shotsTotal = Number((enrichedStats as any).shots_total_home ?? (enrichedStats as any).shots_home ?? 0)
                          + Number((enrichedStats as any).shots_total_away ?? (enrichedStats as any).shots_away ?? 0);
        if (!sportmonksFound && !sofascoreFound && !flashscoreFound && _xgH === 0 && _xgA === 0 && _shotsTotal >= 2) {
          (enrichedStats as any).xg_unavailable = true;
          console.log(`[AnalyzeLive] ⚠️ xG INDISPONÍVEL para ${match.home_team} vs ${match.away_team} (shots=${_shotsTotal}, sportmonks=false, sofascore=false, flashscore=false) — Mycroft será avisado`);
        }

        // 🛠️ ADMIN OVERRIDE: estatísticas editadas manualmente por admin têm prioridade sobre tudo
        // (admin viu o jogo e corrigiu valores zerados — confiamos nele)
        try {
          const { data: override } = await supabase
            .from('live_match_stats_overrides')
            .select('stats, updated_at')
            .eq('match_id', match.match_id)
            .maybeSingle();
          if (override?.stats && typeof override.stats === 'object') {
            const overrideStats = override.stats as Record<string, any>;
            // Merge campo a campo: só sobrescreve se o valor do override for válido (>0 ou não-nulo)
            const merged: Record<string, any> = { ...enrichedStats };
            let appliedKeys: string[] = [];
            for (const [k, v] of Object.entries(overrideStats)) {
              if (v == null) continue;
              if (typeof v === 'number' && Number.isFinite(v)) {
                merged[k] = v;
                appliedKeys.push(k);
              } else if (typeof v !== 'number') {
                merged[k] = v;
                appliedKeys.push(k);
              }
            }
            if (appliedKeys.length > 0) {
              merged.admin_override = true;
              merged.admin_override_at = override.updated_at;
              // xG informado por admin: limpa flags de indisponível/estimado
              if (appliedKeys.some(k => /^xg_/i.test(k) || /^xG_/.test(k))) {
                merged.xg_unavailable = false;
                merged.xg_estimated = false;
              }
              enrichedStats = merged as any;
              console.log(`[AnalyzeLive] 🛠️ ADMIN OVERRIDE aplicado em ${match.match_id}: ${appliedKeys.join(', ')}`);
            }
          }
        } catch (e) {
          console.warn('[AnalyzeLive] Falha ao buscar admin override:', (e as Error)?.message);
        }

        // 📊 CONTEXTO PRÉ-LIVE PUNTER: busca todas análises do Mycroft Punter para este match
        // (inclusive AGUARDAR/REPROVADO — útil para Trader saber a tese pré-jogo do Mycroft)
        let punterPreliveAnalyses: Array<{ market: string; verdict: string; thesis: string | null; confidence: number | null; estimated_probability: number | null; odd: number | null; created_at: string }> = [];
        try {
          const { data: punterRows } = await supabase
            .from('punter_analyses')
            .select('market, verdict, thesis, confidence, estimated_probability, odd, created_at')
            .eq('match_id', match.match_id)
            .order('created_at', { ascending: false })
            .limit(8);
          punterPreliveAnalyses = (punterRows || []).map((r: any) => ({
            market: r.market,
            verdict: r.verdict,
            thesis: r.thesis,
            confidence: r.confidence,
            estimated_probability: r.estimated_probability,
            odd: r.odd,
            created_at: r.created_at,
          }));
          if (punterPreliveAnalyses.length > 0) {
            console.log(`[AnalyzeLive] 📊 Punter pré-live para ${match.home_team} vs ${match.away_team}: ${punterPreliveAnalyses.length} análise(s) — ${punterPreliveAnalyses.map(p => `${p.market}=${p.verdict}`).join(' | ')}`);
          }
        } catch (e) {
          console.warn('[AnalyzeLive] Falha ao buscar punter_analyses pré-live:', (e as Error)?.message);
        }

        // 🎯 MERCADOS JÁ APROVADOS NESTE JOGO — para Mycroft NÃO repetir e
        // procurar entradas COMPLEMENTARES (ex: já tem Over 0.5 HT → tentar Over 1.5/2.5 FT, BTTS, escanteios)
        let existingApprovedMarkets: Array<{ market: string; verdict: string; minute: number | null; created_at: string }> = [];
        try {
          const { data: priorApproved } = await supabase
            .from('mycroft_analyses')
            .select('market, verdict, approved_at_minute, created_at')
            .eq('match_id', match.match_id)
            .in('verdict', ['APROVADO', 'APROVADO_SITUACIONAL', 'LABAREDA'])
            .order('created_at', { ascending: true });
          existingApprovedMarkets = (priorApproved || []).map((r: any) => ({
            market: r.market,
            verdict: r.verdict,
            minute: r.approved_at_minute,
            created_at: r.created_at,
          }));
          if (existingApprovedMarkets.length > 0) {
            console.log(`[AnalyzeLive] 🎯 ${match.home_team} vs ${match.away_team} já tem ${existingApprovedMarkets.length} mercado(s) aprovado(s): ${existingApprovedMarkets.map(e => e.market).join(' | ')}`);
          }
        } catch (e) {
          console.warn('[AnalyzeLive] Falha ao buscar mercados já aprovados:', (e as Error)?.message);
        }

        const matchPayload = {
          match: {
            home: match.home_team,
            away: match.away_team,
            scoreHome: match.score_home ?? 0,
            scoreAway: match.score_away ?? 0,
            minute: match.minute ?? 0,
            period: match.period ?? '',
            championship: match.championship,
            match_id: match.match_id,
            stats: enrichedStats,
            bankroll: bankroll ?? 500,
            existingApprovedMarkets,
            punterPreliveAnalyses,
          },
        };

        let analysis: any = null;
        let usedFallback = false;
        try {
          const analysisRes = await fetch(
            `${supabaseUrl}/functions/v1/mycroft-sports-analysis`,
            {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${supabaseAnonKey}`,
              },
              body: JSON.stringify(matchPayload),
            }
          );

          if (!analysisRes.ok) {
            const errText = await analysisRes.text();
            console.error(`[AnalyzeLive] Mycroft deterministic failed for ${match.match_id}:`, errText);
            analysis = await callGrokFallback(matchPayload);
            usedFallback = !!analysis;
          } else {
            analysis = await analysisRes.json();
          }
        } catch (err) {
          console.error(`[AnalyzeLive] Mycroft deterministic threw for ${match.match_id}:`, (err as Error)?.message);
          analysis = await callGrokFallback(matchPayload);
          usedFallback = !!analysis;
        }

        if (!analysis) {
          console.error(`[AnalyzeLive] Sem análise (deterministic+grok falharam) para ${match.match_id}, pulando`);
          continue;
        }
        if (usedFallback) {
          analysis.ai_engine = 'grok-fallback';
          console.log(`[AnalyzeLive] ⚠️ Fallback Grok usado para ${match.match_id}`);
        }
        console.log(`[AnalyzeLive] Verdict for ${match.match_id}: ${analysis.verdict} (${analysis.confidence}%)`);

        // ========== VETO TEMPORAL POR MERCADO (server-side guard) ==========
        // Regras solicitadas pelo produto:
        //  • Over 0.5 HT → só aprovar até o minuto 30 do 1T E placar 0x0
        //    (se já saiu 1 gol no HT — 1x0 / 0x1 / qualquer — VETAR)
        //  • Over 1.5 / 2.5 / 3.5 / 4.5 (FT) → só aprovar até o minuto 70
        // Aplica-se apenas a verdicts ativos (APROVADO / APROVADO_SITUACIONAL / LABAREDA)
        const activeVerdicts = ['APROVADO', 'APROVADO_SITUACIONAL', 'LABAREDA'];
        if (activeVerdicts.includes(analysis.verdict)) {
          const marketLower = String(analysis.market || '').toLowerCase();
          const minute = Number(match.minute ?? 0);
          const sh = Number(match.score_home ?? 0);
          const sa = Number(match.score_away ?? 0);
          const totalGoals = sh + sa;

          // 1) Over 0.5 HT — janela estreita: APENAS entre minuto 5 e 20, com placar 0x0.
          //    Após o minuto 20 NÃO faz mais sentido (preço já desabou e gol pode sair só no fim do 1T).
          //    Antes do minuto 5 ainda não há leitura estatística suficiente.
          const isOver05HT =
            /over\s*0\.?5/.test(marketLower) &&
            (/(ht|1t|1[ºo]?\s*tempo|primeiro\s*tempo|first\s*half)/.test(marketLower));
          if (isOver05HT) {
            if (minute < 5 || minute > 20 || totalGoals >= 1) {
              console.log(`[AnalyzeLive] 🚫 VETO Over 0.5 HT — min=${minute} placar=${sh}x${sa} (regra: 5'≤min≤20' e 0x0)`);
              analysis.verdict = 'AGUARDAR';
              analysis.thesis = `[VETO TEMPORAL] Over 0.5 HT bloqueado: minuto ${minute}, placar ${sh}x${sa}. Janela válida: minuto 5–20 e placar 0x0. Após o 20' considere Over 0.5 FT ou Back ao time dominante. ` + (analysis.thesis || '');
              analysis.plan_name = null;
            }
          }

          // 2) Over X.5 (FT) — só até minuto 70 e linha máxima 4.5
          //    Não aplica a Over X.5 HT (já tratado/menor escopo) nem Under.
          const overFTMatch = !/(ht|1t|1[ºo]?\s*tempo|primeiro\s*tempo|first\s*half|2t|2[ºo]?\s*tempo|segundo\s*tempo|second\s*half)/.test(marketLower)
            ? marketLower.match(/over\s*(\d+(?:\.\d+)?)/)
            : null;
          if (overFTMatch) {
            const overLine = Number(overFTMatch[1]);
            if (overLine >= 5) {
              console.log(`[AnalyzeLive] 🚫 VETO Over ${overLine} FT — linha acima de 4.5 não permitida`);
              analysis.verdict = 'AGUARDAR';
              analysis.thesis = `[VETO MERCADO] ${analysis.market} bloqueado: linha ${overLine} acima do máximo permitido (4.5). ` + (analysis.thesis || '');
              analysis.plan_name = null;
            } else if (overLine >= 1 && minute > 70) {
              console.log(`[AnalyzeLive] 🚫 VETO Over ${overLine} FT — min=${minute} (regra: <=70')`);
              analysis.verdict = 'AGUARDAR';
              analysis.thesis = `[VETO TEMPORAL] ${analysis.market} bloqueado: minuto ${minute} > 70'. Janela de valor encerrada. ` + (analysis.thesis || '');
              analysis.plan_name = null;
            }
          }

          // 3) VETO TEMPORAL GLOBAL — após minuto 70, NENHUM mercado pode ser aprovado,
          //    EXCETO o plano LABAREDA (alta volatilidade pré-final). Verdict LABAREDA é tratado como exceção.
          const isLabareda = analysis.verdict === 'LABAREDA' ||
            String(analysis.plan_name || '').toUpperCase().includes('LABAREDA');
          if (!isLabareda && minute > 70 && activeVerdicts.includes(analysis.verdict)) {
            console.log(`[AnalyzeLive] 🚫 VETO GLOBAL pós-70' — ${analysis.market} (min=${minute}, plan=${analysis.plan_name})`);
            analysis.verdict = 'AGUARDAR';
            analysis.thesis = `[VETO TEMPORAL GLOBAL] Aprovação após minuto 70 só é permitida para plano LABAREDA. Mercado ${analysis.market} bloqueado (min ${minute}). ` + (analysis.thesis || '');
            analysis.plan_name = null;
          }

          // ========== MARKET SANITY VETO (estado já decidido / sem valor) ==========
          // Bloqueia mercados cuja condição já foi atingida ou cujo EV é inviável dado o placar atual.
          if (activeVerdicts.includes(analysis.verdict)) {
            const isHTMarket = /(ht|1t|1[ºo]?\s*tempo|primeiro\s*tempo|first\s*half)/.test(marketLower);
            const isBTTS = /(btts|ambas\s*marcam|both\s*teams)/.test(marketLower);
            const isBTTSNo = isBTTS && /(não|nao|\bno\b)/.test(marketLower);
            const isBTTSYes = isBTTS && !isBTTSNo;

            // 3) BTTS Sim — VETAR se ambos os times já marcaram (mercado já decidido, odd≈1.0)
            //    OU se já passou do minuto 75 e algum time ainda está em 0 (probabilidade muito baixa)
            if (isBTTSYes) {
              if (sh >= 1 && sa >= 1) {
                console.log(`[AnalyzeLive] 🚫 VETO BTTS Sim — placar ${sh}x${sa} (já decidido)`);
                analysis.verdict = 'AGUARDAR';
                analysis.thesis = `[VETO MERCADO] Ambas Marcam Sim bloqueado: placar ${sh}x${sa} no minuto ${minute} — mercado já decidido (sem valor). ` + (analysis.thesis || '');
                analysis.plan_name = null;
              } else if (minute >= 75 && (sh === 0 || sa === 0)) {
                console.log(`[AnalyzeLive] 🚫 VETO BTTS Sim — min=${minute} placar=${sh}x${sa} (tempo curto)`);
                analysis.verdict = 'AGUARDAR';
                analysis.thesis = `[VETO MERCADO] Ambas Marcam Sim bloqueado: minuto ${minute}, placar ${sh}x${sa}. Tempo restante insuficiente para o time zerado marcar. ` + (analysis.thesis || '');
                analysis.plan_name = null;
              }
            }

            // 4) BTTS Não — VETAR se ambos já marcaram (já perdeu)
            if (isBTTSNo && sh >= 1 && sa >= 1) {
              console.log(`[AnalyzeLive] 🚫 VETO BTTS Não — placar ${sh}x${sa} (já perdeu)`);
              analysis.verdict = 'AGUARDAR';
              analysis.thesis = `[VETO MERCADO] Ambas Marcam Não bloqueado: placar ${sh}x${sa} — mercado já perdido. ` + (analysis.thesis || '');
              analysis.plan_name = null;
            }

            // 5) Over X.5 FT já batido — se total de gols >= linha, mercado já ganho (sem valor)
            if (activeVerdicts.includes(analysis.verdict) && !isHTMarket) {
              const overFTMatch = marketLower.match(/over\s*(\d)\.?5/);
              if (overFTMatch) {
                const line = Number(overFTMatch[1]); // 0,1,2,3,4
                if (totalGoals >= line + 1) {
                  console.log(`[AnalyzeLive] 🚫 VETO Over ${line}.5 FT — total=${totalGoals} (já batido)`);
                  analysis.verdict = 'AGUARDAR';
                  analysis.thesis = `[VETO MERCADO] Over ${line}.5 FT bloqueado: ${totalGoals} gols já marcados — mercado já decidido (sem valor). ` + (analysis.thesis || '');
                  analysis.plan_name = null;
                }
              }
            }

            // 6) Over X.5 HT já batido (no 1º tempo) — total de gols no HT >= linha
            if (activeVerdicts.includes(analysis.verdict) && isHTMarket) {
              const overHTMatch = marketLower.match(/over\s*(\d)\.?5/);
              if (overHTMatch) {
                const line = Number(overHTMatch[1]);
                // Considera apenas se ainda no 1T; se já passou do HT, mercado HT está fechado
                if (totalGoals >= line + 1) {
                  console.log(`[AnalyzeLive] 🚫 VETO Over ${line}.5 HT — total=${totalGoals} (já batido)`);
                  analysis.verdict = 'AGUARDAR';
                  analysis.thesis = `[VETO MERCADO] Over ${line}.5 HT bloqueado: ${totalGoals} gols no HT — mercado já decidido. ` + (analysis.thesis || '');
                  analysis.plan_name = null;
                } else if (minute > 40) {
                  console.log(`[AnalyzeLive] 🚫 VETO Over ${line}.5 HT — min=${minute} (janela encerrada)`);
                  analysis.verdict = 'AGUARDAR';
                  analysis.thesis = `[VETO MERCADO] Over ${line}.5 HT bloqueado: minuto ${minute} > 40' — tempo restante insuficiente. ` + (analysis.thesis || '');
                  analysis.plan_name = null;
                }
              }
            }

            // 7) Under X.5 já estourado — se total de gols >= linha, Under já perdeu
            if (activeVerdicts.includes(analysis.verdict)) {
              const underMatch = marketLower.match(/under\s*(\d)\.?5/);
              if (underMatch) {
                const line = Number(underMatch[1]);
                if (totalGoals >= line + 1) {
                  console.log(`[AnalyzeLive] 🚫 VETO Under ${line}.5 — total=${totalGoals} (já estourado)`);
                  analysis.verdict = 'AGUARDAR';
                  analysis.thesis = `[VETO MERCADO] Under ${line}.5 bloqueado: ${totalGoals} gols já marcados — mercado já perdido. ` + (analysis.thesis || '');
                  analysis.plan_name = null;
                }
              }
            }
          }
        }
        // ====================================================================

        // ========== GUARD ANTI-DUPLICIDADE DE MERCADO ==========
        // Se o Mycroft retornou um mercado JÁ aprovado neste jogo, descarta como AGUARDAR
        // (evita reenviar o mesmo sinal). Reanálises devem produzir mercados COMPLEMENTARES.
        if (activeVerdicts.includes(analysis.verdict) && existingApprovedMarkets.length > 0) {
          const newKey = normalizeMarketKey(analysis.market);
          const dupHit = existingApprovedMarkets.find(e => normalizeMarketKey(e.market) === newKey);
          if (dupHit) {
            console.log(`[AnalyzeLive] 🔁 DUPLICATA bloqueada: "${analysis.market}" já aprovado em ${dupHit.created_at}`);
            analysis.verdict = 'AGUARDAR';
            analysis.thesis = `[DUPLICATA] Mercado "${analysis.market}" já foi aprovado anteriormente neste jogo. Reanálise busca mercados COMPLEMENTARES. ` + (analysis.thesis || '');
            analysis.plan_name = null;
          }
        }
        // ====================================================================

        // ========== AUTO-VETO xG INDISPONÍVEL ==========
        // Regras:
        //  • LABAREDA NUNCA pode ser emitida sem xG → rebaixa para APROVADO_SITUACIONAL.
        //  • Qualquer verdict ativo com xg_unavailable: degrada confidence em -10pp.
        //  • Se confidence cair abaixo de 50 após penalização → AGUARDAR.
        if ((enrichedStats as any).xg_unavailable === true && activeVerdicts.includes(analysis.verdict)) {
          const before = Number(analysis.confidence ?? 0);
          const after = Math.max(0, before - 10);
          analysis.confidence = after;
          const note = `[xG INDISPONÍVEL] -10pp aplicados (de ${before}% para ${after}%).`;
          analysis.alerts = Array.isArray(analysis.alerts) ? [...analysis.alerts, note] : [note];
          if (analysis.verdict === 'LABAREDA') {
            console.log(`[AnalyzeLive] 🚫 LABAREDA bloqueada por xG indisponível → APROVADO_SITUACIONAL (${match.home_team} vs ${match.away_team})`);
            analysis.verdict = 'APROVADO_SITUACIONAL';
            analysis.thesis = `[xG INDISPONÍVEL] LABAREDA exige xG presente. Rebaixado para APROVADO_SITUACIONAL. ` + (analysis.thesis || '');
          }
          if (after < 50) {
            console.log(`[AnalyzeLive] 🚫 xG indisponível + conf ${after}% < 50 → AGUARDAR`);
            analysis.verdict = 'AGUARDAR';
            analysis.thesis = `[xG INDISPONÍVEL] Confidence pós-penalidade ${after}% < 50%. ` + (analysis.thesis || '');
            analysis.plan_name = null;
          } else {
            console.log(`[AnalyzeLive] ⚠️  xG indisponível: confidence ${before}→${after}%`);
          }
        }
        // ====================================================================

        // ─── CALIBRATION FLOOR (Trader) ───────────────────────────────────
        // Rebaixa APROVADO* se confidence < limite calibrado das últimas 50.
        try {
          const floor = await getCalibrationFloor(supabase, 'trader_sports', 70);
          const r = applyCalibrationFloor(analysis, floor);
          if (r.demoted) {
            console.log(`[AnalyzeLive] 🎚️  CALIBRAÇÃO rebaixou ${match.home_team} vs ${match.away_team} (conf ${analysis.confidence}% < ${floor}%)`);
          }
        } catch (calErr) {
          console.warn('[AnalyzeLive] calibrationFloor falhou:', (calErr as Error)?.message);
        }

        // ─── CAMADA 2: VALIDADOR IA BORDERLINE (confidence 55-65) ─────────
        // Só dispara para sinais ATIVOS com confiança borderline e kill switch ON.
        // CONFIRMA → mantém (com pequeno boost), VETA → rebaixa para AGUARDAR,
        // ERROR/SKIP → mantém (fail-open). Tudo logado em borderline_ai_validations.
        try {
          if (borderlineAIEnabled && isBorderline(analysis.verdict, Number(analysis.confidence ?? 0))) {
            const originalVerdict = analysis.verdict;
            const originalConfidence = Number(analysis.confidence ?? 0);
            const decision = await validateBorderline({
              match_id: match.match_id,
              home_team: match.home_team,
              away_team: match.away_team,
              league: (match as any).championship || (match as any).league || null,
              minute: Number(match.minute ?? 0),
              score_home: Number(match.score_home ?? 0),
              score_away: Number(match.score_away ?? 0),
              market: analysis.market || 'N/A',
              verdict: originalVerdict,
              confidence: originalConfidence,
              thesis: analysis.thesis,
              odd: analysis.odd,
              stats: enrichedStats as any,
            });

            let finalVerdict = originalVerdict;
            let finalConfidence = originalConfidence;
            if (decision.decision === 'VETA') {
              finalVerdict = 'AGUARDAR';
              finalConfidence = Math.max(0, originalConfidence + decision.confidence_adjustment);
              analysis.verdict = finalVerdict;
              analysis.confidence = finalConfidence;
              analysis.thesis = `[IA-VETO] ${decision.reason} | ` + (analysis.thesis || '');
              console.log(`[AnalyzeLive] 🛑 IA-VETO ${match.home_team} vs ${match.away_team}: ${decision.reason}`);
            } else if (decision.decision === 'CONFIRMA') {
              finalConfidence = Math.min(100, originalConfidence + decision.confidence_adjustment);
              analysis.confidence = finalConfidence;
              console.log(`[AnalyzeLive] ✅ IA-CONFIRMA ${match.home_team} vs ${match.away_team} (+${decision.confidence_adjustment}pp)`);
            }

            await supabase.from('borderline_ai_validations').insert({
              match_id: match.match_id,
              home_team: match.home_team,
              away_team: match.away_team,
              league: (match as any).championship || null,
              minute: Number(match.minute ?? 0),
              market: analysis.market || 'N/A',
              original_verdict: originalVerdict,
              original_confidence: originalConfidence,
              ai_decision: decision.decision,
              ai_reason: decision.reason,
              ai_confidence_adjustment: decision.confidence_adjustment,
              final_verdict: finalVerdict,
              final_confidence: finalConfidence,
              ai_model: decision.model,
              latency_ms: decision.latency_ms,
              stats_snapshot: {
                xg_home: (enrichedStats as any).xg_home ?? 0,
                xg_away: (enrichedStats as any).xg_away ?? 0,
                possession_home: (enrichedStats as any).possession_home ?? 0,
                possession_away: (enrichedStats as any).possession_away ?? 0,
                shots_total: (enrichedStats as any).shots_total ?? 0,
                dangerous_attacks: (enrichedStats as any).dangerous_attacks_total ?? 0,
              },
            });
          }
        } catch (borderErr) {
          console.warn('[AnalyzeLive] borderline AI validator falhou:', (borderErr as Error)?.message);
        }
        // ====================================================================

        // Save analysis (snapshot de stats só nos APROVADOS p/ comparação Sportmonks vs AF)
        const _isApprovedSm = ['APROVADO','APROVADO_SITUACIONAL','LABAREDA'].includes(analysis.verdict);
        // 🎯 Garante odd numérica para o ROI/op de calibração.
        // Prioridade: 1) odd do Mycroft (cache pré-jogo) 2) odd ao vivo Futodds 3) fallback Poisson.
        let _oddToPersist: number | null = null;
        const _rawOdd = Number(analysis.odd);
        const _resolveLiveOdd = (market: string | null | undefined): number | null => {
          if (!liveOddsRaw || !market) return null;
          const m = String(market).toLowerCase();
          const get = (k: string) => { const v = Number((liveOddsRaw as any)?.[k]); return Number.isFinite(v) && v > 1.01 ? v : null; };
          const ouMatch = m.match(/(over|under|mais|menos)\s*(\d+(?:\.\d+)?)/);
          if (ouMatch) {
            const tipo = (ouMatch[1] === 'mais') ? 'over' : (ouMatch[1] === 'menos') ? 'under' : ouMatch[1];
            const linha = ouMatch[2].replace('.', '_');
            return get(`${tipo}_${linha}`);
          }
          if (/(btts|ambas)/.test(m)) {
            return /(não|nao|\bno\b)/.test(m) ? get('btts_no') : get('btts_yes');
          }
          if (/(empate|draw)/.test(m)) return get('draw');
          const home = String(match.home_team || '').toLowerCase();
          const away = String(match.away_team || '').toLowerCase();
          if (home && (m.includes(home) || /(mandante|home|casa)/.test(m))) return get('home');
          if (away && (m.includes(away) || /(visitante|away|fora)/.test(m))) return get('away');
          return null;
        };
        if (Number.isFinite(_rawOdd) && _rawOdd > 1.01) {
          _oddToPersist = _rawOdd;
        } else {
          const live = _resolveLiveOdd(analysis.market);
          if (live != null) {
            _oddToPersist = live;
            console.log(`[AnalyzeLive] 🎯 Odd real Futodds para "${analysis.market}": ${live}`);
            analysis.odd = live;
            analysis.odd_source = 'real';
            if (analysis.risk_management) {
              analysis.risk_management.entry = `${analysis.market} @ ${live}`;
              analysis.risk_management.rr = `1:${(live - 1).toFixed(2)}`;
              analysis.risk_management.ev = `${Math.round(((Number(analysis.confidence ?? 0) / 100) * live - 1) * 100)}%`;
            }
          } else {
            _oddToPersist = resolveFallbackOdd({
              market: analysis.market,
              minute: Number(match.minute ?? 0),
              scoreHome: Number(match.score_home ?? 0),
              scoreAway: Number(match.score_away ?? 0),
            });
            console.log(`[AnalyzeLive] ⚠️ Odd fallback Poisson para "${analysis.market}": ${_oddToPersist} (sem cotação real)`);
          }
        }
        // ========== FINAL SAFETY NET (defense-in-depth) ==========
        // Última checagem antes do INSERT: garante que NENHUM mercado expirado/já decidido
        // entre como APROVADO/APROVADO_SITUACIONAL/LABAREDA, mesmo se algum caminho anterior
        // tiver pulado as vetos (re-análise, mutação tardia de market, etc.).
        try {
          const _active = ['APROVADO', 'APROVADO_SITUACIONAL', 'LABAREDA'];
          if (_active.includes(analysis.verdict)) {
            const _m = String(analysis.market || '').toLowerCase();
            const _min = Number(match.minute ?? 0);
            const _sh = Number(match.score_home ?? 0);
            const _sa = Number(match.score_away ?? 0);
            const _tot = _sh + _sa;
            const _isHT = /(ht|1t|1[ºo]?\s*tempo|primeiro\s*tempo|first\s*half)/.test(_m);
            const _period = String(match.period || '').toLowerCase();
            const _isInSecondHalf = /(second|2nd|2t|2º|2o\s*tempo|segundo)/.test(_period) || _min > 45;

            let _killReason: string | null = null;

            // Over X.5 HT — já batido OU janela 1T encerrada
            const _overHT = _m.match(/over\s*(\d)\.?5/);
            if (_isHT && _overHT) {
              const _line = Number(_overHT[1]);
              if (_tot >= _line + 1) _killReason = `Over ${_line}.5 HT já batido (${_tot} gols)`;
              else if (_isInSecondHalf) _killReason = `Over ${_line}.5 HT — 1T encerrado (min ${_min}, period=${_period})`;
              else if (_line === 0 && _min > 20) _killReason = `Over 0.5 HT fora da janela (min ${_min} > 20)`;
              else if (_line === 0 && _min < 5) _killReason = `Over 0.5 HT fora da janela (min ${_min} < 5)`;
            }
            // Over X.5 FT — já batido (sem valor), linha máxima 4.5, ou pós-70'
            const _overFT = !_isHT ? _m.match(/over\s*(\d+(?:\.\d+)?)/) : null;
            if (_overFT) {
              const _line = Number(_overFT[1]);
              if (_line >= 5) _killReason = `Over ${_line} FT acima do limite (máx 4.5)`;
              else if (_tot >= Math.ceil(_line)) _killReason = `Over ${_line} FT já batido (${_tot} gols)`;
              else if (_line >= 1 && _min > 70) _killReason = `Over ${_line} FT fora da janela (min ${_min} > 70)`;
            }
            // VETO GLOBAL pós-70' — exceto LABAREDA
            const _isLabareda = analysis.verdict === 'LABAREDA' ||
              String(analysis.plan_name || '').toUpperCase().includes('LABAREDA');
            if (!_killReason && !_isLabareda && _min > 70) {
              _killReason = `Pós-70' apenas LABAREDA permitido (min ${_min}, plan=${analysis.plan_name})`;
            }
            // Under X.5 — já estourado
            const _underAny = _m.match(/under\s*(\d)\.?5/);
            if (_underAny) {
              const _line = Number(_underAny[1]);
              if (_tot >= _line + 1) _killReason = `Under ${_line}.5 já estourado (${_tot} gols)`;
            }
            // BTTS Sim — ambos já marcaram
            if (/(btts|ambas\s*marcam|both\s*teams)/.test(_m) && !/(não|nao|\bno\b)/.test(_m)) {
              if (_sh >= 1 && _sa >= 1) _killReason = `BTTS Sim já decidido (${_sh}x${_sa})`;
              else if (_min >= 75 && (_sh === 0 || _sa === 0)) _killReason = `BTTS Sim — tempo curto (min ${_min}, ${_sh}x${_sa})`;
            }
            // BTTS Não — ambos já marcaram (perdeu)
            if (/(btts|ambas\s*marcam|both\s*teams)/.test(_m) && /(não|nao|\bno\b)/.test(_m)) {
              if (_sh >= 1 && _sa >= 1) _killReason = `BTTS Não já perdido (${_sh}x${_sa})`;
            }

            if (_killReason) {
              console.log(`[AnalyzeLive] 🛑 SAFETY NET → AGUARDAR (${match.home_team} vs ${match.away_team}) — ${_killReason} | market="${analysis.market}" verdict_orig=${analysis.verdict}`);
              analysis.verdict = 'AGUARDAR';
              analysis.thesis = `[SAFETY NET] ${_killReason}. ` + (analysis.thesis || '');
              analysis.plan_name = null;
            }
          }
        } catch (sErr) {
          console.warn('[AnalyzeLive] safety net falhou:', (sErr as Error).message);
        }
        // ====================================================================

        const { data: analysisRow, error: insertError } = await supabase
          .from('mycroft_analyses')
          .insert({
            match_id: match.match_id,
            verdict: analysis.verdict || 'AGUARDAR',
            plan_name: analysis.plan_name || null,
            market: analysis.market || 'N/A',
            thesis: analysis.thesis || 'Análise sem tese.',
            odd: _oddToPersist,
            confidence: analysis.confidence ?? 0,
            risk_management: analysis.risk_management ?? null,
            alerts: Array.isArray(analysis.alerts) ? analysis.alerts.filter((a: any) => typeof a === 'string') : [],
            fundamentation: analysis.fundamentation ?? { stats: enrichedStats },
            stats_snapshot: _isApprovedSm ? { provider: 'sportmonks', minute: match.minute ?? 0, score_home: match.score_home ?? 0, score_away: match.score_away ?? 0, stats: enrichedStats } : null,
          })
          .select('id')
          .single();

        if (insertError) {
          console.error(`[AnalyzeLive] ❌ Insert error for ${match.match_id}:`, JSON.stringify(insertError));
          continue;
        }

        // ─── SHADOW MODE: motor de regras dinâmicas (não afeta produção) ───
        try {
          const _stats: any = (enrichedStats as any) || {};
          await shadowCompare({
            sb: supabase,
            modo: 'trader',
            source_function: 'analyze-live-matches',
            match_id: match.match_id,
            mercado: analysis.market || 'N/A',
            home_team: match.home_team,
            away_team: match.away_team,
            league: (match as any).championship || (match as any).league || null,
            odd: analysis.odd ?? undefined,
            minute: Number(match.minute ?? 0),
            stats: {
              minute: Number(match.minute ?? 0),
              score_home: Number(match.score_home ?? 0),
              score_away: Number(match.score_away ?? 0),
              total_goals: Number(match.score_home ?? 0) + Number(match.score_away ?? 0),
              xg_home: Number(_stats.xg_home ?? _stats.xG_home ?? 0),
              xg_away: Number(_stats.xg_away ?? _stats.xG_away ?? 0),
              xg_total: Number(_stats.xg_home ?? _stats.xG_home ?? 0) + Number(_stats.xg_away ?? _stats.xG_away ?? 0),
              shots_total: Number(_stats.shots_total ?? 0),
              shots_on_target: Number(_stats.shots_on_target_total ?? _stats.shots_on_target ?? 0),
              dangerous_attacks: Number(_stats.dangerous_attacks_total ?? _stats.dangerous_attacks ?? 0),
              possession_max: Math.max(Number(_stats.possession_home ?? 0), Number(_stats.possession_away ?? 0)),
              corners_total: Number(_stats.corners_total ?? 0),
            },
            verdicto_atual: analysis.verdict,
            score_atual: Number(analysis.confidence ?? 0),
          });
        } catch (e) { console.warn('[shadowMode] live falhou:', (e as Error).message); }

        if (analysisRow) {
          // Map verdict to mycroft_status — preserve dynamic statuses for reanalysis
          const verdictToStatus: Record<string, string> = {
            'APROVADO': 'done',
            'APROVADO_SITUACIONAL': 'done',
            'AGUARDAR': 'aguardar',
            'JOGO_MORTO': 'jogo_morto',
            'LABAREDA': 'labareda',
            'CUIDADO': 'cuidado',
          };
          const statusToSet = verdictToStatus[analysis.verdict] || 'aguardar';
          const hadPriorApproved = existingApprovedMarkets.length > 0;
          const isNewApproved = activeVerdicts.includes(analysis.verdict);

          // Se já existia mercado aprovado e a nova análise NÃO trouxe novo APROVADO,
          // preservamos o vínculo original (não sobrescrevemos com AGUARDAR/JOGO_MORTO).
          // Se trouxe um novo APROVADO complementar, mantemos o original mas a nova
          // análise fica registrada em mycroft_analyses (UI lista por match_id).
          if (hadPriorApproved && !isNewApproved) {
            console.log(`[AnalyzeLive] 🛡️ Preservando vínculo original (${match.home_team} vs ${match.away_team}) — reanálise não trouxe novo APROVADO`);
          } else {
            await supabase
              .from('live_matches')
              .update({
                mycroft_analysis_id: analysisRow.id,
                mycroft_status: statusToSet,
              })
              .eq('match_id', match.match_id);
          }

          analyzedCount++;
          results.push({
            match_id: match.match_id,
            teams: `${match.home_team} vs ${match.away_team}`,
            verdict: analysis.verdict,
            confidence: analysis.confidence,
            market: analysis.market,
          });

          // === TELEGRAM ATIVO — grupo dedicado @oraculo_mycroft_trader ===
          // Sinais ao vivo (APROVADO, APROVADO_SITUACIONAL, LABAREDA) e cancelamentos
          // são enviados via notify-trader-event, que despacha para o grupo dedicado
          // através do telegram-send-dedupe (com dedupe por match+market+verdict+canal).
          const shouldNotifyEntry =
            analysis.verdict === 'APROVADO' ||
            analysis.verdict === 'APROVADO_SITUACIONAL' ||
            analysis.verdict === 'LABAREDA';
          const shouldNotifyCancel =
            analysis.plan_name === 'CANCELAMENTO UNDER 2.5 EARLY' ||
            analysis.plan_name === 'CANCELAMENTO BACK AO DOMINANTE';

          if (shouldNotifyEntry || shouldNotifyCancel) {
            const eventType = shouldNotifyCancel
              ? 'CANCELADO'
              : (analysis.verdict === 'LABAREDA' ? 'LABAREDA' : 'APROVADO');
            try {
              const notifyRes = await fetch(
                `${supabaseUrl}/functions/v1/notify-trader-event`,
                {
                  method: 'POST',
                  headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`,
                  },
                  body: JSON.stringify({
                    match_id: match.match_id,
                    market: analysis.market || 'N/A',
                    event_type: eventType,
                    home_team: match.home_team,
                    away_team: match.away_team,
                    league: match.championship ?? null,
                    odd: analysis.odd ?? null,
                    confidence: analysis.confidence ?? null,
                    minute: match.minute ?? null,
                    period: match.period ?? null,
                    status: match.status ?? null,
                    score_home: match.score_home ?? 0,
                    score_away: match.score_away ?? 0,
                  }),
                }
              );
              const notifyJson = await notifyRes.json().catch(() => ({}));
              console.log(`[AnalyzeLive] 📨 Telegram notify (${eventType}) for ${match.home_team} vs ${match.away_team} | ${analysis.market} → sent=${notifyJson?.telegram_sent} skipped=${notifyJson?.skipped ?? false}`);
            } catch (notifyErr) {
              console.error(`[AnalyzeLive] notify-trader-event failed for ${match.match_id}:`, notifyErr);
            }
          }
        }
      } catch (e) {
        console.error(`[AnalyzeLive] Error for ${match.match_id}:`, e);
      }
    }

    console.log(`[AnalyzeLive] Done: ${analyzedCount}/${eligibleMatches.length} analyzed`);

    return new Response(
      JSON.stringify({
        ok: true,
        total_eligible: eligibleMatches.length,
        analyzed: analyzedCount,
        results,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('[AnalyzeLive] Error:', error);
    await logEdgeError("analyze-live-matches", error).catch(() => {});
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
