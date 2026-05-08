---
name: Punter Exchange Edge (Betfair via Futodds)
description: Edge real calculado contra Betfair Exchange (sem margem) substitui edge bookmaker. Rebaixa APROVADO para VETADO se edge_exchange < 4pp. Snapshot persistido em punter_clv_log para CLV. Badge ExchangeEdgeBadge no detail do sinal Punter.
type: feature
---

## Pipeline (mycroft-punter-anthropic)
Após Sherlock + Calibração, antes do upsert em `punter_sinais`:
1. `resolveFutoddsEventId(supabase, home, away, commence)` → busca `event_id` em `cached_odds_games` (alimentado por `futodds-upcoming-cache`). Match exato normalizado em home+away, mais próximo no tempo.
2. `getExchangeQuote(eventId, market)` → GET `/matches-betfair-live-odds` (cache 30s memória). `classifyMarket()` → h2h/over-under/btts. `extractQuote()` faz parsing defensivo.
3. `mid = (back+lay)/2`, `fair_prob = 1/mid`, `edge_pp = (estimated_prob/100)*mid - 1`.
4. Se APROVADO E `edge_pp < 4pp` → rebaixa para VETADO (`exchange_demoted=true`, `veto_reason` específico).
5. Upsert em `punter_clv_log` (UNIQUE match_id+market) com snapshot open.

## Tabela `punter_clv_log`
match_id, market, futodds_event_id, home/away, commence_time, bookmaker_odd, bookmaker_edge_pp, open_back/lay/mid/fair_prob/edge_pp, close_back/lay/mid (cron CLV futuro), clv_pp, demoted_by_exchange. RLS read público; gravação por service role.

## Helper compartilhado
`supabase/functions/_shared/futoddsExchange.ts` — `resolveFutoddsEventId()`, `classifyMarket()`, `getExchangeQuote()`, `computeExchangeEdgePP()`. Reutilizável por outras edges (steam detector, CLV cron).

## UI
`src/components/punter/ExchangeEdgeBadge.tsx` — Badge mostra "Edge real (Exchange) +X.Xpp · back/lay" no detail do sinal (Punter.tsx ~2085). Vermelho com "Falso valor" quando `demoted_by_exchange=true`. Verde quando edge ≥5pp.

## Próximo passo (item #3 do plano)
Cron `punter-clv-snapshot` que roda 5min antes do commence_time captura `close_back/lay/mid` e calcula `clv_pp = (open_mid/close_mid - 1)*100`. Métrica de qualidade objetiva por sinal.
