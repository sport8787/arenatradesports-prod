import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, TrendingUp, BarChart3 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { MonocleIcon } from './PersonaIcons';

interface StyleStats {
  tag: number;
  lag: number;
  gto: number;
  none: number;
  total: number;
  winRate: number;
  bestStyleWinRate: Record<string, number>;
}

interface StyleProfileModalProps {
  onClose: () => void;
}

const STYLE_META = {
  tag: { label: 'TAG', sublabel: 'Tight-Aggressive', emoji: '🛡️', color: 'var(--arena-cyan)', desc: 'Você tende a ser seletivo com suas mãos e agressivo quando entra. Forte contra jogadores passivos.' },
  lag: { label: 'LAG', sublabel: 'Loose-Aggressive', emoji: '🔥', color: 'var(--arena-gold)', desc: 'Você joga mais mãos e aplica pressão. Exploitativo, mas requer leitura apurada dos adversários.' },
  gto: { label: 'GTO', sublabel: 'Solver / Equilibrado', emoji: '🎯', color: 'var(--mycroft-green)', desc: 'Você busca o equilíbrio. Difícil de exploitar, mas pode deixar valor na mesa contra oponentes fracos.' },
} as const;

export default function StyleProfileModal({ onClose }: StyleProfileModalProps) {
  const [stats, setStats] = useState<StyleStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [dominantStyle, setDominantStyle] = useState<'tag' | 'lag' | 'gto' | null>(null);

  useEffect(() => {
    loadHistory();
  }, []);

  const loadHistory = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error } = await supabase
        .from('training_scenario_history')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      if (!data || data.length === 0) return;

      const counts = { tag: 0, lag: 0, gto: 0, none: 0, total: data.length };
      const wins = { tag: 0, lag: 0, gto: 0, total: 0 };
      const winsByStyle = { tag: { wins: 0, total: 0 }, lag: { wins: 0, total: 0 }, gto: { wins: 0, total: 0 } };

      data.forEach(row => {
        const matched = row.player_matched_style as string;
        if (matched === 'tag' || matched === 'lag' || matched === 'gto') {
          counts[matched]++;
          winsByStyle[matched].total++;
          if (row.was_correct) {
            winsByStyle[matched].wins++;
          }
        } else {
          counts.none++;
        }
        if (row.was_correct) wins.total++;

        const best = row.best_style as string;
        if (best === 'tag' || best === 'lag' || best === 'gto') {
          // track alignment with best style
        }
      });

      const bestStyleWinRate: Record<string, number> = {};
      (['tag', 'lag', 'gto'] as const).forEach(s => {
        bestStyleWinRate[s] = winsByStyle[s].total > 0
          ? Math.round((winsByStyle[s].wins / winsByStyle[s].total) * 100)
          : 0;
      });

      const computed: StyleStats = {
        ...counts,
        winRate: Math.round((wins.total / data.length) * 100),
        bestStyleWinRate,
      };
      setStats(computed);

      // Determine dominant
      const max = Math.max(counts.tag, counts.lag, counts.gto);
      if (max > 0) {
        if (counts.tag === max) setDominantStyle('tag');
        else if (counts.lag === max) setDominantStyle('lag');
        else setDominantStyle('gto');
      }
    } catch (err) {
      console.error('Failed to load style history:', err);
    } finally {
      setLoading(false);
    }
  };

  const totalStyled = stats ? stats.tag + stats.lag + stats.gto : 0;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.9 }}
        className="bg-card border border-border rounded-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto"
      >
        {/* Header */}
        <div className="px-6 py-4 border-b border-border flex items-center justify-between">
          <div className="flex items-center gap-2">
            <MonocleIcon className="text-[hsl(var(--arena-cyan))]" size={22} />
            <div>
              <h2 className="font-mono text-sm font-bold uppercase tracking-wider text-foreground">
                Perfil de Estilo
              </h2>
              <p className="font-mono text-[10px] text-muted-foreground">Análise baseada no seu histórico de treino</p>
            </div>
          </div>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-6">
          {loading ? (
            <div className="text-center py-12">
              <MonocleIcon className="mx-auto text-[hsl(var(--arena-cyan))] animate-pulse mb-3" size={32} />
              <p className="font-mono text-sm text-muted-foreground">Analisando seus dados...</p>
            </div>
          ) : !stats || stats.total < 3 ? (
            <div className="text-center py-12 space-y-3">
              <BarChart3 className="w-12 h-12 mx-auto text-muted-foreground/30" />
              <p className="font-mono text-sm text-muted-foreground">
                Jogue pelo menos <span className="text-[hsl(var(--arena-cyan))] font-bold">3 cenários</span> para gerar seu perfil de estilo.
              </p>
              <p className="font-mono text-[10px] text-muted-foreground/60">
                {stats ? `${stats.total} cenário(s) registrado(s)` : '0 cenários registrados'}
              </p>
            </div>
          ) : (
            <>
              {/* Dominant Style */}
              {dominantStyle && (
                <div className="text-center space-y-3">
                  <span className="text-5xl">{STYLE_META[dominantStyle].emoji}</span>
                  <div>
                    <h3 className="font-mono text-2xl font-black uppercase" style={{ color: `hsl(${STYLE_META[dominantStyle].color})` }}>
                      {STYLE_META[dominantStyle].label}
                    </h3>
                    <p className="font-mono text-xs text-muted-foreground">{STYLE_META[dominantStyle].sublabel}</p>
                  </div>
                  <p className="font-mono text-xs text-muted-foreground max-w-sm mx-auto leading-relaxed">
                    {STYLE_META[dominantStyle].desc}
                  </p>
                </div>
              )}

              {/* Style Distribution Bars */}
              <div className="space-y-3">
                <p className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground flex items-center gap-1.5">
                  <TrendingUp className="w-3 h-3" /> Distribuição de Estilo
                </p>
                {(['tag', 'lag', 'gto'] as const).map(key => {
                  const count = stats[key];
                  const pct = totalStyled > 0 ? Math.round((count / totalStyled) * 100) : 0;
                  const meta = STYLE_META[key];
                  const wr = stats.bestStyleWinRate[key];
                  return (
                    <div key={key} className="space-y-1">
                      <div className="flex items-center justify-between">
                        <span className="font-mono text-xs font-bold flex items-center gap-1.5">
                          <span>{meta.emoji}</span>
                          <span style={{ color: `hsl(${meta.color})` }}>{meta.label}</span>
                        </span>
                        <div className="flex items-center gap-3">
                          <span className="font-mono text-[10px] text-muted-foreground">
                            Win: <span className={wr >= 60 ? 'text-[hsl(var(--success))]' : wr >= 40 ? 'text-[hsl(var(--warning))]' : 'text-[hsl(var(--destructive))]'}>{wr}%</span>
                          </span>
                          <span className="font-mono text-xs font-bold" style={{ color: `hsl(${meta.color})` }}>
                            {pct}%
                          </span>
                        </div>
                      </div>
                      <div className="h-2 rounded-full bg-secondary overflow-hidden">
                        <motion.div
                          initial={{ width: 0 }}
                          animate={{ width: `${pct}%` }}
                          transition={{ duration: 0.8, ease: 'easeOut' }}
                          className="h-full rounded-full"
                          style={{ backgroundColor: `hsl(${meta.color})` }}
                        />
                      </div>
                    </div>
                  );
                })}
                {stats.none > 0 && (
                  <p className="font-mono text-[10px] text-muted-foreground/50">
                    {stats.none} cenário(s) sem correspondência de estilo
                  </p>
                )}
              </div>

              {/* Summary stats */}
              <div className="grid grid-cols-3 gap-3">
                <div className="text-center p-3 rounded-lg bg-secondary/30">
                  <p className="font-mono text-xl font-black text-foreground">{stats.total}</p>
                  <p className="font-mono text-[10px] text-muted-foreground uppercase">Cenários</p>
                </div>
                <div className="text-center p-3 rounded-lg bg-secondary/30">
                  <p className={`font-mono text-xl font-black ${stats.winRate >= 60 ? 'text-[hsl(var(--success))]' : stats.winRate >= 40 ? 'text-[hsl(var(--warning))]' : 'text-[hsl(var(--destructive))]'}`}>
                    {stats.winRate}%
                  </p>
                  <p className="font-mono text-[10px] text-muted-foreground uppercase">Win Rate</p>
                </div>
                <div className="text-center p-3 rounded-lg bg-secondary/30">
                  <p className="font-mono text-xl font-black text-[hsl(var(--arena-gold))]">
                    {dominantStyle ? STYLE_META[dominantStyle].label : '—'}
                  </p>
                  <p className="font-mono text-[10px] text-muted-foreground uppercase">Estilo</p>
                </div>
              </div>

              {/* Recommendation */}
              <div className="border border-[hsl(var(--arena-cyan)_/_0.2)] rounded-lg p-4 bg-[hsl(var(--arena-cyan)_/_0.03)]">
                <p className="font-mono text-[10px] uppercase tracking-widest text-[hsl(var(--arena-cyan))] mb-2 font-bold">
                  💡 Recomendação do Mycroft
                </p>
                <p className="font-mono text-xs text-muted-foreground leading-relaxed">
                  {dominantStyle === 'tag' && 'Seu perfil TAG é sólido para mesas com muita ação. Considere expandir seus ranges em posição tardia para exploitar jogadores tight.'}
                  {dominantStyle === 'lag' && 'Seu jogo agressivo gera pressão, mas monitore seus spots de blefe. Foque em posições tardias e evite overbluff em boards secos.'}
                  {dominantStyle === 'gto' && 'Sua abordagem equilibrada é difícil de exploitar. Contra regulares fracos, considere desviar para linhas mais exploitativas.'}
                  {!dominantStyle && 'Continue jogando mais cenários para revelar seu perfil dominante.'}
                </p>
              </div>
            </>
          )}
        </div>

        <div className="px-6 py-4 border-t border-border">
          <Button onClick={onClose} variant="outline" className="w-full font-mono text-xs uppercase tracking-wider">
            Fechar
          </Button>
        </div>
      </motion.div>
    </div>
  );
}
