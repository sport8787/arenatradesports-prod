import { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowLeft, BarChart3, Volume2, VolumeX, Trophy, Share2, BookOpen } from 'lucide-react';
import WhatsAppSupportButton from '@/components/WhatsAppSupportButton';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from '@/hooks/use-toast';
import CandlestickChart from '@/components/arena-trader/CandlestickChart';
import MycroftTraderPanel from '@/components/arena-trader/MycroftTraderPanel';
import HorusTraderVoice from '@/components/arena-trader/HorusTraderVoice';
import AssetSelector from '@/components/arena-trader/AssetSelector';
import TradePanel from '@/components/arena-trader/TradePanel';
import TraderBalanceHeader from '@/components/arena-trader/TraderBalanceHeader';
// SimulationControls removed — real data only
import IndicatorToggles from '@/components/arena-trader/IndicatorToggles';
import MilharPressureMeter from '@/components/arena-trader/MilharPressureMeter';
import MarketEventOverlay, { type MarketEvent } from '@/components/arena-trader/MarketEventOverlay';
import StressLevelIndicator from '@/components/arena-trader/StressLevelIndicator';
import AchievementsPanel from '@/components/arena-trader/AchievementsPanel';
import AchievementToast from '@/components/arena-trader/AchievementToast';
import DailyChallengesPanel from '@/components/arena-trader/DailyChallengesPanel';
import PortfolioPanel from '@/components/arena-trader/PortfolioPanel';
import SessionReplayPanel from '@/components/arena-trader/SessionReplayPanel';
import SocialFeedPanel from '@/components/arena-trader/SocialFeedPanel';
import MycroftAnalystChat from '@/components/arena-trader/MycroftAnalystChat';
import { useMarketEvents } from '@/hooks/useMarketEvents';
import { useLivePrices } from '@/hooks/useLivePrices';
import { calculateSMA, calculateBollingerBands, calculateRSI } from '@/lib/technicalIndicators';
import { checkAchievements, type Achievement, type TraderStats } from '@/services/traderAchievementsService';
import { AlertTriangle } from 'lucide-react';

export interface Asset {
  id: string;
  name: string;
  symbol: string;
  basePrice: number;
  volatility: number;
  category: 'crypto' | 'stock' | 'futures';
  pointValue?: number; // R$ per point (futures only)
  tickerPrefix?: string; // For dynamic ticker (e.g. 'WIN', 'WDO')
  contractValue?: number; // Units per contract (e.g. 100 shares for stocks, 1 for BTC/futures)
}

export const ASSETS: Asset[] = [
  { id: 'btc', name: 'Bitcoin', symbol: 'BTC', basePrice: 67500, volatility: 0.04, category: 'crypto', contractValue: 1 },
  { id: 'petr4', name: 'Petrobras', symbol: 'PETR4', basePrice: 38.50, volatility: 0.025, category: 'stock', contractValue: 100 },
  { id: 'vale3', name: 'Vale', symbol: 'VALE3', basePrice: 62.80, volatility: 0.03, category: 'stock', contractValue: 100 },
  { id: 'itub4', name: 'Itaú', symbol: 'ITUB4', basePrice: 34.20, volatility: 0.02, category: 'stock', contractValue: 100 },
  { id: 'win', name: 'Mini Índice', symbol: 'WIN', basePrice: 131000, volatility: 0.008, category: 'futures', pointValue: 0.20, tickerPrefix: 'WIN', contractValue: 1 },
  { id: 'wdo', name: 'Mini Dólar', symbol: 'WDO', basePrice: 5650, volatility: 0.006, category: 'futures', pointValue: 10.00, tickerPrefix: 'WDO', contractValue: 1 },
];

export interface Candle {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export interface TradePosition {
  type: 'long' | 'short';
  asset: Asset;
  entryPrice: number;
  amount: number;
  timestamp: number;
  stopLoss?: number;
  takeProfit?: number;
  leverage?: number;
  snapshotId?: string; // DB snapshot ID
  partialConfig?: {
    enabled: boolean;
    tp1Percent: number;
    tp2Percent: number;
    tp1ClosePercent: number;
  };
  tp1Hit?: boolean; // Track if TP1 was already triggered
}

// No more generateCandles — real data only

// Real data mode — no speed intervals needed

export default function ArenaTrader() {
  const navigate = useNavigate();
  const { profile, isAuthenticated } = useAuth();
  const [balance, setBalance] = useState(500000);
  const [initialBalance] = useState(500000);
  const [selectedAsset, setSelectedAsset] = useState<Asset>(ASSETS[0]);
  const [timeframe, setTimeframe] = useState<'5m' | '15m' | '30m' | '1h'>('15m');
  const [candles, setCandles] = useState<Candle[]>([]);
  // Multiple positions support
  const [positions, setPositions] = useState<TradePosition[]>([]);
  const [marketOpen, setMarketOpen] = useState(true);
  const [marketNextOpen, setMarketNextOpen] = useState<string | null>(null);
  const [loadingCandles, setLoadingCandles] = useState(false);
  const [mycroftAnalysis, setMycroftAnalysis] = useState<any>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [horusMessage, setHorusMessage] = useState('');
  const [horusMuted, setHorusMuted] = useState(false);
  const [tradeHistory, setTradeHistory] = useState<{ pnl: number; asset: string; type: string }[]>([]);
  const [bankrollWarningShown, setBankrollWarningShown] = useState(false);
  // speed state removed — real data mode
  const [paused, setPaused] = useState(false);
  const [indicators, setIndicators] = useState({ sma9: false, sma21: false, bollinger: false, rsi: false });
  const [marketEvent, setMarketEvent] = useState<MarketEvent | null>(null);
  const [stressLevel, setStressLevel] = useState<'Baixo' | 'Médio' | 'Crítico'>('Baixo');
  const [predictionHistory, setPredictionHistory] = useState<{ timestamp: number; asset: string; prediction: string; priceAtPrediction: number; correct?: boolean }[]>([]);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const { tryTriggerEvent, applyEventToCandles } = useMarketEvents();
  const { prices: livePrices, isLive, getPriceDirection } = useLivePrices(15000); // 15s for real-time crypto
  const [unlockedAchievements, setUnlockedAchievements] = useState<string[]>([]);
  const [achievementToast, setAchievementToast] = useState<Achievement | null>(null);
  const [maxDrawdown, setMaxDrawdown] = useState(0);
  const [winStreak, setWinStreak] = useState(0);
  const [leverageHistory, setLeverageHistory] = useState<number[]>([]);
  const [sessionId] = useState(() => crypto.randomUUID());
  const [showKBChat, setShowKBChat] = useState(false);

  // Current position for the selected asset (for TradePanel compatibility)
  const position = positions.find(p => p.asset.symbol === selectedAsset.symbol) || null;

  // Current prices map for portfolio
  const currentPrices: Record<string, number> = {};
  ASSETS.forEach(a => {
    if (a.symbol === selectedAsset.symbol && candles.length > 0) {
      currentPrices[a.symbol] = candles[candles.length - 1].close;
    } else if (livePrices[a.symbol]?.price) {
      currentPrices[a.symbol] = livePrices[a.symbol].price;
    } else {
      currentPrices[a.symbol] = a.basePrice;
    }
  });

  // Load balance from DB
  useEffect(() => {
    const loadBalance = async () => {
      if (!isAuthenticated || !profile) return;
      try {
        const { data, error } = await supabase.rpc('get_trader_balance', {
          p_user_id: profile.user_id,
        });
        if (!error && data !== null) {
          setBalance(data);
        }
      } catch (e) {
        console.error('Error loading trader balance:', e);
      }
    };
    loadBalance();
  }, [isAuthenticated, profile]);

  // Restore open positions from DB on page load
  useEffect(() => {
    const restorePositions = async () => {
      if (!isAuthenticated || !profile) return;
      try {
        const { data: openSnaps, error } = await supabase
          .from('trader_session_snapshots')
          .select('*')
          .eq('user_id', profile.user_id)
          .eq('status', 'open')
          .order('opened_at', { ascending: true });

        if (error || !openSnaps || openSnaps.length === 0) return;

        const restored: TradePosition[] = [];
        for (const snap of openSnaps) {
          const asset = ASSETS.find(a => a.symbol === snap.asset_symbol);
          if (!asset) continue;
          // Skip if we already have a position on this asset
          if (restored.find(p => p.asset.symbol === asset.symbol)) continue;

          restored.push({
            type: snap.trade_type as 'long' | 'short',
            asset,
            entryPrice: Number(snap.entry_price),
            amount: snap.amount,
            timestamp: new Date(snap.opened_at).getTime(),
            stopLoss: snap.stop_loss ? Number(snap.stop_loss) : undefined,
            takeProfit: snap.take_profit ? Number(snap.take_profit) : undefined,
            leverage: snap.leverage || 1,
            snapshotId: snap.id,
            tp1Hit: false,
          });
        }

        if (restored.length > 0) {
          setPositions(restored);
          // Deduct amounts from balance to avoid double-counting
          const totalLocked = restored.reduce((s, p) => s + p.amount, 0);
          setBalance(prev => prev - totalLocked);
          toast({ title: `🔄 ${restored.length} posição(ões) restaurada(s)` });
          console.log(`[ArenaTrader] Restored ${restored.length} open positions from DB`);
        }
      } catch (e) {
        console.error('Error restoring positions:', e);
      }
    };
    restorePositions();
  }, [isAuthenticated, profile]);

  // Fetch REAL candles from API
  const fetchRealCandles = useCallback(async (asset: Asset) => {
    setLoadingCandles(true);
    try {
      const { data, error } = await supabase.functions.invoke('fetch-historical-candles', {
        body: { symbol: asset.symbol, category: asset.category, timeframe },
      });
      if (error) throw error;

      if (data?.candles && data.candles.length > 0) {
        setCandles(data.candles);
      }
      if (data?.marketStatus) {
        setMarketOpen(data.marketStatus.open);
        setMarketNextOpen(data.marketStatus.nextOpen || null);
        if (!data.marketStatus.open) {
          setPaused(true);
        }
      }
    } catch (e) {
      console.error('Error fetching real candles:', e);
      // Fallback: use live price as single candle
      const livePrice = livePrices[asset.symbol]?.price || asset.basePrice;
      setCandles([{
        time: Date.now(),
        open: livePrice,
        high: livePrice * 1.001,
        low: livePrice * 0.999,
        close: livePrice,
        volume: 100000,
      }]);
    } finally {
      setLoadingCandles(false);
    }
  }, [livePrices, timeframe]);

  // Load real candles on asset or timeframe change
  useEffect(() => {
    fetchRealCandles(selectedAsset);
  }, [selectedAsset, timeframe]);

  // Refresh candles periodically (every 60s) when market is open
  useEffect(() => {
    if (!marketOpen || paused) {
      if (intervalRef.current) clearInterval(intervalRef.current);
      return;
    }

    intervalRef.current = setInterval(() => {
      fetchRealCandles(selectedAsset);
    }, 60000); // Refresh real data every 60s

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [selectedAsset, marketOpen, paused, fetchRealCandles]);

  // Keep chart alive: update last candle OR create new candles with live price
  useEffect(() => {
    const livePrice = livePrices[selectedAsset.symbol]?.price;
    if (!livePrice || candles.length === 0 || !marketOpen) return;

    setCandles(prev => {
      const updated = [...prev];
      const lastCandle = updated[updated.length - 1];
      const now = Date.now();
      const candleIntervalMap = { '5m': 5 * 60 * 1000, '15m': 15 * 60 * 1000, '30m': 30 * 60 * 1000, '1h': 60 * 60 * 1000 };
      const candleInterval = candleIntervalMap[timeframe] || 30 * 60 * 1000;
      const timeSinceLastCandle = now - lastCandle.time;

      if (timeSinceLastCandle > candleInterval) {
        // Create a new candle — the previous one is "closed"
        const newCandle = {
          time: lastCandle.time + candleInterval,
          open: lastCandle.close,
          high: Math.max(lastCandle.close, livePrice),
          low: Math.min(lastCandle.close, livePrice),
          close: livePrice,
          volume: Math.floor(Math.random() * 300000) + 100000,
        };
        updated.push(newCandle);
        // Keep max 60 candles to avoid memory bloat
        if (updated.length > 60) updated.shift();
      } else {
        // Update current candle with live tick
        const last = { ...updated[updated.length - 1] };
        last.close = livePrice;
        last.high = Math.max(last.high, livePrice);
        last.low = Math.min(last.low, livePrice);
        updated[updated.length - 1] = last;
      }
      return updated;
    });
  }, [livePrices, selectedAsset.symbol, marketOpen, timeframe]);

  // Check SL/TP/Liquidation auto-close for ALL positions
  useEffect(() => {
    if (positions.length === 0 || candles.length === 0) return;

    // Collect actions to execute after the loop to avoid stale state issues
    const autoCloseQueue: { index: number; price: number; reason: string }[] = [];
    const tp1Queue: { index: number; price: number }[] = [];
    const liquidationQueue: number[] = [];

    positions.forEach((pos, index) => {
      const price = pos.asset.symbol === selectedAsset.symbol
        ? candles[candles.length - 1].close
        : (livePrices[pos.asset.symbol]?.price || pos.entryPrice);

      const leverage = pos.leverage || 1;

      // Liquidation check
      if (leverage > 1) {
        const priceChange = (price - pos.entryPrice) / pos.entryPrice;
        const leveragedChange = priceChange * leverage;
        const isLiquidated = pos.type === 'long' ? leveragedChange <= -1 : -leveragedChange <= -1;
        if (isLiquidated) {
          liquidationQueue.push(index);
          return;
        }
      }

      // Stop Loss
      if (pos.stopLoss) {
        const hitSL = pos.type === 'long' ? price <= pos.stopLoss : price >= pos.stopLoss;
        if (hitSL) {
          autoCloseQueue.push({ index, price: pos.stopLoss, reason: 'SL' });
          return;
        }
      }

      // TP1 Partial close check
      if (pos.partialConfig?.enabled && !pos.tp1Hit) {
        const tp1Price = pos.type === 'long'
          ? pos.entryPrice * (1 + pos.partialConfig.tp1Percent / 100)
          : pos.entryPrice * (1 - pos.partialConfig.tp1Percent / 100);
        const hitTP1 = pos.type === 'long' ? price >= tp1Price : price <= tp1Price;
        if (hitTP1) {
          tp1Queue.push({ index, price });
          return;
        }
      }

      // Take Profit (TP2 or simple TP)
      if (pos.takeProfit) {
        const hitTP = pos.type === 'long' ? price >= pos.takeProfit : price <= pos.takeProfit;
        if (hitTP) {
          autoCloseQueue.push({ index, price: pos.takeProfit, reason: 'TP' });
          return;
        }
      }
    });

    // Process liquidations
    if (liquidationQueue.length > 0) {
      liquidationQueue.forEach(idx => {
        const pos = positions[idx];
        setHorusMessage(`💀 LIQUIDAÇÃO FORÇADA em ${pos.asset.symbol}! ${pos.leverage}x sem proteção...`);
        setTradeHistory(prev => [...prev, { pnl: -pos.amount, asset: pos.asset.symbol, type: pos.type }]);
        if (isAuthenticated && profile) {
          supabase.rpc('update_trader_balance', { p_user_id: profile.user_id, p_amount: -pos.amount, p_is_win: false });
        }
        toast({ title: `💀 Liquidado! -${pos.amount.toLocaleString()} BC`, variant: 'destructive' });
      });
      setPositions(prev => prev.filter((_, i) => !liquidationQueue.includes(i)));
    }

    // Process TP1 partial closes
    if (tp1Queue.length > 0) {
      tp1Queue.forEach(({ index, price }) => {
        const pos = positions[index];
        if (!pos.partialConfig) return;
        const closePercent = pos.partialConfig.tp1ClosePercent;
        const closeAmount = Math.floor(pos.amount * closePercent / 100);
        const pnl = pos.type === 'long'
          ? Math.floor(closeAmount * ((price - pos.entryPrice) / pos.entryPrice) * (pos.leverage || 1))
          : Math.floor(closeAmount * -((price - pos.entryPrice) / pos.entryPrice) * (pos.leverage || 1));
        setBalance(prev => prev + closeAmount + pnl);
        setTradeHistory(prev => [...prev, { pnl, asset: pos.asset.symbol, type: pos.type }]);
        toast({ title: `🎯 TP1 atingido! ${closePercent}% fechado (+${pnl.toLocaleString()} BC)` });
        setHorusMessage(`🎯 Alvo 1 em ${pos.asset.symbol}! Fechei ${closePercent}% com lucro. O resto segue até o TP2.`);
      });
      const tp1Indices = new Set(tp1Queue.map(t => t.index));
      setPositions(prev => prev.map((p, i) => {
        if (!tp1Indices.has(i) || !p.partialConfig) return p;
        const closeAmount = Math.floor(p.amount * p.partialConfig.tp1ClosePercent / 100);
        return { ...p, amount: p.amount - closeAmount, tp1Hit: true };
      }));
    }

    // Process SL/TP auto-closes
    if (autoCloseQueue.length > 0) {
      autoCloseQueue.forEach(({ index, price, reason }) => {
        const pos = positions[index];
        const leverage = pos.leverage || 1;
        const priceChange = (price - pos.entryPrice) / pos.entryPrice;
        const leveragedChange = priceChange * leverage;
        const pnl = pos.type === 'long'
          ? Math.floor(pos.amount * leveragedChange)
          : Math.floor(pos.amount * -leveragedChange);
        const isWin = pnl > 0;

        setBalance(prev => prev + pos.amount + pnl);
        setTradeHistory(prev => [...prev, { pnl, asset: pos.asset.symbol, type: pos.type }]);

        if (isAuthenticated && profile) {
          supabase.rpc('update_trader_balance', { p_user_id: profile.user_id, p_amount: pnl, p_is_win: isWin });
          if (pos.snapshotId) {
            supabase.from('trader_session_snapshots').update({
              exit_price: price, pnl, closed_at: new Date().toISOString(), status: 'closed',
            }).eq('id', pos.snapshotId);
          }
        }

        const emoji = reason === 'SL' ? '⛔' : '🎯';
        const label = reason === 'SL' ? 'Stop Loss' : 'Take Profit';
        toast({
          title: `${emoji} ${label} ${isWin ? '+' : ''}${pnl.toLocaleString()} BC`,
          description: `${pos.type.toUpperCase()} ${pos.asset.symbol} fechado automaticamente`,
          variant: isWin ? 'default' : 'destructive',
        });
        setHorusMessage(
          reason === 'SL'
            ? `⛔ Stop Loss bateu em ${pos.asset.symbol}. Pelo menos você não virou holder involuntário.`
            : `🎯 Take Profit em ${pos.asset.symbol}! Lucro garantido. Disciplina é poder.`
        );
      });
      const closeIndices = new Set(autoCloseQueue.map(q => q.index));
      setPositions(prev => prev.filter((_, i) => !closeIndices.has(i)));
    }
  }, [candles, positions, livePrices, selectedAsset, isAuthenticated, profile]);

  // Bankroll warning
  useEffect(() => {
    if (!bankrollWarningShown && balance <= initialBalance * 0.9 && balance < initialBalance) {
      setBankrollWarningShown(true);
      setHorusMessage('Sua banca caiu 10%... Gestão de bankroll, meu caro.');
    }
  }, [balance, initialBalance, bankrollWarningShown]);

  // Track max drawdown
  useEffect(() => {
    const drawdownPct = ((initialBalance - balance) / initialBalance) * 100;
    if (drawdownPct > maxDrawdown) setMaxDrawdown(drawdownPct);
  }, [balance, initialBalance, maxDrawdown]);

  // Check achievements after trades
  useEffect(() => {
    if (tradeHistory.length === 0) return;
    let streak = 0;
    for (let i = tradeHistory.length - 1; i >= 0; i--) {
      if (tradeHistory[i].pnl > 0) streak++;
      else break;
    }
    setWinStreak(streak);

    const stats: TraderStats = {
      totalTrades: tradeHistory.length,
      winningTrades: tradeHistory.filter(t => t.pnl > 0).length,
      losingTrades: tradeHistory.filter(t => t.pnl <= 0).length,
      balance,
      initialBalance,
      bestTrade: Math.max(...tradeHistory.map(t => t.pnl)),
      worstTrade: Math.min(...tradeHistory.map(t => t.pnl)),
      totalPnl: tradeHistory.reduce((s, t) => s + t.pnl, 0),
      currentStreak: streak,
      maxDrawdown,
      leverageUsed: leverageHistory,
      tradeHistory,
    };

    const newAchievements = checkAchievements(stats, unlockedAchievements);
    if (newAchievements.length > 0) {
      const newIds = newAchievements.map(a => a.id);
      setUnlockedAchievements(prev => [...prev, ...newIds]);
      setAchievementToast(newAchievements[0]);
      toast({ title: `🏆 ${newAchievements[0].name}`, description: newAchievements[0].description });
    }
  }, [tradeHistory, balance]);

  const currentPrice = candles.length > 0 ? candles[candles.length - 1].close : selectedAsset.basePrice;

  // Total unrealized PnL across all positions
  const totalUnrealizedPnl = positions.reduce((sum, pos) => {
    const price = currentPrices[pos.asset.symbol] || pos.entryPrice;
    const leverage = pos.leverage || 1;
    const change = (price - pos.entryPrice) / pos.entryPrice;
    const leveragedChange = change * leverage;
    const pnl = pos.type === 'long'
      ? Math.floor(pos.amount * leveragedChange)
      : Math.floor(pos.amount * -leveragedChange);
    return sum + pnl;
  }, 0);

  // Unrealized PnL for current asset position only (for TradePanel)
  const unrealizedPnl = position
    ? (() => {
        const leverage = position.leverage || 1;
        const priceChange = (currentPrice - position.entryPrice) / position.entryPrice;
        const leveragedChange = priceChange * leverage;
        return position.type === 'long'
          ? Math.floor(position.amount * leveragedChange)
          : Math.floor(position.amount * -leveragedChange);
      })()
    : 0;

  const requestAnalysis = useCallback(async () => {
    setIsAnalyzing(true);
    try {
      const recentCandles = candles.slice(-20);

      // Pre-compute technical indicators to send to Mycroft
      const sma9 = calculateSMA(candles, 9);
      const sma21 = calculateSMA(candles, 21);
      const bb = calculateBollingerBands(candles, 20);
      const rsi = calculateRSI(candles, 14);
      const lastIdx = candles.length - 1;

      const technicalData = {
        sma9: sma9[lastIdx] ?? null,
        sma21: sma21[lastIdx] ?? null,
        bollingerUpper: bb[lastIdx]?.upper ?? null,
        bollingerLower: bb[lastIdx]?.lower ?? null,
        rsi: rsi[lastIdx] ?? null,
      };

      const change24h = livePrices[selectedAsset.symbol]?.change24h ?? 0;

      // Cross-asset correlation data for futures
      const crossAssetData = selectedAsset.category === 'futures' ? {
        winPrice: livePrices['WIN']?.price ?? null,
        wdoPrice: livePrices['WDO']?.price ?? null,
        winChange: livePrices['WIN']?.change24h ?? null,
        wdoChange: livePrices['WDO']?.change24h ?? null,
      } : null;

      const { data, error } = await supabase.functions.invoke('arena-trader-analyze', {
        body: {
          asset: selectedAsset,
          candles: recentCandles,
          currentPrice,
          balance,
          position,
          technicalData,
          isLive,
          change24h,
          crossAssetData,
        },
      });
      if (error) throw error;
      const mycroft = data?.mycroft || null;
      setMycroftAnalysis(mycroft);
      if (data?.horus) setHorusMessage(data.horus);
      if (mycroft?.alertaEstresse) {
        setStressLevel(mycroft.alertaEstresse as 'Baixo' | 'Médio' | 'Crítico');
      }
      if (mycroft?.statusMercado) {
        setPredictionHistory(prev => [...prev.slice(-20), {
          timestamp: Date.now(),
          asset: selectedAsset.symbol,
          prediction: mycroft.statusMercado,
          priceAtPrediction: currentPrice,
        }]);
      }
    } catch (e) {
      console.error('Analysis error:', e);
      setMycroftAnalysis({
        support: +(currentPrice * 0.97).toFixed(2),
        resistance: +(currentPrice * 1.03).toFixed(2),
        trend: Math.random() > 0.5 ? 'bullish' : 'bearish',
        verdict: `${selectedAsset.symbol} apresenta volatilidade moderada.`,
        riskLevel: Math.floor(Math.random() * 5) + 4,
        confluenciaScore: 0,
        indicadoresConfirmados: [],
        statusInstitucional: 'NEUTRO',
        proveniencia: 'SIMULADO',
        confiancaAnalise: 30,
      });
    } finally {
      setIsAnalyzing(false);
    }
  }, [candles, selectedAsset, currentPrice, balance, position, livePrices, isLive]);

  useEffect(() => {
    if (candles.length > 10) {
      const timeout = setTimeout(requestAnalysis, 1000);
      return () => clearTimeout(timeout);
    }
  }, [selectedAsset]);

  const openPosition = async (type: 'long' | 'short', amount: number, stopLoss?: number, takeProfit?: number, leverage = 1, partialCfg?: { enabled: boolean; tp1Percent: number; tp2Percent: number; tp1ClosePercent: number }) => {
    if (amount > balance) {
      toast({ title: 'Saldo insuficiente', variant: 'destructive' });
      return;
    }
    // Check if already has position on this asset
    if (positions.find(p => p.asset.symbol === selectedAsset.symbol)) {
      toast({ title: 'Já existe posição neste ativo. Feche primeiro.', variant: 'destructive' });
      return;
    }

    // Save snapshot to DB
    let snapshotId: string | undefined;
    if (isAuthenticated && profile) {
      try {
        const { data: snap } = await supabase.from('trader_session_snapshots').insert({
          user_id: profile.user_id,
          session_id: sessionId,
          trade_type: type,
          asset_symbol: selectedAsset.symbol,
          entry_price: currentPrice,
          amount,
          leverage,
          stop_loss: stopLoss || null,
          take_profit: takeProfit || null,
          candles_snapshot: JSON.parse(JSON.stringify(candles.slice(-10))),
          mycroft_analysis: mycroftAnalysis ? JSON.parse(JSON.stringify(mycroftAnalysis)) : null,
          horus_message: horusMessage || null,
          status: 'open',
        }).select('id').single();
        snapshotId = snap?.id;
      } catch (e) {
        console.error('Error saving snapshot:', e);
      }
    }

    const newPos: TradePosition = {
      type, asset: selectedAsset, entryPrice: currentPrice, amount,
      timestamp: Date.now(), stopLoss, takeProfit, leverage, snapshotId,
      partialConfig: partialCfg, tp1Hit: false,
    };

    setPositions(prev => [...prev, newPos]);
    setBalance(prev => prev - amount);
    if (leverage > 1) setLeverageHistory(prev => [...prev, leverage]);

    const leverageMsg = leverage > 1 ? ` com ${leverage}x de alavancagem` : '';
    const multiMsg = positions.length > 0 ? ` Agora são ${positions.length + 1} posições abertas.` : '';
    const slDist = stopLoss ? Math.abs((currentPrice - stopLoss) / currentPrice * 100).toFixed(1) : '?';
    const tpDist = takeProfit ? Math.abs((takeProfit - currentPrice) / currentPrice * 100).toFixed(1) : '?';
    const rrRatio = (stopLoss && takeProfit) ? (Math.abs(takeProfit - currentPrice) / Math.abs(currentPrice - stopLoss)).toFixed(1) : '?';
    setHorusMessage(
      type === 'long'
        ? `Comprado em ${selectedAsset.symbol}${leverageMsg}! SL: -${slDist}% | TP: +${tpDist}% | R:R 1:${rrRatio}.${multiMsg} Vamos ver se você tem estômago.`
        : `Short em ${selectedAsset.symbol}${leverageMsg}! SL: -${slDist}% | TP: +${tpDist}% | R:R 1:${rrRatio}.${multiMsg} Audacioso.`
    );

    requestAnalysis();
  };

  const closePositionByIndex = async (index: number, priceOverride?: number) => {
    const pos = positions[index];
    if (!pos) return;

    const price = priceOverride || currentPrices[pos.asset.symbol] || pos.entryPrice;
    const leverage = pos.leverage || 1;
    const priceChange = (price - pos.entryPrice) / pos.entryPrice;
    const leveragedChange = priceChange * leverage;
    const pnl = pos.type === 'long'
      ? Math.floor(pos.amount * leveragedChange)
      : Math.floor(pos.amount * -leveragedChange);

    const newBalance = balance + pos.amount + pnl;
    setBalance(newBalance);

    const isWin = pnl > 0;
    setTradeHistory(prev => [...prev, { pnl, asset: pos.asset.symbol, type: pos.type }]);

    // Persist trade
    if (isAuthenticated && profile) {
      try {
        await supabase.rpc('update_trader_balance', { p_user_id: profile.user_id, p_amount: pnl, p_is_win: isWin });
        // Update snapshot
        if (pos.snapshotId) {
          await supabase.from('trader_session_snapshots').update({
            exit_price: price,
            pnl,
            closed_at: new Date().toISOString(),
            status: 'closed',
          }).eq('id', pos.snapshotId);
        }
      } catch (e) {
        console.error('Error persisting trade:', e);
      }
    }

    toast({
      title: isWin ? `📈 +${pnl.toLocaleString()} BC` : `📉 ${pnl.toLocaleString()} BC`,
      description: `${pos.type === 'long' ? 'Long' : 'Short'} ${pos.asset.symbol}${leverage > 1 ? ` (${leverage}x)` : ''} fechado`,
      variant: isWin ? 'default' : 'destructive',
    });

    setHorusMessage(
      isWin
        ? `Lucro de ${pnl.toLocaleString()} BC em ${pos.asset.symbol}! Nem todo mundo tem a coragem de fechar no verde.`
        : `Prejuízo de ${Math.abs(pnl).toLocaleString()} BC em ${pos.asset.symbol}. O mercado não perdoa hesitação.`
    );

    setPositions(prev => prev.filter((_, i) => i !== index));
  };

  const closePosition = async () => {
    const idx = positions.findIndex(p => p.asset.symbol === selectedAsset.symbol);
    if (idx === -1) return;
    await closePositionByIndex(idx);
  };

  // Invert position (close current + open opposite) — essential for day trade futures
  const invertPosition = async () => {
    const idx = positions.findIndex(p => p.asset.symbol === selectedAsset.symbol);
    if (idx === -1) return;
    const pos = positions[idx];
    const newType = pos.type === 'long' ? 'short' : 'long';
    await closePositionByIndex(idx);
    // Open opposite with same amount
    setTimeout(() => {
      openPosition(newType, pos.amount, pos.stopLoss, pos.takeProfit, pos.leverage);
      setHorusMessage(`🔄 Inversão executada! Agora ${newType.toUpperCase()} em ${selectedAsset.symbol}. Coragem ou loucura?`);
    }, 100);
  };

  // Partial close: close X% of current asset position manually
  const partialClosePosition = async (percent: number) => {
    const idx = positions.findIndex(p => p.asset.symbol === selectedAsset.symbol);
    if (idx === -1) return;
    const pos = positions[idx];
    const closeAmount = Math.floor(pos.amount * percent / 100);
    if (closeAmount <= 0) return;

    const price = currentPrice;
    const leverage = pos.leverage || 1;
    const priceChange = (price - pos.entryPrice) / pos.entryPrice;
    const leveragedChange = priceChange * leverage;
    const pnl = pos.type === 'long'
      ? Math.floor(closeAmount * leveragedChange)
      : Math.floor(closeAmount * -leveragedChange);

    setBalance(prev => prev + closeAmount + pnl);
    setTradeHistory(prev => [...prev, { pnl, asset: pos.asset.symbol, type: pos.type }]);

    const remaining = pos.amount - closeAmount;
    if (remaining <= 0) {
      // Fully closed
      setPositions(prev => prev.filter((_, i) => i !== idx));
    } else {
      setPositions(prev => prev.map((p, i) => i === idx ? { ...p, amount: remaining } : p));
    }

    toast({
      title: pnl >= 0 ? `📈 Parcial +${pnl.toLocaleString()} BC (${percent}%)` : `📉 Parcial ${pnl.toLocaleString()} BC (${percent}%)`,
      variant: pnl >= 0 ? 'default' : 'destructive',
    });
    setHorusMessage(`Saída parcial de ${percent}% em ${selectedAsset.symbol}. ${remaining > 0 ? 'O resto continua.' : 'Posição encerrada.'}`);
  };

  // Share trade to social feed
  const shareTradeToFeed = async (trade: { pnl: number; asset: string; type: string }, comment?: string) => {
    if (!isAuthenticated || !profile) {
      toast({ title: 'Faça login para compartilhar trades', variant: 'destructive' });
      return;
    }
    try {
      const lastClosed = tradeHistory[tradeHistory.length - 1];
      if (!lastClosed) return;

      await supabase.from('trader_social_feed').insert({
        user_id: profile.user_id,
        username: profile.username || 'Trader',
        trade_type: lastClosed.type,
        asset_symbol: lastClosed.asset,
        entry_price: currentPrice, // approximation
        exit_price: currentPrice,
        amount: 10000,
        leverage: 1,
        pnl: lastClosed.pnl,
        pnl_percent: (lastClosed.pnl / 10000) * 100,
        comment: comment || null,
      });
      toast({ title: '📤 Trade compartilhado no Social Feed!' });
    } catch (e) {
      console.error('Error sharing trade:', e);
    }
  };

  // Copy trade handler from social feed
  const handleCopyTrade = (type: 'long' | 'short', assetSymbol: string) => {
    const asset = ASSETS.find(a => a.symbol === assetSymbol);
    if (asset) {
      setSelectedAsset(asset);
      toast({ title: `Ativo selecionado: ${assetSymbol}. Abra a posição ${type.toUpperCase()}.` });
    }
  };

  const toggleIndicator = (key: 'sma9' | 'sma21' | 'bollinger' | 'rsi') => {
    setIndicators(prev => ({ ...prev, [key]: !prev[key] }));
  };

  return (
    <div className={`min-h-screen bg-[#0a0a0a] text-white ${stressLevel === 'Crítico' ? 'animate-pulse-subtle' : ''}`}>
      <MarketEventOverlay event={marketEvent} />
      <TraderBalanceHeader balance={balance} unrealizedPnl={totalUnrealizedPnl} />

      {/* Beta Notice */}
      <div className="pt-16 px-3 max-w-7xl mx-auto">
        <div className="mb-4 flex items-start gap-3 rounded-lg border border-amber-500/40 bg-amber-500/10 px-4 py-3">
          <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="text-sm font-mono font-semibold text-amber-300">
              🧪 BETA · resultados não auditados
            </p>
            <p className="text-xs font-mono text-amber-300/80 mt-1 leading-relaxed">
              Arena Trader Financeiro está em fase experimental. WIN, WDO e BTC ainda estão sendo calibrados — sem garantia de paridade com o Trader Sports. Resultados desta arena <strong>não entram na Liga Mycroft</strong>. Use por sua conta e risco.
            </p>
          </div>
        </div>
      </div>

      <div className="px-3 pb-4 max-w-7xl mx-auto">
        {/* Top Bar */}
        <div className="flex items-center justify-between mb-4">
          <button onClick={() => navigate('/lobby')} className="flex items-center gap-2 text-amber-400/80 hover:text-amber-400 transition-colors">
            <ArrowLeft className="w-5 h-5" />
            <span className="text-sm font-medium">Voltar</span>
          </button>

          <h1 className="font-orbitron text-lg font-bold text-transparent bg-clip-text bg-gradient-to-r from-amber-400 to-yellow-200 uppercase tracking-wider">
            Arena Trader
          </h1>

          <div className="flex items-center gap-2">
            <button onClick={() => setHorusMuted(!horusMuted)} className="p-2 rounded-lg hover:bg-white/5 transition-colors">
              {horusMuted ? <VolumeX className="w-5 h-5 text-amber-400/50" /> : <Volume2 className="w-5 h-5 text-amber-400" />}
            </button>
            <button onClick={() => navigate('/arena-trader/rankings')} className="p-2 rounded-lg hover:bg-white/5 transition-colors" title="Rankings">
              <Trophy className="w-5 h-5 text-amber-400" />
            </button>
            <WhatsAppSupportButton />
          </div>
        </div>

        {/* Asset Selector */}
        <AssetSelector
          assets={ASSETS}
          selectedAsset={selectedAsset}
          onSelect={(asset) => setSelectedAsset(asset)}
          currentPrice={currentPrice}
          livePrices={livePrices}
          isLive={isLive}
          getPriceDirection={getPriceDirection}
        />

        {/* Portfolio Panel (multi-positions) */}
        <div className="mt-2">
          <PortfolioPanel
            positions={positions}
            candles={{}}
            currentPrices={currentPrices}
            onClosePosition={closePositionByIndex}
          />
        </div>

        {/* Main Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mt-4">
          {/* Chart - 2 cols */}
          <div className="lg:col-span-2">
            {/* Market closed banner */}
            {!marketOpen && (
              <div className="flex items-center gap-2 mb-2 px-3 py-2 rounded-lg bg-amber-500/10 border border-amber-500/30">
                <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
                <span className="text-xs text-amber-400 font-medium">
                  MERCADO FECHADO — Gráfico pausado com dados reais do último pregão.
                  {marketNextOpen && ` Reabre: ${marketNextOpen}`}
                </span>
                <button
                  onClick={() => fetchRealCandles(selectedAsset)}
                  className="ml-auto text-[10px] px-2 py-1 rounded bg-amber-500/20 text-amber-400 hover:bg-amber-500/30 transition-colors"
                >
                  Atualizar
                </button>
              </div>
            )}

            <div className="flex items-center justify-between mb-2 flex-wrap gap-2">
              <div className="flex items-center gap-2">
                {marketOpen && (
                  <span className="flex items-center gap-1 text-[10px] text-emerald-400 font-bold uppercase tracking-wider">
                    <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                    LIVE
                  </span>
                )}
                {loadingCandles && (
                  <span className="text-[10px] text-amber-400/60 animate-pulse">Carregando...</span>
                )}
                {/* Timeframe Selector */}
                <div className="flex items-center gap-1 ml-2 bg-black/40 rounded-lg p-0.5 border border-amber-900/30">
                  {(['5m', '15m', '30m', '1h'] as const).map(tf => (
                    <button
                      key={tf}
                      onClick={() => setTimeframe(tf)}
                      className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider transition-all ${
                        timeframe === tf
                          ? 'bg-amber-500/30 text-amber-400 shadow-sm shadow-amber-500/20'
                          : 'text-white/40 hover:text-white/70 hover:bg-white/5'
                      }`}
                    >
                      {tf}
                    </button>
                  ))}
                </div>
              </div>
              <IndicatorToggles indicators={indicators} onToggle={toggleIndicator} />
            </div>

            <div className="bg-[#111111] border border-amber-900/30 rounded-xl p-3 h-[350px] lg:h-[450px]">
              <CandlestickChart
                candles={candles}
                asset={selectedAsset}
                position={position}
                support={mycroftAnalysis?.support}
                resistance={mycroftAnalysis?.resistance}
                stopLoss={position?.stopLoss}
                takeProfit={position?.takeProfit}
                indicators={indicators}
              />
            </div>

            {/* Milhar Pressure Meter (futures only) */}
            {selectedAsset.category === 'futures' && (
              <div className="mt-2">
                <MilharPressureMeter
                  currentPrice={currentPrice}
                  milharStep={selectedAsset.symbol === 'WIN' ? 1000 : 50}
                  symbol={selectedAsset.symbol}
                />
              </div>
            )}

            <TradePanel
              balance={balance}
              position={position}
              currentPrice={currentPrice}
              unrealizedPnl={unrealizedPnl}
              onOpenPosition={openPosition}
              onClosePosition={closePosition}
              onInvertPosition={selectedAsset.category === 'futures' ? invertPosition : undefined}
              onPartialClose={partialClosePosition}
              asset={selectedAsset}
            />

            {/* Share last trade button */}
            {tradeHistory.length > 0 && isAuthenticated && (
              <div className="mt-2 flex justify-end">
                <button
                  onClick={() => shareTradeToFeed(tradeHistory[tradeHistory.length - 1])}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-400 text-xs hover:bg-amber-500/20 transition-colors"
                >
                  <Share2 className="w-3.5 h-3.5" />
                  Compartilhar último trade
                </button>
              </div>
            )}
          </div>

          {/* Right Panel */}
          <div className="space-y-4">
            <StressLevelIndicator level={stressLevel} balance={balance} initialBalance={initialBalance} />

            <HorusTraderVoice message={horusMessage} muted={horusMuted} />

            <MycroftTraderPanel
              analysis={mycroftAnalysis}
              isAnalyzing={isAnalyzing}
              onRequestAnalysis={requestAnalysis}
              asset={selectedAsset}
              predictionHistory={predictionHistory}
            />

            {tradeHistory.length > 0 && (
              <div className="bg-[#111111] border border-amber-900/30 rounded-xl p-4">
                <h3 className="font-orbitron text-xs font-bold text-amber-400/80 uppercase mb-3 flex items-center gap-2">
                  <BarChart3 className="w-4 h-4" />
                  Histórico
                </h3>
                <div className="space-y-2 max-h-40 overflow-y-auto">
                  {tradeHistory.slice(-10).reverse().map((trade, i) => (
                    <div key={i} className="flex items-center justify-between text-xs py-1 border-b border-white/5 last:border-0">
                      <span className="text-white/60">{trade.type.toUpperCase()} {trade.asset}</span>
                      <span className={trade.pnl >= 0 ? 'text-emerald-400' : 'text-red-400'}>
                        {trade.pnl >= 0 ? '+' : ''}{trade.pnl.toLocaleString()} BC
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <SessionReplayPanel />

            <SocialFeedPanel onCopyTrade={handleCopyTrade} />

            <DailyChallengesPanel tradeHistory={tradeHistory} balance={balance} initialBalance={initialBalance} />

            <AchievementsPanel unlockedIds={unlockedAchievements} />

            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => navigate('/arena-trader/season')}
              className="w-full relative overflow-hidden bg-gradient-to-r from-amber-900/60 via-yellow-900/60 to-amber-900/60 border-2 border-amber-500/40 hover:border-amber-400 rounded-xl p-3 flex items-center gap-3 transition-all duration-300 hover:shadow-[0_6px_20px_rgba(245,158,11,0.3)] group"
            >
              <div className="absolute inset-0 bg-gradient-to-r from-transparent via-amber-500/10 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-700" />
              <div className="w-8 h-8 rounded-lg bg-amber-500/20 flex items-center justify-center">
                <Trophy className="w-4 h-4 text-amber-400" />
              </div>
              <span className="font-orbitron text-xs font-bold text-amber-400 uppercase tracking-wider">Modo Temporada</span>
            </motion.button>

            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => setShowKBChat(prev => !prev)}
              className={`w-full relative overflow-hidden border-2 rounded-xl p-3 flex items-center gap-3 transition-all duration-300 group ${
                showKBChat
                  ? 'bg-gradient-to-r from-amber-900/80 via-yellow-900/80 to-amber-900/80 border-amber-400 shadow-[0_6px_20px_rgba(245,158,11,0.3)]'
                  : 'bg-gradient-to-r from-amber-900/40 via-yellow-900/40 to-amber-900/40 border-amber-500/30 hover:border-amber-400 hover:shadow-[0_6px_20px_rgba(245,158,11,0.3)]'
              }`}
            >
              <div className="absolute inset-0 bg-gradient-to-r from-transparent via-amber-500/10 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-700" />
              <div className="w-8 h-8 rounded-lg bg-amber-500/20 flex items-center justify-center">
                <BookOpen className="w-4 h-4 text-amber-400" />
              </div>
              <div className="flex-1 text-left">
                <span className="font-orbitron text-xs font-bold text-amber-400 uppercase tracking-wider">Knowledge Base</span>
                <p className="text-[10px] text-white/50">Ensine o Mycroft com PDFs</p>
              </div>
            </motion.button>

            {/* Mycroft Analyst Chat - renders right below the KB button */}
            <AnimatePresence>
              {showKBChat && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  transition={{ duration: 0.3 }}
                >
                  <MycroftAnalystChat
                    marketData={{
                      asset: selectedAsset.name,
                      symbol: selectedAsset.symbol,
                      timeframe,
                      price: currentPrice,
                      sma9: calculateSMA(candles, 9)[candles.length - 1] ?? null,
                      sma21: calculateSMA(candles, 21)[candles.length - 1] ?? null,
                      rsi: calculateRSI(candles, 14)[candles.length - 1] ?? null,
                      bollingerUpper: calculateBollingerBands(candles, 20)[candles.length - 1]?.upper ?? null,
                      bollingerLower: calculateBollingerBands(candles, 20)[candles.length - 1]?.lower ?? null,
                      volume: candles.length > 0 ? candles[candles.length - 1].volume : undefined,
                      change24h: livePrices[selectedAsset.symbol]?.change24h,
                      isLive,
                    }}
                  />
                </motion.div>
              )}
            </AnimatePresence>

            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => navigate('/arena-poker')}
              className="w-full relative overflow-hidden bg-gradient-to-r from-amber-900/40 via-yellow-900/40 to-amber-900/40 border-2 border-amber-500/30 hover:border-amber-400 rounded-xl p-3 flex items-center gap-3 transition-all duration-300 hover:shadow-[0_6px_20px_rgba(245,158,11,0.3)] group"
            >
              <div className="absolute inset-0 bg-gradient-to-r from-transparent via-amber-500/10 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-700" />
              <div className="w-8 h-8 rounded-lg bg-amber-500/20 flex items-center justify-center">
                <BarChart3 className="w-4 h-4 text-amber-400" />
              </div>
              <span className="font-orbitron text-xs font-bold text-amber-400 uppercase tracking-wider">Arena Poker</span>
            </motion.button>
          </div>
        </div>
      </div>

      <AnimatePresence>
        {achievementToast && (
          <AchievementToast achievement={achievementToast} onClose={() => setAchievementToast(null)} />
        )}
      </AnimatePresence>
    </div>
  );
}
