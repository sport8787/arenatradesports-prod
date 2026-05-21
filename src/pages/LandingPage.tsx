import { useState, useEffect, lazy, Suspense } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { 
  Bot, Shield, TrendingUp, Target, BarChart3, 
  Zap, Lock, CheckCircle2, ArrowRight, Play,
  Brain, Award, LineChart, Users, Star
} from 'lucide-react';
import logoOraculo from '@/assets/logo_oraculo_mycroft_nobg.png';
import WhatsAppSupportButton from '@/components/WhatsAppSupportButton';
const WhatIsOracleSection = lazy(() => import('@/components/landing/WhatIsOracleSection'));
const LiveStatsCounter = lazy(() => import('@/components/landing/LiveStatsCounter'));
const SocialProofBetsSection = lazy(() => import('@/components/landing/SocialProofBetsSection'));
const WhyDifferentSection = lazy(() => import('@/components/landing/WhyDifferentSection'));
const LiveSocialProofTicker = lazy(() => import('@/components/landing/LiveSocialProofTicker'));
const BeforeAfterSection = lazy(() => import('@/components/landing/BeforeAfterSection'));
const ObjectionsSection = lazy(() => import('@/components/landing/ObjectionsSection'));
const StickyMobileCTA = lazy(() => import('@/components/landing/StickyMobileCTA'));
const FloatingWhatsApp = lazy(() => import('@/components/landing/FloatingWhatsApp'));
const PromoSlotsCounter = lazy(() => import('@/components/landing/PromoSlotsCounter'));
const SocialProofSection = lazy(() => import('@/components/landing/SocialProofSection'));
const ProvaRealPrints = lazy(() => import('@/components/landing/ProvaRealPrints'));
import { useAuth } from '@/hooks/useAuth';
import { usePromoSlots } from '@/hooks/usePromoSlots';
import { track } from '@/lib/analytics';
import { useSectionTracking } from '@/hooks/useSectionTracking';
import { useVturbTracking } from '@/hooks/useVturbTracking';
import { useVslDelay } from '@/hooks/useVslDelay';
import { getH1Variant, H1_VARIANTS } from '@/lib/landingAbTest';

// 🎯 VSL com delay: minuto exato do pitch no vídeo. Trocar quando o vídeo final estiver pronto.
// 0 = sem delay (CTA visível desde o início). Baseline ~20 cadastros/dia foi obtido sem delay.
const VSL_PITCH_DELAY_SECONDS = 0;

export default function LandingPage() {
  const navigate = useNavigate();
  const { isAuthenticated, loading } = useAuth();
  const { decrementSlot } = usePromoSlots();
  // Headline fixa (variante B) — A/B test pausado a pedido

  const [h1Variant] = useState(() => { getH1Variant(); return H1_VARIANTS.B; });

  // Track landing view (com UTMs anexadas) — uma vez por sessão
  useEffect(() => {
    track.landingViewed('landing_home');
  }, []);

  // Redireciona usuários logados direto para o lobby
  useEffect(() => {
    if (!loading && isAuthenticated) {
      navigate('/lobby', { replace: true });
    }
  }, [isAuthenticated, loading, navigate]);

  const goToAuth = (stage: string = 'unknown', label: string = 'cta_generic') => {
    track.funnelCtaClicked(stage, label);
    // Fire-and-forget: decrementa vaga ao clicar no CTA
    void decrementSlot();
    navigate('/auth');
  };
  // Wrapper para uso direto em onClick (sem MouseEvent vazando para o tracker)
  const ctaHandler = (stage: string, label: string) => () => goToAuth(stage, label);

  // Tracking de etapas do funil (IntersectionObserver)
  const heroRef = useSectionTracking<HTMLElement>('hero');
  const videoRef = useSectionTracking<HTMLDivElement>('video');
  const postVslRef = useSectionTracking<HTMLElement>('post_vsl_cta');
  const provaBrutalRef = useSectionTracking<HTMLDivElement>('prova_brutal');
  const pricingRef = useSectionTracking<HTMLElement>('pricing');
  const ctaFinalRef = useSectionTracking<HTMLElement>('cta_final');

  const VTURB_PLAYER_ID = '6a00acb708dd22f8e61508b7';
  const VTURB_SCRIPT_SRC = `https://scripts.converteai.net/425e46be-1934-41ee-ac61-375afed6531f/players/${VTURB_PLAYER_ID}/v4/player.js`;

  // VSL removida: a prova agora vem em prints reais (ProvaRealPrints).
  // Mantemos hooks como no-op para preservar telemetria existente sem efeitos colaterais.
  useVturbTracking(`vid-${VTURB_PLAYER_ID}`, false);
  useVslDelay(VTURB_PLAYER_ID, VSL_PITCH_DELAY_SECONDS, false);
  const pitchUnlocked = true;
  const vslCurrentTime = 0;
  const [showDemo, setShowDemo] = useState(false);
  const [vturbReloadKey] = useState(0);

  // (VSL removida — toda lógica de carga/retry do VTurb foi descontinuada)


  return (
    <>
    <div className="bg-[#0a0f1e] text-white min-h-screen">
      {/* Header */}
      <header className="fixed top-0 w-full bg-[#0a0f1e]/80 backdrop-blur-md border-b border-white/10 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-3">
              <img src={logoOraculo} alt="Oráculo Mycroft" className="h-10 w-auto" />
              <div>
                <h1 className="text-xl font-bold text-white">ORÁCULO MYCROFT</h1>
                <p className="text-[10px] text-yellow-500 -mt-1 tracking-widest">PUNTER • TRADER</p>
              </div>
            </div>
            
            <nav className="hidden md:flex items-center gap-8">
              <a href="#funcionalidades" className="text-sm text-gray-300 hover:text-white transition">Funcionalidades</a>
              <a href="#diferenciais" className="text-sm text-gray-300 hover:text-white transition">Diferenciais</a>
              <a href="#resultados" className="text-sm text-gray-300 hover:text-white transition">Resultados</a>
              <a href="#planos" className="text-sm text-gray-300 hover:text-white transition">Planos</a>
            </nav>
            
            <div className="flex items-center gap-3">
              <WhatsAppSupportButton />
              {pitchUnlocked && (
                <>
                  <button onClick={ctaHandler('header', 'login')} className="text-sm text-gray-300 hover:text-white transition">Login</button>
                  <button onClick={ctaHandler('header', 'testar_7_dias')} className="px-6 py-2 bg-gradient-to-r from-yellow-500 to-yellow-600 text-black font-semibold rounded-lg hover:from-yellow-600 hover:to-yellow-700 transition shadow-lg shadow-yellow-500/25">
                    TESTAR 7 DIAS GRÁTIS
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section ref={heroRef} className="relative min-h-screen flex items-center pt-16 overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-blue-900/20 via-purple-900/20 to-[#0a0f1e]" />
        <div className="absolute inset-0 opacity-10">
          <div className="absolute inset-0" style={{
            backgroundImage: 'radial-gradient(circle at 2px 2px, rgba(59, 130, 246, 0.3) 1px, transparent 0)',
            backgroundSize: '32px 32px'
          }} />
        </div>

        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            <motion.div initial={{ opacity: 0, x: -50 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.8 }}>
              <div className="inline-flex items-center gap-2 px-3 py-1 bg-blue-500/10 border border-blue-500/30 rounded-full text-sm text-blue-400 mb-6">
                <Zap className="w-4 h-4" />
                <span>1.200+ apostadores profissionais usando agora</span>
              </div>

              <h2 className="text-4xl lg:text-6xl font-bold mb-6 leading-tight">
                {h1Variant.line1}
                <span className="block text-transparent bg-clip-text bg-gradient-to-r from-yellow-400 to-yellow-600">
                  {h1Variant.highlight}
                </span>
                {h1Variant.line3}
              </h2>

              {/* Dor explícita do usuário */}
              <div className="mb-6 p-4 bg-red-500/5 border-l-4 border-red-500/60 rounded-r-lg">
                <p className="text-base lg:text-lg text-gray-200 leading-relaxed">
                  Se você já ganhou apostas mas <span className="text-red-400 font-semibold">nunca conseguiu consistência</span>,
                  o problema não é sorte. É <span className="text-yellow-400 font-semibold">falta de leitura de mercado</span>.
                </p>
              </div>

              <p className="text-lg text-gray-300 mb-8 leading-relaxed">
                Descubra apostas com vantagem real enquanto a maioria ainda perde dinheiro.
                <span className="text-green-400 font-semibold"> +R$ 7.100 de lucro</span> e
                <span className="text-blue-400 font-semibold"> +71% de ROI</span> em apostas auditadas.
              </p>

              {pitchUnlocked ? (
                <>
                  <div className="mb-6">
                    <Suspense fallback={<div className="h-10" />}>
                      <PromoSlotsCounter variant="inline" />
                    </Suspense>
                  </div>

                  <div className="flex flex-col sm:flex-row gap-4 mb-6">
                    <button onClick={ctaHandler('hero', 'testar_gratis_7_dias_primary')} className="px-8 py-4 bg-gradient-to-r from-yellow-500 to-yellow-600 text-black font-bold rounded-lg hover:from-yellow-600 hover:to-yellow-700 transition shadow-xl shadow-yellow-500/25 flex items-center justify-center gap-2 group">
                      TESTAR GRÁTIS POR 7 DIAS
                      <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition" />
                    </button>
                    <a href="https://t.me/oraculo_mycroft" target="_blank" rel="noopener noreferrer" className="px-8 py-4 bg-[#229ED9]/10 border border-[#229ED9]/40 text-[#229ED9] font-semibold rounded-lg hover:bg-[#229ED9]/20 transition backdrop-blur-sm flex items-center justify-center gap-2">
                      <Users className="w-5 h-5" />
                      Grupo VIP Telegram
                    </a>
                  </div>

                  <p className="text-sm text-gray-400 mb-8">✅ Sem cartão de crédito • 🔒 Cancele em 2 cliques • ⚡ Acesso imediato</p>

                  <div className="flex items-center gap-8 flex-wrap">
                    <div><p className="text-3xl font-bold text-yellow-500">+73%</p><p className="text-sm text-gray-400">ROI Auditado</p></div>
                    <div><p className="text-3xl font-bold text-green-500">59.5%</p><p className="text-sm text-gray-400">Win Rate</p></div>
                    <div><p className="text-3xl font-bold text-blue-500">1.658</p><p className="text-sm text-gray-400">Posições</p></div>
                  </div>
                </>
              ) : (
                <div className="mb-8 p-5 bg-gradient-to-br from-yellow-500/5 to-transparent border border-yellow-500/20 rounded-xl">
                  <div className="flex items-center gap-3 mb-2">
                    <span className="text-2xl">🎬</span>
                    <p className="text-sm sm:text-base font-bold text-yellow-300">
                      Assista o vídeo para liberar sua oferta
                    </p>
                  </div>
                  <p className="text-xs sm:text-sm text-gray-400 leading-relaxed">
                    No final da apresentação você terá acesso a uma condição exclusiva de teste grátis por 7 dias — com <span className="text-yellow-300 font-semibold">todas as funções liberadas</span>, sem cartão e sem letras miúdas.
                  </p>
                </div>
              )}
            </motion.div>

            <motion.div initial={{ opacity: 0, x: 50 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.8, delay: 0.2 }} className="relative space-y-6">
              <div className="relative">
                <div className="absolute -inset-4 bg-gradient-to-r from-blue-600 to-purple-600 rounded-2xl blur-3xl opacity-30" />
                <div className="relative bg-[#0f1729] rounded-2xl border border-gray-700 overflow-hidden shadow-2xl">
                  {/* Hook do vídeo */}
                  <div className="bg-gradient-to-r from-yellow-500/15 via-yellow-600/10 to-transparent border-b border-yellow-500/30 px-4 py-3">
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
                      <p className="text-xs sm:text-sm font-bold text-yellow-300 uppercase tracking-wide">
                        Veja como o Mycroft identifica apostas com valor em tempo real
                      </p>
                    </div>
                    <div className="flex items-center gap-3 mt-1 text-[11px] text-gray-300">
                      <span>📈 +71% ROI</span>
                      <span className="text-gray-600">•</span>
                      <span>💰 +R$ 7.100</span>
                      <span className="text-gray-600">•</span>
                      <span>🎯 138 apostas</span>
                    </div>
                  </div>
                  <div className="bg-[#1a1f36] px-4 py-3 flex items-center gap-2 border-b border-gray-700">
                    <div className="flex gap-1.5">
                      <div className="w-3 h-3 rounded-full bg-red-500" />
                      <div className="w-3 h-3 rounded-full bg-yellow-500" />
                      <div className="w-3 h-3 rounded-full bg-green-500" />
                    </div>
                    <div className="ml-4 px-4 py-1 bg-[#0f1729] rounded text-xs text-gray-400">demo.oraculo-mycroft.com</div>
                  </div>
                  <div ref={videoRef} className="bg-black">
                    <img
                      src={new URL('@/assets/prints-reais/resultado-punter-7d.png', import.meta.url).href}
                      alt="Performance real do Arena Punter em 7 dias: ROI +25,6%, Win Rate 67,9%, 115 sinais"
                      className="w-full h-auto block"
                      loading="eager"
                    />
                  </div>

                </div>
              </div>

              {/* CTA Card de alta conversão — só aparece após o pitch da VSL */}
              {pitchUnlocked ? (
                <div className="bg-gradient-to-br from-yellow-500/10 via-yellow-600/5 to-transparent border-2 border-yellow-500/40 rounded-2xl p-6 shadow-2xl shadow-yellow-500/10 animate-fade-in">
                  <div className="flex items-center gap-2 mb-3">
                    <div className="flex -space-x-2">
                      <div className="w-7 h-7 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 border-2 border-[#0a0f1e]" />
                      <div className="w-7 h-7 rounded-full bg-gradient-to-br from-green-500 to-emerald-600 border-2 border-[#0a0f1e]" />
                      <div className="w-7 h-7 rounded-full bg-gradient-to-br from-yellow-500 to-orange-600 border-2 border-[#0a0f1e]" />
                    </div>
                    <p className="text-xs text-gray-300">
                      <span className="text-yellow-400 font-bold">+1.200</span> apostadores ativos agora
                    </p>
                  </div>

                  <p className="text-2xl font-black text-white leading-tight mb-2">
                    Teste o Oráculo <span className="text-yellow-400">grátis por 7 dias</span>
                  </p>
                  <p className="text-sm text-gray-300 mb-4">
                    Acesso imediato. Sem cartão. Cancele quando quiser.
                  </p>

                  <button
                    onClick={ctaHandler('hero_cta_card', 'comecar_teste_gratis')}
                    className="w-full py-4 bg-gradient-to-r from-yellow-500 to-yellow-600 text-black font-black text-base rounded-lg hover:from-yellow-600 hover:to-yellow-700 transition shadow-xl shadow-yellow-500/40 inline-flex items-center justify-center gap-2 group"
                  >
                    CRIAR CONTA GRÁTIS
                    <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition" />
                  </button>
                  <p className="text-[11px] text-yellow-400/90 mt-2 text-center">
                    🎁 E-book "Apostas de Valor" liberado dentro do app
                  </p>

                  <div className="grid grid-cols-3 gap-2 mt-4 pt-4 border-t border-yellow-500/20">
                    <div className="text-center">
                      <p className="text-lg font-bold text-green-400">+73%</p>
                      <p className="text-[10px] text-gray-400">ROI auditado</p>
                    </div>
                    <div className="text-center">
                      <p className="text-lg font-bold text-blue-400">59.5%</p>
                      <p className="text-[10px] text-gray-400">Win rate</p>
                    </div>
                    <div className="text-center">
                      <p className="text-lg font-bold text-yellow-400">7 dias</p>
                      <p className="text-[10px] text-gray-400">100% grátis</p>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="bg-[#0f1729] border border-yellow-500/20 rounded-2xl p-5 text-center">
                  <p className="text-xs uppercase tracking-widest text-yellow-400/80 mb-2">🔒 Conteúdo bloqueado</p>
                  <p className="text-sm text-gray-300">
                    O botão de acesso aparece automaticamente no momento certo da apresentação.
                  </p>
                </div>
              )}
            </motion.div>
          </div>
        </div>

        <motion.div animate={{ y: [0, 10, 0] }} transition={{ repeat: Infinity, duration: 2 }} className="absolute bottom-8 left-1/2 -translate-x-1/2">
          <div className="w-6 h-10 border-2 border-gray-600 rounded-full flex items-start justify-center p-2">
            <div className="w-1.5 h-3 bg-blue-500 rounded-full" />
          </div>
        </motion.div>
      </section>

      {/* VSL: vídeo já está embutido no Hero (frame demo.oraculo-mycroft.com) */}

      {/* 🔒 GATE: tudo abaixo só aparece após o pitch da VSL (8 min de vídeo assistido) */}
      {pitchUnlocked && (
      <>

      {/* Bloco CTA reforçado — pós-Hero/VSL, antes da prova social */}
      <section ref={postVslRef} className="py-12 px-6 bg-gradient-to-b from-[#0a0f1e] to-[#0f1729]">
        <div className="container mx-auto max-w-3xl">
          <div className="bg-gradient-to-br from-yellow-500/10 via-yellow-600/5 to-transparent border-2 border-yellow-500/40 rounded-2xl p-8 sm:p-10 text-center shadow-2xl shadow-yellow-500/10">
            <p className="text-[11px] font-mono uppercase tracking-widest text-yellow-400/80 mb-3">
              Acesso liberado em segundos
            </p>
            <h2 className="text-2xl sm:text-4xl font-black text-white leading-tight mb-3">
              Comece grátis agora — <span className="text-yellow-400">7 dias de acesso completo</span>
            </h2>
            <p className="text-sm sm:text-base text-gray-300 mb-6 max-w-xl mx-auto">
              Sem cartão. Sem WhatsApp. Crie sua conta em 30 segundos e veja sinais reais com edge matemático já na primeira sessão.
            </p>
            <button
              onClick={ctaHandler('post_vsl_cta', 'criar_conta_gratis')}
              className="px-8 sm:px-10 py-4 bg-gradient-to-r from-yellow-500 to-yellow-600 text-black font-black text-base sm:text-lg rounded-lg hover:from-yellow-600 hover:to-yellow-700 transition shadow-xl shadow-yellow-500/40 inline-flex items-center justify-center gap-2 group"
            >
              CRIAR CONTA GRÁTIS
              <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition" />
            </button>
            <p className="text-xs text-yellow-400/90 mt-4">
              🎁 Bônus: e-book "Apostas de Valor" liberado dentro do app
            </p>
            <p className="text-[11px] text-gray-500 mt-2">
              ✅ Sem cartão de crédito • 🔒 Cancele em 2 cliques
            </p>
          </div>
        </div>
      </section>

      {/* Prova Real — Depoimento + Demo do sistema */}
      <Suspense fallback={null}>
        <SocialProofSection />
      </Suspense>

      {/* Contadores ao vivo */}
      <Suspense fallback={null}>
        <LiveStatsCounter />
      </Suspense>

      {/* Por que é diferente + Prova Brutal */}
      <div ref={provaBrutalRef}>
        <Suspense fallback={null}>
          <WhyDifferentSection onCTA={ctaHandler('prova_brutal', 'testar_gratis_7_dias')} />
        </Suspense>
      </div>

      {/* O que é o Oráculo */}
      <Suspense fallback={null}>
        <WhatIsOracleSection onCTA={ctaHandler('what_is_oracle', 'cta_section')} />
      </Suspense>

      {/* Prova Social - Entradas Reais */}
      <Suspense fallback={null}>
        <SocialProofBetsSection onCTA={ctaHandler('social_proof_bets', 'cta_section')} />
      </Suspense>

      {/* Features */}
      <section id="funcionalidades" className="py-20 bg-[#0f1729]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold mb-4">
              TUDO QUE VOCÊ PRECISA PARA
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-yellow-400 to-yellow-600"> INVESTIR EM ESPORTES</span>
            </h2>
            <p className="text-xl text-gray-400">Gestão de banca, análise quantitativa e proteção emocional em uma plataforma.</p>
          </div>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
            {FEATURES.map((feature, index) => (
              <motion.div key={index} initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ duration: 0.5, delay: index * 0.1 }}
                className="bg-[#1a1f36] border border-gray-700 rounded-xl p-6 hover:border-blue-500/50 transition group">
                <div className="w-12 h-12 bg-gradient-to-br from-blue-600 to-purple-600 rounded-lg flex items-center justify-center mb-4 group-hover:scale-110 transition">
                  {feature.icon}
                </div>
                <h3 className="text-xl font-semibold mb-2">{feature.title}</h3>
                <p className="text-gray-400 text-sm leading-relaxed">{feature.description}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Diferenciais */}
      <section id="diferenciais" className="py-20 bg-[#0a0f1e]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold mb-4">
              POR QUE ORÁCULO MYCROFT
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-yellow-400 to-yellow-600"> NÃO É MAIS UMA SALA?</span>
            </h2>
            <p className="text-xl text-gray-400">Comparação brutal entre Oráculo e salas de sinais tradicionais</p>
          </div>
          <div className="bg-[#1a1f36] rounded-2xl overflow-hidden border border-gray-700">
            <div className="grid md:grid-cols-3">
              <div className="bg-[#0f1729] p-6 border-b md:border-b-0 md:border-r border-gray-700">
                <h3 className="text-lg font-semibold text-gray-400">CRITÉRIO</h3>
              </div>
              <div className="bg-gradient-to-br from-blue-900/20 to-purple-900/20 p-6 border-b md:border-b-0 md:border-r border-gray-700">
                <h3 className="text-lg font-semibold text-white flex items-center gap-2">
                  <Award className="w-5 h-5 text-yellow-500" />ORÁCULO MYCROFT
                </h3>
              </div>
              <div className="bg-[#0f1729] p-6"><h3 className="text-lg font-semibold text-gray-400">SALAS TRADICIONAIS</h3></div>
              {COMPARISONS.map((comp, index) => (
                <div key={index} className="contents">
                  <div className="p-6 border-t border-gray-700 md:border-r"><p className="font-medium text-gray-300">{comp.criteria}</p></div>
                  <div className="p-6 border-t border-gray-700 md:border-r bg-[#0f1729]">
                    <div className="flex items-start gap-2">
                      <CheckCircle2 className="w-5 h-5 text-green-500 flex-shrink-0 mt-0.5" />
                      <p className="text-sm text-gray-300">{comp.oraculo}</p>
                    </div>
                  </div>
                  <div className="p-6 border-t border-gray-700"><p className="text-sm text-gray-500">{comp.salas}</p></div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Resultados */}
      <section id="resultados" className="py-20 bg-[#0f1729]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold mb-4">RESULTADOS<span className="text-transparent bg-clip-text bg-gradient-to-r from-yellow-400 to-yellow-600"> 100% AUDITÁVEIS</span></h2>
            <p className="text-xl text-gray-400">Track record verificável. Cada aposta registrada. Zero bullshit.</p>
          </div>
          <div className="grid lg:grid-cols-3 gap-8 mb-12">
            <div className="bg-gradient-to-br from-green-500/10 to-green-500/5 border border-green-500/30 rounded-2xl p-8 text-center">
              <div className="w-16 h-16 bg-gradient-to-br from-green-600 to-green-700 rounded-full flex items-center justify-center mx-auto mb-4"><TrendingUp className="w-8 h-8 text-white" /></div>
              <p className="text-5xl font-bold text-white mb-2">+73.56%</p>
              <p className="text-green-400 font-semibold mb-1">ROI Médio</p>
              <p className="text-sm text-gray-400">Baseado em 1.658 posições auditadas</p>
            </div>
            <div className="bg-gradient-to-br from-blue-500/10 to-blue-500/5 border border-blue-500/30 rounded-2xl p-8 text-center">
              <div className="w-16 h-16 bg-gradient-to-br from-blue-600 to-blue-700 rounded-full flex items-center justify-center mx-auto mb-4"><Target className="w-8 h-8 text-white" /></div>
              <p className="text-5xl font-bold text-white mb-2">59.5%</p>
              <p className="text-blue-400 font-semibold mb-1">Win Rate</p>
              <p className="text-sm text-gray-400">66 greens / 43 reds comprovados</p>
            </div>
            <div className="bg-gradient-to-br from-purple-500/10 to-purple-500/5 border border-purple-500/30 rounded-2xl p-8 text-center">
              <div className="w-16 h-16 bg-gradient-to-br from-purple-600 to-purple-700 rounded-full flex items-center justify-center mx-auto mb-4"><Shield className="w-8 h-8 text-white" /></div>
              <p className="text-5xl font-bold text-white mb-2">95%+</p>
              <p className="text-purple-400 font-semibold mb-1">Compliance</p>
              <p className="text-sm text-gray-400">Usuários seguem recomendações</p>
            </div>
          </div>
          <div className="bg-gradient-to-r from-yellow-500/10 to-yellow-600/10 border-2 border-yellow-500/30 rounded-2xl p-8">
            <div className="flex flex-col md:flex-row items-center gap-6">
              <div className="w-20 h-20 bg-gradient-to-br from-yellow-500 to-yellow-600 rounded-full flex items-center justify-center flex-shrink-0"><Lock className="w-10 h-10 text-black" /></div>
              <div className="flex-1 text-center md:text-left">
                <h3 className="text-2xl font-bold text-white mb-2">GARANTIA DOBRO OU SEU DINHEIRO DE VOLTA</h3>
                <p className="text-gray-300 leading-relaxed">Se você seguir 95%+ das recomendações e não tiver ROI positivo em 3 meses, devolvemos em dobro sua assinatura. Sem letrinhas miúdas.</p>
              </div>
              <button onClick={ctaHandler('resultados', 'garantia_dobro_quero_testar')} className="px-6 py-3 bg-gradient-to-r from-yellow-500 to-yellow-600 text-black font-bold rounded-lg hover:from-yellow-600 hover:to-yellow-700 transition shadow-lg">QUERO TESTAR</button>
            </div>
          </div>
        </div>
      </section>

      {/* Pricing */}
      <section ref={pricingRef} id="planos" className="py-20 bg-[#0a0f1e]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold mb-4">PLANOS QUE CABEM NO SEU<span className="text-transparent bg-clip-text bg-gradient-to-r from-yellow-400 to-yellow-600"> BOLSO</span></h2>
            <p className="text-xl text-gray-400">4x mais barato que salas de sinais. Infinitamente mais valor.</p>
          </div>
          <div className="grid lg:grid-cols-3 gap-8">
            {PRICING_PLANS.map((plan, index) => (
              <motion.div key={index} initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ duration: 0.5, delay: index * 0.1 }}
                className={`relative rounded-2xl p-8 border-2 ${plan.popular ? 'bg-gradient-to-br from-blue-900/20 to-purple-900/20 border-blue-500' : 'bg-[#1a1f36] border-gray-700'}`}>
                {plan.popular && (
                  <div className="absolute -top-4 left-1/2 -translate-x-1/2 px-4 py-1 bg-gradient-to-r from-blue-600 to-purple-600 text-white text-sm font-bold rounded-full">MAIS POPULAR</div>
                )}
                <div className="text-center mb-6">
                  <h3 className="text-2xl font-bold mb-2">{plan.name}</h3>
                  <div className="flex items-baseline justify-center gap-2 mb-2">
                    <span className="text-5xl font-bold">R$ {plan.price}</span>
                    <span className="text-gray-400">/mês</span>
                  </div>
                  <p className="text-sm text-gray-400">{plan.description}</p>
                </div>
                <ul className="space-y-3 mb-8">
                  {plan.features.map((feature, i) => (
                    <li key={i} className="flex items-start gap-2">
                      <CheckCircle2 className="w-5 h-5 text-green-500 flex-shrink-0 mt-0.5" />
                      <span className="text-sm text-gray-300">{feature}</span>
                    </li>
                  ))}
                </ul>
                <a href={plan.url} target="_blank" rel="noopener noreferrer" className={`w-full py-3 rounded-lg font-bold transition block text-center ${plan.popular ? 'bg-gradient-to-r from-yellow-500 to-yellow-600 text-black hover:from-yellow-600 hover:to-yellow-700 shadow-lg shadow-yellow-500/25' : 'bg-white/5 border border-white/10 text-white hover:bg-white/10'}`}>
                  {plan.cta}
                </a>
              </motion.div>
            ))}
          </div>
          <p className="text-center text-gray-400 mt-8">💳 Aceita PIX, cartão e boleto • 🔒 Seguro e criptografado • 🔄 Cancele quando quiser</p>
        </div>
      </section>

      {/* Antes vs Depois */}
      <Suspense fallback={null}>
        <BeforeAfterSection />
      </Suspense>

      {/* Objeções */}
      <Suspense fallback={null}>
        <ObjectionsSection />
      </Suspense>

      {/* FAQ */}
      <section className="py-20 bg-[#0f1729]">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold mb-4">PERGUNTAS<span className="text-transparent bg-clip-text bg-gradient-to-r from-yellow-400 to-yellow-600"> FREQUENTES</span></h2>
          </div>
          <div className="space-y-4">
            {FAQ.map((faq, index) => (
              <details key={index} className="bg-[#1a1f36] border border-gray-700 rounded-lg p-6 group">
                <summary className="font-semibold text-white cursor-pointer flex items-center justify-between">
                  {faq.question}
                  <span className="text-gray-400 group-open:rotate-180 transition">▼</span>
                </summary>
                <p className="mt-4 text-gray-400 leading-relaxed">{faq.answer}</p>
              </details>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Final */}
      <section ref={ctaFinalRef} className="py-20 bg-gradient-to-r from-blue-900/20 to-purple-900/20 border-y border-gray-700">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-4xl lg:text-5xl font-bold mb-6">
            PRONTO PARA INVESTIR COMO
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-yellow-400 to-yellow-600"> PROFISSIONAL?</span>
          </h2>
          <p className="text-xl text-gray-300 mb-8">Junte-se a 1.200+ investidores que já transformaram apostas em investimento sistemático.</p>
          <button onClick={ctaHandler('cta_final', 'comecar_agora')} className="px-12 py-5 bg-gradient-to-r from-yellow-500 to-yellow-600 text-black text-lg font-bold rounded-lg hover:from-yellow-600 hover:to-yellow-700 transition shadow-2xl shadow-yellow-500/25 flex items-center gap-3 mx-auto group">
            COMEÇAR AGORA
            <ArrowRight className="w-6 h-6 group-hover:translate-x-2 transition" />
          </button>
          <p className="text-sm text-gray-400 mt-4">✅ 7 dias grátis • ❌ Sem cartão de crédito • 🔒 Cancele quando quiser</p>
        </div>
      </section>

      </>
      )}

      {/* Footer */}
      <footer className="bg-[#0a0f1e] border-t border-gray-800 py-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid md:grid-cols-4 gap-8 mb-8">
            <div>
              <h4 className="font-bold mb-4">Produto</h4>
              <ul className="space-y-2 text-sm text-gray-400">
                <li><a href="#funcionalidades" className="hover:text-white transition">Funcionalidades</a></li>
                <li><a href="#planos" className="hover:text-white transition">Planos</a></li>
                <li><a href="#" className="hover:text-white transition">Roadmap</a></li>
                <li><a href="#" className="hover:text-white transition">Changelog</a></li>
              </ul>
            </div>
            <div>
              <h4 className="font-bold mb-4">Empresa</h4>
              <ul className="space-y-2 text-sm text-gray-400">
                <li><a href="/landing.html" className="hover:text-white transition">Sobre Nós</a></li>
                <li><a href="/blog/" className="hover:text-white transition">Blog</a></li>
              <li><a href="https://wa.me/5534991290648?text=Ol%C3%A1!%20Tenho%20uma%20d%C3%BAvida%20sobre%20o%20Or%C3%A1culo%20Mycroft" target="_blank" rel="noopener noreferrer" className="hover:text-white transition">Contato</a></li>
              </ul>
            </div>
            <div>
              <h4 className="font-bold mb-4">Recursos</h4>
              <ul className="space-y-2 text-sm text-gray-400">
                <li><a href="#" className="hover:text-white transition">Documentação</a></li>
                <li><a href="#" className="hover:text-white transition">API</a></li>
                <li><a href="#" className="hover:text-white transition">Suporte</a></li>
                <li><a href="#" className="hover:text-white transition">Status</a></li>
              </ul>
            </div>
            <div>
              <h4 className="font-bold mb-4">Legal</h4>
              <ul className="space-y-2 text-sm text-gray-400">
                <li><a href="/privacy-policy" className="hover:text-white transition">Privacidade</a></li>
                <li><a href="#" className="hover:text-white transition">Termos</a></li>
                <li><a href="#" className="hover:text-white transition">Cookies</a></li>
                <li><a href="#" className="hover:text-white transition">Licenças</a></li>
              </ul>
            </div>
          </div>
          <div className="border-t border-gray-800 pt-8 flex flex-col md:flex-row items-center justify-between gap-4">
            <p className="text-sm text-gray-400">© 2026 Oráculo Mycroft. Todos os direitos reservados.</p>
            <div className="flex items-center gap-4">
              <a href="#" className="text-gray-400 hover:text-white transition">
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24"><path d="M23 3a10.9 10.9 0 01-3.14 1.53 4.48 4.48 0 00-7.86 3v1A10.66 10.66 0 013 4s-4 9 5 13a11.64 11.64 0 01-7 2c9 5 20 0 20-11.5a4.5 4.5 0 00-.08-.83A7.72 7.72 0 0023 3z"></path></svg>
              </a>
              <a href="#" className="text-gray-400 hover:text-white transition">
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24"><path d="M12 2C6.477 2 2 6.477 2 12c0 4.991 3.657 9.128 8.438 9.879V14.89h-2.54V12h2.54V9.797c0-2.506 1.492-3.89 3.777-3.89 1.094 0 2.238.195 2.238.195v2.46h-1.26c-1.243 0-1.63.771-1.63 1.562V12h2.773l-.443 2.89h-2.33v6.989C18.343 21.129 22 16.99 22 12c0-5.523-4.477-10-10-10z"></path></svg>
              </a>
              <a href="#" className="text-gray-400 hover:text-white transition">
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24"><path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 100 12.324 6.162 6.162 0 000-12.324zM12 16a4 4 0 110-8 4 4 0 010 8zm6.406-11.845a1.44 1.44 0 100 2.881 1.44 1.44 0 000-2.881z"></path></svg>
              </a>
            </div>
          </div>
        </div>
      </footer>
    </div>

      {/* Demo Video Modal */}
      {showDemo && (
        <div 
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm"
          onClick={() => setShowDemo(false)}
        >
          <div 
            className="relative w-full max-w-5xl mx-4"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              onClick={() => setShowDemo(false)}
              className="absolute -top-10 right-0 text-white/70 hover:text-white text-sm font-medium"
            >
              Fechar ✕
            </button>
            <div className="rounded-xl overflow-hidden shadow-2xl border border-white/10 bg-black flex items-center justify-center">
              <img
                src={new URL('@/assets/prints-reais/resultado-punter-7d.png', import.meta.url).href}
                alt="Resultado real Punter 7 dias"
                className="w-full h-auto"
              />
            </div>

            <div className="mt-4 text-center">
              <button onClick={ctaHandler('demo_modal', 'comecar_agora_modal')} className="px-8 py-3 bg-gradient-to-r from-yellow-500 to-yellow-600 text-black font-bold rounded-lg hover:from-yellow-600 hover:to-yellow-700 transition shadow-xl shadow-yellow-500/25">
                COMEÇAR AGORA — 7 DIAS GRÁTIS
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Notificação de prova social ao vivo */}
      <Suspense fallback={null}>
        <LiveSocialProofTicker />
      </Suspense>

      {/* CTA fixo no rodapé (mobile) — só após pitch da VSL */}
      <Suspense fallback={null}>
        {pitchUnlocked && <StickyMobileCTA onCTA={ctaHandler('sticky_mobile', 'testar_gratis_7_dias_mobile')} />}
        <FloatingWhatsApp />
      </Suspense>
    </>
  );
}

// Data

const FEATURES = [
  { icon: <Brain className="w-6 h-6 text-white" />, title: "Mycroft IA Analista", description: "Cérebro quantitativo que processa 1.000+ jogos/dia e calcula Asset Score 0-100 para cada oportunidade." },
  { icon: <Shield className="w-6 h-6 text-white" />, title: "Hórus Protetor", description: "Coach emocional que detecta tilt em tempo real e bloqueia apostas quando você está fora do seu estado ideal." },
  { icon: <TrendingUp className="w-6 h-6 text-white" />, title: "Dual Bankroll", description: "Compare sua performance vs Hórus em tempo real. Veja exatamente quanto você perde ao não seguir recomendações." },
  { icon: <Target className="w-6 h-6 text-white" />, title: "Asset Score 0-100", description: "Cada jogo vira um ativo financeiro com score baseado em edge, probabilidade, sharp money e market inefficiency." },
  { icon: <BarChart3 className="w-6 h-6 text-white" />, title: "Track Record Auditável", description: "1.658 posições registradas. ROI +73%. Win rate 59.5%. Tudo verificável. Zero mentira." },
  { icon: <Lock className="w-6 h-6 text-white" />, title: "Garantia Dobro", description: "Compliance ≥95% sem ROI positivo em 3 meses? Devolvemos em dobro. Sem letrinhas miúdas." },
];

const COMPARISONS = [
  { criteria: "Track Record", oraculo: "1.658 posições auditadas publicamente. ROI +73% verificável.", salas: "Screenshots editáveis. 'Confie em mim bro'." },
  { criteria: "Transparência", oraculo: "Cada posição registrada com timestamp, odd, stake e resultado.", salas: "Apagam loses. Mostram só wins." },
  { criteria: "Preço", oraculo: "A partir de R$ 99,90/mês. 4x mais barato.", salas: "R$ 497-997/mês. Exploração." },
  { criteria: "Tecnologia", oraculo: "IA que calcula edge, detecta tilt, otimiza stakes.", salas: "'Feeling' do tipster. Zero IA." },
  { criteria: "Proteção", oraculo: "Hórus bloqueia operações quando detecta emoção.", salas: "Te incentivam a apostar mais (afiliados)." },
  { criteria: "Garantia", oraculo: "Dobro do valor se não funcionar (95% compliance).", salas: "Nenhuma. 'Não garantimos resultados'." },
];

const PRICING_PLANS = [
  {
    name: "Starter",
    price: "99,90",
    description: "Para começar a investir",
    features: ["Mycroft IA (Asset Score básico)", "Até 50 posições/mês", "Dashboard completo", "Track record auditável", "Suporte por email"],
    cta: "COMEÇAR AGORA",
    popular: false,
    url: "https://pay.kiwify.com.br/5lryTVK",
  },
  {
    name: "Professional",
    price: "199,90",
    description: "Mais popular",
    features: ["Tudo do Starter +", "Hórus IA (proteção tilt)", "Posições ilimitadas", "Dual Bankroll", "Sharp Money Detector", "Garantia Dobro", "Suporte prioritário"],
    cta: "ASSINAR AGORA",
    popular: true,
    url: "https://pay.kiwify.com.br/O4zEN7O",
  },
  {
    name: "Enterprise",
    price: "299,00",
    description: "Para profissionais",
    features: ["Tudo do Professional +", "API access completa", "Auto-execution (bot)", "Portfolio Optimization", "Self Learning Engine", "Integração Fullbet", "Suporte 24/7", "Consultoria mensal"],
    cta: "FALAR COM VENDAS",
    popular: false,
    url: "https://wa.me/5534991290648?text=Ol%C3%A1%2C%20tenho%20interesse%20no%20plano%20Enterprise%20do%20Mycroft.",
  },
];

const FAQ = [
  { question: "O teste grátis realmente libera TUDO?", answer: "Sim. Os 7 dias de teste dão acesso completo às duas arenas — Punter e Trader Sports — com todas as funções ativas: Mycroft IA, Hórus, Dual Bankroll, sinais ao vivo, chat por jogo e gestão de banca virtual. Zero limitação. Se não gostar, cancela em 2 cliques." },
  { question: "Sem cartão de crédito — como funciona?", answer: "Basta criar conta com e-mail. Não pedimos dados de pagamento para começar. Após os 7 dias, você escolhe se quer continuar. Não há cobrança automática e nenhum cartão é armazenado durante o trial." },
  { question: "Sem letras miúdas — o que significa?", answer: "Significa transparência total: sem taxa oculta, sem fidelidade, sem multa de cancelamento, sem pegadinha no prazo. Tudo que prometemos está escrito em tamanho legível. Garantia dobro é real e auditável." },
  { question: "Vocês são mais uma sala de sinais?", answer: "Não. Salas vendem 'dicas' sem comprovação. Nós somos uma plataforma de investimento esportivo com IA, track record auditável de 1.658 posições e ROI +73% verificável. A diferença é transparência total vs bullshit total." },
  { question: "Como funciona a Garantia Dobro?", answer: "Simples: se você seguir ≥95% das recomendações Mycroft (compliance) por 3 meses consecutivos e não tiver ROI positivo, devolvemos em dobro sua assinatura. Sem letrinhas miúdas. Monitoramos tudo automaticamente." },
  { question: "Preciso entender de apostas esportivas?", answer: "Não. Mycroft faz a análise quantitativa. Hórus te protege de decisões emocionais. Você só precisa: (1) seguir as recomendações, (2) respeitar o stake sugerido, (3) não operar em tilt. O resto é automático." },
  { question: "Quanto preciso investir para começar?", answer: "Recomendamos R$ 1.000 como banca inicial para stake adequado (2-5% por posição). Mas você pode começar com R$ 500 e ir aumentando conforme os resultados. O importante é gestão de banca, não valor absoluto." },
  { question: "Posso cancelar quando quiser?", answer: "Sim. Sem fidelidade, sem multa, sem enrolação. Cancela em 2 cliques no dashboard. Se cancelar no meio do mês, continuamos te atendendo até o fim do período pago. Simples assim." },
  { question: "Como é o suporte?", answer: "Starter: email com resposta em até 24h. Professional: chat + email com resposta em até 6h. Enterprise: suporte 24/7 + consultoria mensal + canal direto no Slack. Nada de bot. Pessoas reais que entendem do produto." },
];
