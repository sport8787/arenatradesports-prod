/**
 * Hórus Punter Voice Service
 * Manages voice triggers for the Punter page with session-based deduplication.
 * Each audio trigger plays only ONCE per browser session.
 * Dynamic TTS phrases are cached via the edge function to avoid repeated API calls.
 * 
 * ✅ v2: ALL audio goes through centralAudioQueue to prevent overlap/duplication.
 */

import { centralAudioQueue, AUDIO_PRIORITY, clearAllAudio } from './centralAudioQueue';

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

// TTS cache: avoids calling ElevenLabs for the same phrase twice in a session
const ttsMemoryCache = new Map<string, string>(); // text hash -> audioUrl

// ✅ Dedupe: track last enqueued label to prevent double-enqueue
let lastEnqueuedLabel: string | null = null;
let lastEnqueuedTime = 0;
const DEDUPE_WINDOW_MS = 5000;

function pickUnplayed(trigger: HorusPunterTrigger): string | null {
  const pool = HORUS_AUDIO_MAP[trigger];
  if (!pool || pool.length === 0) return null;

  if (trigger === 'provocacao') {
    for (let i = 0; i < pool.length; i++) {
      const idx = (provocacaoIndex + i) % pool.length;
      const key = `${trigger}_${idx}`;
      if (!playedThisSession.has(key)) {
        provocacaoIndex = (idx + 1) % pool.length;
        return pool[idx];
      }
    }
    return null;
  }

  const unplayed = pool.filter((_, i) => !playedThisSession.has(`${trigger}_${i}`));
  if (unplayed.length === 0) return null;
  return unplayed[Math.floor(Math.random() * unplayed.length)];
}

function markPlayed(trigger: HorusPunterTrigger, url: string) {
  const pool = HORUS_AUDIO_MAP[trigger];
  const idx = pool.indexOf(url as any);
  if (idx >= 0) {
    playedThisSession.add(`${trigger}_${idx}`);
  }
}

/**
 * ✅ Dedupe check: prevents the same label from being enqueued twice within DEDUPE_WINDOW_MS
 */
function isDuplicate(label: string): boolean {
  const now = Date.now();
  if (lastEnqueuedLabel === label && (now - lastEnqueuedTime) < DEDUPE_WINDOW_MS) {
    console.log(`[HorusPunterVoice] ⛔ Dedupe blocked: "${label}" (${now - lastEnqueuedTime}ms ago)`);
    return true;
  }
  lastEnqueuedLabel = label;
  lastEnqueuedTime = now;
  return false;
}

/**
 * Play a local Hórus audio for a specific trigger moment.
 * ✅ Now uses centralAudioQueue instead of direct Audio().
 */
export function playHorusTrigger(trigger: HorusPunterTrigger): Promise<boolean> {
  return new Promise((resolve) => {
    const url = pickUnplayed(trigger);
    if (!url) {
      console.log(`[HorusPunterVoice] All "${trigger}" audios already played this session`);
      resolve(false);
      return;
    }

    const label = `punter_${trigger}`;
    if (isDuplicate(label)) {
      resolve(false);
      return;
    }

    markPlayed(trigger, url);
    console.log(`[HorusPunterVoice] ✅ Enqueuing "${trigger}" via centralQueue: ${url}`);

    centralAudioQueue.enqueue(url, {
      label,
      priority: AUDIO_PRIORITY.HORUS_DIALOGUE,
      onComplete: () => resolve(true),
      onError: () => resolve(false),
    });
  });
}

/**
 * Play a dynamic TTS phrase using Web Speech API (free, browser-native).
 * Falls back to ElevenLabs only if Web Speech is not supported.
 * Dynamic phrases (username + numbers) cannot be efficiently cached in ElevenLabs
 * — using Web Speech eliminates per-scan API credit consumption.
 */
export async function playHorusTTS(text: string): Promise<boolean> {
  if (!text || text.length < 5) return false;

  const label = `punter_tts_${text.slice(0, 30).replace(/[^a-zA-Z0-9]/g, '_')}`;
  if (isDuplicate(label)) return false;

  // Web Speech API: free, instant, no ElevenLabs credits consumed.
  // Dynamic phrases like "Paulo, escaneei 20 jogos..." are unique per user/scan,
  // so they can never be effectively cached in ElevenLabs Storage.
  if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
    return new Promise((resolve) => {
      try {
        window.speechSynthesis.cancel();
        const utterance = new SpeechSynthesisUtterance(text);
        utterance.lang = 'pt-BR';
        utterance.rate = 0.92;
        utterance.pitch = 0.82;
        utterance.volume = 1;

        // Prefer pt-BR voice when available
        const voices = window.speechSynthesis.getVoices();
        const ptVoice = voices.find(v => v.lang === 'pt-BR')
          ?? voices.find(v => v.lang.startsWith('pt'))
          ?? null;
        if (ptVoice) utterance.voice = ptVoice;

        utterance.onend = () => resolve(true);
        utterance.onerror = () => resolve(false);
        window.speechSynthesis.speak(utterance);
      } catch {
        resolve(false);
      }
    });
  }

  // ElevenLabs fallback: only reached when browser lacks Web Speech API support.
  const sessionKey = text.trim().toLowerCase();
  const cachedUrl = ttsMemoryCache.get(sessionKey);
  if (cachedUrl) {
    return new Promise((resolve) => {
      centralAudioQueue.enqueue(cachedUrl, {
        label,
        priority: AUDIO_PRIORITY.HORUS_DIALOGUE,
        onComplete: () => resolve(true),
        onError: () => resolve(false),
      });
    });
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
          voiceId: 'JBFqnCBsd6RMkjVDRZzb',
          stability: 0.45,
          similarityBoost: 0.8,
          style: 0.6,
          speed: 1.1,
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

    ttsMemoryCache.set(sessionKey, audioUrl);

    return new Promise((resolve) => {
      centralAudioQueue.enqueue(audioUrl, {
        label,
        priority: AUDIO_PRIORITY.HORUS_DIALOGUE,
        onComplete: () => resolve(true),
        onError: () => resolve(false),
      });
    });
  } catch (e) {
    console.error('[HorusPunterVoice] TTS error:', e);
    return false;
  }
}

/**
 * Stop any currently playing Hórus audio
 * ✅ Now clears the central queue
 */
export function stopHorusAudio() {
  clearAllAudio();
}

// ==========================================
// DYNAMIC PHRASE BUILDERS
// ==========================================

/**
 * Post-analysis result phrase
 */
export function buildAnalysisResultPhrase(
  username: string,
  totalAnalyzed: number,
  totalApproved: number
): string {
  const name = username || 'Jogador';
  
  if (totalApproved === 0) {
    const options = [
      `${name}, analisei ${totalAnalyzed} jogos mas não encontrei oportunidades de valor no momento. Fique atento, o mercado muda rápido.`,
      `Nenhuma entrada válida em ${totalAnalyzed} jogos, ${name}. Paciência é uma virtude no mercado.`,
      `${name}, zero oportunidades em ${totalAnalyzed} partidas. Melhor não apostar do que apostar errado.`,
    ];
    return options[Math.floor(Math.random() * options.length)];
  }
  
  if (totalApproved <= 3) {
    const options = [
      `${name}, encontrei ${totalAnalyzed} jogos. Filtrando os ${totalApproved} melhores. Foram localizadas algumas oportunidades de valor.`,
      `${name}, de ${totalAnalyzed} jogos analisados, selecionei ${totalApproved} com valor real. Qualidade acima de quantidade.`,
    ];
    return options[Math.floor(Math.random() * options.length)];
  }
  
  return `${name}, escaneei ${totalAnalyzed} jogos e identifiquei ${totalApproved} oportunidades de valor. As melhores entradas estão prontas para você.`;
}

/**
 * When user places a bet manually
 */
export function buildBetPlacedPhrase(username: string, market: string, odd: number): string {
  const name = username || 'Jogador';
  const phrases = [
    `${name}, aposta registrada. Odd ${odd.toFixed(2)} no mercado ${market}. Boa sorte.`,
    `Entrada confirmada, ${name}. Odd de ${odd.toFixed(2)}. Agora é acompanhar.`,
    `${name}, posição aberta em ${market}. Disciplina é tudo.`,
  ];
  return phrases[Math.floor(Math.random() * phrases.length)];
}

/**
 * When a bet is settled (green or red)
 */
export function buildBetResultPhrase(username: string, isGreen: boolean, profit: number): string {
  const name = username || 'Jogador';
  if (isGreen) {
    const phrases = [
      `Green confirmado, ${name}! Lucro de ${profit.toFixed(2)} unidades. Continue assim.`,
      `Mais um green no registro, ${name}. O mercado recompensou sua paciência.`,
      `${name}, aposta vencedora. ${profit.toFixed(2)} unidades de lucro adicionadas.`,
    ];
    return phrases[Math.floor(Math.random() * phrases.length)];
  }
  const phrases = [
    `Red, ${name}. Faz parte do jogo. Mantenha a disciplina na gestão de banca.`,
    `Aposta perdida, ${name}. Não deixe o tilt te dominar. Siga o plano.`,
    `${name}, red registrado. Variância é normal, confie no processo.`,
  ];
  return phrases[Math.floor(Math.random() * phrases.length)];
}

/**
 * Daily summary / login greeting
 */
export function buildDailyGreetingPhrase(username: string, pendingBets: number): string {
  const name = username || 'Jogador';
  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Bom dia' : hour < 18 ? 'Boa tarde' : 'Boa noite';
  
  if (pendingBets > 0) {
    return `${greeting}, ${name}. Você tem ${pendingBets} posições abertas. Vamos acompanhar o mercado.`;
  }
  return `${greeting}, ${name}. Pronto para analisar o mercado hoje?`;
}

/**
 * When win streak is detected
 */
export function buildStreakPhrase(username: string, streak: number): string {
  const name = username || 'Jogador';
  if (streak >= 5) {
    return `Impressionante, ${name}! ${streak} greens consecutivos. Cuidado com o excesso de confiança.`;
  }
  if (streak >= 3) {
    return `${name}, ${streak} greens seguidos. Boa fase, mas mantenha a disciplina.`;
  }
  return `${name}, sequência de ${streak} acertos. Continue focado.`;
}

/**
 * When ROI milestone is hit
 */
export function buildROIMilestonePhrase(username: string, roi: number): string {
  const name = username || 'Jogador';
  if (roi >= 20) {
    return `${name}, seu ROI está em ${roi.toFixed(1)}%. Performance excepcional. Poucos chegam nesse nível.`;
  }
  if (roi >= 10) {
    return `ROI de ${roi.toFixed(1)}%, ${name}. Acima da média do mercado. Continue assim.`;
  }
  return `${name}, ROI positivo de ${roi.toFixed(1)}%. O processo está funcionando.`;
}

/**
 * Reset session state (useful for testing)
 */
export function resetHorusPunterSession() {
  playedThisSession.clear();
  ttsMemoryCache.clear();
  provocacaoIndex = 0;
}
