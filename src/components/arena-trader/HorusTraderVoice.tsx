import { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Eye, Volume2, Loader2, Play } from 'lucide-react';
import { centralAudioQueue, AUDIO_PRIORITY, clearAllAudio } from '@/services/centralAudioQueue';

interface HorusTraderVoiceProps {
  message: string;
  muted: boolean;
}

export default function HorusTraderVoice({ message, muted }: HorusTraderVoiceProps) {
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const currentEnqueueId = useRef<string | null>(null);
  const lastMessageRef = useRef<string | null>(null);

  // Stop audio when muted
  useEffect(() => {
    if (muted) {
      clearAllAudio();
      setIsSpeaking(false);
    }
  }, [muted]);

  // Subscribe to queue state for speaking indicator
  useEffect(() => {
    const unsubscribe = centralAudioQueue.subscribe((state) => {
      if (state.currentLabel?.startsWith('trader_horus_')) {
        setIsSpeaking(state.isPlaying);
      } else if (!state.isPlaying) {
        setIsSpeaking(false);
      }
    });
    return unsubscribe;
  }, []);

  const playTTS = async () => {
    if (!message || muted) return;

    const cleanText = message.replace(/[\u{1F600}-\u{1F9FF}]|[\u{2600}-\u{26FF}]|[\u{2700}-\u{27BF}]|[\u{1F300}-\u{1F5FF}]|[\u{1F680}-\u{1F6FF}]|[\u{1F900}-\u{1F9FF}]|[⛔🎯💀📈📉]/gu, '').trim();
    if (!cleanText || cleanText.length < 5) return;

    // Dedupe: don't re-enqueue the same message
    if (lastMessageRef.current === cleanText) {
      console.log('[HorusTraderVoice] ⛔ Same message already enqueued, skipping');
      return;
    }
    lastMessageRef.current = cleanText;

    setIsLoading(true);
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
            text: cleanText,
            stability: 0.45,
            similarityBoost: 0.8,
            style: 0.6,
            speed: 1.1,
            cacheKey: `trader-horus-${cleanText.slice(0, 40).replace(/[^a-zA-Z0-9]/g, '_')}.mp3`,
          }),
        }
      );

      if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        if (err.skipTTS) return;
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

      // Use central queue instead of direct Audio()
      const label = `trader_horus_${cleanText.slice(0, 20).replace(/[^a-zA-Z0-9]/g, '_')}`;
      currentEnqueueId.current = centralAudioQueue.enqueue(audioUrl, {
        label,
        priority: AUDIO_PRIORITY.HORUS_DIALOGUE,
        onComplete: () => {
          setIsSpeaking(false);
          currentEnqueueId.current = null;
        },
        onError: () => {
          setIsSpeaking(false);
          currentEnqueueId.current = null;
        },
      });
    } catch (e) {
      console.error('Hórus TTS error:', e);
    } finally {
      setIsLoading(false);
    }
  };

  if (!message) return null;

  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={message.slice(0, 30)}
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 10 }}
        className={`bg-gradient-to-br from-[#1a1200] to-[#111111] border rounded-xl p-4 shadow-lg transition-colors ${
          isSpeaking ? 'border-amber-400/60 shadow-amber-500/20' : 'border-amber-500/30 shadow-amber-500/5'
        }`}
      >
        <div className="flex items-center gap-2 mb-2">
          <div className={`w-7 h-7 rounded-full flex items-center justify-center transition-colors ${
            isSpeaking ? 'bg-amber-500/40' : 'bg-amber-500/20'
          }`}>
            <Eye className="w-4 h-4 text-amber-400" />
          </div>
          <div className="flex-1">
            <h3 className="font-orbitron text-xs font-bold text-amber-400 uppercase">Hórus Premium</h3>
            <p className="text-[10px] text-amber-400/50">
              {isLoading ? 'Sintetizando voz...' : isSpeaking ? '🔊 Falando...' : 'Voz do Mercado'}
            </p>
          </div>
          <div className="flex items-center gap-1.5">
            {isLoading && <Loader2 className="w-3.5 h-3.5 text-amber-400/50 animate-spin" />}
            {isSpeaking ? (
              <motion.div animate={{ scale: [1, 1.3, 1] }} transition={{ duration: 0.6, repeat: Infinity }}>
                <Volume2 className="w-3.5 h-3.5 text-amber-400" />
              </motion.div>
            ) : !muted && !isLoading ? (
              <button
                onClick={playTTS}
                className="flex items-center gap-1 px-2 py-1 rounded-md bg-amber-500/15 hover:bg-amber-500/25 border border-amber-500/30 transition-colors text-amber-400"
                title="Ouvir Hórus"
              >
                <Play className="w-3 h-3" />
                <span className="text-[10px] font-bold">Ouvir</span>
              </button>
            ) : null}
          </div>
        </div>

        <p className="text-sm text-amber-100/80 leading-relaxed italic">
          "{message}"
        </p>

        {isSpeaking && (
          <div className="flex items-center gap-0.5 mt-2 justify-center">
            {Array.from({ length: 12 }).map((_, i) => (
              <motion.div
                key={i}
                animate={{ height: [4, 12 + Math.random() * 8, 4] }}
                transition={{ duration: 0.4 + Math.random() * 0.3, repeat: Infinity, delay: i * 0.05 }}
                className="w-1 rounded-full bg-amber-400/40"
              />
            ))}
          </div>
        )}
      </motion.div>
    </AnimatePresence>
  );
}
