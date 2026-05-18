import * as React from "react";
import { useEffect } from "react";
import { identifyUser, track } from "@/lib/analytics";
import { captureUTMs } from "@/lib/utm";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import ErrorBoundary from "@/components/ErrorBoundary";
import { TrialBanner } from "@/components/TrialBanner";
import BCRewardToastsMount from "@/components/BCRewardToastsMount";
import { RequireSubscription } from "@/components/RequireSubscription";
import { RequireArena } from "@/components/RequireArena";
import { getAudioCacheStats } from "./services/audioCacheService";
import { getHorusCacheProgress } from "./services/horusCacheService";

const MultiBetOptimizer = React.lazy(() => import("./pages/MultiBetOptimizer"));
const LandingPage = React.lazy(() => import("./pages/LandingPage"));
const Paywall = React.lazy(() => import("./pages/Paywall"));
const OfertaEspecial = React.lazy(() => import("./pages/OfertaEspecial"));
const Index = React.lazy(() => import("./pages/Index"));
const Links = React.lazy(() => import("./pages/Links"));
const Auth = React.lazy(() => import("./pages/Auth"));
const ChangePassword = React.lazy(() => import("./pages/ChangePassword"));
const NotFound = React.lazy(() => import("./pages/NotFound"));
const MinhasApostas = React.lazy(() => import("./pages/MinhasApostas"));
const PrivacyPolicy = React.lazy(() => import("./pages/PrivacyPolicy"));
const ArenaTraderSports = React.lazy(() => import("./pages/ArenaTraderSports"));
const ArenaTraderSportsRankingMonthly = React.lazy(() => import("./pages/ArenaTraderSportsRankingMonthly"));
const ArenaTraderSportsEventosRaros = React.lazy(() => import("./pages/ArenaTraderSportsEventosRaros"));
const ArenaTraderSportsMeuPlano = React.lazy(() => import("./pages/ArenaTraderSportsMeuPlano"));
const UnderThresholdsConfig = React.lazy(() => import("./pages/UnderThresholdsConfig"));
const BackFavoritoComValor = React.lazy(() => import("./pages/BackFavoritoComValor"));
const LiveMatchDetail = React.lazy(() => import("./pages/LiveMatchDetail"));
const TradingHistory = React.lazy(() => import("./pages/TradingHistory"));
const MycroftSinaisAprovados = React.lazy(() => import("./pages/MycroftSinaisAprovados"));
const SinaisLiquidados = React.lazy(() => import("./pages/SinaisLiquidados"));
const MycroftSinalDetalhe = React.lazy(() => import("./pages/MycroftSinalDetalhe"));
const LiquidationsHistory = React.lazy(() => import("./pages/LiquidationsHistory"));
const SportsPerformance = React.lazy(() => import("./pages/SportsPerformance"));
const ModoTreino = React.lazy(() => import("./pages/ModoTreino"));
const Historico = React.lazy(() => import("./pages/Historico"));
const BetHistory = React.lazy(() => import("./pages/BetHistory"));
const Punter = React.lazy(() => import("./pages/Punter"));
const PunterAnalytics = React.lazy(() => import("./pages/PunterAnalytics"));
const PunterGateDashboard = React.lazy(() => import("./pages/PunterGateDashboard"));
const PunterWidgets = React.lazy(() => import("./pages/PunterWidgets"));
const PunterConfig = React.lazy(() => import("./pages/PunterConfig"));
const PunterImport = React.lazy(() => import("./pages/PunterImport"));
const PunterBetfairReal = React.lazy(() => import("./pages/PunterBetfairReal"));
const PunterFunctions = React.lazy(() => import("./pages/PunterFunctions"));
const PunterBancaVirtual = React.lazy(() => import("./pages/PunterBancaVirtual"));
const PunterAnaliseManual = React.lazy(() => import("./pages/PunterAnaliseManual"));
const PunterAprovadas = React.lazy(() => import("./pages/PunterAprovadas"));
const PunterLiquidacoes = React.lazy(() => import("./pages/PunterLiquidacoes"));
const PunterFeedEventos = React.lazy(() => import("./pages/PunterFeedEventos"));
const PunterComunidade = React.lazy(() => import("./pages/PunterComunidade"));
const PunterMenu = React.lazy(() => import("./pages/PunterMenu"));
const BlackMarket = React.lazy(() => import("./pages/BlackMarket"));
const HowToEarnBC = React.lazy(() => import("./pages/HowToEarnBC"));
const PunterAuditoria = React.lazy(() => import("./pages/PunterAuditoria"));
const ArenaTrader = React.lazy(() => import("./pages/ArenaTrader"));
const ArenaTraderRankings = React.lazy(() => import("./pages/ArenaTraderRankings"));
const ArenaBlackjack = React.lazy(() => import("./pages/ArenaBlackjack"));
const MycroftMemory = React.lazy(() => import("./pages/MycroftMemory"));
const AdminDashboard = React.lazy(() => import("./pages/AdminDashboard"));
const AdminHub = React.lazy(() => import("./pages/AdminHub"));
const AdminFutoddsHealth = React.lazy(() => import("./pages/AdminFutoddsHealth"));
const AdminMycroftRules = React.lazy(() => import("./pages/AdminMycroftRules"));
const AdminUserTraderPlans = React.lazy(() => import("./pages/AdminUserTraderPlans"));
const AdminPunterGateConfig = React.lazy(() => import("./pages/AdminPunterGateConfig"));
const AdminCLVMonitor = React.lazy(() => import("./pages/AdminCLVMonitor"));
const AdminMetricasConversao = React.lazy(() => import("./pages/AdminMetricasConversao"));
const AdminTraderLeagues = React.lazy(() => import("./pages/AdminTraderLeagues"));
const AdminLeagueROI = React.lazy(() => import("./pages/AdminLeagueROI"));
const AdminBorderlineAI = React.lazy(() => import("./pages/AdminBorderlineAI"));
const AdminChatAnalytics = React.lazy(() => import("./pages/AdminChatAnalytics"));
const AdminPushTest = React.lazy(() => import("./pages/AdminPushTest"));
const AdminSettlementLog = React.lazy(() => import("./pages/AdminSettlementLog"));
const AdminEdgeFunctionsStatus = React.lazy(() => import("./pages/AdminEdgeFunctionsStatus"));
const AdminEdgeFunctionErrors = React.lazy(() => import("./pages/AdminEdgeFunctionErrors"));
const AdminAssinaturas = React.lazy(() => import("./pages/AdminAssinaturas"));
const AdminAuditoriaSinais = React.lazy(() => import("./pages/AdminAuditoriaSinais"));
const AdminAuditoriaSinalDetalhe = React.lazy(() => import("./pages/AdminAuditoriaSinalDetalhe"));
const AdminAuditoriaPunter = React.lazy(() => import("./pages/AdminAuditoriaPunter"));
const AdminMycroftChatAccessLog = React.lazy(() => import("./pages/AdminMycroftChatAccessLog"));
const PunterPerformancePorMercado = React.lazy(() => import("./pages/PunterPerformancePorMercado"));
const TraderSportsPerformancePorMercado = React.lazy(() => import("./pages/TraderSportsPerformancePorMercado"));

// Defaults conservadores: NÃO refazer fetch ao trocar de aba (causava sensação de "recarregar")
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      refetchOnReconnect: false,
      staleTime: 30_000,
    },
  },
});

// Expose cache stats globally for debugging
if (typeof window !== 'undefined') {
  (window as any).getAudioCacheStats = () => {
    const stats = getAudioCacheStats();
    const horusProgress = getHorusCacheProgress();
    console.log('📊 AUDIO CACHE STATS:', stats);
    return { ...stats, horusProgress };
  };
  console.log('💡 Debug: Call window.getAudioCacheStats() to view audio cache statistics');
}

const App = () => {
  useEffect(() => {
    // Captura UTMs (fbclid, utm_source, utm_campaign etc) no primeiro hit
    // e registra como super-properties no PostHog (vão em TODOS os eventos).
    captureUTMs();
    console.log('[App] 🎭 Pre-cache DISABLED on startup - will run only when entering a game room');
  }, []);

  return (
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <TooltipProvider>
          <Toaster />
          <Sonner />
          <BrowserRouter>
            <TrialBanner />
            <BCRewardToastsMount />
            <React.Suspense fallback={<div className="min-h-screen bg-background flex items-center justify-center" />}>
              <Routes>
                <Route path="/" element={<LandingPage />} />
                <Route path="/blog" element={<Navigate to="/blog/index.html" replace />} />
                <Route path="/blog/" element={<Navigate to="/blog/index.html" replace />} />
                <Route path="/blog/brasileirao-2026" element={<Navigate to="/blog/brasileirao-2026/index.html" replace />} />
                <Route path="/blog/brasileirao-2026/" element={<Navigate to="/blog/brasileirao-2026/index.html" replace />} />
                <Route path="/lobby" element={<Index />} />
                <Route path="/links" element={<Links />} />
                <Route path="/auth" element={<Auth />} />
                <Route path="/trocar-senha" element={<ChangePassword />} />
                <Route path="/privacidade" element={<PrivacyPolicy />} />
                <Route path="/paywall" element={<Paywall />} />
                <Route path="/oferta-especial" element={<OfertaEspecial />} />
                <Route path="/arena-trader-sports" element={<RequireSubscription><ArenaTraderSports /></RequireSubscription>} />
                <Route path="/arena-trader-sports/jogo/:id" element={<RequireSubscription><LiveMatchDetail /></RequireSubscription>} />
                <Route path="/arena-trader-sports/historico" element={<RequireSubscription><TradingHistory /></RequireSubscription>} />
                <Route path="/arena-trader-sports/sinais-aprovados" element={<RequireSubscription><MycroftSinaisAprovados /></RequireSubscription>} />
                <Route path="/arena-trader-sports/sinais-aprovados/:id" element={<RequireSubscription><MycroftSinalDetalhe /></RequireSubscription>} />
                <Route path="/arena-trader-sports/sinais-liquidados" element={<RequireSubscription><SinaisLiquidados /></RequireSubscription>} />
                <Route path="/arena-trader-sports/liquidacoes" element={<RequireSubscription><LiquidationsHistory /></RequireSubscription>} />
                <Route path="/arena-trader-sports/performance" element={<RequireSubscription><SportsPerformance /></RequireSubscription>} />
                <Route path="/arena-trader-sports/ranking-mensal" element={<RequireSubscription><ArenaTraderSportsRankingMonthly /></RequireSubscription>} />
                <Route path="/arena-trader-sports/eventos-raros" element={<RequireSubscription><ArenaTraderSportsEventosRaros /></RequireSubscription>} />
                <Route path="/arena-trader-sports/meu-plano" element={<RequireSubscription><ArenaTraderSportsMeuPlano /></RequireSubscription>} />
                <Route path="/arena-trader-sports/under-thresholds" element={<RequireSubscription><UnderThresholdsConfig /></RequireSubscription>} />
                <Route path="/arena-trader-sports/planos/back-fav-valor" element={<RequireSubscription><BackFavoritoComValor /></RequireSubscription>} />
                <Route path="/modo-treino" element={<RequireSubscription><ModoTreino /></RequireSubscription>} />
                <Route path="/historico" element={<RequireSubscription><Historico /></RequireSubscription>} />
                <Route path="/apostas" element={<RequireSubscription><BetHistory /></RequireSubscription>} />
                <Route path="/minhas-apostas" element={<RequireSubscription><MinhasApostas /></RequireSubscription>} />
                <Route path="/punter" element={<RequireSubscription><RequireArena arena="arena_punter" arenaLabel="Arena Punter"><Punter /></RequireArena></RequireSubscription>} />
                <Route path="/punter/widgets" element={<RequireSubscription><RequireArena arena="arena_punter" arenaLabel="Arena Punter"><PunterWidgets /></RequireArena></RequireSubscription>} />
                <Route path="/punter/analytics" element={<RequireSubscription><RequireArena arena="arena_punter" arenaLabel="Arena Punter"><PunterAnalytics /></RequireArena></RequireSubscription>} />
                <Route path="/punter/gate-dashboard" element={<RequireSubscription><RequireArena arena="arena_punter" arenaLabel="Arena Punter"><PunterGateDashboard /></RequireArena></RequireSubscription>} />
                <Route path="/punter/dashboard-gate" element={<Navigate to="/punter/gate-dashboard" replace />} />
                <Route path="/punter/config" element={<RequireSubscription><RequireArena arena="arena_punter" arenaLabel="Arena Punter"><PunterConfig /></RequireArena></RequireSubscription>} />
                <Route path="/punter/import" element={<RequireSubscription><RequireArena arena="arena_punter" arenaLabel="Arena Punter"><PunterImport /></RequireArena></RequireSubscription>} />
                <Route path="/punter/betfair-real" element={<RequireSubscription><RequireArena arena="banca_real" arenaLabel="Banca Real"><PunterBetfairReal /></RequireArena></RequireSubscription>} />
                <Route path="/punter/multiplas" element={<RequireSubscription><RequireArena arena="multiplas" arenaLabel="Gerador de Múltiplas"><MultiBetOptimizer /></RequireArena></RequireSubscription>} />
                <Route path="/punter/funcoes" element={<RequireSubscription><RequireArena arena="arena_punter" arenaLabel="Arena Punter"><PunterFunctions /></RequireArena></RequireSubscription>} />
                <Route path="/punter/banca-virtual" element={<RequireSubscription><RequireArena arena="banca_virtual" arenaLabel="Banca Virtual"><PunterBancaVirtual /></RequireArena></RequireSubscription>} />
                <Route path="/punter/analise-manual" element={<RequireSubscription><RequireArena arena="arena_punter" arenaLabel="Arena Punter"><PunterAnaliseManual /></RequireArena></RequireSubscription>} />
                <Route path="/punter/aprovadas" element={<RequireSubscription><RequireArena arena="arena_punter" arenaLabel="Arena Punter"><PunterAprovadas /></RequireArena></RequireSubscription>} />
               <Route path="/punter/liquidacoes" element={<RequireSubscription><RequireArena arena="arena_punter" arenaLabel="Arena Punter"><PunterLiquidacoes /></RequireArena></RequireSubscription>} />
               <Route path="/punter/feed-eventos" element={<RequireSubscription><RequireArena arena="arena_punter" arenaLabel="Arena Punter"><PunterFeedEventos /></RequireArena></RequireSubscription>} />
                <Route path="/punter/performance-por-mercado" element={<RequireSubscription><RequireArena arena="arena_punter" arenaLabel="Arena Punter"><PunterPerformancePorMercado /></RequireArena></RequireSubscription>} />
                <Route path="/arena-trader-sports/performance-por-mercado" element={<RequireSubscription><TraderSportsPerformancePorMercado /></RequireSubscription>} />
                <Route path="/punter/comunidade" element={<RequireSubscription><RequireArena arena="arena_punter" arenaLabel="Arena Punter"><PunterComunidade /></RequireArena></RequireSubscription>} />
                <Route path="/menu" element={<RequireSubscription><PunterMenu /></RequireSubscription>} />
                <Route path="/punter/menu" element={<Navigate to="/menu" replace />} />
                <Route path="/loja-bc" element={<BlackMarket />} />
                <Route path="/punter/loja-bc" element={<Navigate to="/loja-bc" replace />} />
                <Route path="/como-ganhar-bc" element={<HowToEarnBC />} />
                <Route path="/how-to-earn-bc" element={<Navigate to="/como-ganhar-bc" replace />} />
                <Route path="/punter/auditoria" element={<RequireSubscription><RequireArena arena="arena_punter" arenaLabel="Arena Punter"><PunterAuditoria /></RequireArena></RequireSubscription>} />
                <Route path="/arena-trader" element={<RequireSubscription><ArenaTrader /></RequireSubscription>} />
                <Route path="/arena-trader/rankings" element={<RequireSubscription><ArenaTraderRankings /></RequireSubscription>} />
                <Route path="/arena-blackjack" element={<RequireSubscription><ArenaBlackjack /></RequireSubscription>} />
                <Route path="/mycroft-memory" element={<RequireSubscription><MycroftMemory /></RequireSubscription>} />
                <Route path="/admin" element={<AdminDashboard />} />
                <Route path="/admin/hub" element={<AdminHub />} />
                <Route path="/admin/futodds-health" element={<AdminFutoddsHealth />} />
                <Route path="/admin/chat-analytics" element={<AdminChatAnalytics />} />
                <Route path="/admin/push-test" element={<AdminPushTest />} />
                <Route path="/admin/settlement-log" element={<AdminSettlementLog />} />
                <Route path="/admin/edge-status" element={<AdminEdgeFunctionsStatus />} />
                <Route path="/admin/edge-errors" element={<AdminEdgeFunctionErrors />} />
                <Route path="/admin/mycroft-rules" element={<AdminMycroftRules />} />
                <Route path="/admin/user-trader-plans" element={<AdminUserTraderPlans />} />
                <Route path="/admin/punter-gate-config" element={<AdminPunterGateConfig />} />
                <Route path="/admin/clv-monitor" element={<AdminCLVMonitor />} />
                <Route path="/admin/metricas-conversao" element={<AdminMetricasConversao />} />
                <Route path="/admin/trader-leagues" element={<AdminTraderLeagues />} />
                <Route path="/admin/league-roi" element={<AdminLeagueROI />} />
                <Route path="/admin/borderline-ai" element={<AdminBorderlineAI />} />
                <Route path="/admin/assinaturas" element={<AdminAssinaturas />} />
                <Route path="/admin/auditoria-sinais" element={<AdminAuditoriaSinais />} />
                <Route path="/admin/auditoria-sinais/:source/:id" element={<AdminAuditoriaSinalDetalhe />} />
                <Route path="/admin/auditoria-punter" element={<AdminAuditoriaPunter />} />
                <Route path="/admin/mycroft-chat-access" element={<AdminMycroftChatAccessLog />} />
                <Route path="*" element={<NotFound />} />
              </Routes>
            </React.Suspense>
          </BrowserRouter>
        </TooltipProvider>
      </QueryClientProvider>
    </ErrorBoundary>
  );
};

export default App;
