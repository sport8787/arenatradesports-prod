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

export function useMatchPressure(args: FetchArgs, refreshMs = 30000) {
  const [data, setData] = useState<PressureData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const key = `${args.home}::${args.away}::${args.fixtureId ?? ""}`;

  useEffect(() => {
    let alive = true;
    let timer: number | undefined;

    async function load() {
      try {
        const { data: resp, error: err } = await supabase.functions.invoke("sportmonks-pressure", {
          body: {
            home: args.home,
            away: args.away,
            commence_time: args.commenceTime,
            fixtureId: args.fixtureId,
          },
        });
        if (!alive) return;
        if (err) throw err;
        if ((resp as any)?.error) throw new Error((resp as any).error);
        setData(resp as PressureData);
        setError(null);
      } catch (e: any) {
        if (!alive) return;
        setError(e?.message || "Falha ao carregar gráfico de pressão");
      } finally {
        if (alive) setLoading(false);
      }
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

  return (
    <div className="w-full" style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={series} margin={{ top: 8, right: 8, left: 0, bottom: showAxis ? 16 : 0 }}>
          <defs>
            <linearGradient id="pressureHome" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity={0.7} />
              <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity={0.05} />
            </linearGradient>
            <linearGradient id="pressureAway" x1="0" y1="1" x2="0" y2="0">
              <stop offset="0%" stopColor="hsl(var(--destructive))" stopOpacity={0.7} />
              <stop offset="100%" stopColor="hsl(var(--destructive))" stopOpacity={0.05} />
            </linearGradient>
          </defs>
          {showAxis && (
            <XAxis
              dataKey="minute"
              ticks={[0, 15, 30, 45, 60, 75, 90]}
              tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }}
              stroke="hsl(var(--border))"
            />
          )}
          <YAxis hide domain={[-100, 100]} />
          <ReferenceLine y={0} stroke="hsl(var(--border))" strokeDasharray="2 2" />
          <ReferenceLine x={45} stroke="hsl(var(--border))" strokeDasharray="2 2" />

          {/* Marcadores de eventos: gols (linhas verticais com label) */}
          {showEvents && data.events.map((ev, i) => (
            <ReferenceLine
              key={`${ev.minute}-${i}`}
              x={ev.minute}
              stroke={ev.type === "goal" ? "hsl(var(--primary))" : "hsl(var(--destructive))"}
              strokeWidth={1.5}
              strokeDasharray={ev.type === "goal" ? "0" : "3 3"}
              label={{
                value: ev.type === "goal" ? "⚽" : "🟥",
                position: "top",
                fill: "hsl(var(--foreground))",
                fontSize: 12,
              }}
            />
          ))}

          <Area
            type="monotone"
            dataKey="home"
            stroke="hsl(var(--primary))"
            strokeWidth={1.5}
            fill="url(#pressureHome)"
            isAnimationActive={false}
          />
          <Area
            type="monotone"
            dataKey="awayNeg"
            stroke="hsl(var(--destructive))"
            strokeWidth={1.5}
            fill="url(#pressureAway)"
            isAnimationActive={false}
          />

          <Tooltip
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
                    <span className="w-2 h-2 rounded-sm bg-primary" />
                    <span className="text-foreground">{data.header.home.name}</span>
                    <span className="ml-auto font-bold">{Math.round(home)}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-sm bg-destructive" />
                    <span className="text-foreground">{data.header.away.name}</span>
                    <span className="ml-auto font-bold">{Math.round(away)}</span>
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
