---
name: League Tier System (A/B/C)
description: Trader Sports — whitelist de ligas migrada para tabela trader_leagues com tiers A/B/C; cobertura ampliada para ~120 ligas sem estourar Gemini
type: feature
---

# Sistema de Tiers de Ligas — Trader Sports

## Tabela `public.trader_leagues`
PK `league_id` (API-Football). Colunas: `name`, `country`, `region`, `tier (A|B|C)`, `enabled`, `odds_sport_key`. RLS: SELECT público, ALL admin.

## Distribuição (08/05/2026)
- **Tier A (17)**: top mundial — análise IA completa, `gemini-2.5-flash`.
- **Tier B (52)**: secundárias — IA enxuta, `gemini-2.5-flash-lite`, max 20 jogos/run.
- **Tier C (50)**: cauda longa — só estatística determinística (Sherlock), **sem IA**.

## Helper compartilhado
`supabase/functions/_shared/leaguesRegistry.ts`:
- Cache em memória TTL 30min.
- `getAllowedLeagueIds()`, `getLeagueTier(id)`, `getLeaguesByTier(t)`, `getOddsSportKeyMap()`.
- `geminiModelForTier(t)`, `maxGamesForTier(t)`.

## Edges adaptadas
- `fetch-live-matches`: substitui constante `LIGAS_PERMITIDAS` por `getAllowedLeagueIds()`. Live é determinístico → custo 0 em IA mesmo cobrindo tiers A+B+C.
- `handicap-asiatico-prelive`: aceita só A+B (`getCachedAllowedHA`).
- `plano-favorito-prelive`: aceita só A+B (`getAllowedFav`).

## UI Admin
`/admin/trader-leagues` — tabela editável com tier/região/enabled/odds_key + filtros + busca. Linkada no AdminHub (grupo Operação).

## Por que não estoura Gemini
Cobertura cresceu ~7x (17→119 ligas) mas custo Gemini cresce ~30-40% porque:
1. Live (analyze-live-matches) é 100% determinístico.
2. Tier C nunca chama IA pré-live.
3. Tier B usa flash-lite (3-5x mais barato que flash).
