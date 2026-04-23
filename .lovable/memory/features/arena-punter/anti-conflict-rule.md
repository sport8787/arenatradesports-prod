---
name: Regra Anti-Conflito Punter
description: Trigger BEFORE INSERT em punter_analyses bloqueia mercados opostos no mesmo jogo (Over vs Under mesma linha, BTTS Sim vs Não, 1X2 conflitante). Múltiplas entradas independentes (vários jogadores, diferentes mercados) continuam permitidas.
type: feature
---

## Regra Anti-Conflito (Arena Punter)

**Trigger:** `trg_prevent_conflicting_punter_markets` (BEFORE INSERT em `punter_analyses`)
**Função:** `prevent_conflicting_punter_markets()`

### O que bloqueia
1. **Over X.5 vs Under X.5** — mesma linha + mesma estatística + mesmo escopo (jogo OU jogador via prefixo "Nome —").
2. **BTTS Sim vs Não** — qualquer variação (ambas marcam, both teams to score).
3. **1X2** — Casa, Fora, Empate (não permite dois resultados conflitantes).

### O que permanece permitido
- Múltiplos jogadores no mesmo jogo (ex: 4 jogadores × Under chutes).
- Mercados diferentes no mesmo jogo (ex: Under 6.5 Cartões + Over 0.5 SOG jogador X).
- Lados diferentes em mercados não conflitantes (handicaps com linhas diferentes).

### Aplicação
Só age para verdicts `APROVADO`, `APROVADO_SITUACIONAL`, `LABAREDA`. Outros verdicts (VETADO, etc.) passam livre.

Combinada com índice único `(match_id, market)` em `punter_analyses` (uniq_punter_analyses_match_market) que impede duplicatas exatas.
