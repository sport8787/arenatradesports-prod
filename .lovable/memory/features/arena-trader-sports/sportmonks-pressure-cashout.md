---
name: Pressure Index Sportmonks (cashout)
description: evaluate-cashout/evaluateFutoddsPressure agora combina pressure_home/away (Futodds) com pressure_index_home/away (Sportmonks). Critério 4 adicional escala WARN→CRITICAL quando ambas as fontes concordam (advFut>=70 + advSm>=70, Δ>=12 em ambos).
type: feature
---

# Pressure Index Sportmonks no Cashout

## Mudança em `evaluateFutoddsPressure`
- pAdv = MAX(Futodds, Sportmonks) — early-warning conservador
- pOur = MIN(Futodds, Sportmonks) — não esconde fragilidade do nosso lado
- Função funciona com qualquer uma das duas fontes (graceful fallback)

## Critério 4 (NOVO)
Se ambas as fontes existem e:
- advFut >= 70 AND advSm >= 70
- (advFut - ourFut) >= 12 AND (advSm - ourSm) >= 12
→ marca `critical = true` (mesmo sem ter atingido o Critério 1 sozinho).

Adiciona `SM+Futodds concordam (SM X/Fut Y)` em reasons.

Mantém prioridade no merge final: Under25 → Futodds pressure (com SM) → MomentumShift → Saúde genérica.
