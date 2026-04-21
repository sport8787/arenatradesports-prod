---
name: Mercados Extras Punter
description: Edge functions mycroft-extra-markets (Dupla Chance, Handicap Asiático ±0.5/±1.0) e mycroft-cards-punter (Cartões híbrido) salvam em punter_analyses. Crons 11:35/17:35 (extras) e 11:40/17:40 (cards). Índice único uniq_punter_analyses_match_market garante upsert.
type: feature
---

## Mercados Extras (Punter)

**Edge functions:**
- `mycroft-extra-markets` — Dupla Chance (1X/X2/12) + Handicap Asiático ±0.5/±1.0 via Poisson + The Odds API (`double_chance`, `spreads`).
- `mycroft-cards-punter` — Cartões híbrido: API-Football (média Yellow+Red últimos 8 jogos) + The Odds API (`cards_totals`). Sem odd → `verdict='APROVADO_SITUACIONAL'` informativo.

**Persistência:**
- Mesma tabela `punter_analyses` (mistura no feed normal).
- Índice único `(match_id, market)` permite upsert idempotente.

**Critérios:**
- Edge mínimo 4%, odds 1.45-3.0.
- Cartões: margem mínima 1.0 cartão entre média e linha para publicar.

**Crons (UTC):** 11:35/17:35 (extras) e 11:40/17:40 (cards), 5min após `mycroft-punter-analysis`.

**Service:** `src/services/extraMarketsService.ts` expõe `runExtraMarkets()`, `runCards()`, `runAll()`.

**Próximo passo:** mercado de Jogadores (gols/chutes/assistências) via API-Football `/players`.
