import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Users, Eye, TrendingUp, AlertTriangle, Shield, Loader2, ChevronRight, Database, Zap } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import type { ParsedHand } from '@/lib/handHistoryParser';
import { toast } from 'sonner';

interface VillainData {
  name: string;
  hands_observed: number;
  hands_won: number;
  estimated_vpip: number;
  estimated_pfr: number;
  estimated_aggression: number;
  estimated_3bet: number;
  estimated_fold_to_3bet: number;
  showdown_frequency: number;
  style_summary: string;
  exploitable_tendencies: string;
  danger_level: string;
  tags: string[];
  notable_plays: string;
  all_ins: number;
  showdowns: number;
  biggest_pot_bb: number;
}

interface StoredVillain {
  id: string;
  player_name: string;
  platform: string;
  times_seen: number;
  total_hands_against: number;
  estimated_vpip: number | null;
  estimated_pfr: number | null;
  estimated_aggression: number | null;
  ai_style_summary: string | null;
  ai_exploitable_tendencies: string | null;
  ai_danger_level: string | null;
  tags: string[];
  first_seen_at: string;
  last_seen_at: string;
}

interface VillainProfilesPanelProps {
  hands: ParsedHand[];
  onClose: () => void;
}

const dangerColors: Record<string, string> = {
  low: 'text-green-400 border-green-500/30 bg-green-500/10',
  medium: 'text-[hsl(var(--arena-gold))] border-[hsl(var(--arena-gold)_/_0.3)] bg-[hsl(var(--arena-gold)_/_0.1)]',
  high: 'text-orange-400 border-orange-500/30 bg-orange-500/10',
  elite: 'text-red-400 border-red-500/30 bg-red-500/10',
};

const dangerLabels: Record<string, string> = {
  low: 'FISH',
  medium: 'REGULAR',
  high: 'SHARK',
  elite: 'ELITE',
};

const VillainProfilesPanel = ({ hands, onClose }: VillainProfilesPanelProps) => {
  const [loading, setLoading] = useState(false);
  const [villains, setVillains] = useState<VillainData[]>([]);
  const [storedVillains, setStoredVillains] = useState<StoredVillain[]>([]);
  const [selectedVillain, setSelectedVillain] = useState<VillainData | StoredVillain | null>(null);
  const [fromCache, setFromCache] = useState(false);
  const [view, setView] = useState<'scan' | 'database'>('scan');

  useEffect(() => {
    loadStoredVillains();
  }, []);

  const loadStoredVillains = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data } = await supabase
      .from('villain_profiles')
      .select('*')
      .eq('user_id', user.id)
      .order('times_seen', { ascending: false });

    if (data) setStoredVillains(data as StoredVillain[]);
  };

  const scanVillains = async () => {
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      const rawHands = hands.map(h => h.raw);

      // Detect platform
      const firstHand = rawHands[0] || '';
      let platform = 'unknown';
      if (/pokerstars/i.test(firstHand)) platform = 'PokerStars';
      else if (/ggpoker/i.test(firstHand)) platform = 'GGPoker';
      else if (/888poker/i.test(firstHand)) platform = '888poker';
      else if (/partypoker/i.test(firstHand)) platform = 'PartyPoker';
      else if (/full tilt/i.test(firstHand)) platform = 'FullTilt';
      else if (/winamax/i.test(firstHand)) platform = 'Winamax';

      const { data: result, error } = await supabase.functions.invoke('arena-poker-villain-profile', {
        body: {
          hands: rawHands,
          platform,
          userId: user?.id,
        },
      });

      if (error) throw error;
      if (result?.error) {
        if (result.error === 'RATE_LIMITED') {
          toast.error('Servidor ocupado. Tente novamente em alguns segundos.');
        } else {
          throw new Error(result.error);
        }
        return;
      }

      setFromCache(!!result?._cached);
      setVillains(result.players || []);
      toast.success(result?._cached ? 'Perfis carregados do cache!' : `${result.players?.length || 0} vilões identificados!`);
      await loadStoredVillains();
    } catch (e) {
      console.error('Villain profiling error:', e);
      toast.error('Erro ao analisar vilões. Tente novamente.');
    } finally {
      setLoading(false);
    }
  };

  const isStoredVillain = (v: any): v is StoredVillain => 'player_name' in v;

  const renderVillainCard = (villain: VillainData | StoredVillain, idx: number) => {
    const name = isStoredVillain(villain) ? villain.player_name : villain.name;
    const danger = isStoredVillain(villain) ? (villain.ai_danger_level || 'medium') : villain.danger_level;
    const vpip = isStoredVillain(villain) ? villain.estimated_vpip : villain.estimated_vpip;
    const pfr = isStoredVillain(villain) ? villain.estimated_pfr : villain.estimated_pfr;
    const timesSeen = isStoredVillain(villain) ? villain.times_seen : 1;
    const handsCount = isStoredVillain(villain) ? villain.total_hands_against : villain.hands_observed;
    const tags = isStoredVillain(villain) ? villain.tags : villain.tags;

    return (
      <motion.div
        key={idx}
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: idx * 0.05 }}
        onClick={() => setSelectedVillain(villain)}
        className="border border-border/50 rounded-lg p-3 cursor-pointer hover:border-[hsl(var(--arena-gold)_/_0.4)] hover:bg-[hsl(var(--arena-gold)_/_0.02)] transition-all group"
      >
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <span className="font-mono text-sm font-bold text-foreground">{name}</span>
            {timesSeen > 1 && (
              <span className="px-1.5 py-0.5 rounded text-[9px] font-mono font-bold bg-[hsl(var(--arena-cyan)_/_0.15)] text-[hsl(var(--arena-cyan))]">
                ×{timesSeen}
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            <span className={`px-2 py-0.5 rounded-full border text-[9px] font-mono font-bold uppercase ${dangerColors[danger] || dangerColors.medium}`}>
              {dangerLabels[danger] || danger}
            </span>
            <ChevronRight className="w-3.5 h-3.5 text-muted-foreground group-hover:text-[hsl(var(--arena-gold))] transition-colors" />
          </div>
        </div>

        <div className="grid grid-cols-3 gap-2 mb-2">
          <div className="text-center">
            <div className="font-mono text-xs text-muted-foreground">VPIP</div>
            <div className="font-mono text-sm font-bold text-foreground">{vpip != null ? `${Math.round(vpip)}%` : '—'}</div>
          </div>
          <div className="text-center">
            <div className="font-mono text-xs text-muted-foreground">PFR</div>
            <div className="font-mono text-sm font-bold text-foreground">{pfr != null ? `${Math.round(pfr)}%` : '—'}</div>
          </div>
          <div className="text-center">
            <div className="font-mono text-xs text-muted-foreground">MÃOS</div>
            <div className="font-mono text-sm font-bold text-foreground">{handsCount}</div>
          </div>
        </div>

        {tags && tags.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {tags.slice(0, 3).map((tag, i) => (
              <span key={i} className="px-1.5 py-0.5 rounded border border-border/50 text-[9px] font-mono text-muted-foreground">
                {tag}
              </span>
            ))}
          </div>
        )}
      </motion.div>
    );
  };

  const renderVillainDetail = () => {
    if (!selectedVillain) return null;
    const v = selectedVillain;
    const name = isStoredVillain(v) ? v.player_name : v.name;
    const danger = isStoredVillain(v) ? (v.ai_danger_level || 'medium') : v.danger_level;
    const style = isStoredVillain(v) ? v.ai_style_summary : v.style_summary;
    const exploits = isStoredVillain(v) ? v.ai_exploitable_tendencies : v.exploitable_tendencies;
    const vpip = isStoredVillain(v) ? v.estimated_vpip : v.estimated_vpip;
    const pfr = isStoredVillain(v) ? v.estimated_pfr : v.estimated_pfr;
    const aggression = isStoredVillain(v) ? v.estimated_aggression : v.estimated_aggression;
    const tags = isStoredVillain(v) ? v.tags : v.tags;

    return (
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-4">
        <button onClick={() => setSelectedVillain(null)} className="font-mono text-xs text-[hsl(var(--arena-cyan))] hover:underline">
          ← Voltar à lista
        </button>

        <div className="text-center space-y-2">
          <h3 className="font-mono text-xl font-bold text-foreground">{name}</h3>
          <span className={`inline-flex px-3 py-1 rounded-full border text-xs font-mono font-bold uppercase ${dangerColors[danger] || dangerColors.medium}`}>
            {dangerLabels[danger] || danger}
          </span>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-3 gap-3">
          {[
            { label: 'VPIP', value: vpip, color: 'text-[hsl(var(--arena-gold))]' },
            { label: 'PFR', value: pfr, color: 'text-[hsl(var(--arena-cyan))]' },
            { label: 'AGG', value: aggression, color: 'text-orange-400' },
          ].map((stat, i) => (
            <div key={i} className="border border-border/50 rounded-lg p-3 text-center">
              <div className="font-mono text-[10px] text-muted-foreground">{stat.label}</div>
              <div className={`font-mono text-2xl font-bold ${stat.color}`}>
                {stat.value != null ? Math.round(stat.value) : '—'}
              </div>
            </div>
          ))}
        </div>

        {!isStoredVillain(v) && (
          <div className="grid grid-cols-3 gap-3">
            {[
              { label: '3BET', value: v.estimated_3bet },
              { label: 'F/3BET', value: v.estimated_fold_to_3bet },
              { label: 'SD%', value: v.showdown_frequency },
            ].map((stat, i) => (
              <div key={i} className="border border-border/50 rounded-lg p-2 text-center">
                <div className="font-mono text-[9px] text-muted-foreground">{stat.label}</div>
                <div className="font-mono text-lg font-bold text-foreground">
                  {stat.value != null ? Math.round(stat.value) : '—'}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Style Summary */}
        {style && (
          <div className="border border-[hsl(var(--arena-gold)_/_0.2)] bg-[hsl(var(--arena-gold)_/_0.03)] rounded-lg p-4">
            <div className="flex items-center gap-2 mb-2">
              <Eye className="w-4 h-4 text-[hsl(var(--arena-gold))]" />
              <h4 className="font-mono text-xs uppercase tracking-[0.2em] text-[hsl(var(--arena-gold))]">Estilo de Jogo</h4>
            </div>
            <p className="text-sm text-foreground/80 leading-relaxed">{style}</p>
          </div>
        )}

        {/* Exploitable Tendencies */}
        {exploits && (
          <div className="border border-[hsl(var(--arena-cyan)_/_0.2)] bg-[hsl(var(--arena-cyan)_/_0.03)] rounded-lg p-4">
            <div className="flex items-center gap-2 mb-2">
              <AlertTriangle className="w-4 h-4 text-[hsl(var(--arena-cyan))]" />
              <h4 className="font-mono text-xs uppercase tracking-[0.2em] text-[hsl(var(--arena-cyan))]">Tendências Exploráveis</h4>
            </div>
            <p className="text-sm text-foreground/80 leading-relaxed">{exploits}</p>
          </div>
        )}

        {/* Tags */}
        {tags && tags.length > 0 && (
          <div className="flex items-center gap-2 flex-wrap">
            {tags.map((tag, i) => (
              <span key={i} className="px-2 py-0.5 rounded-full border border-[hsl(var(--arena-gold)_/_0.3)] text-[hsl(var(--arena-gold))] text-[10px] font-mono bg-[hsl(var(--arena-gold)_/_0.08)]">
                {tag}
              </span>
            ))}
          </div>
        )}
      </motion.div>
    );
  };

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm"
        onClick={onClose}
      >
        <motion.div
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.9, opacity: 0 }}
          onClick={e => e.stopPropagation()}
          className="w-full max-w-2xl max-h-[85vh] overflow-y-auto border border-[hsl(var(--arena-cyan)_/_0.4)] bg-card rounded-xl"
        >
          {/* Header */}
          <div className="sticky top-0 z-10 flex items-center justify-between p-4 border-b border-border bg-card/95 backdrop-blur-md rounded-t-xl">
            <div className="flex items-center gap-2">
              <Users className="w-5 h-5 text-[hsl(var(--arena-cyan))]" />
              <h2 className="font-mono text-sm font-bold uppercase tracking-[0.15em] text-[hsl(var(--arena-cyan))]">
                Perfil dos Vilões
              </h2>
              {villains.length > 0 && (
                <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[9px] font-mono font-bold ${fromCache ? 'bg-[hsl(var(--arena-cyan)_/_0.15)] text-[hsl(var(--arena-cyan))]' : 'bg-[hsl(var(--arena-gold)_/_0.15)] text-[hsl(var(--arena-gold))]'}`}>
                  {fromCache ? <><Database className="w-2.5 h-2.5" /> CACHE</> : <><Zap className="w-2.5 h-2.5" /> NOVA</>}
                </span>
              )}
            </div>
            <button onClick={onClose} className="text-muted-foreground hover:text-foreground transition-colors">
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="p-5 space-y-5">
            {/* Tab selector */}
            <div className="flex gap-2">
              <Button
                variant={view === 'scan' ? 'default' : 'outline'}
                size="sm"
                onClick={() => { setView('scan'); setSelectedVillain(null); }}
                className="font-mono text-xs"
              >
                <Eye className="w-3 h-3 mr-1.5" />
                Scan Sessão ({villains.length})
              </Button>
              <Button
                variant={view === 'database' ? 'default' : 'outline'}
                size="sm"
                onClick={() => { setView('database'); setSelectedVillain(null); }}
                className="font-mono text-xs"
              >
                <Database className="w-3 h-3 mr-1.5" />
                Base de Dados ({storedVillains.length})
              </Button>
            </div>

            {view === 'scan' && (
              <>
                {villains.length === 0 && !loading && (
                  <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-center space-y-4 py-8">
                    <Users className="w-16 h-16 text-[hsl(var(--arena-cyan)_/_0.5)] mx-auto" />
                    <h3 className="font-mono text-lg font-bold text-foreground">
                      Scanner de Vilões
                    </h3>
                    <p className="text-sm text-muted-foreground max-w-md mx-auto">
                      A IA analisará todas as <strong className="text-[hsl(var(--arena-cyan))]">{hands.length} mãos</strong> para identificar 
                      e criar perfis detalhados de cada adversário — VPIP, PFR, agressividade, tendências exploráveis e nível de perigo.
                    </p>
                    <Button
                      onClick={scanVillains}
                      className="bg-gradient-to-r from-[hsl(var(--arena-cyan))] to-[hsl(190_100%_50%)] text-black font-bold uppercase tracking-wider hover:brightness-110 font-mono text-sm px-8"
                    >
                      <Shield className="w-4 h-4 mr-2" />
                      Escanear Vilões
                    </Button>
                  </motion.div>
                )}

                {loading && (
                  <div className="flex flex-col items-center justify-center py-16 gap-4">
                    <Loader2 className="w-10 h-10 text-[hsl(var(--arena-cyan))] animate-spin" />
                    <p className="font-mono text-sm text-muted-foreground animate-pulse">
                      Perfilando adversários em {hands.length} mãos...
                    </p>
                  </div>
                )}

                {villains.length > 0 && !selectedVillain && (
                  <div className="space-y-2">
                    {villains.map((v, i) => renderVillainCard(v, i))}
                  </div>
                )}
              </>
            )}

            {view === 'database' && (
              <>
                {storedVillains.length === 0 ? (
                  <div className="text-center py-8">
                    <Database className="w-12 h-12 text-muted-foreground/30 mx-auto mb-3" />
                    <p className="font-mono text-sm text-muted-foreground">
                      Nenhum vilão na base de dados ainda. Escaneie uma sessão para começar!
                    </p>
                  </div>
                ) : !selectedVillain && (
                  <div className="space-y-2">
                    {storedVillains.map((v, i) => renderVillainCard(v, i))}
                  </div>
                )}
              </>
            )}

            {selectedVillain && renderVillainDetail()}
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
};

export default VillainProfilesPanel;
