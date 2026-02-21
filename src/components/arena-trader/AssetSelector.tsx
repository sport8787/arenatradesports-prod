import { motion } from 'framer-motion';
import { Bitcoin, Building2 } from 'lucide-react';
import type { Asset } from '@/pages/ArenaTrader';

interface AssetSelectorProps {
  assets: Asset[];
  selectedAsset: Asset;
  onSelect: (asset: Asset) => void;
  currentPrice: number;
}

export default function AssetSelector({ assets, selectedAsset, onSelect, currentPrice }: AssetSelectorProps) {
  return (
    <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
      {assets.map((asset) => (
        <motion.button
          key={asset.id}
          onClick={() => onSelect(asset)}
          whileHover={{ scale: 1.03 }}
          whileTap={{ scale: 0.97 }}
          className={`
            flex items-center gap-2 px-4 py-2.5 rounded-xl border transition-all min-w-[140px]
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
            <div className="text-[10px] text-white/40">{asset.name}</div>
          </div>
        </motion.button>
      ))}
    </div>
  );
}
