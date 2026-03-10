import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Trash2, Brain, ArrowLeft, Edit2, Check, X } from "lucide-react";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";
import { Textarea } from "@/components/ui/textarea";

interface MemoryRule {
  id: string;
  rule_text: string;
  category: string;
  priority: number;
  context: string[];
  mycroft_type: string;
  created_at: string;
  is_active: boolean;
}

const categoryLabels: Record<string, string> = {
  risk_management: "Gestão de Risco",
  market_preference: "Preferência de Mercado",
  indicator_preference: "Preferência de Indicador",
  analysis_rule: "Regra de Análise",
  style: "Estilo",
  anti_conflict: "Anti-Conflito",
  rule: "Regra Geral",
};

const priorityLabels = ["Normal", "Importante", "Crítica"];
const priorityColors = ["bg-muted text-muted-foreground", "bg-warning/20 text-warning", "bg-destructive/20 text-destructive"];

export default function MycroftMemoryManager() {
  const { profile } = useAuth();
  const navigate = useNavigate();
  const [rules, setRules] = useState<MemoryRule[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editText, setEditText] = useState("");
  const [filter, setFilter] = useState<"all" | "sports" | "analyst">("all");

  useEffect(() => {
    if (profile?.user_id) loadRules();
  }, [profile?.user_id]);

  const loadRules = async () => {
    if (!profile?.user_id) return;
    setLoading(true);
    const { data, error } = await supabase
      .from("mycroft_memory")
      .select("*")
      .eq("user_id", profile.user_id)
      .eq("is_active", true)
      .order("priority", { ascending: false })
      .order("created_at", { ascending: false });
    if (error) {
      toast.error("Erro ao carregar regras");
      console.error(error);
    } else {
      setRules((data as unknown as MemoryRule[]) || []);
    }
    setLoading(false);
  };

  const deleteRule = async (id: string) => {
    const { error } = await supabase
      .from("mycroft_memory")
      .update({ is_active: false })
      .eq("id", id);
    if (error) {
      toast.error("Erro ao remover regra");
    } else {
      toast.success("Regra removida");
      setRules((prev) => prev.filter((r) => r.id !== id));
    }
  };

  const saveEdit = async (id: string) => {
    const { error } = await supabase
      .from("mycroft_memory")
      .update({ rule_text: editText })
      .eq("id", id);
    if (error) {
      toast.error("Erro ao editar regra");
    } else {
      toast.success("Regra atualizada");
      setRules((prev) => prev.map((r) => (r.id === id ? { ...r, rule_text: editText } : r)));
      setEditingId(null);
    }
  };

  const filtered = filter === "all" ? rules : rules.filter((r) => r.context?.includes(filter) || r.mycroft_type === filter);

  return (
    <div className="min-h-screen bg-background text-foreground p-4 md:p-8">
      <div className="max-w-3xl mx-auto">
        <div className="flex items-center gap-3 mb-6">
          <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <Brain className="w-6 h-6 text-primary" />
          <h1 className="text-xl font-bold font-['Rajdhani']">Memória do Mycroft</h1>
          <Badge variant="secondary" className="ml-auto">{rules.length} regras</Badge>
        </div>

        <div className="flex gap-2 mb-4">
          {(["all", "sports", "analyst"] as const).map((f) => (
            <Button
              key={f}
              variant={filter === f ? "default" : "outline"}
              size="sm"
              onClick={() => setFilter(f)}
            >
              {f === "all" ? "Todas" : f === "sports" ? "Sports" : "Analyst"}
            </Button>
          ))}
        </div>

        {loading ? (
          <p className="text-muted-foreground text-center py-12">Carregando...</p>
        ) : filtered.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">
            <Brain className="w-12 h-12 mx-auto mb-3 opacity-30" />
            <p>Nenhuma regra memorizada.</p>
            <p className="text-sm mt-1">Diga ao Mycroft algo como "nunca recomende odds abaixo de 1.50" para criar uma regra.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {filtered.map((rule) => (
              <div key={rule.id} className="border border-border rounded-lg p-4 bg-card">
                <div className="flex items-start gap-3">
                  <div className="flex-1">
                    <div className="flex flex-wrap gap-1.5 mb-2">
                      <Badge variant="outline" className="text-xs">
                        {categoryLabels[rule.category] || rule.category}
                      </Badge>
                      <Badge className={`text-xs ${priorityColors[rule.priority] || priorityColors[0]}`}>
                        {priorityLabels[rule.priority] || "Normal"}
                      </Badge>
                      {rule.context?.map((c) => (
                        <Badge key={c} variant="secondary" className="text-xs">{c}</Badge>
                      ))}
                    </div>

                    {editingId === rule.id ? (
                      <div className="space-y-2">
                        <Textarea
                          value={editText}
                          onChange={(e) => setEditText(e.target.value)}
                          className="min-h-[60px] text-sm"
                        />
                        <div className="flex gap-2">
                          <Button size="sm" onClick={() => saveEdit(rule.id)}>
                            <Check className="w-3 h-3 mr-1" /> Salvar
                          </Button>
                          <Button size="sm" variant="ghost" onClick={() => setEditingId(null)}>
                            <X className="w-3 h-3 mr-1" /> Cancelar
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <p className="text-sm">{rule.rule_text}</p>
                    )}

                    <p className="text-xs text-muted-foreground mt-2">
                      {new Date(rule.created_at).toLocaleDateString("pt-BR")}
                    </p>
                  </div>

                  {editingId !== rule.id && (
                    <div className="flex gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => { setEditingId(rule.id); setEditText(rule.rule_text); }}
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-destructive hover:text-destructive"
                        onClick={() => deleteRule(rule.id)}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
