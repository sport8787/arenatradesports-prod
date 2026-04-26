---
name: Sherlock Engine (Punter)
description: Camada estatística avançada (CV, médias casa/fora, saldo) aplicada em duas frentes — automaticamente no mycroft-punter-anthropic e sob demanda via mycroft-punter-analytic. Veto Sherlock também replicado no eventos-raros-prelive para LAY GOLEADA.
type: feature
---

## Sherlock — onde vive

1. **Automático**: dentro de `mycroft-punter-anthropic` (parser pós-IA, antes do insert em `punter_analyses`). Função `applySherlockRules()` + `getOrComputeAdvancedStats()` (cache 24h em `team_advanced_stats`).
2. **Sob demanda**: edge `mycroft-punter-analytic` (determinística, sem IA). Recebe `home_team/away_team/home_id/away_id/season/market/plan_name/analysis_id` e devolve relatório `{ veto, veto_reason, confidence_delta, notes, bonus, vetos, home_stats, away_stats }`. Se `analysis_id` + veto, faz UPDATE em `punter_analyses` setando `verdict='VETADO'`.
3. **Eventos Raros**: `eventos-raros-prelive` aplica veto Sherlock em LAY_GOLEADA (saldo médio mandante > 1.2). Se houver alternativo válido, promove; senão marca DESCARTADO com `motivo_descarte = "Sherlock VETO: ..."`.

## Regras

- **VETO LAY GOLEADA**: saldo médio mandante (home_avg_goals_scored − home_avg_goals_conceded) > 1.2 OU CV ofensivo/defensivo > 1.0.
- **−5pp confiança**: time imprevisível (CV > 1.0).
- **+5pp Over 2.5**: mandante CV ofensivo < 0.5 + média > 1.5.
- **+3pp Under 2.5**: mandante CV defensivo < 0.6 + sofridos < 1.0.
- **+2pp Under 2.5**: visitante CV defensivo < 0.6 + sofridos < 1.0.

## UI

Componente `src/components/punter/SherlockAnalyticButton.tsx` — botão por sinal na lista de "Ativos Identificados" da Arena Punter. Abre modal com indicadores, vetos e bônus. Toast de feedback.
