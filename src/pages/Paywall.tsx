import { Card, CardContent, CardFooter, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Check, Sparkles, TrendingUp, Trophy, Lock, Rocket } from 'lucide-react';
import { motion } from 'framer-motion';
import { Badge } from '@/components/ui/badge';
import GoldButton from '@/components/game/GoldButton';

const PLANS = [
  {
    name: 'Starter',
    price: '99,90',
    icon: TrendingUp,
    description: 'Para começar a investir',
    features: ['Mycroft IA (Asset Score básico)', 'Até 50 posições/mês', 'Dashboard completo', 'Track record auditável', 'Suporte por email'],
    url: 'https://pay.kiwify.com.br/5lryTVK',
    popular: false,
  },
  {
    name: 'Professional',
    price: '199,90',
    icon: Trophy,
    description: 'Mais popular',
    features: ['Tudo do Starter +', 'Hórus IA (proteção tilt)', 'Posições ilimitadas', 'Dual Bankroll', 'Sharp Money Detector', 'Garantia Dobro', 'Suporte prioritário'],
    url: 'https://pay.kiwify.com.br/O4zEN7O',
    popular: true,
  },
  {
    name: 'Enterprise',
    price: '299,90',
    icon: Rocket,
    description: 'Para profissionais',
    features: ['Tudo do Professional +', 'API access completa', 'Auto-execution (bot)', 'Portfolio Optimization', 'Self Learning Engine', 'Integração Fullbet', 'Suporte 24/7', 'Consultoria mensal'],
    url: 'https://pay.kiwify.com.br/OAo5rId',
    popular: false,
  },
];

declare global {
  interface Window {
    fbq?: (...args: any[]) => void;
  }
}

export default function Paywall() {
  const handlePlanClick = (plan: typeof PLANS[0]) => {
    // Meta Pixel - InitiateCheckout
    if (window.fbq) {
      window.fbq('track', 'InitiateCheckout', {
        content_name: plan.name,
        currency: 'BRL',
        value: parseFloat(plan.price.replace(',', '.')),
      });
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
          <h1 className="text-3xl font-bold text-foreground">Seu Trial Acabou! 🎯</h1>
          <p className="text-muted-foreground">Continue treinando. Escolha seu plano.</p>
        </div>

        {/* What you lose */}
        <div className="bg-destructive/5 border border-destructive/20 rounded-xl p-4 text-center space-y-2">
          <p className="text-sm font-semibold text-destructive">⏰ Você perde acesso a:</p>
          <div className="flex flex-wrap justify-center gap-2 text-xs text-muted-foreground">
            <Badge variant="outline" className="border-destructive/30">Sinais Mycroft ao vivo</Badge>
            <Badge variant="outline" className="border-destructive/30">Análises forenses</Badge>
            <Badge variant="outline" className="border-destructive/30">Modo Treino ilimitado</Badge>
            <Badge variant="outline" className="border-destructive/30">Alertas prioritários</Badge>
          </div>
        </div>

        {/* Plans */}
        <div className="grid md:grid-cols-3 gap-6">
          {PLANS.map((plan) => {
            const Icon = plan.icon;
            return (
              <Card key={plan.name} className={`bg-card/80 backdrop-blur relative ${plan.popular ? 'border-primary/50' : 'border-border/50'}`}>
                {plan.popular && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                    <Badge className="bg-primary text-primary-foreground shadow-lg">MAIS POPULAR</Badge>
                  </div>
                )}
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Icon className="w-5 h-5 text-primary" />
                    {plan.name}
                  </CardTitle>
                  <CardDescription>{plan.description}</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <span className="text-3xl font-bold text-foreground">R$ {plan.price}</span>
                    <span className="text-muted-foreground text-sm">/mês</span>
                  </div>
                  <ul className="space-y-2 text-sm">
                    {plan.features.map((item) => (
                      <li key={item} className="flex items-center gap-2 text-muted-foreground">
                        <Check className="w-4 h-4 text-green-500 shrink-0" />
                        {item}
                      </li>
                    ))}
                  </ul>
                </CardContent>
                <CardFooter>
                  <a href={plan.url} target="_blank" rel="noopener noreferrer" className="w-full" onClick={() => handlePlanClick(plan)}>
                    {plan.popular ? (
                      <GoldButton className="w-full gap-2">
                        <Sparkles className="w-4 h-4" />
                        Assinar Agora
                      </GoldButton>
                    ) : (
                      <GoldButton variant="outline" className="w-full">Assinar Agora</GoldButton>
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
