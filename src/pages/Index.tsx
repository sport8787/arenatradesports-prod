import { useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Activity, Target, LineChart, Trophy, LogOut, Settings2 } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import logoOraculo from '@/assets/logo_oraculo_mycroft.png';
import { supabase } from '@/integrations/supabase/client';

const heroArenas = [
  {
    title: 'Arena Punter',
    description: 'Entradas pré-jogo aprovados pelo Mycroft com edge matemático real. O coração do sistema.',
    href: '/punter',
    icon: Target,
    badge: 'CORE',
    accent: 'from-amber-500/30 via-amber-600/15 to-amber-900/10 border-amber-500/60',
    badgeClass: 'bg-amber-500 text-black',
  },
  {
    title: 'Arena Live',
    description: 'Trade ao vivo com leitura situacional, LABAREDA e cash-out em tempo real.',
    href: '/arena-trader-sports',
    icon: Activity,
    badge: 'AO VIVO',
    accent: 'from-rose-500/30 via-rose-600/15 to-rose-900/10 border-rose-500/60',
    badgeClass: 'bg-rose-500 text-white',
  },
];

const sideArenas = [
  {
    title: 'Arena Trader Financeiro',
    description: 'Experimental — WIN, WDO e BTC sendo testados com a lógica do Trader Sports. Resultados não auditados.',
    href: '/arena-trader',
    icon: LineChart,
    badge: 'BETA',
    accent: 'from-sky-500/15 to-sky-700/5 border-sky-500/30',
    badgeClass: 'bg-amber-500 text-black',
  },
  {
    title: 'Liga Mycroft',
    description: 'Ranking de ROI e recompensas BC.',
    href: '/loja-bc',
    icon: Trophy,
    badge: null,
    accent: 'from-purple-500/15 to-purple-700/5 border-purple-500/30',
  },
  {
    title: 'Funções Avançadas',
    description: 'Configurações, ferramentas e ajustes do Oráculo.',
    href: '/menu',
    icon: Settings2,
    badge: null,
    accent: 'from-slate-500/15 to-slate-700/5 border-slate-500/30',
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

        {/* FAIXA 1 — Arenas principais (destaque) */}
        <section className="mb-10">
          <p className="font-mono text-[10px] uppercase tracking-[0.25em] text-muted-foreground/80 mb-3 px-1">
            Onde o Mycroft trabalha pra você
          </p>
          <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
            {heroArenas.map((arena, i) => {
              const Icon = arena.icon;
              return (
                <motion.button
                  key={arena.href}
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.06 }}
                  onClick={() => navigate(arena.href)}
                  className={`group relative rounded-2xl border-2 bg-gradient-to-br ${arena.accent} p-7 sm:p-8 text-left transition hover:scale-[1.02] hover:shadow-2xl shadow-lg`}
                >
                  {arena.badge && (
                    <span className={`absolute top-4 right-4 rounded-full px-2.5 py-1 text-[10px] font-bold tracking-wider ${arena.badgeClass}`}>
                      {arena.badge}
                    </span>
                  )}
                  <div className="mb-5 flex h-14 w-14 items-center justify-center rounded-xl bg-background/50 backdrop-blur">
                    <Icon className="h-7 w-7" />
                  </div>
                  <div className="text-xl sm:text-2xl font-bold">{arena.title}</div>
                  <div className="mt-2 text-sm sm:text-base text-muted-foreground leading-relaxed">
                    {arena.description}
                  </div>
                </motion.button>
              );
            })}
          </div>
        </section>

        {/* FAIXA 2 — Ferramentas complementares */}
        <section>
          <p className="font-mono text-[10px] uppercase tracking-[0.25em] text-muted-foreground/80 mb-3 px-1">
            Ferramentas complementares
          </p>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            {sideArenas.map((arena, i) => {
              const Icon = arena.icon;
              return (
                <motion.button
                  key={arena.href}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.12 + i * 0.04 }}
                  onClick={() => navigate(arena.href)}
                  className={`group relative rounded-xl border bg-gradient-to-br ${arena.accent} p-4 text-left transition hover:scale-[1.02] hover:shadow-lg`}
                >
                  {arena.badge && (
                    <span className={`absolute top-2 right-2 rounded-full backdrop-blur px-2 py-0.5 text-[9px] font-bold tracking-wider border ${
                      arena.badge === 'BETA'
                        ? 'bg-amber-500/15 text-amber-400 border-amber-500/40'
                        : 'bg-background/70 text-foreground/80 border-border/50'
                    }`}>
                      {arena.badge}
                    </span>
                  )}
                  <div className="mb-3 flex h-9 w-9 items-center justify-center rounded-lg bg-background/40">
                    <Icon className="h-4 w-4" />
                  </div>
                  <div className="text-sm font-semibold leading-tight">{arena.title}</div>
                  <div className="mt-1 text-xs text-muted-foreground leading-snug">
                    {arena.description}
                  </div>
                </motion.button>
              );
            })}
          </div>
        </section>
      </main>
    </div>
  );
}
