import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Save, Plus, Target, Pencil, Copy, Trash2, Sparkles, Loader2 } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { toast } from '@/hooks/use-toast';
import {
  loadUserPlans,
  loadUserPlansSync,
  saveUserPlan,
  deleteUserPlan,
  duplicateUserPlan,
  createEmptyPlan,
  createPlanFromTemplate,
  PLAN_TEMPLATES,
  loadPlanVisibility,
  savePlanVisibility,
  type PlanVisibility,
  type UserMarket,
  type UserPlan,
  type Outcome,
} from '@/lib/userTraderPlan';

const MARKET_LABELS: Record<UserMarket, string> = {
  '1x2': '1X2',
  over_under: 'Over/Under',
  btts: 'Ambas Marcam',
  corners: 'Escanteios',
};

const OUTCOMES: Record<UserMarket, { value: Outcome; label: string }[]> = {
  '1x2': [
    { value: 'home', label: 'Casa' },
    { value: 'draw', label: 'Empate' },
    { value: 'away', label: 'Fora' },
  ],
  over_under: [{ value: 'over', label: 'Over' }, { value: 'under', label: 'Under' }],
  btts: [{ value: 'yes', label: 'Sim' }, { value: 'no', label: 'Não' }],
  corners: [{ value: 'corners_over', label: 'Over Escanteios' }],
};

function NumberField({
  label, value, onChange, step = 1, min, max, suffix,
}: { label: string; value: number | undefined; onChange: (n: number | undefined) => void; step?: number; min?: number; max?: number; suffix?: string }) {
  return (
    <div className="space-y-1">
      <Label className="text-[11px] text-muted-foreground">{label}{suffix ? ` (${suffix})` : ''}</Label>
      <Input
        type="number" step={step} min={min} max={max}
        value={value ?? ''}
        onChange={(e) => onChange(e.target.value === '' ? undefined : Number(e.target.value))}
        className="h-9"
      />
    </div>
  );
}

function PlanEditor({ plan, onChange }: { plan: UserPlan; onChange: (p: UserPlan) => void }) {
  const isWith1x2 = plan.market === '1x2';
  return (
    <div className="space-y-5">
      {/* Nome + ativar */}
      <div className="grid grid-cols-1 md:grid-cols-[1fr_auto] gap-3 items-end">
        <div className="space-y-1">
          <Label className="text-[11px] text-muted-foreground uppercase tracking-wider">Nome do plano</Label>
          <Input
            value={plan.name}
            onChange={(e) => onChange({ ...plan, name: e.target.value })}
            placeholder='Ex.: "Back Favorito Casa"'
            className="h-10 text-base font-medium"
          />
        </div>
        <div className="flex items-center gap-2 pb-1">
          <Switch checked={plan.enabled} onCheckedChange={(v) => onChange({ ...plan, enabled: v })} />
          <span className="text-sm font-medium">Ativo</span>
        </div>
      </div>

      {/* Mercado + outcome */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <div className="space-y-1">
          <Label className="text-[11px] text-muted-foreground">Mercado</Label>
          <select
            className="h-9 w-full rounded-md border border-input bg-background px-2 text-sm"
            value={plan.market}
            onChange={(e) => {
              const market = e.target.value as UserMarket;
              const defaults = createEmptyPlan(market);
              onChange({ ...defaults, id: plan.id, name: plan.name, enabled: plan.enabled });
            }}
          >
            {(Object.keys(MARKET_LABELS) as UserMarket[]).map((m) => (
              <option key={m} value={m}>{MARKET_LABELS[m]}</option>
            ))}
          </select>
        </div>
        <div className="space-y-1">
          <Label className="text-[11px] text-muted-foreground">Aposta em</Label>
          <select
            className="h-9 w-full rounded-md border border-input bg-background px-2 text-sm"
            value={plan.outcome}
            onChange={(e) => onChange({ ...plan, outcome: e.target.value as Outcome })}
          >
            {OUTCOMES[plan.market].map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
        </div>
        {(plan.market === 'over_under' || plan.market === 'corners') && (
          <div className="space-y-1">
            <Label className="text-[11px] text-muted-foreground">Linha</Label>
            <Input
              type="number" step={0.5}
              value={plan.line ?? ''}
              onChange={(e) => onChange({ ...plan, line: e.target.value === '' ? undefined : Number(e.target.value) })}
              className="h-9"
            />
          </div>
        )}
      </div>

      <section className="space-y-2">
        <h3 className="text-xs font-mono uppercase text-primary tracking-wider">Critérios Obrigatórios</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <NumberField label="Minuto mín" value={plan.obrigatorios.minuto_min}
            onChange={(v) => onChange({ ...plan, obrigatorios: { ...plan.obrigatorios, minuto_min: v ?? 0 } })} />
          <NumberField label="Minuto máx" value={plan.obrigatorios.minuto_max}
            onChange={(v) => onChange({ ...plan, obrigatorios: { ...plan.obrigatorios, minuto_max: v ?? 90 } })} />
          <NumberField label="Odd mín" step={0.05} value={plan.obrigatorios.odd_min}
            onChange={(v) => onChange({ ...plan, obrigatorios: { ...plan.obrigatorios, odd_min: v ?? 1.3 } })} />
          <NumberField label="Odd máx" step={0.05} value={plan.obrigatorios.odd_max}
            onChange={(v) => onChange({ ...plan, obrigatorios: { ...plan.obrigatorios, odd_max: v ?? 3 } })} />
          {isWith1x2 && (
            <>
              <NumberField label="xG diff mín" step={0.05} value={plan.obrigatorios.xg_diff_min}
                onChange={(v) => onChange({ ...plan, obrigatorios: { ...plan.obrigatorios, xg_diff_min: v } })} />
              <NumberField label="Posse mín (time)" suffix="%" value={plan.obrigatorios.posse_min}
                onChange={(v) => onChange({ ...plan, obrigatorios: { ...plan.obrigatorios, posse_min: v } })} />
            </>
          )}
          <NumberField
            label={isWith1x2 ? 'Finalizações no gol mín (time)' : 'Finalizações no gol mín (total)'}
            value={plan.obrigatorios.shots_on_target_min}
            onChange={(v) => onChange({ ...plan, obrigatorios: { ...plan.obrigatorios, shots_on_target_min: v } })} />
        </div>
      </section>

      <section className="space-y-2">
        <div className="flex items-baseline justify-between gap-2 flex-wrap">
          <h3 className="text-xs font-mono uppercase text-primary tracking-wider">Estatísticas adicionais (opcionais)</h3>
          <p className="text-[10px] text-muted-foreground">
            Se algum dado vier zerado/ausente da Sportmonks/Futodds, o sinal não é vetado — vira <span className="text-warning font-medium">APROVADO · CONF. REDUZIDA</span>.
          </p>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {isWith1x2 && (
            <NumberField label="Δ Posse Casa-Visit. (mín pp)" value={plan.obrigatorios.posse_diff_min}
              onChange={(v) => onChange({ ...plan, obrigatorios: { ...plan.obrigatorios, posse_diff_min: v } })} />
          )}
          <NumberField label="Chutes totais (mín)" value={plan.obrigatorios.shots_total_min}
            onChange={(v) => onChange({ ...plan, obrigatorios: { ...plan.obrigatorios, shots_total_min: v } })} />
          <NumberField label="Chutes no gol total (mín)" value={plan.obrigatorios.shots_on_target_total_min}
            onChange={(v) => onChange({ ...plan, obrigatorios: { ...plan.obrigatorios, shots_on_target_total_min: v } })} />
          <NumberField label="Escanteios total (mín)" value={plan.obrigatorios.corners_total_min}
            onChange={(v) => onChange({ ...plan, obrigatorios: { ...plan.obrigatorios, corners_total_min: v } })} />
          <NumberField
            label={isWith1x2 ? 'Vermelhos no adversário (mín)' : 'Vermelhos na partida (mín)'}
            value={plan.obrigatorios.red_cards_adv_min}
            onChange={(v) => onChange({ ...plan, obrigatorios: { ...plan.obrigatorios, red_cards_adv_min: v } })} />
        </div>
      </section>

      {isWith1x2 && (
        <section className="space-y-2">
          <h3 className="text-xs font-mono uppercase text-warning tracking-wider">Critérios de Reforço</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <NumberField label="Δ Ataques perigosos" value={plan.reforco.ataques_perigosos_diff_min}
              onChange={(v) => onChange({ ...plan, reforco: { ...plan.reforco, ataques_perigosos_diff_min: v } })} />
          </div>
          <div className="space-y-1.5 pt-1">
            <Label className="text-[11px] text-muted-foreground">Placar permitido</Label>
            <div className="flex flex-wrap gap-3">
              {(['drawing', 'losing_by_1', 'winning_by_1', 'winning_2plus'] as const).map((p) => {
                const sel = plan.reforco.placar_permitido?.includes(p) ?? false;
                const label = { drawing: 'Empatando', losing_by_1: 'Perdendo por 1', winning_by_1: 'Vencendo por 1', winning_2plus: 'Vencendo ≥ 2' }[p];
                return (
                  <label key={p} className="flex items-center gap-1.5 text-sm cursor-pointer">
                    <Checkbox checked={sel} onCheckedChange={(c) => {
                      const cur = new Set(plan.reforco.placar_permitido ?? []);
                      if (c) cur.add(p); else cur.delete(p);
                      onChange({ ...plan, reforco: { ...plan.reforco, placar_permitido: Array.from(cur) as any } });
                    }} />
                    {label}
                  </label>
                );
              })}
            </div>
          </div>
        </section>
      )}

      <section className="space-y-2">
        <h3 className="text-xs font-mono uppercase text-destructive tracking-wider">Vetos automáticos</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
          {isWith1x2 && (
            <>
              <label className="flex items-center gap-2 text-sm">
                <Checkbox checked={!!plan.vetos.veto_time_vencendo}
                  onCheckedChange={(c) => onChange({ ...plan, vetos: { ...plan.vetos, veto_time_vencendo: !!c } })} />
                Time apostado já vencendo
              </label>
              <label className="flex items-center gap-2 text-sm">
                <Checkbox checked={!!plan.vetos.veto_diff_2gols}
                  onCheckedChange={(c) => onChange({ ...plan, vetos: { ...plan.vetos, veto_diff_2gols: !!c } })} />
                Diferença ≥ 2 gols
              </label>
              <label className="flex items-center gap-2 text-sm">
                <Checkbox checked={!!plan.vetos.veto_xg_adversario_maior}
                  onCheckedChange={(c) => onChange({ ...plan, vetos: { ...plan.vetos, veto_xg_adversario_maior: !!c } })} />
                xG do adversário maior
              </label>
            </>
          )}
          <NumberField label="Vetar após o minuto" value={plan.vetos.veto_apos_min}
            onChange={(v) => onChange({ ...plan, vetos: { ...plan.vetos, veto_apos_min: v } })} />
          <NumberField label="Vetar antes do minuto" value={plan.vetos.veto_antes_min}
            onChange={(v) => onChange({ ...plan, vetos: { ...plan.vetos, veto_antes_min: v } })} />
        </div>
      </section>
    </div>
  );
}

function summarizeCriteria(p: UserPlan): string[] {
  const out: string[] = [];
  out.push(`Min ${p.obrigatorios.minuto_min}-${p.obrigatorios.minuto_max}'`);
  out.push(`Odd ${p.obrigatorios.odd_min}-${p.obrigatorios.odd_max}`);
  if (p.obrigatorios.xg_diff_min != null) out.push(`xG diff ≥ ${p.obrigatorios.xg_diff_min}`);
  if (p.obrigatorios.posse_min != null) out.push(`Posse ≥ ${p.obrigatorios.posse_min}%`);
  if (p.obrigatorios.shots_on_target_min != null) out.push(`SoT ≥ ${p.obrigatorios.shots_on_target_min}`);
  if (p.vetos.veto_time_vencendo) out.push('veto: vencendo');
  if (p.vetos.veto_diff_2gols) out.push('veto: Δ≥2');
  return out;
}

function outcomeLabel(p: UserPlan): string {
  const map: Record<Outcome, string> = {
    home: 'Casa', away: 'Fora', draw: 'Empate',
    over: `Over ${p.line ?? 2.5}`, under: `Under ${p.line ?? 2.5}`,
    yes: 'Sim', no: 'Não',
    corners_over: `Esc Over ${p.line ?? 8.5}`,
  };
  return map[p.outcome];
}

export default function ArenaTraderSportsMeuPlano() {
  const navigate = useNavigate();
  const [plans, setPlans] = useState<UserPlan[]>(() => loadUserPlansSync());
  const [loading, setLoading] = useState(true);
  const [visibility, setVisibility] = useState<PlanVisibility>(() => loadPlanVisibility());
  const [tab, setTab] = useState<'list' | 'editor' | 'results'>('list');
  const [editing, setEditing] = useState<UserPlan | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const rows = await loadUserPlans();
      setPlans(rows);
      setLoading(false);
    })();
  }, []);

  useEffect(() => { savePlanVisibility(visibility); }, [visibility]);

  const openNew = (templateKey?: keyof typeof PLAN_TEMPLATES) => {
    const p = templateKey ? createPlanFromTemplate(templateKey) : createEmptyPlan('1x2');
    setEditing({ ...p, name: templateKey ? p.name : 'Novo plano' });
    setTab('editor');
  };

  const openEdit = (p: UserPlan) => { setEditing({ ...p }); setTab('editor'); };

  const handleSave = async () => {
    if (!editing) return;
    if (!editing.name.trim()) {
      toast({ title: 'Dê um nome ao plano', description: 'O campo Nome é obrigatório.', variant: 'destructive' });
      return;
    }
    const saved = await saveUserPlan(editing);
    setPlans((prev) => {
      const idx = prev.findIndex((p) => p.id === saved.id);
      if (idx >= 0) { const next = [...prev]; next[idx] = saved; return next; }
      return [...prev, saved];
    });
    toast({ title: 'Plano salvo', description: `"${saved.name}" vai filtrar a próxima sincronização.` });
    setTab('list');
    setEditing(null);
  };

  const handleDelete = async (id: string) => {
    await deleteUserPlan(id);
    setPlans((prev) => prev.filter((p) => p.id !== id));
    setConfirmDelete(null);
    toast({ title: 'Plano excluído' });
  };

  const handleDuplicate = async (id: string) => {
    const copy = await duplicateUserPlan(id);
    if (copy) {
      setPlans((prev) => [...prev, copy]);
      toast({ title: 'Plano duplicado', description: `Criado "${copy.name}"` });
    }
  };

  const handleToggleEnabled = async (p: UserPlan, enabled: boolean) => {
    const updated = { ...p, enabled };
    await saveUserPlan(updated);
    setPlans((prev) => prev.map((x) => (x.id === p.id ? updated : x)));
  };

  const enabledCount = useMemo(() => plans.filter((p) => p.enabled).length, [plans]);

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-40 border-b border-border bg-card/95 backdrop-blur-xl">
        <div className="container mx-auto px-4 py-2.5 flex items-center gap-3">
          <button onClick={() => navigate('/arena-trader-sports')} className="text-muted-foreground hover:text-foreground">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <Target className="w-4 h-4 text-primary" />
          <h1 className="font-mono text-sm font-semibold tracking-tight">MEUS PLANOS · ARENA TRADER SPORTS</h1>
          <Badge variant="outline" className="ml-auto text-[10px] font-mono">
            {plans.length} planos · {enabledCount} ativo{enabledCount === 1 ? '' : 's'}
          </Badge>
        </div>
      </header>

      <main className="container mx-auto px-4 py-6 max-w-5xl space-y-4">
        <div className="rounded-lg border border-border bg-card/40 p-4 text-sm space-y-1">
          <p className="font-medium text-foreground">Como funciona</p>
          <p className="text-muted-foreground text-[13px]">
            Crie quantos planos quiser, cada um com seus próprios critérios. Os planos <span className="text-success font-medium">ativos</span> rodam no seu navegador em cima dos jogos ao vivo e os sinais aparecem em
            <span className="text-primary font-medium"> "Meus Sinais" </span>
            dentro da Arena Trader Sports — em paralelo aos sinais do Mycroft global.
          </p>
        </div>

        <div className="rounded-lg border border-border bg-card/40 p-4 flex items-start justify-between gap-4">
          <div className="space-y-0.5">
            <p className="text-sm font-medium text-foreground">Visibilidade</p>
            <p className="text-[12px] text-muted-foreground">
              {visibility === 'public'
                ? 'Público — seus planos podem aparecer no ranking da Liga Mycroft (em breve).'
                : 'Privado — só você e o admin veem seus planos e ROI.'}
            </p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <span className="text-[11px] uppercase tracking-wider text-muted-foreground">Privado</span>
            <Switch checked={visibility === 'public'} onCheckedChange={(v) => setVisibility(v ? 'public' : 'private')} />
            <span className="text-[11px] uppercase tracking-wider text-muted-foreground">Público</span>
          </div>
        </div>

        <Tabs value={tab} onValueChange={(v) => setTab(v as any)}>
          <TabsList className="grid grid-cols-3 w-full">
            <TabsTrigger value="list">Meus planos ({plans.length})</TabsTrigger>
            <TabsTrigger value="results">Resultados</TabsTrigger>
            <TabsTrigger value="editor" disabled={!editing}>
              {editing ? (editing.name || 'Editor') : 'Editor'}
            </TabsTrigger>
          </TabsList>

          {/* LISTA */}
          <TabsContent value="list" className="mt-5 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex flex-wrap gap-2">
                <Button size="sm" onClick={() => openNew()}>
                  <Plus className="w-3.5 h-3.5 mr-1.5" /> Novo plano
                </Button>
                {Object.entries(PLAN_TEMPLATES).map(([key, t]) => (
                  <Button key={key} size="sm" variant="outline" onClick={() => openNew(key as keyof typeof PLAN_TEMPLATES)}>
                    <Sparkles className="w-3 h-3 mr-1" /> {t.name}
                  </Button>
                ))}
              </div>
            </div>

            {loading ? (
              <div className="flex items-center justify-center py-10 text-muted-foreground">
                <Loader2 className="w-5 h-5 animate-spin mr-2" /> Carregando seus planos…
              </div>
            ) : plans.length === 0 ? (
              <div className="rounded-lg border border-dashed border-border bg-card/30 p-8 text-center space-y-2">
                <Target className="w-8 h-8 mx-auto text-muted-foreground" />
                <p className="text-sm text-foreground font-medium">Você ainda não tem planos salvos.</p>
                <p className="text-[12px] text-muted-foreground">Use um dos templates acima ou clique em "Novo plano" para começar do zero.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {plans.map((p) => (
                  <div key={p.id} className="rounded-lg border border-border bg-card/40 p-4 space-y-3 hover:border-primary/40 transition-colors">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h3 className="font-semibold text-foreground truncate">{p.name}</h3>
                          <Badge variant="outline" className="text-[10px] font-mono">{MARKET_LABELS[p.market]}</Badge>
                          <Badge variant="outline" className="text-[10px] font-mono">{outcomeLabel(p)}</Badge>
                        </div>
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0">
                        <span className={`text-[10px] uppercase font-mono ${p.enabled ? 'text-success' : 'text-muted-foreground'}`}>
                          {p.enabled ? 'ATIVO' : 'OFF'}
                        </span>
                        <Switch checked={p.enabled} onCheckedChange={(v) => handleToggleEnabled(p, v)} />
                      </div>
                    </div>

                    <div className="flex flex-wrap gap-1.5">
                      {summarizeCriteria(p).map((s, i) => (
                        <span key={i} className="text-[10px] font-mono text-muted-foreground bg-muted/40 px-1.5 py-0.5 rounded">
                          {s}
                        </span>
                      ))}
                    </div>

                    <div className="flex items-center gap-1.5 pt-1">
                      <Button size="sm" variant="outline" onClick={() => openEdit(p)}>
                        <Pencil className="w-3 h-3 mr-1" /> Editar
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => handleDuplicate(p.id)}>
                        <Copy className="w-3 h-3 mr-1" /> Duplicar
                      </Button>
                      <Button size="sm" variant="ghost" className="text-destructive hover:text-destructive ml-auto"
                        onClick={() => setConfirmDelete(p.id)}>
                        <Trash2 className="w-3 h-3 mr-1" /> Excluir
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </TabsContent>

          {/* EDITOR */}
          <TabsContent value="editor" className="mt-5">
            {editing ? (
              <div className="space-y-5">
                <PlanEditor plan={editing} onChange={setEditing} />
                <div className="flex items-center justify-between pt-2 border-t border-border">
                  <Button variant="outline" size="sm" onClick={() => { setTab('list'); setEditing(null); }}>
                    Cancelar
                  </Button>
                  <Button size="sm" onClick={handleSave}>
                    <Save className="w-3.5 h-3.5 mr-1.5" /> Salvar plano
                  </Button>
                </div>
              </div>
            ) : (
              <div className="text-center py-10 text-muted-foreground text-sm">
                Selecione um plano para editar ou crie um novo.
              </div>
            )}
          </TabsContent>
        </Tabs>
      </main>

      <AlertDialog open={!!confirmDelete} onOpenChange={(o) => !o && setConfirmDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir este plano?</AlertDialogTitle>
            <AlertDialogDescription>
              Os sinais já gerados ficam no histórico, mas o plano para de filtrar jogos ao vivo. Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={() => confirmDelete && handleDelete(confirmDelete)} className="bg-destructive hover:bg-destructive/90">
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
