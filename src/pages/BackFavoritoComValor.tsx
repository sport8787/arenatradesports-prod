import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, Crown, Target, ShieldAlert, Zap, AlertTriangle, CheckCircle2, XCircle, Clock } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";

type Plano = {
  codigo: string;
  nome: string;
  emoji: string | null;
  categoria: string;
  mercado: string;
  janela: string;
  risco: string;
  conceito: string;
  execucao: string | null;
  observacao: string | null;
  criterios: any;
  vetos: any;
  ativo: boolean;
  versao: number;
  atualizado_em: string;
};

const PLAN_CODE = "BACKFAVVALOR";

export default function BackFavoritoComValor() {
  const [plano, setPlano] = useState<Plano | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const { data, error } = await supabase
        .from("mycroft_planos" as any)
        .select("*")
        .eq("codigo", PLAN_CODE)
        .maybeSingle();
      if (error) setError(error.message);
      setPlano(data as unknown as Plano);
      setLoading(false);
    })();
  }, []);

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="max-w-4xl mx-auto p-4 md:p-8 space-y-6">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <Link to="/arena-trader-sports">
            <Button variant="ghost" size="sm">
              <ArrowLeft className="w-4 h-4 mr-2" /> Retornar
            </Button>
          </Link>
          {plano && (
            <Badge variant={plano.ativo ? "default" : "outline"}>
              {plano.ativo ? "ATIVO" : "INATIVO"} • v{plano.versao}
            </Badge>
          )}
        </div>

        <header className="space-y-2">
          <div className="flex items-center gap-3">
            <Crown className="w-8 h-8 text-amber-400" />
            <div>
              <h1 className="text-2xl md:text-3xl font-bold">Plano Back Favorito com Valor</h1>
              <p className="text-sm text-muted-foreground">
                Categoria <span className="text-foreground font-medium">TRADER</span> · Risco{" "}
                <span className="text-foreground font-medium">MÉDIO</span> · Janela{" "}
                <span className="text-foreground font-medium">15–55 min</span>
              </p>
            </div>
          </div>
        </header>

        {loading && <p className="text-sm text-muted-foreground">Carregando…</p>}
        {error && (
          <Card className="border-destructive/50">
            <CardContent className="p-4 text-sm text-destructive">Erro: {error}</CardContent>
          </Card>
        )}

        {plano && (
          <>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base flex items-center gap-2">
                  <Target className="w-4 h-4" /> Conceito
                </CardTitle>
              </CardHeader>
              <CardContent className="text-sm text-muted-foreground">
                {plano.conceito}
                <div className="mt-3 grid grid-cols-2 md:grid-cols-3 gap-3 text-xs">
                  <Field label="Mercado" value={plano.mercado} />
                  <Field label="Janela" value={plano.janela} />
                  <Field label="Risco" value={plano.risco} />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400" /> Critérios de entrada
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="space-y-2 text-sm">
                  {(plano.criterios?.regras_texto || []).map((r: string, i: number) => (
                    <li key={i} className="flex gap-2">
                      <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                      <span>{r}</span>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base flex items-center gap-2">
                  <XCircle className="w-4 h-4 text-destructive" /> Vetos
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="space-y-2 text-sm">
                  {(plano.vetos?.vetos_texto || []).map((r: string, i: number) => (
                    <li key={i} className="flex gap-2">
                      <XCircle className="w-4 h-4 text-destructive shrink-0 mt-0.5" />
                      <span>{r}</span>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>

            <Card className="border-destructive/40">
              <CardHeader className="pb-2">
                <CardTitle className="text-base flex items-center gap-2">
                  <Zap className="w-4 h-4 text-destructive" /> Stop imediato
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="space-y-2 text-sm">
                  {(plano.vetos?.stop_imediato || []).map((r: string, i: number) => (
                    <li key={i} className="flex gap-2 text-destructive">
                      <ShieldAlert className="w-4 h-4 shrink-0 mt-0.5" />
                      <span>{r}</span>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>

            <Card className="border-amber-500/40">
              <CardHeader className="pb-2">
                <CardTitle className="text-base flex items-center gap-2">
                  <Clock className="w-4 h-4 text-amber-400" /> Stop preventivo
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="space-y-2 text-sm">
                  {(plano.vetos?.stop_preventivo || []).map((r: string, i: number) => (
                    <li key={i} className="flex gap-2 text-amber-400">
                      <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                      <span>{r}</span>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>

            {plano.execucao && (
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-base">Execução & saídas</CardTitle>
                </CardHeader>
                <CardContent className="text-sm text-muted-foreground whitespace-pre-line">
                  {plano.execucao}
                </CardContent>
              </Card>
            )}

            <p className="text-xs text-muted-foreground text-center">
              Última atualização: {new Date(plano.atualizado_em).toLocaleString("pt-BR")}
            </p>
          </>
        )}
      </div>
    </div>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-border bg-card p-2">
      <div className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className="text-sm font-medium">{value}</div>
    </div>
  );
}
