import { Button } from '@/components/ui/button';
import { Card, CardContent, CardFooter, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Check, Sparkles, TrendingUp, Trophy, Lock } from 'lucide-react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Badge } from '@/components/ui/badge';

export default function Paywall() {
  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4 relative overflow-hidden">
      {/* Background effects */}
      <div className="absolute inset-0 bg-gradient-to-b from-primary/5 via-transparent to-primary/10" />
      <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-primary/10 rounded-full blur-3xl" />
      <div className="absolute bottom-1/4 right-1/4 w-64 h-64 bg-primary/5 rounded-full blur-2xl" />

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="relative z-10 w-full max-w-3xl space-y-8"
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
        <div className="grid md:grid-cols-2 gap-6">
          {/* BASE */}
          <Card className="bg-card/80 backdrop-blur border-border/50">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <TrendingUp className="w-5 h-5 text-primary" />
                Arena Trader
              </CardTitle>
              <CardDescription>Simulador financeiro completo</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <span className="text-3xl font-bold text-foreground">R$ 49,90</span>
                <span className="text-muted-foreground text-sm">/mês</span>
                <p className="text-xs text-green-500 mt-1">50% OFF (normal R$ 99)</p>
              </div>
              <ul className="space-y-2 text-sm">
                {['Simulações ilimitadas', 'Mycroft + Hórus IA', 'Modo Treino ilimitado', 'Ranking competitivo'].map((item) => (
                  <li key={item} className="flex items-center gap-2 text-muted-foreground">
                    <Check className="w-4 h-4 text-green-500 shrink-0" />
                    {item}
                  </li>
                ))}
              </ul>
            </CardContent>
            <CardFooter>
              <Link to="/upgrade?plan=base" className="w-full">
                <Button variant="outline" className="w-full">Assinar Agora</Button>
              </Link>
            </CardFooter>
          </Card>

          {/* PREMIUM */}
          <Card className="bg-card/80 backdrop-blur border-primary/50 relative">
            <div className="absolute -top-3 left-1/2 -translate-x-1/2">
              <Badge className="bg-primary text-primary-foreground shadow-lg">MAIS POPULAR</Badge>
            </div>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Trophy className="w-5 h-5 text-yellow-500" />
                Arena Premium
              </CardTitle>
              <CardDescription>Acesso total + recursos exclusivos</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <span className="text-3xl font-bold text-foreground">R$ 79,80</span>
                <span className="text-muted-foreground text-sm">/mês</span>
                <p className="text-xs text-green-500 mt-1">Economize R$ 20/mês</p>
              </div>
              <ul className="space-y-2 text-sm">
                {['Tudo do plano Base', '+ Análise avançada IA', 'Replay de sessões', 'Suporte prioritário', 'Acesso antecipado a novidades'].map((item) => (
                  <li key={item} className="flex items-center gap-2 text-muted-foreground">
                    <Check className="w-4 h-4 text-green-500 shrink-0" />
                    {item}
                  </li>
                ))}
              </ul>
            </CardContent>
            <CardFooter>
              <Link to="/upgrade?plan=premium" className="w-full">
                <Button className="w-full bg-gradient-to-r from-primary to-primary/80 gap-2">
                  <Sparkles className="w-4 h-4" />
                  Assinar Premium
                </Button>
              </Link>
            </CardFooter>
          </Card>
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
