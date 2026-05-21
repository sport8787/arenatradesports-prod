import { useEffect } from 'react';
import { Card, CardContent, CardFooter, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Check, Sparkles, TrendingUp, Trophy, Rocket, Flame, ArrowLeft, MessageCircle, Ticket, Spade, LineChart } from 'lucide-react';
import { motion } from 'framer-motion';
import { Badge } from '@/components/ui/badge';
import { useNavigate } from 'react-router-dom';
import GoldButton from '@/components/game/GoldButton';
import { track } from '@/lib/analytics';

const WHATSAPP_NUMBER = '5534991290648';
const waLink = (text: string) =>
  `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(text)}`;

const PLANS = [
  {
    name: 'Plano Iniciante',
    planKey: 'iniciante' as const,
    price: '49,90',
    icon: TrendingUp,
    description: 'Para quem está começando a apostar com método',
    includes: [
      'Arena Punter (sinais pré-jogo)',
      'Asset Score + Edge calculado',
      'Telegram VIP de sinais',
      'Push de novos sinais aprovados',
      'Suporte por WhatsApp',
    ],
    bonus: [
      'Arena Blackjack — estratégia básica + contagem Hi-Lo',
    ],
    waText: 'Olá! Tenho interesse no Plano Iniciante (R$ 49,90). Pode me explicar?',
    popular: false,
  },
  {
    name: 'Plano Profissional do Esporte',
    planKey: 'profissional' as const,
    price: '149,90',
    icon: Trophy,
    description: 'Pré-jogo + ao vivo. O combo dos apostadores sérios.',
    includes: [
      'Tudo do Iniciante',
      'Arena Trader Sports (ao vivo)',
      'LABAREDA, APROVADO e cash-out em tempo real',
      'Hórus coach IA anti-tilt',
      'Eventos Raros (LAY Goleada, 2x2…)',
      'Suporte prioritário WhatsApp',
    ],
    bonus: [
      'Arena Blackjack com Kelly Híbrido + Modo Ao Vivo',
    ],
    waText: 'Olá! Tenho interesse no Plano Profissional do Esporte (R$ 149,90). Pode me explicar?',
    popular: true,
  },
  {
    name: 'Plano Trading de Elite',
    planKey: 'elite' as const,
    price: '249,90',
    icon: Rocket,
    description: 'Para quem vive — ou quer viver — disso.',
    includes: [
      'Tudo do Profissional',
      'Gerador de Múltiplas (IA + Kelly)',
      'Banca Real Betfair integrada',
      'Chat Mycroft dentro de cada jogo',
      'Sherlock estatístico ilimitado',
      'Mentoria via WhatsApp',
    ],
    bonus: [
      'Arena Blackjack completa (todas as features)',
      'Arena Trader Financeiro (WIN / WDO / BTC)',
    ],
    waText: 'Olá! Tenho interesse no Plano Trading de Elite (R$ 249,90). Pode me explicar?',
    popular: false,
  },
];

declare global {
  interface Window {
    fbq?: (...args: any[]) => void;
  }
}

export default function OfertaEspecial() {
  const navigate = useNavigate();

  useEffect(() => {
    track.paywallViewed('oferta_especial');
  }, []);

  const handlePlanClick = (plan: typeof PLANS[0]) => {
    const price = parseFloat(plan.price.replace(',', '.'));
    track.checkoutInitiated(`${plan.name} - WhatsApp`, price, 'oferta_especial');
    if (window.fbq) {
      window.fbq('track', 'Lead', {
        content_name: plan.name,
        currency: 'BRL',
        value: price,
      });
    }
  };

  const handleDayPassClick = () => {
    track.checkoutInitiated('Day Pass 24h - WhatsApp', 9.9, 'oferta_especial');
    if (window.fbq) {
      window.fbq('track', 'Lead', {
        content_name: 'Day Pass 24h',
        currency: 'BRL',
        value: 9.9,
      });
    }
  };

  return (
    <div className="min-h-screen bg-background p-4 relative overflow-hidden">
      <div className="absolute inset-0 bg-gradient-to-b from-yellow-500/5 via-transparent to-primary/10" />
      <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-yellow-500/10 rounded-full blur-3xl animate-pulse" />
      <div className="absolute bottom-1/4 right-1/4 w-64 h-64 bg-primary/10 rounded-full blur-2xl" />

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="relative z-10 w-full max-w-6xl mx-auto py-6 space-y-8"
      >
        <button
          onClick={() => navigate(-1)}
          className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="w-4 h-4" /> Voltar
        </button>

        {/* Header */}
        <div className="text-center space-y-3">
          <motion.div
            initial={{ scale: 0.8 }}
            animate={{ scale: 1 }}
            className="inline-flex items-center justify-center w-20 h-20 bg-gradient-to-br from-yellow-500 to-yellow-600 rounded-2xl shadow-2xl shadow-yellow-500/30 mb-2"
          >
            <Flame className="w-10 h-10 text-black" />
          </motion.div>
          <Badge className="bg-yellow-500/20 text-yellow-400 border border-yellow-500/40 text-sm px-4 py-1">
            ⚡ INTELIGÊNCIA ARTIFICIAL PARA APOSTAS ESPORTIVAS
          </Badge>
          <h1 className="text-3xl lg:text-4xl font-bold text-foreground max-w-3xl mx-auto">
            Escolha seu <span className="text-yellow-400">plano</span> e pare de deixar dinheiro na mesa.
          </h1>
          <p className="text-muted-foreground max-w-2xl mx-auto">
            3 níveis pensados pra cada momento da sua jornada. Recomendamos{' '}
            <strong className="text-foreground">conversar primeiro com nosso especialista</strong>{' '}
            no WhatsApp para acertar o plano ideal pro seu perfil.
          </p>
        </div>

        {/* Plans */}
        <div className="grid md:grid-cols-3 gap-6">
          {PLANS.map((plan) => {
            const Icon = plan.icon;
            return (
              <Card
                key={plan.name}
                className={`bg-card/80 backdrop-blur relative flex flex-col ${
                  plan.popular ? 'border-yellow-500/60 ring-2 ring-yellow-500/30' : 'border-border/50'
                }`}
              >
                {plan.popular && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                    <Badge className="bg-yellow-500 text-black shadow-lg font-bold">MAIS ESCOLHIDO</Badge>
                  </div>
                )}
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-base">
                    <Icon className="w-5 h-5 text-yellow-400" />
                    {plan.name}
                  </CardTitle>
                  <CardDescription>{plan.description}</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4 flex-1">
                  <div>
                    <span className="text-3xl font-bold text-foreground">R$ {plan.price}</span>
                    <span className="text-muted-foreground text-sm">/mês</span>
                  </div>

                  <ul className="space-y-1.5 text-sm">
                    {plan.includes.map((item) => (
                      <li key={item} className="flex items-start gap-2 text-muted-foreground">
                        <Check className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
                        <span>{item}</span>
                      </li>
                    ))}
                  </ul>

                  {plan.bonus && plan.bonus.length > 0 && (
                    <div className="pt-3 mt-1 border-t border-yellow-500/20">
                      <div className="text-[10px] font-bold tracking-widest text-yellow-400/90 mb-2">
                        🎁 BÔNUS INCLUSOS
                      </div>
                      <ul className="space-y-1.5 text-sm">
                        {plan.bonus.map((item) => (
                          <li key={item} className="flex items-start gap-2 text-foreground/90">
                            <Sparkles className="w-4 h-4 text-yellow-400 shrink-0 mt-0.5" />
                            <span>{item}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </CardContent>
                <CardFooter>
                  <a
                    href={waLink(plan.waText)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="w-full"
                    onClick={() => handlePlanClick(plan)}
                  >
                    <button
                      className="w-full inline-flex items-center justify-center gap-2 px-4 py-3 rounded-lg font-semibold text-white bg-[#25D366] hover:bg-[#1faa54] transition-colors shadow-lg shadow-[#25D366]/20"
                    >
                      <MessageCircle className="w-4 h-4" />
                      Quero esse plano (WhatsApp)
                    </button>
                  </a>
                </CardFooter>
              </Card>
            );
          })}
        </div>

        {/* Day Pass strip */}
        <div className="rounded-2xl border border-yellow-500/40 bg-gradient-to-r from-yellow-500/10 via-yellow-500/5 to-transparent p-6 flex flex-col md:flex-row md:items-center gap-4">
          <div className="flex items-start gap-3 flex-1">
            <Ticket className="w-8 h-8 text-yellow-400 shrink-0 mt-1" />
            <div>
              <div className="text-lg font-bold text-foreground">
                🎟️ Quer testar antes de assinar?
              </div>
              <div className="text-sm text-muted-foreground mt-1">
                <strong className="text-foreground">Day Pass de 24h por apenas R$ 9,90</strong> —
                libera tudo (Punter + Trader Sports + Hórus). Solicite seu cupom pelo WhatsApp.
              </div>
            </div>
          </div>
          <a
            href={waLink('Olá! Quero o Day Pass de 24h por R$ 9,90.')}
            target="_blank"
            rel="noopener noreferrer"
            onClick={handleDayPassClick}
            className="shrink-0"
          >
            <button className="inline-flex items-center justify-center gap-2 px-5 py-3 rounded-lg font-semibold text-white bg-[#25D366] hover:bg-[#1faa54] transition-colors shadow-lg shadow-[#25D366]/20">
              <MessageCircle className="w-4 h-4" />
              Quero o Day Pass R$ 9,90
            </button>
          </a>
        </div>

        {/* Reassurance */}
        <div className="text-center text-sm text-muted-foreground bg-muted/30 rounded-xl p-4 border border-border/30 space-y-1">
          <p className="font-medium text-foreground">✅ Atendimento humano de verdade</p>
          <p>
            Fale com um especialista no WhatsApp antes de qualquer pagamento. Sem robô, sem enrolação.
          </p>
          <p className="text-xs text-muted-foreground/70 mt-2">
            Aviso de risco: apostas envolvem perda. Resultados passados não garantem futuros.
          </p>
        </div>
      </motion.div>
    </div>
  );
}
