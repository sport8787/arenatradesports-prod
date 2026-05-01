import { useEffect } from 'react';
import { Card, CardContent, CardFooter, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Check, X, Sparkles, TrendingUp, Trophy, Rocket, Flame, ArrowLeft, Info } from 'lucide-react';
import { motion } from 'framer-motion';
import { Badge } from '@/components/ui/badge';
import { useNavigate } from 'react-router-dom';
import GoldButton from '@/components/game/GoldButton';
import { track } from '@/lib/analytics';

/**
 * Mesma matriz do Paywall, com 50% OFF aplicado.
 * Planos alinhados ao banco: starter / base / premium.
 */
const PLANS = [
  {
    name: 'Starter',
    planKey: 'starter' as const,
    originalPrice: '99,90',
    price: '49,95',
    icon: TrendingUp,
    description: 'Só Arena Live (ao vivo)',
    includes: [
      'Arena Live (Trader Sports ao vivo)',
      'Sinais Mycroft em tempo real',
      'Push e Telegram VIP ao vivo',
      'Dashboard de jogos ao vivo',
      'Suporte por email',
    ],
    excludes: [
      'Arena Punter (sinais pré-jogo)',
      'Gerador de Múltiplas',
      'Banca Virtual e Banca Real',
      'Chat com o Mycroft em cada jogo',
    ],
    url: 'https://pay.kiwify.com.br/lcjBFYZ',
    popular: false,
  },
  {
    name: 'Basic',
    planKey: 'basic' as const,
    originalPrice: '99,90',
    price: '49,95',
    icon: Trophy,
    description: 'Só Arena Punter (pré-jogo)',
    includes: [
      'Arena Punter (sinais pré-jogo)',
      'Asset Score, Kelly e Sherlock',
      'Telegram VIP Pré-Live',
      'Liquidações com ROI 7d / 30d',
      'Push de novos sinais aprovados',
      'Suporte por email',
    ],
    excludes: [
      'Arena Live (Trader Sports ao vivo)',
      'Gerador de Múltiplas',
      'Banca Virtual e Banca Real',
      'Chat com o Mycroft em cada jogo',
    ],
    url: 'https://pay.kiwify.com.br/lcjBFYZ',
    popular: false,
  },
  {
    name: 'Base',
    planKey: 'base' as const,
    originalPrice: '149,90',
    price: '74,95',
    icon: Trophy,
    description: 'Live + Punter (mais escolhido)',
    includes: [
      'Arena Live + Arena Punter (Starter + Basic juntos)',
      'Arena Punter (sinais pré-jogo)',
      'Asset Score, Kelly, Sherlock',
      'Telegram VIP Pré-Live',
      'Liquidações com ROI 7d / 30d',
      'Suporte prioritário',
    ],
    excludes: [
      'Gerador de Múltiplas',
      'Banca Virtual e Banca Real',
      'Chat com o Mycroft em cada jogo',
    ],
    url: 'https://pay.kiwify.com.br/stAtq0L',
    popular: true,
  },
  {
    name: 'Premium',
    planKey: 'premium' as const,
    originalPrice: '199,90',
    price: '99,95',
    icon: Rocket,
    description: 'Tudo liberado + Chat Mycroft',
    includes: [
      'Tudo do Base +',
      'Gerador de Múltiplas (IA + Kelly)',
      'Banca Virtual e Banca Real (Betfair)',
      'Chat com o Mycroft em cada jogo',
      'Eventos Raros (LAY Goleada, 2x2…)',
      'Suporte 24/7',
    ],
    excludes: [],
    url: 'https://pay.kiwify.com.br/cKhGSCD',
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
    track.checkoutInitiated(`${plan.name} - 50% OFF`, price, 'oferta_especial');
    if (window.fbq) {
      window.fbq('track', 'InitiateCheckout', {
        content_name: `${plan.name} - 50% OFF`,
        currency: 'BRL',
        value: price,
      });
    }
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4 relative overflow-hidden">
      <div className="absolute inset-0 bg-gradient-to-b from-red-500/10 via-transparent to-primary/10" />
      <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-red-500/10 rounded-full blur-3xl animate-pulse" />
      <div className="absolute bottom-1/4 right-1/4 w-64 h-64 bg-primary/10 rounded-full blur-2xl" />

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="relative z-10 w-full max-w-6xl space-y-8"
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
            className="inline-flex items-center justify-center w-20 h-20 bg-gradient-to-br from-red-500 to-orange-500 rounded-2xl shadow-2xl shadow-red-500/30 mb-2"
          >
            <Flame className="w-10 h-10 text-white" />
          </motion.div>
          <Badge className="bg-red-500/20 text-red-400 border border-red-500/40 text-sm px-4 py-1">
            🔥 OFERTA EXCLUSIVA — POR TEMPO LIMITADO
          </Badge>
          <h1 className="text-3xl lg:text-4xl font-bold text-foreground">
            Não Vá Embora Ainda. <span className="text-red-400">50% OFF</span> Pra Você Ficar.
          </h1>
          <p className="text-muted-foreground max-w-2xl mx-auto">
            Sabemos que o trial acabou. Por isso, liberamos um desconto de{' '}
            <strong className="text-red-400">50%</strong> em qualquer plano — só hoje, só pra você.
          </p>
        </div>

        {/* Trial cortesia */}
        <div className="bg-primary/5 border border-primary/20 rounded-xl p-4 flex items-start gap-3">
          <Info className="w-5 h-5 text-primary shrink-0 mt-0.5" />
          <div className="text-sm text-muted-foreground">
            <p className="font-medium text-foreground mb-1">O que muda do trial para o plano pago</p>
            <p>
              Durante o trial você teve <strong className="text-foreground">todas as arenas
              liberadas por cortesia</strong>. A partir de agora o acesso passa a respeitar o
              plano que você escolher abaixo. Cada plano deixa explícito o que inclui e o que não inclui.
            </p>
          </div>
        </div>

        {/* Plans */}
        <div className="grid md:grid-cols-3 gap-6">
          {PLANS.map((plan) => {
            const Icon = plan.icon;
            return (
              <Card
                key={plan.name}
                className={`bg-card/80 backdrop-blur relative flex flex-col ${
                  plan.popular ? 'border-primary/50 ring-2 ring-primary/30' : 'border-border/50'
                }`}
              >
                {plan.popular && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                    <Badge className="bg-primary text-primary-foreground shadow-lg">MAIS ESCOLHIDO</Badge>
                  </div>
                )}
                <div className="absolute -top-3 right-3">
                  <Badge className="bg-red-500 text-white shadow-lg">-50%</Badge>
                </div>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Icon className="w-5 h-5 text-primary" />
                    {plan.name}
                  </CardTitle>
                  <CardDescription>{plan.description}</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4 flex-1">
                  <div className="space-y-1">
                    <div className="text-sm text-muted-foreground line-through">
                      De R$ {plan.originalPrice}/mês
                    </div>
                    <div>
                      <span className="text-3xl font-bold text-red-400">R$ {plan.price}</span>
                      <span className="text-muted-foreground text-sm">/mês</span>
                    </div>
                  </div>

                  <div>
                    <p className="text-xs font-mono uppercase tracking-wider text-emerald-400 mb-2">
                      Está incluso
                    </p>
                    <ul className="space-y-1.5 text-sm">
                      {plan.includes.map((item) => (
                        <li key={item} className="flex items-start gap-2 text-muted-foreground">
                          <Check className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
                          <span>{item}</span>
                        </li>
                      ))}
                    </ul>
                  </div>

                  {plan.excludes.length > 0 && (
                    <div>
                      <p className="text-xs font-mono uppercase tracking-wider text-muted-foreground/70 mb-2">
                        Não está incluso
                      </p>
                      <ul className="space-y-1.5 text-sm">
                        {plan.excludes.map((item) => (
                          <li key={item} className="flex items-start gap-2 text-muted-foreground/60">
                            <X className="w-4 h-4 text-muted-foreground/50 shrink-0 mt-0.5" />
                            <span className="line-through decoration-muted-foreground/30">{item}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </CardContent>
                <CardFooter>
                  <a
                    href={plan.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="w-full"
                    onClick={() => handlePlanClick(plan)}
                  >
                    {plan.popular ? (
                      <GoldButton className="w-full gap-2">
                        <Sparkles className="w-4 h-4" />
                        Garantir 50% OFF
                      </GoldButton>
                    ) : (
                      <GoldButton variant="outline" className="w-full">
                        Garantir 50% OFF
                      </GoldButton>
                    )}
                  </a>
                </CardFooter>
              </Card>
            );
          })}
        </div>

        {/* Guarantee */}
        <div className="text-center text-sm text-muted-foreground bg-muted/30 rounded-xl p-4 border border-border/30">
          <p className="font-medium text-foreground mb-1">✅ Garantia de 7 dias</p>
          <p>Não gostou? Cancele em até 7 dias e receba 100% do seu dinheiro de volta.</p>
        </div>
      </motion.div>
    </div>
  );
}
