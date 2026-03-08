/**
 * Hórus Punter Voice Service
 * Manages voice triggers for the Punter page with session-based deduplication.
 * Each audio trigger plays only ONCE per browser session.
 */

// Audio mapping by trigger moment
const HORUS_AUDIO_MAP: Record<string, string[]> = {
  analisando_jogos: [
    '/audio/horus/analisando_jogos_1.mp3',
    '/audio/horus/analisando_jogos_2.mp3',
  ],
  provocacao: [
    '/audio/horus/provocacao_punter_1.mp3',
    '/audio/horus/provocacao_punter_2.mp3',
    '/audio/horus/provocacao_punter_3.mp3',
    '/audio/horus/provocacao_punter_4.mp3',
  ],
  alerta: [
    '/audio/horus/alerta_ao_usuario.mp3',
  ],
};

export type HorusPunterTrigger = keyof typeof HORUS_AUDIO_MAP;

// Session-level tracking: each key can only fire once per session
const playedThisSession = new Set<string>();
// Track which provocacao index to use next (round-robin, no repeats in session)
let provocacaoIndex = 0;

let currentAudio: HTMLAudioElement | null = null;

function pickUnplayed(trigger: HorusPunterTrigger): string | null {
  const pool = HORUS_AUDIO_MAP[trigger];
  if (!pool || pool.length === 0) return null;

  if (trigger === 'provocacao') {
    // Round-robin through provocações, skip already played
    for (let i = 0; i < pool.length; i++) {
      const idx = (provocacaoIndex + i) % pool.length;
      const key = `${trigger}_${idx}`;
      if (!playedThisSession.has(key)) {
        provocacaoIndex = (idx + 1) % pool.length;
        return pool[idx];
      }
    }
    return null; // All provocações already played
  }

  // For other triggers, pick a random unplayed one
  const unplayed = pool.filter((_, i) => !playedThisSession.has(`${trigger}_${i}`));
  if (unplayed.length === 0) return null;
  const chosen = unplayed[Math.floor(Math.random() * unplayed.length)];
  return chosen;
}

function markPlayed(trigger: HorusPunterTrigger, url: string) {
  const pool = HORUS_AUDIO_MAP[trigger];
  const idx = pool.indexOf(url as any);
  if (idx >= 0) {
    playedThisSession.add(`${trigger}_${idx}`);
  }
}

/**
 * Play a local Hórus audio for a specific trigger moment.
 * Returns a promise that resolves when audio finishes or null if already played.
 */
export function playHorusTrigger(trigger: HorusPunterTrigger): Promise<boolean> {
  return new Promise((resolve) => {
    const url = pickUnplayed(trigger);
    if (!url) {
      console.log(`[HorusPunterVoice] All "${trigger}" audios already played this session`);
      resolve(false);
      return;
    }

    // Stop any currently playing Hórus audio
    if (currentAudio) {
      currentAudio.pause();
      currentAudio = null;
    }

    markPlayed(trigger, url);
    console.log(`[HorusPunterVoice] Playing "${trigger}": ${url}`);

    const audio = new Audio(url);
    currentAudio = audio;
    audio.volume = 0.8;
    audio.onended = () => {
      currentAudio = null;
      resolve(true);
    };
    audio.onerror = () => {
      console.error(`[HorusPunterVoice] Failed to play: ${url}`);
      currentAudio = null;
      resolve(false);
    };
    audio.play().catch(() => resolve(false));
  });
}

/**
 * Play a dynamic TTS phrase via ElevenLabs after analysis completes.
 */
export async function playHorusTTS(text: string): Promise<boolean> {
  if (!text || text.length < 5) return false;

  // Stop any currently playing audio
  if (currentAudio) {
    currentAudio.pause();
    currentAudio = null;
  }

  try {
    const response = await fetch(
      `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/elevenlabs-tts`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
          Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
        },
        body: JSON.stringify({
          text,
          voiceId: 'JBFqnCBsd6RMkjVDRZzb', // George - Hórus voice
          stability: 0.45,
          similarityBoost: 0.8,
          style: 0.6,
          speed: 1.1,
          cacheKey: `punter-horus-${text.slice(0, 40).replace(/[^a-zA-Z0-9]/g, '_')}.mp3`,
        }),
      }
    );

    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      if (err.skipTTS) return false;
      throw new Error(`TTS failed: ${response.status}`);
    }

    const contentType = response.headers.get('Content-Type') || '';
    let audioUrl: string;
    if (contentType.includes('application/json')) {
      const data = await response.json();
      audioUrl = data.audioUrl;
    } else {
      const blob = await response.blob();
      audioUrl = URL.createObjectURL(blob);
    }

    return new Promise((resolve) => {
      const audio = new Audio(audioUrl);
      currentAudio = audio;
      audio.volume = 0.85;
      audio.onended = () => { currentAudio = null; resolve(true); };
      audio.onerror = () => { currentAudio = null; resolve(false); };
      audio.play().catch(() => resolve(false));
    });
  } catch (e) {
    console.error('[HorusPunterVoice] TTS error:', e);
    return false;
  }
}

/**
 * Stop any currently playing Hórus audio
 */
export function stopHorusAudio() {
  if (currentAudio) {
    currentAudio.pause();
    currentAudio = null;
  }
}

/**
 * Build the dynamic TTS phrases for post-analysis
 */
export function buildAnalysisResultPhrase(
  username: string,
  totalAnalyzed: number,
  totalApproved: number
): string {
  const name = username || 'Jogador';
  
  if (totalApproved === 0) {
    return `${name}, analisei ${totalAnalyzed} jogos mas não encontrei oportunidades de valor no momento. Fique atento, o mercado muda rápido.`;
  }
  
  if (totalApproved <= 3) {
    return `${name}, encontrei ${totalAnalyzed} jogos. Filtrando os ${totalApproved} melhores. Foram localizadas algumas oportunidades de valor.`;
  }
  
  return `${name}, escaneei ${totalAnalyzed} jogos e identifiquei ${totalApproved} oportunidades de valor. As melhores entradas estão prontas para você.`;
}

/**
 * Reset session state (useful for testing)
 */
export function resetHorusPunterSession() {
  playedThisSession.clear();
  provocacaoIndex = 0;
}
