---
name: subscription-system
description: Planos starter/basic/base/premium com matriz de arenas explícita, trial libera tudo por cortesia, sem limite mensal de posições
type: feature
---
## Sistema de Assinaturas (atualizado 01/05/2026)

### Matriz de planos (canônica — usada em Paywall.tsx, OfertaEspecial.tsx, RequireArena, useSubscription, kiwify-webhook, admin-grant-subscription)
- `trial` — todas arenas (cortesia, comunicado em Paywall e RequireArena)
- `starter` (R$ 99,90/mês) — `arena_live` apenas
- `basic`   (R$ 99,90/mês) — `arena_punter` apenas (espelho invertido do Starter)
- `base`    (R$ 149,90/mês, "MAIS ESCOLHIDO") — `arena_live + arena_punter`
- `premium` (R$ 199,90/mês, "TUDO LIBERADO") — todas arenas + chat Mycroft em cada jogo

OfertaEspecial = mesma matriz com 50% OFF (49,95 / 49,95 / 74,95 / 99,95).

Cada card de plano lista explicitamente "Está incluso" (✓ verde) e "Não está incluso" (✗ riscado). Banner azul informa que o trial libera tudo por cortesia.

Grid de planos: `md:grid-cols-2 lg:grid-cols-4` (4 cards).

### Constraint do banco
`validate_subscription_plan()` aceita: trial, starter, basic, base, premium.

### Edge functions
- `kiwify-webhook` PRODUCT_MAP: `basic` casa primeiro que `base` (substring match) e `punter` → `basic`. starter→arena_live, basic→arena_punter.
- `admin-grant-subscription`: PLAN_ARENAS inclui `basic: ["arena_punter"]`.

### Gates de chat Mycroft
Apenas `premium` libera chat em cada jogo. Starter/basic/base recebem `plan_insufficient`.

### Removido (01/05/2026)
- ❌ "Até 50 posições/mês" — copy inventada, sem enforcement no DB.
- ❌ Nomes "Professional" e "Enterprise" no checkout.
- ❌ mockMatches Brasil x Argentina em ArenaTraderSports.

### Tabelas
- `user_subscriptions`: `allowed_arenas TEXT[]`, `payment_provider`, `external_order_id`, `payment_amount`, `notes`. Override `hasAccess: true` REMOVIDO.
- `purchase_events`: auditoria webhooks Kiwify.

### Frontend
- `useSubscription`: `hasArena()`, `allowedArenas`, `isPaid` (inclui basic).
- `<RequireArena arena=… arenaLabel=…>` wrapper bloqueia rotas.
- `PunterMenuHeroStatus` no /menu: sinais hoje + ROI 24h + Green/Red 24h.
