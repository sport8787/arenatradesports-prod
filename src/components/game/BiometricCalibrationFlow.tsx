/**
 * BiometricCalibrationFlow Component
 * Polygraph-style calibration that captures truth and lie baselines
 */

import { useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Coins, CheckCircle2, AlertTriangle, Camera, Mic, ArrowRight, SkipForward, Brain, Shield, Target } from 'lucide-react';
import AudioRecorder from '@/components/game/AudioRecorder';
import VideoRecorder from '@/components/game/VideoRecorder';
import RecordingModeSelector, { type RecordingMode } from '@/components/game/RecordingModeSelector';
import type { VoiceMetrics } from '@/services/audioForensicsService';
import type { VideoForensicsResult } from '@/services/videoForensicsService';
import {
  CALIBRATION_QUESTIONS,
  CALIBRATION_BONUS_BC,
  createBiometricBaseline,
  getBaselineSummary,
  type CalibrationQuestion,
} from '@/services/biometricCalibrationService';

interface BiometricCalibrationFlowProps {
  onComplete: (calibrated: boolean, bonusBC: number) => void;
  onSkip: () => void;
  playerName: string;
}

type CalibrationPhase = 'intro' | 'mode_select' | 'recording_truth' | 'recording_lie' | 'processing' | 'complete';

export function BiometricCalibrationFlow({ onComplete, onSkip, playerName }: BiometricCalibrationFlowProps) {
  const [phase, setPhase] = useState<CalibrationPhase>('intro');
  const [recordingMode, setRecordingMode] = useState<RecordingMode | null>(null);
  
  // Captured data
  const [truthVoice, setTruthVoice] = useState<VoiceMetrics | null>(null);
  const [lieVoice, setLieVoice] = useState<VoiceMetrics | null>(null);
  const [truthVideo, setTruthVideo] = useState<VideoForensicsResult | null>(null);
  const [lieVideo, setLieVideo] = useState<VideoForensicsResult | null>(null);
  
  const [processingProgress, setProcessingProgress] = useState(0);
  
  const truthQuestion = CALIBRATION_QUESTIONS.find(q => q.id === 'truth')!;
  const lieQuestion = CALIBRATION_QUESTIONS.find(q => q.id === 'lie')!;
  
  // Check if baseline already exists
  const baselineSummary = getBaselineSummary();
  
  // Handle recording complete for truth
  const handleTruthRecordingComplete = useCallback((
    audioUrl: string,
    voiceMetrics: VoiceMetrics,
    videoUrl?: string,
    videoMetrics?: VideoForensicsResult
  ) => {
    setTruthVoice(voiceMetrics);
    if (videoMetrics) setTruthVideo(videoMetrics);
    
    // Move to lie recording after short delay
    setTimeout(() => {
      setPhase('recording_lie');
    }, 500);
  }, []);
  
  // Handle recording complete for lie
  const handleLieRecordingComplete = useCallback((
    audioUrl: string,
    voiceMetrics: VoiceMetrics,
    videoUrl?: string,
    videoMetrics?: VideoForensicsResult
  ) => {
    setLieVoice(voiceMetrics);
    if (videoMetrics) setLieVideo(videoMetrics);
    
    // Start processing
    setPhase('processing');
    
    // Simulate processing with progress
    let progress = 0;
    const interval = setInterval(() => {
      progress += 10;
      setProcessingProgress(progress);
      
      if (progress >= 100) {
        clearInterval(interval);
        
        // Create baseline
        if (truthVoice && voiceMetrics) {
          createBiometricBaseline(
            truthVoice,
            voiceMetrics,
            truthVideo || undefined,
            videoMetrics || undefined
          );
        }
        
        setPhase('complete');
      }
    }, 200);
  }, [truthVoice, truthVideo]);
  
  // Handle mode selection
  const handleModeSelect = useCallback((mode: RecordingMode) => {
    setRecordingMode(mode);
    setPhase('recording_truth');
  }, []);
  
  // Handle completion
  const handleComplete = useCallback(() => {
    onComplete(true, CALIBRATION_BONUS_BC);
  }, [onComplete]);
  
  // Render based on phase
  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-primary/5 flex items-center justify-center p-4">
      <AnimatePresence mode="wait">
        {/* INTRO PHASE */}
        {phase === 'intro' && (
          <motion.div
            key="intro"
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9 }}
            className="max-w-lg w-full"
          >
            <div className="bg-card/80 backdrop-blur-md rounded-2xl border border-primary/30 p-8 shadow-2xl">
              {/* Header */}
              <div className="text-center mb-6">
                <div className="w-20 h-20 mx-auto mb-4 rounded-full bg-gradient-to-br from-primary/20 to-accent/20 flex items-center justify-center">
                  <Brain className="w-10 h-10 text-primary" />
                </div>
                <h1 className="text-2xl font-bold bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
                  Calibração Biométrica
                </h1>
                <p className="text-muted-foreground mt-2">
                  Como um polígrafo profissional
                </p>
              </div>
              
              {/* Explanation */}
              <div className="space-y-4 mb-6">
                <div className="flex items-start gap-3 p-3 rounded-lg bg-primary/5 border border-primary/10">
                  <Target className="w-5 h-5 text-primary mt-0.5 shrink-0" />
                  <div>
                    <p className="font-medium text-sm">Para que serve?</p>
                    <p className="text-xs text-muted-foreground">
                      Captura seu padrão único de voz e expressão facial para análises mais precisas durante o jogo.
                    </p>
                  </div>
                </div>
                
                <div className="flex items-start gap-3 p-3 rounded-lg bg-accent/5 border border-accent/10">
                  <Shield className="w-5 h-5 text-accent mt-0.5 shrink-0" />
                  <div>
                    <p className="font-medium text-sm">Como funciona?</p>
                    <p className="text-xs text-muted-foreground">
                      Você responderá 2 perguntas simples: uma dizendo a verdade e outra mentindo. O sistema aprenderá seus padrões.
                    </p>
                  </div>
                </div>
                
                <div className="flex items-start gap-3 p-3 rounded-lg bg-chart-3/5 border border-chart-3/10">
                  <Coins className="w-5 h-5 text-chart-3 mt-0.5 shrink-0" />
                  <div>
                    <p className="font-medium text-sm">Bônus de Calibração</p>
                    <p className="text-xs text-muted-foreground">
                      Ganhe <span className="font-bold text-chart-3">+{CALIBRATION_BONUS_BC} BC</span> ao completar a calibração!
                    </p>
                  </div>
                </div>
              </div>
              
              {/* Existing baseline warning */}
              {baselineSummary.exists && (
                <div className="mb-6 p-3 rounded-lg bg-chart-4/10 border border-chart-4/20 flex items-center gap-3">
                  <AlertTriangle className="w-5 h-5 text-chart-4 shrink-0" />
                  <p className="text-xs text-muted-foreground">
                    Você já possui uma calibração válida por mais {baselineSummary.hoursRemaining}h. 
                    Recalibrar substituirá o baseline atual.
                  </p>
                </div>
              )}
              
              {/* Actions */}
              <div className="flex flex-col gap-3">
                <Button
                  onClick={() => setPhase('mode_select')}
                  className="w-full bg-gradient-to-r from-primary to-accent hover:opacity-90"
                  size="lg"
                >
                  <Brain className="w-4 h-4 mr-2" />
                  Iniciar Calibração
                  <ArrowRight className="w-4 h-4 ml-2" />
                </Button>
                
                <Button
                  variant="ghost"
                  onClick={onSkip}
                  className="w-full text-muted-foreground hover:text-foreground"
                >
                  <SkipForward className="w-4 h-4 mr-2" />
                  Pular (usar baseline genérico)
                </Button>
              </div>
              
              <p className="text-center text-xs text-muted-foreground mt-4">
                ⏱️ Tempo estimado: ~30 segundos
              </p>
            </div>
          </motion.div>
        )}
        
        {/* MODE SELECT PHASE */}
        {phase === 'mode_select' && (
          <motion.div
            key="mode_select"
            initial={{ opacity: 0, x: 50 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -50 }}
            className="max-w-lg w-full"
          >
            <div className="bg-card/80 backdrop-blur-md rounded-2xl border border-primary/30 p-8 shadow-2xl">
              <h2 className="text-xl font-bold text-center mb-6">
                Escolha o modo de captura
              </h2>
              
              <RecordingModeSelector
                onSelect={handleModeSelect}
                mycroftConsent={true}
                disabled={false}
              />
              
              <Button
                variant="ghost"
                onClick={() => setPhase('intro')}
                className="w-full mt-4 text-muted-foreground"
              >
                Voltar
              </Button>
            </div>
          </motion.div>
        )}
        
        {/* RECORDING TRUTH PHASE */}
        {phase === 'recording_truth' && recordingMode && (
          <motion.div
            key="recording_truth"
            initial={{ opacity: 0, x: 50 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -50 }}
            className="max-w-2xl w-full"
          >
            <CalibrationRecordingCard
              question={truthQuestion}
              recordingMode={recordingMode}
              onRecordingComplete={handleTruthRecordingComplete}
              stepNumber={1}
              totalSteps={2}
            />
          </motion.div>
        )}
        
        {/* RECORDING LIE PHASE */}
        {phase === 'recording_lie' && recordingMode && (
          <motion.div
            key="recording_lie"
            initial={{ opacity: 0, x: 50 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -50 }}
            className="max-w-2xl w-full"
          >
            <CalibrationRecordingCard
              question={lieQuestion}
              recordingMode={recordingMode}
              onRecordingComplete={handleLieRecordingComplete}
              stepNumber={2}
              totalSteps={2}
            />
          </motion.div>
        )}
        
        {/* PROCESSING PHASE */}
        {phase === 'processing' && (
          <motion.div
            key="processing"
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9 }}
            className="max-w-md w-full"
          >
            <div className="bg-card/80 backdrop-blur-md rounded-2xl border border-primary/30 p-8 shadow-2xl text-center">
              <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-gradient-to-br from-primary/20 to-accent/20 flex items-center justify-center animate-pulse">
                <Brain className="w-8 h-8 text-primary" />
              </div>
              
              <h2 className="text-xl font-bold mb-2">Analisando Padrões</h2>
              <p className="text-muted-foreground text-sm mb-6">
                Criando seu perfil biométrico único...
              </p>
              
              <Progress value={processingProgress} className="h-2 mb-4" />
              <p className="text-xs text-muted-foreground">
                {processingProgress}% completo
              </p>
            </div>
          </motion.div>
        )}
        
        {/* COMPLETE PHASE */}
        {phase === 'complete' && (
          <motion.div
            key="complete"
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9 }}
            className="max-w-md w-full"
          >
            <div className="bg-card/80 backdrop-blur-md rounded-2xl border border-chart-3/30 p-8 shadow-2xl text-center">
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ type: "spring", delay: 0.2 }}
                className="w-20 h-20 mx-auto mb-4 rounded-full bg-gradient-to-br from-chart-3/20 to-chart-4/20 flex items-center justify-center"
              >
                <CheckCircle2 className="w-10 h-10 text-chart-3" />
              </motion.div>
              
              <h2 className="text-2xl font-bold text-chart-3 mb-2">
                Calibração Completa!
              </h2>
              <p className="text-muted-foreground text-sm mb-6">
                Seu perfil biométrico foi criado com sucesso. A análise do Mycroft agora será personalizada para você.
              </p>
              
              {/* Bonus display */}
              <motion.div
                initial={{ y: 20, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ delay: 0.4 }}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-chart-3/10 border border-chart-3/20 mb-6"
              >
                <Coins className="w-5 h-5 text-chart-3" />
                <span className="font-bold text-chart-3">+{CALIBRATION_BONUS_BC} BC</span>
                <span className="text-sm text-muted-foreground">Bônus de Calibração</span>
              </motion.div>
              
              <Button
                onClick={handleComplete}
                className="w-full bg-gradient-to-r from-chart-3 to-chart-4 hover:opacity-90"
                size="lg"
              >
                Começar o Jogo
                <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// Sub-component for recording cards
interface CalibrationRecordingCardProps {
  question: CalibrationQuestion;
  recordingMode: RecordingMode;
  onRecordingComplete: (
    audioUrl: string,
    voiceMetrics: VoiceMetrics,
    videoUrl?: string,
    videoMetrics?: VideoForensicsResult
  ) => void;
  stepNumber: number;
  totalSteps: number;
}

function CalibrationRecordingCard({
  question,
  recordingMode,
  onRecordingComplete,
  stepNumber,
  totalSteps,
}: CalibrationRecordingCardProps) {
  const isTruth = question.id === 'truth';
  const borderColor = isTruth ? 'border-chart-3/50' : 'border-destructive/50';
  const bgColor = isTruth ? 'from-chart-3/10' : 'from-destructive/10';
  const iconColor = isTruth ? 'text-chart-3' : 'text-destructive';
  
  return (
    <div className={`bg-card/80 backdrop-blur-md rounded-2xl border ${borderColor} p-6 shadow-2xl`}>
      {/* Progress indicator */}
      <div className="flex items-center justify-between mb-4">
        <span className="text-xs text-muted-foreground">
          Passo {stepNumber} de {totalSteps}
        </span>
        <Progress value={(stepNumber / totalSteps) * 100} className="w-24 h-1" />
      </div>
      
      {/* Instruction banner */}
      <div className={`p-4 rounded-lg bg-gradient-to-r ${bgColor} to-transparent border ${borderColor} mb-6`}>
        <div className="flex items-center gap-3">
          {isTruth ? (
            <CheckCircle2 className={`w-8 h-8 ${iconColor}`} />
          ) : (
            <AlertTriangle className={`w-8 h-8 ${iconColor}`} />
          )}
          <div>
            <p className={`text-lg font-bold ${iconColor}`}>
              {question.instruction}
            </p>
            <p className="text-sm text-muted-foreground">
              {question.hint}
            </p>
          </div>
        </div>
      </div>
      
      {/* Question */}
      <div className="text-center mb-6">
        <p className="text-xl font-semibold">
          {question.question}
        </p>
      </div>
      
      {/* Recorder */}
      <div className="flex justify-center">
        {recordingMode === 'video' ? (
          <VideoRecorder
            roomId="calibration"
            mycroftConsent={true}
            onRecordingComplete={(videoUrl, audioMetrics, videoMetrics) => {
              // Generate a placeholder audio URL for calibration
              onRecordingComplete(videoUrl, audioMetrics, videoUrl, videoMetrics);
            }}
            maxDuration={15}
          />
        ) : (
          <AudioRecorder
            roomId="calibration"
            mycroftConsent={true}
            onRecordingComplete={(audioUrl, metrics) => {
              onRecordingComplete(audioUrl, metrics);
            }}
          />
        )}
      </div>
      
      <p className="text-center text-xs text-muted-foreground mt-4">
        {recordingMode === 'video' ? (
          <>
            <Camera className="inline w-3 h-3 mr-1" />
            Modo Vídeo: voz + expressões faciais
          </>
        ) : (
          <>
            <Mic className="inline w-3 h-3 mr-1" />
            Modo Áudio: apenas análise vocal
          </>
        )}
      </p>
    </div>
  );
}

export default BiometricCalibrationFlow;
