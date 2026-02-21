import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Users, Heart, Copy, TrendingUp, TrendingDown, Send, ChevronDown, ChevronUp } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from '@/hooks/use-toast';

interface FeedItem {
  id: string;
  user_id: string;
  username: string;
  trade_type: string;
  asset_symbol: string;
  entry_price: number;
  exit_price: number;
  amount: number;
  leverage: number;
  pnl: number;
  pnl_percent: number;
  comment: string | null;
  likes_count: number;
  copies_count: number;
  created_at: string;
}

interface SocialFeedPanelProps {
  onCopyTrade?: (type: 'long' | 'short', assetSymbol: string) => void;
}

export default function SocialFeedPanel({ onCopyTrade }: SocialFeedPanelProps) {
  const { profile, isAuthenticated } = useAuth();
  const [feed, setFeed] = useState<FeedItem[]>([]);
  const [expanded, setExpanded] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    loadFeed();

    // Realtime subscription
    const channel = supabase
      .channel('social-feed')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'trader_social_feed' }, (payload) => {
        setFeed(prev => [payload.new as FeedItem, ...prev.slice(0, 19)]);
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, []);

  const loadFeed = async () => {
    setLoading(true);
    try {
      const { data } = await supabase
        .from('trader_social_feed')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(20);
      if (data) setFeed(data as FeedItem[]);
    } catch (e) {
      console.error('Error loading feed:', e);
    } finally {
      setLoading(false);
    }
  };

  const handleLike = async (item: FeedItem) => {
    if (!isAuthenticated) {
      toast({ title: 'Faça login para curtir', variant: 'destructive' });
      return;
    }
    await supabase
      .from('trader_social_feed')
      .update({ likes_count: item.likes_count + 1 })
      .eq('id', item.id);
    setFeed(prev => prev.map(f => f.id === item.id ? { ...f, likes_count: f.likes_count + 1 } : f));
  };

  const handleCopy = async (item: FeedItem) => {
    if (!isAuthenticated) {
      toast({ title: 'Faça login para copiar trades', variant: 'destructive' });
      return;
    }
    onCopyTrade?.(item.trade_type as 'long' | 'short', item.asset_symbol);
    await supabase
      .from('trader_social_feed')
      .update({ copies_count: item.copies_count + 1 })
      .eq('id', item.id);
    setFeed(prev => prev.map(f => f.id === item.id ? { ...f, copies_count: f.copies_count + 1 } : f));
    toast({ title: `📋 Trade copiado: ${item.trade_type.toUpperCase()} ${item.asset_symbol}` });
  };

  return (
    <div className="bg-[#111111] border border-amber-900/30 rounded-xl p-4">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between"
      >
        <h3 className="font-orbitron text-xs font-bold text-amber-400/80 uppercase flex items-center gap-2">
          <Users className="w-4 h-4" />
          Social Feed
          {feed.length > 0 && (
            <span className="bg-amber-500/20 text-amber-400 text-[10px] px-1.5 py-0.5 rounded-full">{feed.length}</span>
          )}
        </h3>
        {expanded ? <ChevronUp className="w-4 h-4 text-white/40" /> : <ChevronDown className="w-4 h-4 text-white/40" />}
      </button>

      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden"
          >
            {feed.length === 0 ? (
              <div className="mt-3 text-center py-6">
                <Users className="w-8 h-8 text-white/10 mx-auto mb-2" />
                <p className="text-xs text-white/30">Nenhum trade público ainda.</p>
                <p className="text-[10px] text-white/20 mt-1">Compartilhe seus trades para aparecer aqui!</p>
              </div>
            ) : (
              <div className="mt-3 space-y-2 max-h-72 overflow-y-auto">
                {feed.map((item) => (
                  <motion.div
                    key={item.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="bg-black/30 rounded-lg px-3 py-2 border border-white/5"
                  >
                    <div className="flex items-center justify-between mb-1">
                      <div className="flex items-center gap-2">
                        <div className="w-6 h-6 rounded-full bg-gradient-to-br from-amber-500/30 to-amber-700/30 flex items-center justify-center">
                          <span className="text-[10px] font-bold text-amber-400">{item.username.charAt(0).toUpperCase()}</span>
                        </div>
                        <span className="text-xs font-bold text-white/80">{item.username}</span>
                      </div>
                      <span className="text-[10px] text-white/30">
                        {new Date(item.created_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>

                    <div className="flex items-center gap-2 mb-1">
                      {item.pnl >= 0
                        ? <TrendingUp className="w-3.5 h-3.5 text-cyan-400" />
                        : <TrendingDown className="w-3.5 h-3.5 text-red-400" />
                      }
                      <span className="text-xs text-white/60">{item.trade_type.toUpperCase()} {item.asset_symbol}</span>
                      {item.leverage > 1 && <span className="text-[10px] text-amber-400/50">{item.leverage}x</span>}
                      <span className={`text-xs font-mono font-bold ml-auto ${item.pnl >= 0 ? 'text-cyan-400' : 'text-red-400'}`}>
                        {item.pnl >= 0 ? '+' : ''}{item.pnl.toLocaleString()} BC
                        <span className="text-[10px] opacity-60 ml-1">({item.pnl_percent >= 0 ? '+' : ''}{Number(item.pnl_percent).toFixed(1)}%)</span>
                      </span>
                    </div>

                    {item.comment && (
                      <p className="text-[11px] text-white/40 italic mb-2">"{item.comment}"</p>
                    )}

                    <div className="flex items-center gap-3 pt-1 border-t border-white/5">
                      <button
                        onClick={() => handleLike(item)}
                        className="flex items-center gap-1 text-[10px] text-white/30 hover:text-red-400 transition-colors"
                      >
                        <Heart className="w-3 h-3" />
                        {item.likes_count}
                      </button>
                      <button
                        onClick={() => handleCopy(item)}
                        className="flex items-center gap-1 text-[10px] text-white/30 hover:text-cyan-400 transition-colors"
                      >
                        <Copy className="w-3 h-3" />
                        {item.copies_count}
                      </button>
                    </div>
                  </motion.div>
                ))}
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
