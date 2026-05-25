import { useEffect, useState, useMemo, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Skeleton } from '@/components/ui/skeleton';
import { Check, CheckCheck, Bell, Trophy, XCircle, Target, Radio } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { translateMarket } from '@/utils/marketTranslator';
import CopySignalActions from '@/components/signals/CopySignalActions';
import PunterEmptyState from '@/components/punter/PunterEmptyState';

const READ_KEY = 'punter_feed_read_v1';

interface FeedItem {
  id: string;
  kind: 'APROVADO' | 'GREEN' | 'RED' | 'LIVE';
  created_at: string;
  league: string;
  match: string;
  market: string;
  odd: number | null;
  confidence: number | null;
  profit_loss: number | null;
  commence_time?: string | null;
}

function loadRead(): Set<string> {
  try {
    const raw = localStorage.getItem(READ_KEY);
    if (!raw) return new Set();
    return new Set(JSON.parse(raw));
  } catch {
    return new Set();
  }
}

function saveRead(set: Set<string>) {
  try {
    localStorage.setItem(READ_KEY, JSON.stringify(Array.from(set).slice(-500)));
  } catch {}
}

export default function SignalsFeed() {
  const [items, setItems] = useState<FeedItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [readIds, setReadIds] = useState<Set<string>>(loadRead);
  const [tab, setTab] = useState<'all' | 'unread' | 'live' | 'green' | 'red'>('all');

  const fetchFeed = useCallback(async () => {
    // 1) Entradas APROVADOS recentes (últimos 7 dias)
    const sinceIso = new Date(Date.now() - 7 * 24 * 3600 * 1000).toISOString();

    const { data: aprovados } = await supabase
      .from('punter_sinais')
      .select('id, created_at, league, home_team, away_team, market, odd, confidence, verdict, resultado, settled_at, profit_loss, commence_time')
      .eq('verdict', 'APROVADO')
      .gte('created_at', sinceIso)
      .order('created_at', { ascending: false })
      .limit(50);

    const list: FeedItem[] = [];
    const nowMs = Date.now();
    (aprovados || []).forEach((a: any) => {
      const commenceMs = a.commence_time ? new Date(a.commence_time).getTime() : null;
      const kickoffPassed = commenceMs != null && commenceMs <= nowMs;
      // Card APROVADO — só aparece ANTES do kickoff (anti-trapaça BC)
      if (!kickoffPassed) {
        list.push({
          id: `aprovado-${a.id}`,
          kind: 'APROVADO',
          created_at: a.created_at,
          league: a.league || '—',
          match: `${a.home_team} vs ${a.away_team}`,
          market: a.market,
          odd: a.odd,
          confidence: a.confidence,
          profit_loss: null,
          commence_time: a.commence_time,
        });
      }
      // Card AO VIVO: aprovado, jogo já começou e ainda não foi liquidado
      const isLive =
        commenceMs != null &&
        commenceMs <= nowMs &&
        commenceMs >= nowMs - 3 * 60 * 60 * 1000 && // janela de 3h
        !a.resultado &&
        !a.settled_at;
      if (isLive) {
        list.push({
          id: `live-${a.id}`,
          kind: 'LIVE',
          created_at: a.created_at,
          league: a.league || '—',
          match: `${a.home_team} vs ${a.away_team}`,
          market: a.market,
          odd: a.odd,
          confidence: a.confidence,
          profit_loss: null,
          commence_time: a.commence_time,
        });
      }
      // Card de resultado se já liquidado
      if (a.resultado === 'won' || a.resultado === 'green') {
        list.push({
          id: `result-${a.id}`,
          kind: 'GREEN',
          created_at: a.settled_at || a.created_at,
          league: a.league || '—',
          match: `${a.home_team} vs ${a.away_team}`,
          market: a.market,
          odd: a.odd,
          confidence: a.confidence,
          profit_loss: a.profit_loss,
        });
      } else if (a.resultado === 'lost' || a.resultado === 'red') {
        list.push({
          id: `result-${a.id}`,
          kind: 'RED',
          created_at: a.settled_at || a.created_at,
          league: a.league || '—',
          match: `${a.home_team} vs ${a.away_team}`,
          market: a.market,
          odd: a.odd,
          confidence: a.confidence,
          profit_loss: a.profit_loss,
        });
      }
    });

    list.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    setItems(list);
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchFeed();

    const channel = supabase
      .channel('punter-feed')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'punter_sinais' }, () => fetchFeed())
      .subscribe();

    // Atualização periódica (30s) para refrescar a aba AO VIVO conforme jogos começam/terminam
    const interval = setInterval(() => fetchFeed(), 30_000);

    return () => {
      supabase.removeChannel(channel);
      clearInterval(interval);
    };
  }, [fetchFeed]);

  const markRead = (id: string) => {
    const next = new Set(readIds);
    next.add(id);
    setReadIds(next);
    saveRead(next);
  };

  const markAllRead = () => {
    const next = new Set(readIds);
    items.forEach((i) => next.add(i.id));
    setReadIds(next);
    saveRead(next);
    toast.success('Todos os entradas marcados como lidos');
  };

  const filtered = useMemo(() => {
    return items.filter((i) => {
      if (tab === 'unread') return !readIds.has(i.id);
      if (tab === 'live') return i.kind === 'LIVE';
      if (tab === 'green') return i.kind === 'GREEN';
      if (tab === 'red') return i.kind === 'RED';
      return true;
    });
  }, [items, readIds, tab]);

  const unreadCount = useMemo(() => items.filter((i) => !readIds.has(i.id)).length, [items, readIds]);
  const liveCount = useMemo(() => items.filter((i) => i.kind === 'LIVE').length, [items]);

  return (
    <Card className="border-primary/20">
      <CardHeader className="flex flex-row items-center justify-between gap-3 space-y-0">
        <div className="flex items-center gap-2">
          <Bell className="h-5 w-5 text-primary" />
          <CardTitle className="text-lg">Feed de Entradas</CardTitle>
          {unreadCount > 0 && (
            <Badge variant="default" className="bg-primary text-primary-foreground">
              {unreadCount} não lido{unreadCount > 1 ? 's' : ''}
            </Badge>
          )}
        </div>
        {unreadCount > 0 && (
          <Button size="sm" variant="ghost" onClick={markAllRead} className="gap-1.5">
            <CheckCheck className="h-4 w-4" /> Marcar tudo
          </Button>
        )}
      </CardHeader>
      <CardContent>
        <Tabs value={tab} onValueChange={(v) => setTab(v as any)}>
          <TabsList className="grid grid-cols-5 w-full">
            <TabsTrigger value="live" className="gap-1.5">
              <Radio className="h-3.5 w-3.5 text-destructive animate-pulse" />
              Ao Vivo
              {liveCount > 0 && (
                <Badge variant="destructive" className="ml-1 h-4 px-1 text-[10px]">
                  {liveCount}
                </Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="unread">Não lidos</TabsTrigger>
            <TabsTrigger value="all">Todos</TabsTrigger>
            <TabsTrigger value="green">GREEN</TabsTrigger>
            <TabsTrigger value="red">RED</TabsTrigger>
          </TabsList>
          <TabsContent value={tab} className="mt-4">
            {loading ? (
              <div className="space-y-2">
                <Skeleton className="h-20 w-full" />
                <Skeleton className="h-20 w-full" />
                <Skeleton className="h-20 w-full" />
              </div>
            ) : filtered.length === 0 ? (
              <PunterEmptyState category={tab} />
            ) : (
              <ScrollArea className="h-[460px] pr-3">
                <div className="space-y-2">
                  <AnimatePresence initial={false}>
                    {filtered.map((item) => (
                      <FeedRow key={item.id} item={item} read={readIds.has(item.id)} onRead={() => markRead(item.id)} />
                    ))}
                  </AnimatePresence>
                </div>
              </ScrollArea>
            )}
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}

function FeedRow({ item, read, onRead }: { item: FeedItem; read: boolean; onRead: () => void }) {
  const date = new Date(item.created_at);
  const dateStr = date.toLocaleString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });

  const config =
    item.kind === 'GREEN'
      ? { icon: Trophy, label: '🟢 GREEN', cls: 'border-success/40 bg-success/10', text: 'text-success' }
      : item.kind === 'RED'
        ? { icon: XCircle, label: '🔴 RED', cls: 'border-destructive/40 bg-destructive/10', text: 'text-destructive' }
        : item.kind === 'LIVE'
          ? { icon: Radio, label: '🔴 AO VIVO', cls: 'border-destructive/40 bg-destructive/10 animate-pulse', text: 'text-destructive' }
          : { icon: Target, label: '🎯 APROVADO', cls: 'border-primary/40 bg-primary/10', text: 'text-primary' };

  const Icon = config.icon;

  return (
    <motion.div
      initial={{ opacity: 0, y: -6 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, height: 0 }}
      className={cn(
        'rounded-lg border p-3 transition-all',
        config.cls,
        read && 'opacity-60'
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-2 mb-1">
            <Badge variant="outline" className={cn('font-bold', config.text)}>
              <Icon className="h-3 w-3 mr-1" />
              {config.label}
            </Badge>
            <span className="text-xs text-muted-foreground">{dateStr}</span>
            <span className="text-xs text-muted-foreground">• {item.league}</span>
          </div>
          <p className="font-semibold text-sm truncate">⚽ {item.match}</p>
          <p className="text-xs text-muted-foreground">
            📊 {translateMarket(item.market)}
            {item.odd != null && ` @ ${Number(item.odd).toFixed(2)}`}
            {item.confidence != null && ` • Conf. ${item.confidence}%`}
            {item.profit_loss != null && (
              <span className={cn('ml-1 font-bold', item.profit_loss >= 0 ? 'text-success' : 'text-destructive')}>
                {item.profit_loss >= 0 ? ' +' : ' '}
                {Number(item.profit_loss).toFixed(2)}
              </span>
            )}
          </p>
        </div>
        {!read && (
          <Button size="sm" variant="ghost" onClick={onRead} className="shrink-0 h-8 gap-1">
            <Check className="h-3.5 w-3.5" /> Lido
          </Button>
        )}
      </div>
      {(item.kind === 'APROVADO' || item.kind === 'LIVE') && (
        <CopySignalActions
          signal={{
            match: item.match,
            market: item.market,
            odd: item.odd,
            league: item.league,
            confidence: item.confidence,
          }}
        />
      )}
    </motion.div>
  );
}
