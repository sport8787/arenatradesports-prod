import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowLeft, Trophy, Crown, Ticket, Target, Flame, Medal, Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { PharaohIcon } from '@/components/arena-poker/PersonaIcons';

interface ArenaRanking {
  id: string;
  username: string;
  apc_balance: number;
  total_sessions: number;
  total_scenarios_won: number;
  total_scenarios_played: number;
  best_win_streak: number;
  champion_titles: number;
  golden_tickets: number;
}

function getTier(apc: number) {
  if (apc >= 50000) return { name: 'Faraó', color: 'text-amber-400', bg: 'from-amber-900/40 to-yellow-900/20', icon: '👑' };
  if (apc >= 20000) return { name: 'Diamante', color: 'text-cyan-400', bg: 'from-cyan-900/40 to-blue-900/20', icon: '💎' };
  if (apc >= 10000) return { name: 'Platina', color: 'text-slate-300', bg: 'from-slate-700/40 to-slate-900/20', icon: '⚡' };
  if (apc >= 5000) return { name: 'Ouro', color: 'text-yellow-500', bg: 'from-yellow-900/40 to-amber-900/20', icon: '🏆' };
  if (apc >= 1000) return { name: 'Prata', color: 'text-gray-400', bg: 'from-gray-700/40 to-gray-900/20', icon: '🥈' };
  return { name: 'Bronze', color: 'text-orange-500', bg: 'from-orange-900/40 to-stone-900/20', icon: '🥉' };
}

function PositionBadge({ position }: { position: number }) {
  if (position === 1) return <div className="w-8 h-8 rounded-full bg-gradient-to-br from-amber-400 to-yellow-600 flex items-center justify-center text-black font-bold text-sm shadow-lg shadow-amber-500/30">1</div>;
  if (position === 2) return <div className="w-8 h-8 rounded-full bg-gradient-to-br from-slate-300 to-slate-500 flex items-center justify-center text-black font-bold text-sm">2</div>;
  if (position === 3) return <div className="w-8 h-8 rounded-full bg-gradient-to-br from-orange-500 to-amber-700 flex items-center justify-center text-black font-bold text-sm">3</div>;
  return <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center text-muted-foreground font-mono text-sm">{position}</div>;
}

function RankRow({ rank, position, sortKey }: { rank: ArenaRanking; position: number; sortKey: string }) {
  const tier = getTier(rank.apc_balance);
  const winRate = rank.total_scenarios_played > 0
    ? Math.round((rank.total_scenarios_won / rank.total_scenarios_played) * 100)
    : 0;

  return (
    <motion.div
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: position * 0.03 }}
    >
      <Card className={`border-border/50 bg-gradient-to-r ${position <= 3 ? tier.bg : 'from-card to-card'} hover:border-primary/30 transition-colors`}>
        <CardContent className="p-3 flex items-center gap-3">
          <PositionBadge position={position} />

          <Avatar className="h-9 w-9 border border-border">
            <AvatarFallback className="bg-muted text-xs font-bold">
              {rank.username.slice(0, 2).toUpperCase()}
            </AvatarFallback>
          </Avatar>

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <span className="font-semibold text-sm truncate">{rank.username}</span>
              <span className={`text-xs ${tier.color}`}>{tier.icon} {tier.name}</span>
            </div>
            <div className="flex items-center gap-3 text-xs text-muted-foreground mt-0.5">
              <span>{winRate}% win</span>
              <span>{rank.total_sessions} sessões</span>
            </div>
          </div>

          <div className="text-right flex flex-col items-end gap-1">
            {sortKey === 'apc' && (
              <span className="font-orbitron text-sm font-bold text-amber-400">{rank.apc_balance.toLocaleString()} APC</span>
            )}
            {sortKey === 'wins' && (
              <span className="font-orbitron text-sm font-bold text-emerald-400">{rank.total_scenarios_won} vitórias</span>
            )}
            {sortKey === 'champion' && (
              <div className="flex items-center gap-1">
                <Crown className="w-4 h-4 text-amber-400" />
                <span className="font-orbitron text-sm font-bold text-amber-400">{rank.champion_titles}</span>
              </div>
            )}
            {sortKey === 'tickets' && (
              <div className="flex items-center gap-1">
                <Ticket className="w-4 h-4 text-yellow-400" />
                <span className="font-orbitron text-sm font-bold text-yellow-400">{rank.golden_tickets}</span>
              </div>
            )}
            {rank.golden_tickets > 0 && sortKey !== 'tickets' && (
              <Badge variant="outline" className="text-[10px] border-yellow-600/50 text-yellow-500 px-1.5 py-0">
                🎫 {rank.golden_tickets}
              </Badge>
            )}
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}

export default function ArenaPokerRankings() {
  const [rankings, setRankings] = useState<ArenaRanking[]>([]);
  const [loading, setLoading] = useState(true);
  const [sortKey, setSortKey] = useState('apc');

  useEffect(() => {
    async function fetch() {
      const orderCol = sortKey === 'apc' ? 'apc_balance'
        : sortKey === 'wins' ? 'total_scenarios_won'
        : sortKey === 'champion' ? 'champion_titles'
        : 'golden_tickets';

      const { data } = await supabase
        .from('arena_poker_rankings')
        .select('*')
        .order(orderCol, { ascending: false })
        .limit(100);

      setRankings((data as ArenaRanking[]) || []);
      setLoading(false);
    }
    setLoading(true);
    fetch();
  }, [sortKey]);

  return (
    <div className="min-h-screen bg-background p-4 md:p-8">
      <div className="max-w-2xl mx-auto space-y-5">
        {/* Header */}
        <div>
          <Link to="/arena-poker" className="flex items-center gap-2 text-muted-foreground hover:text-foreground mb-3 text-sm">
            <ArrowLeft className="w-4 h-4" />
            Voltar à Arena
          </Link>
          <div className="flex items-center gap-3">
            <PharaohIcon size={32} className="text-amber-400" />
            <div>
              <h1 className="font-orbitron text-2xl font-bold bg-gradient-to-r from-amber-400 to-yellow-600 bg-clip-text text-transparent">
                Ranking Arena Poker
              </h1>
              <p className="text-xs text-muted-foreground">{rankings.length} jogadores classificados</p>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <Tabs value={sortKey} onValueChange={setSortKey}>
          <TabsList className="grid grid-cols-4 w-full">
            <TabsTrigger value="apc" className="text-xs gap-1"><Flame className="w-3 h-3" /> APC</TabsTrigger>
            <TabsTrigger value="wins" className="text-xs gap-1"><Target className="w-3 h-3" /> Vitórias</TabsTrigger>
            <TabsTrigger value="champion" className="text-xs gap-1"><Crown className="w-3 h-3" /> Títulos</TabsTrigger>
            <TabsTrigger value="tickets" className="text-xs gap-1"><Ticket className="w-3 h-3" /> Tikets</TabsTrigger>
          </TabsList>

          {['apc', 'wins', 'champion', 'tickets'].map(key => (
            <TabsContent key={key} value={key} className="mt-4 space-y-2">
              {loading ? (
                <div className="flex justify-center py-16">
                  <Loader2 className="w-8 h-8 text-primary animate-spin" />
                </div>
              ) : rankings.length === 0 ? (
                <div className="text-center py-16 text-muted-foreground">
                  <Medal className="w-12 h-12 mx-auto mb-3 opacity-30" />
                  <p>Nenhum jogador no ranking ainda.</p>
                  <Link to="/arena-poker" className="text-primary text-sm hover:underline mt-2 inline-block">
                    Jogue para aparecer aqui!
                  </Link>
                </div>
              ) : (
                rankings.map((r, i) => (
                  <RankRow key={r.id} rank={r} position={i + 1} sortKey={key} />
                ))
              )}
            </TabsContent>
          ))}
        </Tabs>
      </div>
    </div>
  );
}
