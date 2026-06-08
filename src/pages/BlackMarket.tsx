import { motion } from 'framer-motion';
import { ArrowLeft, Lock, Vault, Coins, Loader2, Trophy, Crown, Gift, Calendar, Hourglass, Sparkles } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { useEconomy } from '@/hooks/useEconomy';
import { useSubscription } from '@/hooks/useSubscription';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import BluffCoinDisplay from '@/components/game/BluffCoinDisplay';
import { toast } from '@/hooks/use-toast';
import { Skeleton } from '@/components/ui/skeleton';
import LigaMycroftLeaderboard from '@/components/punter/LigaMycroftLeaderboard';

import prizeGiftcard50 from '@/assets/prize-giftcard-50-v2.jpg';
import prizeGiftcard100 from '@/assets/prize-giftcard-100.jpg';
import prizeGiftcard200 from '@/assets/prize-giftcard-200.jpg';
import prizeSub30d from '@/assets/prize-sub-30d.jpg';
import prizePremiumUpgrade from '@/assets/prize-7d-premium.jpg';
import prizeTrophy from '@/assets/prize-trophy.jpg';
import prizeCamisaTime from '@/assets/prize-camisa-time.jpg';

interface PrizeCard {
  id: number;
  name: string;
  price: string;
  priceValue: number; // valor de BC ainda a definir; placeholders ordenados por percepção de valor
  image: string;
  description: string;
  category: 'giftcard' | 'subscription' | 'season';
  badge?: string;
  premiumOnly?: boolean;
}

// Vitrine recalibrada (jun/2026): preços inflacionados ×10 para sustentabilidade da economia.
// Um Premium disciplinado resgata o vale R$50 em ~1,5 ano — evita esgotamento rápido.
const prizes: PrizeCard[] = [
  {
    id: 1,
    name: 'Vale-Presente R$ 50',
    price: '35.000 BC',
    priceValue: 35000,
    image: prizeGiftcard50,
    description: 'Vale-presente digital de R$ 50 (lojas parceiras)',
    category: 'giftcard',
  },
  {
    id: 7,
    name: '7 Dias Premium Grátis',
    price: '8.000 BC',
    priceValue: 8000,
    image: prizePremiumUpgrade,
    description: 'Estende ou faz upgrade pra Premium por 7 dias.',
    category: 'subscription',
    badge: 'NOVO',
  },
  {
    id: 2,
    name: '30 Dias Premium Grátis',
    price: '25.000 BC',
    priceValue: 25000,
    image: prizeSub30d,
    description: 'Estende ou faz upgrade pra Premium por 30 dias',
    category: 'subscription',
    badge: 'POPULAR',
  },
  {
    id: 3,
    name: 'Vale-Presente R$ 100',
    price: '70.000 BC',
    priceValue: 70000,
    image: prizeGiftcard100,
    description: 'Vale-presente digital de R$ 100 (lojas parceiras)',
    category: 'giftcard',
  },
  {
    id: 4,
    name: 'Gift Card R$ 200',
    price: '130.000 BC',
    priceValue: 130000,
    image: prizeGiftcard200,
    description: 'Gift Card digital de R$ 200 (lojas parceiras)',
    category: 'giftcard',
    premiumOnly: true,
  },
  {
    id: 5,
    name: 'Premium VIP (Tudo Liberado)',
    price: '150.000 BC',
    priceValue: 150000,
    image: prizePremiumUpgrade,
    description: 'Faz upgrade do seu plano atual para Premium por 30 dias',
    category: 'subscription',
    badge: 'TOP',
  },
  {
    id: 6,
    name: 'Camisa Oficial do Seu Time',
    price: '180.000 BC',
    priceValue: 180000,
    image: prizeCamisaTime,
    description: 'Camisa oficial original do clube de futebol que você escolher (tamanho e modelo da temporada atual). Entrega em todo o Brasil.',
    category: 'season',
    badge: 'NOVO',
    premiumOnly: true,
  },
];

export default function BlackMarket() {
  const { bcBalance, loading } = useEconomy();
  const { user } = useAuth();
  const { isPaid, isTrialActive, subscription, loading: subLoading } = useSubscription();
  const userCoins = bcBalance;
  const canRedeem = isPaid; // Trial acumula mas NÃO resgata
  const currentPlan = subscription?.plan ?? 'free';
  const isPremium = currentPlan === 'premium' && !!subscription?.is_active;
  const isBase = currentPlan === 'base' && !!subscription?.is_active;
  const isTrial = isTrialActive;
  const planMultiplier = isPremium ? 1.3 : isBase ? 1.1 : isTrial ? 2.5 : 1.0;
  const monthlyCap = isPremium ? 2000 : isBase ? 1200 : 600;

  // Cap mensal acumulado + próximo lote a expirar
  const [creditedThisMonth, setCreditedThisMonth] = useState<number>(0);
  const [nextExpiry, setNextExpiry] = useState<{ amount: number; days: number } | null>(null);

  useEffect(() => {
    if (!user) return;
    let active = true;
    const ym = new Date().toISOString().slice(0, 7);
    (async () => {
      const [{ data: capRow }, { data: nextLot }] = await Promise.all([
        supabase
          .from('bc_monthly_caps' as any)
          .select('total_credited')
          .eq('user_id', user.id)
          .eq('year_month', ym)
          .maybeSingle(),
        supabase
          .from('bc_rewards_log')
          .select('total_bc, expires_at')
          .eq('user_id', user.id)
          .gt('total_bc', 0)
          .not('expires_at', 'is', null)
          .gt('expires_at', new Date().toISOString())
          .order('expires_at', { ascending: true })
          .limit(1)
          .maybeSingle(),
      ]);
      if (!active) return;
      setCreditedThisMonth(((capRow as any)?.total_credited as number) ?? 0);
      if (nextLot?.expires_at) {
        const days = Math.max(
          1,
          Math.ceil((new Date(nextLot.expires_at as string).getTime() - Date.now()) / 86400000)
        );
        setNextExpiry({ amount: (nextLot as any).total_bc, days });
      }
    })();
    return () => {
      active = false;
    };
  }, [user]);

  const capPct = Math.min(100, Math.round((creditedThisMonth / monthlyCap) * 100));

  const formatCoins = (amount: number) => {
    if (amount >= 1000000) return `${(amount / 1000000).toFixed(1)}M`;
    if (amount >= 1000) return `${Math.round(amount / 1000)}k`;
    return amount.toString();
  };

  const handleRedeemClick = () => {
    if (!canRedeem) {
      toast({
        title: '🔒 Resgate disponível só para assinantes',
        description: 'Você acumula BC durante o Trial, mas só pode trocar por prêmios após assinar um plano.',
        duration: 4500,
      });
      return;
    }
    toast({
      title: '🔒 Cofre Bloqueado',
      description: 'Aguarde a abertura oficial da temporada.',
      duration: 3000,
    });
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-background/95 backdrop-blur border-b border-border">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors">
            <ArrowLeft className="w-5 h-5" />
            <span className="hidden sm:inline">Voltar</span>
          </Link>

          <h1 className="font-orbitron font-black text-xl md:text-2xl text-gold text-glow-gold">
            LIGA MYCROFT
          </h1>

          {user ? (
            <div className="flex items-center gap-2 bg-secondary/50 px-3 py-2 rounded-lg border border-border min-w-[80px] justify-center">
              {loading ? (
                <div className="flex items-center gap-2">
                  <Loader2 className="w-4 h-4 animate-spin text-gold" />
                  <Skeleton className="h-4 w-12" />
                </div>
              ) : (
                <BluffCoinDisplay amount={userCoins} size="sm" showChange={false} />
              )}
            </div>
          ) : (
            <Link
              to="/auth"
              className="text-xs font-medium text-muted-foreground hover:text-foreground transition-colors underline underline-offset-2"
            >
              Entrar
            </Link>
          )}
        </div>
      </header>

      <main className="container mx-auto px-4 py-8 space-y-12">
        {/* Hero */}
        <motion.section
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center space-y-6"
        >
          <motion.div
            initial={{ scale: 0.8 }}
            animate={{ scale: 1 }}
            transition={{ delay: 0.2, type: 'spring', stiffness: 200 }}
            className="relative inline-block"
          >
            <div className="w-32 h-32 mx-auto rounded-2xl bg-gradient-to-br from-gold/20 via-primary/10 to-gold-dark/20 border-2 border-gold/30 flex items-center justify-center">
              <Vault className="w-16 h-16 text-gold" />
            </div>
            <motion.div
              animate={{ rotate: [0, -5, 5, 0] }}
              transition={{ repeat: Infinity, duration: 3, ease: 'easeInOut' }}
              className="absolute -top-2 -right-2 bg-destructive text-destructive-foreground text-xs font-bold px-2 py-1 rounded-full"
            >
              <Lock className="w-3 h-3 inline mr-1" />
              EM BREVE
            </motion.div>
          </motion.div>

          <div className="space-y-3">
            <h2 className="font-orbitron text-3xl md:text-4xl font-black text-foreground">
              LIGA MYCROFT
            </h2>
            <p className="text-lg md:text-xl text-gold max-w-xl mx-auto">
              Ranking por <span className="font-bold">ROI%</span> · Prêmios reais · Troféu da temporada
              <br />
              <span className="text-muted-foreground text-sm">Acumule BluffCoins com entradas virtuais vencedoras e troque por vale-presentes, dias grátis ou upgrade Premium.</span>
            </p>
          </div>
        </motion.section>

        {/* Aviso de elegibilidade — Trial vs Assinante vs Não logado */}
        {!subLoading && (
          <motion.section
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="max-w-3xl mx-auto"
          >
            {!user ? (
              <div className="rounded-xl border border-blue-500/30 bg-blue-500/10 p-4 flex items-start gap-3">
                <div className="shrink-0 rounded-lg bg-blue-500/20 p-2">
                  <Coins className="w-5 h-5 text-blue-400" />
                </div>
                <div className="flex-1">
                  <p className="text-sm font-semibold text-blue-300">
                    Liga Mycroft — acumule BC e troque por prêmios reais 🏆
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Assinantes e usuários em trial acumulam <span className="text-foreground font-medium">BluffCoins</span> a cada GREEN virtual.
                    Troque por vale-presentes, dias grátis Premium, camisas oficiais e dispute o troféu da temporada.
                  </p>
                  <Link
                    to="/auth"
                    className="inline-flex items-center gap-1.5 mt-3 rounded-md bg-blue-500/20 hover:bg-blue-500/30 px-3 py-1.5 text-xs font-medium text-blue-300 transition"
                  >
                    Criar conta gratuita
                  </Link>
                </div>
              </div>
            ) : canRedeem ? (
              <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-4 flex items-start gap-3">
                <div className="shrink-0 rounded-lg bg-emerald-500/20 p-2">
                  <Gift className="w-5 h-5 text-emerald-400" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-emerald-300">Você pode resgatar prêmios ✓</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Como assinante ativo, seus BC podem ser trocados por qualquer item desta vitrine assim que o cofre for aberto.
                  </p>
                </div>
              </div>
            ) : (
              <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-4 flex items-start gap-3">
                <div className="shrink-0 rounded-lg bg-amber-500/20 p-2">
                  <Lock className="w-5 h-5 text-amber-400" />
                </div>
                <div className="flex-1">
                  <p className="text-sm font-semibold text-amber-300">
                    {isTrialActive ? 'Você está acumulando BC durante o Trial 🪙' : 'Resgate disponível só para assinantes'}
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Você pode <span className="text-foreground font-medium">acumular BluffCoins</span> normalmente, mas o{' '}
                    <span className="text-foreground font-medium">resgate de prêmios é exclusivo para usuários assinantes</span>.
                    Assine qualquer plano para liberar a troca quando o cofre abrir.
                  </p>
                  <Link
                    to="/paywall"
                    className="inline-flex items-center gap-1.5 mt-3 rounded-md bg-amber-500/20 hover:bg-amber-500/30 px-3 py-1.5 text-xs font-medium text-amber-300 transition"
                  >
                    Ver planos de assinatura
                  </Link>
                </div>
              </div>
            )}
          </motion.section>
        )}

        {/* Painel de Progresso do Trial — projeção até o primeiro resgate */}
        {!subLoading && !!user && isTrial && (() => {
          const balance = userCoins;
          const cheapestPrize = 8000; // 7 Dias Premium Grátis
          const valePrize = 35000;    // Vale R$ 50
          const day = new Date().getUTCDate();
          const dailyPace = day > 0 ? creditedThisMonth / day : 0;
          // Após assinar Premium, o multiplicador cai (2.5x → 1.3x) e o cap sobe (600 → 2000).
          // Pace projetado pós-assinatura ≈ dailyPace * (1.3 / 2.5).
          const postPace = dailyPace * (1.3 / 2.5);
          const remainingToCheap = Math.max(0, cheapestPrize - balance);
          const remainingToVale = Math.max(0, valePrize - balance);
          const daysToCheap = postPace > 0 ? Math.ceil(remainingToCheap / postPace) : null;
          const daysToVale = postPace > 0 ? Math.ceil(remainingToVale / postPace) : null;
          const cheapPct = Math.min(100, Math.round((balance / cheapestPrize) * 100));
          const valePct = Math.min(100, Math.round((balance / valePrize) * 100));

          return (
            <motion.section
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="max-w-3xl mx-auto"
            >
              <div className="rounded-xl border border-emerald-500/40 bg-gradient-to-br from-emerald-500/10 via-teal-500/5 to-transparent p-4 sm:p-5">
                <div className="flex items-center gap-2 mb-3">
                  <Sparkles className="w-4 h-4 text-emerald-300" />
                  <h3 className="font-mono text-xs uppercase tracking-wider text-emerald-300 font-bold">
                    Seu progresso no trial
                  </h3>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-4">
                  <div className="rounded-lg bg-card/60 border border-border/40 p-3">
                    <p className="text-[10px] uppercase text-muted-foreground">BC acumulado</p>
                    <p className="font-orbitron font-bold text-xl text-foreground mt-1">
                      {balance.toLocaleString('pt-BR')}
                    </p>
                    <p className="text-[10px] text-muted-foreground/70 mt-0.5">saldo atual</p>
                  </div>
                  <div className="rounded-lg bg-card/60 border border-border/40 p-3">
                    <p className="text-[10px] uppercase text-muted-foreground">Cap mensal trial</p>
                    <p className="font-orbitron font-bold text-xl text-emerald-300 mt-1">
                      {creditedThisMonth} <span className="text-sm text-muted-foreground">/ {monthlyCap}</span>
                    </p>
                    <p className="text-[10px] text-emerald-300/70 mt-0.5">multiplicador 2.5x ativo</p>
                  </div>
                  <div className="rounded-lg bg-card/60 border border-border/40 p-3">
                    <p className="text-[10px] uppercase text-muted-foreground">Ritmo diário</p>
                    <p className="font-orbitron font-bold text-xl text-foreground mt-1">
                      {dailyPace > 0 ? `${dailyPace.toFixed(1)} BC` : '—'}
                    </p>
                    <p className="text-[10px] text-muted-foreground/70 mt-0.5">média neste mês</p>
                  </div>
                </div>

                {/* Barras de progresso para os 2 primeiros prêmios */}
                <div className="space-y-3 mb-4">
                  <div>
                    <div className="flex items-center justify-between text-[11px] mb-1">
                      <span className="text-muted-foreground">
                        🎯 7 Dias Premium Grátis <span className="text-foreground font-medium">(8.000 BC)</span>
                      </span>
                      <span className="font-mono text-foreground">{cheapPct}%</span>
                    </div>
                    <div className="h-2 rounded-full bg-card/60 overflow-hidden">
                      <div
                        className="h-full bg-gradient-to-r from-emerald-400 to-teal-400 transition-all"
                        style={{ width: `${cheapPct}%` }}
                      />
                    </div>
                  </div>
                  <div>
                    <div className="flex items-center justify-between text-[11px] mb-1">
                      <span className="text-muted-foreground">
                        💸 Vale-Presente R$ 50 <span className="text-foreground font-medium">(35.000 BC)</span>
                      </span>
                      <span className="font-mono text-foreground">{valePct}%</span>
                    </div>
                    <div className="h-2 rounded-full bg-card/60 overflow-hidden">
                      <div
                        className="h-full bg-gradient-to-r from-amber-400 to-orange-400 transition-all"
                        style={{ width: `${valePct}%` }}
                      />
                    </div>
                  </div>
                </div>

                {/* Estimativa pós-assinatura */}
                <div className="rounded-lg bg-amber-500/10 border border-amber-500/30 p-3">
                  <p className="text-[11px] font-semibold text-amber-300 mb-1.5">
                    📊 Estimativa após você assinar (ritmo Premium)
                  </p>
                  {dailyPace > 0 ? (
                    <ul className="text-[11px] text-muted-foreground space-y-1">
                      <li>
                        🎯 <span className="text-foreground">7 Dias Premium</span> em ~
                        <span className="text-emerald-300 font-mono font-semibold">
                          {balance >= cheapestPrize ? 'JÁ DESBLOQUEADO ✓' : `${daysToCheap} dia${daysToCheap === 1 ? '' : 's'}`}
                        </span>
                      </li>
                      <li>
                        💸 <span className="text-foreground">Vale R$ 50</span> em ~
                        <span className="text-amber-300 font-mono font-semibold">
                          {balance >= valePrize ? 'JÁ DESBLOQUEADO ✓' : `${daysToVale} dia${daysToVale === 1 ? '' : 's'}`}
                        </span>
                      </li>
                    </ul>
                  ) : (
                    <p className="text-[11px] text-muted-foreground italic">
                      Faça suas primeiras entradas virtuais para calcularmos sua estimativa.
                    </p>
                  )}
                  <p className="text-[10px] text-muted-foreground/70 mt-2 leading-snug">
                    Cálculo baseado no seu ritmo atual de {dailyPace > 0 ? dailyPace.toFixed(1) : '—'} BC/dia (trial 2.5x)
                    projetado para o ritmo Premium (1.3x). Quanto melhor sua disciplina, mais rápido o resgate.
                  </p>
                  <Link
                    to="/paywall"
                    className="inline-flex items-center gap-1.5 mt-3 rounded-md bg-amber-500/20 hover:bg-amber-500/30 px-3 py-1.5 text-xs font-medium text-amber-300 transition"
                  >
                    Assinar para liberar resgates
                  </Link>
                </div>
              </div>
            </motion.section>
          );
        })()}

        {/* Multiplicador de BC por plano */}
        {!subLoading && (
          <motion.section
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="max-w-3xl mx-auto"
          >
            <div className="rounded-xl border border-purple-500/30 bg-gradient-to-r from-purple-500/10 via-fuchsia-500/10 to-pink-500/10 p-4">
              <div className="flex items-center gap-2 mb-3">
                <Crown className="w-4 h-4 text-fuchsia-300" />
                <h3 className="font-mono text-xs uppercase tracking-wider text-fuchsia-300 font-bold">
                  Multiplicador de BC por plano
                </h3>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-center">
                <div className={`rounded-md p-2 border ${currentPlan === 'free' || (!subscription?.is_active && !isTrial) ? 'border-foreground/40 bg-foreground/5' : 'border-border/40 bg-card/40 opacity-60'}`}>
                  <p className="text-[10px] text-muted-foreground uppercase">Free</p>
                  <p className="font-mono font-bold text-sm text-foreground">1.0x</p>
                  <p className="text-[9px] text-muted-foreground/70">cap 600/mês</p>
                </div>
                <div className={`rounded-md p-2 border ${isTrial ? 'border-emerald-400/60 bg-emerald-500/10' : 'border-border/40 bg-card/40 opacity-60'}`}>
                  <p className="text-[10px] text-emerald-300 uppercase flex items-center justify-center gap-0.5">
                    <Sparkles className="w-2.5 h-2.5" /> Trial
                  </p>
                  <p className="font-mono font-bold text-sm text-emerald-300">2.5x</p>
                  <p className="text-[9px] text-emerald-300/70">acumula sem resgatar</p>
                </div>
                <div className={`rounded-md p-2 border ${isBase ? 'border-blue-400/60 bg-blue-500/10' : 'border-border/40 bg-card/40 opacity-60'}`}>
                  <p className="text-[10px] text-blue-300 uppercase">Base</p>
                  <p className="font-mono font-bold text-sm text-blue-300">1.1x</p>
                  <p className="text-[9px] text-blue-300/70">cap 1.200/mês</p>
                </div>
                <div className={`rounded-md p-2 border ${isPremium ? 'border-yellow-400/60 bg-gradient-to-b from-yellow-500/15 to-amber-500/10' : 'border-border/40 bg-card/40 opacity-60'}`}>
                  <p className="text-[10px] text-yellow-300 uppercase flex items-center justify-center gap-0.5">
                    <Crown className="w-2.5 h-2.5" /> Premium
                  </p>
                  <p className="font-mono font-bold text-sm text-yellow-300">1.3x</p>
                  <p className="text-[9px] text-yellow-300/70">cap 2.000/mês</p>
                </div>
              </div>

              {/* Barra de cap mensal */}
              {!!user && (
                <div className="mt-4 space-y-1.5">
                  <div className="flex items-center justify-between text-[11px]">
                    <span className="text-muted-foreground">Cap mensal de BC</span>
                    <span className="font-mono text-foreground">
                      {creditedThisMonth.toLocaleString('pt-BR')} / {monthlyCap.toLocaleString('pt-BR')} BC
                    </span>
                  </div>
                  <div className="h-2 rounded-full bg-card/60 overflow-hidden">
                    <div
                      className={`h-full transition-all ${capPct >= 100 ? 'bg-destructive' : capPct >= 80 ? 'bg-amber-400' : 'bg-emerald-400'}`}
                      style={{ width: `${capPct}%` }}
                    />
                  </div>
                  {capPct >= 100 && (
                    <p className="text-[10px] text-destructive">
                      Cap atingido este mês. Novos GREENs só vão render no virar do mês.
                    </p>
                  )}
                </div>
              )}

              {nextExpiry && (
                <div className="mt-3 flex items-center gap-2 text-[11px] text-amber-300/90">
                  <Hourglass className="w-3 h-3" />
                  <span>
                    Próximo lote a expirar: <span className="font-mono">{nextExpiry.amount} BC</span> em {nextExpiry.days} dia{nextExpiry.days > 1 ? 's' : ''}
                  </span>
                </div>
              )}

              <p className="text-[11px] text-muted-foreground mt-3 leading-snug">
                Cada GREEN virtual rende{' '}
                <span className="font-semibold text-foreground">3 a 15 BC (por faixa de odd) + bônus por lucro</span>, multiplicado pelo seu plano.
                Entradas seguindo entradas aprovados rendem <span className="text-emerald-300">100%</span>; manuais soltas rendem <span className="text-amber-300">50%</span>.
                Cada RED virtual desconta <span className="text-destructive">3 BC</span>. BC expira em <span className="text-foreground">120 dias</span>.
                {isTrial && (
                  <>
                    {' '}<span className="text-emerald-300 font-semibold">Trial acumula 2.5x</span> — você vê o saldo subir rápido, mas só consegue resgatar após assinar.
                  </>
                )}
              </p>
            </div>
          </motion.section>
        )}

        {/* Troféu da Temporada */}
        <motion.section
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="max-w-3xl mx-auto"
        >
          <div className="rounded-2xl border border-gold/40 bg-gradient-to-br from-gold/15 via-amber-500/10 to-orange-500/10 overflow-hidden">
            <div className="grid grid-cols-1 sm:grid-cols-[180px_1fr] gap-0">
              <div className="relative h-44 sm:h-full bg-black/40">
                <img
                  src={prizeTrophy}
                  alt="Troféu personalizado da temporada"
                  loading="lazy"
                  width={768}
                  height={512}
                  className="w-full h-full object-cover"
                />
              </div>
              <div className="p-5 flex flex-col justify-center">
                <div className="flex items-center gap-2 mb-2">
                  <Trophy className="w-5 h-5 text-gold" />
                  <span className="text-xs font-bold uppercase tracking-wider text-gold">Prêmio de Temporada</span>
                </div>
                <h3 className="font-orbitron text-xl sm:text-2xl font-black text-foreground">
                  Troféu Personalizado
                </h3>
                <p className="text-sm text-muted-foreground mt-2">
                  O <span className="text-foreground font-semibold">1º colocado no ranking</span> ao final da temporada
                  oficial recebe um <span className="text-gold font-semibold">troféu físico personalizado</span> com nome
                  e a estatística da temporada gravados.
                </p>
                <p className="text-xs text-muted-foreground/80 mt-2 italic">
                  Datas e duração da temporada serão anunciadas em breve.
                </p>
              </div>
            </div>
          </div>
        </motion.section>

        {/* Ranking Liga Mycroft (ROI%) */}
        <section className="max-w-2xl mx-auto w-full">
          <LigaMycroftLeaderboard />
        </section>

        {/* Showcase Grid */}
        <section className="space-y-6">
          <div className="text-center">
            <h3 className="font-orbitron text-xl text-muted-foreground">VITRINE DE PRÊMIOS</h3>
            <p className="text-xs text-muted-foreground/70 mt-1">
              Tabela oficial de resgate — acumule BC e troque quando o cofre abrir.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {prizes.map((prize, index) => {
              const Icon =
                prize.category === 'subscription'
                  ? prize.id === 5
                    ? Crown
                    : Calendar
                  : Gift;
              return (
                <motion.div
                  key={prize.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 0.85, y: 0 }}
                  transition={{ delay: 0.05 * index }}
                  whileHover={{ opacity: 1, scale: 1.02 }}
                  className="relative group cursor-pointer"
                >
                  <div className="rounded-xl bg-secondary/30 border border-border/50 overflow-hidden select-none transition-all duration-300 group-hover:border-gold/50 group-hover:shadow-lg group-hover:shadow-gold/10">
                    {/* Badge */}
                    <div className="absolute top-3 right-3 z-10 flex flex-col items-end gap-1.5">
                      <div className="bg-gold/90 text-background text-xs font-bold px-2 py-1 rounded">
                        EM BREVE
                      </div>
                      {prize.badge && (
                        <div className="bg-primary/90 text-primary-foreground text-[10px] font-bold px-2 py-0.5 rounded">
                          {prize.badge}
                        </div>
                      )}
                      {prize.premiumOnly && (
                        <div className="bg-gradient-to-r from-yellow-500 to-amber-500 text-background text-[10px] font-bold px-2 py-0.5 rounded flex items-center gap-1">
                          <Crown className="w-2.5 h-2.5" />
                          PREMIUM ONLY
                        </div>
                      )}
                    </div>

                    {/* Image */}
                    <div className="w-full h-40 overflow-hidden relative">
                      <img
                        src={prize.image}
                        alt={prize.name}
                        loading="lazy"
                        width={768}
                        height={512}
                        className="w-full h-full object-cover transition-all duration-500 group-hover:scale-110"
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-background/95 via-background/60 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-end justify-center p-4">
                        <p className="text-foreground/90 text-sm text-center font-medium">
                          {prize.description}
                        </p>
                      </div>
                    </div>

                    {/* Info */}
                    <div className="p-4 text-center transition-all duration-300">
                      <div className="flex items-center justify-center gap-1.5 mb-1">
                        <Icon className="w-3.5 h-3.5 text-gold/70 group-hover:text-gold" />
                        <h4 className="font-orbitron font-bold text-foreground/80 group-hover:text-foreground transition-colors text-sm">
                          {prize.name}
                        </h4>
                      </div>
                      <p className="text-gold/70 font-orbitron text-xs mt-1 group-hover:text-gold transition-colors">
                        Custo: {prize.price}
                      </p>
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </div>
        </section>

        {/* How to Earn BC */}
        <motion.section
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.4 }}
          className="text-center"
        >
          <Link to="/como-ganhar-bc">
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              className="
                w-full max-w-md mx-auto
                px-8 py-4 rounded-xl
                bg-gradient-to-r from-gold/20 to-amber-500/20
                border-2 border-gold/50 hover:border-gold
                text-gold
                font-orbitron font-bold text-lg
                flex items-center justify-center gap-3
                transition-all hover:shadow-lg hover:shadow-gold/20
              "
            >
              <Coins className="w-5 h-5" />
              COMO CONQUISTAR BLUFFCOINS
            </motion.button>
          </Link>
        </motion.section>

        {/* Locked CTA */}
        <motion.section
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.5 }}
          className="text-center pb-8"
        >
          <button
            onClick={handleRedeemClick}
            className="
              w-full max-w-md mx-auto
              px-8 py-4 rounded-xl
              bg-muted/50
              border border-border
              text-muted-foreground
              font-orbitron font-bold text-lg
              opacity-60 cursor-not-allowed
              flex items-center justify-center gap-3
              transition-all hover:opacity-80
            "
          >
            <Lock className="w-5 h-5" />
            {canRedeem ? 'LIBERAR RESGATE' : 'RESGATE EXCLUSIVO ASSINANTES'}
          </button>
          <p className="text-xs text-muted-foreground mt-3">
            {canRedeem
              ? 'O resgate será liberado quando a temporada oficial iniciar.'
              : 'Acumule BC agora e troque por prêmios após assinar um plano.'}
          </p>
        </motion.section>
      </main>
    </div>
  );
}
