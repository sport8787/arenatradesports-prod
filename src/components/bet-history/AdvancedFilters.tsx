import { useState, useMemo, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Search, Filter, Trophy, Target, TrendingUp, Zap, DollarSign } from 'lucide-react';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Slider } from '@/components/ui/slider';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface Bet {
  league?: string;
  market: string;
  bookmaker?: string;
  sport?: string;
  asset_classification?: string;
  asset_score?: number;
  stake: number;
  edge?: number;
  sharp_money?: boolean;
}

interface FilterState {
  leagues: string[];
  markets: string[];
  bookmakers: string[];
  sports: string[];
  assetScoreTiers: string[];
  stakeRange: [number, number];
  minEdge: number;
  sharpMoneyOnly: boolean;
}

interface AdvancedFiltersProps {
  bets: Bet[];
  onFilteredChange: (filtered: Bet[]) => void;
}

const ASSET_TIER_MAP = {
  elite: ['ELITE', 'Elite'],
  premium: ['PREMIUM', 'Premium'],
  strong: ['STRONG', 'Strong'],
  speculative: ['SPECULATIVE', 'Speculative', 'IGNORAR', 'Moderate', 'Avoid'],
};

const QUICK_PRESETS = [
  { label: '⭐ Só ELITE', icon: Trophy, filters: { assetScoreTiers: ['elite'] } },
  { label: '💰 Stakes Altos', icon: DollarSign, filters: { stakeRange: [500, 10000] as [number, number] } },
  { label: '⚡ Sharp Money', icon: Zap, filters: { sharpMoneyOnly: true } },
  { label: '📈 Edge >10%', icon: TrendingUp, filters: { minEdge: 10 } },
];

const STAKE_QUICK_BUTTONS = [100, 250, 500, 1000];

export default function AdvancedFilters({ bets, onFilteredChange }: AdvancedFiltersProps) {
  const [filters, setFilters] = useState<FilterState>({
    leagues: [],
    markets: [],
    bookmakers: [],
    sports: [],
    assetScoreTiers: [],
    stakeRange: [0, 10000],
    minEdge: 0,
    sharpMoneyOnly: false,
  });

  const [openPopover, setOpenPopover] = useState<string | null>(null);

  // Extract unique values from bets
  const { allLeagues, allMarkets, allBookmakers, allSports } = useMemo(() => {
    const leagues = new Set<string>();
    const markets = new Set<string>();
    const bookmakers = new Set<string>();
    const sports = new Set<string>();

    bets.forEach(bet => {
      if (bet.league) leagues.add(bet.league);
      if (bet.market) markets.add(bet.market);
      if (bet.bookmaker) bookmakers.add(bet.bookmaker);
      if (bet.sport) sports.add(bet.sport);
    });

    return {
      allLeagues: Array.from(leagues).sort(),
      allMarkets: Array.from(markets).sort(),
      allBookmakers: Array.from(bookmakers).sort(),
      allSports: Array.from(sports).sort(),
    };
  }, [bets]);

  // Apply filters
  const filteredBets = useMemo(() => {
    let result = [...bets];

    // League filter
    if (filters.leagues.length > 0) {
      result = result.filter(b => filters.leagues.includes(b.league || ''));
    }

    // Market filter
    if (filters.markets.length > 0) {
      result = result.filter(b => filters.markets.includes(b.market));
    }

    // Bookmaker filter
    if (filters.bookmakers.length > 0) {
      result = result.filter(b => filters.bookmakers.includes(b.bookmaker || ''));
    }

    // Sport filter
    if (filters.sports.length > 0) {
      result = result.filter(b => filters.sports.includes(b.sport || ''));
    }

    // Asset Score Tier filter
    if (filters.assetScoreTiers.length > 0) {
      result = result.filter(b => {
        const classification = b.asset_classification?.toUpperCase() || '';
        return filters.assetScoreTiers.some(tier => {
          const tierValues = ASSET_TIER_MAP[tier as keyof typeof ASSET_TIER_MAP] || [];
          return tierValues.some(v => classification.includes(v.toUpperCase()));
        });
      });
    }

    // Stake range filter
    result = result.filter(b => b.stake >= filters.stakeRange[0] && b.stake <= filters.stakeRange[1]);

    // Min edge filter
    if (filters.minEdge > 0) {
      result = result.filter(b => (b.edge || 0) >= filters.minEdge);
    }

    // Sharp money filter
    if (filters.sharpMoneyOnly) {
      result = result.filter(b => b.sharp_money === true);
    }

    return result;
  }, [bets, filters]);

  // Trigger callback when filtered bets change
  const onFilteredRef = useRef(onFilteredChange);
  onFilteredRef.current = onFilteredChange;
  useEffect(() => {
    onFilteredRef.current(filteredBets);
  }, [filteredBets]);

  // Active filters count
  const activeFiltersCount = useMemo(() => {
    let count = 0;
    if (filters.leagues.length > 0) count += filters.leagues.length;
    if (filters.markets.length > 0) count += filters.markets.length;
    if (filters.bookmakers.length > 0) count += filters.bookmakers.length;
    if (filters.sports.length > 0) count += filters.sports.length;
    if (filters.assetScoreTiers.length > 0) count += filters.assetScoreTiers.length;
    if (filters.stakeRange[0] > 0 || filters.stakeRange[1] < 10000) count++;
    if (filters.minEdge > 0) count++;
    if (filters.sharpMoneyOnly) count++;
    return count;
  }, [filters]);

  const applyPreset = (preset: typeof QUICK_PRESETS[0]) => {
    setFilters(prev => ({ ...prev, ...preset.filters }));
  };

  const clearAllFilters = () => {
    setFilters({
      leagues: [],
      markets: [],
      bookmakers: [],
      sports: [],
      assetScoreTiers: [],
      stakeRange: [0, 10000],
      minEdge: 0,
      sharpMoneyOnly: false,
    });
  };

  const removeFilter = (type: keyof FilterState, value?: string) => {
    setFilters(prev => {
      if (type === 'sharpMoneyOnly') {
        return { ...prev, sharpMoneyOnly: false };
      }
      if (type === 'minEdge') {
        return { ...prev, minEdge: 0 };
      }
      if (type === 'stakeRange') {
        return { ...prev, stakeRange: [0, 10000] };
      }
      if (value && Array.isArray(prev[type])) {
        return { ...prev, [type]: (prev[type] as string[]).filter(v => v !== value) };
      }
      return prev;
    });
  };

  const toggleMultiSelect = (type: 'leagues' | 'markets' | 'bookmakers' | 'sports', value: string) => {
    setFilters(prev => {
      const current = prev[type];
      return {
        ...prev,
        [type]: current.includes(value)
          ? current.filter(v => v !== value)
          : [...current, value],
      };
    });
  };

  const toggleAssetTier = (tier: string) => {
    setFilters(prev => ({
      ...prev,
      assetScoreTiers: prev.assetScoreTiers.includes(tier)
        ? prev.assetScoreTiers.filter(t => t !== tier)
        : [...prev.assetScoreTiers, tier],
    }));
  };

  return (
    <div className="space-y-4">
      {/* Quick Presets */}
      <div className="flex flex-wrap items-center gap-2">
        {QUICK_PRESETS.map(preset => (
          <Button
            key={preset.label}
            size="sm"
            variant="outline"
            onClick={() => applyPreset(preset)}
            className="h-8 text-xs font-orbitron border-primary/30 hover:bg-primary/10"
          >
            <preset.icon className="w-3.5 h-3.5 mr-1.5" />
            {preset.label}
          </Button>
        ))}
      </div>

      {/* Main Filters */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {/* Leagues */}
        {allLeagues.length > 0 && (
          <Popover open={openPopover === 'leagues'} onOpenChange={open => setOpenPopover(open ? 'leagues' : null)}>
            <PopoverTrigger asChild>
              <Button variant="outline" size="sm" className="h-8 text-xs justify-between font-orbitron">
                <Trophy className="w-3.5 h-3.5 mr-1.5 text-primary" />
                Ligas {filters.leagues.length > 0 && `(${filters.leagues.length})`}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-[250px] p-0" align="start">
              <Command>
                <CommandInput placeholder="Buscar liga..." />
                <CommandList>
                  <CommandEmpty>Nenhuma liga encontrada</CommandEmpty>
                  <CommandGroup>
                    {allLeagues.map(league => (
                      <CommandItem
                        key={league}
                        onSelect={() => toggleMultiSelect('leagues', league)}
                        className="cursor-pointer"
                      >
                        <div className={cn(
                          "mr-2 flex h-4 w-4 items-center justify-center rounded-sm border border-primary",
                          filters.leagues.includes(league) ? "bg-primary text-primary-foreground" : "opacity-50"
                        )}>
                          {filters.leagues.includes(league) && <span className="text-xs">✓</span>}
                        </div>
                        <span className="text-xs">{league}</span>
                      </CommandItem>
                    ))}
                  </CommandGroup>
                </CommandList>
              </Command>
            </PopoverContent>
          </Popover>
        )}

        {/* Markets */}
        {allMarkets.length > 0 && (
          <Popover open={openPopover === 'markets'} onOpenChange={open => setOpenPopover(open ? 'markets' : null)}>
            <PopoverTrigger asChild>
              <Button variant="outline" size="sm" className="h-8 text-xs justify-between font-orbitron">
                <Target className="w-3.5 h-3.5 mr-1.5 text-primary" />
                Mercados {filters.markets.length > 0 && `(${filters.markets.length})`}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-[250px] p-0" align="start">
              <Command>
                <CommandInput placeholder="Buscar mercado..." />
                <CommandList>
                  <CommandEmpty>Nenhum mercado encontrado</CommandEmpty>
                  <CommandGroup>
                    {allMarkets.map(market => (
                      <CommandItem
                        key={market}
                        onSelect={() => toggleMultiSelect('markets', market)}
                        className="cursor-pointer"
                      >
                        <div className={cn(
                          "mr-2 flex h-4 w-4 items-center justify-center rounded-sm border border-primary",
                          filters.markets.includes(market) ? "bg-primary text-primary-foreground" : "opacity-50"
                        )}>
                          {filters.markets.includes(market) && <span className="text-xs">✓</span>}
                        </div>
                        <span className="text-xs">{market}</span>
                      </CommandItem>
                    ))}
                  </CommandGroup>
                </CommandList>
              </Command>
            </PopoverContent>
          </Popover>
        )}

        {/* Bookmakers */}
        {allBookmakers.length > 0 && (
          <Popover open={openPopover === 'bookmakers'} onOpenChange={open => setOpenPopover(open ? 'bookmakers' : null)}>
            <PopoverTrigger asChild>
              <Button variant="outline" size="sm" className="h-8 text-xs justify-between font-orbitron">
                <Filter className="w-3.5 h-3.5 mr-1.5 text-primary" />
                Bancas {filters.bookmakers.length > 0 && `(${filters.bookmakers.length})`}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-[250px] p-0" align="start">
              <Command>
                <CommandInput placeholder="Buscar banca..." />
                <CommandList>
                  <CommandEmpty>Nenhuma banca encontrada</CommandEmpty>
                  <CommandGroup>
                    {allBookmakers.map(bookmaker => (
                      <CommandItem
                        key={bookmaker}
                        onSelect={() => toggleMultiSelect('bookmakers', bookmaker)}
                        className="cursor-pointer"
                      >
                        <div className={cn(
                          "mr-2 flex h-4 w-4 items-center justify-center rounded-sm border border-primary",
                          filters.bookmakers.includes(bookmaker) ? "bg-primary text-primary-foreground" : "opacity-50"
                        )}>
                          {filters.bookmakers.includes(bookmaker) && <span className="text-xs">✓</span>}
                        </div>
                        <span className="text-xs">{bookmaker}</span>
                      </CommandItem>
                    ))}
                  </CommandGroup>
                </CommandList>
              </Command>
            </PopoverContent>
          </Popover>
        )}

        {/* Sports */}
        {allSports.length > 0 && (
          <Popover open={openPopover === 'sports'} onOpenChange={open => setOpenPopover(open ? 'sports' : null)}>
            <PopoverTrigger asChild>
              <Button variant="outline" size="sm" className="h-8 text-xs justify-between font-orbitron">
                <Target className="w-3.5 h-3.5 mr-1.5 text-primary" />
                Esportes {filters.sports.length > 0 && `(${filters.sports.length})`}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-[250px] p-0" align="start">
              <Command>
                <CommandList>
                  <CommandGroup>
                    {allSports.map(sport => (
                      <CommandItem
                        key={sport}
                        onSelect={() => toggleMultiSelect('sports', sport)}
                        className="cursor-pointer"
                      >
                        <div className={cn(
                          "mr-2 flex h-4 w-4 items-center justify-center rounded-sm border border-primary",
                          filters.sports.includes(sport) ? "bg-primary text-primary-foreground" : "opacity-50"
                        )}>
                          {filters.sports.includes(sport) && <span className="text-xs">✓</span>}
                        </div>
                        <span className="text-xs">{sport}</span>
                      </CommandItem>
                    ))}
                  </CommandGroup>
                </CommandList>
              </Command>
            </PopoverContent>
          </Popover>
        )}
      </div>

      {/* Asset Score Tiers */}
      <div className="space-y-2">
        <p className="text-xs text-muted-foreground font-orbitron uppercase">Asset Score Tiers</p>
        <div className="flex flex-wrap gap-2">
          {[
            { key: 'elite', label: 'ELITE', color: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30' },
            { key: 'premium', label: 'PREMIUM', color: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30' },
            { key: 'strong', label: 'STRONG', color: 'bg-blue-500/20 text-blue-400 border-blue-500/30' },
            { key: 'speculative', label: 'SPECULATIVE', color: 'bg-muted text-muted-foreground border-border' },
          ].map(tier => (
            <Badge
              key={tier.key}
              variant="outline"
              className={cn(
                "cursor-pointer text-xs font-orbitron transition-all",
                filters.assetScoreTiers.includes(tier.key) ? tier.color : "opacity-40 hover:opacity-100"
              )}
              onClick={() => toggleAssetTier(tier.key)}
            >
              {tier.label}
            </Badge>
          ))}
        </div>
      </div>

      {/* Stake Range */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <p className="text-xs text-muted-foreground font-orbitron uppercase">Stake Range</p>
          <span className="text-xs font-orbitron text-foreground">
            R$ {filters.stakeRange[0]} - R$ {filters.stakeRange[1]}
          </span>
        </div>
        <Slider
          value={filters.stakeRange}
          onValueChange={(v) => setFilters(prev => ({ ...prev, stakeRange: v as [number, number] }))}
          min={0}
          max={10000}
          step={50}
          className="w-full"
        />
        <div className="flex flex-wrap gap-2">
          {STAKE_QUICK_BUTTONS.map(amount => (
            <Button
              key={amount}
              size="sm"
              variant="outline"
              onClick={() => setFilters(prev => ({ ...prev, stakeRange: [amount, 10000] }))}
              className="h-6 text-xs border-border hover:border-primary/50"
            >
              ≥ R$ {amount}
            </Button>
          ))}
        </div>
      </div>

      {/* Min Edge */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <p className="text-xs text-muted-foreground font-orbitron uppercase">Edge Mínimo</p>
          <span className="text-xs font-orbitron text-foreground">{filters.minEdge}%</span>
        </div>
        <Slider
          value={[filters.minEdge]}
          onValueChange={(v) => setFilters(prev => ({ ...prev, minEdge: v[0] }))}
          min={0}
          max={30}
          step={1}
          className="w-full"
        />
      </div>

      {/* Sharp Money Toggle */}
      <div className="flex items-center justify-between">
        <div className="space-y-0.5">
          <p className="text-xs font-orbitron text-foreground">Sharp Money</p>
          <p className="text-xs text-muted-foreground">Apenas entradas com movimentação profissional</p>
        </div>
        <Switch
          checked={filters.sharpMoneyOnly}
          onCheckedChange={(checked) => setFilters(prev => ({ ...prev, sharpMoneyOnly: checked }))}
        />
      </div>

      {/* Active Filters Badges */}
      {activeFiltersCount > 0 && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: 'auto' }}
          className="space-y-2"
        >
          <div className="flex items-center justify-between">
            <p className="text-xs text-muted-foreground font-orbitron uppercase">
              Filtros Ativos ({activeFiltersCount})
            </p>
            <Button
              size="sm"
              variant="ghost"
              onClick={clearAllFilters}
              className="h-6 text-xs text-destructive hover:text-destructive"
            >
              Limpar Tudo
            </Button>
          </div>
          <div className="flex flex-wrap gap-2">
            {filters.leagues.map(league => (
              <Badge key={league} variant="secondary" className="text-xs font-orbitron pr-1">
                {league}
                <button onClick={() => removeFilter('leagues', league)} className="ml-1.5 hover:text-destructive">
                  <X className="w-3 h-3" />
                </button>
              </Badge>
            ))}
            {filters.markets.map(market => (
              <Badge key={market} variant="secondary" className="text-xs font-orbitron pr-1">
                {market}
                <button onClick={() => removeFilter('markets', market)} className="ml-1.5 hover:text-destructive">
                  <X className="w-3 h-3" />
                </button>
              </Badge>
            ))}
            {filters.bookmakers.map(bookmaker => (
              <Badge key={bookmaker} variant="secondary" className="text-xs font-orbitron pr-1">
                {bookmaker}
                <button onClick={() => removeFilter('bookmakers', bookmaker)} className="ml-1.5 hover:text-destructive">
                  <X className="w-3 h-3" />
                </button>
              </Badge>
            ))}
            {filters.sports.map(sport => (
              <Badge key={sport} variant="secondary" className="text-xs font-orbitron pr-1">
                {sport}
                <button onClick={() => removeFilter('sports', sport)} className="ml-1.5 hover:text-destructive">
                  <X className="w-3 h-3" />
                </button>
              </Badge>
            ))}
            {filters.assetScoreTiers.map(tier => (
              <Badge key={tier} variant="secondary" className="text-xs font-orbitron pr-1">
                {tier.toUpperCase()}
                <button onClick={() => removeFilter('assetScoreTiers', tier)} className="ml-1.5 hover:text-destructive">
                  <X className="w-3 h-3" />
                </button>
              </Badge>
            ))}
            {(filters.stakeRange[0] > 0 || filters.stakeRange[1] < 10000) && (
              <Badge variant="secondary" className="text-xs font-orbitron pr-1">
                Stake: R$ {filters.stakeRange[0]}-{filters.stakeRange[1]}
                <button onClick={() => removeFilter('stakeRange')} className="ml-1.5 hover:text-destructive">
                  <X className="w-3 h-3" />
                </button>
              </Badge>
            )}
            {filters.minEdge > 0 && (
              <Badge variant="secondary" className="text-xs font-orbitron pr-1">
                Edge ≥{filters.minEdge}%
                <button onClick={() => removeFilter('minEdge')} className="ml-1.5 hover:text-destructive">
                  <X className="w-3 h-3" />
                </button>
              </Badge>
            )}
            {filters.sharpMoneyOnly && (
              <Badge variant="secondary" className="text-xs font-orbitron pr-1">
                Sharp Money
                <button onClick={() => removeFilter('sharpMoneyOnly')} className="ml-1.5 hover:text-destructive">
                  <X className="w-3 h-3" />
                </button>
              </Badge>
            )}
          </div>
        </motion.div>
      )}

      {/* Results Counter */}
      <div className="text-center">
        <p className="text-sm font-orbitron text-muted-foreground">
          <span className="text-primary font-bold">{filteredBets.length}</span> de{' '}
          <span className="font-bold">{bets.length}</span> entradas
        </p>
      </div>
    </div>
  );
}
