import { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Mic, Square, Loader2, Volume2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';
import GoldButton from './GoldButton';

interface AudioRecorderProps {
  roomId: string;
  onRecordingComplete?: (audioUrl: string) => void;
  disabled?: boolean;
}

export default function AudioRecorder({ roomId, onRecordingComplete, disabled }: AudioRecorderProps) {
  const [isRecording, setIsRecording] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [recordingTime, setRecordingTime] = useState(0);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const MAX_DURATION = 30; // 30 seconds max

  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
        mediaRecorderRef.current.stop();
      }
    };
  }, []);

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ 
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true
        } 
      });
      
      const mediaRecorder = new MediaRecorder(stream, { mimeType: 'audio/webm' });
      mediaRecorderRef.current = mediaRecorder;
      chunksRef.current = [];

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          chunksRef.current.push(e.data);
        }
      };

      mediaRecorder.onstop = async () => {
        stream.getTracks().forEach(track => track.stop());
        if (timerRef.current) clearInterval(timerRef.current);
        
        const audioBlob = new Blob(chunksRef.current, { type: 'audio/webm' });
        await uploadAudio(audioBlob);
      };

      mediaRecorder.start(100);
      setIsRecording(true);
      setRecordingTime(0);

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

    } catch (error) {
      console.error('Error starting recording:', error);
      toast({ 
        title: 'Erro ao acessar microfone', 
        description: 'Permita o acesso ao microfone para gravar.',
        variant: 'destructive' 
      });
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    }
  };

  const uploadAudio = async (blob: Blob) => {
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

      const { data: publicUrlData } = supabase.storage
        .from('game-audio')
        .getPublicUrl(fileName);

      const url = publicUrlData.publicUrl;
      setAudioUrl(url);

      // Save URL to room
      await supabase
        .from('rooms')
        .update({ current_audio_url: url })
        .eq('id', roomId);

      onRecordingComplete?.(url);
      toast({ title: 'Áudio gravado!', description: 'Sua justificativa foi salva.' });

    } catch (error) {
      console.error('Error uploading audio:', error);
      toast({ 
        title: 'Erro ao salvar áudio', 
        variant: 'destructive' 
      });
    } finally {
      setIsUploading(false);
    }
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className="bg-background/50 backdrop-blur-sm border border-gold/20 rounded-xl p-4">
      <div className="flex items-center gap-3 mb-3">
        <div className="w-10 h-10 rounded-full bg-gold/20 flex items-center justify-center">
          <Mic className="w-5 h-5 text-gold" />
        </div>
        <div>
          <h4 className="font-semibold text-sm">Justificativa em Áudio</h4>
          <p className="text-xs text-muted-foreground">Grave sua explicação para o júri</p>
        </div>
      </div>

      <AnimatePresence mode="wait">
        {isRecording ? (
          <motion.div
            key="recording"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="space-y-3"
          >
            {/* Recording indicator */}
            <div className="flex items-center justify-center gap-3 py-4">
              <motion.div
                animate={{ scale: [1, 1.2, 1] }}
                transition={{ repeat: Infinity, duration: 1 }}
                className="w-4 h-4 rounded-full bg-destructive"
              />
              <span className="font-mono text-xl text-destructive">
                {formatTime(recordingTime)}
              </span>
              <span className="text-xs text-muted-foreground">/ {formatTime(MAX_DURATION)}</span>
            </div>

            {/* Waveform visualization */}
            <div className="flex items-center justify-center gap-1 h-12">
              {[...Array(20)].map((_, i) => (
                <motion.div
                  key={i}
                  animate={{ 
                    height: [8, Math.random() * 32 + 8, 8],
                  }}
                  transition={{ 
                    repeat: Infinity, 
                    duration: 0.3 + Math.random() * 0.4,
                    delay: i * 0.05 
                  }}
                  className="w-1 bg-gold/60 rounded-full"
                />
              ))}
            </div>

            <GoldButton 
              onClick={stopRecording} 
              variant="outline" 
              className="w-full"
            >
              <Square className="w-4 h-4 mr-2 fill-current" />
              Parar Gravação
            </GoldButton>
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
