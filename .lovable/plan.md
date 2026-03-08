# Plano de Implementação — Oráculo Mycroft

## Análise do Status Atual vs Plano Original

### LEGENDA
- ✅ Implementado
- ⚠️ Parcialmente implementado
- ❌ Não implementado

---

## FASE 1 — Infraestrutura de Dados

| Item | Status | Detalhes |
|------|--------|---------|
| Tabela `punter_analyses` (= arena_predictions) | ✅ | Existe com campos: match_id, market, odd, confidence, verdict, thesis, value_percentage, estimated_probability, fair_odd |
| Tabela `punter_signals` (= arena_bets do Hórus) | ✅ | Existe com: match_id, market, odd, result, profit_loss, stake_percentage |
| Tabela `sports_bankroll` + `manual_bankroll` (= arena_bankroll) | ✅ | Dual bankroll implementado |
| Tabela `market_analysis` (MIS/ODI) | ✅ | Campos: prob_model, prob_market, market_inefficiency_score, odds_drift_index |
| Tabela `sharp_money_signals` | ✅ | Campos: has_rlm, has_steam, has_consensus, sharp_activity_score |
| Tabela `bet_correlations` | ✅ | Campos: market_a, market_b, correlation_coefficient |
| Tabela `model_performance` | ✅ | Campos: roi, win_rate, profit, avg_edge, avg_odd |
| Tabela `punter_rankings` | ✅ | Ranking global com ROI, sharpe_ratio, profit_factor, max_drawdown |
| Tabela `daily_summaries` | ✅ | Resumos diários por usuário |
| Tabela `arena_matches` | ✅ | **CRIADA** - Sprint 1: partidas com xG, stats, resultado |
| Tabela `arena_odds` | ✅ | **CRIADA** - Sprint 1: odds por bookmaker com open/close/current |
| Tabela `arena_patterns` | ✅ | **CRIADA** - Sprint 1: padrões lucrativos por liga/mercado |
| Tabela `bets_history` | ✅ | **CRIADA** - Sprint 1: histórico unificado com CLV, asset_score, source |
| Tabela `market_analysis` (MIS/ODI) | ✅ | Campos: prob_model, prob_market, market_inefficiency_score, odds_drift_index |
| Tabela `sharp_money_signals` | ✅ | Campos: has_rlm, has_steam, has_consensus, sharp_activity_score |
| Tabela `bet_correlations` | ✅ | Campos: market_a, market_b, correlation_coefficient |
| Tabela `model_performance` | ✅ | Campos: roi, win_rate, profit, avg_edge, avg_odd |
| Tabela `punter_rankings` | ✅ | Ranking global com ROI, sharpe_ratio, profit_factor, max_drawdown |
| Tabela `daily_summaries` | ✅ | Resumos diários por usuário |
| Tabela `arena_matches` (histórico estruturado de partidas) | ❌ | Não existe. Falta tabela centralizada de partidas com season, xG, stats |
| Tabela `arena_odds` (histórico de odds por bookmaker) | ❌ | Não existe. Crucial para CLV, odds drift histórico |
| Tabela `arena_patterns` (Pattern Mining) | ❌ | Não existe. Necessária para Pattern Mining Engine |
| Tabela `arena_bets` (registro unificado de apostas user+IA) | ❌ | Parcial via punter_signals. Falta registro de apostas manuais com tracking completo |
| Tabela `bets_history` (Self Learning data) | ❌ | Não existe. Necessária para Self Learning Engine |

---

## FASE 2 — Betting Asset Score

| Item | Status | Detalhes |
|------|--------|---------|
| Fórmula do Asset Score | ✅ | **SPRINT 1** - Edge Function `betting-asset-score` com fórmula BAS completa (25% Prob + 25% Edge + 20% Stats + 15% Pattern + 15% Liquidity) |
| Classificação ELITE/PREMIUM/STRONG/SPECULATIVE | ✅ | **SPRINT 1** - Implementado na Edge Function + serviço frontend |
| Edge Function dedicada para cálculo | ✅ | **SPRINT 1** - `betting-asset-score` com suporte batch + cache |
| Serviço frontend | ✅ | **SPRINT 1** - `bettingAssetScoreService.ts` com cache em memória |

---

## FASE 3 — Pattern Mining Engine

| Item | Status | Detalhes |
|------|--------|---------|
| Análise por liga + mercado | ✅ | **SPRINT 2** - Edge Function `pattern-mining-engine` analisa bets_history por liga+mercado |
| ROI histórico por padrão | ✅ | **SPRINT 2** - Calcula ROI, win_rate, avg_odd e upsert em arena_patterns |
| Confidence boost no modelo | ✅ | **SPRINT 2** - Fórmula de confidence com bonus por sample size e ROI |

---

## FASE 4 — Bankroll AI (Kelly Criterion)

| Item | Status | Detalhes |
|------|--------|---------|
| Cálculo Kelly 25% | ✅ | **SPRINT 2** - Edge Function `bankroll-ai-kelly` com Kelly fracionário |
| Gestão automática de stake | ✅ | **SPRINT 2** - Asset Score modulation (ELITE=35%, PREMIUM=30%, STRONG=25%) |
| Proteção de drawdown automática | ✅ | **SPRINT 2** - Redução progressiva: 10%→25%, 20%→50%, 30%→75% |

---

## FASE 5 — Dual Bankroll

| Item | Status | Detalhes |
|------|--------|---------|
| Tabelas `sports_bankroll` + `manual_bankroll` | ✅ | Existem |
| Component `DualBankrollDashboard` | ✅ | Existe em src/components/punter/ |
| Separação source=horus vs source=user | ⚠️ | Parcial. Registros de apostas manuais precisam melhorar |

---

## FASE 6 — Ranking Global

| Item | Status | Detalhes |
|------|--------|---------|
| Tabela `punter_rankings` | ✅ | Completa com ROI, sharpe_ratio, profit_factor, etc |
| Component `PunterRankings` | ✅ | Existe |
| Mínimo 50 apostas | ❌ | Não há filtro mínimo implementado |

---

## FASE 7 — Certificado de Performance

| Item | Status | Detalhes |
|------|--------|---------|
| Component `PerformanceCertificate` | ✅ | Existe |
| Métricas (ROI, drawdown, sharpe, profit factor) | ⚠️ | Parcial, depende dos dados populados |
| Compartilhamento social (Instagram, Twitter, WhatsApp) | ❌ | Não implementado |
| Gráfico de crescimento da banca | ❌ | Não implementado no certificado |

---

## FASE 8 — Modo Simulado (Backtest)

| Item | Status | Detalhes |
|------|--------|---------|
| Component `BacktestPanel` | ✅ | Existe |
| Edge Function `mycroft-punter-backtest` | ✅ | Existe |
| Integração com dados históricos reais | ❌ | Sem tabela arena_matches/arena_odds |
| Exibição ROI/greens/reds/drawdown simulado | ⚠️ | Parcial |

---

## FASE 9 — Simulação Monte Carlo

| Item | Status | Detalhes |
|------|--------|---------|
| Engine de simulação 10k runs | ❌ | Não implementado |
| Risco de ruína, drawdown médio, ROI esperado | ❌ | Não implementado |
| Visualização gráfica | ❌ | Não implementado |

---

## FASE 10 — Dashboard Profissional

| Item | Status | Detalhes |
|------|--------|---------|
| Página Punter principal | ✅ | Existe com widgets |
| Dual Bankroll no dashboard | ✅ | Existe |
| Market Detectors Panel | ✅ | Existe (MarketDetectorsPanel) |
| Performance Gap | ✅ | Existe |
| Odds Evolution | ✅ | Existe |
| Performance by Time | ✅ | Existe |
| Daily Summary Widget | ✅ | Existe |
| Missed Opportunities | ✅ | Existe |

---

## MÓDULOS AVANÇADOS (Plano Mycroft v2)

| Módulo | Status | Detalhes |
|--------|--------|---------|
| Market Manipulation Detector (MMD) | ⚠️ | Tabela `market_analysis` existe com MIS/ODI. Falta engine automática |
| Sharp Money & Liquidity Detector (SMLD) | ⚠️ | Tabela `sharp_money_signals` existe. Falta engine de detecção real-time |
| Self Learning Betting Engine (SLBE) | ❌ | Não implementado. Precisa tabelas de histórico + recalibração |
| Portfolio Optimization Engine (APE) | ❌ | Não implementado. Correlação existe na tabela bet_correlations mas sem engine |
| CLV Engine (Closing Line Value) | ❌ | Não implementado. Precisa odds de abertura vs fechamento |
| Smart Odds Scanner (cross-bookmaker) | ❌ | Não implementado |
| Anti-Limiting Engine | ❌ | Não implementado (delay, diversificação, randomização) |
| Poisson/Dixon-Coles Model | ❌ | Não implementado |
| Ensemble Models (Poisson + xG + ELO + Market) | ❌ | Não implementado |
| Monte Carlo Risk Engine | ❌ | Não implementado |

---

## PLANO DE EXECUÇÃO RECOMENDADO

### Sprint 1 — Tabelas faltantes + Asset Score (Semana 1)
1. Criar tabela `arena_matches` (partidas históricas com xG, stats)
2. Criar tabela `arena_odds` (odds por bookmaker com timestamp)
3. Criar tabela `arena_patterns` (padrões lucrativos por liga/mercado)
4. Criar tabela `bets_history` (histórico unificado para self-learning)
5. Implementar Edge Function `betting-asset-score` com fórmula BAS completa
6. Adicionar classificação ELITE/PREMIUM/STRONG/SPECULATIVE nos signals

### Sprint 2 — Pattern Mining + Bankroll AI (Semana 2)
7. Criar Edge Function `pattern-mining-engine` (analisa ROI por liga/mercado)
8. Implementar Kelly Criterion Engine (cálculo automático de stake)
9. Implementar proteção de drawdown (redução automática de stake)
10. Adicionar filtro mínimo de 50 apostas no ranking

### Sprint 3 — Certificado + Monte Carlo (Semana 3)
11. Adicionar gráfico de crescimento de banca no certificado
12. Implementar compartilhamento social (share API)
13. Criar Edge Function `monte-carlo-simulation` (10k runs)
14. Criar componente de visualização Monte Carlo (risco de ruína, drawdown esperado)

### Sprint 4 — Módulos Avançados v1 (Semana 4)
15. Implementar CLV Engine (comparar odd entrada vs fechamento)
16. Implementar Portfolio Optimization (ajuste de stake por correlação)
17. Ativar Self Learning Engine (recalibração mensal baseada em resultados)
18. Implementar Smart Odds Scanner (detecção cross-bookmaker)

### Sprint 5 — Módulos Avançados v2 (Semana 5)
19. Implementar modelo Poisson/Dixon-Coles
20. Implementar Ensemble Models
21. Anti-Limiting Engine (delay, diversificação, randomização)
22. Dashboard de métricas CLV + Market Beat Rate

---

## RESUMO

| Categoria | Total | ✅ | ⚠️ | ❌ |
|-----------|-------|----|----|-----|
| Infraestrutura (tabelas) | 14 | 9 | 0 | 5 |
| Features core (Fases 2-9) | 20 | 5 | 5 | 10 |
| Módulos avançados (v2) | 10 | 0 | 2 | 8 |
| Dashboard/UI | 8 | 8 | 0 | 0 |
| **TOTAL** | **52** | **22 (42%)** | **7 (13%)** | **23 (44%)** |

A infraestrutura de tabelas está ~64% pronta. O dashboard/UI está 100% no lugar. O maior gap está nos **engines de cálculo** (Asset Score, Pattern Mining, Kelly, Monte Carlo, CLV, Portfolio Optimization) e nas **tabelas de dados históricos** que alimentam esses engines.
