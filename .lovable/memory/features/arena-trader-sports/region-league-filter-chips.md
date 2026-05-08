---
name: Region & League Filter Chips
description: Trader Sports — chips de Região (Brasil/Europa/Sul-América/Outros) acima dos chips de campeonato; persistência localStorage de selectedRegions e selectedChampionships
type: feature
---

# Filtros de Região + Persistência (Trader #4)

`src/pages/ArenaTraderSports.tsx` ganhou:
- Helper `getRegionForChampionship(name)` → `BRASIL|EUROPA|SUL_AMERICA|OUTROS` (regex sobre nome do campeonato).
- Estados persistidos em localStorage: `arenaTraderSports.selectedRegions` e `arenaTraderSports.selectedChampionships` (mercados já tinham).
- UI: linha de chips "Região" (com badge de contagem por região) acima dos chips de campeonato; chips de campeonato passam a ser filtrados pelas regiões selecionadas.
- `filtered` aplica `selectedRegions` AND `selectedChampionships`.

Botão "Limpar" aparece quando há ≥1 região selecionada.
