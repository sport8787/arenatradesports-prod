import { useEffect } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import Index from "./pages/Index";
import Auth from "./pages/Auth";
import GameRoom from "./pages/GameRoom";
import SinglePlayerRoom from "./pages/SinglePlayerRoom";
import RankingsPage from "./pages/RankingsPage";
import BlackMarket from "./pages/BlackMarket";
import HowToPlay from "./pages/HowToPlay";
import AdminQuestions from "./pages/AdminQuestions";
import NotFound from "./pages/NotFound";
import { getAudioCacheStats } from "./services/audioCacheService";
import { preCacheMycroftPhrases } from "./services/mycroftBlockService";
import { preCacheHorusPhrases, getHorusCacheProgress } from "./services/horusCacheService";
import { AudioDebugPanel } from "./components/game/AudioDebugPanel";

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
  // Pre-cache Mycroft and Horus phrases on app start (background)
  useEffect(() => {
    // Run Mycroft pre-caching first (smaller set)
    const mycroftTimer = setTimeout(() => {
      console.log('[App] 🎭 Starting background pre-cache...');
      preCacheMycroftPhrases().catch(console.error);
    }, 2000);
    
    // Run Horus pre-caching after Mycroft (larger set, staggered)
    const horusTimer = setTimeout(() => {
      preCacheHorusPhrases().catch(console.error);
    }, 5000);
    
    return () => {
      clearTimeout(mycroftTimer);
      clearTimeout(horusTimer);
    };
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <AudioDebugPanel />
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<Index />} />
            <Route path="/auth" element={<Auth />} />
            <Route path="/room/:roomId" element={<GameRoom />} />
            <Route path="/single-player" element={<SinglePlayerRoom />} />
            <Route path="/rankings" element={<RankingsPage />} />
            <Route path="/mercado-negro" element={<BlackMarket />} />
            <Route path="/como-jogar" element={<HowToPlay />} />
            <Route path="/admin/questions" element={<AdminQuestions />} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </TooltipProvider>
    </QueryClientProvider>
  );
};

export default App;
