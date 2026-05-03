import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import { logEdgeError } from "../_shared/logEdgeError.ts";
import { shadowCompare } from "../_shared/mycroft-rules-engine.ts";
import { getLiveStatsSM } from "../_shared/sportmonks-af-adapter.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

function getSupabaseAdmin() {
  return createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );
}

// Reanalysis intervals (ms) by status and minute range
function getReanalysisInterval(status: string, minute: number): number {
  const MIN = 60 * 1000;
  if (status === 'aguardar' || status === 'AGUARDAR') {
    if (minute < 25) return 5 * MIN;
    return 1 * MIN;
  }
  if (status === 'jogo_morto' || status === 'JOGO_MORTO') {
    if (minute < 60) return 5 * MIN;
    if (minute < 75) return 3 * MIN;
    return 2 * MIN;
  }
  if (status === 'cuidado' || status === 'CUIDADO') {
    if (minute < 60) return 3 * MIN;
    if (minute < 75) return 2 * MIN;
    return 1 * MIN;
  }
  if (status === 'labareda' || status === 'LABAREDA') {
    return 1 * MIN; // Always 1 min for LABAREDA
  }
  // Jogo já APROVADO: ainda assim revisitamos a cada 3 min para tentar mercados
  // COMPLEMENTARES (ex: aprovou Over 0.5 HT, depois pode aprovar Over 1.5 FT).
  if (status === 'approved_extra' || status === 'APPROVED_EXTRA') {
    if (minute < 60) return 3 * MIN;
    return 2 * MIN;
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

        const analysisRes = await fetch(
          `${supabaseUrl}/functions/v1/mycroft-sports-analysis`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${supabaseAnonKey}`,
            },
            body: JSON.stringify({
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
            }),
          }
        );

        if (!analysisRes.ok) {
          const errText = await analysisRes.text();
          console.error(`[AnalyzeLive] Mycroft failed for ${match.match_id}:`, errText);
          continue;
        }

        const analysis = await analysisRes.json();
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

          // 1) Over 0.5 HT
          const isOver05HT =
            /over\s*0\.?5/.test(marketLower) &&
            (/(ht|1t|1[ºo]?\s*tempo|primeiro\s*tempo|first\s*half)/.test(marketLower));
          if (isOver05HT) {
            if (minute > 30 || totalGoals >= 1) {
              console.log(`[AnalyzeLive] 🚫 VETO Over 0.5 HT — min=${minute} placar=${sh}x${sa} (regra: <=30' e 0x0)`);
              analysis.verdict = 'AGUARDAR';
              analysis.thesis = `[VETO TEMPORAL] Over 0.5 HT bloqueado: minuto ${minute}, placar ${sh}x${sa}. Regra exige minuto ≤ 30 e placar 0x0. ` + (analysis.thesis || '');
              analysis.plan_name = null;
            }
          }

          // 2) Over 1.5 / 2.5 / 3.5 / 4.5 (FT) — só até minuto 70
          //    Não aplica a Over X.5 HT (já tratado/menor escopo) nem Under.
          const over15plusFT =
            /over\s*(1\.?5|2\.?5|3\.?5|4\.?5)/.test(marketLower) &&
            !/(ht|1t|1[ºo]?\s*tempo|primeiro\s*tempo|first\s*half|2t|2[ºo]?\s*tempo|segundo\s*tempo|second\s*half)/.test(marketLower);
          if (over15plusFT && minute > 70) {
            console.log(`[AnalyzeLive] 🚫 VETO Over 1.5/2.5/3.5/4.5 FT — min=${minute} (regra: <=70')`);
            analysis.verdict = 'AGUARDAR';
            analysis.thesis = `[VETO TEMPORAL] ${analysis.market} bloqueado: minuto ${minute} > 70'. Janela de valor encerrada. ` + (analysis.thesis || '');
            analysis.plan_name = null;
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

        // Save analysis (snapshot de stats só nos APROVADOS p/ comparação Sportmonks vs AF)
        const _isApprovedSm = ['APROVADO','APROVADO_SITUACIONAL','LABAREDA'].includes(analysis.verdict);
        const { data: analysisRow, error: insertError } = await supabase
          .from('mycroft_analyses')
          .insert({
            match_id: match.match_id,
            verdict: analysis.verdict || 'AGUARDAR',
            plan_name: analysis.plan_name || null,
            market: analysis.market || 'N/A',
            thesis: analysis.thesis || 'Análise sem tese.',
            odd: analysis.odd ?? null,
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
                updated_at: new Date().toISOString(),
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
