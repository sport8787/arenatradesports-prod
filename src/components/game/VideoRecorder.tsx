/**
 * VideoRecorder Component
 * Records video with webcam for Mycroft 2.0 facial analysis
 * Includes real-time face landmark tracking using MediaPipe FaceMesh
 * Now with visual overlay showing 478 green biometric landmarks
 */

import { useState, useRef, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Video, VideoOff, Mic, MicOff, Circle, Square, Pause, Play, Upload, AlertCircle, Eye, Camera, Scan } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Switch } from '@/components/ui/switch';
import { supabase } from '@/integrations/supabase/client';
import { 
  startForensicsSession, 
  markRecordingStart,
  analyzeAudioFrame, 
  finalizeForensicsSession,
  type VoiceMetrics 
} from '@/services/audioForensicsService';
import {
  startVideoForensicsSession,
  analyzeFrame as analyzeVideoFrame,
  finalizeVideoForensicsSession,
  type VideoForensicsResult,
} from '@/services/videoForensicsService';
import {
  initializeFaceMesh,
  startFaceDetection,
  stopFaceDetection,
  destroyFaceMesh,
  isFaceMeshReady,
} from '@/services/faceMeshService';
import FaceLandmarksOverlay from './FaceLandmarksOverlay';
import LiveBiometricIndicators from './LiveBiometricIndicators';
import AudioCaptureVisualizer from './AudioCaptureVisualizer';

interface VideoRecorderProps {
  roomId: string;
  onRecordingComplete: (
    videoUrl: string, 
    audioMetrics: VoiceMetrics, 
    videoMetrics: VideoForensicsResult
  ) => void;
  disabled?: boolean;
  maxDuration?: number; // in seconds, default 60
  mycroftConsent: boolean | null;
  onConsentRequired?: () => void;
}

type RecordingState = 'idle' | 'preparing' | 'loading-facemesh' | 'recording' | 'paused' | 'processing' | 'uploading' | 'complete' | 'error';

export default function VideoRecorder({
  roomId,
  onRecordingComplete,
  disabled = false,
  maxDuration = 60,
  mycroftConsent,
  onConsentRequired,
}: VideoRecorderProps) {
  const [state, setState] = useState<RecordingState>('idle');
  const [error, setError] = useState<string | null>(null);
  const [timer, setTimer] = useState(0);
  const [hasCamera, setHasCamera] = useState(true);
  const [hasMic, setHasMic] = useState(true);
  const [isCameraOn, setIsCameraOn] = useState(true);
  const [isMicOn, setIsMicOn] = useState(true);
  const [faceDetected, setFaceDetected] = useState(false);
  const [faceMeshLoaded, setFaceMeshLoaded] = useState(false);
  const [showOverlay, setShowOverlay] = useState(true);
  const [currentLandmarks, setCurrentLandmarks] = useState<number[][] | null>(null);
  const [liveBiometrics, setLiveBiometrics] = useState({
    lipTension: 0,
    blinkRate: 0,
    gazeDirection: 'straight' as 'left' | 'right' | 'straight' | 'up' | 'down',
    stressLevel: 0,
  });
  const [videoSize, setVideoSize] = useState({ width: 1280, height: 720 });
  
  // Audio capture visualization state
  const [waveformData, setWaveformData] = useState<number[]>(new Array(40).fill(0));
  const [audioAmplitude, setAudioAmplitude] = useState(0);
  const [audioSamplesCollected, setAudioSamplesCollected] = useState(0);
  
  // Refs
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerIntervalRef = useRef<number | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const animationFrameRef = useRef<number | null>(null);

  // Avoid stale React state closures inside rAF loops
  const isMediaRecorderRecording = () => mediaRecorderRef.current?.state === 'recording';
  
  // MediaPipe tracking state
  const lastLandmarksRef = useRef<number[][] | null>(null);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      cleanup();
      destroyFaceMesh();
    };
  }, []);

  const cleanup = useCallback(() => {
    if (timerIntervalRef.current) {
      clearInterval(timerIntervalRef.current);
      timerIntervalRef.current = null;
    }
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }
    stopFaceDetection();
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
      audioContextRef.current.close();
      audioContextRef.current = null;
    }
    chunksRef.current = [];
    lastLandmarksRef.current = null;
  }, []);

  // Check for camera and mic permissions
  useEffect(() => {
    const checkDevices = async () => {
      try {
        const devices = await navigator.mediaDevices.enumerateDevices();
        const hasVideoInput = devices.some(d => d.kind === 'videoinput');
        const hasAudioInput = devices.some(d => d.kind === 'audioinput');
        setHasCamera(hasVideoInput);
        setHasMic(hasAudioInput);
      } catch (err) {
        console.warn('[VideoRecorder] Cannot enumerate devices:', err);
      }
    };
    checkDevices();
  }, []);

  // Initialize FaceMesh on mount
  useEffect(() => {
    const init = async () => {
      const success = await initializeFaceMesh();
      setFaceMeshLoaded(success);
      if (!success) {
        console.warn('[VideoRecorder] FaceMesh initialization failed, will use fallback');
      }
    };
    init();
  }, []);

  // Callback for FaceMesh results
  const handleFaceMeshResults = useCallback((landmarks: number[][] | null) => {
    if (landmarks) {
      setFaceDetected(true);
      lastLandmarksRef.current = landmarks;
      setCurrentLandmarks(landmarks);
      
      // Analyze frame for facial forensics
      if (state === 'recording') {
        const frameAnalysis = analyzeVideoFrame(landmarks);
        
        // Update live biometric indicators
        setLiveBiometrics({
          lipTension: (frameAnalysis.stressIndicators.lipTension || 0) * 100,
          blinkRate: 15, // Will be calculated from session data
          gazeDirection: frameAnalysis.eyeGaze as 'left' | 'right' | 'straight' | 'up' | 'down',
          stressLevel: frameAnalysis.stressIndicators.overallScore || 0,
        });
      }
    } else {
      setFaceDetected(false);
      lastLandmarksRef.current = null;
      setCurrentLandmarks(null);
    }
  }, [state]);

  // Start recording
  const startRecording = async () => {
    // Check consent first
    if (mycroftConsent === null && onConsentRequired) {
      onConsentRequired();
      return;
    }

    if (mycroftConsent === false) {
      setError('Mycroft desativado. Ative nas configurações para gravar.');
      return;
    }

    setState('preparing');
    setError(null);
    setTimer(0);
    chunksRef.current = [];

    try {
      // Request camera and microphone
      const constraints: MediaStreamConstraints = {
        video: hasCamera ? {
          width: { ideal: 1280 },
          height: { ideal: 720 },
          facingMode: 'user',
        } : false,
        audio: hasMic ? {
          echoCancellation: true,
          noiseSuppression: true,
        } : false,
      };

      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      streamRef.current = stream;

      // Diagnostics (helps confirm the stream is valid)
      console.log('[VideoRecorder] 🎤 Audio tracks:', stream.getAudioTracks().length);
      stream.getAudioTracks().forEach((t, i) => {
        console.log(`[VideoRecorder] 🎤 Track ${i}:`, {
          enabled: t.enabled,
          muted: t.muted,
          readyState: t.readyState,
          label: t.label,
        });
      });

      // Set up video preview
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.muted = true; // Mute preview to avoid feedback
        await videoRef.current.play();
        
        // Start FaceMesh detection if available
        if (faceMeshLoaded) {
          setState('loading-facemesh');
          const faceStarted = await startFaceDetection(videoRef.current, handleFaceMeshResults);
          if (!faceStarted) {
            console.warn('[VideoRecorder] FaceMesh detection failed to start, continuing without');
          }
        }
      }

      // Set up audio analysis
      if (hasMic) {
        audioContextRef.current = new AudioContext();

        // Ensure AudioContext is running (Safari/iOS can start suspended even after getUserMedia)
        if (audioContextRef.current.state === 'suspended') {
          await audioContextRef.current.resume();
        }
        console.log('[VideoRecorder] 🔊 AudioContext state:', audioContextRef.current.state, 'sampleRate:', audioContextRef.current.sampleRate);

        const source = audioContextRef.current.createMediaStreamSource(stream);
        analyserRef.current = audioContextRef.current.createAnalyser();
        analyserRef.current.fftSize = 2048;
        source.connect(analyserRef.current);
      }

      // Start forensics sessions
      startForensicsSession();
      startVideoForensicsSession();

      // Set up MediaRecorder
      const mimeType = MediaRecorder.isTypeSupported('video/webm;codecs=vp9')
        ? 'video/webm;codecs=vp9'
        : MediaRecorder.isTypeSupported('video/webm')
          ? 'video/webm'
          : 'video/mp4';

      mediaRecorderRef.current = new MediaRecorder(stream, {
        mimeType,
        videoBitsPerSecond: 2500000, // 2.5 Mbps
      });

      mediaRecorderRef.current.ondataavailable = (event) => {
        if (event.data.size > 0) {
          chunksRef.current.push(event.data);
        }
      };

      mediaRecorderRef.current.onstop = handleRecordingStop;

      // Start recording
      mediaRecorderRef.current.start(1000); // Collect data every second
      setState('recording');

      // Start latency tracking for this recording
      markRecordingStart();

      // Start timer
      timerIntervalRef.current = window.setInterval(() => {
        setTimer(prev => {
          if (prev >= maxDuration) {
            stopRecording();
            return prev;
          }
          return prev + 1;
        });
      }, 1000);

      // Start analysis loop
      startAnalysisLoop();

    } catch (err: any) {
      console.error('[VideoRecorder] Error starting recording:', err);
      setError(err.message || 'Falha ao acessar câmera/microfone');
      setState('error');
      cleanup();
    }
  };

  // Analysis loop for real-time processing (audio only - FaceMesh handles video via callback)
  const startAnalysisLoop = () => {
    let sampleCount = 0;
    
    const analyze = () => {
      // Analyze audio and update visualization
      if (analyserRef.current) {
        analyzeAudioFrame(analyserRef.current);
        
        // Get frequency data for waveform visualization
        const dataArray = new Uint8Array(analyserRef.current.frequencyBinCount);
        analyserRef.current.getByteFrequencyData(dataArray);
        
        // Sample 40 bars for waveform
        const samples = 40;
        const step = Math.floor(dataArray.length / samples);
        const newWaveform: number[] = [];
        let totalAmplitude = 0;
        
        for (let i = 0; i < samples; i++) {
          const value = dataArray[i * step] / 255;
          newWaveform.push(value);
          totalAmplitude += value;
        }
        
        const avgAmplitude = totalAmplitude / samples;
        sampleCount++;
        
        // Update visualization state (throttled to avoid too many re-renders)
        if (sampleCount % 3 === 0) {
          setWaveformData(newWaveform);
          setAudioAmplitude(avgAmplitude);
          setAudioSamplesCollected(prev => prev + 1);
        }
      }

      // FaceMesh handles video frames via its own callback (handleFaceMeshResults)
      // No need for manual frame processing here

      // IMPORTANT: don't depend on React state here (can be stale at the moment this loop starts)
      if (isMediaRecorderRecording()) {
        animationFrameRef.current = requestAnimationFrame(analyze);
      }
    };

    animationFrameRef.current = requestAnimationFrame(analyze);
  };

  // Pause recording
  const pauseRecording = () => {
    if (mediaRecorderRef.current && state === 'recording') {
      mediaRecorderRef.current.pause();
      setState('paused');
      if (timerIntervalRef.current) {
        clearInterval(timerIntervalRef.current);
        timerIntervalRef.current = null;
      }
    }
  };

  // Resume recording
  const resumeRecording = () => {
    if (mediaRecorderRef.current && state === 'paused') {
      mediaRecorderRef.current.resume();
      setState('recording');
      timerIntervalRef.current = window.setInterval(() => {
        setTimer(prev => {
          if (prev >= maxDuration) {
            stopRecording();
            return prev;
          }
          return prev + 1;
        });
      }, 1000);
      startAnalysisLoop();
    }
  };

  // Stop recording
  const stopRecording = () => {
    if (mediaRecorderRef.current && (state === 'recording' || state === 'paused')) {
      setState('processing');
      mediaRecorderRef.current.stop();
      
      if (timerIntervalRef.current) {
        clearInterval(timerIntervalRef.current);
        timerIntervalRef.current = null;
      }
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
        animationFrameRef.current = null;
      }
    }
  };

  // Handle recording stop
  const handleRecordingStop = async () => {
    setState('uploading');

    try {
      // Finalize forensics analysis
      const audioMetrics = finalizeForensicsSession(timer * 1000);
      const videoMetrics = finalizeVideoForensicsSession();

      // Create video blob
      const videoBlob = new Blob(chunksRef.current, { type: 'video/webm' });
      
      // Upload to Supabase Storage
      const fileName = `${roomId}/${Date.now()}_justification.webm`;
      
      const { data, error: uploadError } = await supabase.storage
        .from('game-video')
        .upload(fileName, videoBlob, {
          contentType: 'video/webm',
          cacheControl: '3600',
        });

      if (uploadError) {
        throw uploadError;
      }

      // Get public URL
      const { data: urlData } = supabase.storage
        .from('game-video')
        .getPublicUrl(fileName);

      const videoUrl = urlData.publicUrl;

      // Update room with video URL
      await supabase
        .from('rooms')
        .update({ current_audio_url: videoUrl })
        .eq('id', roomId);

      setState('complete');
      
      // Call completion handler
      onRecordingComplete(videoUrl, audioMetrics, videoMetrics);

      // Cleanup
      cleanup();

    } catch (err: any) {
      console.error('[VideoRecorder] Upload error:', err);
      setError(err.message || 'Falha no upload do vídeo');
      setState('error');
    }
  };

  // Toggle camera
  const toggleCamera = () => {
    if (streamRef.current) {
      const videoTrack = streamRef.current.getVideoTracks()[0];
      if (videoTrack) {
        videoTrack.enabled = !videoTrack.enabled;
        setIsCameraOn(videoTrack.enabled);
      }
    }
  };

  // Toggle mic
  const toggleMic = () => {
    if (streamRef.current) {
      const audioTrack = streamRef.current.getAudioTracks()[0];
      if (audioTrack) {
        audioTrack.enabled = !audioTrack.enabled;
        setIsMicOn(audioTrack.enabled);
      }
    }
  };

  // Re-record
  const reRecord = () => {
    cleanup();
    setState('idle');
    setTimer(0);
    setError(null);
  };

  // Format timer
  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  // Progress percentage
  const progress = (timer / maxDuration) * 100;

  return (
    <div className="w-full space-y-4">
      {/* Video Preview */}
      <div className="relative aspect-video bg-black/50 rounded-xl overflow-hidden border border-primary/30">
        <video
          ref={videoRef}
          className={`w-full h-full object-cover ${!isCameraOn ? 'hidden' : ''}`}
          playsInline
          muted
          onLoadedMetadata={(e) => {
            const video = e.target as HTMLVideoElement;
            setVideoSize({ width: video.videoWidth || 1280, height: video.videoHeight || 720 });
          }}
        />
        
        {/* Face Landmarks Overlay */}
        {showOverlay && isCameraOn && currentLandmarks && state === 'recording' && (
          <FaceLandmarksOverlay
            landmarks={currentLandmarks}
            width={videoSize.width}
            height={videoSize.height}
            showConnections={true}
            highlightAnomalies={false}
            isScanning={!faceDetected}
          />
        )}
        
        {/* Camera off overlay */}
        {!isCameraOn && state !== 'idle' && (
          <div className="absolute inset-0 flex items-center justify-center bg-muted/80">
            <div className="text-center">
              <VideoOff className="w-12 h-12 mx-auto mb-2 text-muted-foreground" />
              <p className="text-sm text-muted-foreground">Câmera desligada</p>
            </div>
          </div>
        )}

        {/* Idle state */}
        {state === 'idle' && (
          <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-primary/10 to-background/80">
            <div className="text-center space-y-4">
              <motion.div
                animate={{ scale: [1, 1.1, 1] }}
                transition={{ duration: 2, repeat: Infinity }}
                className="w-20 h-20 mx-auto rounded-full bg-primary/20 border-2 border-primary/50 flex items-center justify-center"
              >
                <Camera className="w-10 h-10 text-primary" />
              </motion.div>
              <div>
                <p className="text-lg font-semibold">Pronto para gravar</p>
                <p className="text-sm text-muted-foreground">
                  Sua justificativa será gravada em vídeo
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Recording indicator */}
        <AnimatePresence>
          {state === 'recording' && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="absolute top-4 left-4 flex items-center gap-2 px-3 py-1.5 bg-destructive/90 rounded-full"
            >
              <motion.div
                animate={{ scale: [1, 1.3, 1] }}
                transition={{ duration: 1, repeat: Infinity }}
                className="w-2 h-2 rounded-full bg-white"
              />
              <span className="text-sm font-medium text-white">REC</span>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Timer */}
        {(state === 'recording' || state === 'paused') && (
          <div className="absolute top-4 right-4 px-3 py-1.5 bg-background/80 backdrop-blur-sm rounded-full border border-primary/30">
            <span className="text-sm font-mono font-bold">
              {formatTime(timer)} / {formatTime(maxDuration)}
            </span>
          </div>
        )}

        {/* Eye tracking indicator */}
        {state === 'recording' && mycroftConsent && (
          <div className="absolute bottom-4 left-4 flex items-center gap-2 px-3 py-1.5 bg-background/80 backdrop-blur-sm rounded-full border border-success/30">
            {faceDetected ? (
              <>
                <Scan className="w-4 h-4 text-success" />
                <span className="text-xs text-success">Rosto detectado</span>
              </>
            ) : (
              <>
                <Eye className="w-4 h-4 text-warning animate-pulse" />
                <span className="text-xs text-warning">Posicione seu rosto</span>
              </>
            )}
          </div>
        )}
        
        {/* Live Biometric Indicators */}
        {state === 'recording' && mycroftConsent && faceDetected && (
          <LiveBiometricIndicators
            data={liveBiometrics}
            isActive={true}
            compact={true}
            className="absolute bottom-4 right-4 max-w-[200px]"
          />
        )}

        {/* Hidden canvas for frame processing */}
        <canvas
          ref={canvasRef}
          width={1280}
          height={720}
          className="hidden"
        />

        {/* Processing overlay */}
        <AnimatePresence>
          {(state === 'processing' || state === 'uploading') && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 flex items-center justify-center bg-background/80 backdrop-blur-sm"
            >
              <div className="text-center space-y-4">
                <motion.div
                  animate={{ rotate: 360 }}
                  transition={{ duration: 2, repeat: Infinity, ease: 'linear' }}
                  className="w-12 h-12 mx-auto border-4 border-primary/30 border-t-primary rounded-full"
                />
                <p className="text-sm">
                  {state === 'processing' ? 'Processando análise facial...' : 'Enviando vídeo...'}
                </p>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Progress bar */}
      {(state === 'recording' || state === 'paused') && (
        <div className="space-y-1">
          <Progress value={progress} className="h-2" />
          <p className="text-xs text-center text-muted-foreground">
            {Math.round(maxDuration - timer)}s restantes
          </p>
        </div>
      )}

      {/* Audio Capture Visualizer - below video during recording */}
      {(state === 'recording' || state === 'paused') && (
        <AudioCaptureVisualizer
          waveformData={waveformData}
          isCapturing={state === 'recording'}
          amplitude={audioAmplitude}
          samplesCollected={audioSamplesCollected}
        />
      )}

      {/* Error message */}
      {error && (
        <div className="flex items-center gap-2 p-3 bg-destructive/10 border border-destructive/30 rounded-lg text-sm text-destructive">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Overlay Toggle */}
      {state === 'recording' && mycroftConsent && (
        <div className="flex items-center justify-center gap-2">
          <span className="text-xs text-muted-foreground">Overlay de Landmarks</span>
          <Switch
            checked={showOverlay}
            onCheckedChange={setShowOverlay}
            className="data-[state=checked]:bg-success"
          />
        </div>
      )}

      {/* Controls */}
      <div className="flex items-center justify-center gap-3">
        {state === 'idle' && (
          <Button
            size="lg"
            onClick={startRecording}
            disabled={disabled || (!hasCamera && !hasMic)}
            className="gap-2 bg-destructive hover:bg-destructive/90"
          >
            <Circle className="w-5 h-5 fill-current" />
            Iniciar Gravação
          </Button>
        )}

        {state === 'recording' && (
          <>
            <Button
              variant="outline"
              size="icon"
              onClick={toggleCamera}
              className={!isCameraOn ? 'bg-muted' : ''}
            >
              {isCameraOn ? <Video className="w-5 h-5" /> : <VideoOff className="w-5 h-5" />}
            </Button>
            
            <Button
              variant="outline"
              size="icon"
              onClick={toggleMic}
              className={!isMicOn ? 'bg-muted' : ''}
            >
              {isMicOn ? <Mic className="w-5 h-5" /> : <MicOff className="w-5 h-5" />}
            </Button>

            <Button
              variant="outline"
              size="icon"
              onClick={pauseRecording}
            >
              <Pause className="w-5 h-5" />
            </Button>

            <Button
              size="lg"
              onClick={stopRecording}
              className="gap-2 bg-success hover:bg-success/90"
            >
              <Square className="w-5 h-5" />
              Finalizar
            </Button>
          </>
        )}

        {state === 'paused' && (
          <>
            <Button
              variant="outline"
              size="icon"
              onClick={resumeRecording}
            >
              <Play className="w-5 h-5" />
            </Button>

            <Button
              size="lg"
              onClick={stopRecording}
              className="gap-2 bg-success hover:bg-success/90"
            >
              <Square className="w-5 h-5" />
              Finalizar
            </Button>
          </>
        )}

        {(state === 'complete' || state === 'error') && (
          <Button
            variant="outline"
            size="lg"
            onClick={reRecord}
            className="gap-2"
          >
            <Video className="w-5 h-5" />
            Regravar
          </Button>
        )}
      </div>

      {/* Consent reminder */}
      {mycroftConsent === null && (
        <p className="text-xs text-center text-muted-foreground">
          Clique em "Iniciar Gravação" para configurar o Mycroft
        </p>
      )}

      {state === 'complete' && (
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="flex items-center justify-center gap-2 p-3 bg-success/10 border border-success/30 rounded-lg text-success"
        >
          <Upload className="w-5 h-5" />
          <span className="font-medium">Vídeo enviado com sucesso!</span>
        </motion.div>
      )}
    </div>
  );
}
