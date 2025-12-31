import React, { createContext, useContext, useEffect, ReactNode } from 'react';
import { useNarrativeEngine } from '@/hooks/useNarrativeEngine';
import { ActConfig, HiddenEvent, NarrativeState } from '@/services/narrativeEngine';
import { usePressureEffects } from '@/components/game/PressureEffects';
import { playHorus2Audio } from '@/services/horus2Engine';
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

  // Callback when act changes
  const handleActChange = (act: ActConfig) => {
    console.log(`[NarrativeProvider] Act changed: ${act.name}`);
    
    // Play appropriate Horus audio for act transition
    if (act.id === 'trial') {
      // Ato II - Hórus começa a questionar
      playHorus2Audio('taunt');
    } else if (act.id === 'ascension') {
      // Ato III - Tom respeitoso
      toast({ title: '📈 A Ascensão', description: 'Hórus está impressionado...' });
    } else if (act.id === 'fall') {
      // Ato IV - Máxima tensão
      toast({ title: '⚠️ A Queda', description: 'A pressão aumenta...' });
      playHorus2Audio('taunt');
    } else if (act.id === 'climax') {
      // Ato V - Clímax
      toast({ title: '🎭 O Clímax', description: 'O momento da verdade!' });
    }
    
    externalOnActChange?.(act);
  };

  // Callback for hidden events
  const handleHiddenEvent = (event: HiddenEvent) => {
    console.log(`[NarrativeProvider] Hidden event triggered: ${event.name}`);
    
    toast({ 
      title: `👁️ ${event.name}`, 
      description: event.effect 
    });
    
    if (event.audioFile) {
      const audio = new Audio(event.audioFile);
      audio.play().catch(console.error);
    }
  };

  // Callback for bomb event
  const handleBombEvent = () => {
    console.log('[NarrativeProvider] BOMB EVENT TRIGGERED!');
    pressureEffects.triggerBomb();
    
    toast({ 
      title: '💥 RUPTURA!', 
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
