// ElevenLabs Speech-to-Text Edge Function
// Transcribes audio files using ElevenLabs Scribe API (batch transcription)
// Keeps API key secure on server-side

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

interface TranscriptionWord {
  text: string;
  start: number;
  end: number;
  speaker?: string;
}

interface TranscriptionResponse {
  text: string;
  words: TranscriptionWord[];
  language_code?: string;
  audio_events?: Array<{
    type: string;
    start: number;
    end: number;
  }>;
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const ELEVENLABS_API_KEY = Deno.env.get('ELEVENLABS_API_KEY');

    if (!ELEVENLABS_API_KEY) {
      console.error('[ElevenLabs-STT] API key not configured');
      return new Response(
        JSON.stringify({ error: 'ElevenLabs API key not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const contentType = req.headers.get('content-type') || '';
    
    let audioBlob: Blob;
    let languageCode = 'por'; // Default to Portuguese
    
    // Handle different content types
    if (contentType.includes('multipart/form-data')) {
      const formData = await req.formData();
      const audioFile = formData.get('audio') as File | null;
      const lang = formData.get('language_code') as string | null;
      
      if (!audioFile) {
        return new Response(
          JSON.stringify({ error: 'No audio file provided' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      
      audioBlob = audioFile;
      if (lang) languageCode = lang;
    } else if (contentType.includes('application/json')) {
      const body = await req.json();
      
      if (body.audioUrl) {
        // Fetch audio from URL
        console.log('[ElevenLabs-STT] Fetching audio from URL:', body.audioUrl);
        const audioResponse = await fetch(body.audioUrl);
        
        if (!audioResponse.ok) {
          return new Response(
            JSON.stringify({ error: 'Failed to fetch audio from URL' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
        
        const audioBuffer = await audioResponse.arrayBuffer();
        audioBlob = new Blob([audioBuffer], { type: 'audio/webm' });
        
        if (body.language_code) languageCode = body.language_code;
      } else if (body.audioBase64) {
        // Decode base64 audio
        const binaryString = atob(body.audioBase64);
        const bytes = new Uint8Array(binaryString.length);
        for (let i = 0; i < binaryString.length; i++) {
          bytes[i] = binaryString.charCodeAt(i);
        }
        audioBlob = new Blob([bytes], { type: body.mimeType || 'audio/webm' });
        
        if (body.language_code) languageCode = body.language_code;
      } else {
        return new Response(
          JSON.stringify({ error: 'No audio data provided (audioUrl or audioBase64 required)' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    } else {
      return new Response(
        JSON.stringify({ error: 'Invalid content type. Use multipart/form-data or application/json' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('[ElevenLabs-STT] Transcribing audio, size:', audioBlob.size, 'bytes');

    // Build form data for ElevenLabs API
    const apiFormData = new FormData();
    apiFormData.append('file', audioBlob, 'audio.webm');
    apiFormData.append('model_id', 'scribe_v2');
    apiFormData.append('language_code', languageCode);
    apiFormData.append('tag_audio_events', 'true');
    apiFormData.append('diarize', 'false'); // Single speaker for game justifications

    const startTime = Date.now();
    
    const response = await fetch('https://api.elevenlabs.io/v1/speech-to-text', {
      method: 'POST',
      headers: {
        'xi-api-key': ELEVENLABS_API_KEY,
      },
      body: apiFormData,
    });

    const processingTime = Date.now() - startTime;

    if (!response.ok) {
      const errorText = await response.text();
      console.error('[ElevenLabs-STT] API error:', response.status, errorText);
      
      // Check for quota exceeded
      if (errorText.includes('quota_exceeded') || response.status === 402) {
        return new Response(
          JSON.stringify({ 
            error: 'QUOTA_EXCEEDED', 
            message: 'Créditos de transcrição esgotados',
            text: '' 
          }),
          { status: 402, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      
      return new Response(
        JSON.stringify({ error: `ElevenLabs STT error: ${response.status}`, text: '' }),
        { status: response.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const transcription: TranscriptionResponse = await response.json();
    
    console.log('[ElevenLabs-STT] ═══════════════════════════════════════');
    console.log('[ElevenLabs-STT] Transcription complete');
    console.log('[ElevenLabs-STT] Text length:', transcription.text?.length || 0);
    console.log('[ElevenLabs-STT] Words:', transcription.words?.length || 0);
    console.log('[ElevenLabs-STT] Processing time:', processingTime, 'ms');
    console.log('[ElevenLabs-STT] ═══════════════════════════════════════');

    return new Response(
      JSON.stringify({
        text: transcription.text || '',
        words: transcription.words || [],
        language_code: transcription.language_code || languageCode,
        audio_events: transcription.audio_events || [],
        processingTimeMs: processingTime,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('[ElevenLabs-STT] Error:', error);
    return new Response(
      JSON.stringify({ 
        error: error instanceof Error ? error.message : 'Unknown error',
        text: '' 
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
