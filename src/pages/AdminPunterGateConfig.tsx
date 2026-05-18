import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, Save, RotateCcw, Loader2, AlertTriangle } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAdmin } from '@/hooks/useAdmin';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';
import { z } from 'zod';

// ─── Schema de validação ───────────────────────────────────────
const pct = (min: number, max: number, label: string) =>
  z.number({ invalid_type_error: `${label} deve ser número` })
    .min(min, `${label} deve ser >= ${min}`)
    .max(max, `${label} deve ser <= ${max}`);
const odd = (label: string) =>
  z.number({ invalid_type_error: `${label} deve ser número` })
    .min(1.01, `${label} deve ser >= 1.01`)
    .max(20, `${label} deve ser <= 20`);

const blockSchema = (prefix: 'A' | 'B' | 'C') => z.object({
  [`${prefix.toLowerCase()}_prob_min`]: pct(0, 100, `Bloco ${prefix} prob mín`),
  [`${prefix.toLowerCase()}_edge_min`]: pct(0, 50, `Bloco ${prefix} edge mín`),
  [`${prefix.toLowerCase()}_conf_min`]: pct(0, 100, `Bloco ${prefix} conf mín`),
  [`${prefix.toLowerCase()}_odd_min`]: odd(`Bloco ${prefix} odd mín`),
  [`${prefix.toLowerCase()}_odd_max`]: odd(`Bloco ${prefix} odd máx`),
  [`${prefix.toLowerCase()}_stake_pct`]: pct(0.1, 20, `Bloco ${prefix} stake`),
}).passthrough();

const gateSchema = z.object({
  prob_min_global: pct(0, 100, 'Prob mínima global'),
  odd_min_global: odd('Odd mínima global'),
  odd_max_global: odd('Odd máxima global'),
  favorite_odd_threshold: odd('Veto favorito (odd)'),
  favorite_requires_data_strength: z.string().trim().min(1, 'Defina data_strength (ex: ALTA)').max(20),
  odd_drop_pct_threshold: pct(0, 100, 'Trap line queda'),
  weak_league_odd_threshold: odd('Liga fraca odd'),
  strong_league_regex: z.string().trim().min(3, 'Regex muito curto').refine((s) => {
    try { new RegExp(s, 'i'); return true; } catch { return false; }
  }, 'Regex inválido'),
  conf_inflation_threshold: pct(0, 100, 'Conf inflada'),
  edge_inflation_threshold: pct(0, 50, 'Edge inflado'),
}).passthrough()
  .superRefine((data: any, ctx) => {
    if (data.odd_min_global >= data.odd_max_global) {
      ctx.addIssue({ code: 'custom', path: ['odd_max_global'], message: 'Odd máx global deve ser > odd mín global' });
    }
    (['a', 'b', 'c'] as const).forEach((b) => {
      if (data[`${b}_odd_min`] >= data[`${b}_odd_max`]) {
        ctx.addIssue({ code: 'custom', path: [`${b}_odd_max`], message: `Bloco ${b.toUpperCase()}: odd máx deve ser > odd mín` });
      }
      if (data[`${b}_odd_min`] < data.odd_min_global || data[`${b}_odd_max`] > data.odd_max_global) {
        ctx.addIssue({ code: 'custom', path: [`${b}_odd_min`], message: `Bloco ${b.toUpperCase()}: faixa de odd fora dos limites globais (${data.odd_min_global}-${data.odd_max_global})` });
      }
      if (data[`${b}_prob_min`] < data.prob_min_global) {
        ctx.addIssue({ code: 'custom', path: [`${b}_prob_min`], message: `Bloco ${b.toUpperCase()}: prob mín deve ser >= prob mín global (${data.prob_min_global}%)` });
      }
    });
  });

type GateConfig = {
  id: string;
  enabled: boolean;
  prob_min_global: number;
  odd_min_global: number;
  odd_max_global: number;
  favorite_odd_threshold: number;
  favorite_requires_data_strength: string;
  odd_drop_pct_threshold: number;
  weak_league_odd_threshold: number;
  strong_league_regex: string;
  conf_inflation_threshold: number;
  edge_inflation_threshold: number;
  a_prob_min: number; a_edge_min: number; a_conf_min: number;
  a_odd_min: number; a_odd_max: number; a_stake_pct: number;
  b_prob_min: number; b_edge_min: number; b_conf_min: number;
  b_odd_min: number; b_odd_max: number; b_stake_pct: number;
  c_prob_min: number; c_edge_min: number; c_conf_min: number;
  c_odd_min: number; c_odd_max: number; c_stake_pct: number;
  c_requires_pinnacle: boolean;
  notes: string | null;
  updated_at?: string;
};

const DEFAULTS: Partial<GateConfig> = {
  enabled: true,
  prob_min_global: 45, odd_min_global: 1.30, odd_max_global: 4.50,
  favorite_odd_threshold: 1.50, favorite_requires_data_strength: 'ALTA',
  odd_drop_pct_threshold: 8, weak_league_odd_threshold: 1.60,
  strong_league_regex: '(premier league|la liga|primera divis|serie a|bundesliga|ligue 1|champions|europa|conference|libertadores|sudamericana|brasileir|copa do brasil|eredivisie|primeira liga|jupiler|championship|copa america|world cup|euro)',
  conf_inflation_threshold: 85, edge_inflation_threshold: 5,
  a_prob_min: 58, a_edge_min: 3, a_conf_min: 72, a_odd_min: 1.30, a_odd_max: 1.85, a_stake_pct: 2,
  b_prob_min: 45, b_edge_min: 5, b_conf_min: 70, b_odd_min: 1.85, b_odd_max: 3.20, b_stake_pct: 3,
  c_prob_min: 55, c_edge_min: 7, c_conf_min: 80, c_odd_min: 1.50, c_odd_max: 4.50, c_stake_pct: 4,
  c_requires_pinnacle: true,
};

export default function AdminPunterGateConfig() {
  const { isAdmin, loading: adminLoading } = useAdmin();
  const [cfg, setCfg] = useState<GateConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const load = async () => {
    setLoading(true);
    const { data, error } = await (supabase as any)
      .from('punter_gate_config')
      .select('*')
      .eq('id', 'global')
      .maybeSingle();
    if (error) toast.error('Erro ao carregar: ' + error.message);
    setCfg((data as GateConfig) || ({ id: 'global', notes: '', ...DEFAULTS } as GateConfig));
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const set = <K extends keyof GateConfig>(k: K, v: GateConfig[K]) =>
    setCfg(prev => prev ? { ...prev, [k]: v } : prev);

  const errors = useMemo<Record<string, string>>(() => {
    if (!cfg) return {};
    const r = gateSchema.safeParse(cfg);
    if (r.success) return {};
    const map: Record<string, string> = {};
    for (const issue of r.error.issues) {
      const key = String(issue.path[0] ?? '_');
      if (!map[key]) map[key] = issue.message;
    }
    return map;
  }, [cfg]);

  const errorList = Object.entries(errors);
  const hasErrors = errorList.length > 0;

  const handleSave = async () => {
    if (!cfg) return;
    if (hasErrors) {
      toast.error(`Corrija ${errorList.length} erro(s) antes de salvar`);
      return;
    }
    setSaving(true);
    const { error } = await (supabase as any)
      .from('punter_gate_config')
      .upsert({ ...cfg, id: 'global' }, { onConflict: 'id' });
    setSaving(false);
    if (error) toast.error('Falha ao salvar: ' + error.message);
    else { toast.success('Configuração salva (aplica em até 60s nas edges)'); load(); }
  };

  const handleReset = () => {
    if (!cfg) return;
    setCfg({ ...cfg, ...(DEFAULTS as any) });
    toast.info('Restaurado para os defaults — clique em Salvar para aplicar');
  };

  if (adminLoading || loading) {
    return <div className="min-h-screen flex items-center justify-center text-muted-foreground">
      <Loader2 className="w-5 h-5 animate-spin mr-2" /> Carregando…
    </div>;
  }
  if (!isAdmin) {
    return <div className="min-h-screen flex flex-col items-center justify-center gap-3 text-muted-foreground">
      <AlertTriangle className="w-8 h-8 text-warning" />
      <p>Acesso restrito a administradores.</p>
      <Link to="/punter" className="text-primary underline">Voltar</Link>
    </div>;
  }
  if (!cfg) return null;

  const NumField = ({ k, label, step = 0.01 }: { k: keyof GateConfig; label: string; step?: number }) => {
    const err = errors[k as string];
    return (
      <div className="space-y-1">
        <Label className="text-xs font-mono text-muted-foreground">{label}</Label>
        <Input
          type="number" step={step}
          value={Number(cfg[k] as any) || 0}
          onChange={(e) => set(k, Number(e.target.value) as any)}
          className={`h-8 font-mono text-xs ${err ? 'border-destructive focus-visible:ring-destructive' : ''}`}
          aria-invalid={!!err}
        />
        {err && <p className="text-[10px] font-mono text-destructive">{err}</p>}
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-40 border-b border-border bg-card/95 backdrop-blur-xl">
        <div className="container mx-auto px-4 py-2.5 flex items-center gap-3">
          <Link to="/admin/hub" className="text-muted-foreground hover:text-foreground">
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <h1 className="font-mono text-sm font-semibold tracking-tight">
            CONFIGURAÇÃO DO GATE PUNTER
          </h1>
          <span className="ml-auto text-[10px] font-mono text-muted-foreground">
            {cfg.updated_at ? `Atualizado: ${new Date(cfg.updated_at).toLocaleString('pt-BR')}` : ''}
          </span>
        </div>
      </header>

      <div className="container mx-auto px-4 py-5 max-w-4xl space-y-6">
        <p className="text-xs text-muted-foreground font-mono">
          Edita os thresholds do gate determinístico (Blocos A/B/C + vetos) sem precisar redeploy.
          Alterações aplicam em até 60s (cache em memória das edges). Variáveis de ambiente
          <code className="px-1 mx-1 bg-muted rounded">GATE_*</code> sobrescrevem o que está aqui.
        </p>

        {/* Master switch */}
        <section className="border border-border rounded-lg p-4 bg-card">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="font-mono text-sm font-semibold">Gate habilitado</h2>
              <p className="text-xs text-muted-foreground">Se desligado, respeita 100% a decisão da IA (sem classificar em bloco).</p>
            </div>
            <Switch checked={cfg.enabled} onCheckedChange={(v) => set('enabled', v)} />
          </div>
        </section>

        {/* Vetos */}
        <section className="border border-border rounded-lg p-4 bg-card space-y-4">
          <h2 className="font-mono text-sm font-semibold">Vetos & Mínimos Globais</h2>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            <NumField k="prob_min_global" label="Prob mínima global (%)" step={1} />
            <NumField k="odd_min_global" label="Odd mínima global" />
            <NumField k="odd_max_global" label="Odd máxima global" />
            <NumField k="favorite_odd_threshold" label="Veto favorito: odd <" />
            <div className="space-y-1">
              <Label className="text-xs font-mono text-muted-foreground">Favorito requer data_strength</Label>
              <Input value={cfg.favorite_requires_data_strength}
                onChange={(e) => set('favorite_requires_data_strength', e.target.value.toUpperCase())}
                className={`h-8 font-mono text-xs ${errors.favorite_requires_data_strength ? 'border-destructive focus-visible:ring-destructive' : ''}`}
                aria-invalid={!!errors.favorite_requires_data_strength}
              />
              {errors.favorite_requires_data_strength && <p className="text-[10px] font-mono text-destructive">{errors.favorite_requires_data_strength}</p>}
            </div>
            <NumField k="odd_drop_pct_threshold" label="Trap line: queda 2h > (%)" step={0.5} />
            <NumField k="weak_league_odd_threshold" label="Liga fraca + odd <" />
            <NumField k="conf_inflation_threshold" label="Conf inflada >= (%)" step={1} />
            <NumField k="edge_inflation_threshold" label="Edge inflado < (%)" step={0.5} />
          </div>
          <div className="space-y-1">
            <Label className="text-xs font-mono text-muted-foreground">Regex de ligas fortes (case-insensitive)</Label>
            <Textarea
              value={cfg.strong_league_regex}
              onChange={(e) => set('strong_league_regex', e.target.value)}
              className={`font-mono text-xs min-h-[70px] ${errors.strong_league_regex ? 'border-destructive focus-visible:ring-destructive' : ''}`}
              aria-invalid={!!errors.strong_league_regex}
            />
            {errors.strong_league_regex && <p className="text-[10px] font-mono text-destructive">{errors.strong_league_regex}</p>}
          </div>
        </section>

        {hasErrors && (
          <section className="border border-destructive/50 bg-destructive/5 rounded-lg p-3 space-y-1">
            <div className="flex items-center gap-2 text-destructive font-mono text-xs font-semibold">
              <AlertTriangle className="w-4 h-4" /> {errorList.length} erro(s) de validação
            </div>
            <ul className="text-[11px] font-mono text-destructive/90 list-disc pl-5 space-y-0.5">
              {errorList.slice(0, 8).map(([k, msg]) => (
                <li key={k}><span className="opacity-70">{k}:</span> {msg}</li>
              ))}
            </ul>
          </section>
        )}

        {/* Blocos */}
        {(['a','b','c'] as const).map(b => {
          const titles = { a: '🟢 BLOCO A — SEGURANÇA', b: '🟡 BLOCO B — VALOR', c: '🔥 BLOCO C — ELITE' };
          return (
            <section key={b} className="border border-border rounded-lg p-4 bg-card space-y-3">
              <h2 className="font-mono text-sm font-semibold">{titles[b]}</h2>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                <NumField k={`${b}_prob_min` as keyof GateConfig} label="Prob mín (%)" step={1} />
                <NumField k={`${b}_edge_min` as keyof GateConfig} label="Edge mín (%)" step={0.5} />
                <NumField k={`${b}_conf_min` as keyof GateConfig} label="Conf mín (%)" step={1} />
                <NumField k={`${b}_odd_min` as keyof GateConfig} label="Odd mín" />
                <NumField k={`${b}_odd_max` as keyof GateConfig} label="Odd máx" />
                <NumField k={`${b}_stake_pct` as keyof GateConfig} label="Stake (%)" step={0.5} />
              </div>
              {b === 'c' && (
                <div className="flex items-center justify-between border-t border-border pt-3">
                  <Label className="text-xs font-mono text-muted-foreground">Requer baseline Pinnacle</Label>
                  <Switch checked={cfg.c_requires_pinnacle} onCheckedChange={(v) => set('c_requires_pinnacle', v)} />
                </div>
              )}
            </section>
          );
        })}

        {/* Notas */}
        <section className="border border-border rounded-lg p-4 bg-card space-y-2">
          <Label className="text-xs font-mono text-muted-foreground">Notas (registro interno)</Label>
          <Textarea
            value={cfg.notes || ''}
            onChange={(e) => set('notes', e.target.value)}
            placeholder="Ex: aumentei prob_min Bloco A em 18/05 pq win rate caiu pra 62%"
            className="font-mono text-xs min-h-[70px]"
          />
        </section>

        <div className="flex gap-2 sticky bottom-4">
          <Button onClick={handleSave} disabled={saving} className="flex-1 font-mono">
            {saving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
            Salvar configuração
          </Button>
          <Button onClick={handleReset} variant="outline" className="font-mono">
            <RotateCcw className="w-4 h-4 mr-2" /> Restaurar defaults
          </Button>
        </div>
      </div>
    </div>
  );
}
