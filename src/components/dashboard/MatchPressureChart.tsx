import { useEffect, useMemo, useState } from "react";
import { Area, AreaChart, Line, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import { Loader2, AlertTriangle } from "lucide-react";

export interface PressurePoint { minute: number; home: number; away: number; }
export interface PressureEvent { minute: number; type: "goal" | "red"; side: "home" | "away"; player: string; }
export interface PressureHeader {
  home: { id: number; name: string; logo: string };
  away: { id: number; name: string; logo: string };
  score: { home: number; away: number };
  state: string;
  minute: number;
}
export interface PressureForm { home: ("W" | "D" | "L")[]; away: ("W" | "D" | "L")[]; }

export interface PressureData {
  fixtureId: number;
  source: "pressure" | "trends";
  header: PressureHeader;
  timeline: PressurePoint[];
  xgTimeline?: PressurePoint[];
  events: PressureEvent[];
  form: PressureForm;
}

interface FetchArgs { home: string; away: string; commenceTime?: string; fixtureId?: number; }

// Cache em memória por chave (home::away::fixtureId) com TTL de 30s.
// Evita chamar futodds-pressure múltiplas vezes para o mesmo jogo quando
// vários cards/modais são montados em paralelo.
const PRESSURE_CACHE = new Map<string, { ts: number; data: PressureData }>();
const PRESSURE_INFLIGHT = new Map<string, Promise<PressureData | null>>();
const PRESSURE_TTL_MS = 30_000;

export function useMatchPressure(args: FetchArgs, refreshMs = 60000) {
  const [data, setData] = useState<PressureData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const key = `${args.home}::${args.away}::${args.fixtureId ?? ""}`;

  useEffect(() => {
    let alive = true;
    let timer: number | undefined;

    async function fetchFresh(): Promise<PressureData | null> {
      try {
        let resp: any = null;
        // Sportmonks PRIMEIRO (Pressure Index oficial / Trends suavizado)
        try {
          const sm = await supabase.functions.invoke("sportmonks-pressure", {
            body: { home: args.home, away: args.away, commence_time: args.commenceTime, fixtureId: args.fixtureId },
          });
          const smData: any = sm.data;
          if (!sm.error && smData && Array.isArray(smData.timeline) && smData.timeline.length > 0) {
            resp = smData;
          }
        } catch { /* cai para Futodds */ }

        // Futodds como fallback
        if (!resp) {
          try {
            const fu = await supabase.functions.invoke("futodds-pressure", {
              body: { home: args.home, away: args.away, commence_time: args.commenceTime, fixtureId: args.fixtureId },
            });
            const fuData: any = fu.data;
            const fuOk = !fu.error && fuData && Array.isArray(fuData.timeline) && fuData.timeline.length > 0
              && !fuData?._futodds?.not_found;
            if (fuOk) resp = fuData;
          } catch { /* estimador vazio abaixo */ }
        }

        if (!resp) {
          resp = {
            fixtureId: args.fixtureId ?? 0,
            source: "trends",
            header: {
              home: { id: 0, name: args.home, logo: "" },
              away: { id: 0, name: args.away, logo: "" },
              score: { home: 0, away: 0 }, state: "NS", minute: 0,
            },
            timeline: [], events: [], form: { home: [], away: [] },
            _fallback: "estimator_no_data",
          };
        }
        return resp as PressureData;
      } catch (e: any) {
        setError(e?.message || "Falha ao carregar gráfico de pressão");
        return null;
      }
    }

    async function load() {
      // Cache hit?
      const cached = PRESSURE_CACHE.get(key);
      const now = Date.now();
      if (cached && now - cached.ts < PRESSURE_TTL_MS) {
        if (alive) { setData(cached.data); setError(null); setLoading(false); }
        return;
      }
      // Inflight dedup
      const existing = PRESSURE_INFLIGHT.get(key);
      const promise = existing ?? (() => {
        const p = fetchFresh().finally(() => PRESSURE_INFLIGHT.delete(key));
        PRESSURE_INFLIGHT.set(key, p);
        return p;
      })();
      const fresh = await promise;
      if (!alive) return;
      if (fresh) {
        PRESSURE_CACHE.set(key, { ts: Date.now(), data: fresh });
        setData(fresh);
        setError(null);
      }
      setLoading(false);
    }

    setLoading(true);
    load();
    timer = window.setInterval(load, refreshMs);
    return () => { alive = false; if (timer) window.clearInterval(timer); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, refreshMs]);

  return { data, loading, error };
}

interface ChartProps {
  data: PressureData;
  height?: number;
  showAxis?: boolean;
  showEvents?: boolean;
}

export function MatchPressureChart({ data, height = 220, showAxis = true, showEvents = true }: ChartProps) {
  // Timeline contínua + suavização extra (média móvel 3') e espelhamento.
  const series = useMemo(() => {
    if (!data.timeline.length) return [];
    const max = Math.max(90, ...data.timeline.map((p) => p.minute));
    const map = new Map(data.timeline.map((p) => [p.minute, p]));
    const raw: Array<{ minute: number; home: number; away: number }> = [];
    for (let m = 0; m <= max; m++) {
      const p = map.get(m);
      raw.push({ minute: m, home: p?.home ?? 0, away: p?.away ?? 0 });
    }
    // média móvel 3'
    return raw.map((p, i) => {
      const slice = raw.slice(Math.max(0, i - 2), Math.min(raw.length, i + 3));
      const home = slice.reduce((s, x) => s + x.home, 0) / slice.length;
      const away = slice.reduce((s, x) => s + x.away, 0) / slice.length;
      return { minute: p.minute, home: Math.round(home), awayNeg: -Math.round(away) };
    });
  }, [data.timeline]);

  if (series.length === 0) {
    return (
      <div className="flex items-center justify-center text-xs text-muted-foreground py-8">
        Sem dados de pressão para este jogo ainda.
      </div>
    );
  }

  const HOME_COLOR = "hsl(199 89% 60%)"; // ciano elegante
  const AWAY_COLOR = "hsl(340 82% 62%)"; // magenta/rosa

  const goalEvents = showEvents ? data.events.filter((e) => e.type === "goal") : [];
  const redEvents = showEvents ? data.events.filter((e) => e.type === "red") : [];
  const currentMinute = data.header.minute || 0;
  const uid = useMemo(() => Math.random().toString(36).slice(2, 8), []);
  const gradHome = `pressGradH-${uid}`;
  const gradAway = `pressGradA-${uid}`;

  return (
    <div className="w-full" style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart
          data={series}
          margin={{ top: 16, right: 12, left: 0, bottom: showAxis ? 20 : 4 }}
        >
          <defs>
            <linearGradient id={gradHome} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={HOME_COLOR} stopOpacity={0.75} />
              <stop offset="100%" stopColor={HOME_COLOR} stopOpacity={0.05} />
            </linearGradient>
            <linearGradient id={gradAway} x1="0" y1="1" x2="0" y2="0">
              <stop offset="0%" stopColor={AWAY_COLOR} stopOpacity={0.75} />
              <stop offset="100%" stopColor={AWAY_COLOR} stopOpacity={0.05} />
            </linearGradient>
          </defs>

          {showAxis && (
            <XAxis
              dataKey="minute"
              ticks={[0, 15, 30, 45, 60, 75, 90]}
              tickFormatter={(v) => `${v}'`}
              tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }}
              stroke="hsl(var(--border))"
              tickLine={false}
              axisLine={false}
            />
          )}
          <YAxis hide domain={[-100, 100]} />

          {/* eixo zero */}
          <ReferenceLine y={0} stroke="hsl(var(--border))" strokeWidth={1} />
          {/* intervalo */}
          <ReferenceLine
            x={45}
            stroke="hsl(var(--muted-foreground) / 0.4)"
            strokeDasharray="3 4"
          />
          {/* minuto atual com glow */}
          {currentMinute > 0 && (
            <ReferenceLine
              x={currentMinute}
              stroke="hsl(var(--primary))"
              strokeWidth={1.5}
              strokeDasharray="0"
              label={showAxis ? {
                value: `${currentMinute}'`,
                position: "top",
                fill: "hsl(var(--primary))",
                fontSize: 10,
                fontWeight: 700,
              } : undefined}
            />
          )}

          {/* Eventos */}
          {goalEvents.map((ev, i) => (
            <ReferenceLine
              key={`g-${ev.minute}-${i}`}
              x={ev.minute}
              stroke={ev.side === "home" ? HOME_COLOR : AWAY_COLOR}
              strokeOpacity={0.5}
              strokeDasharray="2 2"
              label={{
                value: "⚽",
                position: ev.side === "home" ? "top" : "bottom",
                fontSize: 13,
              }}
            />
          ))}
          {redEvents.map((ev, i) => (
            <ReferenceLine
              key={`r-${ev.minute}-${i}`}
              x={ev.minute}
              stroke="hsl(var(--destructive))"
              strokeWidth={1.2}
              strokeDasharray="3 3"
              label={{ value: "🟥", position: "top", fontSize: 11 }}
            />
          ))}

          <Area
            type="monotone"
            dataKey="home"
            stroke={HOME_COLOR}
            strokeWidth={2}
            fill={`url(#${gradHome})`}
            isAnimationActive={false}
            dot={false}
            activeDot={{ r: 3, fill: HOME_COLOR, stroke: "hsl(var(--background))", strokeWidth: 1.5 }}
          />
          <Area
            type="monotone"
            dataKey="awayNeg"
            stroke={AWAY_COLOR}
            strokeWidth={2}
            fill={`url(#${gradAway})`}
            isAnimationActive={false}
            dot={false}
            activeDot={{ r: 3, fill: AWAY_COLOR, stroke: "hsl(var(--background))", strokeWidth: 1.5 }}
          />

          <Tooltip
            cursor={{ stroke: "hsl(var(--muted-foreground) / 0.4)", strokeWidth: 1, strokeDasharray: "3 3" }}
            content={({ active, payload, label }) => {
              if (!active || !payload?.length) return null;
              const home = payload.find((p) => p.dataKey === "home")?.value as number;
              const away = -(payload.find((p) => p.dataKey === "awayNeg")?.value as number);
              return (
                <div className="rounded-lg bg-popover/95 border border-border px-2.5 py-1.5 text-xs shadow-xl backdrop-blur-sm">
                  <div className="font-orbitron text-[10px] text-muted-foreground mb-1.5">
                    Minuto {String(label)}'
                  </div>
                  <div className="flex items-center gap-2 mb-0.5">
                    <span className="w-2 h-2 rounded-full" style={{ background: HOME_COLOR }} />
                    <span className="text-foreground truncate max-w-[120px]">{data.header.home.name}</span>
                    <span className="ml-auto font-bold tabular-nums">{Math.round(home)}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full" style={{ background: AWAY_COLOR }} />
                    <span className="text-foreground truncate max-w-[120px]">{data.header.away.name}</span>
                    <span className="ml-auto font-bold tabular-nums">{Math.round(away)}</span>
                  </div>
                </div>
              );
            }}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

// Sparkline mini para o card
export function MatchPressureSparkline({ data, height = 36 }: { data: PressureData; height?: number }) {
  return (
    <MatchPressureChart data={data} height={height} showAxis={false} showEvents={false} />
  );
}

// Estado de loading/erro reutilizável
export function PressureFallback({ loading, error }: { loading: boolean; error: string | null }) {
  if (loading) {
    return (
      <div className="flex items-center justify-center gap-2 py-6 text-xs text-muted-foreground">
        <Loader2 className="w-3.5 h-3.5 animate-spin" /> Carregando gráfico de pressão…
      </div>
    );
  }
  if (error) {
    return (
      <div className="flex items-center justify-center gap-2 py-6 text-xs text-amber-500">
        <AlertTriangle className="w-3.5 h-3.5" /> {error}
      </div>
    );
  }
  return null;
}

// Bolinhas de forma recente
export function FormDots({ form, side }: { form: ("W" | "D" | "L")[]; side: "home" | "away" }) {
  const align = side === "home" ? "justify-start" : "justify-end";
  return (
    <div className={cn("flex gap-1", align)}>
      {form.map((r, i) => (
        <span
          key={i}
          className={cn(
            "w-2.5 h-2.5 rounded-full",
            r === "W" && "bg-primary",
            r === "D" && "bg-muted-foreground/50",
            r === "L" && "bg-destructive",
          )}
          title={r === "W" ? "Vitória" : r === "D" ? "Empate" : "Derrota"}
        />
      ))}
    </div>
  );
}
