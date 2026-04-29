import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Whitelist de chaves numéricas que admin pode editar
const ALLOWED_NUMERIC_KEYS = new Set([
  'xG_home', 'xG_away', 'xg_home', 'xg_away',
  'possession_home', 'possession_away',
  'attacks_home', 'attacks_away',
  'dangerous_attacks_home', 'dangerous_attacks_away',
  'shots_home', 'shots_away',
  'shots_total_home', 'shots_total_away',
  'shots_on_target_home', 'shots_on_target_away',
  'shots_inside_box_home', 'shots_inside_box_away',
  'big_chances_home', 'big_chances_away',
  'corners_home', 'corners_away',
  'fouls_home', 'fouls_away',
  'odd_manual',
]);

function sanitizeStats(input: unknown): Record<string, number> {
  if (!input || typeof input !== 'object') return {};
  const out: Record<string, number> = {};
  for (const [k, v] of Object.entries(input as Record<string, unknown>)) {
    if (!ALLOWED_NUMERIC_KEYS.has(k)) continue;
    const n = Number(v);
    if (!Number.isFinite(n) || n < 0 || n > 1000) continue;
    out[k] = n;
  }
  // espelhar xG_* <-> xg_*
  if (out.xG_home != null && out.xg_home == null) out.xg_home = out.xG_home;
  if (out.xG_away != null && out.xg_away == null) out.xg_away = out.xG_away;
  return out;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
    const SERVICE_ROLE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const ANON = Deno.env.get('SUPABASE_ANON_KEY')!;

    const authHeader = req.headers.get('Authorization') || '';
    const token = authHeader.replace(/^Bearer\s+/i, '').trim();
    if (!token) {
      return new Response(JSON.stringify({ error: 'Não autenticado' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // 1) Identificar usuário a partir do JWT
    const userClient = createClient(SUPABASE_URL, ANON, { global: { headers: { Authorization: `Bearer ${token}` } } });
    const { data: userData, error: userErr } = await userClient.auth.getUser();
    if (userErr || !userData?.user) {
      return new Response(JSON.stringify({ error: 'Sessão inválida' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }
    const userId = userData.user.id;

    // 2) Validar role admin via service role
    const admin = createClient(SUPABASE_URL, SERVICE_ROLE);
    const { data: isAdmin, error: roleErr } = await admin.rpc('has_role', { _user_id: userId, _role: 'admin' });
    if (roleErr || !isAdmin) {
      return new Response(JSON.stringify({ error: 'Apenas administradores' }), { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // 3) Validar payload
    const body = await req.json().catch(() => ({}));
    const { match_id, stats, notes, reanalyze } = body || {};
    if (!match_id || typeof match_id !== 'string') {
      return new Response(JSON.stringify({ error: 'match_id obrigatório' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }
    const cleanStats = sanitizeStats(stats);
    if (Object.keys(cleanStats).length === 0) {
      return new Response(JSON.stringify({ error: 'Nenhuma estatística válida enviada' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // 4) Upsert override (merge com o que já existia)
    const { data: existing } = await admin
      .from('live_match_stats_overrides')
      .select('stats')
      .eq('match_id', match_id)
      .maybeSingle();

    const mergedOverride = {
      ...((existing?.stats as Record<string, unknown>) || {}),
      ...cleanStats,
    };

    const { error: upErr } = await admin
      .from('live_match_stats_overrides')
      .upsert({
        match_id,
        stats: mergedOverride,
        edited_by: userId,
        notes: notes ?? null,
      }, { onConflict: 'match_id' });

    if (upErr) {
      console.error('[update-live-match-stats] upsert erro', upErr);
      return new Response(JSON.stringify({ error: 'Falha ao salvar override' }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // 5) Mesclar também na live_matches.stats para refletir imediatamente na UI
    try {
      const { data: lm } = await admin
        .from('live_matches')
        .select('stats')
        .eq('match_id', match_id)
        .maybeSingle();
      const newLmStats = {
        ...((lm?.stats as Record<string, unknown>) || {}),
        ...cleanStats,
        admin_override: true,
        admin_override_at: new Date().toISOString(),
      };
      await admin.from('live_matches').update({ stats: newLmStats, updated_at: new Date().toISOString() }).eq('match_id', match_id);
    } catch (e) {
      console.warn('[update-live-match-stats] live_matches sync falhou', (e as Error)?.message);
    }

    // 6) Disparar reanálise imediata se solicitado
    let reanalysisQueued = false;
    if (reanalyze) {
      try {
        const res = await fetch(`${SUPABASE_URL}/functions/v1/analyze-live-matches`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${SERVICE_ROLE}` },
          body: JSON.stringify({ matchId: match_id, force: true, source: 'admin_override' }),
        });
        reanalysisQueued = res.ok;
      } catch (e) {
        console.warn('[update-live-match-stats] reanálise falhou', (e as Error)?.message);
      }
    }

    return new Response(JSON.stringify({
      ok: true,
      match_id,
      applied: Object.keys(cleanStats),
      reanalysisQueued,
    }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  } catch (e) {
    console.error('[update-live-match-stats] fatal', e);
    return new Response(JSON.stringify({ error: 'Erro interno' }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});
