import { useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, useInView } from 'framer-motion';
import {
  Play,
  ChevronRight,
  Radar,
  Brain,
  Zap,
  Check,
  X,
  Shield,
  MessageCircle,
  TrendingUp,
  Target,
  BarChart3,
  Bot,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { cn } from '@/lib/utils';
import { HeroParticles } from '@/components/landing/HeroParticles';

// Configurable video URL for VSL
const VIDEO_URL = ''; // Paste Vturb or other embed URL here

// ─── Fade-in helper ───
const FadeIn = ({ children, className, delay = 0 }: { children: React.ReactNode; className?: string; delay?: number }) => (
  <motion.div
    initial={{ opacity: 0, y: 30 }}
    whileInView={{ opacity: 1, y: 0 }}
    viewport={{ once: true, margin: '-60px' }}
    transition={{ duration: 0.7, delay }}
    className={className}
  >
    {children}
  </motion.div>
);

// ─── Social Proof Bar ───
const proofItems = [
  { label: '68% Win Rate Auditado', icon: Target },
  { label: '200+ Traders', icon: TrendingUp },
  { label: 'Sinais em Tempo Real', icon: Zap },
  { label: '7 dias grátis', icon: Shield },
];

// ─── How it works steps ───
const steps = [
  { icon: Radar, title: 'Mycroft monitora o jogo ao vivo', desc: 'Rastreamento contínuo de dezenas de ligas e campeonatos simultaneamente.' },
  { icon: Brain, title: 'IA analisa xG, ataques e padrões da Knowledge Base', desc: 'Cruzamento com base histórica validada e modelos proprietários.' },
  { icon: Zap, title: 'Você recebe o sinal com tese completa no WhatsApp', desc: 'Sinal detalhado com mercado, odd, confiança e fundamentação.' },
];

// ─── Comparison table ───
const comparisonRows = [
  { label: 'Win rate real', sala: '89% (mentira)', arena: '68% (auditado)' },
  { label: 'Explica o porquê', sala: false, arena: true },
  { label: 'Sem clubismo', sala: false, arena: true },
  { label: 'Modo treino', sala: false, arena: true },
  { label: 'Gestão de risco', sala: false, arena: true },
];

// ─── FAQ ───
const faqItems = [
  { q: 'Preciso de cartão para o trial?', a: 'Não. Você começa o trial de 7 dias sem precisar informar dados de pagamento. Sem surpresas.' },
  { q: 'Como recebo os sinais?', a: 'Diretamente no WhatsApp e também pelo dashboard em tempo real. Você escolhe onde prefere acompanhar.' },
  { q: 'O win rate de 68% é real?', a: 'Sim. Todas as operações são auditadas e rastreáveis. Diferente de salas que inventam números, o nosso é verificável.' },
  { q: 'Posso cancelar quando quiser?', a: 'Sim, sem multa e sem burocracia. Cancele a qualquer momento direto pela plataforma.' },
  { q: 'O que é o Modo Treino?', a: 'É um simulador onde você pratica análise de jogos ao vivo sem risco real. Perfeito para aprender antes de operar de verdade.' },
];

export default function LandingPage() {
  const navigate = useNavigate();
  const ctaRef = useRef(null);
  const ctaInView = useInView(ctaRef, { once: true, margin: '-80px' });

  const handleTrial = () => navigate('/lobby');
  const handlePricing = () => navigate('/paywall');

  return (
    <div className="min-h-screen bg-background overflow-x-hidden scroll-smooth">
      {/* ═══════════ HERO ═══════════ */}
      <section className="relative min-h-screen flex items-center justify-center px-4 py-20">
        {/* BG effects */}
        <div className="absolute inset-0 overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-b from-background via-background/95 to-background" />
          <div className="absolute top-1/4 left-1/4 w-[500px] h-[500px] bg-primary/10 rounded-full blur-[120px]" />
          <div className="absolute bottom-1/3 right-1/4 w-[400px] h-[400px] bg-destructive/5 rounded-full blur-[100px]" />
          <HeroParticles />
        </div>

        <div className="relative z-10 max-w-4xl mx-auto text-center">
          {/* Badge */}
          <FadeIn>
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 border border-primary/30 mb-8">
              <Bot className="w-4 h-4 text-primary" />
              <span className="text-sm font-medium text-primary">Arena Trader Sports — Powered by Mycroft AI</span>
            </div>
          </FadeIn>

          {/* Headline */}
          <FadeIn delay={0.1}>
            <h1 className="font-orbitron text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-black text-primary leading-tight mb-6">
              A Vantagem Injusta que Traders Profissionais Não Querem que Você Tenha
            </h1>
          </FadeIn>

          {/* Subheadline */}
          <FadeIn delay={0.2}>
            <p className="text-lg md:text-xl text-foreground/90 max-w-3xl mx-auto mb-6 leading-relaxed">
              Imagine ter um trader que conhece cada padrão do futebol mundial, que nunca dorme, nunca torce por time nenhum e toma decisões de forma fria, calculista e baseada em dados. Esse trader existe. Chama-se <span className="text-mycroft-green font-bold">Mycroft</span>.
            </p>
          </FadeIn>

          {/* Narrative paragraph */}
          <FadeIn delay={0.3}>
            <p className="text-sm md:text-base text-muted-foreground max-w-3xl mx-auto mb-10 leading-relaxed">
              Enquanto salas de sinais vendem ilusão com win rates de 89% que nunca existiram, o Mycroft foi treinado com a base de conhecimento mais profunda sobre trading esportivo: livros, padrões históricos validados e análise multimodal em tempo real. Ele não tem ego. Não tem time do coração. Só tem uma missão: <span className="text-foreground font-medium">encontrar value onde outros não enxergam.</span>
            </p>
          </FadeIn>

          {/* CTAs */}
          <FadeIn delay={0.4}>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-6">
              <Button
                onClick={handleTrial}
                size="lg"
                className="btn-gold text-base md:text-lg px-8 py-6 rounded-xl group"
              >
                Quero Minha Vantagem Injusta — 7 Dias Grátis
                <ChevronRight className="w-5 h-5 ml-2 group-hover:translate-x-1 transition-transform" />
              </Button>
            </div>
            <button onClick={handlePricing} className="text-sm text-muted-foreground hover:text-primary transition-colors underline underline-offset-4">
              ou assinar por R$ 49,90/mês
            </button>
          </FadeIn>

          {/* Trust badges */}
          <FadeIn delay={0.5}>
            <div className="flex flex-wrap items-center justify-center gap-4 mt-6 text-sm text-muted-foreground">
              <span className="flex items-center gap-1"><Check className="w-4 h-4 text-success" /> Sem cartão</span>
              <span className="flex items-center gap-1"><Check className="w-4 h-4 text-success" /> Cancela quando quiser</span>
              <span className="flex items-center gap-1"><Check className="w-4 h-4 text-success" /> Acesso imediato</span>
            </div>
          </FadeIn>
        </div>

        {/* Scroll indicator */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1.5 }}
          className="absolute bottom-8 left-1/2 -translate-x-1/2"
        >
          <motion.div
            animate={{ y: [0, 10, 0] }}
            transition={{ duration: 2, repeat: Infinity }}
            className="w-6 h-10 rounded-full border-2 border-muted-foreground/30 flex items-start justify-center p-2"
          >
            <div className="w-1.5 h-3 rounded-full bg-primary" />
          </motion.div>
        </motion.div>
      </section>

      {/* ═══════════ VSL SECTION ═══════════ */}
      <section className="py-16 px-4">
        <div className="max-w-4xl mx-auto">
          <FadeIn className="text-center mb-8">
            <h2 className="font-orbitron text-2xl md:text-3xl font-bold text-foreground">
              Veja o <span className="text-mycroft-green">Mycroft</span> em Ação
            </h2>
          </FadeIn>

          <FadeIn delay={0.1}>
            <div className="relative aspect-video rounded-2xl overflow-hidden border-2 border-primary/30 bg-card shadow-[0_0_60px_rgba(212,175,55,0.15)]">
              {VIDEO_URL ? (
                <iframe
                  src={VIDEO_URL}
                  className="absolute inset-0 w-full h-full"
                  allow="autoplay; fullscreen"
                  allowFullScreen
                  title="Mycroft Demo"
                />
              ) : (
                <div className="absolute inset-0 flex flex-col items-center justify-center bg-card">
                  <Play className="w-16 h-16 text-primary/50 mb-4" />
                  <p className="text-muted-foreground font-orbitron text-sm">VÍDEO EM BREVE</p>
                  <p className="text-xs text-muted-foreground/60 mt-2">Configure VIDEO_URL para exibir o player</p>
                </div>
              )}
              {/* Decorative corners */}
              <div className="absolute top-0 left-0 w-6 h-6 border-l-2 border-t-2 border-primary pointer-events-none" />
              <div className="absolute top-0 right-0 w-6 h-6 border-r-2 border-t-2 border-primary pointer-events-none" />
              <div className="absolute bottom-0 left-0 w-6 h-6 border-l-2 border-b-2 border-primary pointer-events-none" />
              <div className="absolute bottom-0 right-0 w-6 h-6 border-r-2 border-b-2 border-primary pointer-events-none" />
            </div>
          </FadeIn>

          <FadeIn delay={0.2} className="text-center mt-4">
            <p className="text-sm text-muted-foreground">
              ↑ Assista até o final — tem uma surpresa no minuto 3:20
            </p>
          </FadeIn>
        </div>
      </section>

      {/* ═══════════ SOCIAL PROOF BAR ═══════════ */}
      <section className="py-6 border-y border-border/30 bg-card/30">
        <div className="max-w-5xl mx-auto px-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {proofItems.map((item, i) => (
              <FadeIn key={item.label} delay={i * 0.05} className="flex items-center justify-center gap-2 py-3">
                <item.icon className="w-5 h-5 text-primary shrink-0" />
                <span className="font-orbitron text-xs md:text-sm font-bold text-foreground">{item.label}</span>
              </FadeIn>
            ))}
          </div>
        </div>
      </section>

      {/* ═══════════ COMO FUNCIONA ═══════════ */}
      <section className="py-20 px-4">
        <div className="max-w-5xl mx-auto">
          <FadeIn className="text-center mb-14">
            <h2 className="font-orbitron text-2xl md:text-4xl font-bold text-foreground">
              Como <span className="text-primary">Funciona</span>?
            </h2>
          </FadeIn>

          <div className="grid md:grid-cols-3 gap-8">
            {steps.map((step, i) => (
              <FadeIn key={step.title} delay={i * 0.12}>
                <div className="relative text-center p-6 rounded-2xl bg-card/50 border border-border/50 hover:border-primary/40 transition-all group">
                  {i < 2 && (
                    <div className="hidden md:block absolute top-12 -right-4 w-8 text-primary/40">
                      <ChevronRight className="w-8 h-8" />
                    </div>
                  )}
                  <div className="w-14 h-14 rounded-xl bg-primary/10 border border-primary/30 flex items-center justify-center mx-auto mb-4 group-hover:bg-primary/20 transition-colors">
                    <step.icon className="w-7 h-7 text-primary" />
                  </div>
                  <h3 className="font-orbitron text-sm md:text-base font-bold text-foreground mb-2">{step.title}</h3>
                  <p className="text-sm text-muted-foreground leading-relaxed">{step.desc}</p>
                </div>
              </FadeIn>
            ))}
          </div>
        </div>
      </section>

      {/* ═══════════ COMPARATIVO ═══════════ */}
      <section className="py-20 px-4 bg-card/20">
        <div className="max-w-3xl mx-auto">
          <FadeIn className="text-center mb-10">
            <h2 className="font-orbitron text-2xl md:text-3xl font-bold text-foreground">
              Por que o <span className="text-primary">Arena Trader</span> é diferente?
            </h2>
          </FadeIn>

          <FadeIn delay={0.1}>
            <div className="rounded-2xl overflow-hidden border border-border/50">
              {/* Header */}
              <div className="grid grid-cols-3 text-center bg-muted/40 py-3 border-b border-border/50">
                <span className="text-sm font-bold text-muted-foreground" />
                <span className="font-orbitron text-xs md:text-sm font-bold text-muted-foreground">Salas Comuns</span>
                <span className="font-orbitron text-xs md:text-sm font-bold text-primary">Arena Trader</span>
              </div>
              {comparisonRows.map((row, i) => (
                <div key={row.label} className={cn('grid grid-cols-3 text-center py-3 px-2 items-center', i % 2 === 0 ? 'bg-card/30' : 'bg-card/10')}>
                  <span className="text-sm text-foreground text-left pl-4">{row.label}</span>
                  <span className="text-sm">
                    {typeof row.sala === 'boolean'
                      ? row.sala ? <Check className="w-5 h-5 text-success mx-auto" /> : <X className="w-5 h-5 text-destructive mx-auto" />
                      : <span className="text-destructive font-medium">{row.sala}</span>}
                  </span>
                  <span className="text-sm">
                    {typeof row.arena === 'boolean'
                      ? row.arena ? <Check className="w-5 h-5 text-success mx-auto" /> : <X className="w-5 h-5 text-destructive mx-auto" />
                      : <span className="text-success font-bold">{row.arena}</span>}
                  </span>
                </div>
              ))}
            </div>
          </FadeIn>
        </div>
      </section>

      {/* ═══════════ EXEMPLO DE SINAL ═══════════ */}
      <section className="py-20 px-4">
        <div className="max-w-lg mx-auto">
          <FadeIn className="text-center mb-10">
            <h2 className="font-orbitron text-2xl md:text-3xl font-bold text-foreground">
              Exemplo de <span className="text-primary">Sinal</span>
            </h2>
          </FadeIn>

          <FadeIn delay={0.1}>
            <div className="luxury-card p-5 md:p-6">
              {/* Badge */}
              <div className="flex items-center justify-between mb-4">
                <span className="px-3 py-1 rounded-full bg-success/20 text-success text-xs font-bold font-orbitron border border-success/30">APROVADO</span>
                <span className="text-xs text-muted-foreground">34' • 1º Tempo</span>
              </div>
              {/* Teams */}
              <div className="flex items-center justify-between mb-4">
                <span className="font-orbitron text-sm font-bold text-foreground">Brasil</span>
                <span className="font-orbitron text-xl font-black text-primary mx-3">0 - 0</span>
                <span className="font-orbitron text-sm font-bold text-foreground">Argentina</span>
              </div>
              {/* Market */}
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Mercado</span>
                  <span className="text-foreground font-semibold">Over 0.5 HT</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Odd</span>
                  <span className="text-primary font-bold font-orbitron">@ 1.95</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Confiança</span>
                  <div className="flex items-center gap-2">
                    <div className="w-24 h-2 rounded-full bg-muted overflow-hidden">
                      <div className="h-full bg-success rounded-full" style={{ width: '78%' }} />
                    </div>
                    <span className="text-success font-bold text-xs">78%</span>
                  </div>
                </div>
              </div>
              {/* Thesis */}
              <div className="mt-4 p-3 rounded-lg bg-mycroft-green/5 border border-mycroft-green/20">
                <div className="flex items-start gap-2">
                  <Bot className="w-4 h-4 text-mycroft-green mt-0.5 shrink-0" />
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    <span className="text-mycroft-green font-semibold">Mycroft:</span> Padrão "Favorito Pressionando" detectado. 8 ataques perigosos vs 2. Pressão constante no terço final.
                  </p>
                </div>
              </div>
            </div>
          </FadeIn>
        </div>
      </section>

      {/* ═══════════ PLANOS ═══════════ */}
      <section className="py-20 px-4 bg-card/20">
        <div className="max-w-4xl mx-auto">
          <FadeIn className="text-center mb-12">
            <h2 className="font-orbitron text-2xl md:text-3xl font-bold text-foreground">
              Escolha seu <span className="text-primary">Plano</span>
            </h2>
          </FadeIn>

          <div className="grid md:grid-cols-2 gap-6 max-w-3xl mx-auto">
            {/* Base Plan */}
            <FadeIn delay={0.05}>
              <div className="luxury-card p-6 flex flex-col h-full">
                <h3 className="font-orbitron text-lg font-bold text-foreground mb-1">Base</h3>
                <div className="flex items-baseline gap-1 mb-4">
                  <span className="font-orbitron text-3xl font-black text-primary">R$ 49,90</span>
                  <span className="text-muted-foreground text-sm">/mês</span>
                </div>
                <ul className="space-y-2.5 text-sm text-muted-foreground flex-1 mb-6">
                  {['Arena Trader Esportivo', 'Sinais ilimitados', 'Mycroft + Hórus IA', 'Modo Treino', 'Sinais no WhatsApp', 'Histórico completo'].map(f => (
                    <li key={f} className="flex items-center gap-2"><Check className="w-4 h-4 text-success shrink-0" /><span className="text-foreground/80">{f}</span></li>
                  ))}
                </ul>
                <Button onClick={handleTrial} className="btn-gold w-full py-5 text-sm">
                  Começar Trial Grátis
                </Button>
              </div>
            </FadeIn>

            {/* Premium Plan */}
            <FadeIn delay={0.15}>
              <div className="relative luxury-card p-6 flex flex-col h-full border-2 !border-primary/50 shadow-[0_0_40px_rgba(212,175,55,0.15)]">
                <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-4 py-1 rounded-full bg-primary text-primary-foreground font-orbitron text-xs font-bold">
                  MAIS POPULAR
                </div>
                <h3 className="font-orbitron text-lg font-bold text-foreground mb-1 mt-2">Premium</h3>
                <div className="flex items-baseline gap-1 mb-4">
                  <span className="font-orbitron text-3xl font-black text-primary">R$ 79,80</span>
                  <span className="text-muted-foreground text-sm">/mês</span>
                </div>
                <ul className="space-y-2.5 text-sm text-muted-foreground flex-1 mb-6">
                  {[
                    'Tudo do plano Base',
                    '+ Arena Trader Financeiro',
                    'WIN, WDO, BTC, ETH',
                    'Sinais B3 e Crypto',
                    'Suporte prioritário',
                  ].map(f => (
                    <li key={f} className="flex items-center gap-2"><Check className="w-4 h-4 text-primary shrink-0" /><span className="text-foreground/80">{f}</span></li>
                  ))}
                </ul>
                <Button onClick={handleTrial} className="btn-gold w-full py-5 text-sm">
                  Começar Trial Grátis
                </Button>
              </div>
            </FadeIn>
          </div>
        </div>
      </section>

      {/* ═══════════ FAQ ═══════════ */}
      <section className="py-20 px-4">
        <div className="max-w-2xl mx-auto">
          <FadeIn className="text-center mb-10">
            <h2 className="font-orbitron text-2xl md:text-3xl font-bold text-foreground">
              Perguntas <span className="text-primary">Frequentes</span>
            </h2>
          </FadeIn>

          <FadeIn delay={0.1}>
            <Accordion type="single" collapsible className="space-y-2">
              {faqItems.map((item, i) => (
                <AccordionItem key={i} value={`faq-${i}`} className="border border-border/50 rounded-xl px-4 bg-card/30">
                  <AccordionTrigger className="text-sm md:text-base font-semibold text-foreground hover:no-underline">
                    {item.q}
                  </AccordionTrigger>
                  <AccordionContent className="text-sm text-muted-foreground leading-relaxed">
                    {item.a}
                  </AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          </FadeIn>
        </div>
      </section>

      {/* ═══════════ FOOTER CTA ═══════════ */}
      <section ref={ctaRef} className="relative py-20 px-4">
        <div className="absolute inset-0 bg-gradient-to-t from-primary/10 via-transparent to-transparent" />

        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={ctaInView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.8 }}
          className="relative max-w-3xl mx-auto text-center"
        >
          <h2 className="font-orbitron text-2xl md:text-4xl font-bold text-foreground mb-4 leading-tight">
            O Mycroft já está analisando jogos agora.
          </h2>
          <p className="text-lg text-muted-foreground mb-8 max-w-xl mx-auto">
            A única pergunta é: você vai usar essa vantagem ou vai deixar pra outro trader usar?
          </p>

          <Button
            onClick={handleTrial}
            size="lg"
            className="btn-gold text-base md:text-lg px-10 py-7 rounded-2xl group animate-pulse-glow"
          >
            Quero Entrar — 7 Dias Grátis
            <ChevronRight className="w-6 h-6 ml-3 group-hover:translate-x-2 transition-transform" />
          </Button>
        </motion.div>
      </section>

      {/* ═══════════ FOOTER ═══════════ */}
      <footer className="border-t border-border/30 py-8 px-4">
        <div className="max-w-5xl mx-auto">
          <div className="flex flex-col md:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <BarChart3 className="w-5 h-5 text-primary" />
              <span className="font-orbitron text-sm font-bold text-primary">ARENA TRADER</span>
              <span className="font-orbitron text-sm font-bold text-foreground">SPORTS</span>
            </div>

            <div className="flex items-center gap-4 text-xs text-muted-foreground">
              <a href="/privacidade" className="hover:text-foreground transition-colors">Privacidade</a>
              <span>•</span>
              <a href="#" className="hover:text-foreground transition-colors">Termos de Uso</a>
              <span>•</span>
              <a href="#" className="hover:text-foreground transition-colors">Suporte</a>
            </div>
          </div>

          <p className="text-center text-xs text-muted-foreground/60 mt-6">
            Arena Trader Sports é uma plataforma educacional de análise esportiva. Não somos casa de apostas.
          </p>
          <p className="text-center text-xs text-muted-foreground/40 mt-2">
            © 2025 Arena Trader Sports. Todos os direitos reservados.
          </p>
        </div>
      </footer>
    </div>
  );
}
