import { motion } from 'framer-motion';
import { Loader2, Clock, Vote, Trophy } from 'lucide-react';
import { cn } from '@/lib/utils';

interface WaitingMessageProps {
  type: 'answer' | 'vote' | 'result' | 'nextRound';
  hostName?: string;
  className?: string;
}

const messages = {
  answer: {
    icon: Clock,
    text: 'Aguardando o HOST selecionar uma resposta...',
    subtext: 'Prepare sua análise',
  },
  vote: {
    icon: Vote,
    text: 'Aguardando votos do JÚRI...',
    subtext: 'Os jurados estão votando',
  },
  result: {
    icon: Trophy,
    text: 'Aguardando o HOST revelar o resultado...',
    subtext: 'A verdade será revelada',
  },
  nextRound: {
    icon: Loader2,
    text: 'Aguardando próxima rodada...',
    subtext: 'O HOST irá iniciar a próxima pergunta',
  },
};

export default function WaitingMessage({ type, hostName, className }: WaitingMessageProps) {
  const { icon: Icon, text, subtext } = messages[type];
  const displayText = hostName ? text.replace('HOST', hostName) : text;

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className={cn(
        'flex flex-col items-center justify-center py-8 px-4 rounded-xl',
        'bg-gradient-to-br from-secondary/50 to-secondary/30 border border-border/50',
        className
      )}
    >
      <motion.div
        animate={{ rotate: type === 'nextRound' ? 360 : 0 }}
        transition={{ repeat: type === 'nextRound' ? Infinity : 0, duration: 2, ease: 'linear' }}
      >
        <Icon className="w-8 h-8 text-mycroft-cyan mb-3" />
      </motion.div>
      <p className="font-orbitron text-sm text-foreground/90 text-center">{displayText}</p>
      <p className="text-xs text-muted-foreground mt-1">{subtext}</p>
      <motion.div
        className="flex gap-1 mt-4"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.3 }}
      >
        {[0, 1, 2].map((i) => (
          <motion.div
            key={i}
            className="w-2 h-2 rounded-full bg-mycroft-cyan/60"
            animate={{ scale: [1, 1.3, 1], opacity: [0.5, 1, 0.5] }}
            transition={{ repeat: Infinity, duration: 1, delay: i * 0.2 }}
          />
        ))}
      </motion.div>
    </motion.div>
  );
}
