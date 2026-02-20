import { motion } from 'framer-motion';
import { Eye, Sparkles, Users, HelpCircle, ShoppingCart, Trophy, ChevronRight } from 'lucide-react';
import { Link } from 'react-router-dom';
import GoldButton from './GoldButton';

interface GameActionsPanelProps {
  onChallengeHorus: () => void;
  onCreateRoom: () => void;
  onJoinRoom: () => void;
  loading?: boolean;
}

export default function GameActionsPanel({ 
  onChallengeHorus, 
  onCreateRoom, 
  onJoinRoom, 
  loading 
}: GameActionsPanelProps) {
  return (
    <motion.div 
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.3 }}
      className="space-y-4"
    >
      {/* CTA Principal - Desafie o Hórus */}
      <motion.button
        onClick={onChallengeHorus}
        disabled={loading}
        whileHover={{ scale: 1.02, y: -4 }}
        whileTap={{ scale: 0.98 }}
        className="
          w-full relative overflow-hidden
          bg-gradient-to-r from-purple-900/80 via-primary/60 to-purple-900/80
          border-2 border-gold/60 hover:border-gold
          rounded-2xl p-5
          flex items-center gap-4
          transition-all duration-300
          hover:shadow-[0_8px_30px_rgba(139,0,255,0.5)]
          disabled:opacity-50 disabled:cursor-not-allowed
          group
        "
      >
        {/* Shimmer effect on hover */}
        <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-700" />
        
        <motion.div 
          className="text-5xl"
          animate={{ scale: [1, 1.1, 1] }}
          transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
        >
          ⚡
        </motion.div>
        
        <div className="flex-1 text-left">
          <h3 className="font-orbitron text-xl font-bold text-gold uppercase tracking-wide mb-1">
            Desafie o Hórus
          </h3>
          <p className="text-sm text-foreground/80">
            Modo rápido • 5 rodadas • 100 BC
          </p>
        </div>
        
        <motion.div 
          className="text-2xl text-gold"
          animate={{ x: [0, 4, 0] }}
          transition={{ duration: 1.5, repeat: Infinity }}
        >
          <ChevronRight className="w-6 h-6" />
        </motion.div>
      </motion.button>

      {/* Arena Poker - Study AI */}
      <Link to="/arena-poker" className="block">
        <motion.div
          whileHover={{ scale: 1.02, y: -3 }}
          whileTap={{ scale: 0.98 }}
          className="
            w-full relative overflow-hidden
            bg-gradient-to-r from-[hsl(0_0%_5%)] via-[hsl(200_100%_15%/0.3)] to-[hsl(0_0%_5%)]
            border border-[hsl(190_100%_50%/0.4)] hover:border-[hsl(190_100%_50%/0.7)]
            rounded-2xl p-4
            flex items-center gap-4
            transition-all duration-300
            hover:shadow-[0_6px_25px_rgba(0,210,255,0.3)]
            group
          "
        >
          <div className="absolute inset-0 bg-gradient-to-r from-transparent via-[hsl(190_100%_50%/0.05)] to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-700" />
          <span className="text-3xl">♠️</span>
          <div className="flex-1 text-left">
            <h3 className="font-orbitron text-base font-bold text-[hsl(190_100%_50%)] uppercase tracking-wide">
              Arena Poker
            </h3>
            <p className="text-xs text-foreground/60">
              Study AI • Análise pós-sessão
            </p>
          </div>
          <ChevronRight className="w-5 h-5 text-[hsl(190_100%_50%/0.6)]" />
        </motion.div>
      </Link>

      {/* Botões Secundários - Grid 2x2 */}
      <div className="grid grid-cols-2 gap-3">
        <motion.button
          onClick={onCreateRoom}
          disabled={loading}
          whileHover={{ scale: 1.02, y: -2 }}
          whileTap={{ scale: 0.98 }}
          className="
            bg-background/30 border border-gold/20 hover:border-gold/50 hover:bg-gold/10
            rounded-xl p-4 flex flex-col items-center gap-2
            transition-all duration-300
            disabled:opacity-50
          "
        >
          <span className="text-2xl">🔥</span>
          <span className="text-sm font-medium text-foreground">Criar Mesa</span>
        </motion.button>
        
        <motion.button
          onClick={onJoinRoom}
          disabled={loading}
          whileHover={{ scale: 1.02, y: -2 }}
          whileTap={{ scale: 0.98 }}
          className="
            bg-background/30 border border-gold/20 hover:border-gold/50 hover:bg-gold/10
            rounded-xl p-4 flex flex-col items-center gap-2
            transition-all duration-300
            disabled:opacity-50
          "
        >
          <span className="text-2xl">🚪</span>
          <span className="text-sm font-medium text-foreground">Entrar</span>
        </motion.button>
        
        <Link to="/como-jogar" className="block">
          <motion.div
            whileHover={{ scale: 1.02, y: -2 }}
            whileTap={{ scale: 0.98 }}
            className="
              bg-background/30 border border-gold/20 hover:border-gold/50 hover:bg-gold/10
              rounded-xl p-4 flex flex-col items-center gap-2
              transition-all duration-300 h-full
            "
          >
            <span className="text-2xl">❓</span>
            <span className="text-sm font-medium text-foreground">Como Jogar</span>
          </motion.div>
        </Link>
        
        <Link to="/mercado-negro" className="block">
          <motion.div
            whileHover={{ scale: 1.02, y: -2 }}
            whileTap={{ scale: 0.98 }}
            className="
              bg-background/30 border border-gold/20 hover:border-gold/50 hover:bg-gold/10
              rounded-xl p-4 flex flex-col items-center gap-2
              transition-all duration-300 h-full
            "
          >
            <span className="text-2xl">🛒</span>
            <span className="text-sm font-medium text-foreground">Loja</span>
          </motion.div>
        </Link>
      </div>

      {/* Link para Rankings */}
      <Link to="/rankings" className="block">
        <motion.div
          whileHover={{ scale: 1.01 }}
          whileTap={{ scale: 0.99 }}
          className="
            bg-gradient-to-r from-gold/10 to-amber-500/10
            border border-gold/30 hover:border-gold/50
            rounded-xl p-3 flex items-center justify-center gap-2
            transition-all duration-300
          "
        >
          <Trophy className="w-5 h-5 text-gold" />
          <span className="text-sm font-medium text-gold">Ver Ranking Global</span>
        </motion.div>
      </Link>
    </motion.div>
  );
}
