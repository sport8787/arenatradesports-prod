import { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Play, Pause, Volume2, Loader2, Bell } from 'lucide-react';
import GoldButton from './GoldButton';

interface AudioPlayerProps {
  audioUrl: string | null;
  hostName?: string;
  autoPlay?: boolean;
}

export default function AudioPlayer({ audioUrl, hostName, autoPlay = false }: AudioPlayerProps) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [duration, setDuration] = useState(0);
  const [hasListened, setHasListened] = useState(false);
  const [autoPlayTriggered, setAutoPlayTriggered] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const prevAudioUrlRef = useRef<string | null>(null);

  // Reset states when audioUrl changes
  useEffect(() => {
    if (audioUrl !== prevAudioUrlRef.current) {
      setHasListened(false);
      setAutoPlayTriggered(false);
      prevAudioUrlRef.current = audioUrl;
    }
  }, [audioUrl]);

  useEffect(() => {
    if (!audioUrl) return;

    const audio = new Audio(audioUrl);
    audioRef.current = audio;

    audio.addEventListener('loadstart', () => setIsLoading(true));
    audio.addEventListener('canplay', () => {
      setIsLoading(false);
      // Auto-play when audio is ready and autoPlay is enabled
      if (autoPlay && !autoPlayTriggered && !hasListened) {
        setAutoPlayTriggered(true);
        audio.play().then(() => {
          setIsPlaying(true);
          setHasListened(true);
        }).catch(err => {
          console.log('Auto-play blocked by browser:', err);
        });
      }
    });
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
  }, [audioUrl, autoPlay, autoPlayTriggered, hasListened]);

  const togglePlay = () => {
    if (!audioRef.current) return;

    if (isPlaying) {
      audioRef.current.pause();
    } else {
      audioRef.current.play();
      setHasListened(true); // Mark as listened when play starts
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
      className={`bg-gradient-to-br from-gold/10 to-gold/5 backdrop-blur-sm border rounded-xl p-4 relative overflow-hidden ${
        !hasListened ? 'border-gold shadow-lg shadow-gold/20' : 'border-gold/30'
      }`}
    >
      {/* Pulsing notification indicator when new audio */}
      <AnimatePresence>
        {!hasListened && (
          <motion.div
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.8 }}
            className="absolute -top-1 -right-1 z-10"
          >
            <motion.div
              animate={{ scale: [1, 1.2, 1] }}
              transition={{ repeat: Infinity, duration: 1.5 }}
              className="w-6 h-6 rounded-full bg-gold flex items-center justify-center"
            >
              <Bell className="w-3 h-3 text-background" />
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Pulsing border effect */}
      {!hasListened && (
        <motion.div
          animate={{ opacity: [0.3, 0.6, 0.3] }}
          transition={{ repeat: Infinity, duration: 2 }}
          className="absolute inset-0 border-2 border-gold rounded-xl pointer-events-none"
        />
      )}

      <div className="flex items-center gap-3 mb-3">
        <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
          !hasListened ? 'bg-gold/30' : 'bg-gold/20'
        }`}>
          <Volume2 className="w-5 h-5 text-gold" />
        </div>
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <h4 className="font-semibold text-sm">Justificativa do Host</h4>
            {!hasListened && (
              <span className="text-[10px] bg-gold text-background px-1.5 py-0.5 rounded font-bold uppercase">
                Novo
              </span>
            )}
          </div>
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
