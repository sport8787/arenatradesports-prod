import * as React from "react";
import { useEffect } from "react";
import { identifyUser, track } from "@/lib/analytics";
import { captureUTMs } from "@/lib/utm";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import ErrorBoundary from "@/components/ErrorBoundary";
import { TrialBanner } from "@/components/TrialBanner";
import { RequireSubscription } from "@/components/RequireSubscription";
import { getAudioCacheStats } from "./services/audioCacheService";
import { getHorusCacheProgress } from "./services/horusCacheService";

const MultiBetOptimizer = React.lazy(() => import("./pages/MultiBetOptimizer"));
const LandingPage = React.lazy(() => import("./pages/LandingPage"));
const Paywall = React.lazy(() => import("./pages/Paywall"));
const OfertaEspecial = React.lazy(() => import("./pages/OfertaEspecial"));
const Index = React.lazy(() => import("./pages/Index"));
const Auth = React.lazy(() => import("./pages/Auth"));
const ChangePassword = React.lazy(() => import("./pages/ChangePassword"));
const NotFound = React.lazy(() => import("./pages/NotFound"));
const MinhasApostas = React.lazy(() => import("./pages/MinhasApostas"));
const PrivacyPolicy = React.lazy(() => import("./pages/PrivacyPolicy"));
const ArenaTraderSports = React.lazy(() => import("./pages/ArenaTraderSports"));
const ArenaTraderSportsRankingMonthly = React.lazy(() => import("./pages/ArenaTraderSportsRankingMonthly"));
const ArenaTraderSportsEventosRaros = React.lazy(() => import("./pages/ArenaTraderSportsEventosRaros"));
const UnderThresholdsConfig = React.lazy(() => import("./pages/UnderThresholdsConfig"));
const BackFavoritoComValor = React.lazy(() => import("./pages/BackFavoritoComValor"));
const LiveMatchDetail = React.lazy(() => import("./pages/LiveMatchDetail"));
const TradingHistory = React.lazy(() => import("./pages/TradingHistory"));
const MycroftSinaisAprovados = React.lazy(() => import("./pages/MycroftSinaisAprovados"));
const MycroftSinalDetalhe = React.lazy(() => import("./pages/MycroftSinalDetalhe"));
const LiquidationsHistory = React.lazy(() => import("./pages/LiquidationsHistory"));
const SportsPerformance = React.lazy(() => import("./pages/SportsPerformance"));
const ModoTreino = React.lazy(() => import("./pages/ModoTreino"));
const Historico = React.lazy(() => import("./pages/Historico"));
const BetHistory = React.lazy(() => import("./pages/BetHistory"));
const Punter = React.lazy(() => import("./pages/Punter"));
const PunterAnalytics = React.lazy(() => import("./pages/PunterAnalytics"));
const PunterWidgets = React.lazy(() => import("./pages/PunterWidgets"));
const PunterConfig = React.lazy(() => import("./pages/PunterConfig"));
const PunterImport = React.lazy(() => import("./pages/PunterImport"));
const PunterBetfairReal = React.lazy(() => import("./pages/PunterBetfairReal"));
const PunterFunctions = React.lazy(() => import("./pages/PunterFunctions"));
const PunterBancaVirtual = React.lazy(() => import("./pages/PunterBancaVirtual"));
const PunterAnaliseManual = React.lazy(() => import("./pages/PunterAnaliseManual"));
const PunterAprovadas = React.lazy(() => import("./pages/PunterAprovadas"));
const PunterComunidade = React.lazy(() => import("./pages/PunterComunidade"));
const PunterMenu = React.lazy(() => import("./pages/PunterMenu"));
const ArenaTrader = React.lazy(() => import("./pages/ArenaTrader"));
const ArenaPoker = React.lazy(() => import("./pages/ArenaPoker"));
const ArenaTraderRankings = React.lazy(() => import("./pages/ArenaTraderRankings"));
const ArenaTraderSeason = React.lazy(() => import("./pages/ArenaTraderSeason"));
const ArenaBlackjack = React.lazy(() => import("./pages/ArenaBlackjack"));
const MycroftMemory = React.lazy(() => import("./pages/MycroftMemory"));
const AdminDashboard = React.lazy(() => import("./pages/AdminDashboard"));
const AdminChatAnalytics = React.lazy(() => import("./pages/AdminChatAnalytics"));
const AdminPushTest = React.lazy(() => import("./pages/AdminPushTest"));
const AdminSettlementLog = React.lazy(() => import("./pages/AdminSettlementLog"));
const AdminEdgeFunctionsStatus = React.lazy(() => import("./pages/AdminEdgeFunctionsStatus"));
const AdminEdgeFunctionErrors = React.lazy(() => import("./pages/AdminEdgeFunctionErrors"));

const queryClient = new QueryClient();

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
            <React.Suspense fallback={<div className="min-h-screen bg-background flex items-center justify-center" />}>
              <Routes>
                <Route path="/" element={<LandingPage />} />
                <Route path="/lobby" element={<Index />} />
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
                <Route path="/arena-trader-sports/liquidacoes" element={<RequireSubscription><LiquidationsHistory /></RequireSubscription>} />
                <Route path="/arena-trader-sports/performance" element={<RequireSubscription><SportsPerformance /></RequireSubscription>} />
                <Route path="/arena-trader-sports/ranking-mensal" element={<RequireSubscription><ArenaTraderSportsRankingMonthly /></RequireSubscription>} />
                <Route path="/arena-trader-sports/eventos-raros" element={<RequireSubscription><ArenaTraderSportsEventosRaros /></RequireSubscription>} />
                <Route path="/arena-trader-sports/under-thresholds" element={<RequireSubscription><UnderThresholdsConfig /></RequireSubscription>} />
                <Route path="/arena-trader-sports/planos/back-fav-valor" element={<RequireSubscription><BackFavoritoComValor /></RequireSubscription>} />
                <Route path="/modo-treino" element={<RequireSubscription><ModoTreino /></RequireSubscription>} />
                <Route path="/historico" element={<RequireSubscription><Historico /></RequireSubscription>} />
                <Route path="/apostas" element={<RequireSubscription><BetHistory /></RequireSubscription>} />
                <Route path="/minhas-apostas" element={<RequireSubscription><MinhasApostas /></RequireSubscription>} />
                <Route path="/punter" element={<RequireSubscription><Punter /></RequireSubscription>} />
                <Route path="/punter/widgets" element={<RequireSubscription><PunterWidgets /></RequireSubscription>} />
                <Route path="/punter/analytics" element={<RequireSubscription><PunterAnalytics /></RequireSubscription>} />
                <Route path="/punter/config" element={<RequireSubscription><PunterConfig /></RequireSubscription>} />
                <Route path="/punter/import" element={<RequireSubscription><PunterImport /></RequireSubscription>} />
                <Route path="/punter/betfair-real" element={<RequireSubscription><PunterBetfairReal /></RequireSubscription>} />
                <Route path="/punter/multiplas" element={<RequireSubscription><MultiBetOptimizer /></RequireSubscription>} />
                <Route path="/punter/funcoes" element={<RequireSubscription><PunterFunctions /></RequireSubscription>} />
                <Route path="/punter/banca-virtual" element={<RequireSubscription><PunterBancaVirtual /></RequireSubscription>} />
                <Route path="/punter/analise-manual" element={<RequireSubscription><PunterAnaliseManual /></RequireSubscription>} />
                <Route path="/punter/aprovadas" element={<RequireSubscription><PunterAprovadas /></RequireSubscription>} />
                <Route path="/punter/comunidade" element={<RequireSubscription><PunterComunidade /></RequireSubscription>} />
                <Route path="/punter/menu" element={<RequireSubscription><PunterMenu /></RequireSubscription>} />
                <Route path="/arena-trader" element={<RequireSubscription><ArenaTrader /></RequireSubscription>} />
                <Route path="/arena-trader/rankings" element={<RequireSubscription><ArenaTraderRankings /></RequireSubscription>} />
                <Route path="/arena-trader/season" element={<RequireSubscription><ArenaTraderSeason /></RequireSubscription>} />
                <Route path="/arena-blackjack" element={<RequireSubscription><ArenaBlackjack /></RequireSubscription>} />
                <Route path="/arena-poker" element={<RequireSubscription><ArenaPoker /></RequireSubscription>} />
                <Route path="/mycroft-memory" element={<RequireSubscription><MycroftMemory /></RequireSubscription>} />
                <Route path="/admin" element={<AdminDashboard />} />
                <Route path="/admin/chat-analytics" element={<AdminChatAnalytics />} />
                <Route path="/admin/push-test" element={<AdminPushTest />} />
                <Route path="/admin/settlement-log" element={<AdminSettlementLog />} />
                <Route path="/admin/edge-status" element={<AdminEdgeFunctionsStatus />} />
                <Route path="/admin/edge-errors" element={<AdminEdgeFunctionErrors />} />
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
