import { useRef, useCallback } from 'react';
import type { Asset, Candle } from '@/pages/ArenaTrader';
import type { MarketEvent, MarketEventType } from '@/components/arena-trader/MarketEventOverlay';

const FLASH_CRASH_EVENTS: Omit<MarketEvent, 'active'>[] = [
  { type: 'flash_crash', title: '⚡ FLASH CRASH', description: 'Liquidações em cascata! Ordens de venda massivas detectadas.', priceImpact: -8 },
  { type: 'flash_crash', title: '💥 CRASH RELÂMPAGO', description: 'Whale despejou posição bilionária. Mercado em pânico.', priceImpact: -12 },
];

const PUMP_DUMP_EVENTS: Omit<MarketEvent, 'active'>[] = [
  { type: 'pump_dump', title: '🚀 PUMP SUSPEITO', description: 'Volume anormal detectado. Possível manipulação de mercado.', priceImpact: 15 },
  { type: 'pump_dump', title: '📈 PUMP & DUMP', description: 'Alta artificial seguida de venda coordenada iminente.', priceImpact: 10 },
];

const BREAKING_NEWS_EVENTS: Omit<MarketEvent, 'active'>[] = [
  { type: 'breaking_news', title: '📰 ÚLTIMA HORA', description: 'Reguladores anunciam nova legislação para criptoativos.', priceImpact: -5 },
  { type: 'breaking_news', title: '📰 BREAKING NEWS', description: 'Grande fundo de investimento anuncia posição em cripto.', priceImpact: 7 },
  { type: 'breaking_news', title: '📰 NOTÍCIA URGENTE', description: 'Banco Central sinaliza corte de juros acima do esperado.', priceImpact: 4 },
  { type: 'breaking_news', title: '📰 ALERTA', description: 'Empresa anuncia recompra massiva de ações próprias.', priceImpact: 6 },
];

const ALL_EVENTS = [...FLASH_CRASH_EVENTS, ...PUMP_DUMP_EVENTS, ...BREAKING_NEWS_EVENTS];

const HORUS_EVENT_MESSAGES: Record<MarketEventType, string[]> = {
  flash_crash: [
    'O mercado acaba de desmoronar! Sangue nas ruas... E onde tem sangue, tem oportunidade para quem tem nervos de aço.',
    'Flash Crash! Os fracos estão vendendo em pânico. Mas será que você tem a coragem de comprar no caos?',
  ],
  pump_dump: [
    'Cheiro de manipulação no ar... O volume explodiu do nada. Cuidado, isso pode ser uma armadilha para sardinhas.',
    'Pump artificial detectado! Os tubarões estão inflando o preço antes de despejar. Vai entrar nessa onda ou observar?',
  ],
  breaking_news: [
    'Notícia de última hora sacudiu o mercado! Traders amadores reagem por emoção. E você, vai pensar antes de agir?',
    'O mercado reagiu à notícia como um rebanho assustado. Quem mantém a calma agora... lucra depois.',
  ],
};

export function useMarketEvents() {
  const lastEventTime = useRef(0);
  const eventCooldown = 45000; // 45s between events

  const tryTriggerEvent = useCallback((): { event: MarketEvent; horusMessage: string } | null => {
    const now = Date.now();
    if (now - lastEventTime.current < eventCooldown) return null;

    // ~8% chance per tick
    if (Math.random() > 0.08) return null;

    lastEventTime.current = now;

    const template = ALL_EVENTS[Math.floor(Math.random() * ALL_EVENTS.length)];
    const messages = HORUS_EVENT_MESSAGES[template.type];
    const horusMessage = messages[Math.floor(Math.random() * messages.length)];

    return {
      event: { ...template, active: true },
      horusMessage,
    };
  }, []);

  const applyEventToCandles = useCallback((candles: Candle[], event: MarketEvent, asset: Asset): Candle[] => {
    if (candles.length === 0) return candles;
    const lastCandle = candles[candles.length - 1];
    const impactMultiplier = event.priceImpact / 100;
    const newClose = +(lastCandle.close * (1 + impactMultiplier)).toFixed(2);
    const newHigh = Math.max(lastCandle.close, newClose) + Math.random() * asset.volatility * lastCandle.close;
    const newLow = Math.min(lastCandle.close, newClose) - Math.random() * asset.volatility * lastCandle.close;

    const impactCandle: Candle = {
      time: Date.now(),
      open: +lastCandle.close.toFixed(2),
      high: +newHigh.toFixed(2),
      low: +newLow.toFixed(2),
      close: newClose,
      volume: Math.floor(Math.random() * 2000000) + 500000,
    };

    return [...candles.slice(-59), impactCandle];
  }, []);

  return { tryTriggerEvent, applyEventToCandles };
}
