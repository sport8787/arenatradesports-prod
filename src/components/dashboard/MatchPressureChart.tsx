import { useEffect, useMemo, useState } from "react";
import { Area, AreaChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
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
  // Normaliza pra timeline contínua 0..max
  const series = useMemo(() => {
    if (!data.timeline.length) return [];
    const max = Math.max(90, ...data.timeline.map((p) => p.minute));
    const map = new Map(data.timeline.map((p) => [p.minute, p]));
    const out: Array<{ minute: number; home: number; awayNeg: number }> = [];
    for (let m = 0; m <= max; m++) {
      const p = map.get(m);
      out.push({
        minute: m,
        home: p?.home ?? 0,
        awayNeg: p ? -p.away : 0,
      });
    }
    return out;
  }, [data.timeline]);

  if (series.length === 0) {
    return (
      <div className="flex items-center justify-center text-xs text-muted-foreground py-8">
        Sem dados de pressão para este jogo ainda.
      </div>
    );
  }

  const HOME_COLOR = "hsl(217 91% 60%)"; // azul vibrante (estilo concorrente)
  const AWAY_COLOR = "hsl(25 95% 55%)";  // laranja vibrante

  const goalEvents = showEvents ? data.events.filter((e) => e.type === "goal") : [];
  const redEvents = showEvents ? data.events.filter((e) => e.type === "red") : [];

  return (
    <div className="w-full" style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart
          data={series}
          margin={{ top: 14, right: 8, left: 0, bottom: showAxis ? 16 : 4 }}
          barCategoryGap={0}
          barGap={0}
        >
          {showAxis && (
            <XAxis
              dataKey="minute"
              ticks={[0, 15, 30, 45, 60, 75, 90]}
              tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }}
              stroke="hsl(var(--border))"
            />
          )}
          <YAxis hide domain={[-100, 100]} />
          <ReferenceLine y={0} stroke="hsl(var(--border))" strokeWidth={1} />
          <ReferenceLine
            x={45}
            stroke="hsl(var(--muted-foreground))"
            strokeDasharray="2 3"
            label={showAxis ? { value: "45'", position: "insideBottom", fill: "hsl(var(--muted-foreground))", fontSize: 10 } : undefined}
          />

          {/* Gols: bolinha sobre o eixo zero */}
          {goalEvents.map((ev, i) => (
            <ReferenceLine
              key={`g-${ev.minute}-${i}`}
              x={ev.minute}
              stroke="transparent"
              label={{
                value: "⚽",
                position: "center",
                fill: "hsl(var(--foreground))",
                fontSize: 14,
              }}
            />
          ))}
          {redEvents.map((ev, i) => (
            <ReferenceLine
              key={`r-${ev.minute}-${i}`}
              x={ev.minute}
              stroke="hsl(var(--destructive))"
              strokeWidth={1.5}
              strokeDasharray="3 3"
              label={{
                value: "🟥",
                position: "top",
                fill: "hsl(var(--foreground))",
                fontSize: 12,
              }}
            />
          ))}

          {/* Sem stackId: cada barra ancora no zero independentemente.
              home (positivo) sobe; awayNeg (negativo) desce — gráfico espelhado. */}
          <Bar dataKey="home" isAnimationActive={false}>
            {series.map((_, i) => (
              <Cell key={`h-${i}`} fill={HOME_COLOR} />
            ))}
          </Bar>
          <Bar dataKey="awayNeg" isAnimationActive={false}>
            {series.map((_, i) => (
              <Cell key={`a-${i}`} fill={AWAY_COLOR} />
            ))}
          </Bar>

          <Tooltip
            cursor={{ fill: "hsl(var(--muted) / 0.3)" }}
            content={({ active, payload, label }) => {
              if (!active || !payload?.length) return null;
              const home = payload.find((p) => p.dataKey === "home")?.value as number;
              const away = -(payload.find((p) => p.dataKey === "awayNeg")?.value as number);
              return (
                <div className="rounded-md bg-popover/95 border border-border px-2 py-1.5 text-xs shadow-lg backdrop-blur-sm">
                  <div className="font-orbitron text-[10px] text-muted-foreground mb-1">
                    {String(label)}'
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-sm" style={{ background: HOME_COLOR }} />
                    <span className="text-foreground">{data.header.home.name}</span>
                    <span className="ml-auto font-bold">{Math.round(home)}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-sm" style={{ background: AWAY_COLOR }} />
                    <span className="text-foreground">{data.header.away.name}</span>
                    <span className="ml-auto font-bold">{Math.round(away)}</span>
                  </div>
                </div>
              );
            }}
          />
        </BarChart>
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
