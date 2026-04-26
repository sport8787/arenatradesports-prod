import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Sparkles, Save, Loader2 } from "lucide-react";
import { toast } from "sonner";

type Arena = "global" | "punter" | "trader_sports";

interface ConfigRow {
  id: string;
  arena: Arena;
  enabled: boolean;
  score_threshold: number;
  betfair_mode: "simulado" | "live";
  notify_telegram: boolean;
  updated_at: string;
}

const ARENA_LABEL: Record<Arena, string> = {
  global: "Global (motor pré-live)",
  punter: "Arena Punter",
  trader_sports: "Arena Trader Sports",
};

export default function EventosRarosConfig() {
  const [configs, setConfigs] = useState<ConfigRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    const load = async () => {
      const { data: userData } = await supabase.auth.getUser();
      if (userData.user) {
        const { data: roles } = await supabase
          .from("user_roles")
          .select("role")
          .eq("user_id", userData.user.id);
        setIsAdmin(roles?.some((r: any) => r.role === "admin") ?? false);
      }
      const { data, error } = await supabase
        .from("eventos_raros_config")
        .select("*")
        .order("arena", { ascending: true });
      if (error) toast.error("Erro ao carregar configurações");
      setConfigs((data ?? []) as ConfigRow[]);
      setLoading(false);
    };
    load();
  }, []);

  const updateLocal = (arena: Arena, patch: Partial<ConfigRow>) => {
    setConfigs((prev) =>
      prev.map((c) => (c.arena === arena ? { ...c, ...patch } : c))
    );
  };

  const save = async (cfg: ConfigRow) => {
    setSaving(cfg.arena);
    const { error } = await supabase
      .from("eventos_raros_config")
      .update({
        enabled: cfg.enabled,
        score_threshold: cfg.score_threshold,
        betfair_mode: cfg.betfair_mode,
        notify_telegram: cfg.notify_telegram,
      })
      .eq("id", cfg.id);
    setSaving(null);
    if (error) {
      toast.error(`Falha ao salvar (${cfg.arena}): ${error.message}`);
    } else {
      toast.success(`Configuração de ${ARENA_LABEL[cfg.arena]} salva.`);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {!isAdmin && (
        <p className="text-xs text-muted-foreground italic px-1">
          Visualização apenas. Apenas administradores podem alterar.
        </p>
      )}
      {configs.map((cfg) => (
        <Card key={cfg.id} className="border-purple-500/30 bg-purple-500/5">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-sm">
              <Sparkles className="h-4 w-4 text-purple-400" />
              {ARENA_LABEL[cfg.arena]}
              <Badge
                variant="outline"
                className={`ml-auto text-[10px] ${
                  cfg.enabled
                    ? "bg-green-500/15 text-green-400 border-green-500/30"
                    : "bg-muted text-muted-foreground"
                }`}
              >
                {cfg.enabled ? "ATIVO" : "DESATIVADO"}
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <Label htmlFor={`enabled-${cfg.arena}`} className="text-xs">
                Ativar Eventos Raros nesta arena
              </Label>
              <Switch
                id={`enabled-${cfg.arena}`}
                checked={cfg.enabled}
                disabled={!isAdmin}
                onCheckedChange={(v) => updateLocal(cfg.arena, { enabled: v })}
              />
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label className="text-xs">Limiar de aprovação (score mínimo)</Label>
                <Badge variant="outline" className="text-[10px] font-mono">
                  ≥ {cfg.score_threshold}/100
                </Badge>
              </div>
              <Slider
                min={30}
                max={95}
                step={5}
                value={[cfg.score_threshold]}
                disabled={!isAdmin}
                onValueChange={([v]) => updateLocal(cfg.arena, { score_threshold: v })}
              />
              <p className="text-[10px] text-muted-foreground">
                Padrão recomendado: 60. Maior = menos candidatos, mais qualidade.
              </p>
            </div>

            {cfg.arena === "global" && (
              <>
                <div className="flex items-center justify-between">
                  <Label htmlFor={`betfair-${cfg.arena}`} className="text-xs">
                    Modo Betfair Live
                  </Label>
                  <Switch
                    id={`betfair-${cfg.arena}`}
                    checked={cfg.betfair_mode === "live"}
                    disabled={!isAdmin}
                    onCheckedChange={(v) =>
                      updateLocal(cfg.arena, { betfair_mode: v ? "live" : "simulado" })
                    }
                  />
                </div>
                <div className="flex items-center justify-between">
                  <Label htmlFor={`tg-${cfg.arena}`} className="text-xs">
                    Notificar Telegram
                  </Label>
                  <Switch
                    id={`tg-${cfg.arena}`}
                    checked={cfg.notify_telegram}
                    disabled={!isAdmin}
                    onCheckedChange={(v) => updateLocal(cfg.arena, { notify_telegram: v })}
                  />
                </div>
              </>
            )}

            {isAdmin && (
              <Button
                size="sm"
                className="w-full"
                onClick={() => save(cfg)}
                disabled={saving === cfg.arena}
              >
                {saving === cfg.arena ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin mr-1.5" />
                ) : (
                  <Save className="w-3.5 h-3.5 mr-1.5" />
                )}
                Salvar
              </Button>
            )}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
