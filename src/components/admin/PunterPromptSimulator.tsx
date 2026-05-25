import { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Loader2, FlaskConical, RefreshCw, TrendingUp, TrendingDown, Target } from 'lucide-react';

// ═══ Regras do Prompt v3 (defaults editáveis) ═══
type Rules = {
  // Probabilidade mínima por mercado
  prob_1x2: number; prob_draw: number;
  prob_over25: number; prob_under25: number;
  prob_btts: number; prob_ht05: number; prob_15: number; prob_corners: number;
  // Odd máxima por mercado
  odd_max_main: number; odd_max_underdog: number;
  odd_max_under25: number; odd_max_ht05: number; odd_max_corners: number;
  // Tier thresholds (edge / conf / prob)
  t1_edge: number; t1_conf: number; t1_prob: number; t1_stake: number;
  t2_edge: number; t2_conf: number; t2_prob: number; t2_stake: number;
  t3_edge: number; t3_conf: number; t3_prob: number; t3_stake: number;
};

const DEFAULTS: Rules = {
  prob_1x2: 42, prob_draw: 38, prob_over25: 45, prob_under25: 48,
  prob_btts: 48, prob_ht05: 35, prob_15: 40, prob_corners: 50,
  odd_max_main: 3.20, odd_max_underdog: 3.50,
  odd_max_under25: 2.80, odd_max_ht05: 4.00, odd_max_corners: 2.20,
  t1_edge: 7, t1_conf: 78, t1_prob: 55, t1_stake: 4.5,
  t2_edge: 5, t2_conf: 70, t2_prob: 48, t2_stake: 3,
  t3_edge: 4, t3_conf: 65, t3_prob: 42, t3_stake: 2,
};

type Bet = {
  market: string; odd: number; prob: number; edge: number; conf: number;
  result: string | null; profit_loss: number | null;
};

function classifyMarket(m: string): 'under25' | 'over25' | 'btts' | 'ht05' | 'corners' | '1x2_draw' | '1x2' | '15' | 'other' {
  const s = (m || '').toLowerCase();
  if (s.includes('escante') || s.includes('corner')) return 'corners';
  if (s.includes('btts') || s.includes('ambas marcam') || s.includes('ambos marcam')) return 'btts';
  if (s.includes('under 2.5') || s.includes('menos de 2.5')) return 'under25';
  if (s.includes('over 2.5') || s.includes('mais de 2.5')) return 'over25';
  if (s.includes('0.5 ht') || s.includes('over 0.5') || s.includes('under 0.5')) return 'ht05';
  if (s.includes('1.5')) return '15';
  if (s.includes('empate') || s.includes('draw')) return '1x2_draw';
  if (s.includes('casa') || s.includes('fora') || s.includes('vitória') || s.includes('home') || s.includes('away') || s.match(/\b(1|2|x)\b/)) return '1x2';
  return 'other';
}

function evaluate(bet: Bet, R: Rules): { passes: boolean; tier: 1 | 2 | 3 | null; reason?: string } {
  const cat = classifyMarket(bet.market);
  // Filtro probabilidade por mercado
  let minProb = 42;
  if (cat === 'under25') minProb = R.prob_under25;
  else if (cat === 'over25') minProb = R.prob_over25;
  else if (cat === 'btts') minProb = R.prob_btts;
  else if (cat === 'ht05') minProb = R.prob_ht05;
  else if (cat === '15') minProb = R.prob_15;
  else if (cat === 'corners') minProb = R.prob_corners;
  else if (cat === '1x2_draw') minProb = R.prob_draw;
  else if (cat === '1x2') minProb = R.prob_1x2;
  if (bet.prob < minProb) return { passes: false, tier: null, reason: `prob ${bet.prob.toFixed(1)}% < ${minProb}%` };

  // Filtro odd máxima por mercado
  let oddMax = R.odd_max_main;
  if (cat === 'under25') oddMax = R.odd_max_under25;
  else if (cat === 'ht05') oddMax = R.odd_max_ht05;
  else if (cat === 'corners') oddMax = R.odd_max_corners;
  if (bet.odd > oddMax) {
    // exceção underdog 1x2
    if (cat === '1x2' && bet.odd <= R.odd_max_underdog && bet.prob >= 40 && bet.edge >= 8) {
      // ok
    } else return { passes: false, tier: null, reason: `odd ${bet.odd} > ${oddMax}` };
  }
  if (bet.odd < 1.35) return { passes: false, tier: null, reason: `odd ${bet.odd} < 1.35` };

  // Tier — começa pelo mais alto
  if (bet.edge >= R.t1_edge && bet.conf >= R.t1_conf && bet.prob >= R.t1_prob) return { passes: true, tier: 1 };
  if (bet.edge >= R.t2_edge && bet.conf >= R.t2_conf && bet.prob >= R.t2_prob) return { passes: true, tier: 2 };
  if (bet.edge >= R.t3_edge && bet.conf >= R.t3_conf && bet.prob >= R.t3_prob) return { passes: true, tier: 3 };
  return { passes: false, tier: null, reason: `não atinge nenhum tier` };
}

function NumField({ label, value, onChange, step = 1, suffix }: { label: string; value: number; onChange: (n: number) => void; step?: number; suffix?: string }) {
  return (
    <div className="space-y-1">
      <Label className="text-[11px] text-muted-foreground">{label}{suffix && <span className="ml-1 opacity-60">({suffix})</span>}</Label>
      <Input type="number" step={step} value={value} onChange={(e) => onChange(parseFloat(e.target.value) || 0)} className="h-8 text-sm" />
    </div>
  );
}

export default function PunterPromptSimulator() {
  const [rules, setRules] = useState<Rules>(DEFAULTS);
  const [bets, setBets] = useState<Bet[]>([]);
  const [loading, setLoading] = useState(true);
  const [days, setDays] = useState(60);

  const load = async () => {
    setLoading(true);
    const since = new Date(Date.now() - days * 86400000).toISOString();
    const { data } = await supabase
      .from('punter_analyses')
      .select('market,odd,estimated_probability,value_percentage,confidence,result,profit_loss')
      .gte('created_at', since)
      .not('odd', 'is', null);
    const mapped: Bet[] = (data || []).map((r: any) => ({
      market: r.market || '',
      odd: Number(r.odd) || 0,
      prob: Number(r.estimated_probability) || 0,
      edge: Number(r.value_percentage) || 0,
      conf: Number(r.confidence) || 0,
      result: r.result,
      profit_loss: r.profit_loss != null ? Number(r.profit_loss) : null,
    }));
    setBets(mapped);
    setLoading(false);
  };

  useEffect(() => { load(); /* eslint-disable-next-line */ }, [days]);

  const sim = useMemo(() => {
    const approved: Array<Bet & { tier: number }> = [];
    const vetoed: Array<Bet & { reason: string }> = [];
    for (const b of bets) {
      const e = evaluate(b, rules);
      if (e.passes && e.tier) approved.push({ ...b, tier: e.tier });
      else vetoed.push({ ...b, reason: e.reason || '' });
    }
    // Apenas settled (GREEN/RED) entram em win-rate/ROI
    const settled = approved.filter(b => b.result === 'GREEN' || b.result === 'RED');
    const greens = settled.filter(b => b.result === 'GREEN').length;
    const reds = settled.filter(b => b.result === 'RED').length;
    const wr = settled.length > 0 ? (greens / settled.length) * 100 : 0;

    // ROI por unidade de stake (assumindo stake do tier)
    let invested = 0, returned = 0;
    for (const b of settled) {
      const stake = (b as any).tier === 1 ? rules.t1_stake : (b as any).tier === 2 ? rules.t2_stake : rules.t3_stake;
      invested += stake;
      if (b.result === 'GREEN') returned += stake * b.odd;
    }
    const roi = invested > 0 ? ((returned - invested) / invested) * 100 : 0;
    const profit = returned - invested;

    // Breakdown por tier
    const byTier = [1, 2, 3].map(t => {
      const list = approved.filter(b => (b as any).tier === t);
      const set = list.filter(b => b.result === 'GREEN' || b.result === 'RED');
      const g = set.filter(b => b.result === 'GREEN').length;
      const r = set.filter(b => b.result === 'RED').length;
      return { tier: t, total: list.length, settled: set.length, greens: g, reds: r, wr: set.length ? (g / set.length) * 100 : 0 };
    });

    // Breakdown por mercado
    const marketsMap = new Map<string, { total: number; greens: number; reds: number }>();
    for (const b of approved) {
      const k = classifyMarket(b.market);
      const cur = marketsMap.get(k) || { total: 0, greens: 0, reds: 0 };
      cur.total++;
      if (b.result === 'GREEN') cur.greens++;
      else if (b.result === 'RED') cur.reds++;
      marketsMap.set(k, cur);
    }
    const byMarket = Array.from(marketsMap.entries()).map(([k, v]) => ({
      market: k,
      ...v,
      wr: (v.greens + v.reds) > 0 ? (v.greens / (v.greens + v.reds)) * 100 : 0,
    })).sort((a, b) => b.total - a.total);

    return { approved, vetoed, settled: settled.length, greens, reds, wr, roi, profit, invested, byTier, byMarket };
  }, [bets, rules]);

  const total = bets.length;
  const settledTotal = bets.filter(b => b.result === 'GREEN' || b.result === 'RED').length;
  const greensHist = bets.filter(b => b.result === 'GREEN').length;
  const wrHist = settledTotal > 0 ? (greensHist / settledTotal) * 100 : 0;

  return (
    <Card className="border-primary/20">
      <CardHeader className="flex flex-row items-center justify-between flex-wrap gap-2">
        <div>
          <CardTitle className="text-lg flex items-center gap-2">
            <FlaskConical className="w-5 h-5 text-primary" /> Simulador do Novo Prompt (v3)
          </CardTitle>
          <p className="text-xs text-muted-foreground mt-1">
            Aplica os filtros do prompt v3 sobre os últimos {days} dias de análises e estima win-rate e ROI.
          </p>
        </div>
        <div className="flex gap-2 items-center">
          <Input type="number" value={days} onChange={(e) => setDays(parseInt(e.target.value) || 60)} className="h-9 w-20" />
          <Button variant="outline" size="sm" onClick={load} disabled={loading}>
            {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
          </Button>
          <Button variant="outline" size="sm" onClick={() => setRules(DEFAULTS)}>Reset v3</Button>
        </div>
      </CardHeader>

      <CardContent className="space-y-6">
        {/* RESULTADOS */}
        <section className="grid grid-cols-2 md:grid-cols-5 gap-3">
          <Card className="bg-card/50">
            <CardContent className="p-3">
              <div className="text-[11px] text-muted-foreground">Amostra</div>
              <div className="text-2xl font-bold">{total}</div>
              <div className="text-[11px] text-muted-foreground">{settledTotal} liquidadas (WR hist {wrHist.toFixed(1)}%)</div>
            </CardContent>
          </Card>
          <Card className="bg-emerald-500/10 border-emerald-500/30">
            <CardContent className="p-3">
              <div className="text-[11px] text-muted-foreground">Aprovariam</div>
              <div className="text-2xl font-bold text-emerald-400">{sim.approved.length}</div>
              <div className="text-[11px] text-muted-foreground">{total ? ((sim.approved.length / total) * 100).toFixed(1) : 0}% aprovação</div>
            </CardContent>
          </Card>
          <Card className="bg-red-500/10 border-red-500/30">
            <CardContent className="p-3">
              <div className="text-[11px] text-muted-foreground">Vetariam</div>
              <div className="text-2xl font-bold text-red-400">{sim.vetoed.length}</div>
              <div className="text-[11px] text-muted-foreground">{total ? ((sim.vetoed.length / total) * 100).toFixed(1) : 0}% vetos</div>
            </CardContent>
          </Card>
          <Card className={`${sim.wr >= 60 ? 'bg-emerald-500/10 border-emerald-500/30' : 'bg-amber-500/10 border-amber-500/30'}`}>
            <CardContent className="p-3">
              <div className="text-[11px] text-muted-foreground flex items-center gap-1"><Target className="w-3 h-3" /> Win-rate projetado</div>
              <div className={`text-2xl font-bold ${sim.wr >= 60 ? 'text-emerald-400' : 'text-amber-400'}`}>{sim.wr.toFixed(1)}%</div>
              <div className="text-[11px] text-muted-foreground">{sim.greens}G / {sim.reds}R em {sim.settled} liq.</div>
            </CardContent>
          </Card>
          <Card className={`${sim.roi >= 0 ? 'bg-emerald-500/10 border-emerald-500/30' : 'bg-red-500/10 border-red-500/30'}`}>
            <CardContent className="p-3">
              <div className="text-[11px] text-muted-foreground flex items-center gap-1">
                {sim.roi >= 0 ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />} ROI projetado
              </div>
              <div className={`text-2xl font-bold ${sim.roi >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>{sim.roi.toFixed(1)}%</div>
              <div className="text-[11px] text-muted-foreground">P/L: {sim.profit.toFixed(2)}u sobre {sim.invested.toFixed(1)}u</div>
            </CardContent>
          </Card>
        </section>

        {/* BREAKDOWN POR TIER */}
        <section>
          <h3 className="text-sm font-semibold mb-2">Breakdown por Tier</h3>
          <div className="grid md:grid-cols-3 gap-3">
            {sim.byTier.map(t => (
              <Card key={t.tier} className="bg-card/50">
                <CardContent className="p-3">
                  <div className="flex items-center justify-between mb-1">
                    <Badge variant="outline" className={t.tier === 1 ? 'border-emerald-500/40 text-emerald-400' : t.tier === 2 ? 'border-blue-500/40 text-blue-400' : 'border-amber-500/40 text-amber-400'}>
                      Tier {t.tier} {t.tier === 1 ? '⚡' : t.tier === 2 ? '✅' : '🎯'}
                    </Badge>
                    <span className="text-xs text-muted-foreground">{t.total} entradas</span>
                  </div>
                  <div className="text-lg font-bold">{t.wr.toFixed(1)}% WR</div>
                  <div className="text-[11px] text-muted-foreground">{t.greens}G / {t.reds}R em {t.settled} liq.</div>
                </CardContent>
              </Card>
            ))}
          </div>
        </section>

        {/* BREAKDOWN POR MERCADO */}
        <section>
          <h3 className="text-sm font-semibold mb-2">Breakdown por Mercado</h3>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-2">
            {sim.byMarket.map(m => (
              <div key={m.market} className="flex items-center justify-between rounded-md border border-border/50 px-3 py-2 bg-card/30">
                <div>
                  <div className="text-sm font-medium capitalize">{m.market.replace('_', ' ')}</div>
                  <div className="text-[11px] text-muted-foreground">{m.greens}G / {m.reds}R</div>
                </div>
                <div className="text-right">
                  <div className={`text-sm font-bold ${m.wr >= 60 ? 'text-emerald-400' : m.wr >= 50 ? 'text-amber-400' : 'text-red-400'}`}>{m.wr.toFixed(0)}%</div>
                  <div className="text-[11px] text-muted-foreground">{m.total} entradas</div>
                </div>
              </div>
            ))}
            {sim.byMarket.length === 0 && <p className="text-xs text-muted-foreground">Nenhum entrada aprovaria com os filtros atuais.</p>}
          </div>
        </section>

        {/* AJUSTE DE REGRAS */}
        <section>
          <h3 className="text-sm font-semibold mb-2">Probabilidade mínima por mercado (%)</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <NumField label="1X2 (Casa/Fora)" value={rules.prob_1x2} onChange={(v) => setRules({ ...rules, prob_1x2: v })} suffix="%" />
            <NumField label="Empate" value={rules.prob_draw} onChange={(v) => setRules({ ...rules, prob_draw: v })} suffix="%" />
            <NumField label="Over 2.5" value={rules.prob_over25} onChange={(v) => setRules({ ...rules, prob_over25: v })} suffix="%" />
            <NumField label="Under 2.5" value={rules.prob_under25} onChange={(v) => setRules({ ...rules, prob_under25: v })} suffix="%" />
            <NumField label="BTTS" value={rules.prob_btts} onChange={(v) => setRules({ ...rules, prob_btts: v })} suffix="%" />
            <NumField label="0.5 HT" value={rules.prob_ht05} onChange={(v) => setRules({ ...rules, prob_ht05: v })} suffix="%" />
            <NumField label="Over/Under 1.5" value={rules.prob_15} onChange={(v) => setRules({ ...rules, prob_15: v })} suffix="%" />
            <NumField label="Escanteios" value={rules.prob_corners} onChange={(v) => setRules({ ...rules, prob_corners: v })} suffix="%" />
          </div>
        </section>

        <section>
          <h3 className="text-sm font-semibold mb-2">Odd máxima por mercado</h3>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            <NumField label="Principal (1x2/O25/BTTS)" value={rules.odd_max_main} onChange={(v) => setRules({ ...rules, odd_max_main: v })} step={0.05} />
            <NumField label="Underdog 1X2" value={rules.odd_max_underdog} onChange={(v) => setRules({ ...rules, odd_max_underdog: v })} step={0.05} />
            <NumField label="Under 2.5" value={rules.odd_max_under25} onChange={(v) => setRules({ ...rules, odd_max_under25: v })} step={0.05} />
            <NumField label="0.5 HT" value={rules.odd_max_ht05} onChange={(v) => setRules({ ...rules, odd_max_ht05: v })} step={0.05} />
            <NumField label="Escanteios" value={rules.odd_max_corners} onChange={(v) => setRules({ ...rules, odd_max_corners: v })} step={0.05} />
          </div>
        </section>

        <section>
          <h3 className="text-sm font-semibold mb-2">Limites por Tier</h3>
          <div className="grid md:grid-cols-3 gap-3">
            {[1, 2, 3].map(t => {
              const k = `t${t}` as const;
              return (
                <Card key={t} className="bg-card/50">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm">
                      <Badge variant="outline" className={t === 1 ? 'border-emerald-500/40 text-emerald-400' : t === 2 ? 'border-blue-500/40 text-blue-400' : 'border-amber-500/40 text-amber-400'}>
                        Tier {t}
                      </Badge>
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="grid grid-cols-2 gap-2">
                    <NumField label="Edge" value={(rules as any)[`${k}_edge`]} onChange={(v) => setRules({ ...rules, [`${k}_edge`]: v } as any)} step={0.5} suffix="%" />
                    <NumField label="Conf." value={(rules as any)[`${k}_conf`]} onChange={(v) => setRules({ ...rules, [`${k}_conf`]: v } as any)} suffix="%" />
                    <NumField label="Prob." value={(rules as any)[`${k}_prob`]} onChange={(v) => setRules({ ...rules, [`${k}_prob`]: v } as any)} suffix="%" />
                    <NumField label="Stake" value={(rules as any)[`${k}_stake`]} onChange={(v) => setRules({ ...rules, [`${k}_stake`]: v } as any)} step={0.5} suffix="%" />
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </section>

        <p className="text-[11px] text-muted-foreground">
          * A simulação usa probabilidade, edge, confiança e odd reais armazenados em <code>punter_analyses</code>. Apenas entradas já liquidados (GREEN/RED) entram no cálculo de WR/ROI. ROI é calculado por unidade de stake do tier.
        </p>
      </CardContent>
    </Card>
  );
}
