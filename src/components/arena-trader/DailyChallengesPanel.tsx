import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Target, Flame, Clock, CheckCircle2 } from 'lucide-react';

export interface DailyChallenge {
  id: string;
  name: string;
  description: string;
  icon: string;
  reward: number;
  target: number;
  current: number;
  completed: boolean;
}

interface Props {
  tradeHistory: { pnl: number; asset: string; type: string }[];
  balance: number;
  initialBalance: number;
}

function generateDailyChallenges(tradeHistory: Props['tradeHistory'], balance: number, initialBalance: number): DailyChallenge[] {
  // Count consecutive wins from the end
  let winStreak = 0;
  for (let i = tradeHistory.length - 1; i >= 0; i--) {
    if (tradeHistory[i].pnl > 0) winStreak++;
    else break;
  }

  const totalTrades = tradeHistory.length;
  const maxLoss = Math.min(...tradeHistory.map(t => t.pnl), 0);
  const maxLossPct = Math.abs(maxLoss) / initialBalance * 100;

  return [
    {
      id: 'sniper',
      name: 'Desafio Sniper',
      description: '3 trades com lucro em sequência',
      icon: '🎯',
      reward: 500,
      target: 3,
      current: Math.min(winStreak, 3),
      completed: winStreak >= 3,
    },
    {
      id: 'survival',
      name: 'Desafio Sobrevivência',
      description: 'Não perder >5% da banca em 10 trades',
      icon: '🛡️',
      reward: 750,
      target: 10,
      current: Math.min(totalTrades, 10),
      completed: totalTrades >= 10 && maxLossPct <= 5,
    },
    {
      id: 'volume',
      name: 'Trader Ativo',
      description: 'Realizar 5 operações hoje',
      icon: '📈',
      reward: 300,
      target: 5,
      current: Math.min(totalTrades, 5),
      completed: totalTrades >= 5,
    },
  ];
}

export default function DailyChallengesPanel({ tradeHistory, balance, initialBalance }: Props) {
  const challenges = generateDailyChallenges(tradeHistory, balance, initialBalance);

  return (
    <div className="bg-[#111111] border border-amber-900/30 rounded-xl p-4">
      <h3 className="font-orbitron text-xs font-bold text-amber-400/80 uppercase mb-3 flex items-center gap-2">
        <Target className="w-4 h-4" />
        Desafios Diários
      </h3>
      <div className="space-y-2">
        {challenges.map((ch) => (
          <div
            key={ch.id}
            className={`rounded-lg border p-3 transition-all ${
              ch.completed
                ? 'border-emerald-500/40 bg-emerald-500/10'
                : 'border-white/10 bg-white/5'
            }`}
          >
            <div className="flex items-center justify-between mb-1.5">
              <div className="flex items-center gap-2">
                <span className="text-base">{ch.icon}</span>
                <span className="text-xs font-bold text-white/90">{ch.name}</span>
              </div>
              {ch.completed ? (
                <CheckCircle2 className="w-4 h-4 text-emerald-400" />
              ) : (
                <span className="text-[10px] text-amber-400 font-bold">+{ch.reward} BC</span>
              )}
            </div>
            <p className="text-[10px] text-white/50 mb-1.5">{ch.description}</p>
            <div className="w-full h-1.5 bg-white/10 rounded-full overflow-hidden">
              <motion.div
                className={`h-full rounded-full ${ch.completed ? 'bg-emerald-400' : 'bg-amber-400'}`}
                initial={{ width: 0 }}
                animate={{ width: `${(ch.current / ch.target) * 100}%` }}
                transition={{ duration: 0.5 }}
              />
            </div>
            <p className="text-[10px] text-white/40 mt-1 text-right">
              {ch.current}/{ch.target}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}
