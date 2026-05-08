---
name: Modo Foco
description: Trader Sports — toggle 🎯 MODO FOCO esconde tudo que não for APROVADO/APROVADO_SITUACIONAL/LABAREDA com confidence>=70; persistido em localStorage
type: feature
---

# Modo Foco (Trader #7)

`src/pages/ArenaTraderSports.tsx` ganhou:
- Estado `focusMode` (bool) persistido em `localStorage` (`arenaTraderSports.focusMode`).
- Filtro extra em `filtered`: quando ON, só mantém `mycroftStatus ∈ {APROVADO, APROVADO_SITUACIONAL, opportunity, LABAREDA}` E `confidence >= 70`.
- Toggle 🎯 no canto direito da linha de chips de Região, com glow warning quando ativo.

Reduz ruído cognitivo — usuário vê só o que vale a entrada agora.
