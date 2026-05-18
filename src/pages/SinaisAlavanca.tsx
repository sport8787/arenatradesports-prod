import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, TrendingUp, Calculator, Loader2, RefreshCw, AlertTriangle, Zap, Clock } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

type Sinal = {
  id: string;
  match_id: string;
  match_name: string;
  league: string | null;
  kickoff: string | null;
  mode: 'live' | 'prelive';
  score: number;
  odd_under45: number | null;
  minute: number | null;
  goals_total: number | null;
  reasons: string[];
  status: 'pending' | 'green' | 'red' | 'void';
  created_at: string;
};

export default function SinaisAlavancaPage() {
  const navigate = useNavigate();
  const [sinais, setSinais] = useState<Sinal[]>([]);
  const [loading, setLoading] = useState(true);
  const [scanning, setScanning] = useState<'live' | 'prelive' | null>(null);
  const [stats, setStats] = useState<{ total: number; green: number; red: number; avgOdd: number } | null>(null);

  // Calculadora
  const [stakeInicial, setStakeInicial] = useState(100);
  const [oddMedia, setOddMedia] = useState(1.12);
  const [greensSeguidos, setGreensSeguidos] = useState(5);

  const carregar = async () => {
    setLoading(true);
    const { data } = await supabase
      .from('sinais_alavanca')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(80);
    setSinais((data as any) || []);
    // stats últimos 30 dias
    const desde = new Date(Date.now() - 30 * 86400000).toISOString();
    const { data: stat } = await supabase
      .from('sinais_alavanca')
      .select('status, odd_under45')
      .gte('created_at', desde)
      .in('status', ['green', 'red']);
    if (stat) {
      const green = stat.filter((s: any) => s.status === 'green').length;
      const red = stat.filter((s: any) => s.status === 'red').length;
      const odds = stat.map((s: any) => Number(s.odd_under45)).filter((o: number) => o > 0);
      const avgOdd = odds.length ? odds.reduce((a: number, b: number) => a + b, 0) / odds.length : 0;
      setStats({ total: green + red, green, red, avgOdd });
    }
    setLoading(false);
  };

  useEffect(() => {
    carregar();
    const channel = supabase
      .channel('sinais_alavanca_realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'sinais_alavanca' }, carregar)
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const scan = async (mode: 'live' | 'prelive') => {
    setScanning(mode);
    try {
      const { data, error } = await supabase.functions.invoke('sinais-alavanca-scanner', {
        body: { mode },
      });
      if (error) throw error;
      toast.success(`Varredura ${mode === 'live' ? 'Ao Vivo' : 'Pré-Live'} concluída`, {
        description: `${data?.inserted ?? 0} sinais aprovados de ${data?.scanned ?? 0} jogos`,
      });
      await carregar();
    } catch (e: any) {
      toast.error('Falha na varredura', { description: e?.message ?? String(e) });
    } finally {
      setScanning(null);
    }
  };

  const ao_vivo = useMemo(() => sinais.filter((s) => s.mode === 'live' && s.status === 'pending'), [sinais]);
  const pre_live = useMemo(() => sinais.filter((s) => s.mode === 'prelive' && s.status === 'pending'), [sinais]);
  const liquidados = useMemo(() => sinais.filter((s) => s.status === 'green' || s.status === 'red').slice(0, 15), [sinais]);

  // Calculadora
  const projecao = useMemo(() => {
    const linhas: { entrada: number; stake: number; retorno: number; lucro: number }[] = [];
    let stake = stakeInicial;
    let lucroAcum = 0;
    for (let i = 1; i <= greensSeguidos; i++) {
      const retorno = stake * oddMedia;
      const lucro = retorno - stakeInicial;
      lucroAcum = lucro;
      linhas.push({ entrada: i, stake, retorno, lucro });
      stake = retorno; // próximo stake = retorno anterior (juros compostos)
    }
    return { linhas, lucroFinal: lucroAcum };
  }, [stakeInicial, oddMedia, greensSeguidos]);

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-40 border-b border-border bg-card/95 backdrop-blur-xl">
        <div className="container mx-auto px-4 py-2.5 flex items-center gap-3">
          <button onClick={() => navigate('/lobby')} className="text-muted-foreground hover:text-foreground">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <TrendingUp className="w-4 h-4 text-primary" />
          <h1 className="font-mono text-sm font-semibold tracking-tight">SINAIS ALAVANCA · UNDER 4.5</h1>
        </div>
      </header>

      <main className="container mx-auto px-4 py-6 max-w-5xl space-y-6">
        {/* Banner explicativo */}
        <div className="rounded-lg border border-primary/30 bg-gradient-to-r from-primary/10 to-primary/5 p-4">
          <div className="flex items-start gap-3">
            <Zap className="w-5 h-5 text-primary mt-0.5" />
            <div className="flex-1 text-sm text-muted-foreground space-y-1">
              <p className="text-foreground font-semibold">Alavancagem com juros compostos</p>
              <p>
                Mercado Under 4.5 tem odds baixas (1.06–1.20) mas <span className="text-foreground font-medium">alta taxa de acerto</span>.
                Reserve um teto da sua banca real (sugerido: <span className="text-primary font-mono">5% a 10%</span>) e reinvista o retorno de cada green:
                <span className="font-mono text-foreground"> 100 → 110 → 121 → 133 → 146…</span>
              </p>
              <p className="flex items-center gap-1.5 text-yellow-400/90 text-xs">
                <AlertTriangle className="w-3.5 h-3.5" />
                Pare após 2 reds consecutivos. Juros compostos amplificam perdas tanto quanto ganhos.
              </p>
            </div>
          </div>
        </div>

        {/* Stats 30d */}
        {stats && stats.total > 0 && (
          <div className="grid grid-cols-4 gap-2">
            <Stat label="Total 30d" value={String(stats.total)} />
            <Stat label="Greens" value={String(stats.green)} tone="success" />
            <Stat label="Acerto" value={`${((stats.green / stats.total) * 100).toFixed(0)}%`} tone="primary" />
            <Stat label="Odd média" value={stats.avgOdd ? stats.avgOdd.toFixed(2) : '—'} />
          </div>
        )}

        {/* Calculadora juros compostos */}
        <section className="rounded-lg border border-border bg-card p-4">
          <div className="flex items-center gap-2 mb-3">
            <Calculator className="w-4 h-4 text-primary" />
            <h2 className="font-mono text-xs uppercase tracking-wider text-foreground">Calculadora de juros compostos</h2>
          </div>
          <div className="grid grid-cols-3 gap-2 mb-3">
            <Input label="Stake inicial (R$)" value={stakeInicial} onChange={setStakeInicial} step={10} min={10} />
            <Input label="Odd média" value={oddMedia} onChange={setOddMedia} step={0.01} min={1.04} />
            <Input label="Greens previstos" value={greensSeguidos} onChange={setGreensSeguidos} step={1} min={1} max={20} integer />
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-xs font-mono">
              <thead className="text-muted-foreground">
                <tr className="border-b border-border">
                  <th className="text-left py-1">#</th>
                  <th className="text-right py-1">Stake</th>
                  <th className="text-right py-1">Retorno</th>
                  <th className="text-right py-1">Lucro acum.</th>
                </tr>
              </thead>
              <tbody>
                {projecao.linhas.map((l) => (
                  <tr key={l.entrada} className="border-b border-border/40">
                    <td className="py-1 text-muted-foreground">{l.entrada}</td>
                    <td className="text-right">R$ {l.stake.toFixed(2)}</td>
                    <td className="text-right text-foreground">R$ {l.retorno.toFixed(2)}</td>
                    <td className="text-right text-success">+R$ {l.lucro.toFixed(2)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="mt-2 text-[11px] text-muted-foreground">
            Após {greensSeguidos} greens consecutivos seu lucro líquido seria{' '}
            <span className="text-success font-semibold">+R$ {projecao.lucroFinal.toFixed(2)}</span>{' '}
            (ROI de {((projecao.lucroFinal / stakeInicial) * 100).toFixed(1)}% sobre o stake inicial).
          </p>
        </section>

        {/* Ações de varredura */}
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => scan('live')}
            disabled={scanning !== null}
            className="px-3 py-2 rounded-md border border-border bg-card hover:bg-card/70 hover:border-primary/40 text-xs font-mono flex items-center gap-2 disabled:opacity-50"
          >
            {scanning === 'live' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
            Varredura Ao Vivo
          </button>
          <button
            onClick={() => scan('prelive')}
            disabled={scanning !== null}
            className="px-3 py-2 rounded-md border border-border bg-card hover:bg-card/70 hover:border-primary/40 text-xs font-mono flex items-center gap-2 disabled:opacity-50"
          >
            {scanning === 'prelive' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Clock className="w-3.5 h-3.5" />}
            Varredura Pré-Live
          </button>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <>
            <Section title="Ao Vivo" badge="LIVE" tone="destructive" sinais={ao_vivo} />
            <Section title="Pré-Live (hoje/amanhã)" badge="PRE" tone="muted" sinais={pre_live} />
            {liquidados.length > 0 && (
              <Section title="Últimos liquidados" badge="HIST" tone="muted" sinais={liquidados} compact />
            )}
          </>
        )}
      </main>
    </div>
  );
}

function Stat({ label, value, tone }: { label: string; value: string; tone?: 'success' | 'primary' }) {
  const cls = tone === 'success' ? 'text-success' : tone === 'primary' ? 'text-primary' : 'text-foreground';
  return (
    <div className="rounded-md border border-border bg-card px-3 py-2">
      <p className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</p>
      <p className={`text-lg font-mono font-semibold ${cls}`}>{value}</p>
    </div>
  );
}

function Input({
  label, value, onChange, step = 1, min, max, integer,
}: {
  label: string; value: number; onChange: (v: number) => void;
  step?: number; min?: number; max?: number; integer?: boolean;
}) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</span>
      <input
        type="number"
        value={value}
        step={step}
        min={min}
        max={max}
        onChange={(e) => {
          const v = integer ? parseInt(e.target.value || '0', 10) : parseFloat(e.target.value || '0');
          if (!isNaN(v)) onChange(v);
        }}
        className="rounded-md border border-border bg-background px-2 py-1.5 text-sm font-mono text-foreground"
      />
    </label>
  );
}

function Section({
  title, badge, tone, sinais, compact,
}: {
  title: string; badge: string; tone: 'destructive' | 'muted'; sinais: Sinal[]; compact?: boolean;
}) {
  const badgeCls = tone === 'destructive'
    ? 'bg-destructive/15 text-destructive border-destructive/30'
    : 'bg-muted text-muted-foreground border-border';
  return (
    <section>
      <div className="flex items-center gap-2 mb-2">
        <h3 className="font-mono text-xs uppercase tracking-wider text-foreground">{title}</h3>
        <span className={`text-[10px] font-mono px-1.5 py-0.5 rounded border ${badgeCls}`}>{badge}</span>
        <span className="text-[11px] text-muted-foreground">({sinais.length})</span>
      </div>
      {sinais.length === 0 ? (
        <div className="rounded-md border border-dashed border-border bg-card/30 p-4 text-center text-xs text-muted-foreground">
          Nenhum sinal no momento. Clique em "Varredura" para buscar oportunidades.
        </div>
      ) : (
        <div className="space-y-2">
          {sinais.map((s) => (
            <article
              key={s.id}
              className={`rounded-md border bg-card p-3 ${
                s.status === 'green' ? 'border-success/40' :
                s.status === 'red' ? 'border-destructive/40' :
                'border-border'
              }`}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-foreground truncate">{s.match_name}</p>
                  <div className="flex items-center gap-2 mt-0.5 text-[11px] text-muted-foreground font-mono">
                    {s.league && <span className="truncate">{s.league}</span>}
                    {s.mode === 'live' && s.minute != null && (
                      <span className="text-destructive">{s.minute}' · {s.goals_total ?? 0} gols</span>
                    )}
                    {s.mode === 'prelive' && s.kickoff && (
                      <span>{new Date(s.kickoff).toLocaleString('pt-BR', { weekday: 'short', hour: '2-digit', minute: '2-digit' })}</span>
                    )}
                  </div>
                  {!compact && s.reasons?.length > 0 && (
                    <ul className="mt-1.5 text-[11px] text-muted-foreground space-y-0.5">
                      {s.reasons.map((r, i) => (
                        <li key={i} className="flex items-start gap-1">
                          <span className="text-primary">•</span> {r}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
                <div className="text-right shrink-0">
                  <p className="text-[10px] uppercase font-mono text-muted-foreground">Under 4.5</p>
                  <p className="text-lg font-mono font-semibold text-primary">
                    {s.odd_under45 ? `@${Number(s.odd_under45).toFixed(2)}` : '—'}
                  </p>
                  <p className="text-[10px] font-mono text-muted-foreground">score {Number(s.score).toFixed(0)}</p>
                  {s.status === 'green' && <span className="text-[10px] font-mono text-success">✓ GREEN</span>}
                  {s.status === 'red' && <span className="text-[10px] font-mono text-destructive">✕ RED</span>}
                </div>
              </div>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}
