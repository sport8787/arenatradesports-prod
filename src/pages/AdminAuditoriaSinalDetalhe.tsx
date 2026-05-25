import { useEffect, useState } from "react";
import { Navigate, useParams, Link } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Loader2, ArrowLeft, AlertTriangle, CheckCircle2, XCircle, Clock } from "lucide-react";
import { toast } from "sonner";

const ADMIN_EMAIL = "pabloescobar@gmail.com";

interface DetailRow {
  id: string;
  source: "primary" | "shadow_af";
  match_id: string;
  market: string;
  verdict: string;
  odd: number | null;
  confidence: number | null;
  thesis: string | null;
  plan_name: string | null;
  reason: string | null;
  approved_at_timestamp: string | null;
  approved_at_minute: number | null;
  approved_at_score_home: number | null;
  approved_at_score_away: number | null;
  approved_at_period: string | null;
  result: string | null;
  final_score_home: number | null;
  final_score_away: number | null;
  settled_at: string | null;
  settle_reason: string | null;
  created_at: string | null;
  stats_snapshot: any;
  home_team?: string | null;
  away_team?: string | null;
  championship?: string | null;
  current_score_home?: number | null;
  current_score_away?: number | null;
  status?: string | null;
}

const fmtDate = (d: string | null) => (!d ? "—" : new Date(d).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "medium" }));

function detectInconsistencies(r: DetailRow): string[] {
  const issues: string[] = [];
  const m = (r.market || "").toLowerCase();
  const ah = r.approved_at_score_home;
  const aa = r.approved_at_score_away;
  const fh = r.final_score_home;
  const fa = r.final_score_away;

  if (r.approved_at_timestamp == null) issues.push("SNAPSHOT_AUSENTE");
  if (ah == null || aa == null) issues.push("PLACAR_APROVACAO_NULO");

  if (/(pr[óo]ximo\s+gol|next\s+goal)/i.test(r.market || "") && ah != null && aa != null && fh != null && fa != null) {
    const apprT = (ah || 0) + (aa || 0);
    const finalT = (fh || 0) + (fa || 0);
    if (r.result === "green" && finalT <= apprT) issues.push("PROX_GOL_GREEN_SEM_GOL");
    if (r.result === "red" && finalT > apprT) issues.push("PROX_GOL_RED_COM_GOL");
  }

  const over = m.match(/over\s*([0-9]+(\.[0-9]+)?)/);
  if (over && r.result && fh != null && fa != null) {
    const line = parseFloat(over[1]);
    const total = (fh || 0) + (fa || 0);
    const should = total > line ? "green" : "red";
    if (r.result !== should) issues.push(`OVER_${line}_INCONSISTENTE`);
  }
  const under = m.match(/under\s*([0-9]+(\.[0-9]+)?)/);
  if (under && r.result && fh != null && fa != null) {
    const line = parseFloat(under[1]);
    const total = (fh || 0) + (fa || 0);
    const should = total < line ? "green" : "red";
    if (r.result !== should) issues.push(`UNDER_${line}_INCONSISTENTE`);
  }

  if (ah != null && aa != null && fh != null && fa != null && (fh < ah || fa < aa)) {
    issues.push("PLACAR_REGRESSO");
  }
  return issues;
}

export default function AdminAuditoriaSinalDetalhe() {
  const { user, loading: authLoading } = useAuth();
  const { source, id } = useParams<{ source: "primary"; id: string }>();
  const [row, setRow] = useState<DetailRow | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user || user.email?.toLowerCase() !== ADMIN_EMAIL.toLowerCase()) return;
    if (!source || !id) return;
    (async () => {
      setLoading(true);
      try {
        const table = source === "primary" ? "mycroft_analyses" : "mycroft_analyses_shadow_af";
        const { data, error } = await (supabase as any).from(table).select("*").eq("id", id).maybeSingle();
        if (error) throw error;
        if (!data) {
          toast.error("Sinal não encontrado");
          setRow(null);
          return;
        }
        const { data: lm } = await (supabase as any)
          .from("live_matches")
          .select("home_team,away_team,championship,score_home,score_away,status")
          .eq("match_id", data.match_id)
          .maybeSingle();
        setRow({
          ...data,
          source,
          home_team: lm?.home_team ?? data.stats_snapshot?.home_team ?? null,
          away_team: lm?.away_team ?? data.stats_snapshot?.away_team ?? null,
          championship: lm?.championship ?? null,
          current_score_home: lm?.score_home ?? null,
          current_score_away: lm?.score_away ?? null,
          status: lm?.status ?? null,
        });
      } catch (e: any) {
        toast.error(e?.message || "Erro ao carregar detalhe");
      } finally {
        setLoading(false);
      }
    })();
  }, [user, source, id]);

  if (authLoading) {
    return <div className="min-h-screen flex items-center justify-center bg-background"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>;
  }
  if (!user) return <Navigate to={`/auth?redirect=/admin/auditoria-sinais/${source}/${id}`} replace />;
  if (user.email?.toLowerCase() !== ADMIN_EMAIL.toLowerCase()) return <Navigate to="/punter" replace />;

  const issues = row ? detectInconsistencies(row) : [];
  const ah = row?.approved_at_score_home;
  const aa = row?.approved_at_score_away;
  const fh = row?.final_score_home;
  const fa = row?.final_score_away;
  const apprTotal = (ah ?? 0) + (aa ?? 0);
  const finalTotal = (fh ?? 0) + (fa ?? 0);
  const goalsAfterApproval = ah != null && aa != null && fh != null && fa != null ? finalTotal - apprTotal : null;

  return (
    <div className="min-h-screen bg-background text-foreground p-4 md:p-8">
      <div className="max-w-5xl mx-auto space-y-6">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-3">
            <Link to="/admin/auditoria-sinais">
              <Button variant="outline" size="sm"><ArrowLeft className="w-4 h-4 mr-1" /> Auditoria</Button>
            </Link>
            <div>
              <h1 className="text-2xl md:text-3xl font-bold">Detalhe do Sinal</h1>
              <p className="text-sm text-muted-foreground">Snapshot completo no momento da aprovação × resultado final</p>
            </div>
          </div>
          {row && (
            <Badge variant="outline" className="text-xs">{row.source === "primary" ? "API-Football (primary)" : "Shadow AF"}</Badge>
          )}
        </div>

        {loading || !row ? (
          <div className="flex items-center justify-center py-20"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>
        ) : (
          <>
            {/* Cabeçalho do jogo */}
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between gap-3 flex-wrap">
                  <div>
                    {row.championship && (
                      <p className="text-xs uppercase tracking-wider text-primary">{row.championship}</p>
                    )}
                    <CardTitle className="text-xl">
                      {row.home_team || "—"} <span className="text-muted-foreground">×</span> {row.away_team || "—"}
                    </CardTitle>
                    <p className="text-xs text-muted-foreground mt-1 break-all">match_id: {row.match_id}</p>
                  </div>
                  <div className="text-right">
                    {row.result === "green" && (
                      <Badge className="bg-emerald-500/15 text-emerald-400 border-emerald-500/30 text-base px-3 py-1">
                        <CheckCircle2 className="w-4 h-4 mr-1" /> GREEN
                      </Badge>
                    )}
                    {row.result === "red" && (
                      <Badge className="bg-destructive/15 text-destructive border-destructive/30 text-base px-3 py-1">
                        <XCircle className="w-4 h-4 mr-1" /> RED
                      </Badge>
                    )}
                    {!row.result && (
                      <Badge variant="outline" className="text-base px-3 py-1">
                        <Clock className="w-4 h-4 mr-1" /> Pendente
                      </Badge>
                    )}
                  </div>
                </div>
              </CardHeader>
            </Card>

            {/* Inconsistências */}
            {issues.length > 0 && (
              <Card className="border-amber-500/40 bg-amber-500/5">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm flex items-center gap-2 text-amber-400">
                    <AlertTriangle className="w-4 h-4" /> Inconsistências detectadas
                  </CardTitle>
                </CardHeader>
                <CardContent className="flex flex-wrap gap-2">
                  {issues.map((i) => (
                    <Badge key={i} className="bg-amber-500/15 text-amber-400 border-amber-500/30">{i}</Badge>
                  ))}
                </CardContent>
              </Card>
            )}

            {/* Snapshot vs Final */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Card>
                <CardHeader><CardTitle className="text-sm">📸 Snapshot da Aprovação</CardTitle></CardHeader>
                <CardContent className="space-y-2 text-sm">
                  <Row label="Aprovado em" value={fmtDate(row.approved_at_timestamp)} />
                  <Row label="Minuto" value={row.approved_at_minute != null ? `${row.approved_at_minute}'` : "—"} />
                  <Row label="Período" value={row.approved_at_period || "—"} />
                  <Row label="Placar (snapshot)" value={`${ah ?? "?"} : ${aa ?? "?"}`} mono />
                  <Row label="Total de gols (snapshot)" value={String(apprTotal)} mono />
                </CardContent>
              </Card>
              <Card>
                <CardHeader><CardTitle className="text-sm">🏁 Resultado Final</CardTitle></CardHeader>
                <CardContent className="space-y-2 text-sm">
                  <Row label="Liquidado em" value={fmtDate(row.settled_at)} />
                  <Row label="Status atual" value={row.status || "—"} />
                  <Row label="Placar final" value={`${fh ?? "—"} : ${fa ?? "—"}`} mono />
                  <Row label="Total de gols (final)" value={fh != null && fa != null ? String(finalTotal) : "—"} mono />
                  <Row
                    label="Gols após aprovação"
                    value={goalsAfterApproval != null ? String(goalsAfterApproval) : "—"}
                    mono
                    highlight={goalsAfterApproval === 0 && /(pr[óo]ximo\s+gol|next\s+goal)/i.test(row.market || "")}
                  />
                </CardContent>
              </Card>
            </div>

            {/* Mercado e veredito */}
            <Card>
              <CardHeader><CardTitle className="text-sm">🎯 Mercado & Veredito</CardTitle></CardHeader>
              <CardContent className="space-y-2 text-sm">
                <Row label="Mercado" value={row.market} />
                <Row label="Odd" value={row.odd != null ? Number(row.odd).toFixed(2) : "—"} mono />
                <Row label="Confiança" value={row.confidence != null ? `${row.confidence}%` : "—"} />
                <Row label="Verdict" value={row.verdict} />
                <Row label="Plano" value={row.plan_name || "—"} />
                <Separator className="my-2" />
                <div>
                  <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Tese / Motivo</p>
                  <p className="text-sm whitespace-pre-wrap leading-relaxed bg-muted/40 p-3 rounded-md">
                    {row.thesis || row.reason || "Sem tese registrada."}
                  </p>
                </div>
                {row.settle_reason && (
                  <div>
                    <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1 mt-2">Motivo da liquidação</p>
                    <p className="text-xs font-mono bg-muted/40 p-2 rounded">{row.settle_reason}</p>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Stats snapshot bruto */}
            {row.stats_snapshot && (
              <Card>
                <CardHeader><CardTitle className="text-sm">📊 Stats no momento da aprovação</CardTitle></CardHeader>
                <CardContent>
                  <pre className="text-[11px] bg-muted/40 p-3 rounded overflow-auto max-h-96">
                    {JSON.stringify(row.stats_snapshot, null, 2)}
                  </pre>
                </CardContent>
              </Card>
            )}

            <p className="text-xs text-muted-foreground text-center">
              Criado em {fmtDate(row.created_at)} · ID {row.id}
            </p>
          </>
        )}
      </div>
    </div>
  );
}

function Row({ label, value, mono, highlight }: { label: string; value: string; mono?: boolean; highlight?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-xs text-muted-foreground uppercase tracking-wider">{label}</span>
      <span className={`text-sm ${mono ? "font-mono" : ""} ${highlight ? "text-amber-400 font-semibold" : ""}`}>
        {value}
      </span>
    </div>
  );
}
