import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { ArrowLeft, Search } from "lucide-react";
import { Link } from "react-router-dom";
import { useAdmin } from "@/hooks/useAdmin";

interface League {
  league_id: number;
  name: string;
  country: string | null;
  region: string;
  tier: "A" | "B" | "C";
  enabled: boolean;
  odds_sport_key: string | null;
}

const REGIONS = ["BRASIL", "EUROPA", "SUL_AMERICA", "ASIA", "NORTE_AMERICA", "AFRICA", "OCEANIA", "MUNDO", "OUTROS"];

export default function AdminTraderLeagues() {
  const { isAdmin, loading: adminLoading } = useAdmin();
  const [leagues, setLeagues] = useState<League[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filterTier, setFilterTier] = useState<string>("all");
  const [filterRegion, setFilterRegion] = useState<string>("all");

  useEffect(() => {
    if (adminLoading) return;
    if (!isAdmin) return;
    void load();
  }, [adminLoading, isAdmin]);

  async function load() {
    setLoading(true);
    const { data, error } = await supabase
      .from("trader_leagues")
      .select("*")
      .order("tier")
      .order("name");
    if (error) toast.error("Erro ao carregar ligas: " + error.message);
    else setLeagues((data as League[]) || []);
    setLoading(false);
  }

  async function updateLeague(league_id: number, patch: Partial<League>) {
    const { error } = await supabase.from("trader_leagues").update(patch).eq("league_id", league_id);
    if (error) {
      toast.error("Falha ao salvar: " + error.message);
      return;
    }
    setLeagues((prev) => prev.map((l) => (l.league_id === league_id ? { ...l, ...patch } : l)));
  }

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim();
    return leagues.filter((l) => {
      if (filterTier !== "all" && l.tier !== filterTier) return false;
      if (filterRegion !== "all" && l.region !== filterRegion) return false;
      if (!q) return true;
      return (
        l.name.toLowerCase().includes(q) ||
        (l.country || "").toLowerCase().includes(q) ||
        String(l.league_id).includes(q)
      );
    });
  }, [leagues, search, filterTier, filterRegion]);

  const counts = useMemo(() => {
    const total = leagues.length;
    const a = leagues.filter((l) => l.tier === "A").length;
    const b = leagues.filter((l) => l.tier === "B").length;
    const c = leagues.filter((l) => l.tier === "C").length;
    const enabled = leagues.filter((l) => l.enabled).length;
    return { total, a, b, c, enabled };
  }, [leagues]);

  if (adminLoading) return <div className="p-8 text-muted-foreground">Verificando acesso…</div>;
  if (!isAdmin) return <div className="p-8 text-destructive">Acesso restrito a admins.</div>;

  return (
    <div className="container max-w-7xl py-6 space-y-4">
      <div className="flex items-center justify-between gap-4">
        <div>
          <Link to="/admin" className="text-sm text-muted-foreground hover:text-primary inline-flex items-center gap-1">
            <ArrowLeft className="w-4 h-4" /> Admin Hub
          </Link>
          <h1 className="text-2xl font-orbitron font-bold mt-1">Trader Sports — Gestão de Ligas</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Tier A: análise IA completa · Tier B: IA enxuta (flash-lite) · Tier C: só estatística (sem IA)
          </p>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <Card className="p-3"><div className="text-xs text-muted-foreground">Total</div><div className="text-2xl font-bold">{counts.total}</div></Card>
        <Card className="p-3"><div className="text-xs text-muted-foreground">Habilitadas</div><div className="text-2xl font-bold text-green-500">{counts.enabled}</div></Card>
        <Card className="p-3"><div className="text-xs text-muted-foreground">Tier A</div><div className="text-2xl font-bold">{counts.a}</div></Card>
        <Card className="p-3"><div className="text-xs text-muted-foreground">Tier B</div><div className="text-2xl font-bold">{counts.b}</div></Card>
        <Card className="p-3"><div className="text-xs text-muted-foreground">Tier C</div><div className="text-2xl font-bold">{counts.c}</div></Card>
      </div>

      <Card className="p-3 flex flex-wrap gap-3 items-center">
        <div className="relative flex-1 min-w-[220px]">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar (nome, país, id)…" className="pl-9" />
        </div>
        <Select value={filterTier} onValueChange={setFilterTier}>
          <SelectTrigger className="w-[140px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os tiers</SelectItem>
            <SelectItem value="A">Tier A</SelectItem>
            <SelectItem value="B">Tier B</SelectItem>
            <SelectItem value="C">Tier C</SelectItem>
          </SelectContent>
        </Select>
        <Select value={filterRegion} onValueChange={setFilterRegion}>
          <SelectTrigger className="w-[180px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas as regiões</SelectItem>
            {REGIONS.map((r) => <SelectItem key={r} value={r}>{r}</SelectItem>)}
          </SelectContent>
        </Select>
        <Button variant="outline" onClick={load} disabled={loading}>{loading ? "..." : "Recarregar"}</Button>
      </Card>

      <Card className="p-0 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/50">
              <tr>
                <th className="text-left p-3 font-orbitron text-xs">ID</th>
                <th className="text-left p-3 font-orbitron text-xs">Liga</th>
                <th className="text-left p-3 font-orbitron text-xs">País</th>
                <th className="text-left p-3 font-orbitron text-xs">Região</th>
                <th className="text-left p-3 font-orbitron text-xs">Tier</th>
                <th className="text-left p-3 font-orbitron text-xs">Odds Key</th>
                <th className="text-left p-3 font-orbitron text-xs">Habilitada</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((l) => (
                <tr key={l.league_id} className="border-t border-border hover:bg-muted/30">
                  <td className="p-3 font-mono text-xs text-muted-foreground">{l.league_id}</td>
                  <td className="p-3 font-medium">{l.name}</td>
                  <td className="p-3 text-muted-foreground">{l.country || "—"}</td>
                  <td className="p-3">
                    <Select value={l.region} onValueChange={(v) => updateLeague(l.league_id, { region: v })}>
                      <SelectTrigger className="h-8 w-[140px] text-xs"><SelectValue /></SelectTrigger>
                      <SelectContent>{REGIONS.map((r) => <SelectItem key={r} value={r}>{r}</SelectItem>)}</SelectContent>
                    </Select>
                  </td>
                  <td className="p-3">
                    <Select value={l.tier} onValueChange={(v) => updateLeague(l.league_id, { tier: v as League["tier"] })}>
                      <SelectTrigger className="h-8 w-[80px] text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="A">A</SelectItem>
                        <SelectItem value="B">B</SelectItem>
                        <SelectItem value="C">C</SelectItem>
                      </SelectContent>
                    </Select>
                  </td>
                  <td className="p-3">
                    {l.odds_sport_key ? (
                      <Badge variant="secondary" className="font-mono text-[10px]">{l.odds_sport_key}</Badge>
                    ) : (
                      <span className="text-muted-foreground text-xs">—</span>
                    )}
                  </td>
                  <td className="p-3">
                    <Switch checked={l.enabled} onCheckedChange={(v) => updateLeague(l.league_id, { enabled: v })} />
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr><td colSpan={7} className="p-8 text-center text-muted-foreground">Nenhuma liga encontrada.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
