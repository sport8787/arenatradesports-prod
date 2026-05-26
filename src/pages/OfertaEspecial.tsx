import { useEffect } from 'react';
import { Card, CardContent, CardFooter, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Check, Sparkles, TrendingUp, Trophy, Rocket, Flame, ArrowLeft, MessageCircle, Ticket, Spade, LineChart } from 'lucide-react';
import { motion } from 'framer-motion';
import { Badge } from '@/components/ui/badge';
import { useNavigate } from 'react-router-dom';
import GoldButton from '@/components/game/GoldButton';
import { track } from '@/lib/analytics';
import { fireAdsConversion } from '@/lib/googleAds';
import HouseEdgeEducation, { ComunicadoImportante } from '@/components/landing/HouseEdgeEducation';
import AgeDisclaimerBanner from '@/components/landing/AgeDisclaimerBanner';

const WHATSAPP_NUMBER = '5534991290648';
const waLink = (text: string) =>
  `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(text)}`;

const PLANS = [
  {
    name: 'Plano Iniciante',
    planKey: 'iniciante' as const,
    price: '49,90',
    icon: TrendingUp,
    description: 'Para quem quer seguir os métodos globais prontos do Mycroft',
    includes: [
      'Arena Punter (análises pré-jogo prontas)',
      'Métodos globais do Mycroft já calibrados',
      'Asset Score + Edge calculado',
      'Canal VIP de novas análises',
      'Notificações push de novas análises aprovadas',
      'Suporte por WhatsApp',
    ],
    bonus: [
      'Módulo educacional de Blackjack — estratégia básica + Hi-Lo',
    ],
    waText: 'Olá! Tenho interesse no Plano Iniciante (R$ 49,90). Pode me explicar?',
    popular: false,
  },
  {
    name: 'Plano Profissional do Esporte',
    planKey: 'profissional' as const,
    price: '149,90',
    icon: Trophy,
    description: 'Crie seus próprios métodos com gestão de banca em ciclos.',
    includes: [
      'Tudo do Iniciante',
      'Arena Trader Sports (ao vivo)',
      '🚀 Método dos Ciclos — gestão de banca em estágios definidos',
      '🛠️ Criação de métodos personalizados (Meu Método)',
      'Status dinâmicos: LABAREDA, APROVADO e cash-out em tempo real',
      'Hórus coach IA anti-tilt',
      'Eventos Raros (LAY Goleada, 2x2…)',
      'Suporte prioritário WhatsApp',
    ],
    bonus: [
      'Módulo Blackjack com Kelly Híbrido + Modo Ao Vivo',
    ],
    waText: 'Olá! Tenho interesse no Plano Profissional do Esporte (R$ 149,90). Pode me explicar?',
    popular: true,
  },
  {
    name: 'Plano Trading de Elite',
    planKey: 'elite' as const,
    price: '249,90',
    icon: Rocket,
    description: 'Mycroft no seu ouvido em tempo real dentro de cada jogo.',
    includes: [
      'Tudo do Profissional',
      '💬 Chat Mycroft AO VIVO dentro de cada jogo (Cash Out assistido)',
      'Integração com Exchange para acompanhamento de banca',
      'Gerador de Múltiplas (IA + Kelly)',
      'Sherlock estatístico ilimitado',
      'Mentoria via WhatsApp',
    ],
    bonus: [
      'Módulo Blackjack completo (todas as features)',
      'Arena Trader Financeiro — Beta (WIN / WDO / BTC, em calibração)',
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
    fireAdsConversion(price);
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
    fireAdsConversion(9.9);
  };

  return (
    <>
      <AgeDisclaimerBanner />
      <div className="oferta-light min-h-screen bg-white text-slate-900 p-4 relative overflow-hidden">
      <style>{`
        .oferta-light, .oferta-light * { color: #0f172a; }
        .oferta-light .text-muted-foreground { color: #475569 !important; }
        .oferta-light .text-foreground { color: #0f172a !important; }
        .oferta-light [class*="text-yellow-"] { color: #b45309 !important; }
        .oferta-light .text-yellow-400 { color: #b45309 !important; }
        .oferta-light .text-emerald-500 { color: #059669 !important; }
        .oferta-light .text-violet-400 { color: #7c3aed !important; }
        .oferta-light .text-sky-400 { color: #0284c7 !important; }
        .oferta-light .text-white { color: #ffffff !important; }
        .oferta-light .bg-card\\/80, .oferta-light .bg-card\\/60 { background-color: rgba(255,255,255,0.95) !important; }
        .oferta-light .bg-muted\\/30 { background-color: rgba(241,245,249,0.8) !important; }
        .oferta-light .border-border\\/50, .oferta-light .border-border\\/30 { border-color: rgba(15,23,42,0.12) !important; }
      `}</style>
      <div className="absolute inset-0 bg-gradient-to-b from-yellow-100 via-white to-yellow-50 pointer-events-none" />
      <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-yellow-300/30 rounded-full blur-3xl animate-pulse pointer-events-none" />
      <div className="absolute bottom-1/4 right-1/4 w-64 h-64 bg-amber-200/30 rounded-full blur-2xl pointer-events-none" />

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

        {/* Bônus inclusos — detalhamento */}
        <div className="space-y-4">
          <div className="text-center">
            <Badge className="bg-yellow-500/20 text-yellow-400 border border-yellow-500/40 text-xs px-3 py-1">
              🎁 BÔNUS INCLUSOS EM TODOS OS PLANOS
            </Badge>
            <h2 className="text-xl sm:text-2xl font-bold mt-3">
              O método do Mycroft <span className="text-yellow-400">além do futebol</span>
            </h2>
          </div>
          <div className="grid md:grid-cols-2 gap-4">
            <Card className="bg-card/60 backdrop-blur border-violet-500/30">
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-base">
                  <Spade className="w-5 h-5 text-violet-400" />
                  Arena Blackjack
                </CardTitle>
                <CardDescription>Único jogo de cassino com vantagem matemática do jogador</CardDescription>
              </CardHeader>
              <CardContent className="text-sm text-muted-foreground space-y-2">
                <p>
                  Não é tigrinho. Não é roleta. Combina <strong className="text-foreground">contagem Hi-Lo</strong>, estratégia básica perfeita (Illustrious 18) e gestão Kelly Híbrido. A casa fica abaixo de 0,5%.
                </p>
                <p className="text-xs italic border-l-2 border-yellow-500/40 pl-3 mt-3">
                  ⚠️ <strong className="text-foreground">Gestão obrigatória:</strong> meta diária R$ 50–R$ 100, stop loss definido, sessões de até 20 minutos. Sessões longas favorecem a casa.
                </p>
              </CardContent>
            </Card>

            <Card className="bg-card/60 backdrop-blur border-sky-500/30">
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-base">
                  <LineChart className="w-5 h-5 text-sky-400" />
                  Arena Trader Financeiro
                  <span className="text-[10px] font-mono font-bold px-1.5 py-0.5 rounded bg-amber-500/15 text-amber-400 border border-amber-500/30 tracking-wider">
                    BETA
                  </span>
                </CardTitle>
                <CardDescription>Versão experimental — mesmo método do esporte sendo calibrado para WIN, WDO e BTC</CardDescription>
              </CardHeader>
              <CardContent className="text-sm text-muted-foreground space-y-2">
                <p>
                  Estamos calibrando R:R, stop loss e leitura técnica para o <strong className="text-foreground">mercado financeiro</strong>. Sem garantia de paridade com o Trader Sports, que já é maduro. Use por sua conta e risco enquanto o motor é refinado.
                </p>
                <p className="text-xs italic border-l-2 border-amber-500/40 pl-3 mt-3">
                  ⚠️ Beta: resultados não auditados, não entram na Liga Mycroft. O Mycroft não torce — ele calcula, mesmo em testes.
                </p>
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Reassurance */}
        <div className="text-center text-sm text-muted-foreground bg-muted/30 rounded-xl p-4 border border-border/30 space-y-1">
          <p className="font-medium text-foreground">✅ Atendimento humano de verdade</p>
          <p>
            Fale com um especialista no WhatsApp antes de qualquer pagamento. Sem robô, sem enrolação.
          </p>
          <p className="text-xs text-muted-foreground/70 mt-2">
            Aviso de risco: entradas envolvem perda. Resultados passados não garantem futuros.
          </p>
        </div>
      </motion.div>
      </div>

      {/* Educativo + Comunicado importante (fora do container claro, fundo escuro próprio) */}
      <div className="mt-12 -mx-4">
        <HouseEdgeEducation />
        <ComunicadoImportante />
      </div>

      {/* Footer +18 */}
      <footer className="w-full bg-white border-t border-slate-200 py-4 text-center text-xs text-slate-500">
        <p><strong className="text-red-500">+18 anos.</strong> Proibido para menores de 18 anos. Entradas esportivas envolvem risco de dependência. Jogue com responsabilidade.</p>
        <p className="mt-1">© 2026 Oráculo Mycroft. Nenhuma ferramenta pode garantir vitórias ou lucros constantes.</p>
      </footer>
    </>
  );
}
