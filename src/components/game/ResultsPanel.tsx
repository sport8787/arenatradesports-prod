import { motion } from 'framer-motion';
import { Check, X, Coins } from 'lucide-react';
import { Player, Vote, Question } from '@/types/game';
import { cn } from '@/lib/utils';
import { useEffect, useState } from 'react';

interface ResultsPanelProps {
  question: Question;
  currentPlayer: Player;
  players: Player[];
  votes: Vote[];
  wasBluffSuccessful: boolean;
}

export default function ResultsPanel({
  question,
  currentPlayer,
  players,
  votes,
  wasBluffSuccessful,
}: ResultsPanelProps) {
  const [showCoins, setShowCoins] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setShowCoins(true), 500);
    return () => clearTimeout(timer);
  }, []);

  const correctOption = question.correct_option;
  const correctText = question[`option_${correctOption.toLowerCase()}` as keyof Question] as string;

  // Players who believed a lie lose points, those who doubted correctly gain points
  const believers = votes.filter(v => v.vote_type === 'believe');
  const doubters = votes.filter(v => v.vote_type === 'doubt');

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="space-y-8"
    >
      {/* Coin Animation */}
      {showCoins && (
        <div className="coins-container">
          {[...Array(10)].map((_, i) => (
            <motion.div
              key={i}
              initial={{ x: Math.random() * window.innerWidth, y: -50, rotate: 0 }}
              animate={{ y: window.innerHeight + 100, rotate: 720 }}
              transition={{ duration: 2 + Math.random(), delay: i * 0.1, ease: 'easeIn' }}
              className="absolute text-primary"
            >
              <Coins className="w-8 h-8" />
            </motion.div>
          ))}
        </div>
      )}

      {/* Correct Answer Reveal */}
      <motion.div
        initial={{ scale: 0.8, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ delay: 0.2 }}
        className="text-center space-y-4"
      >
        <h3 className="font-orbitron text-2xl text-foreground">
          Resposta Correta
        </h3>
        <div className="inline-flex items-center gap-3 px-6 py-3 rounded-xl bg-success/20 border border-success/50">
          <span className="w-10 h-10 rounded-full bg-success flex items-center justify-center font-orbitron font-bold">
            {correctOption}
          </span>
          <span className="text-xl font-medium text-success-foreground">{correctText}</span>
        </div>
      </motion.div>

      {/* Bluff Result */}
      <motion.div
        initial={{ y: 20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.4 }}
        className={cn(
          'text-center p-6 rounded-xl border-2',
          wasBluffSuccessful 
            ? 'bg-primary/10 border-primary/50' 
            : 'bg-destructive/10 border-destructive/50'
        )}
      >
        <div className="flex items-center justify-center gap-3 mb-2">
          {wasBluffSuccessful ? (
            <Check className="w-8 h-8 text-primary" />
          ) : (
            <X className="w-8 h-8 text-destructive" />
          )}
          <h4 className="font-orbitron text-xl">
            {wasBluffSuccessful ? 'Blefe Bem-Sucedido!' : 'Blefe Descoberto!'}
          </h4>
        </div>
        <p className="text-muted-foreground">
          {wasBluffSuccessful 
            ? `${currentPlayer.nickname} enganou ${believers.length} jogador(es)!`
            : `${doubters.length} jogador(es) descobriram a mentira!`
          }
        </p>
      </motion.div>

      {/* Vote Summary */}
      <motion.div
        initial={{ y: 20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.6 }}
        className="grid grid-cols-2 gap-4"
      >
        <div className="luxury-card p-4 text-center">
          <div className="text-3xl font-orbitron font-bold text-success mb-1">
            {believers.length}
          </div>
          <div className="text-sm text-muted-foreground uppercase tracking-wider">
            Acreditaram
          </div>
        </div>
        <div className="luxury-card p-4 text-center">
          <div className="text-3xl font-orbitron font-bold text-destructive mb-1">
            {doubters.length}
          </div>
          <div className="text-sm text-muted-foreground uppercase tracking-wider">
            Duvidaram
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}
