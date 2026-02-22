import { useEffect } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import ErrorBoundary from "@/components/ErrorBoundary";
import { TrialBanner } from "@/components/TrialBanner";
import { RequireSubscription } from "@/components/RequireSubscription";
import LandingPage from "./pages/LandingPage";
import Paywall from "./pages/Paywall";
import Index from "./pages/Index";
import Auth from "./pages/Auth";
import GameRoom from "./pages/GameRoom";
import SinglePlayerRoom from "./pages/SinglePlayerRoom";
import RankingsPage from "./pages/RankingsPage";
import BlackMarket from "./pages/BlackMarket";
import HowToEarnBC from "./pages/HowToEarnBC";
import HowToPlay from "./pages/HowToPlay";
import AdminQuestions from "./pages/AdminQuestions";
import AdminFounderCases from "./pages/AdminFounderCases";
import PresenterRoom from "./pages/PresenterRoom";
import PlayerScreen from "./pages/PlayerScreen";
import NotFound from "./pages/NotFound";
import PrivacyPolicy from "./pages/PrivacyPolicy";
import ArenaPoker from "./pages/ArenaPoker";
import ArenaPokerRankings from "./pages/ArenaPokerRankings";
import ArenaTrader from "./pages/ArenaTrader";
import ArenaTraderRankings from "./pages/ArenaTraderRankings";
import ArenaTraderSeason from "./pages/ArenaTraderSeason";
import Dashboard from "./pages/Dashboard";
import ModoTreino from "./pages/ModoTreino";
import Historico from "./pages/Historico";
import { getAudioCacheStats } from "./services/audioCacheService";
import { getHorusCacheProgress } from "./services/horusCacheService";

const queryClient = new QueryClient();

// Expose cache stats globally for debugging
if (typeof window !== 'undefined') {
  (window as any).getAudioCacheStats = () => {
    const stats = getAudioCacheStats();
    const horusProgress = getHorusCacheProgress();
    console.log('📊 AUDIO CACHE STATS:', stats);
    console.log(`   🟢 Cache Hits: ${stats.cacheHits}`);
    console.log(`   🔴 Cache Misses: ${stats.cacheMisses}`);
    console.log(`   ⛔ Blocked Duplicates: ${stats.blockedDuplicates}`);
    console.log(`   💰 Credits Saved: ${stats.estimatedCreditsSaved} chars`);
    console.log(`   📁 Memory Cache Size: ${stats.memoryCacheSize}`);
    console.log(`   🔒 Session Requests: ${stats.sessionRequests}`);
    console.log(`   🦅 Horus Pre-cache: ${horusProgress.cached}/${horusProgress.total} (${horusProgress.completed ? 'complete' : 'in progress'})`);
    return { ...stats, horusProgress };
  };
  console.log('💡 Debug: Call window.getAudioCacheStats() to view audio cache statistics');
}

const App = () => {
  // NOTE: Pre-cache was DISABLED from automatic startup
  // The pre-cache now only runs when user enters a game room (SinglePlayerRoom/GameRoom)
  // This prevents ElevenLabs credit consumption on the landing page
  useEffect(() => {
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
              {/* HIDDEN: Arenas não-financeiras - código mantido para reuso futuro */}
              {/* <Route path="/room/:roomId" element={<GameRoom />} /> */}
              {/* <Route path="/single-player" element={<SinglePlayerRoom />} /> */}
              {/* <Route path="/presenter-room/:roomId" element={<PresenterRoom />} /> */}
              {/* <Route path="/player-screen/:roomId" element={<PlayerScreen />} /> */}
              {/* <Route path="/rankings" element={<RankingsPage />} /> */}
              {/* <Route path="/mercado-negro" element={<BlackMarket />} /> */}
              {/* <Route path="/como-ganhar-bc" element={<HowToEarnBC />} /> */}
              {/* <Route path="/como-jogar" element={<HowToPlay />} /> */}
              {/* <Route path="/admin/questions" element={<AdminQuestions />} /> */}
              {/* <Route path="/admin/founder-cases" element={<AdminFounderCases />} /> */}
              <Route path="/privacidade" element={<PrivacyPolicy />} />
              <Route path="/paywall" element={<Paywall />} />
              <Route path="/dashboard" element={<RequireSubscription><Dashboard /></RequireSubscription>} />
              {/* <Route path="/arena-poker" element={<ArenaPoker />} /> */}
              {/* <Route path="/arena-poker/rankings" element={<ArenaPokerRankings />} /> */}
              <Route path="/modo-treino" element={<RequireSubscription><ModoTreino /></RequireSubscription>} />
              <Route path="/historico" element={<RequireSubscription><Historico /></RequireSubscription>} />
              <Route path="/arena-trader" element={<RequireSubscription><ArenaTrader /></RequireSubscription>} />
              <Route path="/arena-trader/rankings" element={<RequireSubscription><ArenaTraderRankings /></RequireSubscription>} />
              <Route path="/arena-trader/season" element={<RequireSubscription><ArenaTraderSeason /></RequireSubscription>} />
              <Route path="*" element={<NotFound />} />
            </Routes>
          </BrowserRouter>
        </TooltipProvider>
      </QueryClientProvider>
    </ErrorBoundary>
  );
};

export default App;
