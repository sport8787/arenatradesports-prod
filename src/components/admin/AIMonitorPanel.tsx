import { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Activity, AlertTriangle, CheckCircle2, Sparkles, Bot } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";

type Provider = "gemini" | "openai";
type Arena = "mycroft" | "trader-sports" | "punter";

interface AIEdge {
  name: string;
  provider: Provider;
  arena: Arena;
  description: string;
}

// Catálogo de edges relacionadas ao Oráculo Mycroft, Arena Trader Sports e Arena Punter
export const AI_EDGES: AIEdge[] = [
  // Oráculo Mycroft (chats e análises gerais)
  { name: "mycroft-ai", provider: "gemini", arena: "mycroft", description: "Mycroft Bluff/Análise de respostas" },
  { name: "mycroft-analyst-chat", provider: "gemini", arena: "mycroft", description: "Chat com analista Mycroft" },
  { name: "mycroft-match-chat", provider: "gemini", arena: "mycroft", description: "Debate ao vivo sobre partida" },
  { name: "mycroft-sports-chat", provider: "gemini", arena: "mycroft", description: "Chat geral de esportes" },
  { name: "claude-jury", provider: "gemini", arena: "mycroft", description: "Júri de validação (3 jurados)" },
  { name: "analyze-real-bets", provider: "gemini", arena: "mycroft", description: "Análise de entradas reais importadas" },
  { name: "parse-bet-screenshot", provider: "gemini", arena: "mycroft", description: "Vision: parse de screenshots" },

  // Arena Trader Sports
  { name: "mycroft-sports-analysis", provider: "gemini", arena: "trader-sports", description: "Análise principal ao vivo" },
  { name: "arena-trader-analyze", provider: "gemini", arena: "trader-sports", description: "Análise de cenários de trade" },
  { name: "mycroft-corners-analyzer", provider: "gemini", arena: "trader-sports", description: "Análise de escanteios live" },

  // Arena Punter (OpenAI direto)
  { name: "mycroft-punter-analysis", provider: "openai", arena: "punter", description: "Análise principal Punter" },
  { name: "mycroft-punter-anthropic", provider: "openai", arena: "punter", description: "Análise Punter (legado anthropic→openai)" },
  { name: "mycroft-corners-punter", provider: "gemini", arena: "punter", description: "Escanteios pré-live Punter" },
];

const ARENA_LABEL: Record<Arena, string> = {
  mycroft: "Oráculo Mycroft",
  "trader-sports": "Arena Trader Sports",
  punter: "Arena Punter",
};

const ARENA_COLOR: Record<Arena, string> = {
  mycroft: "bg-purple-500/10 text-purple-300 border-purple-500/30",
  "trader-sports": "bg-blue-500/10 text-blue-300 border-blue-500/30",
  punter: "bg-emerald-500/10 text-emerald-300 border-emerald-500/30",
};

interface RunRow {
  function_name: string;
  status: string;
  duration_ms: number | null;
  status_code: number | null;
  started_at: string;
  error_message: string | null;
}

interface ErrorRow {
  function_name: string;
  error_message: string;
  status_code: number | null;
  severity: string;
  created_at: string;
}

interface Props {
  runs: RunRow[];
  errors: ErrorRow[];
}

interface EdgeMetrics {
  edge: AIEdge;
  totalRuns: number;
  successRuns: number;
  errorRuns: number;
  avgLatency: number | null;
  p95Latency: number | null;
  errorRate: number;
  lastRun: RunRow | null;
  lastError: ErrorRow | null;
  errorsCount: number;
  status: "ok" | "warn" | "down" | "idle";
}

function computeMetrics(edge: AIEdge, runs: RunRow[], errors: ErrorRow[]): EdgeMetrics {
  const edgeRuns = runs.filter((r) => r.function_name === edge.name);
  const edgeErrors = errors.filter((e) => e.function_name === edge.name);
  const successRuns = edgeRuns.filter((r) => r.status === "success").length;
  const errorRuns = edgeRuns.length - successRuns;
  const durations = edgeRuns
    .map((r) => r.duration_ms)
    .filter((d): d is number => d != null && d > 0)
    .sort((a, b) => a - b);
  const avgLatency = durations.length
    ? Math.round(durations.reduce((s, d) => s + d, 0) / durations.length)
    : null;
  const p95Latency = durations.length
    ? durations[Math.min(durations.length - 1, Math.floor(durations.length * 0.95))]
    : null;
  const errorRate = edgeRuns.length ? (errorRuns / edgeRuns.length) * 100 : 0;
  const lastRun = edgeRuns[0] ?? null;
  const lastError = edgeErrors[0] ?? null;

  let status: EdgeMetrics["status"] = "idle";
  if (edgeRuns.length === 0 && edgeErrors.length === 0) status = "idle";
  else if (errorRate >= 50 || (edgeErrors.length > 0 && edgeRuns.length === 0)) status = "down";
  else if (errorRate >= 15 || edgeErrors.length >= 3) status = "warn";
  else status = "ok";

  return {
    edge,
    totalRuns: edgeRuns.length,
    successRuns,
    errorRuns,
    avgLatency,
    p95Latency,
    errorRate,
    lastRun,
    lastError,
    errorsCount: edgeErrors.length,
    status,
  };
}

const STATUS_BADGE: Record<EdgeMetrics["status"], { label: string; cls: string; icon: typeof CheckCircle2 }> = {
  ok: { label: "OK", cls: "bg-emerald-500/15 text-emerald-300 border-emerald-500/40", icon: CheckCircle2 },
  warn: { label: "ATENÇÃO", cls: "bg-amber-500/15 text-amber-300 border-amber-500/40", icon: AlertTriangle },
  down: { label: "FALHA", cls: "bg-red-500/15 text-red-300 border-red-500/40", icon: AlertTriangle },
  idle: { label: "OCIOSA", cls: "bg-muted text-muted-foreground border-border", icon: Activity },
};

const PROVIDER_BADGE: Record<Provider, { label: string; cls: string; icon: typeof Sparkles }> = {
  gemini: { label: "Gemini 2.5 Flash", cls: "bg-violet-500/10 text-violet-300 border-violet-500/30", icon: Sparkles },
  openai: { label: "GPT-5 mini", cls: "bg-cyan-500/10 text-cyan-300 border-cyan-500/30", icon: Bot },
};

export function AIMonitorPanel({ runs, errors }: Props) {
  const metrics = useMemo(
    () => AI_EDGES.map((e) => computeMetrics(e, runs, errors)),
    [runs, errors],
  );

  const grouped = useMemo(() => {
    const out: Record<Arena, EdgeMetrics[]> = {
      mycroft: [],
      "trader-sports": [],
      punter: [],
    };
    metrics.forEach((m) => out[m.edge.arena].push(m));
    return out;
  }, [metrics]);

  const summary = useMemo(() => {
    const totalRuns = metrics.reduce((s, m) => s + m.totalRuns, 0);
    const totalErrors = metrics.reduce((s, m) => s + m.errorsCount, 0);
    const down = metrics.filter((m) => m.status === "down").length;
    const warn = metrics.filter((m) => m.status === "warn").length;
    const ok = metrics.filter((m) => m.status === "ok").length;
    const idle = metrics.filter((m) => m.status === "idle").length;
    const allLatencies = metrics.map((m) => m.avgLatency).filter((d): d is number => d != null);
    const globalAvgLatency = allLatencies.length
      ? Math.round(allLatencies.reduce((s, d) => s + d, 0) / allLatencies.length)
      : null;
    return { totalRuns, totalErrors, down, warn, ok, idle, globalAvgLatency };
  }, [metrics]);

  return (
    <div className="space-y-4">
      {/* Summary cards */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
        <Card>
          <CardContent className="p-3">
            <div className="text-xs text-muted-foreground">Saudáveis</div>
            <div className="text-2xl font-bold text-emerald-400">{summary.ok}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3">
            <div className="text-xs text-muted-foreground">Atenção</div>
            <div className="text-2xl font-bold text-amber-400">{summary.warn}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3">
            <div className="text-xs text-muted-foreground">Falhando</div>
            <div className="text-2xl font-bold text-red-400">{summary.down}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3">
            <div className="text-xs text-muted-foreground">Total execuções</div>
            <div className="text-2xl font-bold">{summary.totalRuns}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3">
            <div className="text-xs text-muted-foreground">Latência média</div>
            <div className="text-2xl font-bold">
              {summary.globalAvgLatency != null ? `${summary.globalAvgLatency} ms` : "—"}
            </div>
          </CardContent>
        </Card>
      </div>

      {(["mycroft", "trader-sports", "punter"] as Arena[]).map((arena) => (
        <Card key={arena}>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <span className={`rounded-md border px-2 py-0.5 text-xs ${ARENA_COLOR[arena]}`}>
                {ARENA_LABEL[arena]}
              </span>
              <span className="text-xs font-normal text-muted-foreground">
                {grouped[arena].length} edges
              </span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ScrollArea className="max-h-[420px]">
              <div className="space-y-2">
                {grouped[arena].map((m) => {
                  const StBadge = STATUS_BADGE[m.status];
                  const PvBadge = PROVIDER_BADGE[m.edge.provider];
                  const StIcon = StBadge.icon;
                  const PvIcon = PvBadge.icon;
                  return (
                    <div
                      key={m.edge.name}
                      className="rounded-lg border bg-card/50 p-3 transition hover:bg-accent/20"
                    >
                      <div className="mb-2 flex flex-wrap items-center gap-2">
                        <Badge variant="outline" className={`${StBadge.cls} text-[10px]`}>
                          <StIcon className="mr-1 h-3 w-3" /> {StBadge.label}
                        </Badge>
                        <code className="text-sm font-semibold">{m.edge.name}</code>
                        <Badge variant="outline" className={`${PvBadge.cls} text-[10px]`}>
                          <PvIcon className="mr-1 h-3 w-3" /> {PvBadge.label}
                        </Badge>
                        <span className="ml-auto text-xs text-muted-foreground">
                          {m.lastRun
                            ? `Últ. exec: ${formatDistanceToNow(new Date(m.lastRun.started_at), { locale: ptBR, addSuffix: true })}`
                            : "Sem execuções na janela"}
                        </span>
                      </div>

                      <p className="mb-2 text-xs text-muted-foreground">{m.edge.description}</p>

                      <div className="grid grid-cols-2 gap-2 text-xs md:grid-cols-5">
                        <div>
                          <div className="text-muted-foreground">Execuções</div>
                          <div className="font-mono font-semibold">{m.totalRuns}</div>
                        </div>
                        <div>
                          <div className="text-muted-foreground">Sucesso/Erro</div>
                          <div className="font-mono font-semibold">
                            <span className="text-emerald-400">{m.successRuns}</span>
                            {" / "}
                            <span className="text-red-400">{m.errorRuns}</span>
                          </div>
                        </div>
                        <div>
                          <div className="text-muted-foreground">Taxa erro</div>
                          <div
                            className={`font-mono font-semibold ${
                              m.errorRate >= 50
                                ? "text-red-400"
                                : m.errorRate >= 15
                                  ? "text-amber-400"
                                  : "text-foreground"
                            }`}
                          >
                            {m.totalRuns ? `${m.errorRate.toFixed(1)}%` : "—"}
                          </div>
                        </div>
                        <div>
                          <div className="text-muted-foreground">Latência média</div>
                          <div className="font-mono font-semibold">
                            {m.avgLatency != null ? `${m.avgLatency} ms` : "—"}
                          </div>
                        </div>
                        <div>
                          <div className="text-muted-foreground">P95</div>
                          <div className="font-mono font-semibold">
                            {m.p95Latency != null ? `${m.p95Latency} ms` : "—"}
                          </div>
                        </div>
                      </div>

                      {m.lastError && (
                        <div className="mt-2 rounded border border-red-500/30 bg-red-500/5 p-2">
                          <div className="mb-1 flex items-center gap-2 text-[10px] uppercase tracking-wide text-red-300">
                            <AlertTriangle className="h-3 w-3" />
                            Último erro · {formatDistanceToNow(new Date(m.lastError.created_at), { locale: ptBR, addSuffix: true })}
                            {m.lastError.status_code && (
                              <Badge variant="outline" className="text-[10px]">
                                HTTP {m.lastError.status_code}
                              </Badge>
                            )}
                            <span className="ml-auto text-muted-foreground">
                              {m.errorsCount} erro{m.errorsCount !== 1 ? "s" : ""} na janela
                            </span>
                          </div>
                          <p className="break-words font-mono text-xs text-foreground/90">
                            {m.lastError.error_message}
                          </p>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
