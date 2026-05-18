---
name: Punter Pré-live Cron Spread
description: Disparos pré-live espalhados em 5 horários BRT (08:30/11:30/14:30/17:30/20:30) em vez de um único 08:30. Aumenta engajamento (usuário entra mais vezes/dia) e distribui carga. Cron antigo punter-prelive-geral-1130-utc desativado; edge mantida para chamadas manuais.
type: feature
---

## Crons ativos (UTC)

| Jobname | UTC | BRT | Edge |
|---|---|---|---|
| `punter-prelive-sportmonks-0830-brt` | 11:30 | 08:30 | `mycroft-punter-sportmonks` (1X2/OU/BTTS) |
| `punter-prelive-ah-1130-brt` | 14:30 | 11:30 | `handicap-asiatico-prelive` |
| `punter-prelive-cards-1430-brt` | 17:30 | 14:30 | `mycroft-cards-punter` |
| `punter-prelive-players-1730-brt` | 20:30 | 17:30 | `mycroft-players-punter` |
| `punter-prelive-extra-2030-brt` | 23:30 | 20:30 | `mycroft-extra-markets` (DC/AH leve, reanálise noturna) |

## Por quê
- Engajamento: usuário precisa abrir o app mais de 1x/dia para ver sinais novos.
- Telegram: feed distribuído ao longo do dia em vez de avalanche matinal.
- Carga: API-Football e Sportmonks consumidos em janelas separadas.

## Notas
- Cron antigo `punter-prelive-geral-1130-utc` foi desativado (cron.unschedule). Edge `punter-prelive-geral` continua existindo para chamadas manuais que rodam toda a pipeline em sequência.
- `mycroft-corners-punter` continua per-jogo (sob demanda no card).
- Migração para Sportmonks-only adiada — API-Football ainda é fonte primária de stats em cards/players/AH/alavanca/eventos-raros/corners; remoção exigiria projeto dedicado.

Atualiza a memória [Punter Dup Prevention v2](mem://features/arena-punter/duplicate-prevention-v2) — antes "cron único 11:30", agora 5 disparos espalhados.
