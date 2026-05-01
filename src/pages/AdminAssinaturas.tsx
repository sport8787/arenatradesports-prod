import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Loader2, CheckCircle2, XCircle, Search } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAdmin } from '@/hooks/useAdmin';
import { toast } from '@/hooks/use-toast';

type PurchaseEvent = {
  id: string;
  provider: string;
  event_type: string;
  external_order_id: string | null;
  customer_email: string | null;
  product_name: string | null;
  plan_resolved: string | null;
  amount: number | null;
  processed: boolean;
  process_error: string | null;
  created_at: string;
};

export default function AdminAssinaturas() {
  const navigate = useNavigate();
  const { isAdmin, loading: adminLoading } = useAdmin();
  const [events, setEvents] = useState<PurchaseEvent[]>([]);
  const [loading, setLoading] = useState(true);

  // Form state
  const [email, setEmail] = useState('');
  const [plan, setPlan] = useState<'starter' | 'basic' | 'base' | 'premium' | 'trial'>('starter');
  const [endsAt, setEndsAt] = useState('');
  const [arenas, setArenas] = useState<string[]>(['arena_live']);
  const [notes, setNotes] = useState('');
  const [provider, setProvider] = useState('kiwify');
  const [orderId, setOrderId] = useState('');
  const [amount, setAmount] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Lookup state
  const [lookupEmail, setLookupEmail] = useState('');
  const [lookupResult, setLookupResult] = useState<any>(null);

  useEffect(() => {
    if (!adminLoading && !isAdmin) navigate('/');
  }, [isAdmin, adminLoading, navigate]);

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from('purchase_events')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(50);
      setEvents((data as any) || []);
      setLoading(false);
    })();
  }, []);

  // Auto preset arenas based on plan
  useEffect(() => {
    const preset: Record<string, string[]> = {
      trial: ['arena_live', 'arena_punter', 'multiplas', 'banca_virtual', 'banca_real'],
      starter: ['arena_live'],
      base: ['arena_live', 'arena_punter'],
      premium: ['arena_live', 'arena_punter', 'multiplas', 'banca_virtual', 'banca_real'],
    };
    setArenas(preset[plan]);
  }, [plan]);

  async function handleGrant() {
    if (!email || !plan) {
      toast({ title: 'Preencha email e plano', variant: 'destructive' });
      return;
    }
    setSubmitting(true);
    try {
      const { data, error } = await supabase.functions.invoke('admin-grant-subscription', {
        body: {
          email: email.trim().toLowerCase(),
          plan,
          ends_at: endsAt || undefined,
          arenas,
          notes: notes || undefined,
          payment_provider: provider,
          external_order_id: orderId || undefined,
          amount: amount ? Number(amount) : undefined,
        },
      });
      if (error) throw error;
      if ((data as any)?.error) throw new Error((data as any).error);
      toast({ title: '✅ Assinatura ativada', description: `${email} → ${plan}` });
      setEmail(''); setOrderId(''); setAmount(''); setNotes('');
    } catch (e: any) {
      toast({ title: 'Erro', description: e.message || String(e), variant: 'destructive' });
    } finally {
      setSubmitting(false);
    }
  }

  async function handleLookup() {
    if (!lookupEmail) return;
    const { data: ud } = await supabase.functions.invoke('admin-check-user', {
      body: { email: lookupEmail.trim().toLowerCase() },
    });
    if (!(ud as any)?.exists) {
      setLookupResult({ error: 'Usuário não encontrado' });
      return;
    }
    const userId = (ud as any).id;
    const { data: sub } = await supabase
      .from('user_subscriptions').select('*').eq('user_id', userId).maybeSingle();
    setLookupResult({ user: ud, subscription: sub });
  }

  if (adminLoading || loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-40 border-b border-border bg-card/95 backdrop-blur-xl">
        <div className="container mx-auto px-4 py-2.5 flex items-center gap-3">
          <button onClick={() => navigate('/admin')} className="text-muted-foreground hover:text-foreground">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <h1 className="font-mono text-sm font-semibold tracking-tight">GERENCIAR ASSINATURAS</h1>
        </div>
      </header>

      <main className="container mx-auto px-4 py-6 max-w-5xl space-y-6">
        {/* Lookup */}
        <section className="border border-border rounded-lg bg-card p-4">
          <h2 className="font-mono text-xs font-semibold mb-3">CONSULTAR USUÁRIO</h2>
          <div className="flex gap-2">
            <input
              value={lookupEmail}
              onChange={(e) => setLookupEmail(e.target.value)}
              placeholder="email@exemplo.com"
              className="flex-1 bg-background border border-border rounded px-3 py-2 font-mono text-xs"
            />
            <button onClick={handleLookup}
              className="bg-primary text-primary-foreground font-mono text-xs px-4 py-2 rounded inline-flex items-center gap-1.5">
              <Search className="w-3.5 h-3.5" /> Consultar
            </button>
          </div>
          {lookupResult && (
            <pre className="mt-3 bg-muted/30 p-3 rounded text-[10px] font-mono overflow-auto max-h-64">
              {JSON.stringify(lookupResult, null, 2)}
            </pre>
          )}
        </section>

        {/* Manual grant */}
        <section className="border border-border rounded-lg bg-card p-4">
          <h2 className="font-mono text-xs font-semibold mb-3">ATIVAR ASSINATURA MANUALMENTE</h2>
          <div className="grid md:grid-cols-2 gap-3">
            <div>
              <label className="font-mono text-[10px] text-muted-foreground">Email</label>
              <input value={email} onChange={(e) => setEmail(e.target.value)}
                className="w-full bg-background border border-border rounded px-3 py-2 font-mono text-xs" />
            </div>
            <div>
              <label className="font-mono text-[10px] text-muted-foreground">Plano</label>
              <select value={plan} onChange={(e) => setPlan(e.target.value as any)}
                className="w-full bg-background border border-border rounded px-3 py-2 font-mono text-xs">
                <option value="trial">Trial</option>
                <option value="starter">Starter (só Arena Live)</option>
                <option value="basic">Basic (só Arena Punter)</option>
                <option value="base">Base (Live + Punter)</option>
                <option value="premium">Premium (Tudo)</option>
              </select>
            </div>
            <div>
              <label className="font-mono text-[10px] text-muted-foreground">Validade até</label>
              <input type="date" value={endsAt} onChange={(e) => setEndsAt(e.target.value)}
                className="w-full bg-background border border-border rounded px-3 py-2 font-mono text-xs" />
            </div>
            <div>
              <label className="font-mono text-[10px] text-muted-foreground">Provedor</label>
              <input value={provider} onChange={(e) => setProvider(e.target.value)}
                className="w-full bg-background border border-border rounded px-3 py-2 font-mono text-xs" />
            </div>
            <div>
              <label className="font-mono text-[10px] text-muted-foreground">Order ID (opcional)</label>
              <input value={orderId} onChange={(e) => setOrderId(e.target.value)}
                className="w-full bg-background border border-border rounded px-3 py-2 font-mono text-xs" />
            </div>
            <div>
              <label className="font-mono text-[10px] text-muted-foreground">Valor R$ (opcional)</label>
              <input value={amount} onChange={(e) => setAmount(e.target.value)}
                className="w-full bg-background border border-border rounded px-3 py-2 font-mono text-xs" />
            </div>
            <div className="md:col-span-2">
              <label className="font-mono text-[10px] text-muted-foreground">Arenas liberadas</label>
              <div className="flex flex-wrap gap-2 mt-1">
                {(['arena_live','arena_punter','multiplas','banca_virtual','banca_real'] as const).map((a) => (
                  <label key={a} className="font-mono text-[11px] flex items-center gap-1.5 border border-border rounded px-2 py-1">
                    <input type="checkbox" checked={arenas.includes(a)}
                      onChange={(e) => setArenas(e.target.checked ? [...arenas, a] : arenas.filter(x => x !== a))} />
                    {a}
                  </label>
                ))}
              </div>
            </div>
            <div className="md:col-span-2">
              <label className="font-mono text-[10px] text-muted-foreground">Notas</label>
              <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2}
                className="w-full bg-background border border-border rounded px-3 py-2 font-mono text-xs" />
            </div>
          </div>
          <button disabled={submitting} onClick={handleGrant}
            className="mt-4 bg-primary text-primary-foreground font-mono text-xs font-semibold px-4 py-2 rounded inline-flex items-center gap-1.5 disabled:opacity-50">
            {submitting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle2 className="w-3.5 h-3.5" />}
            Ativar assinatura
          </button>
        </section>

        {/* Events */}
        <section className="border border-border rounded-lg bg-card p-4">
          <h2 className="font-mono text-xs font-semibold mb-3">EVENTOS RECEBIDOS (KIWIFY)</h2>
          <div className="overflow-x-auto">
            <table className="w-full font-mono text-[10px]">
              <thead>
                <tr className="text-left text-muted-foreground border-b border-border">
                  <th className="py-2 pr-3">Data</th>
                  <th className="pr-3">Email</th>
                  <th className="pr-3">Produto</th>
                  <th className="pr-3">Plano</th>
                  <th className="pr-3">Evento</th>
                  <th className="pr-3">Order</th>
                  <th className="pr-3">Status</th>
                </tr>
              </thead>
              <tbody>
                {events.map((e) => (
                  <tr key={e.id} className="border-b border-border/50">
                    <td className="py-2 pr-3 text-muted-foreground">{new Date(e.created_at).toLocaleString('pt-BR')}</td>
                    <td className="pr-3">{e.customer_email}</td>
                    <td className="pr-3">{e.product_name}</td>
                    <td className="pr-3">{e.plan_resolved}</td>
                    <td className="pr-3">{e.event_type}</td>
                    <td className="pr-3">{e.external_order_id?.slice(0, 12)}</td>
                    <td className="pr-3">
                      {e.processed ? (
                        <span className="text-green-500 inline-flex items-center gap-1"><CheckCircle2 className="w-3 h-3" />OK</span>
                      ) : (
                        <span className="text-red-500 inline-flex items-center gap-1" title={e.process_error || ''}>
                          <XCircle className="w-3 h-3" />{e.process_error || 'pending'}
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
                {events.length === 0 && (
                  <tr><td colSpan={7} className="py-4 text-center text-muted-foreground">Nenhum evento ainda</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </section>

        <p className="font-mono text-[10px] text-muted-foreground text-center">
          Webhook URL Kiwify: <code className="bg-muted/30 px-1.5 py-0.5 rounded">{import.meta.env.VITE_SUPABASE_URL}/functions/v1/kiwify-webhook</code>
        </p>
      </main>
    </div>
  );
}
