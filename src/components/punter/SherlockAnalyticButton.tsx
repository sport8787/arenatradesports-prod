import { useState } from "react";
import { Microscope, Loader2, ShieldAlert, CheckCircle2, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface SherlockButtonProps {
  homeTeam: string;
  awayTeam: string;
  homeId?: number | null;
  awayId?: number | null;
  season?: number | null;
  market?: string;
  planName?: string;
  analysisId?: string | null;
  size?: "sm" | "default";
  variant?: "outline" | "secondary" | "ghost";
}

interface SherlockReport {
  veto: boolean;
  veto_reason: string | null;
  confidence_delta: number;
  notes: string[];
  bonus: string[];
  vetos: string[];
}

interface SherlockResponse {
  ok: boolean;
  home_team: string;
  away_team: string;
  market: string;
  plan_name: string;
  home_stats: any;
  away_stats: any;
  report: SherlockReport;
}

export default function SherlockAnalyticButton({
  homeTeam,
  awayTeam,
  homeId,
  awayId,
  season,
  market = "",
  planName = "",
  analysisId = null,
  size = "sm",
  variant = "outline",
}: SherlockButtonProps) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<SherlockResponse | null>(null);

  const run = async () => {
    setLoading(true);
    setResult(null);
    setOpen(true);
    try {
      const { data, error } = await supabase.functions.invoke("mycroft-punter-analytic", {
        body: {
          home_team: homeTeam,
          away_team: awayTeam,
          home_id: homeId ?? null,
          away_id: awayId ?? null,
          season: season ?? new Date().getFullYear(),
          market,
          plan_name: planName,
          analysis_id: analysisId,
        },
      });
      if (error) throw error;
      setResult(data as SherlockResponse);
      if (data?.report?.veto) {
        toast.error("Sherlock vetou esta operação", { description: data.report.veto_reason ?? "" });
      } else if (data?.report?.bonus?.length) {
        toast.success("Sherlock confirmou bônus de confiança");
      } else {
        toast("Análise Sherlock concluída");
      }
    } catch (err: any) {
      toast.error("Falha ao rodar Sherlock", { description: err?.message ?? String(err) });
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <Button
        type="button"
        size={size}
        variant={variant}
        onClick={run}
        disabled={loading}
        className="gap-1"
      >
        {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Microscope className="h-3.5 w-3.5" />}
        Sherlock
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Microscope className="h-5 w-5 text-primary" />
              Análise Sherlock — {homeTeam} vs {awayTeam}
            </DialogTitle>
            <DialogDescription>
              Indicadores estatísticos avançados (CV, médias casa/fora, saldo) aplicados ao mercado{market ? `: ${market}` : ""}.
            </DialogDescription>
          </DialogHeader>

          {loading && (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          )}

          {result && !loading && (
            <div className="space-y-4 text-sm">
              {result.report.veto && (
                <div className="flex items-start gap-2 rounded-lg border border-destructive/40 bg-destructive/10 p-3">
                  <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0 text-destructive" />
                  <div>
                    <p className="font-semibold text-destructive">Veto Sherlock</p>
                    <p className="text-destructive/90">{result.report.veto_reason}</p>
                  </div>
                </div>
              )}

              {!result.report.veto && result.report.bonus.length > 0 && (
                <div className="flex items-start gap-2 rounded-lg border border-emerald-500/40 bg-emerald-500/10 p-3">
                  <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-500" />
                  <div className="space-y-1">
                    <p className="font-semibold text-emerald-600">Bônus de confiança</p>
                    {result.report.bonus.map((b, i) => (
                      <p key={i} className="text-emerald-700 dark:text-emerald-400">{b}</p>
                    ))}
                  </div>
                </div>
              )}

              {result.report.confidence_delta !== 0 && (
                <div className="flex items-center gap-2 rounded-md bg-muted px-3 py-2">
                  <AlertTriangle className="h-4 w-4 text-muted-foreground" />
                  <span>
                    Ajuste de confiança sugerido:{" "}
                    <strong className={result.report.confidence_delta > 0 ? "text-emerald-500" : "text-amber-500"}>
                      {result.report.confidence_delta > 0 ? "+" : ""}{result.report.confidence_delta}pp
                    </strong>
                  </span>
                </div>
              )}

              <div>
                <p className="mb-2 font-semibold">Indicadores</p>
                <div className="space-y-1 rounded-md border border-border bg-card/50 p-3 text-xs leading-relaxed">
                  {result.report.notes.length === 0
                    ? <p className="text-muted-foreground">Sem dados estatísticos suficientes (cache vazio ou amostra &lt; 3 jogos).</p>
                    : result.report.notes.map((n, i) => <p key={i}>{n}</p>)}
                </div>
              </div>

              {!result.report.veto && result.report.bonus.length === 0 && result.report.confidence_delta === 0 && (
                <p className="text-xs text-muted-foreground italic">
                  Nenhum gatilho Sherlock disparado para este mercado. A análise principal segue válida.
                </p>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
