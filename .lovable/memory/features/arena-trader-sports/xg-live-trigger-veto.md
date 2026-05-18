---
name: xG Live Trigger/Veto
description: Em analyze-live-matches, xG ao vivo Sportmonks aplica veto Under 2.5/3.5 (xG>2.2 antes 60'), promove LABAREDA (0x0+35'+xG>1.8) e dá boost +5pp BACK dominante. Em sinais-alavanca-scanner, veta Under 4.5 se xG total >=2.5 ou projetado >=4.0.
type: feature
---

# xG Live Trigger/Veto

## analyze-live-matches (após xG INDISPONÍVEL, antes do CALIBRATION FLOOR)
- **V1 VETO**: verdict ativo Under 2.5/3.5 antes do 60' com xG total > 2.2 e gols < linha → AGUARDAR.
- **T1 LABAREDA**: 35'–70', 0x0, xG total > 1.8 em Over X.5 ou BTTS SIM (APROVADO/SITUACIONAL) → vira LABAREDA (+5pp).
- **T2 BOOST**: minuto >= 25, BACK casa/fora, xG do nosso lado >= 2× adversário e >= 0.8 → +5pp confidence.
- Skipped se `xg_unavailable=true` (já é tratado pelo veto anterior).

## sinais-alavanca-scanner (runLive)
- Lê `live_matches.stats.xG_home/away`.
- Veto: xG total >= 2.5 OU projetado (xG * 90/min) >= 4.0 com min >= 20.
- Boost +10: xG total <= 1.0 com min >= 30 (jogo amarrado).
