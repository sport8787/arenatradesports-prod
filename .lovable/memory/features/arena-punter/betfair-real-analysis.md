---
name: Página Apostas Reais Betfair
description: Página dedicada /punter/betfair-real separa análise de apostas REAIS da Betfair (sincronização + Hórus) da banca virtual. Edge function analyze-real-bets cruza bets_history (source=betfair) com mycroft_analyses, detecta padrões de erro (ignorou_veto, entrada_cega, odd_baixa), calcula CLV e gera insights via Lovable AI Gateway (gemini-2.5-flash).
type: feature
---

## Apostas Reais Betfair (`/punter/betfair-real`)

### Separação de responsabilidades
- **`/punter/betfair-real`** — Apostas REAIS Betfair (sincronização + análise Hórus + comparação com sinais ATS).
- **`/punter/import`** — CSV/PDF/screenshot manuais + analytics da banca virtual Hórus. Tem aviso/atalho para a página de Betfair real.

### Edge function `analyze-real-bets`
- Carrega `bets_history` onde `source='betfair'` dos últimos 60 dias.
- Carrega `mycroft_analyses` do mesmo período.
- Cruza por `match_id` exato OU por nome dos times + janela ±30h + mercado equivalente (normalizado).
- Classifica alinhamento: `aligned_won`, `aligned_lost`, `against_signal` (ignorou veto), `no_signal` (entrada cega), `pending`.
- Tags de erro: `odd_baixa` (<1.50), `odd_alta_risco` (>3.50), `ignorou_veto`, `entrada_cega`, `perda_total`.
- CLV calculado como `(probEntry - probClose) / probClose * 100` quando `odd_close` existe.
- Insights gerados via Lovable AI Gateway (`google/gemini-2.5-flash`) com sumário agregado dos REDs.

### UI
- Card 1 — Sincronizar com a Betfair (BetfairConfig + botões sync/re-sync).
- Card 2 — Análise do Hórus Punter: KPIs (Total, ROI, P/L, CLV médio), comparativo ATS, diagnóstico em markdown, lista de até 100 apostas com badges.
