import { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowLeft, BarChart3, Volume2, VolumeX } from 'lucide-react';
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
import { useMarketEvents } from '@/hooks/useMarketEvents';

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
}

function generateCandles(asset: Asset, count: number): Candle[] {
  const candles: Candle[] = [];
  let price = asset.basePrice;
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
  const [position, setPosition] = useState<TradePosition | null>(null);
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

  // Generate initial candles
  useEffect(() => {
    setCandles(generateCandles(selectedAsset, 50));
  }, [selectedAsset]);

  // Tick candles based on speed and pause state
  useEffect(() => {
    if (paused) {
      if (intervalRef.current) clearInterval(intervalRef.current);
      return;
    }

    intervalRef.current = setInterval(() => {
      // Try triggering a market event
      const eventResult = tryTriggerEvent();
      if (eventResult) {
        setMarketEvent(eventResult.event);
        setHorusMessage(eventResult.horusMessage);
        setCandles(prev => applyEventToCandles(prev, eventResult.event, selectedAsset));
        // Clear event after 5 seconds
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

  // Check SL/TP/Liquidation auto-close
  useEffect(() => {
    if (!position || candles.length === 0) return;
    const price = candles[candles.length - 1].close;
    const leverage = position.leverage || 1;

    // Check liquidation (margin exceeded)
    if (leverage > 1) {
      const priceChange = (price - position.entryPrice) / position.entryPrice;
      const leveragedChange = priceChange * leverage;
      const isLiquidated = position.type === 'long' ? leveragedChange <= -1 : -leveragedChange <= -1;
      if (isLiquidated) {
        setHorusMessage(`💀 LIQUIDAÇÃO FORÇADA em ${position.asset.symbol}! ${leverage}x de alavancagem sem proteção... O mercado cobrou a conta. Sua margem evaporou.`);
        setTradeHistory(prev => [...prev, { pnl: -position.amount, asset: position.asset.symbol, type: position.type }]);
        if (isAuthenticated && profile) {
          supabase.rpc('update_trader_balance', { p_user_id: profile.user_id, p_amount: -position.amount, p_is_win: false });
        }
        toast({ title: `💀 Liquidado! -${position.amount.toLocaleString()} BC`, variant: 'destructive' });
        setPosition(null);
        return;
      }
    }

    if (position.stopLoss) {
      const hitSL = position.type === 'long' ? price <= position.stopLoss : price >= position.stopLoss;
      if (hitSL) {
        setHorusMessage(`⛔ Stop Loss acionado em ${position.asset.symbol}! O mercado não perdoa quem ignora a gestão de risco.`);
        closePosition();
        return;
      }
    }

    if (position.takeProfit) {
      const hitTP = position.type === 'long' ? price >= position.takeProfit : price <= position.takeProfit;
      if (hitTP) {
        setHorusMessage(`🎯 Take Profit atingido em ${position.asset.symbol}! Lucro no bolso. Disciplina de trader profissional.`);
        closePosition();
        return;
      }
    }
  }, [candles, position]);

  // Bankroll warning
  useEffect(() => {
    if (!bankrollWarningShown && balance <= initialBalance * 0.9 && balance < initialBalance) {
      setBankrollWarningShown(true);
      setHorusMessage('Sua banca caiu 10%... Gestão de bankroll, meu caro. Até o jogador mais audacioso sabe a hora de recuar.');
    }
  }, [balance, initialBalance, bankrollWarningShown]);

  const currentPrice = candles.length > 0 ? candles[candles.length - 1].close : selectedAsset.basePrice;

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
      // Update stress level from analysis
      if (mycroft?.alertaEstresse) {
        setStressLevel(mycroft.alertaEstresse as 'Baixo' | 'Médio' | 'Crítico');
      }
      // Track prediction history
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
    if (position) {
      toast({ title: 'Feche a posição atual primeiro', variant: 'destructive' });
      return;
    }

    setPosition({ type, asset: selectedAsset, entryPrice: currentPrice, amount, timestamp: Date.now(), stopLoss, takeProfit, leverage });
    setBalance(prev => prev - amount);

    const leverageMsg = leverage > 1 ? ` com ${leverage}x de alavancagem` : '';
    setHorusMessage(
      type === 'long'
        ? `Comprado em ${selectedAsset.symbol}${leverageMsg}! Vamos ver se você tem estômago para segurar essa posição.`
        : `Short em ${selectedAsset.symbol}${leverageMsg}... Audacioso. Apostar contra a multidão exige sangue frio.`
    );

    requestAnalysis();
  };

  const closePosition = async () => {
    if (!position) return;

    const leverage = position.leverage || 1;
    const priceChange = (currentPrice - position.entryPrice) / position.entryPrice;
    const leveragedChange = priceChange * leverage;
    const pnl = position.type === 'long'
      ? Math.floor(position.amount * leveragedChange)
      : Math.floor(position.amount * -leveragedChange);

    const newBalance = balance + position.amount + pnl;
    setBalance(newBalance);

    const isWin = pnl > 0;
    setTradeHistory(prev => [...prev, { pnl, asset: position.asset.symbol, type: position.type }]);

    if (isAuthenticated && profile) {
      try {
        await supabase.rpc('update_trader_balance', { p_user_id: profile.user_id, p_amount: pnl, p_is_win: isWin });
      } catch (e) {
        console.error('Error persisting trade:', e);
      }
    }

    toast({
      title: isWin ? `📈 +${pnl.toLocaleString()} BC` : `📉 ${pnl.toLocaleString()} BC`,
      description: `${position.type === 'long' ? 'Long' : 'Short'} ${position.asset.symbol}${leverage > 1 ? ` (${leverage}x)` : ''} fechado`,
      variant: isWin ? 'default' : 'destructive',
    });

    setHorusMessage(
      isWin
        ? `Lucro de ${pnl.toLocaleString()} BC! Nem todo mundo tem a coragem de fechar no verde.`
        : `Prejuízo de ${Math.abs(pnl).toLocaleString()} BC. O mercado não perdoa hesitação.`
    );

    setPosition(null);
  };

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

  const toggleIndicator = (key: 'sma9' | 'sma21' | 'bollinger' | 'rsi') => {
    setIndicators(prev => ({ ...prev, [key]: !prev[key] }));
  };

  return (
    <div className={`min-h-screen bg-[#0a0a0a] text-white ${stressLevel === 'Crítico' ? 'animate-pulse-subtle' : ''}`}>
      <MarketEventOverlay event={marketEvent} />
      <TraderBalanceHeader balance={balance} unrealizedPnl={unrealizedPnl} />

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

          <button onClick={() => setHorusMuted(!horusMuted)} className="p-2 rounded-lg hover:bg-white/5 transition-colors">
            {horusMuted ? <VolumeX className="w-5 h-5 text-amber-400/50" /> : <Volume2 className="w-5 h-5 text-amber-400" />}
          </button>
        </div>

        {/* Asset Selector */}
        <AssetSelector
          assets={ASSETS}
          selectedAsset={selectedAsset}
          onSelect={(asset) => {
            if (!position) setSelectedAsset(asset);
            else toast({ title: 'Feche a posição antes de trocar de ativo', variant: 'destructive' });
          }}
          currentPrice={currentPrice}
        />

        {/* Main Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mt-4">
          {/* Chart - 2 cols */}
          <div className="lg:col-span-2">
            {/* Chart controls bar */}
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
          </div>
        </div>
      </div>
    </div>
  );
}
