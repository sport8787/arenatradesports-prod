import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { ArrowLeft, Loader2, TrendingUp, TrendingDown, Target, BarChart3, RefreshCw } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { translateMarket } from "@/utils/marketTranslator";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

type Period = "today" | "yesterday" | "7d" | "14d" | "30d";
type ViewFilter = "all" | "approved" | "GREEN" | "RED";

interface Signal {
  id: string;
  match_id: string;
  home_team: string | null;
  away_team: string | null;
  championship: string | null;
  market: string;
  odd: number | null;
  stake: number;
  confidence: number | null;
  verdict: string;
  approved_at_minute: number | null;
  approved_at_score: string | null;
  match_date: string;
  result: "GREEN" | "RED" | "VOID" | "HALF_GREEN" | "HALF_RED" | null;
  goals_home: number | null;
  goals_away: number | null;
  profit_loss: number | null;
  settled_at: string | null;
}

interface Summary {
  total: number;
  approved_total: number;
  pending_total: number;
  settled_total: number;
  greens: number;
  reds: number;
  win_rate: number | null;
  roi_percent: number | null;
  profit_total: number;
  stake_total: number;
}

const PERIOD_LABELS: Record<Period, string> = {
  today: "Hoje",
  yesterday: "Ontem",
  "7d": "7 dias",
  "14d": "14 dias",
  "30d": "30 dias",
};

const STORAGE_KEY = "live_sinais_filters_v1";

type Source = "deterministico" | "ia";

const isSettledResult = (result: Signal["result"]): result is "GREEN" | "RED" =>
  result === "GREEN" || result === "RED";

function normalizePeriod(value: string | null | undefined): Period {
  if (value === "today" || value === "yesterday" || value === "7d" || value === "14d" || value === "30d") return value;
  return "30d";
}

function normalizeViewFilter(value: string | null | undefined): ViewFilter {
  if (value === "approved" || value === "GREEN" || value === "RED") return value;
  return "all";
}

function readPersisted(): { period: Period; view: ViewFilter } {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      return {
        period: normalizePeriod(parsed?.period),
        view: normalizeViewFilter(parsed?.view),
      };
    }
  } catch {}
  return { period: "30d", view: "all" };
}

// Cache módulo-level: sobrevive navegação entre rotas (evita spinner ao voltar)
let _liquidadosCache: Signal[] = [];

export default function SinaisLiquidados() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const persisted = readPersisted();

  const [period, setPeriod] = useState<Period>(normalizePeriod(searchParams.get("period") || persisted.period));
  const [viewFilter, setViewFilter] = useState<ViewFilter>(
    normalizeViewFilter(searchParams.get("view") || searchParams.get("result") || persisted.view),
  );
  const [source, setSource] = useState<Source>(
    (searchParams.get("source") === "ia" ? "ia" : "deterministico") as Source,
  );
  const [signals, setSignals] = useState<Signal[]>(() => _liquidadosCache);
  const [summary, setSummary] = useState<Summary>({
    total: 0,
    approved_total: 0,
    pending_total: 0,
    settled_total: 0,
    greens: 0,
    reds: 0,
    win_rate: null,
    roi_percent: null,
    profit_total: 0,
    stake_total: 0,
  });
  const [loading, setLoading] = useState(_liquidadosCache.length === 0);
  const [runningSettlement, setRunningSettlement] = useState(false);

  // Persist filters
  useEffect(() => {
    const next = new URLSearchParams(searchParams);
    next.set("period", period);
    next.set("view", viewFilter);
    next.set("source", source);
    next.delete("result");
    setSearchParams(next, { replace: true });
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ period, view: viewFilter }));
  }, [period, viewFilter, source]);

  // Load data
  const loadData = useCallback(async () => {
    let cancelled = false;
    setLoading(true);
    const rpcName = source === "ia" ? "get_live_sinais_ia_summary" : "get_live_sinais_summary";
    const { data, error } = await supabase.rpc(rpcName as any, { _period: period });
    if (cancelled) return;
    if (error) {
      console.error("get_live_sinais_summary error:", error);
      setSignals([]);
      setSummary({
        total: 0,
        approved_total: 0,
        pending_total: 0,
        settled_total: 0,
        greens: 0,
        reds: 0,
        win_rate: null,
        roi_percent: null,
        profit_total: 0,
        stake_total: 0,
      });
    } else {
      const payload = data as unknown as { summary: Summary; signals: Signal[] };
      _liquidadosCache = payload?.signals ?? [];
      setSignals(_liquidadosCache);
      setSummary(payload?.summary ?? {
        total: 0,
        approved_total: 0,
        pending_total: 0,
        settled_total: 0,
        greens: 0,
        reds: 0,
        win_rate: null,
        roi_percent: null,
        profit_total: 0,
        stake_total: 0,
      });
    }
    setLoading(false);
    return () => {
      cancelled = true;
    };
  }, [period, source]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const filteredSignals = useMemo(() => {
    if (viewFilter === "approved") return signals.filter((signal) => !isSettledResult(signal.result));
    if (viewFilter === "GREEN" || viewFilter === "RED") return signals.filter((signal) => signal.result === viewFilter);
    return signals;
  }, [signals, viewFilter]);

  const filterCounts = useMemo(() => {
    return {
      all: signals.length,
      approved: signals.filter((s) => !isSettledResult(s.result)).length,
      GREEN: signals.filter((s) => s.result === "GREEN").length,
      RED: signals.filter((s) => s.result === "RED").length,
    };
  }, [signals]);

  async function runManualSettlement() {
    setRunningSettlement(true);
    const { data, error } = await supabase.functions.invoke("liquidar-sinais-ao-vivo", {
      body: { manual: true, source: "sinais-liquidados-page" },
    });

    if (error) {
      console.error("manual liquidation error:", error);
      toast.error("Falha ao rodar a liquidação manual.");
      setRunningSettlement(false);
      return;
    }

    toast.success(`Liquidação manual concluída: ${data?.settled ?? 0} liquidados.`);
    await loadData();
    setRunningSettlement(false);
  }

  return (
    <div className="min-h-screen bg-background pb-20">
      <header className="sticky top-0 z-40 border-b border-border bg-card/80 backdrop-blur-lg">
        <div className="container mx-auto px-4 py-3 flex items-center gap-3">
          <button
            onClick={() => navigate("/lobby")}
            className="text-muted-foreground hover:text-foreground transition-colors"
            aria-label="Retornar"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <h1 className="font-orbitron text-lg font-bold text-primary">Entradas Liquidados</h1>
            <p className="text-xs text-muted-foreground">Arena Trader Sports · ao vivo</p>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-6 space-y-6">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div className="text-xs text-muted-foreground font-orbitron">
            Recorte: <span className="text-primary">{PERIOD_LABELS[period]}</span> · entradas aprovados entram na lista no momento do envio ao Telegram.
          </div>
          <Button onClick={runManualSettlement} disabled={runningSettlement} variant="outline" className="w-full md:w-auto">
            {runningSettlement ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
            Rodar liquidação manual
          </Button>
        </div>

        <Tabs value={source} onValueChange={(v) => setSource(v as Source)}>
          <TabsList className="bg-secondary/50 grid grid-cols-2 w-full md:w-auto md:inline-flex">
            <TabsTrigger value="deterministico" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
              🧮 Determinístico
            </TabsTrigger>
            <TabsTrigger value="ia" className="data-[state=active]:bg-accent data-[state=active]:text-accent-foreground">
              🤖 Oráculo IA
            </TabsTrigger>
          </TabsList>
        </Tabs>

        <Tabs value={period} onValueChange={(v) => setPeriod(v as Period)}>
          <TabsList className="bg-secondary/50 flex flex-wrap h-auto">
            <TabsTrigger value="today">Hoje</TabsTrigger>
            <TabsTrigger value="yesterday">Ontem</TabsTrigger>
            <TabsTrigger value="7d">7 dias</TabsTrigger>
            <TabsTrigger value="14d">14 dias</TabsTrigger>
            <TabsTrigger value="30d">30 dias</TabsTrigger>
          </TabsList>
        </Tabs>

        {loading ? (
          <div className="flex flex-col items-center justify-center py-20 gap-4">
            <Loader2 className="w-8 h-8 text-primary animate-spin" />
            <p className="text-sm text-muted-foreground font-orbitron">Carregando…</p>
          </div>
        ) : (
          <>
            {/* Summary cards */}
            <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
              <SummaryCard
                label="Total"
                value={summary.approved_total}
                icon={<BarChart3 className="w-4 h-4" />}
              />
              <SummaryCard
                label="Aprovados"
                value={summary.pending_total}
                icon={<RefreshCw className="w-4 h-4" />}
              />
              <SummaryCard
                label="GREEN"
                value={summary.greens}
                icon={<TrendingUp className="w-4 h-4" />}
                valueColor="text-success"
              />
              <SummaryCard
                label="RED"
                value={summary.reds}
                icon={<TrendingDown className="w-4 h-4" />}
                valueColor="text-destructive"
              />
              <SummaryCard
                label="Win Rate"
                value={summary.win_rate != null ? `${summary.win_rate}%` : "—"}
                icon={<Target className="w-4 h-4" />}
                valueColor="text-primary"
                sub={
                  summary.roi_percent != null ? (
                    <span
                      className={cn(
                        "text-xs font-orbitron",
                        summary.roi_percent >= 0 ? "text-success" : "text-destructive",
                      )}
                    >
                      ROI {summary.roi_percent > 0 ? "+" : ""}
                      {summary.roi_percent}%
                    </span>
                  ) : null
                }
              />
            </div>

            <div className="text-xs text-muted-foreground font-orbitron">
              Resumo · {PERIOD_LABELS[period]} · {summary.greens}G / {summary.reds}R · lucro{" "}
              {summary.profit_total != null
                ? `${summary.profit_total > 0 ? "+" : ""}${summary.profit_total}u`
                : "—"}
            </div>

            <div className="text-[11px] text-muted-foreground/80">
              A aba <span className="font-semibold text-foreground">Entradas Aprovadas</span> mostra entradas pendentes de liquidação; GREEN e RED entram assim que forem fechados.
            </div>

            {/* Result filter */}
            <Tabs value={viewFilter} onValueChange={(v) => setViewFilter(v as ViewFilter)}>
              <TabsList className="bg-secondary/50">
                <TabsTrigger value="all">Todos ({filterCounts.all})</TabsTrigger>
                <TabsTrigger value="approved">Entradas Aprovadas ({filterCounts.approved})</TabsTrigger>
                <TabsTrigger value="GREEN">GREEN ({filterCounts.GREEN})</TabsTrigger>
                <TabsTrigger value="RED">RED ({filterCounts.RED})</TabsTrigger>
              </TabsList>
            </Tabs>

            {/* Signals list */}
            {filteredSignals.length === 0 ? (
              <Card className="p-10 text-center text-muted-foreground">
                Nenhum entrada para este recorte.
              </Card>
            ) : (
              <div className="space-y-2">
                {filteredSignals.map((s) => (
                  <SignalRow key={s.id} signal={s} />
                ))}
              </div>
            )}
          </>
        )}
      </main>
    </div>
  );
}

function SummaryCard({
  label,
  value,
  icon,
  valueColor,
  sub,
}: {
  label: string;
  value: string | number;
  icon: React.ReactNode;
  valueColor?: string;
  sub?: React.ReactNode;
}) {
  return (
    <Card className="p-3 space-y-1">
      <div className="flex items-center gap-1.5 text-muted-foreground text-xs">
        {icon}
        <span>{label}</span>
      </div>
      <div className={cn("font-orbitron text-xl font-bold", valueColor ?? "text-foreground")}>
        {value}
      </div>
      {sub}
    </Card>
  );
}

function SignalRow({ signal }: { signal: Signal }) {
  const dateStr = new Date(signal.match_date).toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
  const score =
    signal.goals_home != null && signal.goals_away != null
      ? `${signal.goals_home}-${signal.goals_away}`
      : null;

  const resultBadge = (() => {
    if (!signal.result)
      return <Badge variant="outline">{signal.verdict === "LABAREDA" ? "LABAREDA" : "APROVADO"}</Badge>;
    if (signal.result === "GREEN")
      return <Badge className="bg-success/20 text-success border-success/30">GREEN</Badge>;
    if (signal.result === "RED")
      return (
        <Badge className="bg-destructive/20 text-destructive border-destructive/30">RED</Badge>
      );
    return <Badge variant="secondary">{signal.result}</Badge>;
  })();

  return (
    <Card className="p-3">
      <div className="flex flex-col md:flex-row md:items-center gap-2 md:gap-4">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            {resultBadge}
            <span className="font-semibold truncate">
              {signal.home_team || "?"} vs {signal.away_team || "?"}
            </span>
            {score && (
              <span className="text-sm font-orbitron text-muted-foreground">[{score}]</span>
            )}
          </div>
          <div className="text-xs text-muted-foreground mt-1 flex flex-wrap gap-x-3">
            <span>{translateMarket(signal.market)}</span>
            <span>@ {Number(signal.odd ?? 0).toFixed(2)}</span>
            {signal.confidence != null && <span>conf {signal.confidence}%</span>}
            {signal.approved_at_minute != null && (
              <span>aprovado @ {signal.approved_at_minute}'</span>
            )}
            <span>{dateStr}</span>
          </div>
          {signal.championship && (
            <div className="text-[10px] text-muted-foreground/70 mt-0.5 truncate">
              {signal.championship}
            </div>
          )}
        </div>
        <div className="text-right">
          {signal.profit_loss != null && signal.result && (
            <div
              className={cn(
                "font-orbitron font-bold",
                signal.profit_loss >= 0 ? "text-success" : "text-destructive",
              )}
            >
              {signal.profit_loss > 0 ? "+" : ""}
              {Number(signal.profit_loss).toFixed(2)}u
            </div>
          )}
          <div className="text-[10px] text-muted-foreground">stake {signal.stake}%</div>
        </div>
      </div>
    </Card>
  );
}
