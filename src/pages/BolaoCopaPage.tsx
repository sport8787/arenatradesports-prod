import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Trophy, Send, Loader2, Star } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';

// ─── Tipos ────────────────────────────────────────────────────────────────────

interface Fixture {
  fixture_id: string;
  home: string;
  away: string;
  phase: string;
  commence_time: string;
}

interface Palpite {
  id: string;
  fixture_id: string;
  home: string;
  away: string;
  palpite_home: number;
  palpite_away: number;
  gols_home: number | null;
  gols_away: number | null;
  pontos: number;
}

interface Ranking {
  user_id: string;
  username: string;
  total_pontos: number;
  acertos_exatos: number;
  total_palpites: number;
}

const PHASE_LABEL: Record<string, string> = {
  grupos_j1: 'Grupos · J1', grupos_j2: 'Grupos · J2', grupos_j3: 'Grupos · J3',
  oitavas: 'Oitavas', quartas: 'Quartas', semi: 'Semifinal', '3lugar': '3º Lugar', final: 'Final',
};

function calcPoints(ph: number, pa: number, gh: number | null, ga: number | null): number {
  if (gh == null || ga == null) return 0;
  if (ph === gh && pa === ga) return 3; // placar exato
  const predWin = ph > pa ? 'H' : ph < pa ? 'A' : 'D';
  const realWin = gh > ga ? 'H' : gh < ga ? 'A' : 'D';
  if (predWin === realWin) return predWin === 'D' ? 2 : 1; // vencedor certo (empate vale mais)
  return 0;
}

// ─── Componente de palpite individual ─────────────────────────────────────────

function PalpiteCard({
  fx, existing, onSave,
}: {
  fx: Fixture;
  existing?: Palpite;
  onSave: (fixtureId: string, h: number, a: number) => Promise<void>;
}) {
  const [h, setH] = useState(existing?.palpite_home ?? 0);
  const [a, setA] = useState(existing?.palpite_away ?? 0);
  const [saving, setSaving] = useState(false);
  const isPast = new Date(fx.commence_time) < new Date();
  const pts = existing ? calcPoints(existing.palpite_home, existing.palpite_away, existing.gols_home, existing.gols_away) : null;

  const handleSave = async () => {
    setSaving(true);
    await onSave(fx.fixture_id, h, a);
    setSaving(false);
  };

  return (
    <Card className="bg-black/40 border-yellow-500/20">
      <CardContent className="pt-4 pb-3 space-y-3">
        <div className="flex items-center gap-2 flex-wrap">
          <Badge variant="outline" className="text-[10px] border-yellow-500/30 text-yellow-300/80">
            {PHASE_LABEL[fx.phase] || fx.phase}
          </Badge>
          <span className="text-[10px] text-white/40 font-mono">
            {new Date(fx.commence_time).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit', timeZone: 'America/Sao_Paulo' })}
          </span>
          {pts != null && (
            <Badge className={pts === 3 ? 'bg-green-600 text-[10px]' : pts > 0 ? 'bg-yellow-600 text-[10px]' : 'bg-white/10 text-[10px]'}>
              {pts} {pts === 1 ? 'pt' : 'pts'}
            </Badge>
          )}
        </div>

        <div className="flex items-center gap-3">
          {/* Time casa */}
          <span className="flex-1 text-sm font-semibold text-white text-right truncate">{fx.home}</span>

          {/* Placar */}
          {isPast && existing ? (
            <div className="flex items-center gap-1 font-mono text-lg font-bold text-yellow-400">
              <span>{existing.palpite_home}</span>
              <span className="text-white/30 text-sm">×</span>
              <span>{existing.palpite_away}</span>
            </div>
          ) : (
            <div className="flex items-center gap-1">
              <button
                onClick={() => !isPast && setH(Math.max(0, h - 1))}
                className="w-6 h-6 rounded bg-white/10 text-white text-xs hover:bg-white/20 disabled:opacity-40"
                disabled={isPast}
              >−</button>
              <span className="font-mono font-bold text-yellow-400 w-5 text-center">{h}</span>
              <button
                onClick={() => !isPast && setH(h + 1)}
                className="w-6 h-6 rounded bg-white/10 text-white text-xs hover:bg-white/20 disabled:opacity-40"
                disabled={isPast}
              >+</button>
              <span className="text-white/30 mx-1">×</span>
              <button
                onClick={() => !isPast && setA(Math.max(0, a - 1))}
                className="w-6 h-6 rounded bg-white/10 text-white text-xs hover:bg-white/20 disabled:opacity-40"
                disabled={isPast}
              >−</button>
              <span className="font-mono font-bold text-yellow-400 w-5 text-center">{a}</span>
              <button
                onClick={() => !isPast && setA(a + 1)}
                className="w-6 h-6 rounded bg-white/10 text-white text-xs hover:bg-white/20 disabled:opacity-40"
                disabled={isPast}
              >+</button>
            </div>
          )}

          {/* Time visitante */}
          <span className="flex-1 text-sm font-semibold text-white truncate">{fx.away}</span>
        </div>

        {/* Resultado real se disponível */}
        {existing?.gols_home != null && (
          <div className="text-[11px] text-white/40 text-center font-mono">
            Resultado: {existing.gols_home} × {existing.gols_away}
          </div>
        )}

        {!isPast && (
          <Button
            size="sm"
            onClick={handleSave}
            disabled={saving}
            className="w-full bg-yellow-500 hover:bg-yellow-400 text-black text-xs font-bold h-7"
          >
            {saving ? <Loader2 className="w-3 h-3 animate-spin" /> : <><Send className="w-3 h-3 mr-1" /> Enviar palpite</>}
          </Button>
        )}
      </CardContent>
    </Card>
  );
}

// ─── Página principal ──────────────────────────────────────────────────────────

export default function BolaoCopaPage() {
  const navigate = useNavigate();
  const { user, profile } = useAuth();
  const [tab, setTab] = useState<'palpites' | 'ranking'>('palpites');
  const [fixtures, setFixtures] = useState<Fixture[]>([]);
  const [palpites, setPalpites] = useState<Palpite[]>([]);
  const [ranking, setRanking] = useState<Ranking[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, [user?.id]);

  async function loadData() {
    setLoading(true);
    const [fxRes, palpitesRes] = await Promise.all([
      supabase.from('copa_fixtures').select('fixture_id, home, away, phase, commence_time').order('commence_time').limit(200),
      user?.id
        ? supabase.from('bolao_copa_palpites').select('*').eq('user_id', user.id).limit(200)
        : Promise.resolve({ data: [] }),
    ]);
    setFixtures((fxRes.data || []) as Fixture[]);
    setPalpites((palpitesRes.data || []) as Palpite[]);

    // Ranking simples — usuários com mais pontos
    const { data: allPalpites } = await supabase
      .from('bolao_copa_palpites')
      .select('user_id, pontos')
      .not('gols_home', 'is', null);

    if (allPalpites && allPalpites.length > 0) {
      const byUser: Record<string, { total: number; exatos: number; count: number }> = {};
      for (const p of allPalpites) {
        if (!byUser[p.user_id]) byUser[p.user_id] = { total: 0, exatos: 0, count: 0 };
        byUser[p.user_id].total += p.pontos || 0;
        if (p.pontos === 3) byUser[p.user_id].exatos++;
        byUser[p.user_id].count++;
      }
      const sorted = Object.entries(byUser)
        .sort(([, a], [, b]) => b.total - a.total)
        .slice(0, 20)
        .map(([uid, v]) => ({
          user_id: uid,
          username: uid.slice(0, 8),
          total_pontos: v.total,
          acertos_exatos: v.exatos,
          total_palpites: v.count,
        }));
      setRanking(sorted);
    }
    setLoading(false);
  }

  async function handleSave(fixtureId: string, h: number, a: number) {
    if (!user?.id) return;
    const fx = fixtures.find(f => f.fixture_id === fixtureId);
    if (!fx) return;
    await supabase.from('bolao_copa_palpites').upsert({
      user_id: user.id,
      fixture_id: fixtureId,
      home: fx.home,
      away: fx.away,
      phase: fx.phase,
      commence_time: fx.commence_time,
      palpite_home: h,
      palpite_away: a,
    }, { onConflict: 'user_id,fixture_id' });
    setPalpites(prev => {
      const idx = prev.findIndex(p => p.fixture_id === fixtureId);
      const updated = { ...prev[idx] || {}, fixture_id: fixtureId, palpite_home: h, palpite_away: a } as Palpite;
      if (idx >= 0) { const n = [...prev]; n[idx] = updated; return n; }
      return [...prev, updated];
    });
  }

  const myPontos = palpites.reduce((acc, p) => acc + (p.pontos || 0), 0);
  const liquidados = palpites.filter(p => p.gols_home != null);

  return (
    <div className="min-h-screen bg-[#071207] text-white">
      <header className="sticky top-0 z-40 border-b border-yellow-500/20 bg-black/80 backdrop-blur-xl">
        <div className="container mx-auto px-4 py-3 flex items-center gap-3">
          <button onClick={() => navigate('/punter/copa')} className="text-white/50 hover:text-white">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div className="flex items-center gap-2 flex-1">
            <span className="text-xl">⚽</span>
            <div>
              <h1 className="font-mono text-sm font-bold text-yellow-400">BOLÃO DA COPA 2026</h1>
              <p className="font-mono text-[10px] text-yellow-500/60">Acerte o placar · Ganhe pontos · Suba no ranking</p>
            </div>
          </div>
        </div>
        <div className="border-t border-yellow-500/10 container mx-auto px-4 flex gap-1 py-1.5">
          {(['palpites', 'ranking'] as const).map(t => (
            <button key={t} onClick={() => setTab(t)}
              className={`px-3 py-1.5 rounded-lg text-[11px] font-mono font-semibold capitalize transition-colors ${tab === t ? 'bg-yellow-500 text-black' : 'text-yellow-400/60 hover:text-yellow-400 hover:bg-yellow-500/10'}`}>
              {t === 'palpites' ? '⚽ Meus Palpites' : '🏆 Ranking'}
            </button>
          ))}
        </div>
      </header>

      <main className="container mx-auto px-4 py-5 max-w-xl space-y-4">
        {/* Regras */}
        <Card className="bg-black/40 border-yellow-500/20">
          <CardContent className="pt-3 pb-2 flex gap-4 text-center text-xs">
            <div className="flex-1"><div className="text-yellow-400 font-bold text-lg">{myPontos}</div><div className="text-white/40">Meus pontos</div></div>
            <div className="flex-1"><div className="text-white font-bold text-lg">{liquidados.length}</div><div className="text-white/40">Liquidados</div></div>
            <div className="flex-1 text-white/40 text-[10px] text-left leading-relaxed">
              Placar exato: <span className="text-green-400 font-bold">3 pts</span><br />
              Vencedor certo: <span className="text-yellow-400 font-bold">1 pt</span><br />
              Empate certo: <span className="text-yellow-400 font-bold">2 pts</span>
            </div>
          </CardContent>
        </Card>

        {loading ? (
          <div className="flex justify-center py-10 text-yellow-400/50">
            <Loader2 className="w-5 h-5 animate-spin" />
          </div>
        ) : tab === 'palpites' ? (
          <div className="space-y-2">
            <p className="font-mono text-[10px] text-yellow-500/60 uppercase tracking-widest px-1">
              {fixtures.length} jogos · clique para enviar antes do início
            </p>
            {fixtures.map(fx => (
              <PalpiteCard
                key={fx.fixture_id}
                fx={fx}
                existing={palpites.find(p => p.fixture_id === fx.fixture_id)}
                onSave={handleSave}
              />
            ))}
          </div>
        ) : (
          <div className="space-y-2">
            <p className="font-mono text-[10px] text-yellow-500/60 uppercase tracking-widest px-1">
              Top participantes
            </p>
            {ranking.length === 0 ? (
              <Card className="bg-black/40 border-yellow-500/20">
                <CardContent className="pt-6 pb-5 text-center text-sm text-white/40">
                  Ranking disponível após os primeiros resultados liquidados.
                </CardContent>
              </Card>
            ) : (
              ranking.map((r, i) => (
                <Card key={r.user_id} className={`border-yellow-500/20 ${r.user_id === user?.id ? 'bg-yellow-500/10 border-yellow-500/40' : 'bg-black/40'}`}>
                  <CardContent className="pt-3 pb-2 flex items-center gap-3">
                    <div className={`w-7 h-7 rounded-full flex items-center justify-center font-mono font-bold text-xs ${i === 0 ? 'bg-yellow-500 text-black' : i === 1 ? 'bg-white/20' : i === 2 ? 'bg-amber-700/60' : 'bg-white/5 text-white/40'}`}>
                      {i + 1}
                    </div>
                    <div className="flex-1">
                      <div className="text-sm font-semibold text-white">
                        {r.user_id === user?.id ? (profile?.username || 'Você') : r.username}
                        {r.user_id === user?.id && <Badge className="ml-2 text-[9px] bg-yellow-500/20 text-yellow-400 border border-yellow-500/30">Você</Badge>}
                      </div>
                      <div className="text-[10px] text-white/40">{r.acertos_exatos} exatos · {r.total_palpites} palpites</div>
                    </div>
                    <div className="text-right">
                      <div className="font-mono font-bold text-yellow-400">{r.total_pontos}</div>
                      <div className="text-[10px] text-white/40">pontos</div>
                    </div>
                    {i === 0 && <Star className="w-4 h-4 text-yellow-400" />}
                  </CardContent>
                </Card>
              ))
            )}
          </div>
        )}
      </main>
    </div>
  );
}
