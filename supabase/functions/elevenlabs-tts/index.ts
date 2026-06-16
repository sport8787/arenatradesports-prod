/**
 * elevenlabs-tts — Gera áudio TTS via ElevenLabs e retorna como audio/mpeg.
 *
 * POST body:
 *   text       string   — texto a narrar (max 600 chars)
 *   voice_id?  string   — ID da voz (padrão: Rachel = 21m00Tcm4TlvDq8ikWAM)
 *   cache_key? string   — ex: "dilma_Brasil_Hexa.mp3"; se fornecido, faz
 *                         lookup/upload no bucket audio-cache do Supabase Storage
 *                         e retorna JSON { audioUrl } em vez de bytes brutos.
 *
 * Secrets necessários (Supabase Dashboard → Project Settings → Edge Functions):
 *   ELEVENLABS_API_KEY   — chave da API ElevenLabs
 *   ELEVENLABS_VOICE_ID  — ID de voz padrão (opcional; fallback = Rachel)
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const ELEVENLABS_API_KEY = Deno.env.get('ELEVENLABS_API_KEY');
    if (!ELEVENLABS_API_KEY) {
      return new Response(JSON.stringify({ error: 'ELEVENLABS_API_KEY nao configurada' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const body = await req.json();
    const text: string = (body.text ?? '').trim();
    if (!text || text.length > 600) {
      return new Response(JSON.stringify({ error: 'text invalido ou muito longo (max 600 chars)' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Aceita snake_case (voice_id) e camelCase (voiceId) para compatibilidade
    const voiceId: string =
      body.voice_id ?? body.voiceId ??
      Deno.env.get('ELEVENLABS_VOICE_ID') ??
      '21m00Tcm4TlvDq8ikWAM'; // Rachel — voz feminina padrão

    const cacheKey: string | null = body.cache_key ?? body.cacheKey ?? null;

    // ── Supabase Storage cache ─────────────────────────────────────────────────
    let supabase: ReturnType<typeof createClient> | null = null;
    if (cacheKey) {
      supabase = createClient(
        Deno.env.get('SUPABASE_URL')!,
        Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
      );

      // Verifica se já existe no cache
      const { data: existing } = await supabase.storage
        .from('audio-cache')
        .list('', { search: cacheKey });

      if (existing && existing.length > 0) {
        const { data: { publicUrl } } = supabase.storage
          .from('audio-cache')
          .getPublicUrl(cacheKey);
        console.log(`[elevenlabs-tts] cache hit: ${cacheKey}`);
        return new Response(JSON.stringify({ audioUrl: publicUrl }), {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
    }

    // ── Chamada ElevenLabs ─────────────────────────────────────────────────────
    const ttsRes = await fetch(
      `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`,
      {
        method: 'POST',
        headers: {
          'xi-api-key': ELEVENLABS_API_KEY,
          'Content-Type': 'application/json',
          Accept: 'audio/mpeg',
        },
        body: JSON.stringify({
          text,
          model_id: 'eleven_multilingual_v2',
          voice_settings: {
            stability: body.stability ?? 0.50,
            similarity_boost: body.similarityBoost ?? 0.75,
            style: body.style ?? 0.20,
            use_speaker_boost: body.useSpeakerBoost ?? true,
            speed: body.speed ?? 1.0,
          },
        }),
      }
    );

    if (!ttsRes.ok) {
      const errText = await ttsRes.text();
      console.error('[elevenlabs-tts] API error:', ttsRes.status, errText);
      return new Response(JSON.stringify({ error: `ElevenLabs ${ttsRes.status}`, detail: errText }), {
        status: 502,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const audioBuffer = await ttsRes.arrayBuffer();

    // ── Upload ao Storage e retorna URL pública ────────────────────────────────
    if (cacheKey && supabase) {
      const { error: uploadError } = await supabase.storage
        .from('audio-cache')
        .upload(cacheKey, audioBuffer, { contentType: 'audio/mpeg', upsert: true });

      if (!uploadError) {
        const { data: { publicUrl } } = supabase.storage
          .from('audio-cache')
          .getPublicUrl(cacheKey);
        console.log(`[elevenlabs-tts] cached: ${cacheKey} (${audioBuffer.byteLength} bytes)`);
        return new Response(JSON.stringify({ audioUrl: publicUrl }), {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      console.error('[elevenlabs-tts] storage upload error:', uploadError);
      // Falha no upload → devolve bytes brutos como fallback
    }

    // ── Fallback: base64 data URL (funciona em mobile e sem bucket Storage) ──
    const uint8 = new Uint8Array(audioBuffer);
    let binary = '';
    const chunkSize = 8192;
    for (let i = 0; i < uint8.length; i += chunkSize) {
      binary += String.fromCharCode(...uint8.subarray(i, i + chunkSize));
    }
    const base64 = btoa(binary);
    return new Response(
      JSON.stringify({ audioUrl: `data:audio/mpeg;base64,${base64}` }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      },
    );
  } catch (e) {
    console.error('[elevenlabs-tts] exception:', e);
    return new Response(JSON.stringify({ error: String((e as Error).message) }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
