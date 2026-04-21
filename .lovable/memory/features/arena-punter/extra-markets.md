---
name: Mercados Extras Punter
description: Edge functions mycroft-extra-markets (Dupla Chance, Handicap Asiático/Europeu), mycroft-cards-punter (Cartões híbrido) e mycroft-players-punter (Jogadores: gols, chutes, assistências) salvam em punter_analyses. Crons 11:35/17:35 (extras), 11:40/17:40 (cards), 11:50/17:50 (players). Índice único uniq_punter_analyses_match_market garante upsert.
type: feature
---

## Mercados Extras (Punter)

**Edge functions:**
- `mycroft-extra-markets` — Dupla Chance (1X/X2/12) + Handicap Asiático ±0.5/±1.0 via Poisson + The Odds API.
- `mycroft-cards-punter` — Cartões híbrido: API-Football (média Yellow+Red últimos 8 jogos) + The Odds API (`cards_totals`). Sem odd → `APROVADO_SITUACIONAL`.
- `mycroft-players-punter` — Jogadores: top 3 por time via API-Football `/players` (gols/90, chutes/90, SOG/90, ass/90). Mercados: Marcar a qualquer momento, Chutes 1.5/2.5, SOG 0.5/1.5, Assistência. Odds via The Odds API (`player_goal_scorer_anytime`, `player_shots`, `player_shots_on_target`, `player_assists`).

**Persistência:**
- Tabela `punter_analyses` (mistura no feed normal).
- Índice único `(match_id, market)` permite upsert idempotente.

**Critérios:**
- Edge mínimo: 4% (extras/cards), 5% (jogadores — mais ruidoso).
- Jogadores: amostra mínima 5 jogos / 200min, margem prob estimada vs implícita ≥ 8pp.
- Cartões: margem ≥ 1.0 cartão entre média e linha.

**Crons (UTC):**
- 11:35/17:35 — extras
- 11:40/17:40 — cards
- 11:50/17:50 — players

**Service:** `src/services/extraMarketsService.ts` expõe `runExtraMarkets()`, `runCards()`, `runPlayers()`, `runAll()`.

**Limites:** Players analisa MAX_GAMES=15 (consome ~6 req/jogo só para listar squads + odds), versus 25 dos cards.
