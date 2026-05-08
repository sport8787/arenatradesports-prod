---
name: Momentum Shift (jogo virando) Futodds
description: evaluateMomentumShift em evaluate-cashout compara last10 vs last20 Futodds para detectar virada antes do gol em mercados Back Casa/Fora. Roda após Under e Pressão Adversa.
type: feature
---

## Regra `evaluateMomentumShift` (supabase/functions/evaluate-cashout/index.ts)

- Janela: minuto 20–88. Apenas mercados Back Casa / Back Fora. Ignora se nosso lado vence por ≥2.
- Score por janela e lado: `dangerous_attacks*1.5 + on_target*3 + corners*2 + attacks*0.3`.
- `prev10 ≈ last20 − last10`. Calcula ganho relativo do adversário (`advGain`) e do nosso lado (`ourGain`).
- Dispara quando: `advL10 > ourL10 * 1.2` AND `advGain ≥ 0.4` AND `(advGain − ourGain) ≥ 0.3`.
- **CRITICAL** (`MOMENTUM_SHIFT_CRITICAL`) se já estamos perdendo OU `advGain ≥ 0.7` → envia Telegram via `cashout-telegram-alert`, dispara som crítico em ActivePositions via realtime.
- **WARNING** (`MOMENTUM_SHIFT_WARN`) caso contrário.

## Prioridade no merge final
1. UNDER X.5 (`evaluateUnderPressure`)
2. FUTODDS pressão adversa (`evaluateFutoddsPressure`)
3. **FUTODDS momentum shift (`evaluateMomentumShift`)** ← novo
4. Saúde genérica (`classificarSaude`)

Logs em `cashout_signals_log` (`signal_type` ∈ `MOMENTUM_SHIFT_CRITICAL`, `MOMENTUM_SHIFT_WARN`). Dedupe por `bet_id + signal_type + placar`.
