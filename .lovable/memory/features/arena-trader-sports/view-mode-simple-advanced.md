---
name: View Mode Simples vs Avançado
description: Trader Sports — toggle Simples/Avançado no header esconde painéis técnicos; persistido em localStorage
type: feature
---

# Modo Simples vs Avançado (Arena Trader Sports)

Hook `src/hooks/useTraderViewMode.ts` (chave `traderSports:view_mode`, evento `traderSports:view_mode_changed`). Toggle UI em `src/components/arena-trader/TraderViewModeToggle.tsx` renderizado no header de `src/pages/ArenaTraderSports.tsx` ao lado do botão WhatsApp. Default: `simple`.

**Modo Simples (default):** mostra apenas tabs (Sinais Aprovados / Todos / Próximos / Ao Vivo / Pré-Live / Finalizados) + cards de jogos. Esconde:
- Action buttons row (Chat Mycroft, Eventos Raros, Performance, Por Mercado)
- View toggle Cards/Tabela
- Admin LiveCronToggle / ShadowAfCronToggle
- BankrollWidget
- ActivePositions
- Tabs `simulado` e `aprovados_af`
- Chips de mercado (filtro APROVADOS)
- Bloco de chips Região + Modo Foco + Favoritos + campeonatos
- CalibrationCard

**Modo Avançado:** revela tudo (mesmo comportamento anterior).

Espelha padrão de `usePunterViewMode` / `PunterViewModeToggle`.
