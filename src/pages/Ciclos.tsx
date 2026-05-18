import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Loader2, TrendingUp, AlertTriangle, RotateCcw, CheckCircle2, Wallet, Target, Trophy, Bot, PauseCircle, PlayCircle } from 'lucide-react';
import { motion } from 'framer-motion';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { toast } from 'sonner';
import { nextTargetPct, cycleConfig, progressPct, fmtBRL } from '@/lib/ciclosMath';

interface CycleBankroll {
  id: string;
  user_id: string;
  total_bankroll: number;
  isolated_pct: number;
  initial_bankroll: number;
  current_cycle: number;
  current_stake: number;
  current_balance: number;
  entries_in_cycle: number;
  green_streak: number;
  status: 'active' | 'completed' | 'failed' | 'awaiting_withdrawal';
  total_withdrawn: number;
  horus_pilot_enabled: boolean;
  horus_pilot_mode: 'assisted' | 'simulated';
  independent_bankroll: boolean;
  auto_paused: boolean;
  consecutive_reds: number;
}

interface CycleEntry {
  id: string;
  cycle_number: number;
  entry_index: number;
  target_pct: number;
  target_amount: number;
  result: 'green' | 'red' | 'void';
  profit_loss: number;
  balance_after: number;
  match_id: string | null;
  note: string | null;
  created_at: string;
}

export default function Ciclos() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [bk, setBk] = useState<CycleBankroll | null>(null);
  const [entries, setEntries] = useState<CycleEntry[]>([]);

  // Setup form
  const [totalBankroll, setTotalBankroll] = useState('1000');
  const [isolatedPct, setIsolatedPct] = useState('10');
  const [starting, setStarting] = useState(false);

  // Register entry
  const [registerOpen, setRegisterOpen] = useState(false);
  const [registerResult, setRegisterResult] = useState<'green' | 'red' | 'void'>('green');
  const [registerAmount, setRegisterAmount] = useState('');
  const [registerNote, setRegisterNote] = useState('');
  const [registering, setRegistering] = useState(false);

  const load = async () => {
    if (!user) return;
    setLoading(true);
    const [{ data: b }, { data: e }] = await Promise.all([
      supabase.from('user_cycles_bankroll').select('*').eq('user_id', user.id).maybeSingle(),
      supabase.from('user_cycles_entries').select('*').eq('user_id', user.id).order('created_at', { ascending: false }).limit(200),
    ]);
    setBk((b as any) ?? null);
    setEntries(((e as any) ?? []) as CycleEntry[]);
    setLoading(false);
  };

  useEffect(() => { load(); /* eslint-disable-next-line */ }, [user?.id]);

  const handleStart = async () => {
    const total = parseFloat(totalBankroll);
    const pct = parseFloat(isolatedPct);
    if (!total || total <= 0) { toast.error('Banca total inválida'); return; }
    if (!pct || pct <= 0 || pct > 10) { toast.error('Fração isolada deve ser entre 0,1% e 10%'); return; }
    setStarting(true);
    const { error } = await supabase.rpc('start_cycle_method' as any, { p_total: total, p_pct: pct });
    setStarting(false);
    if (error) { toast.error(error.message); return; }
    toast.success('Método dos Ciclos iniciado');
    load();
  };

  const openRegister = (result: 'green' | 'red' | 'void') => {
    setRegisterResult(result);
    if (bk && result === 'green') {
      const tgt = bk.current_stake * nextTargetPct(bk.green_streak) / 100;
      setRegisterAmount(tgt.toFixed(2));
    } else {
      setRegisterAmount('');
    }
    setRegisterNote('');
    setRegisterOpen(true);
  };

  const handleRegister = async () => {
    const amount = parseFloat(registerAmount || '0');
    if (registerResult !== 'void' && (!amount || amount <= 0)) {
      toast.error('Informe o valor');
      return;
    }
    setRegistering(true);
    const { data, error } = await supabase.rpc('register_cycle_entry' as any, {
      p_result: registerResult,
      p_profit_loss: amount,
      p_match_id: null,
      p_note: registerNote || null,
    });
    setRegistering(false);
    if (error) { toast.error(error.message); return; }
    const res = data as any;
    if (res?.failed) toast.error('RED total — método encerrado. Reinicie quando quiser.');
    else if (res?.completed) toast.success('🎉 Ciclo completo! Faça o saque e avance.');
    else toast.success(registerResult === 'green' ? 'GREEN registrado' : registerResult === 'red' ? 'RED registrado' : 'VOID registrado');
    setRegisterOpen(false);
    load();
  };

  const handleAdvance = async () => {
    const { error } = await supabase.rpc('advance_cycle' as any);
    if (error) { toast.error(error.message); return; }
    toast.success('Próximo ciclo iniciado');
    load();
  };

  const handleReset = async () => {
    if (!confirm('Reiniciar o método? O histórico será apagado.')) return;
    const { error } = await supabase.rpc('reset_cycle_method' as any);
    if (error) { toast.error(error.message); return; }
    toast.success('Método reiniciado');
    load();
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-40 border-b border-border bg-card/95 backdrop-blur-xl">
        <div className="container mx-auto px-4 py-2.5 flex items-center gap-3">
          <button onClick={() => navigate('/lobby')} className="text-muted-foreground hover:text-foreground" aria-label="Voltar">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <h1 className="font-mono text-sm font-semibold tracking-tight">MÉTODO DOS CICLOS · ALAVANCAGEM</h1>
        </div>
      </header>

      <main className="container mx-auto px-4 py-6 max-w-4xl space-y-5">
        {loading ? (
          <div className="flex items-center justify-center py-20"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>
        ) : !bk ? (
          <SetupCard
            totalBankroll={totalBankroll} setTotalBankroll={setTotalBankroll}
            isolatedPct={isolatedPct} setIsolatedPct={setIsolatedPct}
            onStart={handleStart} starting={starting}
          />
        ) : (
          <>
            <ActivePanel bk={bk} onOpenRegister={openRegister} onAdvance={handleAdvance} onReset={handleReset} />
            <CyclesTimeline bk={bk} />
            <EntriesHistory entries={entries} />
            <NettunoRules />
          </>
        )}
      </main>

      <RegisterDialog
        open={registerOpen}
        onOpenChange={setRegisterOpen}
        result={registerResult}
        setResult={setRegisterResult}
        amount={registerAmount}
        setAmount={setRegisterAmount}
        note={registerNote}
        setNote={setRegisterNote}
        onConfirm={handleRegister}
        registering={registering}
        bk={bk}
      />
    </div>
  );
}

function SetupCard({ totalBankroll, setTotalBankroll, isolatedPct, setIsolatedPct, onStart, starting }: any) {
  const total = parseFloat(totalBankroll) || 0;
  const pct = parseFloat(isolatedPct) || 0;
  const initial = (total * pct) / 100;
  return (
    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="bg-card border border-border rounded-xl p-6 space-y-5">
      <div className="space-y-1">
        <h2 className="font-orbitron text-lg font-bold flex items-center gap-2"><TrendingUp className="w-5 h-5 text-primary" /> Configurar Método dos Ciclos</h2>
        <p className="text-xs text-muted-foreground">Método do Nettuno: dobre uma fração isolada da sua banca em 5 ciclos sequenciais. Meta 5% por entrada com fator redutor de 2,5% a cada green.</p>
      </div>
      <div className="grid sm:grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <Label className="text-xs">Banca total disponível (R$)</Label>
          <Input type="number" min={0} value={totalBankroll} onChange={(e) => setTotalBankroll(e.target.value)} placeholder="1000.00" />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs">Fração isolada do método (% — máx 10%)</Label>
          <Input type="number" min={0.1} max={10} step={0.5} value={isolatedPct} onChange={(e) => setIsolatedPct(e.target.value)} placeholder="10" />
        </div>
      </div>
      <div className="rounded-lg border border-warning/30 bg-warning/5 p-3 text-xs space-y-1">
        <p className="text-foreground">Banca inicial do método (<strong>B</strong>): <span className="text-primary font-bold">{fmtBRL(initial)}</span></p>
        <p className="text-muted-foreground">Objetivo final do método: <strong>{fmtBRL(initial * 6)}</strong> (após os 5 ciclos)</p>
        <p className="text-muted-foreground">Recomendação Nettuno: nunca use mais que 10% da sua banca total — assim você pode tentar o método várias vezes em caso de erro.</p>
      </div>
      <Button onClick={onStart} disabled={starting || !total || !pct} className="w-full">
        {starting ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
        Iniciar Método dos Ciclos
      </Button>
    </motion.div>
  );
}

function ActivePanel({ bk, onOpenRegister, onAdvance, onReset }: { bk: CycleBankroll; onOpenRegister: (r: 'green' | 'red' | 'void') => void; onAdvance: () => void; onReset: () => void }) {
  const cfg = cycleConfig(bk.initial_bankroll, bk.current_cycle);
  const targetPct = nextTargetPct(bk.green_streak);
  const targetAmount = bk.current_stake * targetPct / 100;
  const progress = progressPct(bk.current_balance, bk.current_stake);
  const profit = bk.current_balance - bk.current_stake;

  const isAwaiting = bk.status === 'awaiting_withdrawal';
  const isFailed = bk.status === 'failed';
  const isCompleted = bk.status === 'completed';

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
      {/* Status banner */}
      {isAwaiting && (
        <div className="rounded-xl border border-success/40 bg-success/10 p-4 flex items-start gap-3">
          <CheckCircle2 className="w-5 h-5 text-success mt-0.5" />
          <div className="flex-1 text-sm space-y-2">
            <p className="font-semibold text-success">Ciclo {bk.current_cycle} completo! Stake dobrada de {fmtBRL(bk.current_stake)} para {fmtBRL(bk.current_balance)}.</p>
            <p className="text-xs text-muted-foreground">
              Faça o saque obrigatório de <strong className="text-foreground">{fmtBRL(cfg.withdraw)}</strong> e inicie o próximo ciclo
              {bk.current_cycle < 5 ? ` com stake de ${fmtBRL(cycleConfig(bk.initial_bankroll, bk.current_cycle + 1).stake)}` : ' (final do método!)'}.
            </p>
            <Button size="sm" onClick={onAdvance}>{bk.current_cycle < 5 ? 'Saquei — avançar para o próximo ciclo' : 'Finalizar método'}</Button>
          </div>
        </div>
      )}
      {isFailed && (
        <div className="rounded-xl border border-destructive/40 bg-destructive/10 p-4 flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-destructive mt-0.5" />
          <div className="flex-1 text-sm space-y-2">
            <p className="font-semibold text-destructive">Stake perdida — método encerrado.</p>
            <p className="text-xs text-muted-foreground">Use outra parcela da sua banca total e reinicie. O Nettuno recomenda manter pelo menos 10 tentativas em mãos.</p>
            <Button size="sm" variant="outline" onClick={onReset}><RotateCcw className="w-3.5 h-3.5 mr-1.5" /> Reiniciar método</Button>
          </div>
        </div>
      )}
      {isCompleted && (
        <div className="rounded-xl border border-primary/40 bg-primary/10 p-4 flex items-start gap-3">
          <Trophy className="w-5 h-5 text-primary mt-0.5" />
          <div className="flex-1 text-sm space-y-2">
            <p className="font-semibold text-primary">Parabéns — método concluído!</p>
            <p className="text-xs text-muted-foreground">Total sacado nos 5 ciclos: <strong className="text-foreground">{fmtBRL(bk.total_withdrawn)}</strong> (banca inicial: {fmtBRL(bk.initial_bankroll)}).</p>
            <Button size="sm" variant="outline" onClick={onReset}><RotateCcw className="w-3.5 h-3.5 mr-1.5" /> Iniciar novo ciclo</Button>
          </div>
        </div>
      )}

      {/* Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard icon={<Wallet className="w-4 h-4 text-primary" />} label="Saldo do ciclo" value={fmtBRL(bk.current_balance)} sub={`${profit >= 0 ? '+' : ''}${fmtBRL(profit)}`} subColor={profit >= 0 ? 'text-success' : 'text-destructive'} />
        <StatCard icon={<Target className="w-4 h-4 text-warning" />} label="Meta do ciclo" value={fmtBRL(cfg.goal)} sub={`Ciclo ${bk.current_cycle}/5`} />
        <StatCard icon={<TrendingUp className="w-4 h-4 text-accent" />} label="Próxima meta %" value={`${targetPct.toFixed(2)}%`} sub={`= ${fmtBRL(targetAmount)}`} />
        <StatCard icon={<CheckCircle2 className="w-4 h-4 text-success" />} label="Greens no ciclo" value={`${bk.green_streak}`} sub={`${bk.entries_in_cycle} entradas`} />
      </div>

      {/* Progress */}
      <div className="bg-card border border-border rounded-xl p-4 space-y-2">
        <div className="flex justify-between text-xs">
          <span className="text-muted-foreground">Progresso até dobrar a stake</span>
          <span className="font-mono font-semibold">{progress.toFixed(1)}%</span>
        </div>
        <div className="h-3 rounded-full bg-muted overflow-hidden">
          <div className="h-full bg-gradient-to-r from-primary to-success transition-all" style={{ width: `${progress}%` }} />
        </div>
        <div className="flex justify-between text-[10px] text-muted-foreground font-mono">
          <span>Stake: {fmtBRL(bk.current_stake)}</span>
          <span>Meta: {fmtBRL(cfg.goal)}</span>
        </div>
      </div>

      {/* Actions */}
      {bk.status === 'active' && (
        <div className="grid grid-cols-3 gap-2">
          <Button onClick={() => onOpenRegister('green')} className="bg-success hover:bg-success/90 text-success-foreground">GREEN</Button>
          <Button onClick={() => onOpenRegister('red')} variant="destructive">RED</Button>
          <Button onClick={() => onOpenRegister('void')} variant="outline">VOID</Button>
        </div>
      )}

      <div className="text-[10px] text-muted-foreground font-mono flex justify-between px-1">
        <span>Banca inicial (B): {fmtBRL(bk.initial_bankroll)}</span>
        <span>Total sacado: {fmtBRL(bk.total_withdrawn)}</span>
      </div>
    </motion.div>
  );
}

function StatCard({ icon, label, value, sub, subColor }: { icon: React.ReactNode; label: string; value: string; sub?: string; subColor?: string }) {
  return (
    <div className="bg-card border border-border rounded-xl p-4 space-y-2">
      <div className="flex items-center gap-2">
        {icon}
        <span className="text-[10px] text-muted-foreground font-orbitron uppercase tracking-wide">{label}</span>
      </div>
      <p className="text-lg font-orbitron font-bold">{value}</p>
      {sub && <p className={`text-xs ${subColor || 'text-muted-foreground'}`}>{sub}</p>}
    </div>
  );
}

function CyclesTimeline({ bk }: { bk: CycleBankroll }) {
  return (
    <div className="bg-card border border-border rounded-xl p-4">
      <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground/70 mb-3">Roteiro dos 5 ciclos (B = {fmtBRL(bk.initial_bankroll)})</p>
      <div className="grid grid-cols-5 gap-2">
        {[1, 2, 3, 4, 5].map((n) => {
          const cfg = cycleConfig(bk.initial_bankroll, n);
          const done = n < bk.current_cycle || bk.status === 'completed';
          const active = n === bk.current_cycle && bk.status !== 'completed';
          return (
            <div key={n} className={`rounded-lg border p-2.5 space-y-1 text-[10px] font-mono ${done ? 'border-success/40 bg-success/5' : active ? 'border-primary bg-primary/5' : 'border-border bg-muted/20 opacity-60'}`}>
              <p className="font-bold text-xs">Ciclo {n}</p>
              <p>Stake: {fmtBRL(cfg.stake)}</p>
              <p>Meta: {fmtBRL(cfg.goal)}</p>
              <p className="text-warning">Saque: {fmtBRL(cfg.withdraw)}</p>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function EntriesHistory({ entries }: { entries: CycleEntry[] }) {
  if (entries.length === 0) {
    return <div className="bg-card border border-border rounded-xl p-6 text-center text-xs text-muted-foreground">Nenhuma entrada registrada ainda. Comece registrando seu primeiro GREEN.</div>;
  }
  return (
    <div className="bg-card border border-border rounded-xl overflow-hidden">
      <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground/70 p-3">Histórico de entradas</p>
      <div className="divide-y divide-border max-h-96 overflow-auto">
        {entries.map((e) => (
          <div key={e.id} className="px-3 py-2 flex items-center justify-between text-xs font-mono">
            <div className="flex items-center gap-2">
              <span className={`w-2 h-2 rounded-full ${e.result === 'green' ? 'bg-success' : e.result === 'red' ? 'bg-destructive' : 'bg-muted-foreground'}`} />
              <span>C{e.cycle_number}·#{e.entry_index}</span>
              <span className="text-muted-foreground">meta {e.target_pct.toFixed(2)}%</span>
            </div>
            <div className="flex items-center gap-3">
              <span className={e.result === 'green' ? 'text-success' : e.result === 'red' ? 'text-destructive' : 'text-muted-foreground'}>
                {e.result === 'green' ? '+' : e.result === 'red' ? '−' : ''}{fmtBRL(e.profit_loss)}
              </span>
              <span className="text-muted-foreground w-20 text-right">{fmtBRL(e.balance_after)}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function NettunoRules() {
  return (
    <details className="bg-card border border-border rounded-xl p-4 text-xs">
      <summary className="cursor-pointer font-mono uppercase tracking-wide text-muted-foreground">Dicas do Nettuno</summary>
      <ul className="mt-3 space-y-1.5 list-disc pl-5 text-muted-foreground">
        <li>Entradas SEMPRE a favor do tempo (Back em quem ganha, Lay em quem perde).</li>
        <li>Prefira mercado de Match Odds — movimentação mais previsível.</li>
        <li>Mercado Under Limite PROIBIDO — perda total da stake.</li>
        <li>Assim que atingir a meta percentual, encerre a posição. Sem ganância.</li>
        <li>Não é All-in: nunca use mais de 10% da sua banca total.</li>
      </ul>
    </details>
  );
}

function RegisterDialog({ open, onOpenChange, result, setResult, amount, setAmount, note, setNote, onConfirm, registering, bk }: any) {
  const targetAmount = bk ? bk.current_stake * nextTargetPct(bk.green_streak) / 100 : 0;
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Registrar entrada</DialogTitle>
          <DialogDescription>
            {bk && (<span>Stake atual <strong>{fmtBRL(bk.current_stake)}</strong> · próxima meta <strong>{nextTargetPct(bk.green_streak).toFixed(2)}%</strong> = <strong>{fmtBRL(targetAmount)}</strong></span>)}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="grid grid-cols-3 gap-2">
            {(['green', 'red', 'void'] as const).map((r) => (
              <Button key={r} variant={result === r ? 'default' : 'outline'} onClick={() => setResult(r)} className={result === r && r === 'green' ? 'bg-success hover:bg-success/90 text-success-foreground' : result === r && r === 'red' ? 'bg-destructive hover:bg-destructive/90' : ''}>
                {r.toUpperCase()}
              </Button>
            ))}
          </div>
          {result !== 'void' && (
            <div className="space-y-1.5">
              <Label className="text-xs">{result === 'green' ? 'Lucro (R$)' : 'Prejuízo (R$)'}</Label>
              <Input type="number" min={0} step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0.00" />
            </div>
          )}
          <div className="space-y-1.5">
            <Label className="text-xs">Observação (opcional)</Label>
            <Input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Ex: Brasil vs Argentina, Over 0.5 HT" />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={onConfirm} disabled={registering}>
            {registering ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
            Confirmar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
