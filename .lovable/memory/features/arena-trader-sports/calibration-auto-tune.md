---
name: Arena Calibration (auto-tune)
description: Tabela arena_calibration_state + RPCs compute/refresh por arena (cron 30min). CalibrationCard exibe acerto/ROI/limite no /arena-trader-sports. Helper _shared/calibrationFloor.ts rebaixa APROVADO* para AGUARDAR quando confidence < effective_min_confidence em analyze-live-matches e mycroft-punter-anthropic.
type: feature
---

## Tabela `arena_calibration_state`
Uma linha por arena (`trader_sports`, `punter`): sample_size, greens, reds, hit_rate, roi, base_min_confidence (default 70), delta, effective_min_confidence, last_settled_at. RLS read público.

## RPCs
- `compute_arena_calibration(arena, limit=50)` — métricas das últimas N liquidadas (mycroft_analyses para Trader; punter_signals para Punter). ROI = média de unidades por op (profit_loss/stake_amount, fallback odd-1).
- `refresh_arena_calibration(arena, limit=50)` — recalcula e upserta state. Tuning só com sample ≥ 20:
  - hit_rate <50% → +10 ; <60% → +5 ; <70% → 0 ; ≥70% → -3.
  - effective clampado em [60, 85].

## Cron
`arena-calibration-refresh` a cada 30min roda refresh para as duas arenas. Edge `calibration-tuner` permite trigger manual.

## Gates de produção
`_shared/calibrationFloor.ts` (cache 60s) é importado em:
- `supabase/functions/analyze-live-matches/index.ts` (após anti-dup, antes do insert mycroft_analyses).
- `supabase/functions/mycroft-punter-anthropic/index.ts` (após Sherlock, antes do upsert punter_sinais).

Se sample_size < 20, fallback 70 — sem rebaixamento.

## UI
`src/components/dashboard/CalibrationCard.tsx` montado no topo do main em `/arena-trader-sports`. Lê tabela + realtime postgres_changes. Esconde quando sample_size = 0.
