---
name: Trader Sports — apenas Tier A ativo
description: Tier B e C foram desativados (enabled=false) em 09/05/2026 para reduzir ruído de sinais e proteger ROI; só Tier A (17 ligas principais) gera análise/aprovação
type: constraint
---

09/05/2026 — Após expansão para ~120 ligas (A+B+C), volume de APROVADOS explodiu sem evidência de melhora de ROI e gerando ruído para o usuário (Trader Sports + Telegram).

Decisão: `UPDATE trader_leagues SET enabled=false WHERE tier IN ('B','C')`. Apenas Tier A (17 ligas: Brasileirão, top-5 europeias, Libertadores, Champions, copas continentais, seleções) permanece ativo no `getAllowedLeagueIds()`.

**Why:** ROI esperado cai com aprovação indiscriminada em ligas exóticas (dados rasos, líquidez fraca, calibração ruim). Usuário se perde com volume.

**How to apply:** Não reativar Tier B/C automaticamente. Reativação manual (parcial ou total) só via `/admin/trader-leagues` se houver pedido explícito do usuário ou evidência empírica de ROI positivo por liga.
