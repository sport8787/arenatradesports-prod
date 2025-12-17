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

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
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

export default App;
