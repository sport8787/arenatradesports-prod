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
} as const;

type SoundType = keyof typeof SFX_PROMPTS;

// Cache for generated audio blobs
const audioCache = new Map<SoundType, string>();

export function useSoundEffects() {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const loadingRef = useRef<Set<SoundType>>(new Set());

  const generateSound = useCallback(async (type: SoundType): Promise<string | null> => {
    // Return cached audio if available
    if (audioCache.has(type)) {
      return audioCache.get(type)!;
    }

    // Prevent duplicate requests
    if (loadingRef.current.has(type)) {
      return null;
    }

    loadingRef.current.add(type);

    try {
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/generate-sfx`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
            Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
          },
          body: JSON.stringify({
            prompt: SFX_PROMPTS[type],
            duration: type === 'fanfare' ? 4 : type === 'suspense' ? 3 : 2,
          }),
        }
      );

      if (!response.ok) {
        // Silently fail - sound effects are optional
        return null;
      }

      // Check if response is actually audio
      const contentType = response.headers.get('content-type');
      if (!contentType?.includes('audio')) {
        return null;
      }

      const audioBlob = await response.blob();
      const audioUrl = URL.createObjectURL(audioBlob);
      
      // Cache the generated audio
      audioCache.set(type, audioUrl);
      
      return audioUrl;
    } catch (error) {
      // Silently fail - sound effects are optional
      return null;
    } finally {
      loadingRef.current.delete(type);
    }
  }, []);

  const playSound = useCallback(async (type: SoundType, volume: number = 0.7) => {
    try {
      const audioUrl = await generateSound(type);
      
      if (!audioUrl) {
        console.log('Sound not available yet, skipping:', type);
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
    } catch (error) {
      console.error('Error playing sound:', error);
    }
  }, [generateSound]);

  // Preload sounds in background
  const preloadSounds = useCallback(async () => {
    const sounds: SoundType[] = ['chips', 'suspense', 'fanfare', 'reveal', 'tick', 'timeup', 'vote', 'coinDrop', 'cashRegister', 'cardUnlock', 'shieldActivate'];
    
    for (const sound of sounds) {
      if (!audioCache.has(sound)) {
        await generateSound(sound);
      }
    }
  }, [generateSound]);

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
    preloadSounds,
  };
}
