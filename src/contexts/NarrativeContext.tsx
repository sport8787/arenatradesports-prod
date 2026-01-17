import React, { createContext, useContext, useEffect, ReactNode } from 'react';
import { useNarrativeEngine } from '@/hooks/useNarrativeEngine';
import { ActConfig, HiddenEvent, NarrativeState } from '@/services/narrativeEngine';
import { usePressureEffects } from '@/components/game/PressureEffects';
import { centralAudioQueue, AUDIO_PRIORITY } from '@/services/centralAudioQueue';
import { toast } from '@/hooks/use-toast';

interface NarrativeContextValue {
  // State
  state: NarrativeState;
  currentAct: ActConfig;
  timerDuration: number;
  timerVisible: boolean;
  pressureLevel: number;
  horusPhrase: string;
  isClimaxRound: boolean;
  isFinalChoice: boolean;
  
  // Actions
  advanceRound: (wasCorrect: boolean) => void;
  resetNarrative: () => void;
  triggerBombEvent: () => void;
  
  // Pressure effects
  isFlashing: boolean;
  triggerBomb: () => void;
  triggerBeep: () => void;
}

const NarrativeContext = createContext<NarrativeContextValue | null>(null);

interface NarrativeProviderProps {
  children: ReactNode;
  enabled?: boolean;
  onActChange?: (act: ActConfig) => void;
}

export function NarrativeProvider({ 
  children, 
  enabled = true,
  onActChange: externalOnActChange,
}: NarrativeProviderProps) {
  const pressureEffects = usePressureEffects();

  // Callback when act changes - sem mencionar nomes de eventos
  const handleActChange = (act: ActConfig) => {
    console.log(`[NarrativeProvider] Act changed: ${act.name}`);
    
    // Play appropriate Horus audio for act transition via central queue
    if (act.id === 'trial') {
      // Ato II - Hórus começa a questionar
      centralAudioQueue.enqueue('/audio/horus/bordao_1.mp3', {
        label: 'act_transition',
        priority: AUDIO_PRIORITY.HORUS_DIALOGUE
      });
    } else if (act.id === 'ascension') {
      // Ato III - Tom respeitoso (sem mostrar nome do ato)
      toast({ description: 'Hórus está impressionado...' });
    } else if (act.id === 'fall') {
      // Ato IV - Máxima tensão (sem mostrar nome do ato)
      toast({ description: 'A pressão aumenta...' });
      centralAudioQueue.enqueue('/audio/horus/bordao_2.mp3', {
        label: 'act_transition',
        priority: AUDIO_PRIORITY.HORUS_DIALOGUE
      });
    } else if (act.id === 'climax') {
      // Ato V - Clímax (sem mostrar nome do ato)
      toast({ description: 'O momento da verdade!' });
    }
    
    externalOnActChange?.(act);
  };

  // Callback for hidden events - exibe apenas a frase, sem nome do evento
  const handleHiddenEvent = (event: HiddenEvent) => {
    console.log(`[NarrativeProvider] Hidden event triggered: ${event.name}`);

    // Mostra apenas o efeito/frase, sem o nome do evento
    toast({
      description: event.effect,
    });

    // IMPORTANT: o Observador Silencioso (5 acertos) tem narração dinâmica via silentObserverService
    // em telas que fazem esse controle (ex: SinglePlayerRoom). Aqui evitamos enfileirar o áudio local
    // para não repetir / duplicar a reprodução.
    if (event.id === 'silent_observer') return;

    if (event.audioFile) {
      centralAudioQueue.enqueue(event.audioFile, {
        label: 'hidden_event',
        priority: AUDIO_PRIORITY.NARRATIVE_EVENT,
      });
    }
  };

  // Callback for bomb event - sem mencionar "RUPTURA"
  const handleBombEvent = () => {
    console.log('[NarrativeProvider] BOMB EVENT TRIGGERED!');
    pressureEffects.triggerBomb();
    
    // Exibe apenas a frase, não o nome do evento
    toast({ 
      description: 'Foco. Concentração. Continue.',
      variant: 'destructive'
    });
  };

  // Callback for beeps
  const handleBeep = () => {
    pressureEffects.triggerBeep();
  };

  const narrative = useNarrativeEngine({
    enabled,
    onActChange: handleActChange,
    onHiddenEvent: handleHiddenEvent,
    onBombEvent: handleBombEvent,
    onBeep: handleBeep,
  });

  const value: NarrativeContextValue = {
    ...narrative,
    isFlashing: pressureEffects.isFlashing,
    triggerBomb: pressureEffects.triggerBomb,
    triggerBeep: pressureEffects.triggerBeep,
  };

  return (
    <NarrativeContext.Provider value={value}>
      {children}
    </NarrativeContext.Provider>
  );
}

export function useNarrative(): NarrativeContextValue {
  const context = useContext(NarrativeContext);
  if (!context) {
    throw new Error('useNarrative must be used within a NarrativeProvider');
  }
  return context;
}

// Optional hook that doesn't throw if outside provider
export function useNarrativeOptional(): NarrativeContextValue | null {
  return useContext(NarrativeContext);
}
