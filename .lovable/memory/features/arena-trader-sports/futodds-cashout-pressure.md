---
name: Cash-Out Inteligente Futodds (pressão adversa)
description: Regra adicional em evaluate-cashout que usa pressure_indices + last5min/last10min Futodds para sinalizar SAIR/ATENÇÃO em Back Casa, Back Fora e Over X.5 (jogo morto). Roda após Under25 e antes da saúde genérica.
type: feature
---

## Regra `evaluateFutoddsPressure` (supabase/functions/evaluate-cashout/index.ts)

- Só ativa se `live_matches.stats` tem `pressure_home/away` ou `last5min_stats/last10min_stats` (campos Futodds).
- **Back Casa / Back Fora**:
  - CRITICAL: pressão adversária ≥ 75 com Δ ≥ 15 contra; OU dangerous_attacks últ.5min ≥ 6 e ≥ 3× nosso lado.
  - WARNING: pressão adversária ≥ 65 com Δ ≥ 15; OU empatando/perdendo + pressão adversária ≥ 55 com Δ ≥ 10.
  - Não dispara se nosso lado vencendo por ≥ 2 gols.
- **Over X.5** (≥60'):
  - CRITICAL (≥75'): jogo morto últ.10min (DA<4 + 0 chutes a gol) e ainda faltam gols.
  - WARNING: jogo morto, qualquer tempo ≥60'.

## Prioridade no merge final
1. UNDER X.5 (`evaluateUnderPressure`)
2. FUTODDS pressão (`evaluateFutoddsPressure`)
3. Saúde genérica (`classificarSaude`)

Logs em `cashout_signals_log` com `signal_type` ∈ `BACK_PRESSURE_CRITICAL`, `BACK_PRESSURE_WARN`, `OVER_DEAD_GAME`, `OVER_LOW_MOMENTUM`. Som crítico em ActivePositions já dispara via realtime quando severity = CRITICAL.
