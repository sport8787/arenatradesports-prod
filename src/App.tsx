import { useEffect } from "react";
import { identifyUser, track } from "@/lib/analytics";
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
import Index from "./pages/Index";
import Auth from "./pages/Auth";
import NotFound from "./pages/NotFound";
import MinhasApostas from "./pages/MinhasApostas";
import PrivacyPolicy from "./pages/PrivacyPolicy";
import ArenaTraderSports from "./pages/ArenaTraderSports";
import ModoTreino from "./pages/ModoTreino";
import Historico from "./pages/Historico";
import BetHistory from "./pages/BetHistory";
import Punter from "./pages/Punter";
import PunterAnalytics from "./pages/PunterAnalytics";
import PunterWidgets from "./pages/PunterWidgets";
import PunterConfig from "./pages/PunterConfig";
import PunterImport from "./pages/PunterImport";
import ArenaTrader from "./pages/ArenaTrader";
import ArenaTraderRankings from "./pages/ArenaTraderRankings";
import ArenaTraderSeason from "./pages/ArenaTraderSeason";
import ArenaBlackjack from "./pages/ArenaBlackjack";
import MycroftMemory from "./pages/MycroftMemory";
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
    initAnalytics();
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
              <Route path="/arena-trader-sports" element={<RequireSubscription><ArenaTraderSports /></RequireSubscription>} />
              <Route path="/modo-treino" element={<RequireSubscription><ModoTreino /></RequireSubscription>} />
              <Route path="/historico" element={<RequireSubscription><Historico /></RequireSubscription>} />
              <Route path="/apostas" element={<RequireSubscription><BetHistory /></RequireSubscription>} />
              <Route path="/minhas-apostas" element={<RequireSubscription><MinhasApostas /></RequireSubscription>} />
              <Route path="/punter" element={<RequireSubscription><Punter /></RequireSubscription>} />
              <Route path="/punter/widgets" element={<RequireSubscription><PunterWidgets /></RequireSubscription>} />
              <Route path="/punter/analytics" element={<RequireSubscription><PunterAnalytics /></RequireSubscription>} />
              <Route path="/punter/config" element={<RequireSubscription><PunterConfig /></RequireSubscription>} />
              <Route path="/punter/import" element={<RequireSubscription><PunterImport /></RequireSubscription>} />
              <Route path="/punter/multiplas" element={<RequireSubscription><MultiBetOptimizer /></RequireSubscription>} />
              <Route path="/arena-trader" element={<RequireSubscription><ArenaTrader /></RequireSubscription>} />
              <Route path="/arena-trader/rankings" element={<RequireSubscription><ArenaTraderRankings /></RequireSubscription>} />
              <Route path="/arena-trader/season" element={<RequireSubscription><ArenaTraderSeason /></RequireSubscription>} />
              <Route path="/arena-blackjack" element={<RequireSubscription><ArenaBlackjack /></RequireSubscription>} />
              <Route path="/mycroft-memory" element={<RequireSubscription><MycroftMemory /></RequireSubscription>} />
              <Route path="*" element={<NotFound />} />
            </Routes>
          </BrowserRouter>
        </TooltipProvider>
      </QueryClientProvider>
    </ErrorBoundary>
  );
};

export default App;
