import * as React from "react";
import { useEffect } from "react";
import { identifyUser, track } from "@/lib/analytics";
import { captureUTMs } from "@/lib/utm";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import MultiBetOptimizer from "./pages/MultiBetOptimizer";
import ErrorBoundary from "@/components/ErrorBoundary";
import { TrialBanner } from "@/components/TrialBanner";
import { RequireSubscription } from "@/components/RequireSubscription";
import LandingPage from "./pages/LandingPage";
import Paywall from "./pages/Paywall";
import OfertaEspecial from "./pages/OfertaEspecial";
import Index from "./pages/Index";
import Auth from "./pages/Auth";
import NotFound from "./pages/NotFound";
import MinhasApostas from "./pages/MinhasApostas";
import PrivacyPolicy from "./pages/PrivacyPolicy";
import ArenaTraderSports from "./pages/ArenaTraderSports";
import ArenaTraderSportsRankingMonthly from "./pages/ArenaTraderSportsRankingMonthly";
import LiveMatchDetail from "./pages/LiveMatchDetail";
import TradingHistory from "./pages/TradingHistory";
import MycroftSinaisAprovados from "./pages/MycroftSinaisAprovados";
import LiquidationsHistory from "./pages/LiquidationsHistory";
import SportsPerformance from "./pages/SportsPerformance";
import ModoTreino from "./pages/ModoTreino";
import Historico from "./pages/Historico";
import BetHistory from "./pages/BetHistory";
import Punter from "./pages/Punter";
import PunterAnalytics from "./pages/PunterAnalytics";
import PunterWidgets from "./pages/PunterWidgets";
import PunterConfig from "./pages/PunterConfig";
import PunterImport from "./pages/PunterImport";
import PunterBetfairReal from "./pages/PunterBetfairReal";
import PunterFunctions from "./pages/PunterFunctions";
import PunterBancaVirtual from "./pages/PunterBancaVirtual";
import PunterAprovadas from "./pages/PunterAprovadas";
import PunterComunidade from "./pages/PunterComunidade";
import PunterMenu from "./pages/PunterMenu";
import ArenaTrader from "./pages/ArenaTrader";
import ArenaPoker from "./pages/ArenaPoker";
import ArenaTraderRankings from "./pages/ArenaTraderRankings";
import ArenaTraderSeason from "./pages/ArenaTraderSeason";
import ArenaBlackjack from "./pages/ArenaBlackjack";
import MycroftMemory from "./pages/MycroftMemory";
import AdminDashboard from "./pages/AdminDashboard";
import AdminChatAnalytics from "./pages/AdminChatAnalytics";
import AdminPushTest from "./pages/AdminPushTest";
import AdminSettlementLog from "./pages/AdminSettlementLog";
import { getAudioCacheStats } from "./services/audioCacheService";
import { getHorusCacheProgress } from "./services/horusCacheService";

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
            <Routes>
              <Route path="/" element={<LandingPage />} />
              <Route path="/lobby" element={<Index />} />
              <Route path="/auth" element={<Auth />} />
              <Route path="/privacidade" element={<PrivacyPolicy />} />
              <Route path="/paywall" element={<Paywall />} />
              <Route path="/oferta-especial" element={<OfertaEspecial />} />
              <Route path="/arena-trader-sports" element={<RequireSubscription><ArenaTraderSports /></RequireSubscription>} />
              <Route path="/arena-trader-sports/jogo/:id" element={<RequireSubscription><LiveMatchDetail /></RequireSubscription>} />
              <Route path="/arena-trader-sports/historico" element={<RequireSubscription><TradingHistory /></RequireSubscription>} />
              <Route path="/arena-trader-sports/sinais-aprovados" element={<RequireSubscription><MycroftSinaisAprovados /></RequireSubscription>} />
              <Route path="/arena-trader-sports/liquidacoes" element={<RequireSubscription><LiquidationsHistory /></RequireSubscription>} />
              <Route path="/arena-trader-sports/performance" element={<RequireSubscription><SportsPerformance /></RequireSubscription>} />
              <Route path="/arena-trader-sports/ranking-mensal" element={<RequireSubscription><ArenaTraderSportsRankingMonthly /></RequireSubscription>} />
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
              <Route path="*" element={<NotFound />} />
            </Routes>
          </BrowserRouter>
        </TooltipProvider>
      </QueryClientProvider>
    </ErrorBoundary>
  );
};

export default App;
