---
name: Punter Settlement — Futodds First
description: punter-settle-results-v3 inverteu prioridade: Futodds /matches-ended primeiro, AF/Sportmonks/Odds API só como fallback. Helper resolveFixtureForSettlement consolida lógica e força AF apenas quando o mercado precisa (jogador via /fixtures/events; escanteios sem corners no payload Futodds).
type: feature
---

## Mudança
Helper `resolveFixtureForSettlement(home, away, startIso, market)` na ordem:
1. **Futodds /matches-ended** (cache por dia, fonte primária — não consome cota AF)
2. **API-Football** — chamada SOMENTE se:
   - Futodds não trouxe placar, OU
   - mercado é de jogador (`marcar/gol/anytime/assist`) — precisa de `fixtureId` + `/fixtures/events`, OU
   - mercado é escanteios e Futodds não expôs corners
3. **Sportmonks** — reforço quando AF também falhou
4. **The Odds API** — fallback final (status FT)

## Pipelines afetados (5 blocos consolidados)
- `punter_sinais` (mantém busca de corners via `fetchCorners(fixtureId)` quando AF retornou fixtureId mas Futodds não trouxe corners)
- `sinais_favorito_prelive` (Futodds direto — só 1X2/Over15/Over25)
- `eventos_raros_sinais` (Futodds direto — só placar exato)
- `virtual_bets_manual` e `virtual_bets_punter` (Futodds direto + AF como fallback para player markets)

## Impacto esperado
- 70-80% das liquidações resolvidas só com Futodds (gols/1X2/Over/BTTS/AH).
- AF reservada para escanteios e player markets, que já são minoria.
- Cota API-Football diária deve cair significativamente, liberando headroom para Punter pré-live e enriquecimento.

## Próximo passo
- Item #6 do plano: Steam/Sharp money detection com Futodds Exchange como segunda fonte (junto com Odds API).
