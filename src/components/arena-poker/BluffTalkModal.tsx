import { useState, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Mic, MicOff, Video, VideoOff, X, RefreshCw, Lightbulb, Shield, Crosshair, Target, Camera, Eye } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { MonocleIcon, PharaohIcon } from './PersonaIcons';

// ─── Types ───────────────────────────────────────────────────
type RecordMode = 'audio' | 'video';

interface BluffTalkModalProps {
  street: string;
  heroCards: string;
  boardCards: string;
  heroAction: string;
  villainName: string;
  villainProfile: string;
  onClose: () => void;
  onComplete: (result: BluffAnalysisResult | null) => void;
}

interface BluffAnalysisResult {
  bluffScore: number;
  opponentReaction: string;
  leakDetection: string;
  alignmentCheck: string;
  suggestedPhrases: string[];
  mycroftVerdict: string;
  horusComment: string;
  transcript: string;
}

interface ProvocationSuggestion {
  text: string;
  tone: string;
  effectiveness: number;
}

type Intent = 'intimidate' | 'induce_call' | 'induce_fold';

const INTENT_CONFIG: Record<Intent, { label: string; emoji: string; description: string; icon: React.ElementType }> = {
  intimidate: { label: 'Amedrontar', emoji: '💀', description: 'Representar força', icon: Shield },
  induce_call: { label: 'Induzir Call', emoji: '🪤', description: 'Armadilha / Value', icon: Target },
  induce_fold: { label: 'Induzir Fold', emoji: '🔥', description: 'Pressão máxima', icon: Crosshair },
};

export default function BluffTalkModal({
  street, heroCards, boardCards, heroAction, villainName, villainProfile, onClose, onComplete,
}: BluffTalkModalProps) {
  const [phase, setPhase] = useState<'intent' | 'suggest' | 'record_mode' | 'record' | 'analyzing' | 'result'>('intent');
  const [intent, setIntent] = useState<Intent | null>(null);
  const [suggestions, setSuggestions] = useState<ProvocationSuggestion[]>([]);
  const [isLoadingSuggestions, setIsLoadingSuggestions] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [analysisResult, setAnalysisResult] = useState<BluffAnalysisResult | null>(null);
  const [transcript, setTranscript] = useState('');
  const [recordMode, setRecordMode] = useState<RecordMode>('video');

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  // ─── Fetch Mycroft Suggestions ─────────────────────────────
  const fetchSuggestions = useCallback(async (selectedIntent: Intent) => {
    setIsLoadingSuggestions(true);
    try {
      const { data, error } = await supabase.functions.invoke('arena-poker-street-training', {
        body: {
          action: 'suggest_provocation',
          heroCards, boardCards, street, heroAction,
          intent: selectedIntent, villainName, villainProfile,
        },
      });
      if (error) throw error;
      setSuggestions(data.suggestions || []);
      setPhase('suggest');
    } catch (err) {
      console.error('Suggestion error:', err);
      toast.error('Erro ao gerar sugestões');
      setPhase('record');
    } finally {
      setIsLoadingSuggestions(false);
    }
  }, [heroCards, boardCards, street, heroAction, villainName, villainProfile]);

  // ─── Select Intent ────────────────────────────────────────
  const handleIntentSelect = (selectedIntent: Intent) => {
    setIntent(selectedIntent);
    fetchSuggestions(selectedIntent);
  };

  // ─── Recording ────────────────────────────────────────────
  const videoPreviewRef = useRef<HTMLVideoElement | null>(null);

  const startRecording = async () => {
    try {
      const useVideo = recordMode === 'video';
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: useVideo });
      streamRef.current = stream;
      const mimeType = useVideo ? 'video/webm;codecs=vp9,opus' : 'audio/webm;codecs=opus';
      const recorder = new MediaRecorder(stream, { mimeType });

      // Show video preview
      if (useVideo && videoPreviewRef.current) {
        videoPreviewRef.current.srcObject = stream;
        videoPreviewRef.current.play().catch(() => {});
      }
      mediaRecorderRef.current = recorder;
      chunksRef.current = [];

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };

      recorder.onstop = () => {
        stream.getTracks().forEach(t => t.stop());
      };

      recorder.start(100);
      setIsRecording(true);
      setRecordingTime(0);

      timerRef.current = setInterval(() => {
        setRecordingTime(prev => {
          if (prev >= 20) {
            stopRecording();
            return prev;
          }
          return prev + 1;
        });
      }, 1000);
    } catch (err) {
      console.error('Recording error:', err);
      toast.error('Não foi possível acessar câmera/microfone');
    }
  };

  const stopRecording = useCallback(async () => {
    if (timerRef.current) clearInterval(timerRef.current);
    
    const recorder = mediaRecorderRef.current;
    if (!recorder || recorder.state === 'inactive') return;

    return new Promise<void>((resolve) => {
      recorder.onstop = async () => {
        streamRef.current?.getTracks().forEach(t => t.stop());
        if (videoPreviewRef.current) videoPreviewRef.current.srcObject = null;
        setIsRecording(false);
        setPhase('analyzing');

        const blobType = recordMode === 'video' ? 'video/webm' : 'audio/webm';
        const blob = new Blob(chunksRef.current, { type: blobType });
        await analyzeBluffTalk(blob);
        resolve();
      };
      recorder.stop();
    });
  }, []);

  // ─── Analyze ──────────────────────────────────────────────
  const analyzeBluffTalk = async (mediaBlob: Blob) => {
    try {
      // 1. Upload recording to storage
      const ext = recordMode === 'video' ? 'webm' : 'webm';
      const contentType = recordMode === 'video' ? 'video/webm' : 'audio/webm';
      const fileName = `bluff-talk/${Date.now()}.${ext}`;
      const { error: uploadError } = await supabase.storage
        .from('game-video')
        .upload(fileName, mediaBlob, { contentType });
      
      if (uploadError) console.error('Upload error:', uploadError);

      // 2. Transcribe audio (use Web Speech API as fallback)
      let transcriptText = '';
      try {
        // Extract audio for STT
        const audioBlob = new Blob(chunksRef.current, { type: 'audio/webm' });
        const formData = new FormData();
        formData.append('audio', audioBlob, 'bluff-talk.webm');
        formData.append('model_id', 'scribe_v2');
        formData.append('language_code', 'por');

        const { data: sttData } = await supabase.functions.invoke('elevenlabs-stt', {
          body: formData,
        });
        transcriptText = sttData?.text || 'Transcrição indisponível';
      } catch {
        transcriptText = 'Transcrição indisponível — análise baseada apenas no contexto';
      }

      setTranscript(transcriptText);

      // 3. Analyze with Mycroft
      const { data, error } = await supabase.functions.invoke('arena-poker-bluff-talk', {
        body: {
          transcript: transcriptText,
          duration: recordingTime,
          heroCards, boardCards, street, heroAction,
          intent, villainName, villainProfile,
          recordMode,
        },
      });

      if (error) throw error;

      const result: BluffAnalysisResult = {
        ...data,
        transcript: transcriptText,
      };
      setAnalysisResult(result);
      setPhase('result');
    } catch (err) {
      console.error('Analysis error:', err);
      toast.error('Erro na análise. Tente novamente.');
      setPhase('record');
    }
  };

  // ─── Retry ────────────────────────────────────────────────
  const handleRetry = () => {
    setAnalysisResult(null);
    setTranscript('');
    setPhase('record');
  };

  // ─── Score Color ──────────────────────────────────────────
  const scoreColor = (score: number) => {
    if (score >= 80) return 'text-[hsl(var(--success))]';
    if (score >= 50) return 'text-[hsl(var(--arena-gold))]';
    return 'text-[hsl(var(--destructive))]';
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4"
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.9, y: 20 }}
        animate={{ scale: 1, y: 0 }}
        exit={{ scale: 0.9, y: 20 }}
        className="bg-background border border-[hsl(var(--arena-cyan)_/_0.3)] rounded-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-5 py-4 border-b border-border flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Video className="w-5 h-5 text-[hsl(var(--arena-gold))]" />
            <h3 className="font-mono text-sm font-bold uppercase tracking-wider">
              <span className="text-[hsl(var(--arena-gold))]">Provocação de Mesa</span>
              <span className="text-muted-foreground ml-2">— {street}</span>
            </h3>
          </div>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-5 space-y-5">
          {/* ─── Phase: Intent Selection ─────────────────── */}
          {phase === 'intent' && (
            <div className="space-y-4">
              <div className="text-center space-y-2 mb-2">
                <p className="font-mono text-sm text-foreground font-bold">
                  🎬 Grave uma provocação como se estivesse em uma mesa real
                </p>
                <p className="font-mono text-xs text-muted-foreground">
                  Fale diretamente para o seu oponente. O Mycroft vai analisar sua voz, expressões faciais e coerência com a jogada.
                </p>
              </div>
              <p className="font-mono text-xs text-muted-foreground text-center uppercase tracking-wider">
                Qual sua intenção nesta provocação?
              </p>
              <div className="grid gap-3">
                {(Object.entries(INTENT_CONFIG) as [Intent, typeof INTENT_CONFIG[Intent]][]).map(([key, cfg]) => (
                  <button
                    key={key}
                    onClick={() => handleIntentSelect(key)}
                    disabled={isLoadingSuggestions}
                    className="flex items-center gap-4 p-4 border border-[hsl(var(--border)_/_0.5)] rounded-xl hover:border-[hsl(var(--arena-gold)_/_0.5)] hover:bg-[hsl(var(--arena-gold)_/_0.03)] transition-all text-left"
                  >
                    <span className="text-2xl">{cfg.emoji}</span>
                    <div>
                      <p className="font-mono text-sm font-bold text-foreground">{cfg.label}</p>
                      <p className="font-mono text-xs text-muted-foreground">{cfg.description}</p>
                    </div>
                  </button>
                ))}
              </div>
              <Button variant="ghost" onClick={() => { setPhase('record_mode'); }} className="w-full font-mono text-xs text-muted-foreground">
                Pular intenção → Gravar direto
              </Button>
            </div>
          )}

          {/* ─── Phase: Mycroft Suggestions ──────────────── */}
          {phase === 'suggest' && (
            <div className="space-y-4">
              <div className="flex items-center gap-2 mb-3">
                <MonocleIcon className="text-[hsl(var(--arena-cyan))]" size={18} />
                <span className="font-mono text-xs uppercase tracking-wider text-[hsl(var(--arena-cyan))] font-bold">
                  Mycroft sugere:
                </span>
              </div>
              {suggestions.map((s, i) => (
                <div key={i} className="border border-[hsl(var(--arena-cyan)_/_0.2)] rounded-lg p-4 bg-[hsl(var(--arena-cyan)_/_0.03)]">
                  <p className="font-mono text-sm text-foreground italic mb-2">"{s.text}"</p>
                  <div className="flex items-center gap-3">
                    <span className="font-mono text-[10px] px-2 py-0.5 rounded bg-[hsl(var(--arena-cyan)_/_0.15)] text-[hsl(var(--arena-cyan))]">
                      {s.tone}
                    </span>
                    <span className="font-mono text-[10px] text-muted-foreground">
                      Eficácia: {s.effectiveness}/10
                    </span>
                  </div>
                </div>
              ))}
              <Button
                onClick={() => setPhase('record_mode')}
                className="w-full bg-[hsl(var(--arena-gold))] text-black font-mono font-bold uppercase"
              >
                <Video className="w-4 h-4 mr-2" /> Gravar Provocação
              </Button>
            </div>
          )}

          {/* ─── Phase: Record Mode Selection ────────────── */}
          {phase === 'record_mode' && (
            <div className="space-y-4">
              <p className="font-mono text-sm text-center text-foreground font-bold mb-1">
                Como você quer gravar?
              </p>
              <p className="font-mono text-xs text-center text-muted-foreground mb-2">
                No poker real, sua expressão facial diz tanto quanto suas palavras.
              </p>
              <div className="grid gap-3">
                <button
                  onClick={() => { setRecordMode('video'); setPhase('record'); }}
                  className="relative flex items-center gap-4 p-4 border-2 border-[hsl(var(--success)_/_0.5)] rounded-xl bg-[hsl(var(--success)_/_0.05)] hover:bg-[hsl(var(--success)_/_0.1)] transition-all text-left"
                >
                  <div className="absolute -top-2.5 left-1/2 -translate-x-1/2 px-2.5 py-0.5 bg-[hsl(var(--success))] text-black text-[9px] font-bold rounded-full font-mono uppercase">
                    Recomendado
                  </div>
                  <div className="p-2.5 rounded-lg bg-[hsl(var(--success)_/_0.2)]">
                    <Camera className="w-5 h-5 text-[hsl(var(--success))]" />
                  </div>
                  <div className="flex-1">
                    <p className="font-mono text-sm font-bold text-foreground">🎥 Vídeo + Áudio</p>
                    <p className="font-mono text-xs text-muted-foreground">Mycroft analisa micro-expressões, olhar e tensão facial</p>
                  </div>
                  <Eye className="w-4 h-4 text-[hsl(var(--success)_/_0.5)]" />
                </button>
                <button
                  onClick={() => { setRecordMode('audio'); setPhase('record'); }}
                  className="flex items-center gap-4 p-4 border border-[hsl(var(--border)_/_0.5)] rounded-xl hover:border-[hsl(var(--arena-gold)_/_0.5)] hover:bg-[hsl(var(--arena-gold)_/_0.03)] transition-all text-left"
                >
                  <div className="p-2.5 rounded-lg bg-[hsl(var(--primary)_/_0.2)]">
                    <Mic className="w-5 h-5 text-[hsl(var(--primary))]" />
                  </div>
                  <div className="flex-1">
                    <p className="font-mono text-sm font-bold text-foreground">🎙️ Apenas Áudio</p>
                    <p className="font-mono text-xs text-muted-foreground">Análise vocal: tom, hesitações, cadência</p>
                  </div>
                </button>
              </div>
            </div>
          )}

          {/* ─── Phase: Recording ────────────────────────── */}
          {phase === 'record' && (
            <div className="text-center space-y-5">
              <div className="space-y-1">
                <p className="font-mono text-sm text-foreground font-bold">
                  {recordMode === 'video' ? '🎥 Olhe para a câmera e provoque seu oponente' : '🎙️ Fale como se estivesse na mesa'}
                </p>
                <p className="font-mono text-xs text-muted-foreground">
                  {recordMode === 'video'
                    ? 'Mycroft vai analisar suas micro-expressões e coerência facial'
                    : 'Mycroft vai analisar tom, hesitações e cadência vocal'
                  }
                </p>
              </div>

              <div className="flex items-center justify-center gap-3">
                {intent && (
                  <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-[hsl(var(--arena-gold)_/_0.1)] border border-[hsl(var(--arena-gold)_/_0.3)]">
                    <span className="text-sm">{INTENT_CONFIG[intent].emoji}</span>
                    <span className="font-mono text-xs text-[hsl(var(--arena-gold))] font-bold">{INTENT_CONFIG[intent].label}</span>
                  </div>
                )}
                <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-secondary/50 border border-border">
                  {recordMode === 'video' ? <Camera className="w-3 h-3 text-[hsl(var(--success))]" /> : <Mic className="w-3 h-3 text-[hsl(var(--primary))]" />}
                  <span className="font-mono text-[10px] text-muted-foreground">{recordMode === 'video' ? 'Vídeo' : 'Áudio'}</span>
                </div>
              </div>

              {/* Video preview */}
              {recordMode === 'video' && (
                <div className="relative w-48 h-36 mx-auto rounded-xl overflow-hidden border border-[hsl(var(--border)_/_0.3)] bg-black/50">
                  <video ref={videoPreviewRef} muted playsInline className="w-full h-full object-cover" style={{ transform: 'scaleX(-1)' }} />
                  {isRecording && (
                    <div className="absolute top-2 right-2 flex items-center gap-1 px-1.5 py-0.5 rounded bg-[hsl(var(--destructive))] text-white">
                      <div className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
                      <span className="font-mono text-[9px] font-bold">REC</span>
                    </div>
                  )}
                  {!isRecording && !streamRef.current && (
                    <div className="absolute inset-0 flex items-center justify-center">
                      <Camera className="w-8 h-8 text-muted-foreground/30" />
                    </div>
                  )}
                </div>
              )}

              <div className="relative inline-flex items-center justify-center">
                <motion.div
                  animate={isRecording ? { scale: [1, 1.15, 1] } : {}}
                  transition={{ repeat: Infinity, duration: 1.5 }}
                  className={`w-20 h-20 rounded-full flex items-center justify-center cursor-pointer transition-all ${
                    isRecording
                      ? 'bg-[hsl(var(--destructive))] shadow-[0_0_30px_hsl(var(--destructive)_/_0.5)]'
                      : 'bg-[hsl(var(--arena-gold))] shadow-[0_0_20px_hsl(var(--arena-gold)_/_0.3)]'
                  }`}
                  onClick={isRecording ? stopRecording : startRecording}
                >
                  {isRecording ? (
                    recordMode === 'video' ? <VideoOff className="w-8 h-8 text-white" /> : <MicOff className="w-8 h-8 text-white" />
                  ) : (
                    recordMode === 'video' ? <Camera className="w-8 h-8 text-black" /> : <Mic className="w-8 h-8 text-black" />
                  )}
                </motion.div>
              </div>

              {isRecording && (
                <div className="space-y-2">
                  <p className="font-mono text-2xl font-bold text-[hsl(var(--destructive))]">{recordingTime}s</p>
                  <div className="w-full h-1.5 rounded-full bg-secondary overflow-hidden">
                    <motion.div
                      className="h-full bg-[hsl(var(--destructive))]"
                      initial={{ width: 0 }}
                      animate={{ width: `${(recordingTime / 20) * 100}%` }}
                    />
                  </div>
                  <p className="font-mono text-[10px] text-muted-foreground">Máximo: 20 segundos</p>
                </div>
              )}

              <div className="flex justify-center gap-3">
                <Button variant="ghost" onClick={() => setPhase('record_mode')} className="font-mono text-xs text-muted-foreground">
                  ← Trocar modo
                </Button>
                <Button variant="ghost" onClick={() => onComplete(null)} className="font-mono text-xs text-muted-foreground">
                  Pular →
                </Button>
              </div>
            </div>
          )}

          {/* ─── Phase: Analyzing ────────────────────────── */}
          {phase === 'analyzing' && (
            <div className="text-center py-8 space-y-4">
              <MonocleIcon className="mx-auto text-[hsl(var(--arena-cyan))] animate-pulse" size={40} />
              <p className="font-mono text-sm text-[hsl(var(--arena-cyan))]">
                Mycroft analisando provocação...
              </p>
              <p className="font-mono text-xs text-muted-foreground">
                {recordMode === 'video'
                  ? 'Transcrevendo áudio, analisando micro-expressões e simulando reação do oponente'
                  : 'Transcrevendo áudio e simulando reação do oponente'
                }
              </p>
            </div>
          )}

          {/* ─── Phase: Result ───────────────────────────── */}
          {phase === 'result' && analysisResult && (
            <div className="space-y-4">
              {/* Score */}
              <div className="text-center">
                <p className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground mb-1">Bluff Quality Score</p>
                <p className={`font-mono text-5xl font-black ${scoreColor(analysisResult.bluffScore)}`}>
                  {analysisResult.bluffScore}
                </p>
              </div>

              {/* Transcript */}
              <div className="border border-[hsl(var(--border)_/_0.3)] rounded-lg p-3 bg-secondary/20">
                <p className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground mb-1">Sua fala:</p>
                <p className="font-mono text-xs text-foreground italic">"{analysisResult.transcript}"</p>
              </div>

              {/* Alignment Check — MOST IMPORTANT */}
              <div className={`border rounded-lg p-4 ${
                analysisResult.bluffScore >= 60
                  ? 'border-[hsl(var(--success)_/_0.4)] bg-[hsl(var(--success)_/_0.05)]'
                  : 'border-[hsl(var(--destructive)_/_0.4)] bg-[hsl(var(--destructive)_/_0.05)]'
              }`}>
                <div className="flex items-center gap-2 mb-2">
                  <MonocleIcon className="text-[hsl(var(--arena-cyan))]" size={16} />
                  <span className="font-mono text-[10px] uppercase tracking-widest text-[hsl(var(--arena-cyan))] font-bold">
                    Coerência Narrativa
                  </span>
                </div>
                <p className="font-mono text-xs text-foreground">{analysisResult.alignmentCheck}</p>
              </div>

              {/* Leak Detection */}
              {analysisResult.leakDetection && (
                <div className="border border-[hsl(var(--destructive)_/_0.3)] rounded-lg p-3 bg-[hsl(var(--destructive)_/_0.03)]">
                  <p className="font-mono text-[10px] uppercase tracking-widest text-[hsl(var(--destructive))] mb-1 font-bold">⚠️ Leaks Detectados</p>
                  <p className="font-mono text-xs text-foreground">{analysisResult.leakDetection}</p>
                </div>
              )}

              {/* Opponent Reaction */}
              <div className="border border-[hsl(var(--border)_/_0.3)] rounded-lg p-3">
                <p className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground mb-1">Reação do Oponente:</p>
                <p className="font-mono text-xs text-foreground">{analysisResult.opponentReaction}</p>
              </div>

              {/* Suggested Better Lines */}
              {analysisResult.suggestedPhrases?.length > 0 && (
                <div className="border border-[hsl(var(--arena-cyan)_/_0.2)] rounded-lg p-3 bg-[hsl(var(--arena-cyan)_/_0.03)]">
                  <p className="font-mono text-[10px] uppercase tracking-widest text-[hsl(var(--arena-cyan))] mb-2 font-bold flex items-center gap-1.5">
                    <Lightbulb className="w-3 h-3" /> Frases Mais Eficazes
                  </p>
                  {analysisResult.suggestedPhrases.map((phrase, i) => (
                    <p key={i} className="font-mono text-xs text-foreground italic mb-1">"{phrase}"</p>
                  ))}
                </div>
              )}

              {/* Hórus Comment */}
              <div className="border border-[hsl(var(--arena-gold)_/_0.3)] rounded-lg p-3 bg-[hsl(var(--arena-gold)_/_0.04)]">
                <div className="flex items-center gap-2 mb-1">
                  <PharaohIcon className="text-[hsl(var(--arena-gold))]" size={16} />
                  <span className="font-mono text-[10px] uppercase tracking-wider text-[hsl(var(--arena-gold))] font-bold">Hórus diz:</span>
                </div>
                <p className="font-mono text-xs text-[hsl(var(--arena-gold))] italic">"{analysisResult.horusComment}"</p>
              </div>

              {/* Actions */}
              <div className="flex gap-3 pt-2">
                <Button variant="outline" onClick={handleRetry} className="flex-1 font-mono text-xs uppercase">
                  <RefreshCw className="w-3.5 h-3.5 mr-1.5" /> Regravar
                </Button>
                <Button
                  onClick={() => onComplete(analysisResult)}
                  className="flex-1 bg-[hsl(var(--arena-gold))] text-black font-mono font-bold uppercase"
                >
                  Continuar →
                </Button>
              </div>
            </div>
          )}
        </div>

        {/* Disclaimer */}
        <div className="px-5 py-3 border-t border-border">
          <p className="font-mono text-[9px] text-muted-foreground/50 text-center">
            ⚠️ Para estudo/treino. Não use como assistência em tempo real durante jogo ao vivo.
          </p>
        </div>
      </motion.div>
    </motion.div>
  );
}
