import { useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Activity, Target, LineChart, Spade, Trophy, LogOut, Settings2 } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import logoOraculo from '@/assets/logo_oraculo_mycroft.png';
import { supabase } from '@/integrations/supabase/client';

const arenas = [
  {
    title: 'Arena Punter',
    description: 'Sinais aprovados pelo Oráculo Mycroft para apostas pré-jogo.',
    href: '/punter',
    icon: Target,
    accent: 'from-amber-500/20 to-amber-700/10 border-amber-500/40',
  },
  {
    title: 'Arena Trader Sports',
    description: 'Trade ao vivo com leitura situacional em tempo real.',
    href: '/arena-trader-sports',
    icon: Activity,
    accent: 'from-emerald-500/20 to-emerald-700/10 border-emerald-500/40',
  },
  {
    title: 'Arena Trader Financeiro',
    description: 'WIN, WDO e BTC com a mesma lógica do Trader Sports.',
    href: '/arena-trader',
    icon: LineChart,
    accent: 'from-sky-500/20 to-sky-700/10 border-sky-500/40',
  },
  {
    title: 'Arena Blackjack',
    description: 'Contagem de cartas e estratégia Hi-Lo com Mycroft.',
    href: '/arena-blackjack',
    icon: Spade,
    accent: 'from-rose-500/20 to-rose-700/10 border-rose-500/40',
  },
  {
    title: 'Liga Mycroft',
    description: 'Ranking de ROI e recompensas BC.',
    href: '/loja-bc',
    icon: Trophy,
    accent: 'from-purple-500/20 to-purple-700/10 border-purple-500/40',
  },
  {
    title: 'Funções Avançadas',
    description: 'Configurações, ferramentas e ajustes do Oráculo.',
    href: '/menu',
    icon: Settings2,
    accent: 'from-slate-500/20 to-slate-700/10 border-slate-500/40',
  },
];

export default function Index() {
  const navigate = useNavigate();
  const { isAuthenticated, loading: authLoading, profile } = useAuth();

  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      navigate('/');
    }
  }, [isAuthenticated, authLoading, navigate]);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate('/');
  };

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="border-b border-border/50 bg-card/40 backdrop-blur">
        <div className="container mx-auto flex items-center justify-between px-4 py-3">
          <Link to="/lobby" className="flex items-center gap-3">
            <img src={logoOraculo} alt="Oráculo Mycroft" className="h-10 w-10" />
            <div className="leading-tight">
              <div className="text-base font-semibold">Oráculo Mycroft</div>
              <div className="text-xs text-muted-foreground">Lobby de Arenas</div>
            </div>
          </Link>
          <Button variant="ghost" size="sm" onClick={handleLogout} className="gap-2">
            <LogOut className="h-4 w-4" />
            Sair
          </Button>
        </div>
      </header>

      <main className="container mx-auto px-4 py-10">
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-8"
        >
          <h1 className="text-2xl font-bold sm:text-3xl">
            Olá{profile?.username ? `, ${profile.username}` : ''}.
          </h1>
          <p className="text-sm text-muted-foreground sm:text-base">
            Escolha em qual arena o Mycroft vai trabalhar para você agora.
          </p>
        </motion.div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {arenas.map((arena, i) => {
            const Icon = arena.icon;
            return (
              <motion.button
                key={arena.href}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.05 }}
                onClick={() => navigate(arena.href)}
                className={`group rounded-2xl border bg-gradient-to-br ${arena.accent} p-6 text-left transition hover:scale-[1.02] hover:shadow-lg`}
              >
                <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-background/40">
                  <Icon className="h-6 w-6" />
                </div>
                <div className="text-lg font-semibold">{arena.title}</div>
                <div className="mt-1 text-sm text-muted-foreground">
                  {arena.description}
                </div>
              </motion.button>
            );
          })}
        </div>
      </main>
    </div>
  );
}
