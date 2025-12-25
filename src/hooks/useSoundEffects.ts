import { useCallback, useRef } from 'react';

// Sound effect prompts for casino theme
const SFX_PROMPTS = {
  chips: 'Casino poker chips falling and clinking on felt table, multiple chips cascading, satisfying metallic sound',
  suspense: 'Dramatic suspense tension music sting, short orchestral hit with low brass and strings, building anticipation',
  fanfare: 'Triumphant casino jackpot fanfare, celebratory brass section with bells and chimes, victory sound',
  click: 'Crisp digital button click, modern UI sound, soft tap',
  error: 'Low negative buzzer sound, wrong answer game show buzzer, short',
  reveal: 'Dramatic reveal whoosh sound with sparkle, magical unveiling effect',
  tick: 'Deep dramatic clock tick sound, single tick, tension building game show timer',
  timeup: 'Game show time up buzzer, dramatic end of time alarm, short urgent',
  vote: 'Soft notification chime, pleasant digital ding, short confirmation sound, single note bell',
  coinDrop: 'Single gold coin drop clink, metallic ping sound, satisfying coin landing, short crisp',
  gameOver: 'Sad dramatic game over sound, melancholic piano notes descending, tragic loss orchestral sting, defeat music',
  cashRegister: 'Cash register cha-ching money sound, satisfying register bell, casino jackpot win sound, short celebratory',
  scanner: 'Futuristic scanner beep sequence, sci-fi radar sweep sound, digital analysis processing, cyberpunk x-ray scan',
  dataBeep: 'Digital computer beep sequence, retro terminal processing sound, short electronic data blip, sci-fi computer working',
  typing: 'Fast keyboard typing sound, computer terminal input, hacker typing sequence, mechanical keys clicking rapidly',
  siren: 'Dramatic police siren alarm burst, short urgent warning klaxon, intense alert sound, action movie raid alarm',
  cardUnlock: 'Magical unlock sound with sparkles and shimmer, mystical achievement unlocked, epic power-up activation, fantasy spell casting with golden chimes',
  shieldActivate: 'Futuristic energy shield activation sound, protective barrier power-up, sci-fi force field engaging, electronic whoosh with resonant hum',
  temptation: 'Dark mysterious temptation sound, ominous low brass with seductive strings, devil whisper ambiance, sinister but alluring orchestral sting, dramatic suspense with golden shimmer',
} as const;

type SoundType = keyof typeof SFX_PROMPTS;

// Cache for generated audio URLs (session)
const audioCache = new Map<SoundType, string>();

// Simple stats for auditing ElevenLabs SFX usage
let sfxCacheHits = 0;
let sfxApiCalls = 0;
let sfxErrors = 0;
let lastSfxEvent: { type: SoundType; source: 'cache' | 'api' | 'error'; ts: number } | null = null;

export function getSfxStats() {
  return {
    sfxCacheHits,
    sfxApiCalls,
    sfxErrors,
    lastSfxEvent,
    sfxCacheSize: audioCache.size,
  };
}

import { safeHash } from '@/lib/hashUtils';

async function sha256Hex(input: string): Promise<string> {
  return safeHash(input);
}

export function useSoundEffects() {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const loadingRef = useRef<Set<SoundType>>(new Set());

  const generateSound = useCallback(async (type: SoundType): Promise<string | null> => {
    // Return cached audio if available
    if (audioCache.has(type)) {
      sfxCacheHits++;
      lastSfxEvent = { type, source: 'cache', ts: Date.now() };
      return audioCache.get(type)!;
    }

    // Prevent duplicate requests
    if (loadingRef.current.has(type)) {
      return null;
    }

    loadingRef.current.add(type);

    try {
      const prompt = SFX_PROMPTS[type];
      const duration = type === 'fanfare' ? 4 : type === 'suspense' ? 3 : 2;

      // Deterministic cache key so the backend can store/reuse SFX
      const hash = (await sha256Hex(`sfx:v1:${duration}:${prompt.trim().toLowerCase()}`)).slice(0, 32);
      const cacheKey = `sfx_${hash}.mp3`;

      const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/generate-sfx`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
          Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
        },
        body: JSON.stringify({
          prompt,
          duration,
          cacheKey,
        }),
      });

      if (!response.ok) {
        // Silently fail - sound effects are optional
        return null;
      }

      const contentType = response.headers.get('content-type') || '';

      // JSON response means we got a public URL (cached or freshly generated)
      if (contentType.includes('application/json')) {
        const data = await response.json().catch(() => null);
        if (data?.audioUrl) {
          audioCache.set(type, data.audioUrl);
          lastSfxEvent = { type, source: data.cached ? 'cache' : 'api', ts: Date.now() };
          if (data.cached) {
            sfxCacheHits++;
          } else {
            sfxApiCalls++;
          }
          return data.audioUrl;
        }
        return null;
      }

      // Audio response (fallback)
      if (!contentType.includes('audio')) {
        return null;
      }

      const audioBlob = await response.blob();
      if (!audioBlob.size) return null;

      const audioUrl = URL.createObjectURL(audioBlob);
      audioCache.set(type, audioUrl);
      sfxApiCalls++;
      lastSfxEvent = { type, source: 'api', ts: Date.now() };
      return audioUrl;
    } catch {
      sfxErrors++;
      lastSfxEvent = { type, source: 'error', ts: Date.now() };
      // Silently fail - sound effects are optional
      return null;
    } finally {
      loadingRef.current.delete(type);
    }
  }, []);

  const playSound = useCallback(
    async (type: SoundType, volume: number = 0.7) => {
      try {
        const audioUrl = await generateSound(type);

        if (!audioUrl) {
          return;
        }

        // Stop any currently playing audio
        if (audioRef.current) {
          audioRef.current.pause();
          audioRef.current.currentTime = 0;
        }

        const audio = new Audio(audioUrl);
        audio.volume = volume;
        audioRef.current = audio;

        await audio.play();
      } catch {
        // ignore
      }
    },
    [generateSound]
  );

  // Preload sounds in background
  // IMPORTANT: Disabled by default to avoid spending ElevenLabs credits just by entering a room.
  const preloadSounds = useCallback(async () => {
    return;
  }, []);

  return {
    playChips: () => playSound('chips'),
    playSuspense: () => playSound('suspense', 0.5),
    playFanfare: () => playSound('fanfare'),
    playReveal: () => playSound('reveal'),
    playClick: () => playSound('click', 0.4),
    playError: () => playSound('error', 0.5),
    playTick: () => playSound('tick', 0.6),
    playTimeUp: () => playSound('timeup', 0.7),
    playVote: () => playSound('vote', 0.5),
    playCoinDrop: () => playSound('coinDrop', 0.4),
    playGameOver: () => playSound('gameOver', 0.8),
    playCashRegister: () => playSound('cashRegister', 0.7),
    playScanner: () => playSound('scanner', 0.6),
    playDataBeep: () => playSound('dataBeep', 0.4),
    playTyping: () => playSound('typing', 0.3),
    playSiren: () => playSound('siren', 0.8),
    playCardUnlock: () => playSound('cardUnlock', 0.7),
    playShieldActivate: () => playSound('shieldActivate', 0.6),
    playTemptation: () => playSound('temptation', 0.8),
    preloadSounds,
  };
}
