// Microphone Calibration Panel
// Shows real-time volume level and warns about clipping or low audio

import React, { useEffect, useRef, useState, useCallback } from 'react';
import { motion } from 'framer-motion';
import { Mic, MicOff, AlertTriangle, CheckCircle, Volume2, VolumeX } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface MicCalibrationPanelProps {
  onCalibrated: () => void;
  onSkip?: () => void;
}

type AudioStatus = 'idle' | 'listening' | 'good' | 'low' | 'clipping' | 'error';

const STATUS_CONFIG: Record<AudioStatus, {
  label: string;
  color: string;
  bgColor: string;
  icon: React.ReactNode;
  message: string;
}> = {
  idle: {
    label: 'Aguardando',
    color: 'text-muted-foreground',
    bgColor: 'bg-muted',
    icon: <MicOff className="w-5 h-5" />,
    message: 'Clique para testar o microfone',
  },
  listening: {
    label: 'Ouvindo...',
    color: 'text-blue-400',
    bgColor: 'bg-blue-500/20',
    icon: <Mic className="w-5 h-5 animate-pulse" />,
    message: 'Fale algo para calibrar o nível',
  },
  good: {
    label: 'Nível OK',
    color: 'text-emerald-400',
    bgColor: 'bg-emerald-500/20',
    icon: <CheckCircle className="w-5 h-5" />,
    message: 'Volume ideal para gravação!',
  },
  low: {
    label: 'Volume Baixo',
    color: 'text-yellow-400',
    bgColor: 'bg-yellow-500/20',
    icon: <VolumeX className="w-5 h-5" />,
    message: 'Fale mais alto ou aproxime-se do microfone',
  },
  clipping: {
    label: 'Clipando!',
    color: 'text-red-400',
    bgColor: 'bg-red-500/20',
    icon: <AlertTriangle className="w-5 h-5" />,
    message: 'Volume muito alto! Afaste-se do microfone',
  },
  error: {
    label: 'Erro',
    color: 'text-red-400',
    bgColor: 'bg-red-500/20',
    icon: <MicOff className="w-5 h-5" />,
    message: 'Não foi possível acessar o microfone',
  },
};

export const MicCalibrationPanel: React.FC<MicCalibrationPanelProps> = ({
  onCalibrated,
  onSkip,
}) => {
  const [status, setStatus] = useState<AudioStatus>('idle');
  const [volume, setVolume] = useState(0);
  const [peakVolume, setPeakVolume] = useState(0);
  const [goodSamples, setGoodSamples] = useState(0);
  
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  
  const GOOD_THRESHOLD = 0.08;  // Minimum for "good"
  const CLIP_THRESHOLD = 0.95; // Maximum before clipping
  const REQUIRED_GOOD_SAMPLES = 15; // ~0.5 seconds of good audio
  
  const stopListening = useCallback(() => {
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    if (audioContextRef.current?.state !== 'closed') {
      audioContextRef.current?.close();
      audioContextRef.current = null;
    }
  }, []);
  
  const analyzeAudio = useCallback(() => {
    if (!analyserRef.current) return;
    
    const dataArray = new Uint8Array(analyserRef.current.fftSize);
    analyserRef.current.getByteTimeDomainData(dataArray);
    
    // Calculate RMS volume
    let sum = 0;
    let peak = 0;
    for (let i = 0; i < dataArray.length; i++) {
      const normalized = Math.abs((dataArray[i] - 128) / 128);
      sum += normalized * normalized;
      if (normalized > peak) peak = normalized;
    }
    const rms = Math.sqrt(sum / dataArray.length);
    
    setVolume(rms);
    setPeakVolume(prev => Math.max(prev * 0.95, peak)); // Decay peak slowly
    
    // Determine status
    if (peak >= CLIP_THRESHOLD) {
      setStatus('clipping');
      setGoodSamples(0);
    } else if (rms < GOOD_THRESHOLD * 0.3) {
      setStatus('low');
      setGoodSamples(0);
    } else if (rms >= GOOD_THRESHOLD && peak < CLIP_THRESHOLD * 0.9) {
      setStatus('good');
      setGoodSamples(prev => {
        const next = prev + 1;
        if (next >= REQUIRED_GOOD_SAMPLES) {
          // Auto-complete after sustained good level
          setTimeout(() => onCalibrated(), 500);
        }
        return next;
      });
    } else {
      setStatus('listening');
    }
    
    animationFrameRef.current = requestAnimationFrame(analyzeAudio);
  }, [onCalibrated]);
  
  const startListening = async () => {
    try {
      setStatus('listening');
      setPeakVolume(0);
      setGoodSamples(0);
      
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      
      const audioContext = new AudioContext();
      audioContextRef.current = audioContext;
      
      const source = audioContext.createMediaStreamSource(stream);
      const analyser = audioContext.createAnalyser();
      analyser.fftSize = 2048;
      analyser.smoothingTimeConstant = 0.3;
      
      source.connect(analyser);
      analyserRef.current = analyser;
      
      analyzeAudio();
    } catch (err) {
      console.error('[MicCalibration] Error:', err);
      setStatus('error');
    }
  };
  
  useEffect(() => {
    return () => stopListening();
  }, [stopListening]);
  
  const config = STATUS_CONFIG[status];
  const volumePercent = Math.min(100, Math.round(volume * 500)); // Scale for visibility
  const peakPercent = Math.min(100, Math.round(peakVolume * 100));
  const progressPercent = Math.min(100, (goodSamples / REQUIRED_GOOD_SAMPLES) * 100);
  
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="p-5 rounded-xl border border-border bg-card/50 backdrop-blur-sm space-y-4"
    >
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className={`p-2 rounded-lg ${config.bgColor}`}>
          <span className={config.color}>{config.icon}</span>
        </div>
        <div>
          <h3 className="font-semibold text-foreground">Calibração do Microfone</h3>
          <p className="text-sm text-muted-foreground">
            Verifique se o áudio está sendo captado corretamente
          </p>
        </div>
      </div>
      
      {/* Volume Meter */}
      <div className="space-y-2">
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span>Volume</span>
          <span className={config.color}>{config.label}</span>
        </div>
        
        {/* Main volume bar */}
        <div className="relative h-8 bg-secondary rounded-lg overflow-hidden">
          {/* Volume fill */}
          <motion.div
            className={`absolute inset-y-0 left-0 ${
              status === 'clipping' ? 'bg-red-500' :
              status === 'good' ? 'bg-emerald-500' :
              status === 'low' ? 'bg-yellow-500' :
              'bg-blue-500'
            }`}
            animate={{ width: `${volumePercent}%` }}
            transition={{ duration: 0.05 }}
          />
          
          {/* Peak indicator */}
          <motion.div
            className="absolute top-0 bottom-0 w-1 bg-white/80"
            animate={{ left: `${peakPercent}%` }}
            transition={{ duration: 0.1 }}
          />
          
          {/* Threshold markers */}
          <div 
            className="absolute top-0 bottom-0 w-0.5 bg-yellow-400/50"
            style={{ left: `${GOOD_THRESHOLD * 500}%` }}
          />
          <div 
            className="absolute top-0 bottom-0 w-0.5 bg-red-400/50"
            style={{ left: `${CLIP_THRESHOLD * 100}%` }}
          />
          
          {/* Labels */}
          <div className="absolute inset-0 flex items-center justify-center">
            <span className="text-xs font-medium text-white drop-shadow-md">
              {volumePercent}%
            </span>
          </div>
        </div>
        
        {/* Legend */}
        <div className="flex justify-between text-[10px] text-muted-foreground">
          <span>Baixo</span>
          <span className="text-emerald-400">Ideal</span>
          <span className="text-red-400">Clipping</span>
        </div>
      </div>
      
      {/* Status Message */}
      <div className={`p-3 rounded-lg ${config.bgColor} border border-current/20`}>
        <p className={`text-sm ${config.color} flex items-center gap-2`}>
          <Volume2 className="w-4 h-4" />
          {config.message}
        </p>
      </div>
      
      {/* Progress to calibrated */}
      {status === 'good' && (
        <div className="space-y-1">
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>Calibrando...</span>
            <span>{Math.round(progressPercent)}%</span>
          </div>
          <div className="h-1.5 bg-secondary rounded-full overflow-hidden">
            <motion.div
              className="h-full bg-emerald-500"
              animate={{ width: `${progressPercent}%` }}
            />
          </div>
        </div>
      )}
      
      {/* Actions */}
      <div className="flex gap-3">
        {status === 'idle' || status === 'error' ? (
          <Button 
            onClick={startListening}
            className="flex-1 bg-primary hover:bg-primary/90"
          >
            <Mic className="w-4 h-4 mr-2" />
            Testar Microfone
          </Button>
        ) : (
          <Button 
            onClick={() => {
              stopListening();
              setStatus('idle');
              setVolume(0);
              setPeakVolume(0);
              setGoodSamples(0);
            }}
            variant="outline"
            className="flex-1"
          >
            <MicOff className="w-4 h-4 mr-2" />
            Parar Teste
          </Button>
        )}
        
        {onSkip && (
          <Button 
            onClick={onSkip}
            variant="ghost"
            className="text-muted-foreground hover:text-foreground"
          >
            Pular
          </Button>
        )}
      </div>
      
      {/* Continue button when calibrated */}
      {goodSamples >= REQUIRED_GOOD_SAMPLES && (
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
        >
          <Button 
            onClick={onCalibrated}
            className="w-full bg-emerald-600 hover:bg-emerald-500"
          >
            <CheckCircle className="w-4 h-4 mr-2" />
            Microfone Calibrado - Continuar
          </Button>
        </motion.div>
      )}
    </motion.div>
  );
};

export default MicCalibrationPanel;
