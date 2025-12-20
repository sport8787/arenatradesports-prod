import { motion } from 'framer-motion';
import { Users, Wifi, Monitor, Volume2 } from 'lucide-react';

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
            relative p-4 rounded-xl border-2 transition-all duration-200
            ${value === 'online' 
              ? 'border-gold bg-gold/10 shadow-lg shadow-gold/20' 
              : 'border-border/50 bg-card/50 hover:border-gold/50'
            }
            ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
          `}
        >
          {value === 'online' && (
            <motion.div
              layoutId="gameModeBg"
              className="absolute inset-0 bg-gradient-to-br from-gold/20 to-transparent rounded-xl"
              initial={false}
              transition={{ type: "spring", stiffness: 500, damping: 30 }}
            />
          )}
          
          <div className="relative z-10 flex flex-col items-center gap-2">
            <div className={`
              w-12 h-12 rounded-full flex items-center justify-center
              ${value === 'online' ? 'bg-gold/20 text-gold' : 'bg-muted text-muted-foreground'}
            `}>
              <Wifi className="w-6 h-6" />
            </div>
            <span className={`font-orbitron text-sm ${value === 'online' ? 'text-gold' : 'text-foreground'}`}>
              ONLINE
            </span>
            <div className="flex items-center gap-1 text-xs text-muted-foreground">
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
            relative p-4 rounded-xl border-2 transition-all duration-200
            ${value === 'presencial' 
              ? 'border-gold bg-gold/10 shadow-lg shadow-gold/20' 
              : 'border-border/50 bg-card/50 hover:border-gold/50'
            }
            ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
          `}
        >
          {value === 'presencial' && (
            <motion.div
              layoutId="gameModeBg"
              className="absolute inset-0 bg-gradient-to-br from-gold/20 to-transparent rounded-xl"
              initial={false}
              transition={{ type: "spring", stiffness: 500, damping: 30 }}
            />
          )}
          
          <div className="relative z-10 flex flex-col items-center gap-2">
            <div className={`
              w-12 h-12 rounded-full flex items-center justify-center
              ${value === 'presencial' ? 'bg-gold/20 text-gold' : 'bg-muted text-muted-foreground'}
            `}>
              <Users className="w-6 h-6" />
            </div>
            <span className={`font-orbitron text-sm ${value === 'presencial' ? 'text-gold' : 'text-foreground'}`}>
              PRESENCIAL
            </span>
            <div className="flex items-center gap-1 text-xs text-muted-foreground">
              <Volume2 className="w-3 h-3" />
              <span>Só host ouve</span>
            </div>
          </div>
        </motion.button>
      </div>
    </div>
  );
}
