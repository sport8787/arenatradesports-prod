---
name: Mycroft Rules Engine + Shadow Mode
description: Motor de regras dinâmico (mycroft_rules + mycroft_config) por modo trader/punter, rodando em paralelo (shadow) aos 3 motores atuais; resultados comparados em analises_comparativas
type: feature
---

## Arquitetura
- Tabelas: `mycroft_rules` (id, modo trader|punter, name, category pontuacao|veto, field, operator, value, points, priority, mercado, time_start/end, active), `mycroft_config` (modo, key, value), `analises_comparativas` (modo, source_function, atual vs novo verdict/score/stake, resultado_real GREEN|RED|PUSH, settled_at)
- Motor compartilhado: `supabase/functions/_shared/mycroft-rules-engine.ts` exporta `avaliarJogo()` (determinístico, cache 1min) e `shadowCompare()` (não falha o motor atual em caso de erro)
- **Shadow integrado em 3 edges** (não substitui produção): `analyze-live-matches` (modo trader, após insert da análise), `mycroft-punter-anthropic` (modo punter, após insert), `handicap-asiatico-prelive` (modo trader, dentro de salvarSinal após espelho)
- UI admin: `/admin/mycroft-rules` (restrita a has_role admin) — Tabs Trader/Punter, sliders de config, CRUD de regras com prioridade/mercado/janela de minuto, relatório shadow (winrate por mercado: atual vs novo)

## Resultado real (campo resultado_real em analises_comparativas)
- **Trigger automático** `propagate_mycroft_result_to_shadow` AFTER UPDATE OF result em `mycroft_analyses` propaga GREEN/RED por match_id+mercado
- **Cron diário 12h UTC** `reconcile-shadow-results-daily` chama edge `reconcile-shadow-results` que varre comparativas pendentes (7 dias) e cruza com `mycroft_analyses.result` (trader) ou `punter_signals.result` (punter)

## Decisão futura
Quando houver amostra suficiente (300+ liquidações por mercado), comparar winrate via `/admin/mycroft-rules` e migrar mercados onde o motor novo supere o atual.
