import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import {
  FormDots,
  MatchPressureChart,
  PressureFallback,
  useMatchPressure,
} from "./MatchPressureChart";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  home: string;
  away: string;
  commenceTime?: string;
  // fallback estático para placar/minuto enquanto a edge não responde
  fallbackHomeLogo?: string;
  fallbackAwayLogo?: string;
  fallbackScoreHome?: number;
  fallbackScoreAway?: number;
  fallbackMinute?: number;
}

export default function MatchPressureModal({
  open, onOpenChange, home, away, commenceTime,
  fallbackHomeLogo, fallbackAwayLogo, fallbackScoreHome, fallbackScoreAway, fallbackMinute,
}: Props) {
  // Só ativa o fetch quando aberto
  const { data, loading, error } = useMatchPressure(
    open ? { home, away, commenceTime } : { home: "", away: "" },
    30000,
  );
  const [showXg, setShowXg] = useState(false);
  const hasXg = (data?.xgTimeline?.length ?? 0) > 0;

  const headerHome = data?.header.home.name || home;
  const headerAway = data?.header.away.name || away;
  const homeLogo = data?.header.home.logo || fallbackHomeLogo;
  const awayLogo = data?.header.away.logo || fallbackAwayLogo;
  const scoreHome = data?.header.score.home ?? fallbackScoreHome ?? 0;
  const scoreAway = data?.header.score.away ?? fallbackScoreAway ?? 0;
  const minute = data?.header.minute || fallbackMinute || 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl bg-card border-border">
        <DialogHeader>
          <DialogTitle className="font-orbitron text-sm uppercase tracking-wider text-muted-foreground">
            Gráfico de Pressão {data?.source === "trends" && <span className="text-[10px] opacity-60">(sintético)</span>}
          </DialogTitle>
        </DialogHeader>

        {/* Header escudos + placar */}
        <div className="grid grid-cols-3 items-center gap-3 py-2">
          <div className="flex flex-col items-center gap-1">
            {homeLogo && <img src={homeLogo} alt={headerHome} className="w-12 h-12 object-contain" />}
            <span className="text-xs font-semibold text-center">{headerHome}</span>
            {data && <FormDots form={data.form.home} side="home" />}
          </div>

          <div className="flex flex-col items-center">
            {minute > 0 && (
              <span className="text-[11px] font-orbitron text-primary mb-1">{minute}'</span>
            )}
            <div className="flex items-center gap-3 text-3xl font-orbitron font-bold">
              <span>{scoreHome}</span>
              <span className="text-muted-foreground text-base">-</span>
              <span>{scoreAway}</span>
            </div>
          </div>

          <div className="flex flex-col items-center gap-1">
            {awayLogo && <img src={awayLogo} alt={headerAway} className="w-12 h-12 object-contain" />}
            <span className="text-xs font-semibold text-center">{headerAway}</span>
            {data && <FormDots form={data.form.away} side="away" />}
          </div>
        </div>

        {/* Gráfico */}
        <div className="rounded-lg bg-background/50 border border-border p-2">
          {data ? (
            <MatchPressureChart data={data} height={260} />
          ) : (
            <PressureFallback loading={loading} error={error} />
          )}
        </div>

        {/* Lista de eventos abaixo */}
        {data && data.events.length > 0 && (
          <div className="space-y-1 max-h-32 overflow-y-auto text-xs pt-2">
            {data.events.map((ev, i) => (
              <div key={i} className="flex items-center gap-2 text-muted-foreground">
                <span className="font-orbitron w-8 text-right">{ev.minute}'</span>
                <span>{ev.type === "goal" ? "⚽" : "🟥"}</span>
                <span className={ev.side === "home" ? "text-primary" : "text-destructive"}>
                  {ev.side === "home" ? headerHome : headerAway}
                </span>
                {ev.player && <span className="text-foreground/80">— {ev.player}</span>}
              </div>
            ))}
          </div>
        )}

        <div className="text-[10px] text-muted-foreground/60 text-center pt-1">
          Atualiza a cada 30s
        </div>
      </DialogContent>
    </Dialog>
  );
}
