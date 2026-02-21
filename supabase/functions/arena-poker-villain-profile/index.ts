import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

function getSupabaseAdmin() {
  return createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );
}

async function sha256(text: string): Promise<string> {
  const data = new TextEncoder().encode(text);
  const hash = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(hash)).map(b => b.toString(16).padStart(2, "0")).join("");
}

async function getCache(cacheKey: string) {
  try {
    const sb = getSupabaseAdmin();
    const { data } = await sb
      .from("ai_response_cache")
      .select("id, response_json")
      .eq("cache_key", cacheKey)
      .gt("expires_at", new Date().toISOString())
      .maybeSingle();
    if (data) {
      await sb.from("ai_response_cache").update({ hit_count: (data as any).hit_count + 1 }).eq("id", data.id);
      return data.response_json;
    }
  } catch (e) {
    console.warn("Cache read error:", e);
  }
  return null;
}

async function setCache(cacheKey: string, functionName: string, response: any) {
  try {
    const sb = getSupabaseAdmin();
    await sb.from("ai_response_cache").upsert({
      cache_key: cacheKey,
      function_name: functionName,
      response_json: response,
      expires_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
    }, { onConflict: "cache_key" });
  } catch (e) {
    console.warn("Cache write error:", e);
  }
}

const SYSTEM_PROMPT = `Você é um analista de poker de elite especializado em profiling de jogadores adversários.

Analise as mãos fornecidas e extraia informações sobre TODOS os jogadores que NÃO são o Hero.

Para cada jogador identificado, forneça:
1. Estatísticas estimadas baseadas nas ações observadas
2. Estilo de jogo identificado
3. Tendências exploráveis
4. Nível de perigo (1-10)
5. Tags descritivas

Responda APENAS com JSON válido:
{
  "players": [
    {
      "name": "<nome exato do jogador como aparece no HH>",
      "hands_observed": <número de mãos onde o jogador aparece>,
      "hands_won": <mãos que o jogador ganhou>,
      "estimated_vpip": <0-100>,
      "estimated_pfr": <0-100>,
      "estimated_aggression": <0-100, onde 100 é extremamente agressivo>,
      "estimated_3bet": <0-100>,
      "estimated_fold_to_3bet": <0-100>,
      "showdown_frequency": <0-100>,
      "style_summary": "<resumo do estilo em 2-3 frases, ex: 'Jogador tight-aggressive que abre muitos potes em posição tardia...'>",
      "exploitable_tendencies": "<tendências exploráveis em 2-3 frases>",
      "danger_level": "<low|medium|high|elite>",
      "tags": ["tag1", "tag2"],
      "notable_plays": "<jogadas notáveis observadas, máximo 2 frases>",
      "all_ins": <número de all-ins>,
      "showdowns": <número de showdowns>,
      "biggest_pot_bb": <maior pote em BBs>
    }
  ],
  "hero_name": "<nome do Hero identificado>"
}

REGRAS:
- NÃO inclua o Hero na lista de players
- Se um jogador aparece em poucas mãos, as estimativas de stats devem ser mais conservadoras
- Tags devem ser curtas e descritivas: "calling_station", "LAG", "nit", "3bet_light", "bluff_catcher", etc.
- Responda APENAS com JSON válido`;

async function callGeminiAI(systemPrompt: string, userPrompt: string) {
  const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY");
  if (!GEMINI_API_KEY) throw new Error("GEMINI_API_KEY not configured");

  let lastError: Error | null = null;
  for (let attempt = 0; attempt < 3; attempt++) {
    if (attempt > 0) {
      await new Promise(r => setTimeout(r, 2000 * Math.pow(2, attempt - 1)));
    }
    try {
      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_API_KEY}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            contents: [{ role: "user", parts: [{ text: `${systemPrompt}\n\n${userPrompt}` }] }],
            generationConfig: { responseMimeType: "application/json" },
          }),
        }
      );
      if (response.status === 429) { lastError = new Error("RATE_LIMITED"); continue; }
      if (!response.ok) {
        const body = await response.text();
        console.error(`Gemini API error [${response.status}]:`, body);
        throw new Error(`AI_ERROR_${response.status}`);
      }
      const data = await response.json();
      const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
      if (!text) throw new Error("No content in Gemini response");
      const cleaned = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
      return JSON.parse(cleaned);
    } catch (e) {
      if (e instanceof Error && e.message === "RATE_LIMITED") { lastError = e; continue; }
      throw e;
    }
  }
  throw lastError || new Error("RATE_LIMITED");
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { hands, platform, userId, fileId } = await req.json();
    if (!hands || !Array.isArray(hands) || hands.length < 1) {
      return new Response(
        JSON.stringify({ error: "At least 1 hand is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const fullContent = hands.join("\n\n");
    const cacheKey = await sha256(`villain-profile:${fullContent.trim()}`);
    const cached = await getCache(cacheKey);
    if (cached) {
      return new Response(
        JSON.stringify({ ...cached, _cached: true }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const userPrompt = hands
      .map((h: string, i: number) => `--- MÃO #${i + 1} ---\n${h}`)
      .join("\n\n");

    const result = await callGeminiAI(
      SYSTEM_PROMPT,
      `Analise os seguintes ${hands.length} hand histories e perfil todos os jogadores adversários:\n\n${userPrompt}`
    );

    // Save villain profiles to database if userId is provided
    if (userId && result.players) {
      const sb = getSupabaseAdmin();
      for (const player of result.players) {
        // Upsert villain profile
        const { data: existing } = await sb
          .from("villain_profiles")
          .select("id, times_seen, total_hands_against")
          .eq("user_id", userId)
          .eq("player_name", player.name)
          .eq("platform", platform || "unknown")
          .maybeSingle();

        if (existing) {
          await sb.from("villain_profiles").update({
            times_seen: existing.times_seen + 1,
            total_hands_against: existing.total_hands_against + (player.hands_observed || 0),
            estimated_vpip: player.estimated_vpip,
            estimated_pfr: player.estimated_pfr,
            estimated_aggression: player.estimated_aggression,
            estimated_3bet: player.estimated_3bet,
            estimated_fold_to_3bet: player.estimated_fold_to_3bet,
            showdown_frequency: player.showdown_frequency,
            ai_style_summary: player.style_summary,
            ai_exploitable_tendencies: player.exploitable_tendencies,
            ai_danger_level: player.danger_level,
            tags: player.tags || [],
            last_seen_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          }).eq("id", existing.id);

          // Insert session stats
          if (fileId) {
            await sb.from("villain_session_stats").insert({
              villain_profile_id: existing.id,
              uploaded_file_id: fileId,
              user_id: userId,
              hands_played: player.hands_observed || 0,
              hands_won: player.hands_won || 0,
              vpip_session: player.estimated_vpip,
              pfr_session: player.estimated_pfr,
              aggression_session: player.estimated_aggression,
              showdowns: player.showdowns || 0,
              all_ins: player.all_ins || 0,
              biggest_pot_bb: player.biggest_pot_bb,
              notable_plays: player.notable_plays,
            });
          }
        } else {
          const { data: newProfile } = await sb.from("villain_profiles").insert({
            user_id: userId,
            player_name: player.name,
            platform: platform || "unknown",
            times_seen: 1,
            total_hands_against: player.hands_observed || 0,
            estimated_vpip: player.estimated_vpip,
            estimated_pfr: player.estimated_pfr,
            estimated_aggression: player.estimated_aggression,
            estimated_3bet: player.estimated_3bet,
            estimated_fold_to_3bet: player.estimated_fold_to_3bet,
            showdown_frequency: player.showdown_frequency,
            ai_style_summary: player.style_summary,
            ai_exploitable_tendencies: player.exploitable_tendencies,
            ai_danger_level: player.danger_level,
            tags: player.tags || [],
          }).select("id").single();

          if (newProfile && fileId) {
            await sb.from("villain_session_stats").insert({
              villain_profile_id: newProfile.id,
              uploaded_file_id: fileId,
              user_id: userId,
              hands_played: player.hands_observed || 0,
              hands_won: player.hands_won || 0,
              vpip_session: player.estimated_vpip,
              pfr_session: player.estimated_pfr,
              aggression_session: player.estimated_aggression,
              showdowns: player.showdowns || 0,
              all_ins: player.all_ins || 0,
              biggest_pot_bb: player.biggest_pot_bb,
              notable_plays: player.notable_plays,
            });
          }
        }
      }
    }

    setCache(cacheKey, "arena-poker-villain-profile", result);

    return new Response(
      JSON.stringify({ ...result, _cached: false }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    console.error("arena-poker-villain-profile error:", e);
    const msg = e instanceof Error ? e.message : "Unknown error";
    const status = msg === "RATE_LIMITED" ? 429 : 500;
    return new Response(
      JSON.stringify({ error: msg }),
      { status, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
