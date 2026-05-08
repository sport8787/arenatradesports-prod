---
name: Punter CLV Automation
description: Cron a cada 2min (punter-clv-snapshot) captura close_back/lay/mid Exchange para sinais Punter cujo commence_time esteja a 0–8min. Calcula clv_pp = (open_mid/close_mid - 1)*100 e grava em punter_clv_log. Badge ExchangeEdgeBadge exibe "CLV +X.X%" verde/vermelho.
type: feature
---

## Edge `punter-clv-snapshot`
- Seleciona em `punter_clv_log` linhas com `close_mid_odd IS NULL`, `futodds_event_id NOT NULL` e `commence_time` entre `now-1min` e `now+8min` (limite 50).
- Para cada uma chama `getExchangeQuote(event_id, market)` (helper compartilhado, cache 30s).
- Atualiza `close_back/lay/mid_odd`, `close_captured_at` e `clv_pp = (open_mid/close_mid - 1)*100`.
- Positivo = sinal pegou valor antes do mercado fechar (CLV+); negativo = mercado virou contra.

## Cron
`punter-clv-snapshot` agendado em pg_cron a cada 2min (job id varia por ambiente).

## UI
`ExchangeEdgeBadge` agora também consulta `clv_pp` e `close_mid_odd` e renderiza chip "CLV ±X.X%" à direita quando capturado. Verde se >0, vermelho se <0.

## Próximos passos do plano
- #5 Liquidação Punter via Futodds (economia de cota API-Football)
- #6 Steam/Sharp com Futodds Exchange como segunda fonte
- #4 Filtros de liga/mercado visíveis (Trader)
