import { motion } from 'framer-motion';
import { Bitcoin, Building2, Wifi, WifiOff } from 'lucide-react';
import type { Asset } from '@/pages/ArenaTrader';
import type { LivePrices } from '@/hooks/useLivePrices';

interface AssetSelectorProps {
  assets: Asset[];
  selectedAsset: Asset;
  onSelect: (asset: Asset) => void;
  currentPrice: number;
  livePrices?: LivePrices;
  isLive?: boolean;
  getPriceDirection?: (symbol: string) => 'up' | 'down' | 'neutral';
}

export default function AssetSelector({ assets, selectedAsset, onSelect, currentPrice, livePrices, isLive, getPriceDirection }: AssetSelectorProps) {
  return (
    <div>
      {/* Live indicator */}
      <div className="flex items-center gap-2 mb-2">
        {isLive ? (
          <div className="flex items-center gap-1.5 text-[10px]">
            <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <span className="text-emerald-400 font-bold uppercase tracking-wider">LIVE</span>
            <Wifi className="w-3 h-3 text-emerald-400/60" />
          </div>
        ) : (
          <div className="flex items-center gap-1.5 text-[10px]">
            <div className="w-2 h-2 rounded-full bg-amber-400/50" />
            <span className="text-amber-400/50 font-bold uppercase tracking-wider">SIMULADO</span>
            <WifiOff className="w-3 h-3 text-amber-400/30" />
          </div>
        )}
      </div>

      <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
        {assets.map((asset) => {
          const livePrice = livePrices?.[asset.symbol]?.price;
          const displayPrice = asset.id === selectedAsset.id ? currentPrice : (livePrice || asset.basePrice);
          const direction = getPriceDirection?.(asset.symbol) || 'neutral';
          const change24h = livePrices?.[asset.symbol]?.change24h;

          return (
            <motion.button
              key={asset.id}
              onClick={() => onSelect(asset)}
              whileHover={{ scale: 1.03 }}
              whileTap={{ scale: 0.97 }}
              className={`
                flex items-center gap-2 px-4 py-2.5 rounded-xl border transition-all min-w-[160px]
                ${selectedAsset.id === asset.id
                  ? 'bg-amber-500/10 border-amber-500/50 shadow-[0_0_15px_rgba(245,158,11,0.15)]'
                  : 'bg-[#111111] border-white/10 hover:border-amber-500/30'
                }
              `}
            >
              <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                asset.category === 'crypto' ? 'bg-orange-500/20' : 'bg-blue-500/20'
              }`}>
                {asset.category === 'crypto' ? (
                  <Bitcoin className="w-4 h-4 text-orange-400" />
                ) : (
                  <Building2 className="w-4 h-4 text-blue-400" />
                )}
              </div>
              <div className="text-left">
                <div className="font-orbitron text-xs font-bold text-white">{asset.symbol}</div>
                <div className={`text-[11px] font-mono font-bold transition-colors duration-300 ${
                  direction === 'up' ? 'text-cyan-400' :
                  direction === 'down' ? 'text-red-400' :
                  'text-white/60'
                }`}>
                  {asset.category === 'crypto'
                    ? `R$${displayPrice.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
                    : `R$${displayPrice.toFixed(2)}`
                  }
                </div>
                {change24h !== undefined && isLive && (
                  <div className={`text-[9px] ${change24h >= 0 ? 'text-cyan-400/70' : 'text-red-400/70'}`}>
                    {change24h >= 0 ? '+' : ''}{change24h.toFixed(2)}%
                  </div>
                )}
              </div>
            </motion.button>
          );
        })}
      </div>
    </div>
  );
}
