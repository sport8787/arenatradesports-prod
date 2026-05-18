---
name: Sportmonks Predictions — segunda opinião do Mycroft
description: Edge sportmonks-predictions-fetch + helper compartilhado probeSportmonksPrediction integrados em mycroft-punter-analysis (Gemini) e mycroft-punter-anthropic. Divergência >15pp marca sherlock_alert (não veta); log shadow em punter_predictions_shadow para calibração.
type: feature
---

Endpoint `/football/predictions/probabilities/fixtures/{id}` da Sportmonks Pro Advanced consumido como segunda opinião do modelo Mycroft.

## Onde vive

- **Edge `sportmonks-predictions-fetch`** — recebe `{ match_id, home_team, away_team, commence_time, sm_fixture_id? }`, resolve sm_fixture_id por busca em `/football/fixtures/date/{ymd}` ±1d com matching fuzzy de nomes, busca predictions e normaliza (`home_win`, `draw`, `away_win`, `over_25`, `under_25`, `btts_yes`, `btts_no`, ±1.5, ±3.5). Cache 6h em `sportmonks_predictions_cache`.
- **Helper `_shared/sportmonksPredictions.ts`** — `probeSportmonksPrediction()` mapeia o `market` Mycroft (Casa/Fora/Empate/Over/Under X.5/BTTS) para a chave Sportmonks; calcula `divergence_pp = |myProb - smProb|`; se >15pp seta `sherlock_alert=true` + nota `"⚠️ Divergência de modelos: Mycroft X% vs Sportmonks Y% (Δpp). Operar com cautela."`. `logShadowPrediction()` grava em `punter_predictions_shadow`.

## Integração

- `mycroft-punter-analysis` (Gemini, fluxo primário): probe após gate e antes do insert em `punter_analyses`. Persiste `sherlock_alert`, `sportmonks_probability`, `sportmonks_divergence_pp`, `sportmonks_prediction` na linha + grava shadow log.
- `mycroft-punter-anthropic` (fluxo Anthropic): mesmo probe, persiste nas mesmas colunas em `punter_sinais`.
- Trigger DB `mirror_shadow_predictions_result` espelha `was_green` em `punter_predictions_shadow` quando `punter_analyses.result` é preenchido.

## UI

`src/components/punter/SportmonksPredictionBadge.tsx` aparece no card de Sinais do Punter abaixo do `SteamBadge`. Só renderiza se `sportmonks_probability` existir. Tom amarelo (cautela) quando `sherlock_alert=true` ou divergência >15pp.

## Não veta

Apenas informa. Threshold 15pp escolhido como ponto onde divergência vira sinal útil (abaixo é ruído de modelo).
