import { useState } from 'react';
import { motion } from 'framer-motion';
import { Zap, Flame, Skull, Lock, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import { GamePhaseConfig } from '@/hooks/useEconomy';
import GoldButton from './GoldButton';

interface PhaseSelectorProps {
  phases: GamePhaseConfig[];
  ntBalance: number;
  onSelectPhase: (phase: 1 | 2 | 3) => void;
  onCancel: () => void;
}

export function PhaseSelector({ phases, ntBalance, onSelectPhase, onCancel }: PhaseSelectorProps) {
  const [selectedPhase, setSelectedPhase] = useState<1 | 2 | 3>(1);

  const getPhaseIcon = (phase: number) => {
    switch (phase) {
      case 1: return <Zap className="w-6 h-6" />;
      case 2: return <Flame className="w-6 h-6" />;
      case 3: return <Skull className="w-6 h-6" />;
      default: return <Zap className="w-6 h-6" />;
    }
  };

  const getPhaseLabel = (phase: number) => {
    switch (phase) {
      case 1: return 'Aquecimento';
      case 2: return 'Desafio';
      case 3: return 'Extremo';
      default: return 'Aquecimento';
    }
  };

  const getPhaseColor = (phase: number) => {
    switch (phase) {
      case 1: return 'from-emerald-500/20 to-emerald-600/10 border-emerald-500/50 text-emerald-400';
      case 2: return 'from-amber-500/20 to-orange-600/10 border-amber-500/50 text-amber-400';
      case 3: return 'from-red-500/20 to-red-800/10 border-red-500/50 text-red-400';
      default: return 'from-emerald-500/20 to-emerald-600/10 border-emerald-500/50 text-emerald-400';
    }
  };

  const canAfford = (config: GamePhaseConfig) => ntBalance >= config.ntCost;

  const selectedConfig = phases.find(p => p.phase === selectedPhase);

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.95 }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-background/90 backdrop-blur-sm p-4"
    >
      <div className="max-w-lg w-full luxury-card p-6 space-y-6">
        {/* Header */}
        <div className="text-center">
          <h2 className="font-orbitron text-2xl font-bold text-primary mb-2">
            ESCOLHA SEU DESAFIO
          </h2>
          <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
            <Zap className="w-4 h-4 text-primary" />
            <span>Seu saldo: <span className="text-primary font-bold">{ntBalance} NT</span></span>
          </div>
        </div>

        {/* Phase Options */}
        <div className="space-y-3">
          {phases.map((config) => {
            const affordable = canAfford(config);
            const isSelected = selectedPhase === config.phase;
            
            return (
              <motion.button
                key={config.phase}
                onClick={() => affordable && setSelectedPhase(config.phase)}
                whileHover={affordable ? { scale: 1.02 } : {}}
                whileTap={affordable ? { scale: 0.98 } : {}}
                className={cn(
                  "w-full p-4 rounded-xl border-2 transition-all text-left relative overflow-hidden",
                  "bg-gradient-to-r",
                  getPhaseColor(config.phase),
                  isSelected && "ring-2 ring-primary ring-offset-2 ring-offset-background",
                  !affordable && "opacity-50 cursor-not-allowed"
                )}
                disabled={!affordable}
              >
                <div className="flex items-center gap-4">
                  {/* Icon */}
                  <div className={cn(
                    "w-12 h-12 rounded-full flex items-center justify-center",
                    "bg-background/50 border border-current"
                  )}>
                    {affordable ? getPhaseIcon(config.phase) : <Lock className="w-5 h-5" />}
                  </div>
                  
                  {/* Info */}
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-orbitron font-bold text-lg text-foreground">
                        {getPhaseLabel(config.phase)}
                      </span>
                      {config.ntCost === 0 && (
                        <span className="px-2 py-0.5 rounded text-xs bg-success/20 text-success border border-success/30">
                          GRÁTIS
                        </span>
                      )}
                    </div>
                    <div className="text-sm text-muted-foreground">
                      {config.rounds} Rodadas • Prêmio: {config.bcReward.toLocaleString()} BC
                      {config.bonusReward > 0 && ` + ${config.bonusReward} bônus`}
                    </div>
                    {config.ntCost > 0 && (
                      <div className={cn(
                        "text-xs mt-1",
                        affordable ? "text-muted-foreground" : "text-destructive"
                      )}>
                        Custo: {config.ntCost} NT
                        {!affordable && ' (insuficiente)'}
                      </div>
                    )}
                  </div>

                  {/* Selection indicator */}
                  {isSelected && affordable && (
                    <motion.div
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      className="w-6 h-6 rounded-full bg-primary flex items-center justify-center"
                    >
                      <ChevronRight className="w-4 h-4 text-primary-foreground" />
                    </motion.div>
                  )}
                </div>
              </motion.button>
            );
          })}
        </div>

        {/* Selected Phase Summary */}
        {selectedConfig && (
          <motion.div
            key={selectedPhase}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="p-4 rounded-lg bg-secondary/50 border border-border/50 text-center"
          >
            <p className="text-sm text-muted-foreground mb-1">Você selecionou:</p>
            <p className="font-orbitron text-lg text-primary">
              {getPhaseLabel(selectedPhase)} - {selectedConfig.rounds} Rodadas
            </p>
            {selectedConfig.ntCost > 0 && (
              <p className="text-xs text-muted-foreground mt-1">
                ⚡ {selectedConfig.ntCost} NT serão debitados ao iniciar
              </p>
            )}
          </motion.div>
        )}

        {/* Actions */}
        <div className="flex gap-3">
          <GoldButton 
            variant="outline" 
            onClick={onCancel} 
            className="flex-1"
          >
            Voltar
          </GoldButton>
          <GoldButton 
            onClick={() => onSelectPhase(selectedPhase)} 
            className="flex-1"
            disabled={!selectedConfig || !canAfford(selectedConfig)}
          >
            {getPhaseIcon(selectedPhase)}
            <span className="ml-2">Iniciar</span>
          </GoldButton>
        </div>
      </div>
    </motion.div>
  );
}