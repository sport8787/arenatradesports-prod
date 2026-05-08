---
name: xG Unavailable Auto-Veto
description: Em analyze-live-matches, quando enrichedStats.xg_unavailable=true e verdict ativo, aplica -10pp confidence; LABAREDA→APROVADO_SITUACIONAL; conf<50→AGUARDAR
type: feature
---

# Auto-Veto xG Indisponível (Trader #8)

Quando todos os provedores (Sportmonks/SofaScore/Flashscore/AF) falham em prover xG mas há ≥2 chutes, o flag `enrichedStats.xg_unavailable=true` é setado em `analyze-live-matches`.

## Regras (aplicadas após CALIBRATION FLOOR e ANTES do insert):
1. Verdict ativo (APROVADO/APROVADO_SITUACIONAL/LABAREDA) com `xg_unavailable=true` → `confidence -= 10pp`.
2. **LABAREDA NUNCA é emitido sem xG** → rebaixa para `APROVADO_SITUACIONAL`.
3. Se `confidence < 50` após penalidade → vira `AGUARDAR` (`plan_name=null`).
4. Alerta `[xG INDISPONÍVEL] -10pp aplicados (de X% para Y%)` adicionado em `analysis.alerts`.

Override admin via `live_match_stats_overrides` zera o flag (`xg_unavailable=false`) e bypassa este veto.
