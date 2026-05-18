import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Save, RotateCcw, Target } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Checkbox } from '@/components/ui/checkbox';
import { toast } from '@/hooks/use-toast';
import {
  DEFAULT_PLANS,
  loadUserPlans,
  saveUserPlans,
  loadPlanVisibility,
  savePlanVisibility,
  type PlansByMarket,
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
  over_under: [
    { value: 'over', label: 'Over' },
    { value: 'under', label: 'Under' },
  ],
  btts: [
    { value: 'yes', label: 'Sim' },
    { value: 'no', label: 'Não' },
  ],
  corners: [{ value: 'corners_over', label: 'Over Escanteios' }],
};

function NumberField({
  label, value, onChange, step = 1, min, max, suffix,
}: { label: string; value: number | undefined; onChange: (n: number | undefined) => void; step?: number; min?: number; max?: number; suffix?: string }) {
  return (
    <div className="space-y-1">
      <Label className="text-[11px] text-muted-foreground">{label}{suffix ? ` (${suffix})` : ''}</Label>
      <Input
        type="number"
        step={step}
        min={min}
        max={max}
        value={value ?? ''}
        onChange={(e) => {
          const v = e.target.value;
          onChange(v === '' ? undefined : Number(v));
        }}
        className="h-9"
      />
    </div>
  );
}

function PlanEditor({ plan, onChange }: { plan: UserPlan; onChange: (p: UserPlan) => void }) {
  const isWith1x2 = plan.market === '1x2';
  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Switch checked={plan.enabled} onCheckedChange={(v) => onChange({ ...plan, enabled: v })} />
          <span className="text-sm font-medium">Ativar plano para este mercado</span>
        </div>
        <div className="flex items-center gap-2">
          <Label className="text-xs text-muted-foreground">Aposta em:</Label>
          <select
            className="h-9 rounded-md border border-input bg-background px-2 text-sm"
            value={plan.outcome}
            onChange={(e) => onChange({ ...plan, outcome: e.target.value as Outcome })}
          >
            {OUTCOMES[plan.market].map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
          {(plan.market === 'over_under' || plan.market === 'corners') && (
            <Input
              type="number"
              step={0.5}
              value={plan.line ?? ''}
              onChange={(e) => onChange({ ...plan, line: e.target.value === '' ? undefined : Number(e.target.value) })}
              className="h-9 w-20"
              placeholder="Linha"
            />
          )}
        </div>
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
              <NumberField label="Posse mín" suffix="%" value={plan.obrigatorios.posse_min}
                onChange={(v) => onChange({ ...plan, obrigatorios: { ...plan.obrigatorios, posse_min: v } })} />
            </>
          )}
          <NumberField
            label={isWith1x2 ? 'Finalizações no gol mín' : 'Finalizações no gol mín (total)'}
            value={plan.obrigatorios.shots_on_target_min}
            onChange={(v) => onChange({ ...plan, obrigatorios: { ...plan.obrigatorios, shots_on_target_min: v } })} />
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

export default function ArenaTraderSportsMeuPlano() {
  const navigate = useNavigate();
  const [plans, setPlans] = useState<PlansByMarket>(() => loadUserPlans());
  const [tab, setTab] = useState<UserMarket>('1x2');

  useEffect(() => { saveUserPlans(plans); }, [plans]);

  const current = plans[tab] ?? DEFAULT_PLANS[tab]!;

  const setCurrent = (p: UserPlan) => setPlans({ ...plans, [tab]: p });
  const resetMarket = () => setPlans({ ...plans, [tab]: DEFAULT_PLANS[tab]! });

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-40 border-b border-border bg-card/95 backdrop-blur-xl">
        <div className="container mx-auto px-4 py-2.5 flex items-center gap-3">
          <button onClick={() => navigate('/arena-trader-sports')} className="text-muted-foreground hover:text-foreground">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <Target className="w-4 h-4 text-primary" />
          <h1 className="font-mono text-sm font-semibold tracking-tight">MEU PLANO PESSOAL · ARENA TRADER SPORTS</h1>
        </div>
      </header>

      <main className="container mx-auto px-4 py-6 max-w-4xl space-y-4">
        <div className="rounded-lg border border-border bg-card/40 p-4 text-sm space-y-1">
          <p className="font-medium text-foreground">Como funciona</p>
          <p className="text-muted-foreground text-[13px]">
            Estes critérios rodam no seu navegador em cima dos jogos ao vivo. Os sinais que passarem aparecem em
            <span className="text-primary font-medium"> "Meus Sinais" </span>
            dentro da Arena Trader Sports — em paralelo aos sinais do Mycroft global, sem alterar a aprovação dos outros usuários.
          </p>
        </div>

        <Tabs value={tab} onValueChange={(v) => setTab(v as UserMarket)}>
          <TabsList className="grid grid-cols-4 w-full">
            {(Object.keys(MARKET_LABELS) as UserMarket[]).map((m) => (
              <TabsTrigger key={m} value={m} className="text-xs">
                {MARKET_LABELS[m]}
                {plans[m]?.enabled && <span className="ml-1.5 inline-block w-1.5 h-1.5 rounded-full bg-success" />}
              </TabsTrigger>
            ))}
          </TabsList>

          {(Object.keys(MARKET_LABELS) as UserMarket[]).map((m) => (
            <TabsContent key={m} value={m} className="mt-5">
              <PlanEditor plan={plans[m] ?? DEFAULT_PLANS[m]!} onChange={(p) => setPlans({ ...plans, [m]: p })} />
            </TabsContent>
          ))}
        </Tabs>

        <div className="flex items-center justify-between pt-2">
          <Button variant="outline" size="sm" onClick={resetMarket}>
            <RotateCcw className="w-3.5 h-3.5 mr-1.5" /> Resetar este mercado
          </Button>
          <Button size="sm" onClick={() => { saveUserPlans(plans); toast({ title: 'Plano salvo', description: 'Vai filtrar a próxima sincronização.' }); }}>
            <Save className="w-3.5 h-3.5 mr-1.5" /> Salvar
          </Button>
        </div>
      </main>
    </div>
  );
}
