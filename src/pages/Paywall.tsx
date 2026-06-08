import { useEffect, useState } from 'react';
import { Card, CardContent, CardFooter, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Check, Sparkles, Lock, Rocket, Info, Zap, Calendar, ArrowRight, Crown, Star } from 'lucide-react';
import { motion } from 'framer-motion';
import { Badge } from '@/components/ui/badge';
import GoldButton from '@/components/game/GoldButton';
import { track } from '@/lib/analytics';
import { useAuth } from '@/hooks/useAuth';
import { Link } from 'react-router-dom';

/**
 * Paywall v2 — planos padronizados:
 *  - Day Pass R$ 9,90 / 24h  → entrada via /day-pass
 *  - Plano Promo R$ 47,90/mês → acumula BC mas não resgata prêmios
 *  - Plano Iniciante R$ 87,90/mês → 1 arena + Liga Mycroft com resgate
 *  - Plano Profissional R$ 147,00/mês → 2 arenas + Ciclos + Meu Método
 *  - Plano Elite R$ 249,90/mês → tudo + Chat AO VIVO + 1.3× BC
 */

declare global {
  interface Window {
    fbq?: (...args: any[]) => void;
  }
}

const DAY_PASS_INCLUDES = [
  'Arena Punter (análises pré-jogo)',
  'Arena Live — Trader Sports ao vivo',
  'Hórus — bets virtuais automáticos',
  'Chat Mycroft ao vivo dentro de cada jogo',
  'Criação de Métodos personalizados',
  'Alavancagem + Sinais Alavanca',
  'Asset Score, Kelly, Sherlock',
  'Eventos Raros (LAY Goleada, 2x2…)',
  'Notificações push e Telegram VIP',
  'Ideal para testar tudo antes de escolher um plano',
];

const PLANS = [
  {
    id: 'iniciante',
    icon: Star,
    name: 'Plano Iniciante',
    price: 'R$ 87,90',
    per: '/mês',
    tagline: '1 arena à sua escolha',
    badge: null,
    color: 'border-border/50',
    features: [
      'Arena Punter OU Arena Live (você escolhe)',
      'Análises pré-jogo do Mycroft prontas',
      'Asset Score + Edge calculado',
      'Canal de novas análises',
      'Notificações push de análises aprovadas',
      'Grupo dos Fundadores',
      'Liga Mycroft — resgate prêmios reais com BC',
    ],
    waLink: 'https://wa.me/5534991290648?text=Ol%C3%A1!%20Tenho%20interesse%20no%20Plano%20Iniciante.',
    cta: 'Assinar Iniciante',
  },
  {
    id: 'profissional',
    icon: Rocket,
    name: 'Plano Profissional',
    price: 'R$ 147,00',
    per: '/mês',
    tagline: '2 arenas + ferramentas avançadas',
    badge: 'MAIS POPULAR',
    color: 'border-primary/50 ring-1 ring-primary/30',
    features: [
      'Tudo do Iniciante +',
      'Arena Trader Sports (análise ao vivo)',
      '🚀 Método dos Ciclos — gestão em estágios',
      '🛠️ Criação de métodos personalizados (Meu Método)',
      'Status dinâmicos: APROVADO, LABAREDA, cash-out',
      'Eventos Raros (LAY Goleada, 2x2…)',
      'Suporte prioritário WhatsApp',
    ],
    waLink: 'https://wa.me/5534991290648?text=Ol%C3%A1!%20Tenho%20interesse%20no%20Plano%20Profissional.',
    cta: 'Assinar Profissional',
  },
  {
    id: 'elite',
    icon: Crown,
    name: 'Plano Elite',
    price: 'R$ 249,90',
    per: '/mês',
    tagline: 'Mycroft ao vivo em cada jogo',
    badge: 'ELITE',
    color: 'border-yellow-500/40 ring-1 ring-yellow-500/20',
    features: [
      'Tudo do Profissional +',
      '💬 Chat Mycroft AO VIVO em cada jogo',
      'Integração com Exchange (acompanhamento de banca)',
      'Gerador de Múltiplas (IA + Kelly)',
      'Sherlock estatístico ilimitado',
      'Bônus: Trader Financeiro Beta (WIN/WDO/BTC)',
      'Mentoria via WhatsApp',
      '🏆 Multiplicador 1.3× de BluffCoins',
    ],
    waLink: 'https://wa.me/5534991290648?text=Ol%C3%A1!%20Tenho%20interesse%20no%20Plano%20Elite.',
    cta: 'Assinar Elite',
  },
];

export default function Paywall() {
  const { user } = useAuth();

  useEffect(() => {
    track.paywallViewed('paywall');
    if (typeof window !== 'undefined' && window.fbq) {
      window.fbq('track', 'ViewContent', {
        content_name: 'paywall',
        content_category: 'subscription',
        content_type: 'product_group',
        currency: 'BRL',
        value: 87.9,
      });
    }
  }, []);

  const trackPlan = (name: string, price: number) => {
    track.checkoutInitiated(name, price, 'paywall');
    if (window.fbq) {
      window.fbq('track', 'InitiateCheckout', { content_name: name, currency: 'BRL', value: price });
    }
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4 relative overflow-hidden">
      <div className="absolute inset-0 bg-gradient-to-b from-primary/5 via-transparent to-primary/10" />
      <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-primary/10 rounded-full blur-3xl" />
      <div className="absolute bottom-1/4 right-1/4 w-64 h-64 bg-primary/5 rounded-full blur-2xl" />

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="relative z-10 w-full max-w-5xl space-y-8"
      >
        {/* Header */}
        <div className="text-center space-y-3">
          <motion.div
            initial={{ scale: 0.8 }}
            animate={{ scale: 1 }}
            className="inline-flex items-center justify-center w-20 h-20 bg-gradient-to-br from-destructive/80 to-destructive/40 rounded-2xl shadow-2xl shadow-destructive/20 mb-2"
          >
            <Lock className="w-10 h-10 text-destructive-foreground" />
          </motion.div>
          <h1 className="text-3xl font-bold text-foreground">Escolha seu plano 🎯</h1>
          <p className="text-muted-foreground max-w-2xl mx-auto">
            Teste por <strong className="text-foreground">24h por R$ 9,90</strong>, ou escolha um plano mensal.
            Cancele quando quiser, sem fidelidade.
          </p>
        </div>

        {/* Trial notice */}
        <div className="bg-primary/5 border border-primary/20 rounded-xl p-4 flex items-start gap-3">
          <Info className="w-5 h-5 text-primary shrink-0 mt-0.5" />
          <div className="text-sm text-muted-foreground">
            <p className="font-medium text-foreground mb-1">Sobre o trial gratuito</p>
            <p>
              Durante o trial, <strong className="text-foreground">todas as arenas ficam liberadas por cortesia</strong>.
              Ao expirar, escolha o plano que melhor se encaixa no seu perfil.
            </p>
          </div>
        </div>

        {/* Day Pass */}
        <div className="rounded-2xl border border-yellow-500/40 bg-gradient-to-r from-yellow-500/10 via-yellow-500/5 to-transparent p-5 flex flex-col md:flex-row md:items-center gap-4">
          <div className="flex items-start gap-3 flex-1">
            <div className="w-12 h-12 rounded-xl bg-yellow-500/20 border border-yellow-500/40 flex items-center justify-center shrink-0">
              <span className="text-2xl">🎟️</span>
            </div>
            <div>
              <div className="flex items-center gap-2">
                <div className="text-lg font-bold text-foreground">Day Pass — R$ 9,90</div>
                <Badge variant="outline" className="text-yellow-400 border-yellow-400/40 text-[10px]">24H</Badge>
              </div>
              <div className="text-sm text-muted-foreground mt-1">
                Libera <strong className="text-foreground">tudo</strong> por 24 horas — igual ao Plano Elite, mas por um dia. A forma mais barata de conhecer o sistema na prática.
              </div>
              <ul className="mt-2 grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-0.5">
                {DAY_PASS_INCLUDES.map((item) => (
                  <li key={item} className="flex items-start gap-1.5 text-xs text-muted-foreground">
                    <Check className="w-3 h-3 text-emerald-500 shrink-0 mt-0.5" />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
          <Link to="/day-pass" className="shrink-0" onClick={() => trackPlan('Day Pass', 9.9)}>
            <GoldButton variant="outline" className="gap-2 whitespace-nowrap">
              Começar Day Pass <ArrowRight className="w-4 h-4" />
            </GoldButton>
          </Link>
        </div>

        {/* Planos mensais */}
        <div>
          <p className="text-center text-xs font-mono uppercase tracking-widest text-muted-foreground mb-6">
            — Planos mensais recorrentes —
          </p>
          <div className="grid md:grid-cols-3 gap-6">
            {PLANS.map((plan, index) => {
              const Icon = plan.icon;
              const priceNum = parseFloat(plan.price.replace('R$ ', '').replace(',', '.'));
              return (
                <motion.div
                  key={plan.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.1 }}
                >
                  <Card className={`bg-card/80 backdrop-blur flex flex-col relative ${plan.color}`}>
                    {plan.badge && (
                      <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                        <Badge className={`shadow-lg ${plan.id === 'elite' ? 'bg-yellow-500 text-black' : 'bg-primary text-primary-foreground'}`}>
                          {plan.badge}
                        </Badge>
                      </div>
                    )}
                    <CardHeader className="pt-6">
                      <CardTitle className="flex items-center gap-2">
                        <Icon className={`w-5 h-5 ${plan.id === 'elite' ? 'text-yellow-400' : 'text-primary'}`} />
                        {plan.name}
                      </CardTitle>
                      <CardDescription>{plan.tagline}</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4 flex-1">
                      <div>
                        <span className="text-4xl font-bold text-foreground">{plan.price}</span>
                        <span className="text-muted-foreground text-sm">{plan.per}</span>
                        <p className="text-xs text-muted-foreground mt-1">Cobrança via Pix ou cartão</p>
                      </div>
                      <ul className="space-y-1.5 text-sm">
                        {plan.features.map((item) => (
                          <li key={item} className="flex items-start gap-2 text-muted-foreground">
                            <Check className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
                            <span>{item}</span>
                          </li>
                        ))}
                      </ul>
                    </CardContent>
                    <CardFooter>
                      <a
                        href={plan.waLink}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="w-full"
                        onClick={() => trackPlan(plan.name, priceNum)}
                      >
                        {plan.id === 'profissional' ? (
                          <GoldButton className="w-full gap-2">
                            <Sparkles className="w-4 h-4" />
                            {plan.cta}
                          </GoldButton>
                        ) : (
                          <GoldButton variant="outline" className="w-full gap-2">
                            {plan.cta} <ArrowRight className="w-4 h-4" />
                          </GoldButton>
                        )}
                      </a>
                    </CardFooter>
                  </Card>
                </motion.div>
              );
            })}
          </div>
        </div>

        {/* Plano Promo note */}
        <div className="bg-muted/20 border border-border/30 rounded-xl p-4 text-sm text-muted-foreground">
          <p className="flex items-center gap-2 font-medium text-foreground mb-1">
            <Zap className="w-4 h-4 text-primary" /> Plano Promo R$ 47,90/mês
          </p>
          <p>
            Já assina o Plano Promo? Você tem acesso às 2 arenas no modo simples e <strong className="text-foreground">acumula BluffCoins</strong>.
            Para resgatar prêmios na Liga Mycroft, faça upgrade para o Plano Iniciante. Fale com a gente pelo WhatsApp para migrar.
          </p>
        </div>

        {/* Guarantee */}
        <div className="text-center text-sm text-muted-foreground bg-muted/30 rounded-xl p-4 border border-border/30">
          <p className="font-medium text-foreground mb-1">✅ Garantia de 7 dias em qualquer plano mensal</p>
          <p>Não gostou? Cancele em até 7 dias e receba 100% do seu dinheiro de volta.</p>
        </div>
      </motion.div>
    </div>
  );
}
