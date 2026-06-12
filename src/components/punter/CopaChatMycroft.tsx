import { useState, useRef, useEffect } from 'react';
import { MessageCircle, X, Send, Loader2, CheckCircle, Save, AlertTriangle } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';

interface Message {
  role: 'user' | 'assistant';
  content: string;
}

interface Approval {
  aprovado: boolean;
  home: string;
  away: string;
  market: string;
  selection: string;
  ah_line: number | null;
  odd: number;
  prob: number;
  ve_pct: number;
  confidence: number;
  stake_pct: number;
  block: string;
  rationale: string;
  fixture_id: string | null;
  phase: string | null;
  commence_time: string | null;
}

const SUGGESTIONS = [
  'Considerando o confronto acima, há valor em algum mercado?',
  'Qual o mercado com maior VE neste jogo?',
  'O Under 2.5 tem valor neste confronto?',
  'Existe edge no Handicap Asiático?',
];

interface FeaturedMatch {
  fixture_id: string;
  home: string;
  away: string;
  phase: string;
  commence_time: string;
}

export default function CopaChatMycroft({ featuredMatch }: { featuredMatch?: FeaturedMatch | null }) {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [approval, setApproval] = useState<Approval | null>(null);
  const [fixtureFound, setFixtureFound] = useState<boolean | null>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (open) setTimeout(() => textareaRef.current?.focus(), 200);
  }, [open]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading, approval]);

  const send = async (text?: string) => {
    const q = (text ?? input).trim();
    if (!q || loading) return;

    const userMsg: Message = { role: 'user', content: q };
    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setLoading(true);
    setApproval(null);
    setSaved(false);
    setSaveError(null);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/mycroft-copa-chat`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${session?.access_token ?? import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            query: q,
            conversationHistory: messages,
            userId: session?.user?.id,
            contextFixture: featuredMatch ?? null,
          }),
        },
      );

      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();

      if (json.error) throw new Error(json.error);

      setMessages(prev => [...prev, { role: 'assistant', content: json.response ?? 'Sem resposta.' }]);
      setFixtureFound(json.fixture_found ?? null);
      if (json.approval) {
        setApproval(json.approval);
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Erro desconhecido';
      setMessages(prev => [...prev, { role: 'assistant', content: `⚠️ Erro: ${msg}` }]);
    } finally {
      setLoading(false);
    }
  };

  const saveSignal = async () => {
    if (!approval) return;
    setSaving(true);
    setSaveError(null);

    if (!approval.fixture_id) {
      setSaveError('Fixture não encontrado na base Copa. Verifique se o jogo está cadastrado em copa_fixtures.');
      setSaving(false);
      return;
    }

    try {
      const { error } = await supabase.from('punter_copa_signals').insert({
        fixture_id: approval.fixture_id,
        home: approval.home,
        away: approval.away,
        commence_time: approval.commence_time ?? new Date().toISOString(),
        phase: approval.phase ?? 'grupos_j1',
        market: approval.market,
        selection: approval.selection,
        ah_line: approval.ah_line ?? null,
        odd: approval.odd,
        prob: approval.prob,
        ve_pct: approval.ve_pct,
        edge_pct: approval.ve_pct,
        confidence: approval.confidence,
        block: approval.block,
        stake_pct: approval.stake_pct,
        status: 'APROVADO',
        copa_badge: true,
        rationale: approval.rationale,
        raw: { source: 'mycroft-copa-chat', manual: true },
      });

      if (error) throw error;
      setSaved(true);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      setSaveError(msg);
    } finally {
      setSaving(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      send();
    }
  };

  const clearChat = () => {
    setMessages([]);
    setApproval(null);
    setSaved(false);
    setSaveError(null);
    setFixtureFound(null);
  };

  return (
    <>
      {/* Floating button */}
      <button
        onClick={() => setOpen(true)}
        className="fixed bottom-5 right-4 z-40 flex items-center gap-2 px-4 py-3 rounded-2xl bg-yellow-500 text-black font-mono font-bold text-sm shadow-[0_0_24px_rgba(234,179,8,0.35)] hover:bg-yellow-400 active:scale-95 transition-all"
        aria-label="Chat com Mycroft Copa"
      >
        <MessageCircle className="w-4 h-4" />
        <span className="hidden sm:inline">Chat Mycroft</span>
      </button>

      {/* Backdrop + drawer */}
      {open && (
        <div className="fixed inset-0 z-50 flex flex-col">
          {/* Backdrop */}
          <div
            className="flex-1 bg-black/70 backdrop-blur-sm"
            onClick={() => setOpen(false)}
          />

          {/* Drawer */}
          <div className="bg-[#071207] border-t border-yellow-500/30 flex flex-col rounded-t-2xl"
            style={{ height: '88vh', maxHeight: '88vh' }}>

            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-yellow-500/20 flex-shrink-0">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-yellow-500/15 border border-yellow-500/30 flex items-center justify-center text-base">
                  🧠
                </div>
                <div>
                  <div className="font-mono font-bold text-yellow-400 text-sm leading-none">Mycroft Copa 2026</div>
                  {featuredMatch
                    ? <div className="text-[10px] text-yellow-300/60 font-mono mt-0.5 font-bold">{featuredMatch.home} vs {featuredMatch.away}</div>
                    : <div className="text-[10px] text-white/35 font-mono mt-0.5">Análise punter via DeepSeek</div>
                  }
                </div>
              </div>
              <div className="flex items-center gap-2">
                {messages.length > 0 && (
                  <button
                    onClick={clearChat}
                    className="text-[10px] text-white/30 hover:text-white/60 font-mono transition-colors px-2 py-1 rounded"
                  >
                    limpar
                  </button>
                )}
                <button
                  onClick={() => setOpen(false)}
                  className="text-white/40 hover:text-white transition-colors p-1"
                  aria-label="Fechar"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Messages area */}
            <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3 min-h-0">

              {/* Empty state */}
              {messages.length === 0 && (
                <div className="space-y-4 py-4">
                  {featuredMatch ? (
                    <div className="bg-yellow-500/8 border border-yellow-500/20 rounded-xl px-3 py-2.5 text-center">
                      <div className="text-[10px] text-white/35 font-mono mb-1">Contexto atual</div>
                      <div className="text-xs font-mono font-bold text-yellow-300">{featuredMatch.home} vs {featuredMatch.away}</div>
                    </div>
                  ) : (
                    <p className="text-center text-white/30 text-xs font-mono leading-relaxed">
                      Cole aqui a análise estatística do confronto.<br />
                      Mycroft analisa e aprova uma entrada se houver valor.
                    </p>
                  )}
                  <div className="space-y-2">
                    {SUGGESTIONS.map((s) => (
                      <button
                        key={s}
                        onClick={() => send(s)}
                        className="w-full text-left px-3 py-2 rounded-xl border border-yellow-500/15 text-[11px] text-yellow-400/60 hover:text-yellow-400 hover:border-yellow-500/30 hover:bg-yellow-500/5 font-mono transition-all"
                      >
                        {s}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Message bubbles */}
              {messages.map((m, i) => (
                <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                  <div className={`max-w-[88%] rounded-2xl px-3.5 py-2.5 text-xs leading-relaxed whitespace-pre-wrap ${
                    m.role === 'user'
                      ? 'bg-yellow-500/15 text-yellow-100 border border-yellow-500/25'
                      : 'bg-white/5 text-white/85 border border-white/8'
                  }`}>
                    {m.content}
                  </div>
                </div>
              ))}

              {/* Loading */}
              {loading && (
                <div className="flex justify-start">
                  <div className="bg-white/5 border border-white/8 rounded-2xl px-4 py-3 flex items-center gap-2">
                    <Loader2 className="w-3.5 h-3.5 text-yellow-400/70 animate-spin" />
                    <span className="text-[10px] text-white/40 font-mono">Mycroft analisando…</span>
                  </div>
                </div>
              )}

              {/* Fixture warning */}
              {fixtureFound === false && !loading && (
                <div className="flex items-start gap-2 bg-yellow-900/20 border border-yellow-500/20 rounded-xl px-3 py-2">
                  <AlertTriangle className="w-3.5 h-3.5 text-yellow-400 flex-shrink-0 mt-0.5" />
                  <p className="text-[10px] text-yellow-300/70 font-mono">
                    Fixture não encontrado na base copa_fixtures. A análise foi feita, mas o sinal não poderá ser salvo sem o fixture cadastrado.
                  </p>
                </div>
              )}

              {/* Approval card */}
              {approval && !loading && (
                <div className="rounded-2xl border border-green-500/40 bg-green-900/20 p-3.5 space-y-3">
                  <div className="flex items-center gap-2">
                    <CheckCircle className="w-4 h-4 text-green-400" />
                    <span className="text-green-400 font-mono font-black text-xs tracking-widest uppercase">
                      Entrada Aprovada
                    </span>
                  </div>

                  <div className="space-y-1 text-xs font-mono">
                    <div className="text-white font-bold text-sm">{approval.home} vs {approval.away}</div>
                    <div className="text-white/70">
                      <span className="text-green-400">{approval.market}</span>
                      {' · '}
                      <span className="text-white">{approval.selection}</span>
                      {approval.ah_line != null && <span className="text-white/50"> ({approval.ah_line > 0 ? '+' : ''}{approval.ah_line})</span>}
                    </div>
                    <div className="flex gap-3 text-white/60 flex-wrap">
                      <span>Odd: <span className="text-yellow-400">{approval.odd}</span></span>
                      <span>Conf: <span className="text-yellow-400">{approval.confidence}%</span></span>
                      <span>VE: <span className="text-green-400">+{approval.ve_pct}%</span></span>
                      <span>Stake: <span className="text-white">{approval.stake_pct}%</span> (Bloco {approval.block})</span>
                    </div>
                    {approval.rationale && (
                      <p className="text-white/40 pt-1 leading-relaxed">{approval.rationale}</p>
                    )}
                    {!approval.fixture_id && (
                      <p className="text-yellow-400/60 text-[10px] pt-1">
                        ⚠️ fixture_id não encontrado — salvar não disponível
                      </p>
                    )}
                  </div>

                  {saveError && (
                    <p className="text-red-400 text-[10px] font-mono bg-red-900/20 rounded-lg px-2 py-1.5">{saveError}</p>
                  )}

                  {!saved ? (
                    <Button
                      size="sm"
                      onClick={saveSignal}
                      disabled={saving || !approval.fixture_id}
                      className="w-full bg-green-600 hover:bg-green-500 disabled:opacity-40 text-white text-xs font-mono gap-1.5 h-9"
                    >
                      {saving ? <Loader2 className="w-3 h-3 animate-spin" /> : <Save className="w-3 h-3" />}
                      {saving ? 'Salvando…' : 'Salvar Sinal Copa'}
                    </Button>
                  ) : (
                    <div className="text-center text-green-400 text-xs font-mono py-1.5 bg-green-900/30 rounded-xl">
                      ✅ Sinal salvo — já aparece na página Copa
                    </div>
                  )}
                </div>
              )}

              <div ref={bottomRef} />
            </div>

            {/* Input */}
            <div className="px-4 py-3 border-t border-yellow-500/15 flex-shrink-0">
              <div className="flex gap-2 items-end">
                <textarea
                  ref={textareaRef}
                  value={input}
                  onChange={e => setInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="Cole a análise estatística ou faça uma pergunta…"
                  rows={3}
                  className="flex-1 bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-xs text-white placeholder-white/25 resize-none focus:outline-none focus:border-yellow-500/40 min-h-[64px] max-h-[140px] leading-relaxed"
                  disabled={loading}
                />
                <button
                  onClick={() => send()}
                  disabled={loading || !input.trim()}
                  className="mb-0.5 px-3.5 py-3.5 rounded-xl bg-yellow-500 text-black disabled:opacity-30 flex-shrink-0 hover:bg-yellow-400 active:scale-95 transition-all"
                  aria-label="Enviar"
                >
                  {loading
                    ? <Loader2 className="w-4 h-4 animate-spin" />
                    : <Send className="w-4 h-4" />
                  }
                </button>
              </div>
              <p className="text-[9px] text-white/15 font-mono mt-1.5 text-center">
                Enter envia · Shift+Enter nova linha
              </p>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
