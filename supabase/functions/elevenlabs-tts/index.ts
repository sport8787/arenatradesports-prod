/**
 * elevenlabs-tts — Gera áudio TTS via ElevenLabs e retorna como audio/mpeg.
 *
 * POST body: { text: string, voice_id?: string }
 *
 * Secrets necessários (Supabase Dashboard → Project Settings → Edge Functions):
 *   ELEVENLABS_API_KEY   — chave da API ElevenLabs
 *   ELEVENLABS_VOICE_ID  — ID da voz (padrão: Rachel = 21m00Tcm4TlvDq8ikWAM)
 */

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
    if (!text || text.length > 300) {
      return new Response(JSON.stringify({ error: 'text invalido ou muito longo (max 300 chars)' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const voiceId =
      body.voice_id ??
      Deno.env.get('ELEVENLABS_VOICE_ID') ??
      'N2lVS1w4EtoT3dr4eOWO'; // Callum — voz oficial do Horus

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
            stability: 0.45,
            similarity_boost: 0.80,
            style: 0.0,
            use_speaker_boost: true,
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

    return new Response(audioBuffer, {
      status: 200,
      headers: {
        ...corsHeaders,
        'Content-Type': 'audio/mpeg',
        'Content-Length': String(audioBuffer.byteLength),
        'Cache-Control': 'private, max-age=3600',
      },
    });
  } catch (e) {
    console.error('[elevenlabs-tts] exception:', e);
    return new Response(JSON.stringify({ error: String((e as Error).message) }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
