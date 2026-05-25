import { motion } from 'framer-motion';
import { ArrowLeft, Coins, Target, Flame, Shield, Briefcase, Trophy, Calendar, Eye, Zap, Award } from 'lucide-react';
import { Link } from 'react-router-dom';
import { BC_REWARDS, getSafeHarborCardReward } from '@/services/bcRewardsService';
import { useHorusTrigger } from '@/hooks/useHorusTrigger';

interface RewardRow {
  icon: React.ElementType;
  mechanic: string;
  reward: string;
  condition: string;
  when: string;
  highlight?: boolean;
}

const rewardsData: RewardRow[] = [
  {
    icon: Award,
    mechanic: 'Base - Completar Partida',
    reward: `${BC_REWARDS.COMPLETE_GAME} BC`,
    condition: 'Sempre',
    when: 'Fim partida',
  },
  {
    icon: Target,
    mechanic: 'Perguntas - Acerto',
    reward: `${BC_REWARDS.CORRECT_ANSWER} BC`,
    condition: `Por pergunta correta (máx ${BC_REWARDS.MAX_CORRECT_ANSWERS_REWARDED})`,
    when: 'Por rodada',
  },
  {
    icon: Flame,
    mechanic: 'Blefe Perfeito',
    reward: `${BC_REWARDS.PERFECT_BLUFF} BC`,
    condition: 'Errou MAS convenceu TODOS 3 desafiantes',
    when: 'Fim rodada específica',
    highlight: true,
  },
  {
    icon: Flame,
    mechanic: 'Blefe Bom',
    reward: `${BC_REWARDS.GOOD_BLUFF} BC`,
    condition: 'Errou MAS convenceu 2 desafiantes',
    when: 'Fim rodada específica',
  },
  {
    icon: Zap,
    mechanic: 'Acordo Hórus (Bônus Hórus)',
    reward: `${BC_REWARDS.HORUS_DEAL_WIN} BC`,
    condition: 'Usou Hórus E venceu a rodada',
    when: 'Fim rodada que usou',
    highlight: true,
  },
  {
    icon: Shield,
    mechanic: 'Carta Porto Seguro (Conquistar)',
    reward: `10-${getSafeHarborCardReward(10)} BC`,
    condition: 'Conquistou a carta (blefe com 2+ votos)',
    when: 'Ao conquistar',
  },
  {
    icon: Shield,
    mechanic: 'Carta Imunidade (Conquistar)',
    reward: `${BC_REWARDS.IMMUNITY_CARD_UNLOCK} BC`,
    condition: 'Conquistou a carta (blefe perfeito 3/3)',
    when: 'Ao conquistar',
    highlight: true,
  },
  {
    icon: Briefcase,
    mechanic: 'Maleta Misteriosa (Proposta Indecente)',
    reward: `${BC_REWARDS.MYSTERY_BRIEFCASE_MIN}-${BC_REWARDS.MYSTERY_BRIEFCASE_MAX} BC`,
    condition: 'Vencer rodada 14 (qualquer forma)',
    when: 'Fim rodada 14',
    highlight: true,
  },
  {
    icon: Trophy,
    mechanic: 'Vitória Final (Blefador Milionário)',
    reward: `${BC_REWARDS.FINAL_VICTORY} BC`,
    condition: 'Completar rodada 15 (prêmio máximo)',
    when: 'Fim rodada 15',
    highlight: true,
  },
  {
    icon: Calendar,
    mechanic: 'Streak Diário',
    reward: `${BC_REWARDS.DAILY_STREAK} BC/dia`,
    condition: `Por dia consecutivo (máx ${BC_REWARDS.MAX_DAILY_STREAK_DAYS} dias = ${BC_REWARDS.DAILY_STREAK * BC_REWARDS.MAX_DAILY_STREAK_DAYS} BC)`,
    when: 'Ao logar (diário)',
  },
  {
    icon: Eye,
    mechanic: 'Desafiante Certeiro',
    reward: `${BC_REWARDS.CHALLENGER_ACCURACY} BC`,
    condition: 'Desafiante acertou 5+ votos corretos (de 10 rodadas)',
    when: 'Fim partida',
  },
];

export default function HowToEarnBC() {
  useHorusTrigger('liga_mycroft_first_visit');
  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-background/95 backdrop-blur border-b border-border">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <Link to="/mercado-negro" className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors">
            <ArrowLeft className="w-5 h-5" />
            <span className="hidden sm:inline">Voltar</span>
          </Link>
          
          <h1 className="font-orbitron font-black text-lg md:text-xl text-gold text-glow-gold text-center">
            COMO CONQUISTAR BLUFFCOINS
          </h1>
          
          <div className="w-16" /> {/* Spacer */}
        </div>
      </header>

      <main className="container mx-auto px-4 py-8 space-y-8">
        {/* Hero Section */}
        <motion.section
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center space-y-4"
        >
          <motion.div
            animate={{ rotate: [0, 10, -10, 0], scale: [1, 1.1, 1] }}
            transition={{ duration: 2, repeat: Infinity, repeatDelay: 1 }}
            className="inline-block"
          >
            <Coins className="w-16 h-16 text-gold mx-auto" />
          </motion.div>
          <h2 className="font-orbitron text-2xl md:text-3xl font-bold text-foreground">
            Tabela de Recompensas BC
          </h2>
          <p className="text-muted-foreground max-w-lg mx-auto">
            Descubra todas as formas de ganhar BluffCoins durante suas partidas. 
            Quanto mais você jogar e blefar, mais BC você acumula!
          </p>
        </motion.section>

        {/* Rewards Table */}
        <motion.section
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="overflow-x-auto"
        >
          <div className="min-w-[700px]">
            {/* Table Header */}
            <div className="grid grid-cols-5 gap-2 p-3 bg-gold/10 rounded-t-xl border border-gold/30 font-orbitron text-xs uppercase text-gold">
              <div>Mecânica</div>
              <div className="text-center">BC</div>
              <div className="col-span-2">Condição</div>
              <div className="text-right">Quando</div>
            </div>

            {/* Table Rows */}
            <div className="border-x border-b border-border rounded-b-xl overflow-hidden">
              {rewardsData.map((row, index) => {
                const Icon = row.icon;
                return (
                  <motion.div
                    key={row.mechanic}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.05 * index }}
                    className={`
                      grid grid-cols-5 gap-2 p-4 items-center
                      ${index % 2 === 0 ? 'bg-secondary/20' : 'bg-background'}
                      ${row.highlight ? 'border-l-4 border-l-gold' : ''}
                      hover:bg-secondary/40 transition-colors
                    `}
                  >
                    <div className="flex items-center gap-2">
                      <Icon className={`w-5 h-5 ${row.highlight ? 'text-gold' : 'text-muted-foreground'}`} />
                      <span className="text-sm font-medium text-foreground">{row.mechanic}</span>
                    </div>
                    <div className="text-center">
                      <span className={`font-orbitron font-bold ${row.highlight ? 'text-gold text-lg' : 'text-foreground'}`}>
                        {row.reward}
                      </span>
                    </div>
                    <div className="col-span-2 text-sm text-muted-foreground">
                      {row.condition}
                    </div>
                    <div className="text-right text-xs text-muted-foreground">
                      {row.when}
                    </div>
                  </motion.div>
                );
              })}
            </div>
          </div>
        </motion.section>

        {/* Tips Section */}
        <motion.section
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className="space-y-4"
        >
          <h3 className="font-orbitron text-lg text-gold text-center">DICAS PARA MAXIMIZAR</h3>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="p-4 bg-secondary/30 rounded-xl border border-border/50 text-center">
              <Flame className="w-8 h-8 text-orange-500 mx-auto mb-2" />
              <h4 className="font-bold text-foreground mb-1">Blefe com Confiança</h4>
              <p className="text-xs text-muted-foreground">
                Blefes perfeitos rendem 120 BC + carta de imunidade
              </p>
            </div>
            
            <div className="p-4 bg-secondary/30 rounded-xl border border-border/50 text-center">
              <Calendar className="w-8 h-8 text-cyan mx-auto mb-2" />
              <h4 className="font-bold text-foreground mb-1">Jogue Todo Dia</h4>
              <p className="text-xs text-muted-foreground">
                Streak de 7 dias = 140 BC bônus grátis
              </p>
            </div>
            
            <div className="p-4 bg-secondary/30 rounded-xl border border-border/50 text-center">
              <Trophy className="w-8 h-8 text-gold mx-auto mb-2" />
              <h4 className="font-bold text-foreground mb-1">Chegue na Rodada 15</h4>
              <p className="text-xs text-muted-foreground">
                O prêmio máximo de 1000 BC espera por você
              </p>
            </div>
          </div>
        </motion.section>

        {/* CTA */}
        <motion.section
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.6 }}
          className="text-center pb-8"
        >
          <Link to="/">
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              className="
                px-8 py-4 rounded-xl
                bg-gradient-to-r from-gold/80 to-amber-500/80
                hover:from-gold hover:to-amber-500
                text-background font-orbitron font-bold text-lg
                shadow-lg shadow-gold/30
                transition-all
              "
            >
              COMEÇAR A JOGAR
            </motion.button>
          </Link>
        </motion.section>
      </main>
    </div>
  );
}
