// Jury Voting Panel - UI Component to display AI jury votes
// Shows 3 juror cards with their votes, confidence, and reasoning

import React from 'react';
import { motion } from 'framer-motion';
import { Shield, Sword, Calculator, CheckCircle, XCircle, Clock, DollarSign } from 'lucide-react';
import type { JuryVerdict, JuryVote, JurorProfile } from '@/services/juryClaudeService';

interface JuryVotingPanelProps {
  verdict: JuryVerdict | null;
  isLoading: boolean;
  onComplete?: () => void;
}

// Juror metadata for UI
const JUROR_META: Record<JurorProfile, {
  name: string;
  icon: React.ComponentType<{ className?: string }>;
  color: string;
  bgColor: string;
  description: string;
}> = {
  conservador: {
    name: 'O Prudente',
    icon: Shield,
    color: 'text-blue-400',
    bgColor: 'bg-blue-500/10',
    description: 'Analista conservador que valoriza evidências concretas',
  },
  agressivo: {
    name: 'O Tubarão',
    icon: Sword,
    color: 'text-red-400',
    bgColor: 'bg-red-500/10',
    description: 'Jurado agressivo que valoriza convicção e coragem',
  },
  neutro: {
    name: 'O Quant',
    icon: Calculator,
    color: 'text-purple-400',
    bgColor: 'bg-purple-500/10',
    description: 'Analista objetivo que segue os dados rigorosamente',
  },
};

/**
 * Individual Juror Vote Card
 */
const JurorCard: React.FC<{
  vote: JuryVote;
  index: number;
}> = ({ vote, index }) => {
  const meta = JUROR_META[vote.profile];
  const Icon = meta.icon;
  
  const isClaro = vote.vote === 'CLARO';
  
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.2 }}
      className={`relative overflow-hidden rounded-lg border ${
        isClaro 
          ? 'border-emerald-500/30 bg-emerald-500/5' 
          : 'border-red-500/30 bg-red-500/5'
      } p-4`}
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <div className={`p-2 rounded-lg ${meta.bgColor}`}>
            <Icon className={`w-5 h-5 ${meta.color}`} />
          </div>
          <div>
            <h3 className={`font-bold ${meta.color}`}>{meta.name}</h3>
            <p className="text-xs text-muted-foreground">{meta.description}</p>
          </div>
        </div>
        
        {/* Vote Icon */}
        {isClaro ? (
          <CheckCircle className="w-8 h-8 text-emerald-400" />
        ) : (
          <XCircle className="w-8 h-8 text-red-400" />
        )}
      </div>
      
      {/* Vote Decision */}
      <div className={`text-center py-3 px-4 rounded-lg ${
        isClaro ? 'bg-emerald-500/20' : 'bg-red-500/20'
      } mb-3`}>
        <div className={`text-2xl font-bold ${
          isClaro ? 'text-emerald-400' : 'text-red-400'
        }`}>
          {vote.vote}
        </div>
        <div className="text-sm text-muted-foreground mt-1">
          Confiança: {vote.confidence}%
        </div>
        
        {/* Confidence Bar */}
        <div className="w-full h-1 bg-secondary rounded-full mt-2 overflow-hidden">
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: `${vote.confidence}%` }}
            transition={{ delay: index * 0.2 + 0.3, duration: 0.5 }}
            className={`h-full ${
              isClaro ? 'bg-emerald-400' : 'bg-red-400'
            }`}
          />
        </div>
      </div>
      
      {/* Reasoning */}
      <div className="text-sm text-foreground/80 bg-background/20 p-3 rounded-lg">
        <p className="italic">"{vote.reasoning}"</p>
      </div>
      
      {/* Processing Time */}
      {vote.processingTimeMs && (
        <div className="flex items-center gap-1 text-xs text-muted-foreground mt-2">
          <Clock className="w-3 h-3" />
          <span>{vote.processingTimeMs}ms</span>
        </div>
      )}
    </motion.div>
  );
};

/**
 * Verdict Summary Banner
 */
const VerdictBanner: React.FC<{ verdict: JuryVerdict }> = ({ verdict }) => {
  const claroCount = verdict.votes.filter(v => v.vote === 'CLARO').length;
  
  return (
    <motion.div
      initial={{ scale: 0.9, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      transition={{ delay: 0.8, type: "spring" }}
      className={`relative overflow-hidden rounded-xl border-2 ${
        verdict.convicted 
          ? 'border-emerald-500 bg-gradient-to-r from-emerald-500/20 to-emerald-500/5' 
          : 'border-red-500 bg-gradient-to-r from-red-500/20 to-red-500/5'
      } p-6 mb-6`}
    >
      <div className="flex items-center justify-between">
        <div>
          <div className={`text-3xl font-bold mb-2 ${
            verdict.convicted ? 'text-emerald-400' : 'text-red-400'
          }`}>
            {verdict.convicted ? '✅ CONVENCEU O JÚRI' : '❌ NÃO CONVENCEU'}
          </div>
          <div className="text-foreground/80">
            Votação: {claroCount} CLARO × {3 - claroCount} BLEFE
            {verdict.unanimous && (
              <span className="ml-2 text-yellow-400">(Unânime!)</span>
            )}
          </div>
        </div>
        
        <div className="text-right">
          <div className="flex items-center gap-2 text-muted-foreground text-sm">
            <Clock className="w-4 h-4" />
            <span>{(verdict.totalProcessingTimeMs / 1000).toFixed(1)}s</span>
          </div>
          <div className="flex items-center gap-2 text-muted-foreground text-sm mt-1">
            <DollarSign className="w-4 h-4" />
            <span>R${verdict.costEstimate.toFixed(2)}</span>
          </div>
        </div>
      </div>
      
      {/* Animated background effect */}
      <motion.div
        animate={{
          scale: [1, 1.2, 1],
          opacity: [0.3, 0.5, 0.3],
        }}
        transition={{
          duration: 3,
          repeat: Infinity,
          ease: "easeInOut",
        }}
        className={`absolute -right-10 -bottom-10 w-40 h-40 rounded-full blur-3xl ${
          verdict.convicted ? 'bg-emerald-500' : 'bg-red-500'
        }`}
      />
    </motion.div>
  );
};

/**
 * Loading State
 */
const LoadingState: React.FC = () => {
  return (
    <div className="space-y-4">
      <div className="text-center py-8">
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
          className="inline-block"
        >
          <Calculator className="w-12 h-12 text-purple-400" />
        </motion.div>
        <p className="text-xl font-bold text-foreground mt-4">
          Júri IA Deliberando...
        </p>
        <p className="text-sm text-muted-foreground mt-2">
          Claude Sonnet 4 analisando evidências
        </p>
      </div>
      
      {/* Animated placeholder cards */}
      {[0, 1, 2].map((i) => (
        <motion.div
          key={i}
          initial={{ opacity: 0 }}
          animate={{ opacity: [0.3, 0.6, 0.3] }}
          transition={{
            delay: i * 0.2,
            duration: 1.5,
            repeat: Infinity,
          }}
          className="h-48 rounded-lg bg-secondary/50 animate-pulse"
        />
      ))}
    </div>
  );
};

/**
 * Main Panel Component
 */
export const JuryVotingPanel: React.FC<JuryVotingPanelProps> = ({
  verdict,
  isLoading,
  onComplete,
}) => {
  // Call onComplete after animation finishes
  React.useEffect(() => {
    if (verdict && !isLoading && onComplete) {
      const timer = setTimeout(onComplete, 3000);
      return () => clearTimeout(timer);
    }
  }, [verdict, isLoading, onComplete]);
  
  if (isLoading) {
    return <LoadingState />;
  }
  
  if (!verdict) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        Aguardando deliberação do júri...
      </div>
    );
  }
  
  return (
    <div className="space-y-4">
      {/* Verdict Banner */}
      <VerdictBanner verdict={verdict} />
      
      {/* Juror Cards */}
      <div className="grid gap-4 md:grid-cols-3">
        {verdict.votes.map((vote, index) => (
          <JurorCard key={vote.profile} vote={vote} index={index} />
        ))}
      </div>
      
      {/* Technical Details (collapsible) */}
      <details className="mt-4">
        <summary className="cursor-pointer text-sm text-muted-foreground hover:text-foreground">
          Detalhes Técnicos
        </summary>
        <div className="mt-2 p-4 bg-background/20 rounded-lg text-xs text-muted-foreground space-y-1">
          <p>• Modelo: Claude Sonnet 4 (claude-sonnet-4-20250514)</p>
          <p>• Processamento: {verdict.totalProcessingTimeMs}ms</p>
          <p>• Custo estimado: R${verdict.costEstimate.toFixed(2)}</p>
          <p>• Tokens aprox: ~900 por jurado × 3 = ~2.700 tokens</p>
        </div>
      </details>
    </div>
  );
};

export default JuryVotingPanel;
