import { motion } from 'framer-motion';
import { Users, Wifi, Monitor, Volume2, Check } from 'lucide-react';

export type GameMode = 'online' | 'presencial';

interface GameModeSelectorProps {
  value: GameMode;
  onChange: (mode: GameMode) => void;
  disabled?: boolean;
}

export default function GameModeSelector({ value, onChange, disabled }: GameModeSelectorProps) {
  return (
    <div className="space-y-3">
      <label className="text-sm font-medium text-muted-foreground flex items-center gap-2">
        <Monitor className="w-4 h-4" />
        Modo de Jogo
      </label>
      
      <div className="grid grid-cols-2 gap-3">
        {/* Online Mode */}
        <motion.button
          whileHover={{ scale: disabled ? 1 : 1.02 }}
          whileTap={{ scale: disabled ? 1 : 0.98 }}
          onClick={() => !disabled && onChange('online')}
          disabled={disabled}
          className={`
            relative p-4 rounded-xl border-2 transition-all duration-300
            ${value === 'online' 
              ? 'border-gold bg-gold/15 shadow-[0_0_20px_rgba(212,175,55,0.4),inset_0_0_20px_rgba(212,175,55,0.1)]' 
              : 'border-border/50 bg-card/50 hover:border-gold/50 hover:bg-card/70'
            }
            ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
          `}
        >
          {/* Active glow effect */}
          {value === 'online' && (
            <>
              <motion.div
                className="absolute inset-0 bg-gradient-to-br from-gold/30 via-gold/10 to-transparent rounded-xl"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.3 }}
              />
              <motion.div
                className="absolute -inset-0.5 bg-gradient-to-r from-gold/50 to-gold/20 rounded-xl blur-sm -z-10"
                initial={{ opacity: 0 }}
                animate={{ opacity: [0.5, 0.8, 0.5] }}
                transition={{ duration: 2, repeat: Infinity }}
              />
            </>
          )}
          
          <div className="relative z-10 flex flex-col items-center gap-2">
            <div className={`
              relative w-12 h-12 rounded-full flex items-center justify-center transition-all duration-300
              ${value === 'online' 
                ? 'bg-gold/30 text-gold shadow-[0_0_15px_rgba(212,175,55,0.5)]' 
                : 'bg-muted text-muted-foreground'
              }
            `}>
              <Wifi className="w-6 h-6" />
              {value === 'online' && (
                <motion.div 
                  className="absolute -top-1 -right-1 w-5 h-5 bg-gold rounded-full flex items-center justify-center"
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ type: 'spring', stiffness: 500 }}
                >
                  <Check className="w-3 h-3 text-background" strokeWidth={3} />
                </motion.div>
              )}
            </div>
            <span className={`font-orbitron text-sm font-bold transition-colors ${value === 'online' ? 'text-gold' : 'text-foreground'}`}>
              ONLINE
            </span>
            <div className={`flex items-center gap-1 text-xs transition-colors ${value === 'online' ? 'text-gold/80' : 'text-muted-foreground'}`}>
              <Volume2 className="w-3 h-3" />
              <span>Áudio para todos</span>
            </div>
          </div>
        </motion.button>

        {/* Presencial Mode */}
        <motion.button
          whileHover={{ scale: disabled ? 1 : 1.02 }}
          whileTap={{ scale: disabled ? 1 : 0.98 }}
          onClick={() => !disabled && onChange('presencial')}
          disabled={disabled}
          className={`
            relative p-4 rounded-xl border-2 transition-all duration-300
            ${value === 'presencial' 
              ? 'border-gold bg-gold/15 shadow-[0_0_20px_rgba(212,175,55,0.4),inset_0_0_20px_rgba(212,175,55,0.1)]' 
              : 'border-border/50 bg-card/50 hover:border-gold/50 hover:bg-card/70'
            }
            ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
          `}
        >
          {/* Active glow effect */}
          {value === 'presencial' && (
            <>
              <motion.div
                className="absolute inset-0 bg-gradient-to-br from-gold/30 via-gold/10 to-transparent rounded-xl"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.3 }}
              />
              <motion.div
                className="absolute -inset-0.5 bg-gradient-to-r from-gold/50 to-gold/20 rounded-xl blur-sm -z-10"
                initial={{ opacity: 0 }}
                animate={{ opacity: [0.5, 0.8, 0.5] }}
                transition={{ duration: 2, repeat: Infinity }}
              />
            </>
          )}
          
          <div className="relative z-10 flex flex-col items-center gap-2">
            <div className={`
              relative w-12 h-12 rounded-full flex items-center justify-center transition-all duration-300
              ${value === 'presencial' 
                ? 'bg-gold/30 text-gold shadow-[0_0_15px_rgba(212,175,55,0.5)]' 
                : 'bg-muted text-muted-foreground'
              }
            `}>
              <Users className="w-6 h-6" />
              {value === 'presencial' && (
                <motion.div 
                  className="absolute -top-1 -right-1 w-5 h-5 bg-gold rounded-full flex items-center justify-center"
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ type: 'spring', stiffness: 500 }}
                >
                  <Check className="w-3 h-3 text-background" strokeWidth={3} />
                </motion.div>
              )}
            </div>
            <span className={`font-orbitron text-sm font-bold transition-colors ${value === 'presencial' ? 'text-gold' : 'text-foreground'}`}>
              PRESENCIAL
            </span>
            <div className={`flex items-center gap-1 text-xs transition-colors ${value === 'presencial' ? 'text-gold/80' : 'text-muted-foreground'}`}>
              <Volume2 className="w-3 h-3" />
              <span>Só host ouve</span>
            </div>
          </div>
        </motion.button>
      </div>
      
      {/* Mode description */}
      <motion.div 
        key={value}
        initial={{ opacity: 0, y: -5 }}
        animate={{ opacity: 1, y: 0 }}
        className="text-xs text-center text-muted-foreground bg-muted/30 rounded-lg p-2"
      >
        {value === 'online' ? (
          <span>🌐 Todos os jogadores ouvirão o áudio sincronizado via WebSocket</span>
        ) : (
          <span>🏠 Apenas o dispositivo Host emitirá áudio - ideal para jogar na mesma sala</span>
        )}
      </motion.div>
    </div>
  );
}
