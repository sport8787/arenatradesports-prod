import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { prompt, duration, cacheKey } = await req.json();

    const ELEVENLABS_API_KEY = Deno.env.get("ELEVENLABS_API_KEY");
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!ELEVENLABS_API_KEY) {
      throw new Error("ELEVENLABS_API_KEY is not configured");
    }

    if (!prompt) {
      throw new Error("prompt is required");
    }

    const normalizedPrompt = String(prompt).trim();
    const durationSeconds = Number(duration) || 3;

    // Optional caching via Storage (public URLs)
    if (cacheKey && SUPABASE_URL && SUPABASE_SERVICE_ROLE_KEY) {
      const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
      try {
        const { data: existingFiles } = await supabase.storage
          .from("audio-cache")
          .list("", { search: cacheKey });

        if (existingFiles && existingFiles.some((f) => f.name === cacheKey)) {
          const { data: { publicUrl } } = supabase.storage
            .from("audio-cache")
            .getPublicUrl(cacheKey);

          console.log("🟢 SFX CACHE HIT:", cacheKey);
          return new Response(JSON.stringify({ audioUrl: publicUrl, cached: true }), {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        console.log("🔴 SFX CACHE MISS:", cacheKey);
      } catch (cacheError) {
        console.warn("SFX cache check error:", cacheError);
      }
    }

    console.log("Generating sound effect:", normalizedPrompt, "duration:", durationSeconds);

    const response = await fetch("https://api.elevenlabs.io/v1/sound-generation", {
      method: "POST",
      headers: {
        "xi-api-key": ELEVENLABS_API_KEY,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        text: normalizedPrompt,
        duration_seconds: durationSeconds,
        prompt_influence: 0.3,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("ElevenLabs API error:", response.status, errorText);

      // SFX are optional — don't fail the whole app with a 500.
      return new Response(
        JSON.stringify({
          error: `ElevenLabs API error: ${response.status}`,
          detail: errorText,
        }),
        {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const audioBuffer = await response.arrayBuffer();
    console.log("Sound effect generated, size:", audioBuffer.byteLength);

    // Upload to cache if requested
    if (cacheKey && SUPABASE_URL && SUPABASE_SERVICE_ROLE_KEY) {
      const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
      try {
        const { error: uploadError } = await supabase.storage
          .from("audio-cache")
          .upload(cacheKey, audioBuffer, {
            contentType: "audio/mpeg",
            upsert: true,
          });

        if (!uploadError) {
          const { data: { publicUrl } } = supabase.storage
            .from("audio-cache")
            .getPublicUrl(cacheKey);

          console.log("SFX cached at:", publicUrl);
          return new Response(JSON.stringify({ audioUrl: publicUrl, cached: false }), {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        console.error("SFX cache upload error:", uploadError);
      } catch (cacheError) {
        console.error("SFX cache storage error:", cacheError);
      }
    }

    // Fallback: return audio directly
    return new Response(audioBuffer, {
      headers: {
        ...corsHeaders,
        "Content-Type": "audio/mpeg",
      },
    });
  } catch (error) {
    console.error("Error in generate-sfx function:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";

    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
