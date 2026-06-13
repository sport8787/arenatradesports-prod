import { useState, useRef, useCallback } from 'react';
import { motion } from 'framer-motion';
import { Play, Pause, Volume2, Loader2 } from 'lucide-react';

interface HorusTTSPlayerProps {
  text: string;
}

const CALLUM_VOICE_ID = 'N2lVS1w4EtoT3dr4eOWO';

export default function HorusTTSPlayer({ text }: HorusTTSPlayerProps) {
  const [status, setStatus] = useState<'idle' | 'loading' | 'playing' | 'paused' | 'error'>('idle');
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const urlRef = useRef<string | null>(null);

  const cleanText = text
    .replace(/\[HÓRUS\]\s*/gi, '')
    .replace(/[\u{1F600}-\u{1F9FF}]|[\u{2600}-\u{26FF}]|[\u{2700}-\u{27BF}]|[\u{1F300}-\u{1F5FF}]|[\u{1F680}-\u{1F6FF}]|[\u{1F900}-\u{1F9FF}]/gu, '')
    .trim();

  const generateAndPlay = useCallback(async () => {
    if (status === 'playing') {
      audioRef.current?.pause();
      setStatus('paused');
      return;
    }

    if (status === 'paused' && audioRef.current) {
      audioRef.current.play();
      setStatus('playing');
      return;
    }

    // If we already have a URL cached, reuse it
    if (urlRef.current) {
      const audio = new Audio(urlRef.current);
      audioRef.current = audio;
      audio.onended = () => setStatus('idle');
      audio.onerror = () => setStatus('error');
      audio.play();
      setStatus('playing');
      return;
    }

    setStatus('loading');
    try {
      const cacheKey = `horus-chat-${cleanText.slice(0, 40).replace(/[^a-zA-Z0-9]/g, '_')}.mp3`;

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
            similarityBoost: 0.75,
            style: 0.60,
            speed: 1.0,
            cacheKey,
          }),
        }
      );

      if (!response.ok) throw new Error(`TTS failed: ${response.status}`);

      const contentType = response.headers.get('Content-Type') || '';
      let audioUrl: string;

      if (contentType.includes('application/json')) {
        const data = await response.json();
        if (data.error) throw new Error(data.error);
        audioUrl = data.audioUrl;
      } else {
        const blob = await response.blob();
        audioUrl = URL.createObjectURL(blob);
      }

      urlRef.current = audioUrl;
      const audio = new Audio(audioUrl);
      audioRef.current = audio;
      audio.onended = () => setStatus('idle');
      audio.onerror = () => setStatus('error');
      await audio.play();
      setStatus('playing');
    } catch (err) {
      console.error('[HorusTTSPlayer] Error:', err);
      setStatus('error');
    }
  }, [status, cleanText]);

  if (!cleanText || cleanText.length < 10) return null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      className="mt-2 flex items-center gap-2"
    >
      <button
        onClick={generateAndPlay}
        disabled={status === 'loading'}
        className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-[#FFD700]/10 border border-[#FFD700]/20 text-[#FFD700] text-[10px] font-bold hover:bg-[#FFD700]/20 transition-colors disabled:opacity-50"
      >
        {status === 'loading' && <Loader2 className="w-3 h-3 animate-spin" />}
        {status === 'idle' && <Play className="w-3 h-3" />}
        {status === 'playing' && <Pause className="w-3 h-3" />}
        {status === 'paused' && <Play className="w-3 h-3" />}
        {status === 'error' && <Play className="w-3 h-3" />}

        {status === 'loading' ? 'Gerando voz...' :
         status === 'playing' ? 'Pausar' :
         status === 'paused' ? 'Continuar' :
         status === 'error' ? 'Tentar novamente' :
         'Ouvir Hórus'}
      </button>

      {status === 'playing' && (
        <div className="flex items-center gap-0.5">
          {Array.from({ length: 5 }).map((_, i) => (
            <motion.div
              key={i}
              animate={{ height: [3, 10 + Math.random() * 6, 3] }}
              transition={{ duration: 0.4 + Math.random() * 0.2, repeat: Infinity, delay: i * 0.08 }}
              className="w-[2px] rounded-full bg-[#FFD700]/50"
            />
          ))}
        </div>
      )}
    </motion.div>
  );
}
