---
name: Sportmonks Prematch Context (lineups/formations/injuries)
description: Edge sportmonks-prematch-context busca lineups+formations+sidelined, classifica formação (ultra_defensiva→ofensiva), detecta missing key (striker/goalkeeper) e devolve hints (underBoost/overBoost/vetoBack). Consumido por analyze-live-matches via supabase.functions.invoke. Cache 6h em prematch_context_cache.
type: feature
---

# Sportmonks Prematch Context

## Edge `sportmonks-prematch-context`
Input: `{ match_id, sm_fixture_id, force? }`
Include Sportmonks: `participants;lineups.player;formations;sidelined.player`

Saída `context`:
- `formationProfile.home/away`: ultra_defensiva | defensiva | equilibrada | ofensiva
- `missingKey.{home,away}`: { striker, goalkeeper, names[] }
- `hints.underBoost` / `hints.overBoost` (em pp)
- `hints.vetoBack.{home,away,reason}`

## Regras de hints
- Atacante chave fora → underBoost +4
- Goleiro titular fora → underBoost -8, overBoost +5
- Formação ultra-defensiva (qualquer lado) → underBoost +3
- Ambos ofensivos → overBoost +4
- Striker + Goalkeeper do MESMO lado fora → vetoBack desse lado

## Consumo em analyze-live-matches
Aplicado após o xG TRIGGER/VETO, antes do CALIBRATION FLOOR. Só roda se `match.sm_fixture_id` existir e verdict for ativo. Veto BACK rebaixa para AGUARDAR; boosts/penalidades em pp; se confidence pós-ajuste < 50 → AGUARDAR.

## Tabela `prematch_context_cache`
- `match_id` (PK) | `payload` jsonb | `fetched_at` timestamptz
- RLS: SELECT autenticado, escrita apenas service_role
- TTL: 6h
