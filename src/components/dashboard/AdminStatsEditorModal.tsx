import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Save, Loader2, AlertTriangle } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';

export interface EditableMatchStats {
  xG_home?: number | null;
  xG_away?: number | null;
  possession_home?: number | null;
  possession_away?: number | null;
  attacks_home?: number | null;
  attacks_away?: number | null;
  dangerous_attacks_home?: number | null;
  dangerous_attacks_away?: number | null;
  shots_total_home?: number | null;
  shots_total_away?: number | null;
  shots_on_target_home?: number | null;
  shots_on_target_away?: number | null;
  big_chances_home?: number | null;
  big_chances_away?: number | null;
  corners_home?: number | null;
  corners_away?: number | null;
  odd_manual?: number | null;
}

interface AdminStatsEditorModalProps {
  isOpen: boolean;
  onClose: () => void;
  matchId: string;
  homeTeam: string;
  awayTeam: string;
  currentStats?: EditableMatchStats | null;
}

const FIELDS: Array<{ key: keyof EditableMatchStats; label: string; team: 'home' | 'away'; group: string; step?: number; max?: number }> = [
  { key: 'xG_home', label: 'xG', team: 'home', group: 'xG (Expected Goals)', step: 0.01, max: 10 },
  { key: 'xG_away', label: 'xG', team: 'away', group: 'xG (Expected Goals)', step: 0.01, max: 10 },
  { key: 'possession_home', label: 'Posse %', team: 'home', group: 'Posse de bola', max: 100 },
  { key: 'possession_away', label: 'Posse %', team: 'away', group: 'Posse de bola', max: 100 },
  { key: 'shots_total_home', label: 'Chutes totais', team: 'home', group: 'Chutes' },
  { key: 'shots_total_away', label: 'Chutes totais', team: 'away', group: 'Chutes' },
  { key: 'shots_on_target_home', label: 'Chutes no gol', team: 'home', group: 'Chutes' },
  { key: 'shots_on_target_away', label: 'Chutes no gol', team: 'away', group: 'Chutes' },
  { key: 'attacks_home', label: 'Ataques', team: 'home', group: 'Ataques' },
  { key: 'attacks_away', label: 'Ataques', team: 'away', group: 'Ataques' },
  { key: 'dangerous_attacks_home', label: 'Ataques perigosos', team: 'home', group: 'Ataques' },
  { key: 'dangerous_attacks_away', label: 'Ataques perigosos', team: 'away', group: 'Ataques' },
  { key: 'big_chances_home', label: 'Big Chances', team: 'home', group: 'Big Chances' },
  { key: 'big_chances_away', label: 'Big Chances', team: 'away', group: 'Big Chances' },
  { key: 'corners_home', label: 'Escanteios', team: 'home', group: 'Escanteios' },
  { key: 'corners_away', label: 'Escanteios', team: 'away', group: 'Escanteios' },
];

export default function AdminStatsEditorModal({ isOpen, onClose, matchId, homeTeam, awayTeam, currentStats }: AdminStatsEditorModalProps) {
  const { toast } = useToast();
  const [values, setValues] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    const init: Record<string, string> = {};
    FIELDS.forEach(f => {
      const v = (currentStats as any)?.[f.key];
      init[f.key as string] = v != null && Number.isFinite(Number(v)) && Number(v) > 0 ? String(v) : '';
    });
    setValues(init);
  }, [isOpen, currentStats]);

  const handleChange = (key: string, raw: string) => {
    setValues(prev => ({ ...prev, [key]: raw.replace(',', '.') }));
  };

  const handleSave = async (reanalyze: boolean) => {
    const stats: Record<string, number> = {};
    for (const f of FIELDS) {
      const raw = values[f.key as string];
      if (!raw || !raw.trim()) continue;
      const n = Number(raw);
      if (!Number.isFinite(n) || n < 0) continue;
      if (f.max && n > f.max) continue;
      stats[f.key as string] = n;
    }
    if (Object.keys(stats).length === 0) {
      toast({ title: 'Nenhum valor preenchido', description: 'Informe ao menos uma estatística.' });
      return;
    }
    setSaving(true);
    try {
      const { data, error } = await supabase.functions.invoke('update-live-match-stats', {
        body: { match_id: matchId, stats, reanalyze },
      });
      if (error) throw error;
      if ((data as any)?.error) throw new Error((data as any).error);
      toast({
        title: '✅ Stats atualizadas',
        description: reanalyze
          ? `Mycroft vai reanalisar com ${Object.keys(stats).length} campo(s) corrigido(s).`
          : `${Object.keys(stats).length} campo(s) salvos.`,
      });
      onClose();
    } catch (e: any) {
      console.error('[AdminStatsEditor] erro', e);
      toast({ title: '❌ Erro', description: e?.message || 'Falha ao salvar', variant: 'destructive' as any });
    } finally {
      setSaving(false);
    }
  };

  // Agrupa por "group"
  const groups = Array.from(new Set(FIELDS.map(f => f.group)));

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[100] bg-black/70 backdrop-blur-sm flex items-center justify-center p-4"
          onClick={onClose}
        >
          <motion.div
            initial={{ scale: 0.95, y: 20 }}
            animate={{ scale: 1, y: 0 }}
            exit={{ scale: 0.95, y: 20 }}
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-2xl bg-card border-2 border-amber-500/40 rounded-xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
          >
            <div className="flex items-center justify-between p-4 border-b border-border bg-amber-500/5">
              <div>
                <h2 className="text-base font-orbitron font-bold text-amber-400 uppercase">🛠️ Editar Stats (Admin)</h2>
                <p className="text-xs text-muted-foreground mt-0.5">{homeTeam} vs {awayTeam} · <span className="font-mono">{matchId.slice(0, 12)}…</span></p>
              </div>
              <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-muted transition-colors">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-4 overflow-y-auto flex-1 space-y-4">
              <div className="flex items-start gap-2 p-2.5 rounded-lg bg-amber-500/10 border border-amber-500/30 text-xs text-amber-200">
                <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                <p>
                  Preencha apenas os campos que estão zerados/faltando na fonte oficial. Valores informados aqui têm <strong>prioridade máxima</strong>
                  {' '}sobre API-Football, SofaScore e Flashscore. Deixe em branco para manter o valor automático.
                </p>
              </div>

              {groups.map(group => {
                const fields = FIELDS.filter(f => f.group === group);
                return (
                  <div key={group} className="space-y-2">
                    <h3 className="text-xs font-orbitron uppercase tracking-wider text-muted-foreground">{group}</h3>
                    <div className="grid grid-cols-2 gap-3">
                      {fields.map(f => (
                        <div key={f.key as string}>
                          <label className="block text-[10px] text-muted-foreground mb-1">
                            <span className="font-bold">{f.team === 'home' ? homeTeam : awayTeam}</span> · {f.label}
                          </label>
                          <input
                            type="number"
                            inputMode="decimal"
                            step={f.step ?? 1}
                            min={0}
                            max={f.max}
                            value={values[f.key as string] ?? ''}
                            onChange={(e) => handleChange(f.key as string, e.target.value)}
                            placeholder="—"
                            className={cn(
                              'w-full px-2.5 py-1.5 text-sm rounded-md border bg-background/50',
                              'border-border focus:border-amber-500/60 focus:outline-none focus:ring-1 focus:ring-amber-500/40',
                            )}
                          />
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="flex items-center justify-end gap-2 p-4 border-t border-border bg-muted/20">
              <button
                onClick={onClose}
                disabled={saving}
                className="px-3 py-2 text-xs font-bold uppercase rounded-md border border-border hover:bg-muted/40 transition-colors disabled:opacity-50"
              >
                Cancelar
              </button>
              <button
                onClick={() => handleSave(false)}
                disabled={saving}
                className="flex items-center gap-1.5 px-3 py-2 text-xs font-bold uppercase rounded-md border border-amber-500/40 text-amber-400 hover:bg-amber-500/10 transition-colors disabled:opacity-50"
              >
                {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                Salvar
              </button>
              <button
                onClick={() => handleSave(true)}
                disabled={saving}
                className="flex items-center gap-1.5 px-3 py-2 text-xs font-bold uppercase rounded-md bg-amber-500 text-amber-950 hover:bg-amber-400 transition-colors disabled:opacity-50"
              >
                {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                Salvar e Reanalisar
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
