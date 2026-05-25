import { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Loader2, Save, RotateCcw, Sliders } from 'lucide-react';
import { toast } from 'sonner';

type Calib = {
  id?: string;
  min_probability: number; min_edge: number; min_confidence: number;
  target_roi: number; target_win_rate: number; tolerance_pp: number;
  odd_min: number; odd_max: number;
  tier1_min_edge: number; tier1_min_conf: number; tier1_min_prob: number; tier1_max_stake: number;
  tier2_min_edge: number; tier2_min_conf: number; tier2_min_prob: number; tier2_max_stake: number;
  tier3_min_edge: number; tier3_min_conf: number; tier3_min_prob: number; tier3_max_stake: number;
  notes?: string | null;
};

const DEFAULTS: Calib = {
  min_probability: 30, min_edge: 4, min_confidence: 65,
  target_roi: 20, target_win_rate: 60, tolerance_pp: 2,
  odd_min: 1.35, odd_max: 4.5,
  tier1_min_edge: 7, tier1_min_conf: 78, tier1_min_prob: 50, tier1_max_stake: 5,
  tier2_min_edge: 5, tier2_min_conf: 70, tier2_min_prob: 40, tier2_max_stake: 3.5,
  tier3_min_edge: 4, tier3_min_conf: 65, tier3_min_prob: 32, tier3_max_stake: 2.5,
};

function NumField({ label, value, onChange, step = 1, suffix }: { label: string; value: number; onChange: (n: number) => void; step?: number; suffix?: string }) {
  return (
    <div className="space-y-1">
      <Label className="text-xs text-muted-foreground">{label}{suffix && <span className="ml-1 opacity-60">({suffix})</span>}</Label>
      <Input type="number" step={step} value={value} onChange={(e) => onChange(parseFloat(e.target.value) || 0)} className="h-9" />
    </div>
  );
}

export default function PunterCalibration() {
  const [data, setData] = useState<Calib | null>(null);
  const [original, setOriginal] = useState<Calib | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [history, setHistory] = useState<{ total: number; approved: number; vetoed: number; greens: number; reds: number } | null>(null);

  const load = async () => {
    setLoading(true);
    const { data: row } = await supabase.from('punter_calibration' as any)
      .select('*').eq('is_active', true).maybeSingle();
    const c = (row as any) || { ...DEFAULTS };
    setData(c); setOriginal(JSON.parse(JSON.stringify(c)));
    setLoading(false);

    // Stats últimos 30 dias para impacto esperado
    const since = new Date(Date.now() - 30 * 86400000).toISOString();
    const { data: bets } = await supabase.from('bets_history')
      .select('result,profit_loss,edge,probability_model,odd')
      .eq('source', 'mycroft_punter').gte('created_at', since);
    if (bets) {
      const greens = bets.filter((b: any) => b.result === 'green' || b.result === 'win').length;
      const reds = bets.filter((b: any) => b.result === 'red' || b.result === 'loss').length;
      setHistory({ total: bets.length, approved: bets.length, vetoed: 0, greens, reds });
    }
  };

  useEffect(() => { load(); }, []);

  const dirty = useMemo(() => JSON.stringify(data) !== JSON.stringify(original), [data, original]);

  // Simulação: estima quantos entradas passariam com novos thresholds usando bets_history
  const [impact, setImpact] = useState<{ wouldPass: number; wouldVeto: number; samples: number } | null>(null);
  useEffect(() => {
    if (!data) return;
    (async () => {
      const since = new Date(Date.now() - 60 * 86400000).toISOString();
      const { data: bets } = await supabase.from('bets_history')
        .select('edge,probability_model,odd')
        .eq('source', 'mycroft_punter').gte('created_at', since);
      if (!bets) return;
      let pass = 0, veto = 0;
      for (const b of bets as any[]) {
        const prob = (b.probability_model ?? 0) * 100;
        const edge = (b.edge ?? 0) * 100;
        const odd = b.odd ?? 0;
        if (prob >= data.min_probability && edge >= data.min_edge && odd >= data.odd_min && odd <= data.odd_max) pass++;
        else veto++;
      }
      setImpact({ wouldPass: pass, wouldVeto: veto, samples: bets.length });
    })();
  }, [data]);

  const save = async () => {
    if (!data) return;
    setSaving(true);
    const payload = { ...data, is_active: true };
    delete (payload as any).id;
    delete (payload as any).created_at;
    delete (payload as any).updated_at;

    let res;
    if (data.id) {
      res = await supabase.from('punter_calibration' as any).update(payload).eq('id', data.id);
    } else {
      res = await supabase.from('punter_calibration' as any).insert(payload);
    }
    setSaving(false);
    if (res.error) { toast.error('Erro ao salvar: ' + res.error.message); return; }
    toast.success('Calibração publicada — aplicada nas próximas análises');
    load();
  };

  const reset = () => setData(original ? JSON.parse(JSON.stringify(original)) : null);
  const resetDefaults = () => setData(data ? { ...DEFAULTS, id: data.id, notes: data.notes } : null);

  if (loading || !data) {
    return <div className="flex items-center justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>;
  }

  const set = (k: keyof Calib) => (v: number) => setData({ ...data, [k]: v });

  return (
    <Card className="border-primary/20">
      <CardHeader className="flex flex-row items-center justify-between flex-wrap gap-2">
        <div>
          <CardTitle className="text-lg flex items-center gap-2">
            <Sliders className="w-5 h-5 text-primary" /> Calibração do Mycroft Punter
          </CardTitle>
          <p className="text-xs text-muted-foreground mt-1">
            Ajuste os filtros e parâmetros dos tiers. Aplicado nas próximas análises.
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={resetDefaults}>
            <RotateCcw className="w-3.5 h-3.5 mr-1.5" /> Defaults
          </Button>
          <Button variant="outline" size="sm" onClick={reset} disabled={!dirty}>Desfazer</Button>
          <Button size="sm" onClick={save} disabled={!dirty || saving}>
            {saving ? <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" /> : <Save className="w-3.5 h-3.5 mr-1.5" />}
            Publicar
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Filtros globais */}
        <section>
          <h3 className="text-sm font-semibold mb-3 text-foreground">Filtros globais (eliminatórios)</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <NumField label="Prob. mínima" value={data.min_probability} onChange={set('min_probability')} suffix="%" />
            <NumField label="Edge mínimo" value={data.min_edge} onChange={set('min_edge')} step={0.5} suffix="%" />
            <NumField label="Confiança mínima" value={data.min_confidence} onChange={set('min_confidence')} suffix="%" />
            <NumField label="Tolerância" value={data.tolerance_pp} onChange={set('tolerance_pp')} step={0.5} suffix="pp" />
            <NumField label="Odd mínima" value={data.odd_min} onChange={set('odd_min')} step={0.05} />
            <NumField label="Odd máxima" value={data.odd_max} onChange={set('odd_max')} step={0.05} />
            <NumField label="ROI alvo" value={data.target_roi} onChange={set('target_roi')} suffix="%/mês" />
            <NumField label="Win rate alvo" value={data.target_win_rate} onChange={set('target_win_rate')} suffix="%" />
          </div>
        </section>

        {/* Tiers */}
        <section>
          <h3 className="text-sm font-semibold mb-3 text-foreground">Configuração dos tiers</h3>
          <div className="grid gap-3 md:grid-cols-3">
            {[1, 2, 3].map((t) => (
              <Card key={t} className="bg-card/50">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <Badge variant="outline" className={t === 1 ? 'border-emerald-500/40 text-emerald-400' : t === 2 ? 'border-blue-500/40 text-blue-400' : 'border-amber-500/40 text-amber-400'}>
                      Tier {t}
                    </Badge>
                    {t === 1 ? '⚡ Premium' : t === 2 ? '✅ Sólido' : '🎯 Padrão'}
                  </CardTitle>
                </CardHeader>
                <CardContent className="grid grid-cols-2 gap-2">
                  <NumField label="Edge" value={(data as any)[`tier${t}_min_edge`]} onChange={(v) => setData({ ...data, [`tier${t}_min_edge`]: v } as any)} step={0.5} suffix="%" />
                  <NumField label="Conf." value={(data as any)[`tier${t}_min_conf`]} onChange={(v) => setData({ ...data, [`tier${t}_min_conf`]: v } as any)} suffix="%" />
                  <NumField label="Prob." value={(data as any)[`tier${t}_min_prob`]} onChange={(v) => setData({ ...data, [`tier${t}_min_prob`]: v } as any)} suffix="%" />
                  <NumField label="Stake máx." value={(data as any)[`tier${t}_max_stake`]} onChange={(v) => setData({ ...data, [`tier${t}_max_stake`]: v } as any)} step={0.5} suffix="%" />
                </CardContent>
              </Card>
            ))}
          </div>
        </section>

        {/* Impacto esperado */}
        <section>
          <h3 className="text-sm font-semibold mb-3 text-foreground">Impacto esperado (últimos 60 dias)</h3>
          {impact ? (
            <div className="grid grid-cols-3 gap-3">
              <Card className="bg-emerald-500/5 border-emerald-500/30">
                <CardContent className="p-3">
                  <div className="text-xs text-muted-foreground">Passariam</div>
                  <div className="text-2xl font-bold text-emerald-400">{impact.wouldPass}</div>
                  <div className="text-xs text-muted-foreground">{impact.samples > 0 ? ((impact.wouldPass / impact.samples) * 100).toFixed(1) : 0}% das amostras</div>
                </CardContent>
              </Card>
              <Card className="bg-red-500/5 border-red-500/30">
                <CardContent className="p-3">
                  <div className="text-xs text-muted-foreground">Vetariam</div>
                  <div className="text-2xl font-bold text-red-400">{impact.wouldVeto}</div>
                  <div className="text-xs text-muted-foreground">{impact.samples > 0 ? ((impact.wouldVeto / impact.samples) * 100).toFixed(1) : 0}% das amostras</div>
                </CardContent>
              </Card>
              <Card className="bg-card/50">
                <CardContent className="p-3">
                  <div className="text-xs text-muted-foreground">Histórico</div>
                  <div className="text-2xl font-bold text-foreground">{history?.greens ?? 0}G / {history?.reds ?? 0}R</div>
                  <div className="text-xs text-muted-foreground">
                    {history && history.greens + history.reds > 0
                      ? `WR ${((history.greens / (history.greens + history.reds)) * 100).toFixed(1)}%`
                      : 'sem dados'}
                  </div>
                </CardContent>
              </Card>
            </div>
          ) : (
            <p className="text-xs text-muted-foreground">Sem amostras suficientes em bets_history.</p>
          )}
          <p className="text-[11px] text-muted-foreground mt-2">
            * A simulação compara entradas reais dos últimos 60 dias contra os novos thresholds (filtros globais). Tiers e tolerância são aplicados em runtime pela engine.
          </p>
        </section>

        {/* Notas */}
        <section>
          <Label className="text-xs text-muted-foreground">Notas da calibração</Label>
          <Textarea
            value={data.notes ?? ''}
            onChange={(e) => setData({ ...data, notes: e.target.value })}
            placeholder="Ex: Aumentei prob mínima para 35% após excesso de REDs em jogos de visitante"
            className="mt-1"
            rows={2}
          />
        </section>
      </CardContent>
    </Card>
  );
}
