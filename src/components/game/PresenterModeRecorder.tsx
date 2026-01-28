/**
 * Gravador de Áudio para o Modo Apresentador
 * Captura métricas vocais reais usando AudioContext/AnalyserNode
 * para análise de IA biométrica (pitch, frequência, amplitude)
 */

import { useState, useRef, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Mic, Square, Pause, Play, Volume2 } from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { 
  startForensicsSession, 
  markRecordingStart, 
  analyzeAudioFrame, 
  finalizeForensicsSession,
  startIntervalCapture,
  stopIntervalCapture,
  type VoiceMetrics 
} from '@/services/audioForensicsService';

interface PresenterModeRecorderProps {
  onRecordingComplete?: (audioBlob: Blob, durationMs: number, metrics: VoiceMetrics) => void;
  disabled?: boolean;
  maxDuration?: number;
  /** If null, consent not yet given - will trigger onConsentRequired */
  mycroftConsent?: boolean | null;
  /** Called when recording is attempted but consent is null */
  onConsentRequired?: () => void;
}

export default function PresenterModeRecorder({ 
  onRecordingComplete, 
  disabled = false,
  maxDuration = 60,
  mycroftConsent,
  onConsentRequired
}: PresenterModeRecorderProps) {
  const [isRecording, setIsRecording] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [waveformData, setWaveformData] = useState<number[]>(new Array(30).fill(0));
  
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const recordingStartTimeRef = useRef<number>(0);
  const isMountedRef = useRef(true);
  const isPausedRef = useRef(false);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
      cleanup();
    };
  }, []);

  useEffect(() => {
    isPausedRef.current = isPaused;
  }, [isPaused]);

  const cleanup = () => {
    if (timerRef.current) clearInterval(timerRef.current);
    if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
    // Stop V2 interval capture
    stopIntervalCapture();
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
    }
    if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
      audioContextRef.current.close();
    }
  };

  const updateWaveform = useCallback(() => {
    if (!isMountedRef.current) return;
    
    if (!analyserRef.current || isPausedRef.current) {
      animationFrameRef.current = requestAnimationFrame(updateWaveform);
      return;
    }

    // Capture real audio metrics for forensics analysis
    analyzeAudioFrame(analyserRef.current);

    const dataArray = new Uint8Array(analyserRef.current.frequencyBinCount);
    analyserRef.current.getByteFrequencyData(dataArray);

    const samples = 30;
    const step = Math.floor(dataArray.length / samples);
    const newWaveform = [];
    
    for (let i = 0; i < samples; i++) {
      const value = dataArray[i * step] / 255;
      newWaveform.push(value);
    }
    
    if (isMountedRef.current) {
      setWaveformData(newWaveform);
    }
    
    animationFrameRef.current = requestAnimationFrame(updateWaveform);
  }, []);

  const startRecording = async () => {
    // Check consent before starting - if null, require consent first
    if (mycroftConsent === null) {
      onConsentRequired?.();
      return;
    }
    
    try {
      // Start forensics session BEFORE recording to track response latency
      startForensicsSession();
      
      const stream = await navigator.mediaDevices.getUserMedia({ 
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true
        } 
      });
      
      streamRef.current = stream;

      const audioContext = new AudioContext();
      audioContextRef.current = audioContext;

      // Ensure AudioContext is running (Safari/iOS can start suspended)
      if (audioContext.state === 'suspended') {
        await audioContext.resume();
      }
      console.log('[PresenterRecorder] 🔊 AudioContext state:', audioContext.state, 'sampleRate:', audioContext.sampleRate);
      console.log('[PresenterRecorder] 🎤 Audio tracks:', stream.getAudioTracks().length);
      
      const source = audioContext.createMediaStreamSource(stream);
      const analyser = audioContext.createAnalyser();
      analyser.fftSize = 2048; // Higher resolution for better pitch detection
      analyser.smoothingTimeConstant = 0.5; // Less smoothing for more accurate analysis
      source.connect(analyser);
      analyserRef.current = analyser;

      // V2: Start interval-based capture (ROBUST - replaces ScriptProcessor)
      startIntervalCapture(audioContext, stream);

      // Mark recording start for latency calculation
      markRecordingStart();

      animationFrameRef.current = requestAnimationFrame(updateWaveform);

      const mediaRecorder = new MediaRecorder(stream, { mimeType: 'audio/webm' });
      mediaRecorderRef.current = mediaRecorder;
      chunksRef.current = [];

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          chunksRef.current.push(e.data);
        }
      };

      mediaRecorder.onstop = async () => {
        if (timerRef.current) clearInterval(timerRef.current);
        if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
        
        const recordingDurationMs = Date.now() - recordingStartTimeRef.current;
        
        // Finalize forensics session and get real voice metrics
        const voiceMetrics = finalizeForensicsSession(recordingDurationMs);
        console.log('[PresenterRecorder] Real voice metrics captured:', voiceMetrics);
        
        stream.getTracks().forEach(track => track.stop());
        if (audioContext.state !== 'closed') {
          audioContext.close();
        }
        
        const audioBlob = new Blob(chunksRef.current, { type: 'audio/webm' });
        
        // Create local URL for playback
        const url = URL.createObjectURL(audioBlob);
        if (isMountedRef.current) {
          setAudioUrl(url);
        }
        
        // Callback with blob and REAL voice metrics for AI analysis
        onRecordingComplete?.(audioBlob, recordingDurationMs, voiceMetrics);
        
        toast({ 
          title: '✅ Justificativa gravada!', 
          description: `Métricas capturadas: ${voiceMetrics.pitchStability} pitch, ${voiceMetrics.speechRateBPM} palavras/min` 
        });
      };

      recordingStartTimeRef.current = Date.now();

      mediaRecorder.start(100);
      setIsRecording(true);
      setIsPaused(false);
      setRecordingTime(0);
      setAudioUrl(null);
      setWaveformData(new Array(30).fill(0));

      timerRef.current = setInterval(() => {
        setRecordingTime(prev => {
          if (prev >= maxDuration - 1) {
            stopRecording();
            return maxDuration;
          }
          return prev + 1;
        });
      }, 1000);

      toast({ title: '🎙️ Gravando...', description: 'Explique sua resposta para o júri' });

    } catch (error: any) {
      console.error('Error starting recording:', error);
      
      const isOverlayError = error?.name === 'NotAllowedError' || 
        error?.message?.includes('permission');
      
      if (isOverlayError) {
        toast({ 
          title: 'Permissão bloqueada', 
          description: 'Feche apps com sobreposição e tente novamente.',
          variant: 'destructive',
          duration: 8000
        });
      } else {
        toast({ 
          title: 'Erro ao acessar microfone', 
          description: 'Verifique as permissões do navegador.',
          variant: 'destructive' 
        });
      }
    }
  };

  const pauseRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
      mediaRecorderRef.current.pause();
      setIsPaused(true);
      if (timerRef.current) clearInterval(timerRef.current);
    }
  };

  const resumeRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'paused') {
      mediaRecorderRef.current.resume();
      setIsPaused(false);
      
      timerRef.current = setInterval(() => {
        setRecordingTime(prev => {
          if (prev >= maxDuration - 1) {
            stopRecording();
            return maxDuration;
          }
          return prev + 1;
        });
      }, 1000);
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      setIsPaused(false);
    }
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const progressPercent = (recordingTime / maxDuration) * 100;
  const isNearEnd = recordingTime > maxDuration * 0.8;

  return (
    <div className="space-y-3">
      <AnimatePresence mode="wait">
        {isRecording ? (
          <motion.div
            key="recording"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="space-y-3"
          >
            {/* Waveform */}
            <div className="relative h-14 bg-background/30 rounded-xl overflow-hidden flex items-center justify-center px-2 border border-gold/30">
              {/* Recording indicator */}
              {!isPaused && (
                <motion.div
                  animate={{ opacity: [1, 0.3, 1] }}
                  transition={{ repeat: Infinity, duration: 1 }}
                  className="absolute top-2 left-2 flex items-center gap-1.5"
                >
                  <div className="w-2 h-2 rounded-full bg-destructive" />
                  <span className="text-[10px] text-destructive font-semibold uppercase">Rec</span>
                </motion.div>
              )}
              
              {/* Timer */}
              <div className="absolute top-2 right-2">
                <span className={cn(
                  "font-mono text-xs font-bold",
                  isNearEnd ? "text-destructive" : "text-gold"
                )}>
                  {formatTime(recordingTime)}
                </span>
              </div>
              
              {/* Waveform bars */}
              <div className="flex items-center gap-[2px] h-full py-3">
                {waveformData.map((value, i) => (
                  <motion.div
                    key={i}
                    className={cn(
                      "w-1 rounded-full",
                      isPaused ? "bg-amber-500/50" : "bg-gold"
                    )}
                    animate={{ 
                      height: isPaused ? 4 : Math.max(4, value * 36),
                      opacity: isPaused ? 0.5 : 0.4 + value * 0.6
                    }}
                    transition={{ duration: 0.05 }}
                  />
                ))}
              </div>
            </div>

            {/* Progress bar */}
            <div className="relative h-1.5 bg-background/50 rounded-full overflow-hidden">
              <motion.div
                className={cn(
                  "absolute inset-y-0 left-0 rounded-full transition-colors",
                  isNearEnd ? "bg-destructive" : "bg-gold"
                )}
                style={{ width: `${progressPercent}%` }}
              />
            </div>

            {/* Controls */}
            <div className="flex gap-2">
              {isPaused ? (
                <motion.button
                  whileTap={{ scale: 0.95 }}
                  onClick={resumeRecording}
                  className="flex-1 flex items-center justify-center gap-2 p-3 rounded-xl bg-gold/20 border border-gold/50 text-gold font-medium"
                >
                  <Play className="w-4 h-4 fill-current" />
                  Retomar
                </motion.button>
              ) : (
                <motion.button
                  whileTap={{ scale: 0.95 }}
                  onClick={pauseRecording}
                  className="flex-1 flex items-center justify-center gap-2 p-3 rounded-xl bg-amber-500/20 border border-amber-500/50 text-amber-500 font-medium"
                >
                  <Pause className="w-4 h-4 fill-current" />
                  Pausar
                </motion.button>
              )}
              
              <motion.button
                whileTap={{ scale: 0.95 }}
                onClick={stopRecording}
                className="flex-1 flex items-center justify-center gap-2 p-3 rounded-xl bg-destructive text-destructive-foreground font-medium"
              >
                <Square className="w-4 h-4 fill-current" />
                Finalizar
              </motion.button>
            </div>
          </motion.div>
        ) : audioUrl ? (
          <motion.div
            key="complete"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-3"
          >
            <div className="flex items-center gap-2 text-success text-sm p-3 bg-success/10 border border-success/30 rounded-xl">
              <Volume2 className="w-4 h-4" />
              <span className="font-medium">Justificativa gravada!</span>
            </div>
            
            <audio src={audioUrl} controls className="w-full h-10 rounded-lg" />
            
            <motion.button
              whileTap={{ scale: 0.98 }}
              onClick={startRecording}
              disabled={disabled}
              className="w-full flex items-center justify-center gap-2 p-3 rounded-xl bg-muted/50 border border-border text-muted-foreground font-medium hover:bg-muted transition-colors disabled:opacity-50"
            >
              <Mic className="w-4 h-4" />
              Regravar
            </motion.button>
          </motion.div>
        ) : (
          <motion.button
            key="idle"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            whileTap={{ scale: 0.98 }}
            onClick={startRecording}
            disabled={disabled}
            className="w-full flex items-center justify-center gap-2 p-4 rounded-xl bg-gradient-to-r from-gold to-yellow-500 text-black font-medium disabled:opacity-50"
          >
            <Mic className="w-5 h-5" />
            🎙️ Gravar Justificativa
          </motion.button>
        )}
      </AnimatePresence>
    </div>
  );
}
