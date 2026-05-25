import { useEffect, useState } from 'react';
import { Card, CardContent, CardFooter, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Check, Sparkles, Lock, Rocket, Info, Zap, Calendar, ArrowRight } from 'lucide-react';
import { motion } from 'framer-motion';
import { Badge } from '@/components/ui/badge';
import GoldButton from '@/components/game/GoldButton';
import { track } from '@/lib/analytics';
import { useAuth } from '@/hooks/useAuth';
import { UpsellModal } from '@/components/upsell/UpsellModal';
import { Link } from 'react-router-dom';

/**
 * Funil oficial (Day Pass → Upsell mensal recorrente):
 *  - Day Pass R$ 9,90 / 24h  → entrada via /day-pass (signup + Pix)
 *  - Mensal R$ 47 / mês       → assinatura recorrente Asaas (Pix mensal automático)
 *
 * Durante o trial cortesia, tudo é liberado. Após o trial, o acesso passa a
 * respeitar o plano contratado.
 */

declare global {
  interface Window {
    fbq?: (...args: any[]) => void;
  }
}

const DAY_PASS_INCLUDES = [
  'Acesso completo por 24 horas',
  'Arena Punter (sinais pré-jogo)',
  'Arena Live (Trader Sports ao vivo)',
  'Push e Telegram VIP',
  'Liquidações com ROI 7d / 30d',
  'Ideal para testar o sistema sem compromisso',
];

const MENSAL_INCLUDES = [
  'Tudo do Day Pass, sem expirar',
  'Arena Punter + Arena Live',
  'Asset Score, Kelly, Sherlock',
  'Banca Virtual e Banca Real (Betfair)',
  'Eventos Raros (LAY Goleada, 2x2…)',
  'Chat com o Mycroft em cada jogo',
  'Cobrança Pix mensal automática',
  'Cancele quando quiser — sem fidelidade',
];

export default function Paywall() {
  const { user } = useAuth();
  const [upsellOpen, setUpsellOpen] = useState(false);

  useEffect(() => {
    track.paywallViewed('paywall');
    if (typeof window !== 'undefined' && window.fbq) {
      window.fbq('track', 'ViewContent', {
        content_name: 'paywall',
        content_category: 'subscription',
        content_type: 'product_group',
        currency: 'BRL',
        value: 47,
      });
    }
  }, []);

  const trackDayPass = () => {
    track.checkoutInitiated('Day Pass', 9.9, 'paywall');
    if (window.fbq) {
      window.fbq('track', 'InitiateCheckout', { content_name: 'Day Pass', currency: 'BRL', value: 9.9 });
    }
  };

  const handleMensalClick = () => {
    track.checkoutInitiated('Mensal R$47', 47, 'paywall');
    if (window.fbq) {
      window.fbq('track', 'InitiateCheckout', { content_name: 'Mensal R$47', currency: 'BRL', value: 47 });
    }
    if (user) {
      setUpsellOpen(true);
    } else {
      // sem sessão: começa pelo Day Pass (signup + Pix), upsell entra depois no app
      window.location.href = '/day-pass?intent=monthly';
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
        className="relative z-10 w-full max-w-4xl space-y-8"
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
          <h1 className="text-3xl font-bold text-foreground">Comece pelo que faz sentido pra você 🎯</h1>
          <p className="text-muted-foreground max-w-2xl mx-auto">
            Teste o Oráculo Mycroft por <strong className="text-foreground">24 horas por R$ 9,90</strong>{' '}
            ou vá direto para a assinatura mensal recorrente por{' '}
            <strong className="text-foreground">R$ 47/mês</strong>. Cancele quando quiser.
          </p>
        </div>

        {/* Trial cortesia */}
        <div className="bg-primary/5 border border-primary/20 rounded-xl p-4 flex items-start gap-3">
          <Info className="w-5 h-5 text-primary shrink-0 mt-0.5" />
          <div className="text-sm text-muted-foreground">
            <p className="font-medium text-foreground mb-1">Sobre o seu trial</p>
            <p>
              Durante o trial gratuito,{' '}
              <strong className="text-foreground">todas as arenas ficam liberadas por cortesia</strong>.
              Quando o trial terminar, escolha entre o Day Pass (24h) ou a assinatura mensal.
            </p>
          </div>
        </div>

        {/* Plans (2 cards) */}
        <div className="grid md:grid-cols-2 gap-6">
          {/* DAY PASS */}
          <Card className="bg-card/80 backdrop-blur border-border/50 flex flex-col">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Calendar className="w-5 h-5 text-primary" />
                Day Pass
              </CardTitle>
              <CardDescription>Teste o sistema completo por 24h</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4 flex-1">
              <div>
                <span className="text-4xl font-bold text-foreground">R$ 9,90</span>
                <span className="text-muted-foreground text-sm">/24h</span>
                <p className="text-xs text-muted-foreground mt-1">Pagamento único via Pix</p>
              </div>
              <div>
                <p className="text-xs font-mono uppercase tracking-wider text-emerald-400 mb-2">
                  Está incluso
                </p>
                <ul className="space-y-1.5 text-sm">
                  {DAY_PASS_INCLUDES.map((item) => (
                    <li key={item} className="flex items-start gap-2 text-muted-foreground">
                      <Check className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </CardContent>
            <CardFooter>
              <Link to="/day-pass" className="w-full" onClick={trackDayPass}>
                <GoldButton variant="outline" className="w-full gap-2">
                  Começar Day Pass <ArrowRight className="w-4 h-4" />
                </GoldButton>
              </Link>
            </CardFooter>
          </Card>

          {/* MENSAL R$ 47 */}
          <Card className="bg-card/80 backdrop-blur relative flex flex-col border-primary/50 ring-1 ring-primary/30">
            <div className="absolute -top-3 left-1/2 -translate-x-1/2">
              <Badge className="bg-primary text-primary-foreground shadow-lg">MELHOR CUSTO</Badge>
            </div>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Rocket className="w-5 h-5 text-primary" />
                Mensal Recorrente
              </CardTitle>
              <CardDescription>Acesso contínuo com Pix mensal automático</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4 flex-1">
              <div>
                <span className="text-4xl font-bold text-foreground">R$ 47</span>
                <span className="text-muted-foreground text-sm">/mês</span>
                <p className="text-xs text-emerald-400 mt-1 font-medium">
                  Equivale a apenas R$ 1,57/dia
                </p>
              </div>
              <div>
                <p className="text-xs font-mono uppercase tracking-wider text-emerald-400 mb-2">
                  Está incluso
                </p>
                <ul className="space-y-1.5 text-sm">
                  {MENSAL_INCLUDES.map((item) => (
                    <li key={item} className="flex items-start gap-2 text-muted-foreground">
                      <Check className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </CardContent>
            <CardFooter>
              <GoldButton className="w-full gap-2" onClick={handleMensalClick}>
                <Sparkles className="w-4 h-4" />
                Assinar R$ 47/mês
              </GoldButton>
            </CardFooter>
          </Card>
        </div>

        {/* Como funciona o upsell */}
        <div className="bg-muted/20 border border-border/30 rounded-xl p-4 text-sm text-muted-foreground">
          <p className="flex items-center gap-2 font-medium text-foreground mb-1">
            <Zap className="w-4 h-4 text-primary" /> Como funciona
          </p>
          <p>
            Começou pelo Day Pass? Dentro do app você poderá converter para a mensal de R$ 47 a
            qualquer momento — sem perder o que já está rodando. Cobrança automática via Pix,
            cancele quando quiser pelo WhatsApp.
          </p>
        </div>

        {/* Guarantee */}
        <div className="text-center text-sm text-muted-foreground bg-muted/30 rounded-xl p-4 border border-border/30">
          <p className="font-medium text-foreground mb-1">✅ Garantia de 7 dias na mensal</p>
          <p>Não gostou? Cancele em até 7 dias e receba 100% do seu dinheiro de volta.</p>
        </div>
      </motion.div>

      {/* Modal de assinatura mensal (para usuários logados) */}
      <UpsellModal open={upsellOpen} onOpenChange={setUpsellOpen} trigger="4h" />
    </div>
  );
}
