# ORÁCULO MYCROFT - PLATAFORMA DE INVESTIMENTO ESPORTIVO
## Documento de Implementação Completa

**Versão:** 1.0  
**Data:** 06/03/2026  
**Projeto:** Transformação Arena Punter → Oráculo Mycroft  
**Responsável:** Israel Barbosa - Bluffer Entertainment  

---

## 📋 ÍNDICE

1. [Visão Geral](#visão-geral)
2. [Rename & Rebrand](#rename--rebrand)
3. [Arquitetura de Dados](#arquitetura-de-dados)
4. [Fase 1: MVP Investimento](#fase-1-mvp-investimento)
5. [Fase 2: Gamificação](#fase-2-gamificação)
6. [Fase 3: Analytics Avançado](#fase-3-analytics-avançado)
7. [Fase 4: Automação (Futuro)](#fase-4-automação-futuro)
8. [Checklist de Deploy](#checklist-de-deploy)

---

## 🎯 VISÃO GERAL

### Objetivo

Transformar a Arena Punter de uma "plataforma de sinais de apostas" em uma **Plataforma de Investimento Esportivo** profissional, usando linguagem e conceitos de Wall Street.

### Diferencial Competitivo

```
ANTES (Arena Punter):
├─ "Apostas esportivas"
├─ "Sinais do Mycroft"
├─ "Greens e reds"
└─ Visual: verde/vermelho (cassino)

DEPOIS (Oráculo Mycroft):
├─ "Investimento esportivo"
├─ "Ativos recomendados"
├─ "Portfolio performance"
├─ "Asset Score 0-100"
└─ Visual: azul/dourado (fintech)

REFERÊNCIAS:
├─ Bloomberg Terminal (interface)
├─ Interactive Brokers (dados)
├─ Robinhood (UX simples)
└─ Goldman Sachs (seriedade)
```

### Filosofia

> "Transformar apostas em ativos de investimento verificáveis, ranqueáveis e auditáveis."

---

## 🏷️ RENAME & REBRAND

### Nomenclatura Completa

| Antes | Depois | Razão |
|-------|--------|-------|
| Arena Punter | **Oráculo Mycroft** | Nome premium, misterioso |
| Arena Trader | **Oráculo Mycroft** | Unificação total |
| Aposta | **Ativo** / **Oportunidade** | Linguagem investimento |
| Sinal | **Recomendação** / **Análise** | Profissional |
| Green | **Lucro** / **ROI positivo** | Sério |
| Red | **Loss** / **Drawdown** | Técnico |
| Banca | **Bankroll** / **Capital** | Wall Street |
| Tipster | **Analista Quant** | Credibilidade |

### Taglines

**Principal:**  
> "Invista em esportes como Wall Street investe em ações"

**Secundária:**  
> "Onde apostas se tornam ativos"

**Call to Action:**  
> "Comece com R$ 100. Teste grátis por 7 dias. Garantia dobro se não lucrar."

### Identidade Visual

```
CORES PRINCIPAIS:
├─ Azul escuro: #1a1f36 (seriedade)
├─ Azul elétrico: #3b82f6 (tech)
├─ Dourado: #f59e0b (premium)
└─ Branco: #ffffff (clean)

CORES SECUNDÁRIAS:
├─ Verde sucesso: #10b981 (lucro)
├─ Vermelho risco: #ef4444 (loss)
└─ Cinza neutro: #6b7280 (dados)

TIPOGRAFIA:
├─ Headings: Inter Bold
├─ Body: Inter Regular
└─ Numbers: JetBrains Mono (monospace)

ÍCONES:
├─ Lucide React (moderno)
└─ Heroicons (profissional)
```

---

## 🗄️ ARQUITETURA DE DADOS

### Schema Completo Supabase

#### 1. Tabelas Existentes (MANTER)

```sql
-- Não mexer, já funcionam
users
matches
odds
predictions
virtual_bets (atual banca virtual)
```

#### 2. Tabelas Novas (ADICIONAR)

```sql
-- ═══════════════════════════════════════════
-- ASSET SCORING
-- ═══════════════════════════════════════════

CREATE TABLE asset_scores (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  match_id uuid REFERENCES matches(id) ON DELETE CASCADE,
  market text NOT NULL, -- 'h2h_home', 'totals_over_2.5', etc
  
  -- Componentes do score (0-100 cada)
  edge_score decimal(5,2) NOT NULL,
  confidence_score decimal(5,2) NOT NULL,
  tier_score decimal(5,2) NOT NULL,
  liquidity_score decimal(5,2) NOT NULL,
  
  -- Score final (0-100)
  final_score decimal(5,2) NOT NULL,
  
  -- Classificação
  classification text NOT NULL, -- 'Elite', 'Premium', 'Strong', 'Moderate', 'Avoid'
  
  -- Metadata
  expected_roi decimal(5,2),
  edge_percentage decimal(5,2),
  tier integer, -- 1, 2, 3
  
  created_at timestamp DEFAULT now(),
  
  CONSTRAINT valid_scores CHECK (
    edge_score BETWEEN 0 AND 100 AND
    confidence_score BETWEEN 0 AND 100 AND
    tier_score BETWEEN 0 AND 100 AND
    liquidity_score BETWEEN 0 AND 100 AND
    final_score BETWEEN 0 AND 100
  )
);

CREATE INDEX idx_asset_scores_match ON asset_scores(match_id);
CREATE INDEX idx_asset_scores_classification ON asset_scores(classification);
CREATE INDEX idx_asset_scores_score ON asset_scores(final_score DESC);


-- ═══════════════════════════════════════════
-- DUAL BANKROLL
-- ═══════════════════════════════════════════

CREATE TABLE user_bankrolls (
  user_id uuid PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  
  -- Bankroll Hórus (IA - antiga banca virtual)
  bankroll_horus decimal(12,2) DEFAULT 0 NOT NULL,
  horus_roi decimal(8,4) DEFAULT 0,
  horus_total_bets integer DEFAULT 0,
  horus_wins integer DEFAULT 0,
  horus_losses integer DEFAULT 0,
  horus_profit decimal(12,2) DEFAULT 0,
  
  -- Bankroll Manual (usuário decide)
  bankroll_manual decimal(12,2) DEFAULT 0 NOT NULL,
  manual_roi decimal(8,4) DEFAULT 0,
  manual_total_bets integer DEFAULT 0,
  manual_wins integer DEFAULT 0,
  manual_losses integer DEFAULT 0,
  manual_profit decimal(12,2) DEFAULT 0,
  
  -- Totais
  bankroll_total decimal(12,2) GENERATED ALWAYS AS (bankroll_horus + bankroll_manual) STORED,
  
  -- Metadata
  initial_deposit decimal(12,2) NOT NULL,
  created_at timestamp DEFAULT now(),
  updated_at timestamp DEFAULT now()
);

CREATE INDEX idx_user_bankrolls_user ON user_bankrolls(user_id);


-- ═══════════════════════════════════════════
-- BETS TRACKING (Unificado)
-- ═══════════════════════════════════════════

CREATE TABLE bets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES users(id) ON DELETE CASCADE,
  match_id uuid REFERENCES matches(id) ON DELETE CASCADE,
  
  -- Dados da aposta
  market text NOT NULL,
  selection text NOT NULL, -- 'home', 'away', 'over', etc
  bookmaker text NOT NULL,
  odd decimal(6,3) NOT NULL,
  stake decimal(12,2) NOT NULL,
  
  -- Origem
  source text NOT NULL, -- 'horus' | 'manual'
  approved_by_mycroft boolean DEFAULT false,
  
  -- Asset Score (se aplicável)
  asset_score decimal(5,2),
  asset_classification text,
  tier integer,
  
  -- Resultado
  status text DEFAULT 'pending', -- 'pending' | 'won' | 'lost' | 'void'
  profit decimal(12,2),
  settled_at timestamp,
  
  -- Metadata
  notes text,
  created_at timestamp DEFAULT now(),
  
  CONSTRAINT valid_source CHECK (source IN ('horus', 'manual')),
  CONSTRAINT valid_status CHECK (status IN ('pending', 'won', 'lost', 'void'))
);

CREATE INDEX idx_bets_user ON bets(user_id);
CREATE INDEX idx_bets_match ON bets(match_id);
CREATE INDEX idx_bets_source ON bets(source);
CREATE INDEX idx_bets_status ON bets(status);
CREATE INDEX idx_bets_created ON bets(created_at DESC);


-- ═══════════════════════════════════════════
-- GLOBAL RANKING (Cache)
-- ═══════════════════════════════════════════

CREATE TABLE global_ranking (
  user_id uuid PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  
  -- Display
  username text NOT NULL,
  avatar_url text,
  
  -- Métricas
  total_bets integer NOT NULL,
  roi decimal(8,4) NOT NULL,
  total_profit decimal(12,2) NOT NULL,
  win_rate decimal(5,2) NOT NULL,
  sharpe_ratio decimal(6,3),
  max_drawdown decimal(5,2),
  
  -- Ranking
  rank integer NOT NULL,
  percentile decimal(5,2),
  
  -- Elegibilidade
  eligible boolean DEFAULT false, -- mínimo 50 apostas
  
  -- Metadata
  updated_at timestamp DEFAULT now(),
  
  CONSTRAINT min_bets_for_ranking CHECK (
    (eligible = true AND total_bets >= 50) OR
    (eligible = false)
  )
);

CREATE INDEX idx_ranking_rank ON global_ranking(rank);
CREATE INDEX idx_ranking_roi ON global_ranking(roi DESC);
CREATE INDEX idx_ranking_eligible ON global_ranking(eligible);


-- ═══════════════════════════════════════════
-- PERFORMANCE CERTIFICATES
-- ═══════════════════════════════════════════

CREATE TABLE certificates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES users(id) ON DELETE CASCADE,
  
  -- Período
  period_start date NOT NULL,
  period_end date NOT NULL,
  
  -- Métricas (JSON para flexibilidade)
  metrics jsonb NOT NULL,
  -- Exemplo:
  -- {
  --   "roi": 73.56,
  --   "profit": 7356.21,
  --   "sharpe_ratio": 2.8,
  --   "win_rate": 57.47,
  --   "total_bets": 109,
  --   "max_drawdown": -8.2,
  --   "profit_factor": 2.34,
  --   "avg_score": 76.2
  -- }
  
  -- PDF
  pdf_url text,
  
  -- Compartilhamento
  public boolean DEFAULT false,
  views integer DEFAULT 0,
  shares integer DEFAULT 0,
  
  -- Metadata
  created_at timestamp DEFAULT now(),
  
  CONSTRAINT valid_period CHECK (period_end >= period_start)
);

CREATE INDEX idx_certificates_user ON certificates(user_id);
CREATE INDEX idx_certificates_public ON certificates(public);
CREATE INDEX idx_certificates_created ON certificates(created_at DESC);


-- ═══════════════════════════════════════════
-- PATTERN INSIGHTS (Simples - Fase 3)
-- ═══════════════════════════════════════════

CREATE TABLE pattern_insights (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Padrão
  league text NOT NULL,
  market text NOT NULL,
  
  -- Métricas históricas
  sample_size integer NOT NULL,
  roi decimal(8,4) NOT NULL,
  win_rate decimal(5,2) NOT NULL,
  avg_score decimal(5,2),
  
  -- Confiança
  confidence text NOT NULL, -- 'High', 'Medium', 'Low'
  
  -- Metadata
  last_calculated timestamp DEFAULT now(),
  
  CONSTRAINT min_sample CHECK (sample_size >= 100)
);

CREATE INDEX idx_pattern_insights_league ON pattern_insights(league);
CREATE INDEX idx_pattern_insights_roi ON pattern_insights(roi DESC);
```

### Migração da Banca Virtual Atual

**IMPORTANTE:** A banca virtual atual (`virtual_bets`) vira **Bankroll Hórus**.

```sql
-- Script de migração (executar UMA VEZ)

-- 1. Criar bankrolls para usuários existentes
INSERT INTO user_bankrolls (user_id, initial_deposit, bankroll_horus)
SELECT 
  user_id,
  10000 as initial_deposit, -- ou pegar do histórico
  current_balance as bankroll_horus
FROM virtual_bankroll_atual
WHERE user_id NOT IN (SELECT user_id FROM user_bankrolls);

-- 2. Migrar apostas virtuais para bets com source='horus'
INSERT INTO bets (
  user_id, match_id, market, selection, bookmaker, 
  odd, stake, source, approved_by_mycroft, status, profit, settled_at
)
SELECT 
  user_id, match_id, market, selection, bookmaker,
  odd, stake,
  'horus' as source,
  true as approved_by_mycroft,
  CASE 
    WHEN result = 'won' THEN 'won'
    WHEN result = 'lost' THEN 'lost'
    ELSE 'pending'
  END as status,
  profit,
  settled_at
FROM virtual_bets
WHERE id NOT IN (SELECT id FROM bets WHERE source = 'horus');

-- 3. Atualizar métricas bankroll_horus
UPDATE user_bankrolls ub
SET 
  horus_total_bets = (SELECT COUNT(*) FROM bets WHERE user_id = ub.user_id AND source = 'horus'),
  horus_wins = (SELECT COUNT(*) FROM bets WHERE user_id = ub.user_id AND source = 'horus' AND status = 'won'),
  horus_losses = (SELECT COUNT(*) FROM bets WHERE user_id = ub.user_id AND source = 'horus' AND status = 'lost'),
  horus_profit = (SELECT COALESCE(SUM(profit), 0) FROM bets WHERE user_id = ub.user_id AND source = 'horus'),
  horus_roi = (
    SELECT 
      CASE 
        WHEN SUM(stake) > 0 THEN (SUM(COALESCE(profit, 0)) / SUM(stake)) * 100
        ELSE 0
      END
    FROM bets 
    WHERE user_id = ub.user_id AND source = 'horus'
  );

-- Pronto! Agora temos:
-- - Bankroll Hórus = antiga banca virtual
-- - Bankroll Manual = começa zerado (usuário ativa)
```

---

## 🚀 FASE 1: MVP INVESTIMENTO

**Prazo:** 2-3 semanas  
**Prioridade:** CRÍTICA  
**Objetivo:** Transformar interface em plataforma de investimento

### 1.1 Asset Score System

#### Cálculo do Score

```javascript
/**
 * Calcula Asset Score para uma recomendação do Mycroft
 * 
 * @param {Object} prediction - Predição do Mycroft
 * @returns {Object} Asset score completo
 */
function calculateAssetScore(prediction) {
  // 1. Edge Score (40% do total)
  // Range: 0-100
  // Edge 2% = 50 pontos, Edge 10%+ = 100 pontos
  const edgeScore = Math.min(100, (prediction.edge_percentage / 0.10) * 100);
  
  // 2. Confidence Score (30% do total)
  // Diretamente da confiança do Mycroft (0-100)
  const confidenceScore = prediction.confidence;
  
  // 3. Tier Score (20% do total)
  // TIER 1 = 100, TIER 2 = 75, TIER 3 = 50
  const tierScore = prediction.tier === 1 ? 100 : 
                    prediction.tier === 2 ? 75 : 50;
  
  // 4. Liquidity Score (10% do total)
  // Baseado em número de bookmakers com odd similar
  const liquidityScore = Math.min(100, (prediction.num_bookmakers / 5) * 100);
  
  // Score final (média ponderada)
  const finalScore = (
    edgeScore * 0.40 +
    confidenceScore * 0.30 +
    tierScore * 0.20 +
    liquidityScore * 0.10
  );
  
  // Classificação
  let classification;
  if (finalScore >= 90) classification = 'Elite';
  else if (finalScore >= 80) classification = 'Premium';
  else if (finalScore >= 70) classification = 'Strong';
  else if (finalScore >= 60) classification = 'Moderate';
  else classification = 'Avoid';
  
  return {
    edge_score: Math.round(edgeScore * 100) / 100,
    confidence_score: Math.round(confidenceScore * 100) / 100,
    tier_score: tierScore,
    liquidity_score: Math.round(liquidityScore * 100) / 100,
    final_score: Math.round(finalScore * 100) / 100,
    classification,
    expected_roi: prediction.edge_percentage,
    tier: prediction.tier
  };
}
```

#### UI Component - Asset Card

```tsx
// components/AssetCard.tsx

interface AssetCardProps {
  match: Match;
  prediction: Prediction;
  assetScore: AssetScore;
}

export function AssetCard({ match, prediction, assetScore }: AssetCardProps) {
  const scoreColor = 
    assetScore.classification === 'Elite' ? 'text-purple-500' :
    assetScore.classification === 'Premium' ? 'text-blue-500' :
    assetScore.classification === 'Strong' ? 'text-green-500' :
    assetScore.classification === 'Moderate' ? 'text-yellow-500' :
    'text-gray-500';
    
  const scoreBg =
    assetScore.classification === 'Elite' ? 'bg-purple-500/10' :
    assetScore.classification === 'Premium' ? 'bg-blue-500/10' :
    assetScore.classification === 'Strong' ? 'bg-green-500/10' :
    assetScore.classification === 'Moderate' ? 'bg-yellow-500/10' :
    'bg-gray-500/10';
  
  return (
    <div className="border border-gray-800 rounded-lg p-4 hover:border-blue-500 transition">
      {/* Header */}
      <div className="flex justify-between items-start mb-3">
        <div>
          <h3 className="font-semibold text-white">
            {match.home_team} vs {match.away_team}
          </h3>
          <p className="text-sm text-gray-400">
            {match.league} • {format(match.date, 'dd/MM HH:mm')}
          </p>
        </div>
        
        {/* Asset Score Badge */}
        <div className={`${scoreBg} ${scoreColor} px-3 py-1 rounded-full`}>
          <span className="text-xs font-semibold">
            {assetScore.classification.toUpperCase()}
          </span>
        </div>
      </div>
      
      {/* Market Info */}
      <div className="bg-gray-900/50 rounded p-3 mb-3">
        <div className="flex justify-between items-center">
          <div>
            <p className="text-sm text-gray-400">Mercado</p>
            <p className="font-medium text-white">{prediction.market}</p>
          </div>
          <div className="text-right">
            <p className="text-sm text-gray-400">Odd</p>
            <p className="font-mono font-bold text-xl text-white">
              {prediction.odd.toFixed(2)}
            </p>
          </div>
        </div>
      </div>
      
      {/* Asset Score Breakdown */}
      <div className="grid grid-cols-2 gap-2 mb-3">
        <div className="bg-gray-900/30 rounded p-2">
          <p className="text-xs text-gray-500">Asset Score</p>
          <p className={`text-2xl font-bold font-mono ${scoreColor}`}>
            {assetScore.final_score}
          </p>
        </div>
        <div className="bg-gray-900/30 rounded p-2">
          <p className="text-xs text-gray-500">Expected ROI</p>
          <p className="text-2xl font-bold font-mono text-green-500">
            +{assetScore.expected_roi.toFixed(1)}%
          </p>
        </div>
      </div>
      
      {/* Score Components (collapsible) */}
      <details className="text-sm">
        <summary className="cursor-pointer text-gray-400 hover:text-gray-300">
          Ver detalhes do score
        </summary>
        <div className="mt-2 space-y-1 pl-4">
          <ScoreBar label="Edge" value={assetScore.edge_score} />
          <ScoreBar label="Confidence" value={assetScore.confidence_score} />
          <ScoreBar label="Tier" value={assetScore.tier_score} />
          <ScoreBar label="Liquidity" value={assetScore.liquidity_score} />
        </div>
      </details>
      
      {/* Actions */}
      <div className="flex gap-2 mt-3">
        <button className="flex-1 bg-blue-600 hover:bg-blue-700 text-white py-2 rounded font-medium transition">
          Seguir Hórus
        </button>
        <button className="flex-1 border border-gray-700 hover:border-gray-600 text-white py-2 rounded font-medium transition">
          Aposta Manual
        </button>
      </div>
    </div>
  );
}

function ScoreBar({ label, value }: { label: string; value: number }) {
  return (
    <div>
      <div className="flex justify-between text-xs mb-1">
        <span className="text-gray-500">{label}</span>
        <span className="text-gray-300">{value}/100</span>
      </div>
      <div className="w-full bg-gray-800 rounded-full h-1.5">
        <div 
          className="bg-blue-500 h-1.5 rounded-full transition-all"
          style={{ width: `${value}%` }}
        />
      </div>
    </div>
  );
}
```

### 1.2 Dual Bankroll Interface

#### Dashboard Principal

```tsx
// components/DualBankrollDashboard.tsx

interface BankrollData {
  horus: {
    balance: number;
    roi: number;
    profit: number;
    totalBets: number;
    wins: number;
    losses: number;
  };
  manual: {
    balance: number;
    roi: number;
    profit: number;
    totalBets: number;
    wins: number;
    losses: number;
  };
  total: number;
}

export function DualBankrollDashboard({ data }: { data: BankrollData }) {
  const performanceGap = data.horus.roi - data.manual.roi;
  
  return (
    <div className="space-y-4">
      {/* Total Bankroll */}
      <div className="bg-gradient-to-br from-blue-600 to-purple-600 rounded-lg p-6">
        <p className="text-blue-100 text-sm mb-1">Capital Total</p>
        <h2 className="text-4xl font-bold text-white font-mono">
          R$ {data.total.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
        </h2>
      </div>
      
      {/* Dual Bankrolls */}
      <div className="grid md:grid-cols-2 gap-4">
        {/* Hórus Bankroll */}
        <div className="border border-blue-500/30 bg-blue-500/5 rounded-lg p-4">
          <div className="flex items-center gap-2 mb-3">
            <div className="w-8 h-8 bg-blue-500 rounded-full flex items-center justify-center">
              <Bot className="w-5 h-5 text-white" />
            </div>
            <div>
              <h3 className="font-semibold text-white">Bankroll Hórus</h3>
              <p className="text-xs text-gray-400">IA Automática</p>
            </div>
          </div>
          
          <div className="space-y-2">
            <div>
              <p className="text-sm text-gray-400">Saldo</p>
              <p className="text-2xl font-bold text-white font-mono">
                R$ {data.horus.balance.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
              </p>
            </div>
            
            <div className="grid grid-cols-2 gap-2">
              <div>
                <p className="text-xs text-gray-500">ROI</p>
                <p className={`text-lg font-semibold ${data.horus.roi >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                  {data.horus.roi >= 0 ? '+' : ''}{data.horus.roi.toFixed(2)}%
                </p>
              </div>
              <div>
                <p className="text-xs text-gray-500">Lucro</p>
                <p className={`text-lg font-semibold ${data.horus.profit >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                  {data.horus.profit >= 0 ? '+' : ''}R$ {Math.abs(data.horus.profit).toLocaleString('pt-BR')}
                </p>
              </div>
            </div>
            
            <div className="flex gap-4 text-sm">
              <div>
                <span className="text-gray-500">Apostas:</span>
                <span className="text-white ml-1">{data.horus.totalBets}</span>
              </div>
              <div>
                <span className="text-green-500">{data.horus.wins}W</span>
                <span className="text-gray-500 mx-1">/</span>
                <span className="text-red-500">{data.horus.losses}L</span>
              </div>
            </div>
          </div>
        </div>
        
        {/* Manual Bankroll */}
        <div className="border border-gray-700 bg-gray-900/50 rounded-lg p-4">
          <div className="flex items-center gap-2 mb-3">
            <div className="w-8 h-8 bg-gray-600 rounded-full flex items-center justify-center">
              <User className="w-5 h-5 text-white" />
            </div>
            <div>
              <h3 className="font-semibold text-white">Bankroll Manual</h3>
              <p className="text-xs text-gray-400">Suas Decisões</p>
            </div>
          </div>
          
          {data.manual.totalBets > 0 ? (
            <div className="space-y-2">
              <div>
                <p className="text-sm text-gray-400">Saldo</p>
                <p className="text-2xl font-bold text-white font-mono">
                  R$ {data.manual.balance.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                </p>
              </div>
              
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <p className="text-xs text-gray-500">ROI</p>
                  <p className={`text-lg font-semibold ${data.manual.roi >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                    {data.manual.roi >= 0 ? '+' : ''}{data.manual.roi.toFixed(2)}%
                  </p>
                </div>
                <div>
                  <p className="text-xs text-gray-500">Lucro</p>
                  <p className={`text-lg font-semibold ${data.manual.profit >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                    {data.manual.profit >= 0 ? '+' : ''}R$ {Math.abs(data.manual.profit).toLocaleString('pt-BR')}
                  </p>
                </div>
              </div>
              
              <div className="flex gap-4 text-sm">
                <div>
                  <span className="text-gray-500">Apostas:</span>
                  <span className="text-white ml-1">{data.manual.totalBets}</span>
                </div>
                <div>
                  <span className="text-green-500">{data.manual.wins}W</span>
                  <span className="text-gray-500 mx-1">/</span>
                  <span className="text-red-500">{data.manual.losses}L</span>
                </div>
              </div>
            </div>
          ) : (
            <div className="text-center py-6">
              <p className="text-gray-500 text-sm mb-3">
                Você ainda não fez apostas manuais
              </p>
              <button className="text-blue-500 hover:text-blue-400 text-sm font-medium">
                Fazer primeira aposta →
              </button>
            </div>
          )}
        </div>
      </div>
      
      {/* Performance Gap Alert */}
      {data.manual.totalBets > 0 && Math.abs(performanceGap) > 10 && (
        <div className={`border rounded-lg p-4 ${
          performanceGap > 0 
            ? 'border-yellow-500/30 bg-yellow-500/5' 
            : 'border-green-500/30 bg-green-500/5'
        }`}>
          <div className="flex items-start gap-3">
            <AlertCircle className={`w-5 h-5 mt-0.5 ${
              performanceGap > 0 ? 'text-yellow-500' : 'text-green-500'
            }`} />
            <div>
              <h4 className="font-semibold text-white mb-1">
                {performanceGap > 0 
                  ? 'Hórus está performando melhor' 
                  : 'Parabéns! Você está superando Hórus'}
              </h4>
              <p className="text-sm text-gray-400">
                {performanceGap > 0 
                  ? `Diferença de ${performanceGap.toFixed(1)}% no ROI. Considere seguir mais recomendações do Hórus.`
                  : `Diferença de ${Math.abs(performanceGap).toFixed(1)}% no ROI. Excelente!`}
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
```

### 1.3 Portfolio View

```tsx
// pages/Portfolio.tsx

interface Asset {
  id: string;
  match: Match;
  market: string;
  odd: number;
  stake: number;
  assetScore: number;
  classification: string;
  expectedProfit: number;
  status: 'pending' | 'won' | 'lost';
}

export function PortfolioPage() {
  const { data: assets } = useQuery<Asset[]>(['portfolio']);
  
  const stats = useMemo(() => {
    const pending = assets?.filter(a => a.status === 'pending') || [];
    const elite = pending.filter(a => a.classification === 'Elite');
    const premium = pending.filter(a => a.classification === 'Premium');
    const strong = pending.filter(a => a.classification === 'Strong');
    const moderate = pending.filter(a => a.classification === 'Moderate');
    
    const totalExposed = pending.reduce((sum, a) => sum + a.stake, 0);
    const totalExpected = pending.reduce((sum, a) => sum + a.expectedProfit, 0);
    
    return { elite, premium, strong, moderate, totalExposed, totalExpected };
  }, [assets]);
  
  return (
    <div className="max-w-7xl mx-auto p-6 space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-white mb-2">
          Minha Carteira
        </h1>
        <p className="text-gray-400">
          Ativos ativos e performance esperada
        </p>
      </div>
      
      {/* Portfolio Summary */}
      <div className="grid md:grid-cols-4 gap-4">
        <div className="bg-purple-500/10 border border-purple-500/30 rounded-lg p-4">
          <div className="flex items-center gap-2 mb-2">
            <div className="w-2 h-2 bg-purple-500 rounded-full" />
            <span className="text-sm text-gray-400">Elite</span>
          </div>
          <p className="text-2xl font-bold text-white">
            {stats.elite.length}
          </p>
        </div>
        
        <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-4">
          <div className="flex items-center gap-2 mb-2">
            <div className="w-2 h-2 bg-blue-500 rounded-full" />
            <span className="text-sm text-gray-400">Premium</span>
          </div>
          <p className="text-2xl font-bold text-white">
            {stats.premium.length}
          </p>
        </div>
        
        <div className="bg-green-500/10 border border-green-500/30 rounded-lg p-4">
          <div className="flex items-center gap-2 mb-2">
            <div className="w-2 h-2 bg-green-500 rounded-full" />
            <span className="text-sm text-gray-400">Strong</span>
          </div>
          <p className="text-2xl font-bold text-white">
            {stats.strong.length}
          </p>
        </div>
        
        <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-4">
          <div className="flex items-center gap-2 mb-2">
            <div className="w-2 h-2 bg-yellow-500 rounded-full" />
            <span className="text-sm text-gray-400">Moderate</span>
          </div>
          <p className="text-2xl font-bold text-white">
            {stats.moderate.length}
          </p>
        </div>
      </div>
      
      {/* Expected Performance */}
      <div className="bg-gradient-to-br from-gray-900 to-gray-800 rounded-lg p-6">
        <h3 className="text-lg font-semibold text-white mb-4">
          Performance Esperada
        </h3>
        <div className="grid md:grid-cols-3 gap-6">
          <div>
            <p className="text-sm text-gray-400 mb-1">Capital Exposto</p>
            <p className="text-2xl font-bold text-white font-mono">
              R$ {stats.totalExposed.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
            </p>
          </div>
          <div>
            <p className="text-sm text-gray-400 mb-1">Lucro Esperado</p>
            <p className="text-2xl font-bold text-green-500 font-mono">
              +R$ {stats.totalExpected.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
            </p>
          </div>
          <div>
            <p className="text-sm text-gray-400 mb-1">ROI Esperado</p>
            <p className="text-2xl font-bold text-blue-500 font-mono">
              +{((stats.totalExpected / stats.totalExposed) * 100).toFixed(1)}%
            </p>
          </div>
        </div>
      </div>
      
      {/* Assets List */}
      <div>
        <h3 className="text-lg font-semibold text-white mb-4">
          Ativos Ativos ({assets?.filter(a => a.status === 'pending').length || 0})
        </h3>
        <div className="space-y-3">
          {assets?.filter(a => a.status === 'pending').map(asset => (
            <AssetRowCard key={asset.id} asset={asset} />
          ))}
        </div>
      </div>
    </div>
  );
}
```

### 1.4 Checklist Fase 1

```markdown
## CHECKLIST IMPLEMENTAÇÃO FASE 1

### Backend (Supabase)
- [ ] Criar tabela `asset_scores`
- [ ] Criar tabela `user_bankrolls`
- [ ] Criar tabela `bets` (unificada)
- [ ] Migrar `virtual_bets` → `bets` (source='horus')
- [ ] Criar função `calculate_asset_score()`
- [ ] Criar trigger auto-atualização bankrolls
- [ ] Testar queries de performance

### Frontend (Lovable)
- [ ] Implementar `calculateAssetScore()` utility
- [ ] Criar componente `AssetCard`
- [ ] Criar componente `DualBankrollDashboard`
- [ ] Criar página `Portfolio`
- [ ] Atualizar página inicial com novo branding
- [ ] Atualizar cores (azul/dourado)
- [ ] Renomear "Arena Punter" → "Oráculo Mycroft"
- [ ] Atualizar toda terminologia (aposta→ativo, etc)

### Testes
- [ ] Testar cálculo asset score
- [ ] Testar dual bankroll tracking
- [ ] Testar migração banca virtual
- [ ] Verificar performance queries
- [ ] Mobile responsiveness

### Deploy
- [ ] Backup database
- [ ] Executar migração produção
- [ ] Validar dados migrados
- [ ] Monitorar erros primeiras 48h
```

---

## 🎮 FASE 2: GAMIFICAÇÃO

**Prazo:** 1-2 semanas  
**Prioridade:** ALTA  
**Objetivo:** Retenção via competição e prova social

### 2.1 Ranking Global

#### Sistema de Ranking

```sql
-- Função que atualiza ranking (executar 1x/dia via cron)

CREATE OR REPLACE FUNCTION update_global_ranking()
RETURNS void AS $$
BEGIN
  -- Limpar ranking anterior
  TRUNCATE global_ranking;
  
  -- Calcular e inserir novo ranking
  INSERT INTO global_ranking (
    user_id, username, avatar_url,
    total_bets, roi, total_profit, win_rate,
    sharpe_ratio, max_drawdown, rank, percentile, eligible
  )
  SELECT 
    u.id as user_id,
    u.username,
    u.avatar_url,
    
    -- Métricas
    COUNT(b.id) as total_bets,
    
    -- ROI
    CASE 
      WHEN SUM(b.stake) > 0 THEN (SUM(COALESCE(b.profit, 0)) / SUM(b.stake)) * 100
      ELSE 0
    END as roi,
    
    -- Lucro total
    SUM(COALESCE(b.profit, 0)) as total_profit,
    
    -- Win rate
    (COUNT(CASE WHEN b.status = 'won' THEN 1 END)::decimal / 
     NULLIF(COUNT(CASE WHEN b.status IN ('won', 'lost') THEN 1 END), 0) * 100) as win_rate,
    
    -- Sharpe ratio (simplificado)
    CASE 
      WHEN STDDEV(b.profit) > 0 THEN 
        AVG(b.profit) / STDDEV(b.profit)
      ELSE 0
    END as sharpe_ratio,
    
    -- Max drawdown (placeholder - cálculo real mais complexo)
    0 as max_drawdown,
    
    -- Rank (será atualizado depois)
    0 as rank,
    
    -- Percentile (será atualizado depois)
    0 as percentile,
    
    -- Elegível se >= 50 apostas
    COUNT(b.id) >= 50 as eligible
    
  FROM users u
  INNER JOIN bets b ON b.user_id = u.id
  WHERE b.status IN ('won', 'lost') -- só apostas finalizadas
  GROUP BY u.id, u.username, u.avatar_url
  HAVING COUNT(b.id) >= 10; -- mínimo 10 apostas pra aparecer
  
  -- Atualizar ranks
  WITH ranked AS (
    SELECT 
      user_id,
      ROW_NUMBER() OVER (ORDER BY roi DESC) as rank_num
    FROM global_ranking
    WHERE eligible = true
  )
  UPDATE global_ranking gr
  SET rank = ranked.rank_num
  FROM ranked
  WHERE gr.user_id = ranked.user_id;
  
  -- Atualizar percentiles
  WITH percentiles AS (
    SELECT 
      user_id,
      PERCENT_RANK() OVER (ORDER BY roi) * 100 as percentile_value
    FROM global_ranking
    WHERE eligible = true
  )
  UPDATE global_ranking gr
  SET percentile = percentiles.percentile_value
  FROM percentiles
  WHERE gr.user_id = percentiles.user_id;
  
END;
$$ LANGUAGE plpgsql;

-- Agendar execução diária (via Supabase Edge Function ou cron)
```

#### UI Ranking

```tsx
// pages/Ranking.tsx

interface RankedUser {
  rank: number;
  username: string;
  avatarUrl: string;
  totalBets: number;
  roi: number;
  profit: number;
  winRate: number;
  sharpeRatio: number;
  percentile: number;
  isCurrentUser: boolean;
}

export function RankingPage() {
  const { data: ranking } = useQuery<RankedUser[]>(['ranking']);
  const { data: currentUser } = useQuery<RankedUser>(['ranking', 'me']);
  
  return (
    <div className="max-w-6xl mx-auto p-6 space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-white mb-2">
          Ranking Global
        </h1>
        <p className="text-gray-400">
          Top investidores da plataforma • Atualizado diariamente
        </p>
      </div>
      
      {/* Current User Position */}
      {currentUser && (
        <div className="bg-gradient-to-r from-blue-600 to-purple-600 rounded-lg p-6">
          <p className="text-blue-100 text-sm mb-2">Sua Posição</p>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="text-5xl font-bold text-white">
                #{currentUser.rank}
              </div>
              <div>
                <p className="text-white font-semibold text-lg">
                  {currentUser.username}
                </p>
                <p className="text-blue-100 text-sm">
                  Top {currentUser.percentile.toFixed(0)}% dos investidores
                </p>
              </div>
            </div>
            <div className="text-right">
              <p className="text-blue-100 text-sm">ROI</p>
              <p className="text-3xl font-bold text-white">
                {currentUser.roi >= 0 ? '+' : ''}{currentUser.roi.toFixed(1)}%
              </p>
            </div>
          </div>
        </div>
      )}
      
      {/* Top 10 */}
      <div>
        <h2 className="text-xl font-semibold text-white mb-4">
          🏆 Top 10 Investidores
        </h2>
        <div className="space-y-2">
          {ranking?.slice(0, 10).map((user, idx) => (
            <div 
              key={user.rank}
              className={`
                border rounded-lg p-4 transition
                ${user.isCurrentUser 
                  ? 'border-blue-500 bg-blue-500/10' 
                  : 'border-gray-800 hover:border-gray-700'}
              `}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  {/* Medal/Rank */}
                  <div className={`
                    text-2xl font-bold w-12 text-center
                    ${idx === 0 ? 'text-yellow-500' : ''}
                    ${idx === 1 ? 'text-gray-400' : ''}
                    ${idx === 2 ? 'text-orange-600' : ''}
                    ${idx > 2 ? 'text-gray-600' : ''}
                  `}>
                    {idx === 0 && '🥇'}
                    {idx === 1 && '🥈'}
                    {idx === 2 && '🥉'}
                    {idx > 2 && `#${user.rank}`}
                  </div>
                  
                  {/* User Info */}
                  <div className="flex items-center gap-3">
                    <img 
                      src={user.avatarUrl || '/default-avatar.png'} 
                      alt={user.username}
                      className="w-10 h-10 rounded-full"
                    />
                    <div>
                      <p className="font-semibold text-white">
                        {user.username}
                        {user.isCurrentUser && (
                          <span className="ml-2 text-xs bg-blue-500 text-white px-2 py-0.5 rounded">
                            Você
                          </span>
                        )}
                      </p>
                      <p className="text-sm text-gray-400">
                        {user.totalBets} apostas • WR {user.winRate.toFixed(1)}%
                      </p>
                    </div>
                  </div>
                </div>
                
                {/* Stats */}
                <div className="flex gap-8">
                  <div className="text-right">
                    <p className="text-xs text-gray-500">ROI</p>
                    <p className={`text-xl font-bold ${
                      user.roi >= 0 ? 'text-green-500' : 'text-red-500'
                    }`}>
                      {user.roi >= 0 ? '+' : ''}{user.roi.toFixed(1)}%
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs text-gray-500">Lucro</p>
                    <p className={`text-xl font-bold ${
                      user.profit >= 0 ? 'text-green-500' : 'text-red-500'
                    }`}>
                      {user.profit >= 0 ? '+' : ''}R$ {Math.abs(user.profit).toLocaleString('pt-BR')}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs text-gray-500">Sharpe</p>
                    <p className="text-xl font-bold text-blue-500">
                      {user.sharpeRatio.toFixed(2)}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
      
      {/* Requirement Notice */}
      {currentUser && currentUser.totalBets < 50 && (
        <div className="border border-yellow-500/30 bg-yellow-500/5 rounded-lg p-4">
          <div className="flex items-start gap-3">
            <Info className="w-5 h-5 text-yellow-500 mt-0.5" />
            <div>
              <h4 className="font-semibold text-white mb-1">
                Complete {50 - currentUser.totalBets} apostas para entrar no ranking
              </h4>
              <p className="text-sm text-gray-400">
                O ranking oficial requer mínimo de 50 apostas finalizadas para garantir
                significância estatística.
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
```

### 2.2 Certificado de Performance

#### Geração do Certificado

```typescript
// utils/generateCertificate.ts

import { jsPDF } from 'jspdf';

interface CertificateData {
  userId: string;
  username: string;
  periodStart: Date;
  periodEnd: Date;
  metrics: {
    roi: number;
    profit: number;
    sharpeRatio: number;
    maxDrawdown: number;
    winRate: number;
    profitFactor: number;
    totalBets: number;
    avgScore: number;
  };
  rank: number;
  percentile: number;
}

export async function generateCertificate(data: CertificateData): Promise<string> {
  const doc = new jsPDF({
    orientation: 'landscape',
    unit: 'mm',
    format: 'a4'
  });
  
  const width = doc.internal.pageSize.getWidth();
  const height = doc.internal.pageSize.getHeight();
  
  // Background gradient (simulado com retângulos)
  doc.setFillColor(26, 31, 54); // #1a1f36
  doc.rect(0, 0, width, height, 'F');
  
  // Border
  doc.setDrawColor(59, 130, 246); // blue
  doc.setLineWidth(1);
  doc.rect(10, 10, width - 20, height - 20);
  
  // Logo/Header
  doc.setFontSize(32);
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.text('ORÁCULO MYCROFT', width / 2, 30, { align: 'center' });
  
  doc.setFontSize(14);
  doc.setTextColor(156, 163, 175); // gray
  doc.setFont('helvetica', 'normal');
  doc.text('Plataforma de Investimento Esportivo', width / 2, 38, { align: 'center' });
  
  // Title
  doc.setFontSize(24);
  doc.setTextColor(59, 130, 246); // blue
  doc.setFont('helvetica', 'bold');
  doc.text('CERTIFICADO DE PERFORMANCE', width / 2, 55, { align: 'center' });
  
  // User Info
  doc.setFontSize(18);
  doc.setTextColor(255, 255, 255);
  doc.text(`Investidor: ${data.username} (#${data.userId.slice(0, 8)})`, width / 2, 70, { align: 'center' });
  
  doc.setFontSize(12);
  doc.setTextColor(156, 163, 175);
  const period = `Período: ${format(data.periodStart, 'dd/MM/yyyy')} - ${format(data.periodEnd, 'dd/MM/yyyy')}`;
  doc.text(period, width / 2, 78, { align: 'center' });
  
  // Metrics Grid
  const startY = 95;
  const colWidth = (width - 40) / 3;
  
  // Column 1
  drawMetric(doc, 30, startY, 'ROI', `${data.metrics.roi >= 0 ? '+' : ''}${data.metrics.roi.toFixed(2)}%`, data.metrics.roi >= 0);
  drawMetric(doc, 30, startY + 25, 'Sharpe Ratio', data.metrics.sharpeRatio.toFixed(2), true);
  drawMetric(doc, 30, startY + 50, 'Total Apostas', data.metrics.totalBets.toString(), true);
  
  // Column 2
  drawMetric(doc, 30 + colWidth, startY, 'Lucro', `R$ ${data.metrics.profit.toLocaleString('pt-BR')}`, data.metrics.profit >= 0);
  drawMetric(doc, 30 + colWidth, startY + 25, 'Win Rate', `${data.metrics.winRate.toFixed(1)}%`, true);
  drawMetric(doc, 30 + colWidth, startY + 50, 'Score Médio', data.metrics.avgScore.toFixed(1), true);
  
  // Column 3
  drawMetric(doc, 30 + colWidth * 2, startY, 'Max Drawdown', `${data.metrics.maxDrawdown.toFixed(1)}%`, false);
  drawMetric(doc, 30 + colWidth * 2, startY + 25, 'Profit Factor', data.metrics.profitFactor.toFixed(2), true);
  drawMetric(doc, 30 + colWidth * 2, startY + 50, 'Ranking', `Top ${data.percentile.toFixed(0)}%`, true);
  
  // Footer
  doc.setFontSize(10);
  doc.setTextColor(107, 114, 128);
  doc.text('Certificado verificável em:', width / 2, height - 25, { align: 'center' });
  
  doc.setFontSize(12);
  doc.setTextColor(59, 130, 246);
  const certUrl = `oraculo.mycroft.com/cert/${data.userId}`;
  doc.textWithLink(certUrl, width / 2, height - 20, { 
    align: 'center',
    url: `https://${certUrl}`
  });
  
  doc.setFontSize(8);
  doc.setTextColor(107, 114, 128);
  doc.text(`Gerado em ${format(new Date(), 'dd/MM/yyyy HH:mm')}`, width / 2, height - 12, { align: 'center' });
  
  // Save and return URL
  const blob = doc.output('blob');
  const fileName = `certificate_${data.userId}_${Date.now()}.pdf`;
  
  // Upload to Supabase Storage
  const { data: uploadData, error } = await supabase.storage
    .from('certificates')
    .upload(fileName, blob, {
      contentType: 'application/pdf',
      upsert: false
    });
  
  if (error) throw error;
  
  const { data: urlData } = supabase.storage
    .from('certificates')
    .getPublicUrl(fileName);
  
  return urlData.publicUrl;
}

function drawMetric(doc: jsPDF, x: number, y: number, label: string, value: string, positive: boolean) {
  doc.setFontSize(10);
  doc.setTextColor(156, 163, 175);
  doc.setFont('helvetica', 'normal');
  doc.text(label, x, y);
  
  doc.setFontSize(16);
  doc.setFont('helvetica', 'bold');
  
  if (label === 'ROI' || label === 'Lucro') {
    doc.setTextColor(positive ? 16, 185, 129 : 239, 68, 68); // green or red
  } else {
    doc.setTextColor(255, 255, 255);
  }
  
  doc.text(value, x, y + 8);
}
```

#### UI Certificado

```tsx
// components/CertificateGenerator.tsx

export function CertificateGenerator() {
  const [generating, setGenerating] = useState(false);
  const [period, setPeriod] = useState<'week' | 'month' | 'all'>('month');
  
  const handleGenerate = async () => {
    setGenerating(true);
    try {
      const response = await fetch('/api/certificates/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ period })
      });
      
      const { certificateUrl, id } = await response.json();
      
      // Save to database
      await supabase.from('certificates').insert({
        user_id: currentUserId,
        period_start: getPeriodStart(period),
        period_end: new Date(),
        metrics: await fetchMetrics(period),
        pdf_url: certificateUrl
      });
      
      // Open share modal
      setShareModalOpen(true);
      setCertificateUrl(certificateUrl);
      
    } catch (error) {
      toast.error('Erro ao gerar certificado');
    } finally {
      setGenerating(false);
    }
  };
  
  return (
    <div className="border border-gray-800 rounded-lg p-6">
      <h3 className="text-lg font-semibold text-white mb-4">
        Gerar Certificado de Performance
      </h3>
      
      <div className="space-y-4">
        {/* Period Selection */}
        <div>
          <label className="text-sm text-gray-400 mb-2 block">
            Período
          </label>
          <div className="grid grid-cols-3 gap-2">
            {(['week', 'month', 'all'] as const).map(p => (
              <button
                key={p}
                onClick={() => setPeriod(p)}
                className={`
                  py-2 px-4 rounded border transition
                  ${period === p 
                    ? 'border-blue-500 bg-blue-500/10 text-blue-500' 
                    : 'border-gray-700 text-gray-400 hover:border-gray-600'}
                `}
              >
                {p === 'week' && 'Última semana'}
                {p === 'month' && 'Último mês'}
                {p === 'all' && 'Todo período'}
              </button>
            ))}
          </div>
        </div>
        
        {/* Generate Button */}
        <button
          onClick={handleGenerate}
          disabled={generating}
          className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-gray-700 text-white py-3 rounded font-medium transition"
        >
          {generating ? 'Gerando...' : 'Gerar Certificado PDF'}
        </button>
        
        {/* Info */}
        <p className="text-xs text-gray-500 text-center">
          O certificado inclui todas suas métricas verificáveis e pode ser compartilhado
          nas redes sociais.
        </p>
      </div>
    </div>
  );
}
```

### 2.3 Achievements/Badges (Opcional)

```typescript
// types/achievements.ts

export const ACHIEVEMENTS = {
  first_bet: {
    id: 'first_bet',
    name: 'Primeiro Passo',
    description: 'Realizou sua primeira aposta',
    icon: '🎯',
    rarity: 'common'
  },
  streak_10: {
    id: 'streak_10',
    name: 'Em Chamas',
    description: '10 apostas seguidas lucrativas',
    icon: '🔥',
    rarity: 'rare'
  },
  roi_50: {
    id: 'roi_50',
    name: 'Retorno Sólido',
    description: 'ROI acima de 50%',
    icon: '📈',
    rarity: 'epic'
  },
  follow_horus_100: {
    id: 'follow_horus_100',
    name: 'Discípulo de Hórus',
    description: 'Seguiu 100 recomendações de Hórus',
    icon: '🛡️',
    rarity: 'rare'
  },
  top_10: {
    id: 'top_10',
    name: 'Elite Global',
    description: 'Alcançou Top 10 do ranking',
    icon: '👑',
    rarity: 'legendary'
  }
  // ... mais achievements
} as const;
```

### 2.4 Checklist Fase 2

```markdown
## CHECKLIST IMPLEMENTAÇÃO FASE 2

### Backend
- [ ] Criar tabela `global_ranking`
- [ ] Criar tabela `certificates`
- [ ] Criar função `update_global_ranking()`
- [ ] Criar Edge Function `generate_certificate`
- [ ] Configurar Supabase Storage para PDFs
- [ ] Agendar cron diário ranking
- [ ] (Opcional) Criar tabela `achievements`

### Frontend
- [ ] Criar página `Ranking`
- [ ] Criar componente `CertificateGenerator`
- [ ] Criar modal share certificado
- [ ] Adicionar botões social share
- [ ] (Opcional) Sistema achievements/badges
- [ ] Notificações subida ranking

### Testes
- [ ] Testar geração PDF
- [ ] Verificar cálculo rankings
- [ ] Testar share social
- [ ] Performance queries ranking

### Marketing
- [ ] Template Instagram share
- [ ] Template Twitter share
- [ ] Email notificação novo rank
```

---

## 📊 FASE 3: ANALYTICS AVANÇADO

**Prazo:** 1-2 semanas  
**Prioridade:** MÉDIA  
**Objetivo:** Transparência e insights avançados

### 3.1 Pattern Insights

```sql
-- View materializada para patterns
CREATE MATERIALIZED VIEW pattern_insights_mv AS
SELECT 
  m.league,
  b.market,
  COUNT(*) as sample_size,
  AVG(CASE WHEN b.status = 'won' THEN 1 ELSE 0 END) * 100 as win_rate,
  (SUM(COALESCE(b.profit, 0)) / SUM(b.stake)) * 100 as roi,
  AVG(a.final_score) as avg_score,
  CASE 
    WHEN COUNT(*) >= 500 AND (SUM(COALESCE(b.profit, 0)) / SUM(b.stake)) * 100 > 10 THEN 'High'
    WHEN COUNT(*) >= 300 AND (SUM(COALESCE(b.profit, 0)) / SUM(b.stake)) * 100 > 5 THEN 'Medium'
    ELSE 'Low'
  END as confidence
FROM bets b
INNER JOIN matches m ON m.id = b.match_id
LEFT JOIN asset_scores a ON a.match_id = b.match_id AND a.market = b.market
WHERE b.status IN ('won', 'lost')
GROUP BY m.league, b.market
HAVING COUNT(*) >= 100;

-- Refresh diário
REFRESH MATERIALIZED VIEW pattern_insights_mv;
```

### 3.2 Advanced Charts

```tsx
// components/AdvancedCharts.tsx

import { LineChart, Line, AreaChart, Area, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';

export function BankrollEvolutionChart({ data }: { data: any[] }) {
  return (
    <div className="bg-gray-900 rounded-lg p-6">
      <h3 className="text-lg font-semibold text-white mb-4">
        Evolução do Bankroll
      </h3>
      <ResponsiveContainer width="100%" height={300}>
        <AreaChart data={data}>
          <defs>
            <linearGradient id="colorHorus" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3}/>
              <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
            </linearGradient>
            <linearGradient id="colorManual" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#6b7280" stopOpacity={0.3}/>
              <stop offset="95%" stopColor="#6b7280" stopOpacity={0}/>
            </linearGradient>
          </defs>
          <XAxis 
            dataKey="date" 
            stroke="#6b7280"
            tick={{ fill: '#9ca3af' }}
          />
          <YAxis 
            stroke="#6b7280"
            tick={{ fill: '#9ca3af' }}
          />
          <Tooltip 
            contentStyle={{ 
              backgroundColor: '#1f2937', 
              border: '1px solid #374151',
              borderRadius: '8px'
            }}
          />
          <Area 
            type="monotone" 
            dataKey="horus" 
            stroke="#3b82f6" 
            fillOpacity={1} 
            fill="url(#colorHorus)"
            name="Hórus"
          />
          <Area 
            type="monotone" 
            dataKey="manual" 
            stroke="#6b7280" 
            fillOpacity={1} 
            fill="url(#colorManual)"
            name="Manual"
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

export function AssetScoreDistribution({ data }: { data: any[] }) {
  return (
    <div className="bg-gray-900 rounded-lg p-6">
      <h3 className="text-lg font-semibold text-white mb-4">
        Distribuição de Asset Scores
      </h3>
      <ResponsiveContainer width="100%" height={250}>
        <BarChart data={data}>
          <XAxis 
            dataKey="range" 
            stroke="#6b7280"
            tick={{ fill: '#9ca3af' }}
          />
          <YAxis 
            stroke="#6b7280"
            tick={{ fill: '#9ca3af' }}
          />
          <Tooltip 
            contentStyle={{ 
              backgroundColor: '#1f2937', 
              border: '1px solid #374151',
              borderRadius: '8px'
            }}
          />
          <Bar dataKey="count" fill="#3b82f6" radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
```

### 3.3 Checklist Fase 3

```markdown
## CHECKLIST IMPLEMENTAÇÃO FASE 3

### Backend
- [ ] Criar materialized view `pattern_insights_mv`
- [ ] Configurar refresh automático
- [ ] Endpoints analytics avançado

### Frontend
- [ ] Página Analytics completa
- [ ] Gráficos Recharts
- [ ] Export dados CSV
- [ ] Filtros avançados

### Testes
- [ ] Performance queries analytics
- [ ] Testar export dados
```

---

## 🤖 FASE 4: AUTOMAÇÃO (FUTURO)

**Prazo:** TBD  
**Prioridade:** BAIXA  
**Objetivo:** Auto-execução e ML avançado

**NOTA:** Esta fase só deve ser implementada após validação completa das Fases 1-3.

### 4.1 Auto-execution Bot

- Integração Betfair API
- Auto-place nas recomendações Hórus
- Gestão automática de stake
- Monitoramento em tempo real

### 4.2 Advanced ML

- Pattern mining automático
- Anomaly detection
- Adaptive learning

### 4.3 Multi-exchange

- Arbitragem automática
- Routing inteligente
- Liquidez agregada

---

## ✅ CHECKLIST DE DEPLOY

### Pré-Deploy

```markdown
- [ ] Backup completo database
- [ ] Testar migração em staging
- [ ] Validar todos os cálculos
- [ ] Review segurança (RLS policies)
- [ ] Preparar rollback plan
```

### Deploy Fase 1

```markdown
- [ ] Executar migrations SQL
- [ ] Deploy frontend Lovable
- [ ] Monitorar errors (48h)
- [ ] Coletar feedback usuários beta
- [ ] Ajustar bugs críticos
```

### Pós-Deploy

```markdown
- [ ] Anunciar novo branding
- [ ] Atualizar landing page
- [ ] Campanha email usuários
- [ ] Posts redes sociais
- [ ] Monitor métricas adoção
```

---

## 📋 PRIORIZAÇÃO FINAL

### Mês 1 (CRÍTICO)
✅ Fase 1 completa - MVP Investimento

### Mês 2 (ALTA)
✅ Fase 2 completa - Gamificação

### Mês 3 (MÉDIA)
✅ Fase 3 completa - Analytics

### Mês 4+ (BAIXA)
⚠️ Fase 4 - Automação (apenas se necessário)

---

## 🎯 MÉTRICAS DE SUCESSO

### Fase 1
- [ ] 100% usuários veem Asset Score
- [ ] 80%+ aprovação novo branding
- [ ] Dual Bankroll tracking funcionando
- [ ] Zero bugs críticos

### Fase 2
- [ ] 50%+ usuários geraram certificado
- [ ] Ranking atualizado diariamente
- [ ] 1000+ shares social media

### Fase 3
- [ ] 30%+ usuários usam analytics
- [ ] Pattern insights gerados
- [ ] Export dados funcionando

---

**FIM DO DOCUMENTO**

**Versão:** 1.0  
**Última atualização:** 06/03/2026  
**Próxima revisão:** Pós Fase 1 deploy  

**Contato:** Israel Barbosa - Bluffer Entertainment
