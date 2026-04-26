// =============================================================================
// ANÁLISE MANUAL — Edge Function
// POST /functions/v1/salvar-analise-manual
// Recebe payload do card "Análise Manual", recalcula scores no servidor
// (não confia em scores enviados pelo frontend) e salva em analises_manuais.
// =============================================================================
import { createClient } from "npm:@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

interface AnalisePayload {
  home_team: string;
  away_team: string;
  league_name?: string;
  match_date?: string;
  odd_h?: number; odd_d?: number; odd_a?: number;
  cdg1h?: number; cdg1a?: number;
  cv1h?: number;  cv1a?: number;
  cdg2h?: number; cdg2a?: number;
  cv2h?: number;  cv2a?: number;
  gm_h?: number;  gm_a?: number;
  gm_cv_h?: number; gm_cv_a?: number;
  gs_h?: number;  gs_a?: number;
  gs_cv_h?: number; gs_cv_a?: number;
  o05ht_h?: number; o05ht_a?: number;
  o15ht_h?: number; o15ht_a?: number;
  o052t_h?: number; o052t_a?: number;
  o152t_h?: number; o152t_a?: number;
  o05ft_h?: number; o05ft_a?: number;
  o15ft_h?: number; o15ft_a?: number;
  o25ft_h?: number; o25ft_a?: number;
  o35ft_h?: number; o35ft_a?: number;
  btts_h?: number;  btts_a?: number;
  btts_ht_h?: number; btts_ht_a?: number;
  r_marc1_h?: number; r_marc1_a?: number;
  r_sof1_h?: number;  r_sof1_a?: number;
  esc_ht_avg_h?: number; esc_ht_avg_a?: number;
  esc_ft_avg_h?: number; esc_ft_avg_a?: number;
  fonte?: string;
  observacao?: string;
}

const clamp = (s: number) => Math.max(0, Math.min(100, Math.round(s)));
function avg2(a?: number, b?: number): number | undefined {
  if (a === undefined && b === undefined) return undefined;
  if (a === undefined) return b;
  if (b === undefined) return a;
  return (a + b) / 2;
}

function calcScores(p: AnalisePayload) {
  const scores: Record<string, number> = {};

  // Over 0.5 HT
  let s = 35;
  const o05 = avg2(p.o05ht_h, p.o05ht_a);
  if (o05 !== undefined) { if (o05 > 75) s += 25; else if (o05 > 60) s += 15; else if (o05 < 40) s -= 15; }
  const cdgm05 = avg2(p.cdg1h, p.cdg1a);
  if (cdgm05 !== undefined) { if (cdgm05 < 2.0) s += 12; else if (cdgm05 > 4.0) s -= 10; }
  const gt05 = (p.gm_h ?? 0) + (p.gm_a ?? 0);
  if (gt05 > 2.2) s += 8;
  const rM = avg2(p.r_marc1_h, p.r_marc1_a);
  if (rM !== undefined && rM > 50) s += 6;
  scores.score_over05ht = clamp(s);

  // Over 1.5 HT
  s = 30;
  const o15 = avg2(p.o15ht_h, p.o15ht_a);
  if (o15 !== undefined) { if (o15 > 55) s += 25; else if (o15 > 40) s += 12; else if (o15 < 20) s -= 15; }
  const cdgm15 = avg2(p.cdg1h, p.cdg1a);
  if (cdgm15 !== undefined) { if (cdgm15 < 1.8) s += 15; else if (cdgm15 > 3.5) s -= 10; }
  const gt15 = (p.gm_h ?? 0) + (p.gm_a ?? 0);
  if (gt15 > 3.0) s += 10;
  const bttsHT = avg2(p.btts_ht_h, p.btts_ht_a);
  if (bttsHT !== undefined && bttsHT > 40) s += 6;
  scores.score_over15ht = clamp(s);

  // Over 2.5 FT
  s = 35;
  const o25 = avg2(p.o25ft_h, p.o25ft_a);
  if (o25 !== undefined) { if (o25 > 65) s += 22; else if (o25 > 50) s += 12; else if (o25 < 35) s -= 18; }
  const gt25 = (p.gm_h ?? 0) + (p.gm_a ?? 0);
  if (gt25 > 2.5) s += 14; else if (gt25 > 0 && gt25 < 1.8) s -= 12;
  const cdgm25 = avg2(p.cdg1h, p.cdg1a);
  if (cdgm25 !== undefined) { if (cdgm25 < 2.0) s += 10; else if (cdgm25 > 4.0) s -= 8; }
  const btts25 = avg2(p.btts_h, p.btts_a);
  if (btts25 !== undefined && btts25 > 55) s += 8;
  const o15m25 = avg2(p.o15ht_h, p.o15ht_a);
  if (o15m25 !== undefined && o15m25 > 45) s += 5;
  scores.score_over25ft = clamp(s);

  // Over 3.5 FT
  s = 25;
  const o35 = avg2(p.o35ft_h, p.o35ft_a);
  if (o35 !== undefined) { if (o35 > 50) s += 30; else if (o35 > 35) s += 18; else if (o35 < 15) s -= 15; }
  const gt35 = (p.gm_h ?? 0) + (p.gm_a ?? 0);
  if (gt35 > 3.0) s += 14;
  const cdgm35 = avg2(p.cdg1h, p.cdg1a);
  if (cdgm35 !== undefined && cdgm35 < 1.5) s += 15;
  scores.score_over35ft = clamp(s);

  // Under 2.5 FT
  s = 35;
  const u25h = p.o25ft_h !== undefined ? 100 - p.o25ft_h : undefined;
  const u25a = p.o25ft_a !== undefined ? 100 - p.o25ft_a : undefined;
  const u25 = avg2(u25h, u25a);
  if (u25 !== undefined) { if (u25 > 65) s += 22; else if (u25 > 50) s += 12; else if (u25 < 30) s -= 20; }
  const cdgmU = avg2(p.cdg1h, p.cdg1a);
  if (cdgmU !== undefined) { if (cdgmU > 3.5) s += 15; else if (cdgmU < 1.5) s -= 12; }
  const gtU = (p.gm_h ?? 0) + (p.gm_a ?? 0);
  if (gtU > 0) { if (gtU < 2.0) s += 12; else if (gtU > 3.0) s -= 12; }
  scores.score_under25ft = clamp(s);

  // BTTS FT
  s = 35;
  const btmFT = avg2(p.btts_h, p.btts_a);
  if (btmFT !== undefined) { if (btmFT > 65) s += 22; else if (btmFT > 50) s += 12; else if (btmFT < 30) s -= 18; }
  if (p.gm_h && p.gm_a) {
    if (p.gm_h > 1.2 && p.gm_a > 1.2) s += 12;
    else if (p.gm_h < 0.8 || p.gm_a < 0.8) s -= 12;
  }
  if (p.gs_h && p.gs_a) {
    if (p.gs_h > 1.0 && p.gs_a > 1.0) s += 10;
    else if (p.gs_h < 0.5 || p.gs_a < 0.5) s -= 8;
  }
  scores.score_bttsft = clamp(s);

  // Lay Goleada
  s = 40;
  if (p.cdg1h) { if (p.cdg1h > 3.5) s += 10; else if (p.cdg1h > 2.0) s += 5; else if (p.cdg1h <= 1.5) s -= 10; }
  if (p.cdg1a) { if (p.cdg1a > 3.5) s += 10; else if (p.cdg1a > 2.0) s += 5; else if (p.cdg1a <= 1.5) s -= 10; }
  if (p.cv1h && p.cv1h < 0.5) s += 4;
  if (p.cv1a && p.cv1a < 0.5) s += 4;
  if (p.gm_h) { if (p.gm_h < 1.3) s += 6; else if (p.gm_h > 2.5) s -= 12; }
  if (p.gm_a) { if (p.gm_a < 1.3) s += 6; else if (p.gm_a > 2.5) s -= 12; }
  const o35mGL = avg2(p.o35ft_h, p.o35ft_a);
  if (o35mGL !== undefined) { if (o35mGL < 20) s += 10; else if (o35mGL > 40) s -= 14; }
  if (p.odd_h && p.odd_h < 1.4) s -= 25;
  if (p.odd_a && p.odd_a < 1.4) s -= 25;
  scores.score_lay_goleada = clamp(s);

  // Lay 2x2
  s = 35;
  const o25m2x2 = avg2(p.o25ft_h, p.o25ft_a);
  if (o25m2x2 !== undefined) { if (o25m2x2 > 60) s += 15; else if (o25m2x2 < 30) s -= 10; }
  const btm2x2 = avg2(p.btts_h, p.btts_a);
  if (btm2x2 !== undefined) { if (btm2x2 > 60) s += 12; else if (btm2x2 < 30) s -= 10; }
  const gt2x2 = (p.gm_h ?? 0) + (p.gm_a ?? 0);
  if (gt2x2 > 3.0) s += 8; else if (gt2x2 > 0 && gt2x2 < 1.8) s -= 5;
  scores.score_lay_2x2 = clamp(s);

  // Lay 1x3 / 3x1
  s = 35;
  if (p.odd_h && p.odd_a) {
    const d = Math.abs(p.odd_h - p.odd_a);
    if (d > 2.5) s += 18; else if (d > 1.5) s += 10; else if (d < 0.8) s -= 10;
  }
  const o35m1x3 = avg2(p.o35ft_h, p.o35ft_a);
  if (o35m1x3 !== undefined && o35m1x3 > 20) s -= 12;
  if (p.gm_h && p.gm_a) {
    const maior = Math.max(p.gm_h, p.gm_a);
    const menor = Math.min(p.gm_h, p.gm_a);
    if (menor > 0 && maior / menor > 2) s += 10;
  }
  scores.score_lay_1x3 = clamp(s);

  // Handicap Asiático (favoritismo + ataque/defesa)
  s = 30;
  if (p.odd_h && p.odd_a) {
    const d = Math.abs(p.odd_h - p.odd_a);
    if (d > 2.5) s += 25;
    else if (d > 1.5) s += 15;
    else if (d > 0.7) s += 8;
    else s -= 12;
    const favHome = p.odd_h < p.odd_a;
    const ataqueFav = favHome ? (p.gm_h ?? 0) : (p.gm_a ?? 0);
    const defesaUnd = favHome ? (p.gs_a ?? 0) : (p.gs_h ?? 0);
    if (ataqueFav > 1.5 && defesaUnd > 1.2) s += 12;
    else if (ataqueFav > 0 && ataqueFav < 1.0) s -= 10;
    const cdgFav = favHome ? p.cdg1h : p.cdg1a;
    if (cdgFav !== undefined) {
      if (cdgFav < 2.0) s += 8;
      else if (cdgFav > 4.0) s -= 10;
    }
  } else {
    s = 0;
  }
  scores.score_handicap_asiatico = clamp(s);

  return scores;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Método não permitido" }), {
      status: 405, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Token não fornecido" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUser = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error: authError } = await supabaseUser.auth.getUser();
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Usuário não autenticado" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const payload = (await req.json()) as AnalisePayload;
    if (!payload?.home_team || !payload?.away_team) {
      return new Response(JSON.stringify({ error: "home_team e away_team são obrigatórios" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const scores = calcScores(payload);

    const scoreMap: Record<string, number> = {
      "Over 0.5 HT":       scores.score_over05ht,
      "Over 1.5 HT":       scores.score_over15ht,
      "Over 2.5 FT":       scores.score_over25ft,
      "Over 3.5 FT":       scores.score_over35ft,
      "Under 2.5 FT":      scores.score_under25ft,
      "BTTS FT":           scores.score_bttsft,
      "Lay Goleada":       scores.score_lay_goleada,
      "Lay 2x2":           scores.score_lay_2x2,
      "Lay 1x3/3x1":       scores.score_lay_1x3,
      "Handicap Asiático": scores.score_handicap_asiatico,
    };
    const scoreValues = Object.values(scoreMap);
    const melhorScore = Math.max(...scoreValues);
    const melhorSinal = Object.keys(scoreMap).find((k) => scoreMap[k] === melhorScore) ?? "";
    const sinaisAprovados   = scoreValues.filter((v) => v >= 65).length;
    const sinaisAtencao     = scoreValues.filter((v) => v >= 45 && v < 65).length;
    const sinaisDescartados = scoreValues.filter((v) => v < 45).length;

    const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
      auth: { persistSession: false },
    });

    const { data, error } = await supabaseAdmin.from("analises_manuais").insert({
      user_id: user.id,
      home_team: payload.home_team,
      away_team: payload.away_team,
      league_name: payload.league_name ?? null,
      match_date: payload.match_date ?? null,
      odd_h: payload.odd_h ?? null, odd_d: payload.odd_d ?? null, odd_a: payload.odd_a ?? null,
      cdg1h: payload.cdg1h ?? null, cdg1a: payload.cdg1a ?? null,
      cv1h: payload.cv1h ?? null,   cv1a: payload.cv1a ?? null,
      cdg2h: payload.cdg2h ?? null, cdg2a: payload.cdg2a ?? null,
      cv2h: payload.cv2h ?? null,   cv2a: payload.cv2a ?? null,
      gm_h: payload.gm_h ?? null,   gm_a: payload.gm_a ?? null,
      gm_cv_h: payload.gm_cv_h ?? null, gm_cv_a: payload.gm_cv_a ?? null,
      gs_h: payload.gs_h ?? null,   gs_a: payload.gs_a ?? null,
      gs_cv_h: payload.gs_cv_h ?? null, gs_cv_a: payload.gs_cv_a ?? null,
      o05ht_h: payload.o05ht_h ?? null, o05ht_a: payload.o05ht_a ?? null,
      o15ht_h: payload.o15ht_h ?? null, o15ht_a: payload.o15ht_a ?? null,
      o052t_h: payload.o052t_h ?? null, o052t_a: payload.o052t_a ?? null,
      o152t_h: payload.o152t_h ?? null, o152t_a: payload.o152t_a ?? null,
      o05ft_h: payload.o05ft_h ?? null, o05ft_a: payload.o05ft_a ?? null,
      o15ft_h: payload.o15ft_h ?? null, o15ft_a: payload.o15ft_a ?? null,
      o25ft_h: payload.o25ft_h ?? null, o25ft_a: payload.o25ft_a ?? null,
      o35ft_h: payload.o35ft_h ?? null, o35ft_a: payload.o35ft_a ?? null,
      btts_h: payload.btts_h ?? null, btts_a: payload.btts_a ?? null,
      btts_ht_h: payload.btts_ht_h ?? null, btts_ht_a: payload.btts_ht_a ?? null,
      r_marc1_h: payload.r_marc1_h ?? null, r_marc1_a: payload.r_marc1_a ?? null,
      r_sof1_h: payload.r_sof1_h ?? null,   r_sof1_a: payload.r_sof1_a ?? null,
      esc_ht_avg_h: payload.esc_ht_avg_h ?? null, esc_ht_avg_a: payload.esc_ht_avg_a ?? null,
      esc_ft_avg_h: payload.esc_ft_avg_h ?? null, esc_ft_avg_a: payload.esc_ft_avg_a ?? null,
      ...scores,
      melhor_sinal: melhorSinal,
      melhor_score: melhorScore,
      sinais_aprovados: sinaisAprovados,
      sinais_atencao: sinaisAtencao,
      sinais_descartados: sinaisDescartados,
      fonte: payload.fonte ?? "sherlock",
      observacao: payload.observacao ?? null,
    }).select().single();

    if (error) {
      console.error("[ANALISE MANUAL] erro insert:", error.message);
      return new Response(JSON.stringify({ error: "Erro ao salvar análise: " + error.message }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({
      success: true,
      analise: {
        id: data.id,
        jogo: `${payload.home_team} x ${payload.away_team}`,
        melhor_sinal: melhorSinal,
        melhor_score: melhorScore,
        sinais_aprovados: sinaisAprovados,
        sinais_atencao: sinaisAtencao,
        sinais_descartados: sinaisDescartados,
        scores,
        created_at: data.created_at,
      },
    }), {
      status: 201, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("[ANALISE MANUAL] erro crítico:", err);
    return new Response(JSON.stringify({ error: err instanceof Error ? err.message : String(err) }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
