---
name: Over 0.5 HT Veto Window
description: Trader Sports só aprova Over 0.5 HT entre minuto 5 e 20 com placar 0x0; fora dessa janela vira AGUARDAR
type: feature
---

# Over 0.5 HT — Janela de aprovação 5'–20' (0x0)

Em `analyze-live-matches/index.ts` (VETO TEMPORAL):

- Aprovado APENAS quando `5 ≤ minute ≤ 20` E `score_home + score_away === 0`.
- Fora dessa janela (minuto < 5, > 20, ou já tem gol) → `verdict = AGUARDAR`, `plan_name = null`, thesis prefixada com `[VETO TEMPORAL]`.
- Após 20' sugerir mentalmente Over 0.5 FT ou Back ao time dominante (no thesis).

Motivo: após 20' o preço do Over 0.5 HT despenca e o EV positivo desaparece; antes de 5' não há leitura estatística suficiente.
