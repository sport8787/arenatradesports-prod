---
name: Multi-Market Reanalysis (Live)
description: Trader Sports Live reanalisa jogos APROVADOS a cada 3 min para entregar mercados COMPLEMENTARES (ex: aprovou Over 0.5 HT → pode aprovar Over 2.5 FT depois). Vínculo original em live_matches preservado.
type: feature
---

# Múltiplas Entradas no Mesmo Jogo (Live)

**Edge:** `supabase/functions/analyze-live-matches/index.ts` + `supabase/functions/mycroft-sports-analysis/index.ts`

## Regras

- Jogos APROVADO/APROVADO_SITUACIONAL voltam para reanálise com `effectiveStatus = 'approved_extra'`:
  - intervalo: 3 min (<60'), 2 min (>=60'), corte aos 85'.
- Antes de chamar Mycroft, busca todos `mycroft_analyses` aprovados do `match_id` e injeta como `match.existingApprovedMarkets`.
- Prompt do Mycroft recebe bloco "🎯 MERCADOS JÁ APROVADOS — NÃO REPETIR" e instrução para procurar mercados complementares (Over X.5 maior, BTTS, escanteios) com critérios PLENOS.
- Após análise:
  - Se mercado retornado bate (normalizeMarketKey) com algum já aprovado → vira AGUARDAR + thesis `[DUPLICATA]`.
  - Se já havia APROVADO e nova análise NÃO traz APROVADO → preserva vínculo original em `live_matches` (não sobrescreve para AGUARDAR/JOGO_MORTO).
  - Se traz novo APROVADO complementar → grava em `mycroft_analyses` e atualiza `live_matches.mycroft_analysis_id` para o mais novo (Telegram dispara via gatilho normal com dedupe por match+market+verdict).

## Anti-conflito

A trigger SQL `prevent_conflicting_punter_markets` cobre Punter. Para Live (mycroft_analyses) o controle é via prompt + dedupe de mercado normalizado. Mercados conflitantes (Over vs Under da mesma linha) confiam no julgamento do Mycroft via instrução explícita "NUNCA aprove conflitantes".

## Veto temporal (mantido)

Permanece atuando POR mercado (Over 0.5 HT só ≤30' e 0x0; Over 1.5–4.5 FT só ≤70'). Veto de UM mercado NÃO impede aprovação de outros mercados na mesma reanálise.
