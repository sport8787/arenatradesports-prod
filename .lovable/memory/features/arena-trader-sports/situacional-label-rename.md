---
name: Situacional Label Rename
description: Verdict APROVADO_SITUACIONAL permanece no banco; UI exibe "APROVADO • CONF. REDUZIDA" (mantém cor/ícone verde claro)
type: design
---

# Rótulo "APROVADO • CONF. REDUZIDA"

- DB/edge functions: continuam usando `verdict = 'APROVADO_SITUACIONAL'` (sem breaking change).
- Frontend: rótulo exibido sempre como `APROVADO • CONF. REDUZIDA` (📍 ou 🎯), cor verde claro (#6EE7B7 / success) para distinguir de APROVADO pleno (success) e LABAREDA (laranja).
- Casos que geram esse status: (1) xG indisponível com penalidade -10pp, (2) leitura situacional S1-S4 sem critérios estatísticos completos, (3) downgrade de tier por confiança abaixo do limiar LABAREDA mas ≥50.
- Arquivos: MatchCard.tsx, CompactMatchTable.tsx, LiveMatchDetail.tsx, MycroftSinalDetalhe.tsx, MycroftSinaisAprovados.tsx.
