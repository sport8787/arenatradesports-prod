import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'npm:@supabase/supabase-js@2';
import { encode as base64Encode } from "https://deno.land/std@0.168.0/encoding/base64.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { text, voiceId, stability, similarityBoost, style, useSpeakerBoost, speed, uploadToStorage, roomId, cacheKey } = await req.json();
    const ELEVENLABS_API_KEY = Deno.env.get('ELEVENLABS_API_KEY');
    const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    if (!ELEVENLABS_API_KEY) {
      throw new Error('ELEVENLABS_API_KEY is not configured');
    }

    if (!text) {
      throw new Error('Text is required');
    }

    // CRITICAL: Normalize text for consistent caching
    const normalizedText = text.trim();

    // Default to George voice if not specified
    const voice = voiceId || 'JBFqnCBsd6RMkjVDRZzb';

    // If cacheKey provided, check cache first
    if (cacheKey && SUPABASE_URL && SUPABASE_SERVICE_ROLE_KEY) {
      const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
      
      try {
        // Check if cached audio exists
        const { data: existingFiles } = await supabase.storage
          .from('audio-cache')
          .list('', { search: cacheKey });

        if (existingFiles && existingFiles.length > 0 && existingFiles.some(f => f.name === cacheKey)) {
          const { data: { publicUrl } } = supabase.storage
            .from('audio-cache')
            .getPublicUrl(cacheKey);
          
          console.log('🟢 CACHE HIT:', cacheKey, '->', publicUrl);
          
          return new Response(
            JSON.stringify({ audioUrl: publicUrl, cached: true }),
            {
              headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            }
          );
        }
        console.log('🔴 CACHE MISS:', cacheKey, '- Calling ElevenLabs API');
      } catch (cacheError) {
        console.warn('Cache check error:', cacheError);
      }
    }

    console.log('🔴 GENERATING TTS for voice:', voice, 'text length:', normalizedText.length, 'chars');

    // Retry logic for rate limiting (429 errors)
    let lastError: Error | null = null;
    const maxRetries = 3;
    
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        const response = await fetch(
          `https://api.elevenlabs.io/v1/text-to-speech/${voice}`,
          {
            method: 'POST',
            headers: {
              'xi-api-key': ELEVENLABS_API_KEY,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              text: normalizedText,
              model_id: 'eleven_turbo_v2_5',
              output_format: 'mp3_44100_128',
              voice_settings: {
                stability: stability ?? 0.5,
                similarity_boost: similarityBoost ?? 0.75,
                style: style ?? 0.5,
                use_speaker_boost: useSpeakerBoost ?? true,
                speed: speed ?? 1.0,
              },
            }),
          }
        );

        if (!response.ok) {
          const errorText = await response.text();
          console.error('ElevenLabs API error:', response.status, errorText);
          
          // Check for quota exceeded
          if (errorText.includes('quota_exceeded')) {
            console.error('🚨 QUOTA EXCEEDED - No more ElevenLabs credits');
            return new Response(
              JSON.stringify({ 
                error: 'QUOTA_EXCEEDED', 
                message: 'Créditos do ElevenLabs esgotados. Use áudios locais.',
                skipTTS: true 
              }),
              {
                status: 402, // Payment Required
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
              }
            );
          }
          
          // Check for 401 Unauthorized (invalid API key or unusual activity detected)
          if (response.status === 401) {
            console.error('🚨 API KEY INVALID or UNUSUAL ACTIVITY - TTS disabled');
            return new Response(
              JSON.stringify({ 
                error: 'API_KEY_INVALID', 
                message: 'Chave API ElevenLabs inválida ou atividade incomum detectada.',
                skipTTS: true 
              }),
              {
                status: 401,
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
              }
            );
          }
          
          // Check for 403 Forbidden
          if (response.status === 403) {
            console.error('🚨 API KEY FORBIDDEN - TTS disabled');
            return new Response(
              JSON.stringify({ 
                error: 'API_KEY_FORBIDDEN', 
                message: 'Acesso negado pela ElevenLabs.',
                skipTTS: true 
              }),
              {
                status: 403,
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
              }
            );
          }
          
          if (response.status === 429) {
            console.warn(`⚠️ Rate limited (attempt ${attempt}/${maxRetries})`);
            
            if (attempt < maxRetries) {
              const waitTime = Math.pow(2, attempt) * 1000;
              console.log(`⏳ Waiting ${waitTime}ms before retry...`);
              await new Promise(resolve => setTimeout(resolve, waitTime));
              continue;
            }
            
            throw new Error('ElevenLabs API error: 429 - Rate limited after retries');
          }
          
          throw new Error(`ElevenLabs API error: ${response.status}`);
        }

        const audioBuffer = await response.arrayBuffer();
        console.log('TTS generated, size:', audioBuffer.byteLength);

        // If cacheKey provided, upload to audio-cache bucket
        if (cacheKey && SUPABASE_URL && SUPABASE_SERVICE_ROLE_KEY) {
          const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
          
          try {
            const { error: uploadError } = await supabase.storage
              .from('audio-cache')
              .upload(cacheKey, audioBuffer, {
                contentType: 'audio/mpeg',
                upsert: true,
              });

            if (uploadError) {
              console.error('Cache upload error:', uploadError);
            } else {
              const { data: { publicUrl } } = supabase.storage
                .from('audio-cache')
                .getPublicUrl(cacheKey);
              
              console.log('Audio cached at:', publicUrl);
              
              return new Response(
                JSON.stringify({ audioUrl: publicUrl, cached: false }),
                {
                  headers: { ...corsHeaders, 'Content-Type': 'application/json' },
                }
              );
            }
          } catch (cacheError) {
            console.error('Cache storage error:', cacheError);
          }
        }

        // If uploadToStorage is requested (for room sync), upload to game-audio bucket
        if (uploadToStorage && SUPABASE_URL && SUPABASE_SERVICE_ROLE_KEY) {
          const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
          
          const fileName = `tts/${roomId || 'general'}/${Date.now()}_${Math.random().toString(36).substr(2, 9)}.mp3`;
          
          const { data: uploadData, error: uploadError } = await supabase.storage
            .from('game-audio')
            .upload(fileName, audioBuffer, {
              contentType: 'audio/mpeg',
              upsert: false,
            });

          if (uploadError) {
            console.error('Storage upload error:', uploadError);
            throw new Error(`Storage upload error: ${uploadError.message}`);
          }

          // Get public URL
          const { data: { publicUrl } } = supabase.storage
            .from('game-audio')
            .getPublicUrl(fileName);

          console.log('Audio uploaded to storage:', publicUrl);

          return new Response(
            JSON.stringify({ audioUrl: publicUrl, size: audioBuffer.byteLength }),
            {
              headers: {
                ...corsHeaders,
                'Content-Type': 'application/json',
              },
            }
          );
        }

        // Return audio directly as before
        return new Response(audioBuffer, {
          headers: {
            ...corsHeaders,
            'Content-Type': 'audio/mpeg',
          },
        });
        
      } catch (error) {
        lastError = error as Error;
        if (attempt < maxRetries) {
          const waitTime = Math.pow(2, attempt) * 1000;
          console.log(`⏳ Error occurred, waiting ${waitTime}ms before retry...`);
          await new Promise(resolve => setTimeout(resolve, waitTime));
        }
      }
    }
    
    // All retries failed
    throw lastError || new Error('ElevenLabs API error after retries');

  } catch (error) {
    console.error('Error in elevenlabs-tts function:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    
    // Return specific status for rate limiting
    const isRateLimited = errorMessage.includes('429');
    
    return new Response(
      JSON.stringify({ error: errorMessage, retryAfter: isRateLimited ? 5 : undefined }),
      {
        status: isRateLimited ? 429 : 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
