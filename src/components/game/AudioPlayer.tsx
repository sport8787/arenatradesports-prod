import { useState, useRef, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Play, Pause, Volume2, Loader2 } from 'lucide-react';
import GoldButton from './GoldButton';

interface AudioPlayerProps {
  audioUrl: string | null;
  hostName?: string;
}

export default function AudioPlayer({ audioUrl, hostName }: AudioPlayerProps) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [duration, setDuration] = useState(0);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    if (!audioUrl) return;

    const audio = new Audio(audioUrl);
    audioRef.current = audio;

    audio.addEventListener('loadstart', () => setIsLoading(true));
    audio.addEventListener('canplay', () => setIsLoading(false));
    audio.addEventListener('loadedmetadata', () => setDuration(audio.duration));
    audio.addEventListener('timeupdate', () => {
      setProgress((audio.currentTime / audio.duration) * 100);
    });
    audio.addEventListener('ended', () => {
      setIsPlaying(false);
      setProgress(0);
    });

    return () => {
      audio.pause();
      audio.src = '';
    };
  }, [audioUrl]);

  const togglePlay = () => {
    if (!audioRef.current) return;

    if (isPlaying) {
      audioRef.current.pause();
    } else {
      audioRef.current.play();
    }
    setIsPlaying(!isPlaying);
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  if (!audioUrl) {
    return (
      <div className="bg-background/50 backdrop-blur-sm border border-border/30 rounded-xl p-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-muted/30 flex items-center justify-center">
            <Volume2 className="w-5 h-5 text-muted-foreground" />
          </div>
          <div className="flex-1">
            <h4 className="font-semibold text-sm text-muted-foreground">Sem áudio</h4>
            <p className="text-xs text-muted-foreground/60">O host não gravou justificativa</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-gradient-to-br from-gold/10 to-gold/5 backdrop-blur-sm border border-gold/30 rounded-xl p-4"
    >
      <div className="flex items-center gap-3 mb-3">
        <div className="w-10 h-10 rounded-full bg-gold/20 flex items-center justify-center">
          <Volume2 className="w-5 h-5 text-gold" />
        </div>
        <div className="flex-1">
          <h4 className="font-semibold text-sm">Justificativa do Host</h4>
          <p className="text-xs text-muted-foreground">
            {hostName ? `${hostName} gravou uma mensagem` : 'Ouça a explicação'}
          </p>
        </div>
      </div>

      <div className="space-y-3">
        {/* Progress bar */}
        <div className="relative h-2 bg-background/50 rounded-full overflow-hidden">
          <motion.div
            className="absolute inset-y-0 left-0 bg-gold rounded-full"
            style={{ width: `${progress}%` }}
          />
        </div>

        <div className="flex items-center justify-between">
          <span className="text-xs text-muted-foreground font-mono">
            {audioRef.current ? formatTime(audioRef.current.currentTime) : '0:00'}
          </span>
          <span className="text-xs text-muted-foreground font-mono">
            {formatTime(duration)}
          </span>
        </div>

        <GoldButton 
          onClick={togglePlay}
          className="w-full"
          disabled={isLoading}
        >
          {isLoading ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              Carregando...
            </>
          ) : isPlaying ? (
            <>
              <Pause className="w-4 h-4 mr-2 fill-current" />
              Pausar
            </>
          ) : (
            <>
              <Play className="w-4 h-4 mr-2 fill-current" />
              Ouvir Justificativa
            </>
          )}
        </GoldButton>
      </div>
    </motion.div>
  );
}
