import { useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { ArrowLeft, Loader2, TrendingUp, TrendingDown, Target, BarChart3 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { translateMarket } from "@/utils/marketTranslator";
import { cn } from "@/lib/utils";

type Period = "today";
type ResultFilter = "all" | "GREEN" | "RED";

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
  greens: number;
  reds: number;
  win_rate: number | null;
  roi_percent: number | null;
  profit_total: number;
  stake_total: number;
}

const PERIOD_LABELS: Record<Period, string> = {
  today: "Hoje",
  "7d": "7 dias",
  "14d": "14 dias",
  "30d": "30 dias",
};

const STORAGE_KEY = "live_sinais_filters_v1";

const isSettledResult = (result: Signal["result"]): result is "GREEN" | "RED" =>
  result === "GREEN" || result === "RED";

function normalizeResultFilter(value: string | null | undefined): ResultFilter {
  if (value === "GREEN" || value === "RED") return value;
  return "all";
}

function readPersisted(): { period: Period; result: ResultFilter } {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      return {
        period: parsed?.period ?? "today",
        result: normalizeResultFilter(parsed?.result),
      };
    }
  } catch {}
  return { period: "today", result: "all" };
}

export default function SinaisLiquidados() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const persisted = readPersisted();

  const [period, setPeriod] = useState<Period>(
    (searchParams.get("period") as Period) || persisted.period,
  );
  const [resultFilter, setResultFilter] = useState<ResultFilter>(
    normalizeResultFilter(searchParams.get("result") || persisted.result),
  );
  const [signals, setSignals] = useState<Signal[]>([]);
  const [loading, setLoading] = useState(true);

  // Persist filters
  useEffect(() => {
    const next = new URLSearchParams(searchParams);
    next.set("period", period);
    next.set("result", resultFilter);
    setSearchParams(next, { replace: true });
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ period, result: resultFilter }));
  }, [period, resultFilter]);

  // Load data
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    (async () => {
      const { data, error } = await supabase.rpc("get_live_sinais_summary", { _period: period });
      if (cancelled) return;
      if (error) {
        console.error("get_live_sinais_summary error:", error);
        setSignals([]);
      } else {
        const payload = data as unknown as { summary: Summary; signals: Signal[] };
        setSignals(payload?.signals ?? []);
      }
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [period]);

  const settledSignals = useMemo(
    () => signals.filter((signal) => isSettledResult(signal.result)),
    [signals],
  );

  const filteredSignals = useMemo(() => {
    if (resultFilter === "all") return settledSignals;
    return settledSignals.filter((s) => s.result === resultFilter);
  }, [settledSignals, resultFilter]);

  const summary = useMemo<Summary>(() => {
    const greens = settledSignals.filter((signal) => signal.result === "GREEN").length;
    const reds = settledSignals.filter((signal) => signal.result === "RED").length;
    const stakeTotal = settledSignals.reduce((sum, signal) => sum + Number(signal.stake ?? 0), 0);
    const profitTotal = settledSignals.reduce(
      (sum, signal) => sum + Number(signal.profit_loss ?? 0),
      0,
    );

    return {
      total: settledSignals.length,
      greens,
      reds,
      win_rate: greens + reds > 0 ? Number(((greens / (greens + reds)) * 100).toFixed(1)) : null,
      roi_percent:
        stakeTotal > 0 ? Number(((profitTotal / stakeTotal) * 100).toFixed(2)) : null,
      profit_total: Number(profitTotal.toFixed(2)),
      stake_total: Number(stakeTotal.toFixed(2)),
    };
  }, [settledSignals]);

  const filterCounts = useMemo(() => {
    return {
      all: settledSignals.length,
      GREEN: settledSignals.filter((s) => s.result === "GREEN").length,
      RED: settledSignals.filter((s) => s.result === "RED").length,
    };
  }, [settledSignals]);

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
            <h1 className="font-orbitron text-lg font-bold text-primary">Sinais Liquidados</h1>
            <p className="text-xs text-muted-foreground">Arena Trader Sports · ao vivo</p>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-6 space-y-6">
        {/* Period selector */}
        <Tabs value={period} onValueChange={(v) => setPeriod(v as Period)}>
          <TabsList className="grid grid-cols-4 w-full max-w-md bg-secondary/50">
            {(Object.keys(PERIOD_LABELS) as Period[]).map((p) => (
              <TabsTrigger key={p} value={p}>
                {PERIOD_LABELS[p]}
              </TabsTrigger>
            ))}
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
                value={summary.total}
                icon={<BarChart3 className="w-4 h-4" />}
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
              Resumo confiável · {PERIOD_LABELS[period]} · {summary.greens}G / {summary.reds}R · lucro{" "}
              {summary.profit_total != null
                ? `${summary.profit_total > 0 ? "+" : ""}${summary.profit_total}u`
                : "—"}
            </div>

            <div className="text-[11px] text-muted-foreground/80">
              Sinais sem liquidação concluída ficam ocultos até auditoria para não contaminar as métricas.
            </div>

            {/* Result filter */}
            <Tabs value={resultFilter} onValueChange={(v) => setResultFilter(v as ResultFilter)}>
              <TabsList className="bg-secondary/50">
                <TabsTrigger value="all">Todos ({filterCounts.all})</TabsTrigger>
                <TabsTrigger value="GREEN">GREEN ({filterCounts.GREEN})</TabsTrigger>
                <TabsTrigger value="RED">RED ({filterCounts.RED})</TabsTrigger>
              </TabsList>
            </Tabs>

            {/* Signals list */}
            {filteredSignals.length === 0 ? (
              <Card className="p-10 text-center text-muted-foreground">
                Nenhum sinal para este recorte.
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
      return (
        <Badge variant="outline" className="text-muted-foreground">
          Pendente
        </Badge>
      );
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
