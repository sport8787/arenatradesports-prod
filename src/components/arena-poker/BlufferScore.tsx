import { motion } from 'framer-motion';

interface BlufferScoreProps {
  score: number; // 0-100
}

const BlufferScore = ({ score }: BlufferScoreProps) => {
  const circumference = 2 * Math.PI * 54;
  const offset = circumference - (score / 100) * circumference;

  const getColor = () => {
    if (score >= 75) return 'hsl(var(--arena-cyan))';
    if (score >= 50) return 'hsl(var(--arena-gold))';
    if (score >= 25) return 'hsl(38 92% 50%)';
    return 'hsl(0 72% 51%)';
  };

  return (
    <motion.div
      initial={{ scale: 0.8, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      className="flex flex-col items-center gap-2"
    >
      <span className="font-mono text-[10px] uppercase tracking-[0.3em] text-muted-foreground">
        Bluffer Score
      </span>
      <div className="relative w-32 h-32">
        <svg className="w-full h-full -rotate-90" viewBox="0 0 120 120">
          <circle cx="60" cy="60" r="54" fill="none" stroke="hsl(0 0% 15%)" strokeWidth="6" />
          <motion.circle
            cx="60" cy="60" r="54" fill="none"
            stroke={getColor()}
            strokeWidth="6"
            strokeLinecap="round"
            strokeDasharray={circumference}
            initial={{ strokeDashoffset: circumference }}
            animate={{ strokeDashoffset: offset }}
            transition={{ duration: 1.5, ease: 'easeOut' }}
            style={{ filter: `drop-shadow(0 0 8px ${getColor()})` }}
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <motion.span
            className="text-3xl font-bold font-mono"
            style={{ color: getColor() }}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.5 }}
          >
            {score}
          </motion.span>
          <span className="text-[10px] text-muted-foreground font-mono">%</span>
        </div>
      </div>
    </motion.div>
  );
};

export default BlufferScore;
