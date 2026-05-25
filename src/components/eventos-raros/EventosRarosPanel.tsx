import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Sparkles, Target, Clock, TrendingUp, ChevronDown, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";

interface Candidato {
  id: string;
  match_id: string;
  home_team: string;
  away_team: string;
  league_name: string;
  match_date: string;
  placar_alvo: string;
  placar_alternativo: string | null;
  score_qualidade: number;
  status: string;
}

interface Entrada {
  id: string;
  candidato_id: string;
  placar_alvo: string;
  minuto_entrada: number;
  placar_no_momento: string;
  status: string;
  resultado: string | null;
  modo_betfair: string;
}

const PLACAR_LABEL: Record<string, { label: string; emoji: string; color: string }> = {
  LAY_GOLEADA: { label: "LAY Goleada", emoji: "🎯", color: "bg-purple-500/15 text-purple-400 border-purple-500/30" },
  LAY_2x2:     { label: "LAY 2x2",     emoji: "⚖️", color: "bg-blue-500/15 text-blue-400 border-blue-500/30" },
  LAY_1x3:     { label: "LAY 1x3",     emoji: "📉", color: "bg-orange-500/15 text-orange-400 border-orange-500/30" },
  LAY_3x1:     { label: "LAY 3x1",     emoji: "📈", color: "bg-pink-500/15 text-pink-400 border-pink-500/30" },
  BACK_0x0:    { label: "BACK 0x0",    emoji: "🔒", color: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30" },
};

interface Props {
  arena: "punter" | "trader_sports";
  /** Quando true, colapsa o painel a uma linha quando não há entradas ao vivo */
  compactWhenIdle?: boolean;
}

export default function EventosRarosPanel({ arena, compactWhenIdle = false }: Props) {
  const [candidatos, setCandidatos] = useState<Candidato[]>([]);
  const [entradas, setSinais] = useState<Entrada[]>([]);
  const [loading, setLoading] = useState(true);
  const [enabled, setEnabled] = useState(true);
  const [threshold, setThreshold] = useState(60);
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    const load = async () => {
      // Lê config da arena (e fallback para global)
      const { data: cfgs } = await supabase
        .from("eventos_raros_config")
        .select("arena, enabled, score_threshold")
        .in("arena", [arena, "global"]);
      const cfgArena = cfgs?.find((c: any) => c.arena === arena);
      const cfgGlobal = cfgs?.find((c: any) => c.arena === "global");
      const isEnabled = (cfgArena?.enabled ?? true) && (cfgGlobal?.enabled ?? true);
      const scoreMin = cfgArena?.score_threshold ?? 60;
      setEnabled(isEnabled);
      setThreshold(scoreMin);

      if (!isEnabled) {
        setCandidatos([]);
        setSinais([]);
        setLoading(false);
        return;
      }

      const desde = new Date(Date.now() - 6 * 3600_000).toISOString();
      const ateAmanha = new Date(Date.now() + 36 * 3600_000).toISOString();
      const [{ data: cands }, { data: sins }] = await Promise.all([
        supabase
          .from("eventos_raros_candidatos")
          .select("*")
          .eq("status", "APROVADO")
          .gte("score_qualidade", scoreMin)
          .contains("arenas", [arena])
          .gte("match_date", desde)
          .lte("match_date", ateAmanha)
          .order("match_date", { ascending: true }),
        supabase
          .from("eventos_raros_sinais")
          .select("*")
          .in("status", ["ATIVO", "SAIDA_NORMAL"])
          .order("created_at", { ascending: false })
          .limit(20),
      ]);
      setCandidatos((cands ?? []) as any);
      setSinais((sins ?? []) as any);
      setLoading(false);
    };
    load();

    const ch = supabase
      .channel("eventos-raros-" + arena)
      .on("postgres_changes", { event: "*", schema: "public", table: "eventos_raros_candidatos" }, load)
      .on("postgres_changes", { event: "*", schema: "public", table: "eventos_raros_sinais" }, load)
      .on("postgres_changes", { event: "*", schema: "public", table: "eventos_raros_config" }, load)
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [arena]);

  if (!enabled) return null;

  const sinaisAtivos = entradas.filter((s) => s.status === "ATIVO");
  const preLiveCount = candidatos.length;
  const ativosCount = sinaisAtivos.length;

  // Modo compacto: quando 0 ativos, vira uma linha colapsável
  if (compactWhenIdle && !loading && ativosCount === 0) {
    return (
      <Collapsible open={expanded} onOpenChange={setExpanded}>
        <Card className="border-purple-500/30 bg-purple-500/5">
          <CollapsibleTrigger asChild>
            <button
              type="button"
              className="w-full flex items-center gap-2 px-4 py-2.5 text-left hover:bg-purple-500/10 transition-colors rounded-lg"
            >
              <Sparkles className="h-4 w-4 text-purple-400 shrink-0" />
              <span className="text-sm font-medium text-foreground">Eventos Raros</span>
              <Badge variant="outline" className="text-[10px]">
                0 ao vivo · {preLiveCount} pré-live
              </Badge>
              <span className="ml-auto flex items-center gap-1 text-xs text-muted-foreground">
                {preLiveCount > 0 ? "ver candidatos" : "sem candidatos"}
                {expanded ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
              </span>
            </button>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <CardContent className="space-y-3 pt-0">
              <p className="text-xs text-muted-foreground">
                Placares incomuns identificados pelo motor estatístico (LAY na Betfair Exchange).
                Modo atual: <strong>simulado</strong> — execute manualmente quando o entrada disparar.
              </p>
              {preLiveCount === 0 ? (
                <p className="text-xs text-muted-foreground italic">
                  Nenhum candidato aprovado para hoje. O motor roda 2x ao dia (09:00 e 15:00 BRT).
                </p>
              ) : (
                <div className="space-y-2">
                  <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                    <Target className="h-3 w-3 inline mr-1" /> Pré-live · aguardando início
                  </h4>
                  {candidatos.slice(0, 8).map((c) => {
                    const meta = PLACAR_LABEL[c.placar_alvo] ?? { label: c.placar_alvo, emoji: "🎯", color: "" };
                    const data = new Date(c.match_date);
                    return (
                      <div key={c.id} className="rounded-md border border-border/50 bg-card/50 p-2 text-xs">
                        <div className="flex justify-between items-center">
                          <span className="font-medium truncate">{c.home_team} vs {c.away_team}</span>
                          <Badge variant="outline" className={cn("text-[10px] ml-2", meta.color)}>
                            {meta.emoji} {meta.label}
                          </Badge>
                        </div>
                        <div className="flex justify-between items-center mt-1 text-muted-foreground">
                          <span className="truncate">{c.league_name}</span>
                          <span className="flex items-center gap-2">
                            <TrendingUp className="h-3 w-3" /> Score {Math.round(c.score_qualidade)}/100
                            <span className="opacity-60">
                              · {data.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
                            </span>
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </CollapsibleContent>
        </Card>
      </Collapsible>
    );
  }

  return (
    <Card className="border-purple-500/30 bg-purple-500/5">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <Sparkles className="h-4 w-4 text-purple-400" />
          Eventos Raros
          <Badge variant="outline" className="ml-auto text-[10px]">
            {ativosCount} ao vivo · {preLiveCount} pré-live
          </Badge>
        </CardTitle>
        <p className="text-xs text-muted-foreground">
          Placares incomuns identificados pelo motor estatístico (LAY na Betfair Exchange).
          Modo atual: <strong>simulado</strong> — execute manualmente quando o entrada disparar.
        </p>
      </CardHeader>
      <CardContent className="space-y-3">
        {loading && <p className="text-xs text-muted-foreground">Carregando...</p>}

        {!loading && sinaisAtivos.length > 0 && (
          <div className="space-y-2">
            <h4 className="text-xs font-semibold text-purple-400 uppercase tracking-wider">
              🔴 Entradas ao vivo
            </h4>
            {sinaisAtivos.map((s) => {
              const c = candidatos.find((x) => x.id === s.candidato_id);
              const meta = PLACAR_LABEL[s.placar_alvo] ?? { label: s.placar_alvo, emoji: "🎯", color: "" };
              return (
                <div key={s.id} className={cn("rounded-md border p-2 text-xs", meta.color)}>
                  <div className="flex justify-between items-center">
                    <span className="font-semibold">
                      {meta.emoji} {meta.label}
                    </span>
                    <span className="opacity-70 flex items-center gap-1">
                      <Clock className="h-3 w-3" /> {s.minuto_entrada}' · {s.placar_no_momento}
                    </span>
                  </div>
                  {c && <div className="opacity-80 mt-1">{c.home_team} vs {c.away_team}</div>}
                </div>
              );
            })}
          </div>
        )}

        {!loading && candidatos.length === 0 && sinaisAtivos.length === 0 && (
          <p className="text-xs text-muted-foreground italic">
            Nenhum candidato aprovado para hoje. O motor roda 2x ao dia (09:00 e 15:00 BRT).
          </p>
        )}

        {!loading && candidatos.length > 0 && (
          <div className="space-y-2">
            <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              <Target className="h-3 w-3 inline mr-1" /> Pré-live · aguardando início
            </h4>
            {candidatos.slice(0, 8).map((c) => {
              const meta = PLACAR_LABEL[c.placar_alvo] ?? { label: c.placar_alvo, emoji: "🎯", color: "" };
              const data = new Date(c.match_date);
              return (
                <div key={c.id} className="rounded-md border border-border/50 bg-card/50 p-2 text-xs">
                  <div className="flex justify-between items-center">
                    <span className="font-medium truncate">{c.home_team} vs {c.away_team}</span>
                    <Badge variant="outline" className={cn("text-[10px] ml-2", meta.color)}>
                      {meta.emoji} {meta.label}
                    </Badge>
                  </div>
                  <div className="flex justify-between items-center mt-1 text-muted-foreground">
                    <span className="truncate">{c.league_name}</span>
                    <span className="flex items-center gap-2">
                      <TrendingUp className="h-3 w-3" /> Score {Math.round(c.score_qualidade)}/100
                      <span className="opacity-60">
                        · {data.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
                      </span>
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
