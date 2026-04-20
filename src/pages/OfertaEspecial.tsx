import { useEffect } from 'react';
import { Card, CardContent, CardFooter, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Check, Sparkles, TrendingUp, Trophy, Rocket, Flame, ArrowLeft } from 'lucide-react';
import { motion } from 'framer-motion';
import { Badge } from '@/components/ui/badge';
import { useNavigate } from 'react-router-dom';
import GoldButton from '@/components/game/GoldButton';
import { track } from '@/lib/analytics';

const PLANS = [
  {
    name: 'Starter',
    originalPrice: '99,90',
    price: '49,95',
    icon: TrendingUp,
    description: 'Para começar a investir',
    features: [
      'Mycroft IA (Asset Score básico)',
      'Até 50 posições/mês',
      'Dashboard completo',
      'Track record auditável',
      'Suporte por email',
    ],
    url: 'https://pay.kiwify.com.br/lcjBFYZ',
    popular: false,
  },
  {
    name: 'Professional',
    originalPrice: '199,90',
    price: '99,95',
    icon: Trophy,
    description: 'Mais popular',
    features: [
      'Tudo do Starter +',
      'Hórus IA (proteção tilt)',
      'Posições ilimitadas',
      'Dual Bankroll',
      'Sharp Money Detector',
      'Garantia Dobro',
      'Suporte prioritário',
    ],
    url: 'https://pay.kiwify.com.br/stAtq0L',
    popular: true,
  },
  {
    name: 'Enterprise',
    originalPrice: '299,90',
    price: '149,95',
    icon: Rocket,
    description: 'Tudo liberado + Chat com Mycroft',
    features: [
      'Tudo do Professional +',
      'Arena Trader Sports completa',
      'Chat com Mycroft em cada jogo',
      'API access completa',
      'Auto-execution (bot)',
      'Self Learning Engine',
      'Suporte 24/7',
      'Consultoria mensal',
    ],
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
        className="relative z-10 w-full max-w-5xl space-y-8"
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
            Sabemos que o trial acabou. Por isso, liberamos um desconto de <strong className="text-red-400">50%</strong> em
            qualquer plano — só hoje, só pra você. Continue treinando, continue ganhando.
          </p>
        </div>

        {/* Plans */}
        <div className="grid md:grid-cols-3 gap-6">
          {PLANS.map((plan) => {
            const Icon = plan.icon;
            return (
              <Card
                key={plan.name}
                className={`bg-card/80 backdrop-blur relative ${
                  plan.popular ? 'border-primary/50 ring-2 ring-primary/30' : 'border-border/50'
                }`}
              >
                {plan.popular && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                    <Badge className="bg-primary text-primary-foreground shadow-lg">MAIS POPULAR</Badge>
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
                <CardContent className="space-y-4">
                  <div className="space-y-1">
                    <div className="text-sm text-muted-foreground line-through">
                      De R$ {plan.originalPrice}/mês
                    </div>
                    <div>
                      <span className="text-3xl font-bold text-red-400">R$ {plan.price}</span>
                      <span className="text-muted-foreground text-sm">/mês</span>
                    </div>
                  </div>
                  <ul className="space-y-2 text-sm">
                    {plan.features.map((item) => (
                      <li key={item} className="flex items-start gap-2 text-muted-foreground">
                        <Check className="w-4 h-4 text-green-500 shrink-0 mt-0.5" />
                        <span>{item}</span>
                      </li>
                    ))}
                  </ul>
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
