import { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowLeft, BarChart3, Volume2, VolumeX, Trophy, Share2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from '@/hooks/use-toast';
import CandlestickChart from '@/components/arena-trader/CandlestickChart';
import MycroftTraderPanel from '@/components/arena-trader/MycroftTraderPanel';
import HorusTraderVoice from '@/components/arena-trader/HorusTraderVoice';
import AssetSelector from '@/components/arena-trader/AssetSelector';
import TradePanel from '@/components/arena-trader/TradePanel';
import TraderBalanceHeader from '@/components/arena-trader/TraderBalanceHeader';
import SimulationControls from '@/components/arena-trader/SimulationControls';
import IndicatorToggles from '@/components/arena-trader/IndicatorToggles';
import MarketEventOverlay, { type MarketEvent } from '@/components/arena-trader/MarketEventOverlay';
import StressLevelIndicator from '@/components/arena-trader/StressLevelIndicator';
import AchievementsPanel from '@/components/arena-trader/AchievementsPanel';
import AchievementToast from '@/components/arena-trader/AchievementToast';
import DailyChallengesPanel from '@/components/arena-trader/DailyChallengesPanel';
import PortfolioPanel from '@/components/arena-trader/PortfolioPanel';
import SessionReplayPanel from '@/components/arena-trader/SessionReplayPanel';
import SocialFeedPanel from '@/components/arena-trader/SocialFeedPanel';
import { useMarketEvents } from '@/hooks/useMarketEvents';
import { useLivePrices } from '@/hooks/useLivePrices';
import { checkAchievements, type Achievement, type TraderStats } from '@/services/traderAchievementsService';

export interface Asset {
  id: string;
  name: string;
  symbol: string;
  basePrice: number;
  volatility: number;
  category: 'crypto' | 'stock';
}

export const ASSETS: Asset[] = [
  { id: 'btc', name: 'Bitcoin', symbol: 'BTC', basePrice: 67500, volatility: 0.04, category: 'crypto' },
  { id: 'petr4', name: 'Petrobras', symbol: 'PETR4', basePrice: 38.50, volatility: 0.025, category: 'stock' },
  { id: 'vale3', name: 'Vale', symbol: 'VALE3', basePrice: 62.80, volatility: 0.03, category: 'stock' },
  { id: 'itub4', name: 'Itaú', symbol: 'ITUB4', basePrice: 34.20, volatility: 0.02, category: 'stock' },
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
}

function generateCandles(asset: Asset, count: number, startPrice?: number): Candle[] {
  const candles: Candle[] = [];
  let price = startPrice || asset.basePrice;
  const now = Date.now();

  for (let i = count; i >= 0; i--) {
    const change = (Math.random() - 0.48) * asset.volatility * price;
    const open = price;
    const close = price + change;
    const high = Math.max(open, close) + Math.random() * asset.volatility * price * 0.5;
    const low = Math.min(open, close) - Math.random() * asset.volatility * price * 0.5;
    const volume = Math.floor(Math.random() * 1000000) + 100000;

    candles.push({
      time: now - i * 60000,
      open: +open.toFixed(2),
      high: +high.toFixed(2),
      low: +low.toFixed(2),
      close: +close.toFixed(2),
      volume,
    });

    price = close;
  }

  return candles;
}

const SPEED_INTERVALS: Record<number, number> = { 1: 3000, 2: 1500, 5: 600 };

export default function ArenaTrader() {
  const navigate = useNavigate();
  const { profile, isAuthenticated } = useAuth();
  const [balance, setBalance] = useState(500000);
  const [initialBalance] = useState(500000);
  const [selectedAsset, setSelectedAsset] = useState<Asset>(ASSETS[0]);
  const [candles, setCandles] = useState<Candle[]>([]);
  // Multiple positions support
  const [positions, setPositions] = useState<TradePosition[]>([]);
  const [mycroftAnalysis, setMycroftAnalysis] = useState<any>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [horusMessage, setHorusMessage] = useState('');
  const [horusMuted, setHorusMuted] = useState(false);
  const [tradeHistory, setTradeHistory] = useState<{ pnl: number; asset: string; type: string }[]>([]);
  const [bankrollWarningShown, setBankrollWarningShown] = useState(false);
  const [speed, setSpeed] = useState(1);
  const [paused, setPaused] = useState(false);
  const [indicators, setIndicators] = useState({ sma9: false, sma21: false, bollinger: false, rsi: false });
  const [marketEvent, setMarketEvent] = useState<MarketEvent | null>(null);
  const [stressLevel, setStressLevel] = useState<'Baixo' | 'Médio' | 'Crítico'>('Baixo');
  const [predictionHistory, setPredictionHistory] = useState<{ timestamp: number; asset: string; prediction: string; priceAtPrediction: number; correct?: boolean }[]>([]);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const { tryTriggerEvent, applyEventToCandles } = useMarketEvents();
  const { prices: livePrices, isLive, getPriceDirection } = useLivePrices(60000);
  const [unlockedAchievements, setUnlockedAchievements] = useState<string[]>([]);
  const [achievementToast, setAchievementToast] = useState<Achievement | null>(null);
  const [maxDrawdown, setMaxDrawdown] = useState(0);
  const [winStreak, setWinStreak] = useState(0);
  const [leverageHistory, setLeverageHistory] = useState<number[]>([]);
  const [sessionId] = useState(() => crypto.randomUUID());

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

  // Generate initial candles — seed with live price if available
  useEffect(() => {
    const livePrice = livePrices[selectedAsset.symbol]?.price;
    setCandles(generateCandles(selectedAsset, 50, livePrice));
  }, [selectedAsset, isLive]);

  // Tick candles based on speed and pause state
  useEffect(() => {
    if (paused) {
      if (intervalRef.current) clearInterval(intervalRef.current);
      return;
    }

    intervalRef.current = setInterval(() => {
      const eventResult = tryTriggerEvent();
      if (eventResult) {
        setMarketEvent(eventResult.event);
        setHorusMessage(eventResult.horusMessage);
        setCandles(prev => applyEventToCandles(prev, eventResult.event, selectedAsset));
        setTimeout(() => setMarketEvent(null), 5000);
        return;
      }

      setCandles(prev => {
        if (prev.length === 0) return prev;
        const lastCandle = prev[prev.length - 1];
        const change = (Math.random() - 0.48) * selectedAsset.volatility * lastCandle.close;
        const open = lastCandle.close;
        const close = open + change;
        const high = Math.max(open, close) + Math.random() * selectedAsset.volatility * open * 0.3;
        const low = Math.min(open, close) - Math.random() * selectedAsset.volatility * open * 0.3;

        const newCandle: Candle = {
          time: Date.now(),
          open: +open.toFixed(2),
          high: +high.toFixed(2),
          low: +low.toFixed(2),
          close: +close.toFixed(2),
          volume: Math.floor(Math.random() * 500000) + 50000,
        };

        return [...prev.slice(-60), newCandle];
      });
    }, SPEED_INTERVALS[speed] || 3000);

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [selectedAsset, speed, paused]);

  // Check SL/TP/Liquidation auto-close for ALL positions
  useEffect(() => {
    if (positions.length === 0 || candles.length === 0) return;

    const positionsToClose: number[] = [];

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
          setHorusMessage(`💀 LIQUIDAÇÃO FORÇADA em ${pos.asset.symbol}! ${leverage}x sem proteção...`);
          setTradeHistory(prev => [...prev, { pnl: -pos.amount, asset: pos.asset.symbol, type: pos.type }]);
          if (isAuthenticated && profile) {
            supabase.rpc('update_trader_balance', { p_user_id: profile.user_id, p_amount: -pos.amount, p_is_win: false });
          }
          toast({ title: `💀 Liquidado! -${pos.amount.toLocaleString()} BC`, variant: 'destructive' });
          positionsToClose.push(index);
          return;
        }
      }

      // Stop Loss
      if (pos.stopLoss) {
        const hitSL = pos.type === 'long' ? price <= pos.stopLoss : price >= pos.stopLoss;
        if (hitSL) {
          setHorusMessage(`⛔ Stop Loss acionado em ${pos.asset.symbol}!`);
          closePositionByIndex(index, price);
          return;
        }
      }

      // Take Profit
      if (pos.takeProfit) {
        const hitTP = pos.type === 'long' ? price >= pos.takeProfit : price <= pos.takeProfit;
        if (hitTP) {
          setHorusMessage(`🎯 Take Profit em ${pos.asset.symbol}! Lucro garantido.`);
          closePositionByIndex(index, price);
          return;
        }
      }
    });

    if (positionsToClose.length > 0) {
      setPositions(prev => prev.filter((_, i) => !positionsToClose.includes(i)));
    }
  }, [candles, positions]);

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
      const { data, error } = await supabase.functions.invoke('arena-trader-analyze', {
        body: { asset: selectedAsset, candles: recentCandles, currentPrice, balance, position },
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
      });
    } finally {
      setIsAnalyzing(false);
    }
  }, [candles, selectedAsset, currentPrice, balance, position]);

  useEffect(() => {
    if (candles.length > 10) {
      const timeout = setTimeout(requestAnalysis, 1000);
      return () => clearTimeout(timeout);
    }
  }, [selectedAsset]);

  const openPosition = async (type: 'long' | 'short', amount: number, stopLoss?: number, takeProfit?: number, leverage = 1) => {
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
    };

    setPositions(prev => [...prev, newPos]);
    setBalance(prev => prev - amount);
    if (leverage > 1) setLeverageHistory(prev => [...prev, leverage]);

    const leverageMsg = leverage > 1 ? ` com ${leverage}x de alavancagem` : '';
    const multiMsg = positions.length > 0 ? ` Agora são ${positions.length + 1} posições abertas.` : '';
    setHorusMessage(
      type === 'long'
        ? `Comprado em ${selectedAsset.symbol}${leverageMsg}!${multiMsg} Vamos ver se você tem estômago.`
        : `Short em ${selectedAsset.symbol}${leverageMsg}...${multiMsg} Audacioso.`
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

      <div className="pt-16 px-3 pb-4 max-w-7xl mx-auto">
        {/* Top Bar */}
        <div className="flex items-center justify-between mb-4">
          <button onClick={() => navigate(-1)} className="flex items-center gap-2 text-amber-400/80 hover:text-amber-400 transition-colors">
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
            <div className="flex items-center justify-between mb-2 flex-wrap gap-2">
              <SimulationControls speed={speed} onSpeedChange={setSpeed} paused={paused} onTogglePause={() => setPaused(!paused)} />
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

            <TradePanel
              balance={balance}
              position={position}
              currentPrice={currentPrice}
              unrealizedPnl={unrealizedPnl}
              onOpenPosition={openPosition}
              onClosePosition={closePosition}
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
