/**
 * Hook para integrar persistência de dados ML nos fluxos de jogo
 * Gerencia match, recordings (com baseline_id) e training labels automaticamente
 */

import { useState, useCallback, useRef, useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import {
  createMatch,
  updateMatchEnd,
  saveRecordingWithMLData,
  saveAIJuryVotes,
  generateTrainingLabel,
  recordConsent,
  type MatchData,
  type RecordingMLData,
} from '@/services/mlDataPersistenceService';
import type { VoiceMetrics } from '@/services/audioForensicsService';

export interface SaveRecordingInput {
  roundNumber: number;
  audioUrl: string;
  videoUrl?: string;
  captureMode: 'audio' | 'video';
  voiceMetrics: VoiceMetrics;
  facialAnalysis?: RecordingMLData['facialAnalysis'];
  questionId?: string;
  questionDifficulty?: string;
  questionCategory?: string;
  answerWasCorrect?: boolean;
  timeToAnswerMs?: number;
  mycroftVerdict?: string;
  mycroftForensicDetails?: string;
  combinedSuspicionScore?: number;
  wasBluffing?: boolean;
  playerName?: string;
  playerId?: string;
  baselineId?: string;
}

interface UseMLDataPersistenceOptions {
  gameMode: 'solo' | 'multiplayer' | 'presenter';
  difficultyMode: 'aquecimento' | 'desafio' | 'extremo';
  totalRounds: number;
  roomId?: string;
}

interface UseMLDataPersistenceReturn {
  matchId: string | null;
  currentRecordingId: string | null;
  isInitialized: boolean;
  
  // Match lifecycle
  initMatch: () => Promise<string | null>;
  endMatch: (finalScore: number, roundsCompleted: number, wasCompleted: boolean) => Promise<void>;
  
  // Recording persistence
  saveRecording: (data: {
    roundNumber: number;
    audioUrl: string;
    videoUrl?: string;
    captureMode: 'audio' | 'video';
    voiceMetrics: VoiceMetrics;
    facialAnalysis?: RecordingMLData['facialAnalysis'];
    questionId?: string;
    questionDifficulty?: string;
    questionCategory?: string;
    answerWasCorrect?: boolean;
    timeToAnswerMs?: number;
    mycroftVerdict?: string;
    mycroftForensicDetails?: string;
    combinedSuspicionScore?: number;
    wasBluffing?: boolean;
    playerName?: string;
    playerId?: string;
  }) => Promise<string | null>;
  
  // AI Jury votes
  saveAIVotes: (
    questionId: string,
    playerId: string,
    votes: Array<{
      profile: 'prudente' | 'tubarao' | 'quant';
      vote: 'believe' | 'doubt';
      confidence: number;
      reasoning: string;
    }>
  ) => Promise<void>;
  
  // Training label
  generateLabel: () => Promise<string | null>;
  
  // Consent
  recordMycroftConsent: (consentGiven: boolean) => Promise<void>;
  recordTrainingOptIn: (optIn: boolean) => Promise<void>;
  recordVideoConsent: (consentGiven: boolean) => Promise<void>;
}

function getDeviceType(): 'desktop' | 'mobile' | 'tablet' {
  const ua = navigator.userAgent.toLowerCase();
  if (/tablet|ipad|playbook|silk/i.test(ua)) return 'tablet';
  if (/mobile|iphone|ipod|android|blackberry|opera mini|iemobile/i.test(ua)) return 'mobile';
  return 'desktop';
}

function getSessionId(): string {
  let sessionId = sessionStorage.getItem('blefador_session_id');
  if (!sessionId) {
    sessionId = `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    sessionStorage.setItem('blefador_session_id', sessionId);
  }
  return sessionId;
}

function getConsentLevel(): 'metrics_only' | 'training_opt_in' {
  const trainingOptIn = localStorage.getItem('mycroft_training_opt_in');
  return trainingOptIn === 'true' ? 'training_opt_in' : 'metrics_only';
}

export function useMLDataPersistence(options: UseMLDataPersistenceOptions): UseMLDataPersistenceReturn {
  const { user } = useAuth();
  const [matchId, setMatchId] = useState<string | null>(null);
  const [currentRecordingId, setCurrentRecordingId] = useState<string | null>(null);
  const [isInitialized, setIsInitialized] = useState(false);
  
  const sessionId = useRef(getSessionId());

  // Initialize match when component mounts
  const initMatch = useCallback(async (): Promise<string | null> => {
    const matchData: MatchData = {
      roomId: options.roomId,
      gameMode: options.gameMode,
      difficultyMode: options.difficultyMode,
      totalRounds: options.totalRounds,
      playerSessionId: sessionId.current,
      playerUserId: user?.id,
    };

    const id = await createMatch(matchData);
    if (id) {
      setMatchId(id);
      setIsInitialized(true);
      console.log('[useMLDataPersistence] ✅ Match initialized:', id);
    }
    return id;
  }, [options.roomId, options.gameMode, options.difficultyMode, options.totalRounds, user?.id]);

  // End match
  const endMatch = useCallback(async (
    finalScore: number,
    roundsCompleted: number,
    wasCompleted: boolean
  ): Promise<void> => {
    if (matchId) {
      await updateMatchEnd(matchId, finalScore, roundsCompleted, wasCompleted);
      console.log('[useMLDataPersistence] ✅ Match ended');
    }
  }, [matchId]);

  // Save recording with all ML data
  const saveRecording = useCallback(async (data: SaveRecordingInput): Promise<string | null> => {
    const recordingData: RecordingMLData = {
      matchId: matchId || undefined,
      roomId: options.roomId,
      playerId: data.playerId,
      questionId: data.questionId,
      roundNumber: data.roundNumber,
      audioUrl: data.audioUrl,
      videoUrl: data.videoUrl,
      captureMode: data.captureMode,
      deviceType: getDeviceType(),
      consentLevel: getConsentLevel(),
      questionDifficulty: data.questionDifficulty,
      questionCategory: data.questionCategory,
      answerWasCorrect: data.answerWasCorrect,
      timeToAnswerMs: data.timeToAnswerMs,
      voiceMetrics: data.voiceMetrics,
      facialAnalysis: data.facialAnalysis,
      mycroftVerdict: data.mycroftVerdict,
      mycroftForensicDetails: data.mycroftForensicDetails,
      combinedSuspicionScore: data.combinedSuspicionScore,
      wasBluffing: data.wasBluffing,
      playerName: data.playerName,
      sessionId: sessionId.current,
      baselineId: data.baselineId,
    };

    const id = await saveRecordingWithMLData(recordingData);
    if (id) {
      setCurrentRecordingId(id);
      console.log('[useMLDataPersistence] ✅ Recording saved:', id);
    }
    return id;
  }, [matchId, options.roomId]);

  // Save AI jury votes
  const saveAIVotes = useCallback(async (
    questionId: string,
    playerId: string,
    votes: Array<{
      profile: 'prudente' | 'tubarao' | 'quant';
      vote: 'believe' | 'doubt';
      confidence: number;
      reasoning: string;
    }>
  ): Promise<void> => {
    if (!options.roomId) return;
    
    await saveAIJuryVotes(
      options.roomId,
      questionId,
      playerId,
      currentRecordingId || undefined,
      votes
    );
  }, [options.roomId, currentRecordingId]);

  // Generate training label
  const generateLabel = useCallback(async (): Promise<string | null> => {
    if (!currentRecordingId) {
      console.warn('[useMLDataPersistence] No recording ID to generate label for');
      return null;
    }
    
    const labelId = await generateTrainingLabel(currentRecordingId);
    console.log('[useMLDataPersistence] ✅ Training label generated:', labelId);
    return labelId;
  }, [currentRecordingId]);

  // Consent recording
  const recordMycroftConsent = useCallback(async (consentGiven: boolean): Promise<void> => {
    await recordConsent({
      userId: user?.id,
      sessionId: sessionId.current,
      consentType: 'mycroft_analysis',
      consentGiven,
    });
  }, [user?.id]);

  const recordTrainingOptIn = useCallback(async (optIn: boolean): Promise<void> => {
    localStorage.setItem('mycroft_training_opt_in', optIn.toString());
    await recordConsent({
      userId: user?.id,
      sessionId: sessionId.current,
      consentType: 'training_opt_in',
      consentGiven: optIn,
    });
  }, [user?.id]);

  const recordVideoConsent = useCallback(async (consentGiven: boolean): Promise<void> => {
    await recordConsent({
      userId: user?.id,
      sessionId: sessionId.current,
      consentType: 'video_capture',
      consentGiven,
    });
  }, [user?.id]);

  return {
    matchId,
    currentRecordingId,
    isInitialized,
    initMatch,
    endMatch,
    saveRecording,
    saveAIVotes,
    generateLabel,
    recordMycroftConsent,
    recordTrainingOptIn,
    recordVideoConsent,
  };
}
