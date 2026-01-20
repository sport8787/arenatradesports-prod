/**
 * Modal para seleção de papel no Modo Apresentador
 * Jogador (responde perguntas) ou Júri (vota CLARO/BLEFE)
 */

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Gamepad2, Scale, X, Check, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import GoldButton from './GoldButton';
import { cn } from '@/lib/utils';

interface PresenterRoleSelectorProps {
  open: boolean;
  onSelect: (role: 'player' | 'jury') => void;
  onClose: () => void;
  playerSlotTaken?: boolean;
  currentPlayerName?: string;
}

export function PresenterRoleSelector({
  open,
  onSelect,
  onClose,
  playerSlotTaken = false,
  currentPlayerName
}: PresenterRoleSelectorProps) {
  const [selectedRole, setSelectedRole] = useState<'player' | 'jury' | null>(null);

  const handleConfirm = () => {
    if (selectedRole) {
      onSelect(selectedRole);
    }
  };

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 bg-background/90 backdrop-blur-md z-50 flex items-center justify-center p-4"
        >
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.9, opacity: 0 }}
            className="bg-card border-2 border-gold/30 rounded-2xl p-6 w-full max-w-md space-y-6"
          >
            {/* Header */}
            <div className="flex items-center justify-between">
              <div>
                <h2 className="font-orbitron text-xl font-bold text-gold">
                  Escolha seu Papel
                </h2>
                <p className="text-sm text-muted-foreground mt-1">
                  Modo Apresentador
                </p>
              </div>
              <button
                onClick={onClose}
                className="p-2 hover:bg-background/50 rounded-lg transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Aviso se já existe jogador */}
            {playerSlotTaken && (
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                className="flex items-center gap-3 p-3 bg-amber-900/30 border border-amber-500/50 rounded-xl"
              >
                <AlertCircle className="w-5 h-5 text-amber-500 shrink-0" />
                <p className="text-sm text-amber-200">
                  <strong>{currentPlayerName}</strong> já é o Jogador Principal.
                  Você pode entrar como Júri.
                </p>
              </motion.div>
            )}

            {/* Opções de papel */}
            <div className="grid gap-4">
              {/* Opção Jogador */}
              <motion.button
                whileTap={{ scale: 0.98 }}
                onClick={() => !playerSlotTaken && setSelectedRole('player')}
                disabled={playerSlotTaken}
                className={cn(
                  "relative p-5 rounded-xl border-2 text-left transition-all",
                  selectedRole === 'player'
                    ? "border-gold bg-gold/10 shadow-[0_0_20px_rgba(212,175,55,0.3)]"
                    : playerSlotTaken
                    ? "border-border/30 bg-background/30 opacity-50 cursor-not-allowed"
                    : "border-border hover:border-gold/50 bg-background/30"
                )}
              >
                <div className="flex items-start gap-4">
                  <div className={cn(
                    "w-12 h-12 rounded-xl flex items-center justify-center",
                    selectedRole === 'player'
                      ? "bg-gold/20"
                      : "bg-primary/20"
                  )}>
                    <Gamepad2 className={cn(
                      "w-6 h-6",
                      selectedRole === 'player' ? "text-gold" : "text-primary"
                    )} />
                  </div>
                  
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <h3 className="font-orbitron font-bold text-lg">
                        Jogador Principal
                      </h3>
                      {playerSlotTaken && (
                        <span className="text-xs bg-destructive/20 text-destructive px-2 py-0.5 rounded-full">
                          Ocupado
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-muted-foreground mt-1">
                      Responde as perguntas e tenta enganar o júri.
                      Você verá a resposta correta.
                    </p>
                    <div className="flex flex-wrap gap-2 mt-3">
                      <span className="text-xs bg-primary/20 text-primary px-2 py-1 rounded-full">
                        Vê resposta correta
                      </span>
                      <span className="text-xs bg-primary/20 text-primary px-2 py-1 rounded-full">
                        Pode blefar
                      </span>
                    </div>
                  </div>

                  {selectedRole === 'player' && (
                    <motion.div
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      className="w-6 h-6 bg-gold rounded-full flex items-center justify-center"
                    >
                      <Check className="w-4 h-4 text-background" />
                    </motion.div>
                  )}
                </div>
              </motion.button>

              {/* Opção Júri */}
              <motion.button
                whileTap={{ scale: 0.98 }}
                onClick={() => setSelectedRole('jury')}
                className={cn(
                  "relative p-5 rounded-xl border-2 text-left transition-all",
                  selectedRole === 'jury'
                    ? "border-purple-500 bg-purple-500/10 shadow-[0_0_20px_rgba(147,51,234,0.3)]"
                    : "border-border hover:border-purple-500/50 bg-background/30"
                )}
              >
                <div className="flex items-start gap-4">
                  <div className={cn(
                    "w-12 h-12 rounded-xl flex items-center justify-center",
                    selectedRole === 'jury'
                      ? "bg-purple-500/20"
                      : "bg-purple-900/30"
                  )}>
                    <Scale className={cn(
                      "w-6 h-6",
                      selectedRole === 'jury' ? "text-purple-400" : "text-purple-500"
                    )} />
                  </div>
                  
                  <div className="flex-1">
                    <h3 className="font-orbitron font-bold text-lg">
                      Júri
                    </h3>
                    <p className="text-sm text-muted-foreground mt-1">
                      Analise as respostas do jogador e vote se acredita
                      ou duvida da resposta.
                    </p>
                    <div className="flex flex-wrap gap-2 mt-3">
                      <span className="text-xs bg-purple-900/30 text-purple-300 px-2 py-1 rounded-full">
                        Vota CLARO/BLEFE
                      </span>
                      <span className="text-xs bg-purple-900/30 text-purple-300 px-2 py-1 rounded-full">
                        Ganha pontos por detectar blefes
                      </span>
                    </div>
                  </div>

                  {selectedRole === 'jury' && (
                    <motion.div
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      className="w-6 h-6 bg-purple-500 rounded-full flex items-center justify-center"
                    >
                      <Check className="w-4 h-4 text-white" />
                    </motion.div>
                  )}
                </div>
              </motion.button>
            </div>

            {/* Botões */}
            <div className="flex gap-3 pt-2">
              <Button
                variant="outline"
                onClick={onClose}
                className="flex-1"
              >
                Cancelar
              </Button>
              <GoldButton
                onClick={handleConfirm}
                disabled={!selectedRole}
                className="flex-1"
              >
                Confirmar
              </GoldButton>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
