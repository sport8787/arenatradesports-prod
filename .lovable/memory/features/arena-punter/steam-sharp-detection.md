---
name: Steam/Sharp Money Detection
description: Motor de detecção de movimentação Sharp money via Futodds Exchange — snapshots por minuto, drift >=4%/15min sinaliza in_favor/against, badge no Punter
type: feature
---

# Steam/Sharp Money Detection (Punter — item #6)

Detecta movimentação significativa de odds Exchange Betfair (smart money) usando Futodds como 2ª fonte (1ª é o snapshot CLV já em punter_clv_log).

## Tabelas
- `punter_steam_snapshots` (event_id, market, side, back/lay/mid, captured_at) — histórico bruto.
- `punter_steam_signals` (match_id, market, direction in_favor|against|neutral, drift_pct, window_minutes, open_mid, close_mid).

## Helper
`supabase/functions/_shared/steamDetection.ts`
- `STEAM_THRESHOLD_PCT = 4.0` (drift mínimo p/ sinalizar)
- `STEAM_WINDOW_MIN = 15` (janela máxima de comparação)
- `STEAM_VETO_PCT = 7.0` (referência p/ vetos futuros)
- `captureSteamSnapshot()`, `detectSteam()`, `persistSteamSignal()`

## Edge + Cron
`punter-steam-monitor` roda 1x/min (cron `* * * * *`). Pega sinais de `punter_clv_log` com kickoff em [-15min, +6h], captura snapshot e detecta steam comparando com snapshot mais antigo na janela.

drift_pct = (open_mid/close_mid - 1)*100 — positivo = odd caiu (mercado entrou no lado).
direction = in_favor se pickedSide==quote.side e drift>0; against se pickedSide==quote.side e drift<0; e vice-versa quando lados diferem.

## UI
`src/components/punter/SteamBadge.tsx` exibe último steam não-neutro nas últimas 6h. Aparece logo abaixo do `ExchangeEdgeBadge` em `src/pages/Punter.tsx`.

## Próximos passos (não implementados ainda)
- Veto automático no `mycroft-punter-anthropic` quando drift_pct against >= STEAM_VETO_PCT.
- Boost de confidence quando in_favor (>= STEAM_THRESHOLD_PCT).
