import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Loader2, RefreshCw, TrendingUp, TrendingDown } from 'lucide-react';
import { toast } from '@/hooks/use-toast';

type Period = 'today' | 'yesterday' | '7d' | '14d' | '30d';

const PERIOD_LABELS: Record<Period, string> = {
  today: 'Hoje',
  yesterday: 'Ontem',
  '7d': '7 dias',
  '14d': '14 dias',
  '30d': '30 dias',
};

const MARKET_LABEL: Record<string, string> = {
  '1x2': '1X2',
  over_under: 'O/U',
  btts: 'BTTS',
  corners: 'Escanteios',
};

interface Row {
  plan_id: string | null;
  plan_name: string;
  market: string;
  total: number;
  greens: number;
  reds: number;
  pending: number;
  hit_rate: number;
  profit_loss: number;
  roi: number;
  avg_odd: number | null;
  last_signal_at: string | null;
}

export default function PlanResultsTab() {
  const [period, setPeriod] = useState<Period>('30d');
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [settling, setSettling] = useState(false);

  const load = async () => {
    setLoading(true);
    const { data, error } = await (supabase as any).rpc('get_user_plan_results', { _period: period });
    if (error) {
      toast({ title: 'Erro ao carregar resultados', description: error.message, variant: 'destructive' });
    } else {
      setRows((data ?? []) as Row[]);
    }
    setLoading(false);
  };

  useEffect(() => { void load(); }, [period]);

  const handleSettle = async () => {
    setSettling(true);
    const [rpcRes, fbRes, fnRes] = await Promise.all([
      (supabase as any).rpc('settle_user_plan_signals'),
      supabase.functions.invoke('settle-user-plan-fallback'),
      supabase.functions.invoke('settle-user-plan-corners'),
    ]);
    setSettling(false);
    if (rpcRes.error) {
      toast({ title: 'Falha ao reconciliar', description: rpcRes.error.message, variant: 'destructive' });
      return;
    }
    const n = Array.isArray(rpcRes.data) && rpcRes.data[0] ? (rpcRes.data[0].settled ?? 0) : 0;
    const fbBody = (fbRes.data ?? {}) as { settled?: number; no_data?: number };
    const fbSettled = fbBody.settled ?? 0;
    const fbNoData = fbBody.no_data ?? 0;
    const cornersBody = (fnRes.data ?? {}) as { settled?: number; no_data?: number };
    const cornersSettled = cornersBody.settled ?? 0;
    const cornersNoData = cornersBody.no_data ?? 0;
    const fbMsg = fbRes.error
      ? ' · fallback: falha'
      : ` · fallback Futodds/SM: ${fbSettled} liquidado(s)${fbNoData ? `, ${fbNoData} sem placar` : ''}`;
    const cornersMsg = fnRes.error
      ? ' · escanteios: falha ao consultar provedores'
      : ` · escanteios: ${cornersSettled} liquidado(s)${cornersNoData ? `, ${cornersNoData} sem dados` : ''}`;
    toast({
      title: 'Reconciliação concluída',
      description: `${n} entrada(s) live_matches${fbMsg}${cornersMsg}.`,
    });
    void load();
  };

  const totals = rows.reduce(
    (acc, r) => ({
      total: acc.total + r.total,
      greens: acc.greens + r.greens,
      reds: acc.reds + r.reds,
      pending: acc.pending + r.pending,
      pl: acc.pl + Number(r.profit_loss),
    }),
    { total: 0, greens: 0, reds: 0, pending: 0, pl: 0 },
  );
  const settled = totals.greens + totals.reds;
  const hit = settled > 0 ? (100 * totals.greens) / settled : 0;
  const roi = settled > 0 ? (100 * totals.pl) / settled : 0;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-1.5 flex-wrap">
          {(Object.keys(PERIOD_LABELS) as Period[]).map((p) => (
            <button
              key={p}
              onClick={() => setPeriod(p)}
              className={`text-[11px] font-mono uppercase px-2.5 py-1 rounded border transition-colors ${
                period === p ? 'border-primary text-primary bg-primary/10' : 'border-border text-muted-foreground hover:text-foreground'
              }`}
            >
              {PERIOD_LABELS[p]}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2">
          <Button size="sm" variant="outline" onClick={load} disabled={loading}>
            <RefreshCw className={`w-3.5 h-3.5 mr-1.5 ${loading ? 'animate-spin' : ''}`} /> Atualizar
          </Button>
          <Button size="sm" onClick={handleSettle} disabled={settling}>
            {settling ? <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5 mr-1.5" />}
            Reconciliar agora
          </Button>
        </div>
      </div>

      {/* Resumo geral */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
        <Stat label="Entradas" value={totals.total} />
        <Stat label="GREEN" value={totals.greens} tone="success" />
        <Stat label="RED" value={totals.reds} tone="destructive" />
        <Stat label="Pendentes" value={totals.pending} tone="muted" />
        <Stat
          label={`ROI · ${hit.toFixed(1)}% acerto`}
          value={`${roi >= 0 ? '+' : ''}${roi.toFixed(2)}%`}
          tone={roi >= 0 ? 'success' : 'destructive'}
        />
      </div>

      {/* Tabela por plano */}
      {loading ? (
        <div className="flex items-center justify-center py-10 text-muted-foreground">
          <Loader2 className="w-5 h-5 animate-spin mr-2" /> Carregando…
        </div>
      ) : rows.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border bg-card/30 p-8 text-center text-sm text-muted-foreground">
          Nenhum entrada aprovado por seus planos neste período.
        </div>
      ) : (
        <div className="rounded-lg border border-border bg-card/40 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/40 text-[11px] font-mono uppercase text-muted-foreground">
                <tr>
                  <th className="text-left px-3 py-2">Plano</th>
                  <th className="text-center px-2 py-2">Mercado</th>
                  <th className="text-center px-2 py-2">Entradas</th>
                  <th className="text-center px-2 py-2">G</th>
                  <th className="text-center px-2 py-2">R</th>
                  <th className="text-center px-2 py-2">Pend.</th>
                  <th className="text-center px-2 py-2">Acerto</th>
                  <th className="text-center px-2 py-2">Odd média</th>
                  <th className="text-center px-2 py-2">P/L (u)</th>
                  <th className="text-center px-2 py-2">ROI</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {rows.map((r) => (
                  <tr key={r.plan_id ?? r.plan_name} className="hover:bg-muted/20">
                    <td className="px-3 py-2 font-medium text-foreground">{r.plan_name}</td>
                    <td className="text-center px-2 py-2">
                      <Badge variant="outline" className="text-[10px] font-mono">{MARKET_LABEL[r.market] ?? r.market}</Badge>
                    </td>
                    <td className="text-center px-2 py-2 font-mono">{r.total}</td>
                    <td className="text-center px-2 py-2 font-mono text-success">{r.greens}</td>
                    <td className="text-center px-2 py-2 font-mono text-destructive">{r.reds}</td>
                    <td className="text-center px-2 py-2 font-mono text-muted-foreground">{r.pending}</td>
                    <td className="text-center px-2 py-2 font-mono">{Number(r.hit_rate).toFixed(1)}%</td>
                    <td className="text-center px-2 py-2 font-mono">{r.avg_odd ? Number(r.avg_odd).toFixed(2) : '—'}</td>
                    <td className={`text-center px-2 py-2 font-mono ${Number(r.profit_loss) >= 0 ? 'text-success' : 'text-destructive'}`}>
                      {Number(r.profit_loss) >= 0 ? '+' : ''}{Number(r.profit_loss).toFixed(2)}
                    </td>
                    <td className={`text-center px-2 py-2 font-mono inline-flex items-center gap-1 ${Number(r.roi) >= 0 ? 'text-success' : 'text-destructive'}`}>
                      {Number(r.roi) >= 0 ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                      {Number(r.roi) >= 0 ? '+' : ''}{Number(r.roi).toFixed(2)}%
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <p className="text-[11px] text-muted-foreground leading-relaxed">
        Stake fixo de <span className="font-mono">1u</span> por entrada · P/L = (odd − 1) em GREEN, −1 em RED · A reconciliação cruza o placar final em <span className="font-mono">live_matches</span> com a entrada aprovada.
        Para <span className="font-mono">Escanteios</span>, o total final é buscado nos provedores Futodds → Sportmonks no momento da reconciliação; entradas em jogos sem total de cantos disponível ficam como pendentes até a próxima tentativa.
      </p>
    </div>
  );
}

function Stat({ label, value, tone }: { label: string; value: number | string; tone?: 'success' | 'destructive' | 'muted' }) {
  const color =
    tone === 'success' ? 'text-success' : tone === 'destructive' ? 'text-destructive' : tone === 'muted' ? 'text-muted-foreground' : 'text-foreground';
  return (
    <div className="rounded-lg border border-border bg-card/40 px-3 py-2">
      <p className="text-[10px] uppercase font-mono text-muted-foreground tracking-wider">{label}</p>
      <p className={`text-lg font-mono font-semibold ${color}`}>{value}</p>
    </div>
  );
}
