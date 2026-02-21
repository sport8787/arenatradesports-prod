export interface Achievement {
  id: string;
  name: string;
  description: string;
  icon: string;
  condition: (stats: TraderStats) => boolean;
  tier: 'bronze' | 'silver' | 'gold' | 'legendary';
}

export interface TraderStats {
  totalTrades: number;
  winningTrades: number;
  losingTrades: number;
  balance: number;
  initialBalance: number;
  bestTrade: number;
  worstTrade: number;
  totalPnl: number;
  currentStreak: number;
  maxDrawdown: number;
  leverageUsed: number[];
  tradeHistory: { pnl: number; asset: string; type: string }[];
}

export const ACHIEVEMENTS: Achievement[] = [
  {
    id: 'first_trade',
    name: 'Primeira Operação',
    description: 'Abrir sua primeira posição no mercado',
    icon: '🎯',
    condition: (s) => s.totalTrades >= 1,
    tier: 'bronze',
  },
  {
    id: 'cold_blood',
    name: 'Sangue Frio',
    description: 'Fechar com lucro após PnL negativo de -5K',
    icon: '🧊',
    condition: (s) => {
      const hist = s.tradeHistory;
      for (let i = 1; i < hist.length; i++) {
        if (hist[i].pnl > 0 && hist[i - 1].pnl <= -5000) return true;
      }
      return false;
    },
    tier: 'silver',
  },
  {
    id: 'wolf',
    name: 'Lobo de Wall Street',
    description: 'Acumular 1.000.000 BC de saldo',
    icon: '🐺',
    condition: (s) => s.balance >= 1000000,
    tier: 'legendary',
  },
  {
    id: 'sardine_survivor',
    name: 'Sardinha Sobrevivente',
    description: 'Recuperar após perder 50% da banca',
    icon: '🐟',
    condition: (s) => {
      const minBal = s.initialBalance * 0.5;
      return s.maxDrawdown >= 50 && s.balance >= s.initialBalance;
    },
    tier: 'gold',
  },
  {
    id: 'triple_kill',
    name: 'Triple Kill',
    description: '3 trades lucrativos em sequência',
    icon: '🔥',
    condition: (s) => s.currentStreak >= 3,
    tier: 'silver',
  },
  {
    id: 'leverage_king',
    name: 'Rei da Alavancagem',
    description: 'Lucrar com alavancagem 10x',
    icon: '👑',
    condition: (s) => s.leverageUsed.includes(10) && s.tradeHistory.some(t => t.pnl > 0),
    tier: 'gold',
  },
  {
    id: 'diversified',
    name: 'Diversificado',
    description: 'Operar em todos os 4 ativos',
    icon: '📊',
    condition: (s) => {
      const assets = new Set(s.tradeHistory.map(t => t.asset));
      return assets.size >= 4;
    },
    tier: 'bronze',
  },
  {
    id: 'short_master',
    name: 'Mestre do Short',
    description: 'Lucrar 3 vezes com operações Short',
    icon: '📉',
    condition: (s) => s.tradeHistory.filter(t => t.type === 'short' && t.pnl > 0).length >= 3,
    tier: 'silver',
  },
  {
    id: 'diamond_hands',
    name: 'Mãos de Diamante',
    description: 'Realizar 20 trades sem zerar a banca',
    icon: '💎',
    condition: (s) => s.totalTrades >= 20 && s.balance > 0,
    tier: 'gold',
  },
  {
    id: 'comeback_kid',
    name: 'O Retorno',
    description: 'Lucrar 50K BC após estar no negativo',
    icon: '🚀',
    condition: (s) => s.totalPnl >= 50000 && s.worstTrade < 0,
    tier: 'legendary',
  },
];

export function checkAchievements(stats: TraderStats, unlockedIds: string[]): Achievement[] {
  return ACHIEVEMENTS.filter(a => !unlockedIds.includes(a.id) && a.condition(stats));
}

export function getTierColor(tier: Achievement['tier']): string {
  switch (tier) {
    case 'bronze': return 'text-orange-400 border-orange-400/30 bg-orange-400/10';
    case 'silver': return 'text-slate-300 border-slate-300/30 bg-slate-300/10';
    case 'gold': return 'text-amber-400 border-amber-400/30 bg-amber-400/10';
    case 'legendary': return 'text-purple-400 border-purple-400/30 bg-purple-400/10';
  }
}
