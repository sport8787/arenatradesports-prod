import { useState, useRef, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Mic, Square, Loader2, Volume2, Pause, Play } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';
import GoldButton from './GoldButton';
import { 
  VoiceMetrics,
  markRecordingStart,
  analyzeAudioFrame,
  finalizeForensicsSession 
} from '@/services/audioForensicsService';

export interface AudioRecorderProps {
  roomId: string;
  onRecordingComplete?: (audioUrl: string, metrics: VoiceMetrics) => void;
  disabled?: boolean;
  /** If null, consent not yet given - will trigger onConsentRequired */
  mycroftConsent?: boolean | null;
  /** Called when recording is attempted but consent is null */
  onConsentRequired?: () => void;
}

export default function AudioRecorder({ 
  roomId, 
  onRecordingComplete, 
  disabled,
  mycroftConsent,
  onConsentRequired
}: AudioRecorderProps) {
  const [isRecording, setIsRecording] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [recordingTime, setRecordingTime] = useState(0);
  const [waveformData, setWaveformData] = useState<number[]>(new Array(40).fill(0));
  
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const recordingStartTimeRef = useRef<number>(0);
  const isMountedRef = useRef(true);
  
  const MAX_DURATION = 60; // 60 seconds max

  // Cleanup on unmount
  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
      cleanup();
    };
  }, []);

  const cleanup = () => {
    if (timerRef.current) clearInterval(timerRef.current);
    if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
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

  // Real-time waveform visualization + forensics analysis
  const updateWaveform = useCallback(() => {
    if (!isMountedRef.current) return;
    
    if (!analyserRef.current || isPaused) {
      animationFrameRef.current = requestAnimationFrame(updateWaveform);
      return;
    }

    const dataArray = new Uint8Array(analyserRef.current.frequencyBinCount);
    analyserRef.current.getByteFrequencyData(dataArray);

    // Sample 40 points from the frequency data
    const samples = 40;
    const step = Math.floor(dataArray.length / samples);
    const newWaveform = [];
    
    for (let i = 0; i < samples; i++) {
      const value = dataArray[i * step] / 255; // Normalize to 0-1
      newWaveform.push(value);
    }
    
    if (isMountedRef.current) {
      setWaveformData(newWaveform);
    }
    
    // FORENSICS: Analyze audio frame for metrics
    analyzeAudioFrame(analyserRef.current);
    
    animationFrameRef.current = requestAnimationFrame(updateWaveform);
  }, [isPaused]);

  const startRecording = async () => {
    // Check consent before starting - if null, require consent first
    if (mycroftConsent === null) {
      onConsentRequired?.();
      return;
    }
    
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ 
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true
        } 
      });
      
      streamRef.current = stream;

      // Setup Web Audio API for visualization
      const audioContext = new AudioContext();
      audioContextRef.current = audioContext;
      
      const source = audioContext.createMediaStreamSource(stream);
      const analyser = audioContext.createAnalyser();
      analyser.fftSize = 2048; // Increased for better pitch detection
      analyser.smoothingTimeConstant = 0.7;
      source.connect(analyser);
      analyserRef.current = analyser;

      // Start waveform animation
      animationFrameRef.current = requestAnimationFrame(updateWaveform);

      // Setup MediaRecorder
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
        
        // Calculate recording duration
        const recordingDurationMs = Date.now() - recordingStartTimeRef.current;
        
        // FORENSICS: Finalize session and get metrics
        const metrics = finalizeForensicsSession(recordingDurationMs);
        console.log('[AudioRecorder] Final forensic metrics:', metrics);
        
        stream.getTracks().forEach(track => track.stop());
        if (audioContext.state !== 'closed') {
          audioContext.close();
        }
        
        const audioBlob = new Blob(chunksRef.current, { type: 'audio/webm' });
        await uploadAudio(audioBlob, metrics);
      };

      // FORENSICS: Mark recording start time
      recordingStartTimeRef.current = Date.now();
      markRecordingStart();

      mediaRecorder.start(100);
      setIsRecording(true);
      setIsPaused(false);
      setRecordingTime(0);
      setWaveformData(new Array(40).fill(0));

      // Timer
      timerRef.current = setInterval(() => {
        setRecordingTime(prev => {
          if (prev >= MAX_DURATION - 1) {
            stopRecording();
            return MAX_DURATION;
          }
          return prev + 1;
        });
      }, 1000);

    } catch (error: any) {
      console.error('Error starting recording:', error);
      
      // Detect Android overlay permission error
      const isOverlayError = error?.name === 'NotAllowedError' || 
        error?.message?.includes('permission') ||
        error?.message?.includes('Permission');
      
      if (isOverlayError) {
        toast({ 
          title: 'Permissão bloqueada', 
          description: 'Feche apps com sobreposição (bolhas de chat, gravadores) e tente novamente. Ou verifique as permissões do navegador.',
          variant: 'destructive',
          duration: 8000
        });
      } else {
        toast({ 
          title: 'Erro ao acessar microfone', 
          description: 'Verifique se o microfone está disponível e permita o acesso.',
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
      
      // Resume timer
      timerRef.current = setInterval(() => {
        setRecordingTime(prev => {
          if (prev >= MAX_DURATION - 1) {
            stopRecording();
            return MAX_DURATION;
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

  const uploadAudio = async (blob: Blob, metrics: VoiceMetrics) => {
    if (!isMountedRef.current) return;
    
    setIsUploading(true);
    try {
      const fileName = `${roomId}/${Date.now()}.webm`;
      
      const { data, error } = await supabase.storage
        .from('game-audio')
        .upload(fileName, blob, {
          contentType: 'audio/webm',
          upsert: true
        });

      if (error) throw error;
      if (!isMountedRef.current) return;

      const { data: publicUrlData } = supabase.storage
        .from('game-audio')
        .getPublicUrl(fileName);

      const url = publicUrlData.publicUrl;
      
      if (!isMountedRef.current) return;
      setAudioUrl(url);

      // Save URL to room
      await supabase
        .from('rooms')
        .update({ current_audio_url: url })
        .eq('id', roomId);

      if (!isMountedRef.current) return;
      
      // Pass metrics along with audio URL
      onRecordingComplete?.(url, metrics);
      toast({ title: 'Áudio gravado!', description: 'Sua justificativa foi salva.' });

    } catch (error) {
      console.error('Error uploading audio:', error);
      if (isMountedRef.current) {
        toast({ 
          title: 'Erro ao salvar áudio', 
          variant: 'destructive' 
        });
      }
    } finally {
      if (isMountedRef.current) {
        setIsUploading(false);
      }
    }
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const progressPercent = (recordingTime / MAX_DURATION) * 100;
  const isNearEnd = recordingTime > MAX_DURATION * 0.8;

  return (
    <div className="bg-background/50 backdrop-blur-sm border border-gold/20 rounded-xl p-4">
      <div className="flex items-center gap-3 mb-3">
        <div className="w-10 h-10 rounded-full bg-gold/20 flex items-center justify-center">
          <Mic className="w-5 h-5 text-gold" />
        </div>
        <div>
          <h4 className="font-semibold text-sm">Justificativa em Áudio</h4>
          <p className="text-xs text-muted-foreground">Grave sua explicação para o júri (máx. 60s)</p>
        </div>
      </div>

      <AnimatePresence mode="sync">
        {isRecording ? (
          <motion.div
            key="recording"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="space-y-4"
          >
            {/* Progress bar */}
            <div className="space-y-2">
              <div className="relative h-2 bg-background/50 rounded-full overflow-hidden">
                <motion.div
                  className={`absolute inset-y-0 left-0 rounded-full transition-colors ${
                    isNearEnd ? 'bg-destructive' : 'bg-gold'
                  }`}
                  style={{ width: `${progressPercent}%` }}
                />
                {/* Warning marker at 80% */}
                <div className="absolute inset-y-0 left-[80%] w-px bg-destructive/50" />
              </div>
              <div className="flex items-center justify-between text-xs">
                <div className="flex items-center gap-2">
                  <span className={`font-mono font-bold ${isNearEnd ? 'text-destructive' : 'text-foreground'}`}>
                    {formatTime(recordingTime)}
                  </span>
                  {isPaused && (
                    <span className="text-amber-500 text-[10px] uppercase font-bold tracking-wider animate-pulse">
                      Pausado
                    </span>
                  )}
                </div>
                <span className="text-muted-foreground">
                  {formatTime(MAX_DURATION - recordingTime)} restantes
                </span>
              </div>
            </div>

            {/* Real-time waveform visualization */}
            <div className="relative h-16 bg-background/30 rounded-lg overflow-hidden flex items-center justify-center px-2">
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
              
              {/* Forensics indicator */}
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="absolute top-2 right-2 flex items-center gap-1"
              >
                <div className="w-1.5 h-1.5 rounded-full bg-cyan-500 animate-pulse" />
                <span className="text-[9px] text-cyan-500 font-mono uppercase">Forense</span>
              </motion.div>
              
              {/* Waveform bars */}
              <div className="flex items-center gap-[2px] h-full py-2">
                {waveformData.map((value, i) => (
                  <motion.div
                    key={i}
                    className={`w-1 rounded-full ${isPaused ? 'bg-amber-500/50' : 'bg-gold'}`}
                    animate={{ 
                      height: isPaused ? 4 : Math.max(4, value * 48),
                      opacity: isPaused ? 0.5 : 0.4 + value * 0.6
                    }}
                    transition={{ duration: 0.05 }}
                  />
                ))}
              </div>
            </div>

            {/* Control buttons */}
            <div className="flex gap-2">
              {isPaused ? (
                <GoldButton 
                  onClick={resumeRecording} 
                  className="flex-1"
                >
                  <Play className="w-4 h-4 mr-2 fill-current" />
                  Retomar
                </GoldButton>
              ) : (
                <GoldButton 
                  onClick={pauseRecording} 
                  variant="outline"
                  className="flex-1"
                >
                  <Pause className="w-4 h-4 mr-2 fill-current" />
                  Pausar
                </GoldButton>
              )}
              <GoldButton 
                onClick={stopRecording} 
                variant={isPaused ? "ghost" : "primary"}
                className="flex-1"
              >
                <Square className="w-4 h-4 mr-2 fill-current" />
                Finalizar
              </GoldButton>
            </div>
          </motion.div>
        ) : isUploading ? (
          <motion.div
            key="uploading"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="flex items-center justify-center gap-3 py-6"
          >
            <Loader2 className="w-5 h-5 animate-spin text-gold" />
            <span className="text-sm text-muted-foreground">Salvando áudio...</span>
          </motion.div>
        ) : audioUrl ? (
          <motion.div
            key="complete"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-3"
          >
            <div className="flex items-center gap-2 text-green-500 text-sm">
              <Volume2 className="w-4 h-4" />
              <span>Áudio gravado com sucesso!</span>
            </div>
            <audio src={audioUrl} controls className="w-full h-10" />
            <GoldButton 
              onClick={startRecording} 
              variant="outline" 
              size="sm"
              className="w-full"
              disabled={disabled}
            >
              <Mic className="w-4 h-4 mr-2" />
              Regravar
            </GoldButton>
          </motion.div>
        ) : (
          <motion.div
            key="idle"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
          >
            <GoldButton 
              onClick={startRecording} 
              className="w-full"
              disabled={disabled}
            >
              <Mic className="w-4 h-4 mr-2" />
              Gravar Justificativa
            </GoldButton>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
