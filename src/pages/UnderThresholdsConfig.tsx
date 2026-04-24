import { ArrowLeft, Sliders, Shield, Zap, Flame, Loader2, AlertTriangle } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { useUnderThresholds, RISK_PRESETS, type RiskProfile } from '@/hooks/useUnderThresholds';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

const PRESET_META: Record<Exclude<RiskProfile, 'custom'>, { label: string; icon: React.ElementType; tone: string; desc: string }> = {
  conservador: {
    label: 'Conservador',
    icon: Shield,
    tone: 'bg-[hsl(217,91%,60%)]/10 text-[hsl(217,91%,60%)] border-[hsl(217,91%,60%)]/30',
    desc: 'Sai cedo. Protege banca em qualquer ameaça.',
  },
  moderado: {
    label: 'Moderado',
    icon: Sliders,
    tone: 'bg-[hsl(45,93%,47%)]/10 text-[hsl(45,93%,47%)] border-[hsl(45,93%,47%)]/30',
    desc: 'Equilibrado. Padrão recomendado pelo Mycroft.',
  },
  agressivo: {
    label: 'Agressivo',
    icon: Flame,
    tone: 'bg-[hsl(0,84%,60%)]/10 text-[hsl(0,84%,60%)] border-[hsl(0,84%,60%)]/30',
    desc: 'Deixa correr. Mais lucro potencial, mais risco de gol.',
  },
};

export default function UnderThresholdsConfig() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { thresholds, loading, saving, update, applyPreset, save } = useUnderThresholds();

  if (!user) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <p className="text-muted-foreground text-sm">Faça login para configurar seus thresholds.</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-40 border-b border-border bg-card/95 backdrop-blur-xl">
        <div className="container mx-auto px-4 py-2.5 flex items-center gap-3">
          <button onClick={() => navigate(-1)} className="text-muted-foreground hover:text-foreground transition-colors">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div className="flex items-center gap-2">
            <Sliders className="w-4 h-4 text-primary" />
            <h1 className="font-orbitron text-sm font-semibold text-foreground tracking-tight uppercase">
              Thresholds Under — Cash Out
            </h1>
          </div>
        </div>
      </header>

      <div className="container mx-auto px-4 py-5 space-y-5 max-w-3xl">
        {/* Explainer */}
        <Card className="border-primary/30 bg-primary/5">
          <CardContent className="pt-4 pb-4 text-xs text-muted-foreground space-y-1.5 leading-relaxed">
            <p className="text-foreground font-semibold flex items-center gap-1.5">
              <AlertTriangle className="w-3.5 h-3.5 text-primary" /> Como funciona
            </p>
            <p>
              Para cada mercado <span className="font-semibold text-foreground">Under</span>, o Mycroft monitora a evolução do jogo após sua entrada e dispara alertas quando a pressão ofensiva sobe acima do limite que você definir:
            </p>
            <ul className="list-disc list-inside space-y-0.5 pl-1">
              <li><span className="font-semibold text-foreground">ΔAtaques perigosos</span> (totais)</li>
              <li><span className="font-semibold text-foreground">ΔChutes a gol</span> (totais)</li>
              <li><span className="font-semibold text-foreground">ΔxG total</span> (quando disponível)</li>
            </ul>
            <p className="pt-1">Se 2+ critérios forem ultrapassados → alerta crítico (SAIR AGORA).</p>
          </CardContent>
        </Card>

        {loading ? (
          <div className="flex items-center justify-center py-12 text-muted-foreground gap-2">
            <Loader2 className="w-4 h-4 animate-spin" /> Carregando…
          </div>
        ) : (
          thresholds.map(t => {
            const presetMeta = t.risk_profile !== 'custom' ? PRESET_META[t.risk_profile] : null;
            return (
              <Card key={t.under_line} className={cn('border-border', !t.enabled && 'opacity-60')}>
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between gap-3">
                    <CardTitle className="flex items-center gap-2 font-orbitron text-base">
                      <Zap className="w-4 h-4 text-primary" />
                      Under {t.under_line}
                      {presetMeta && (
                        <Badge variant="outline" className={cn('font-mono text-[10px] uppercase', presetMeta.tone)}>
                          {presetMeta.label}
                        </Badge>
                      )}
                      {t.risk_profile === 'custom' && (
                        <Badge variant="outline" className="font-mono text-[10px] uppercase bg-muted/40">
                          Custom
                        </Badge>
                      )}
                    </CardTitle>
                    <div className="flex items-center gap-2">
                      <Label htmlFor={`enabled-${t.under_line}`} className="text-xs text-muted-foreground">
                        Ativo
                      </Label>
                      <Switch
                        id={`enabled-${t.under_line}`}
                        checked={t.enabled}
                        onCheckedChange={(v) => update(t.under_line, { enabled: v })}
                      />
                    </div>
                  </div>
                </CardHeader>

                <CardContent className="space-y-4">
                  {/* Presets */}
                  <div>
                    <Label className="text-xs text-muted-foreground mb-2 block">Estilo de risco</Label>
                    <div className="grid grid-cols-3 gap-2">
                      {(Object.keys(PRESET_META) as Array<keyof typeof PRESET_META>).map(key => {
                        const meta = PRESET_META[key];
                        const Icon = meta.icon;
                        const active = t.risk_profile === key;
                        return (
                          <button
                            key={key}
                            type="button"
                            onClick={() => applyPreset(t.under_line, key)}
                            disabled={!t.enabled}
                            className={cn(
                              'rounded-lg border-2 p-2.5 text-left transition-all',
                              active
                                ? meta.tone + ' border-current'
                                : 'bg-card border-border text-muted-foreground hover:border-foreground/30',
                              !t.enabled && 'pointer-events-none'
                            )}
                          >
                            <div className="flex items-center gap-1.5 font-orbitron text-[11px] font-bold uppercase">
                              <Icon className="w-3 h-3" />
                              {meta.label}
                            </div>
                            <p className="text-[10px] mt-1 leading-tight opacity-80">
                              {meta.desc}
                            </p>
                            <p className="text-[9px] mt-1 font-mono opacity-70">
                              ΔA {RISK_PRESETS[key].delta_dangerous_attacks} · ΔC {RISK_PRESETS[key].delta_shots_on_target} · ΔxG {RISK_PRESETS[key].delta_xg}
                            </p>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Manual inputs */}
                  <div className="grid grid-cols-3 gap-3">
                    <div>
                      <Label className="text-xs text-muted-foreground">Δ Ataques perigosos</Label>
                      <Input
                        type="number"
                        min={1}
                        max={30}
                        step={1}
                        value={t.delta_dangerous_attacks}
                        disabled={!t.enabled}
                        onChange={(e) => update(t.under_line, {
                          delta_dangerous_attacks: Math.max(1, Math.min(30, parseInt(e.target.value) || 1)),
                          risk_profile: 'custom',
                        })}
                        className="mt-1 h-9 text-sm font-mono"
                      />
                    </div>
                    <div>
                      <Label className="text-xs text-muted-foreground">Δ Chutes a gol</Label>
                      <Input
                        type="number"
                        min={1}
                        max={20}
                        step={1}
                        value={t.delta_shots_on_target}
                        disabled={!t.enabled}
                        onChange={(e) => update(t.under_line, {
                          delta_shots_on_target: Math.max(1, Math.min(20, parseInt(e.target.value) || 1)),
                          risk_profile: 'custom',
                        })}
                        className="mt-1 h-9 text-sm font-mono"
                      />
                    </div>
                    <div>
                      <Label className="text-xs text-muted-foreground">Δ xG total</Label>
                      <Input
                        type="number"
                        min={0.1}
                        max={3}
                        step={0.1}
                        value={t.delta_xg}
                        disabled={!t.enabled}
                        onChange={(e) => update(t.under_line, {
                          delta_xg: Math.max(0.1, Math.min(3, parseFloat(e.target.value) || 0.1)),
                          risk_profile: 'custom',
                        })}
                        className="mt-1 h-9 text-sm font-mono"
                      />
                    </div>
                  </div>

                  <Button
                    onClick={() => save(t.under_line)}
                    disabled={saving === t.under_line}
                    className="w-full font-orbitron text-xs uppercase"
                    size="sm"
                  >
                    {saving === t.under_line ? <Loader2 className="w-3 h-3 animate-spin mr-2" /> : null}
                    Salvar Under {t.under_line}
                  </Button>
                </CardContent>
              </Card>
            );
          })
        )}
      </div>
    </div>
  );
}
